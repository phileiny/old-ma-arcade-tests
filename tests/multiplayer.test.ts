import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { after, before, describe, it } from 'node:test';
import { Client, type Room } from '@colyseus/sdk';
import { games } from '../target/src/games/catalog.ts';
import { advanceGameRun, applyGameAction, createGameRun } from '../target/src/games/gameplay.ts';

const PORT = 2577;
const serverDir = fileURLToPath(new URL('../target/server', import.meta.url));
const tsx = fileURLToPath(new URL('../target/node_modules/.bin/tsx', import.meta.url));
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type Player = { sessionId: string; nickname: string; score: number; host: boolean; connected: boolean };

let server: ChildProcess;
const rooms: Room[] = [];

before(async () => {
  server = spawn(tsx, ['src/index.ts'], { cwd: serverDir, env: { ...process.env, PORT: String(PORT) } });
  await new Promise<void>((resolve, reject) => {
    server.stdout!.on('data', (chunk) => { if (String(chunk).includes('已啟動')) resolve(); });
    server.on('exit', (code) => reject(new Error(`房間伺服器結束，代碼 ${code}`)));
  });
});
after(async () => {
  await Promise.allSettled(rooms.map((room) => room.leave()));
  server.kill();
});

async function join(nickname: string, roomId?: string, gameId = 'night-market-rush') {
  const client = new Client(`ws://127.0.0.1:${PORT}`);
  const room = roomId ? await client.joinById(roomId, { nickname }) : await client.create('arcade', { nickname, gameId });
  rooms.push(room);
  const state = { players: [] as Player[], seed: 0, winners: [] as string[], timeLeft: 40, roundOver: false };
  room.onMessage('players', (players: Player[]) => { state.players = players; });
  room.onMessage('game-start', ({ seed }: { seed: number }) => { state.seed = seed; });
  room.onMessage('score', ({ scores, timeLeft }: { scores: Player[]; timeLeft: number }) => { state.players = scores; state.timeLeft = timeLeft; });
  room.onMessage('round-over', ({ winners }: { winners: string[] }) => { state.winners = winners; state.roundOver = true; });
  room.onMessage('error', () => {});
  return { room, state };
}

async function startMatch(gameId: string) {
  const host = await join('房主', undefined, gameId);
  const guest = await join('朋友', host.room.roomId);
  await pause(150);
  host.room.send('ready', { ready: true }); guest.room.send('ready', { ready: true });
  await pause(150);
  host.room.send('start');
  await pause(200);
  assert.ok(host.state.seed > 0, '前置條件：比賽要開始');
  return { host, guest };
}

describe('中｜多人：畫面和伺服器的分數要一致', () => {
  it('快速連按時，伺服器的分數要等於玩家畫面上的分數', async () => {
    const { host } = await startMatch('night-market-rush');
    // The real client applies every key locally, then sends it to the server.
    let local = createGameRun({ id: 'night-market-rush', singleSeconds: 40 } as never, true, host.state.seed);
    for (const [index, wait] of [[0, 50], [1, 200], [2, 200]] as const) {
      const action = local.sequence[index];
      local = applyGameAction(local, action);
      host.room.send('input', { action });
      await pause(wait);
    }
    const onServer = host.state.players.find((player) => player.nickname === '房主')!.score;
    assert.equal(onServer, local.score, `玩家畫面 ${local.score} 分，伺服器記 ${onServer} 分`);
  });
});

describe('高｜多人：巷口碰碰車要分得出勝負', () => {
  it('一人每次都閃過、一人都不動，40 秒後不能平手', { timeout: 60_000 }, async () => {
    const { host, guest } = await startMatch('bumper-alley');
    // Mirror the server's run so the host knows when an obstacle appears.
    let local = createGameRun(games.find((game) => game.id === 'bumper-alley')!, true, host.state.seed);
    let lastTime = 40;
    while (!host.state.roundOver) {
      await pause(50);
      if (host.state.timeLeft === lastTime) continue;
      local = advanceGameRun(local, lastTime - host.state.timeLeft);
      lastTime = host.state.timeLeft;
      if (local.obstacle) {
        const safeLane = (local.targetLane + 1) % 3;
        const action = safeLane < local.lane ? 'LEFT' : 'RIGHT';
        local = applyGameAction(local, action);
        host.room.send('input', { action });
      }
    }
    assert.ok(local.tokens > 0, '前置條件：房主要真的閃過障礙');
    assert.deepEqual(host.state.winners, ['房主'], `房主閃過 ${local.tokens} 次，結果勝者是 ${JSON.stringify(host.state.winners)}；分數 ${JSON.stringify(host.state.players.map((p) => [p.nickname, p.score]))}`);
    void guest;
  });
});

describe('低｜多人：房主交接', () => {
  it('房主離開時，不能把房主交給斷線中的玩家', async () => {
    const host = await join('房主');
    const dropped = await join('斷線玩家', host.room.roomId);
    const online = await join('在線玩家', host.room.roomId);
    await pause(150);
    dropped.room.reconnection.enabled = false;
    await dropped.room.leave(false); // not consented = an unexpected drop; the seat is kept for 20 s
    await pause(200);
    await host.room.leave();
    await pause(300);
    const newHost = online.state.players.find((player) => player.host);
    assert.ok(newHost, '要有新房主');
    assert.equal(newHost.connected, true, `新房主是「${newHost.nickname}」，在線 = ${newHost.connected}`);
  });
});
