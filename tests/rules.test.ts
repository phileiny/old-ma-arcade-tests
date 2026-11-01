import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { games } from '../target/src/games/catalog.ts';
import { advanceGameRun, applyGameAction, createGameRun, type GameRun } from '../target/src/games/gameplay.ts';

const spec = (id: string) => games.find((game) => game.id === id)!;
type Action = Parameters<typeof applyGameAction>[1];

describe('高｜巷口碰碰車的閃避分', () => {
  it('閃過障礙拿到的分數，過 1 秒後不能變少', () => {
    let run = advanceGameRun(createGameRun(spec('bumper-alley'), false, 5), 3);
    assert.equal(run.obstacle, true, '前置條件：3 秒時要有障礙');
    const safeLane = (run.targetLane + 1) % 3;
    run = applyGameAction(run, safeLane < run.lane ? 'LEFT' : 'RIGHT');
    const afterDodge = run.score;
    run = advanceGameRun(run, 1);
    assert.ok(run.score >= afterDodge, `閃避後 ${afterDodge} 分，1 秒後變成 ${run.score} 分`);
  });
});

describe('高｜序列類遊戲的提示鍵', () => {
  // Pick a seed whose 4th key differs from the 1st; otherwise the modulo bug is invisible.
  function seedWhereStep4Differs(id: string) {
    for (let seed = 1; seed < 500; seed++) {
      const { sequence } = createGameRun(spec(id), false, seed);
      if (sequence[3] !== sequence[0]) return seed;
    }
    throw new Error(`${id} 找不到合適的種子`);
  }

  for (const id of ['braised-bites', 'fishball-skewer']) {
    it(`${spec(id).title}：第 4 步要用序列的第 4 個鍵`, () => {
      let run = createGameRun(spec(id), false, seedWhereStep4Differs(id));
      for (let i = 0; i < 3; i++) run = applyGameAction(run, run.sequence[i]);
      const before = run.score;
      run = applyGameAction(run, run.sequence[3]);
      assert.ok(run.score > before, `按了序列第 4 個鍵 ${run.sequence[3]}，回饋是「${run.feedback}」`);
    });
  }

  it('夜市攤位大亨：第 4 次備料要用序列的第 4 個鍵', () => {
    let run = createGameRun(spec('night-market-tycoon'), false, seedWhereStep4Differs('night-market-tycoon'));
    for (let i = 0; i < 3; i++) run = applyGameAction(run, run.sequence[i]);
    run = advanceGameRun(run, 8); // restock one item so the 4th step is possible
    const before = run.score;
    run = applyGameAction(run, run.sequence[3]);
    assert.ok(run.score > before, `按了序列第 4 個鍵 ${run.sequence[3]}，回饋是「${run.feedback}」`);
  });

  it('方向鍵序列：換種子後，不能永遠是同一個 4 鍵循環', () => {
    const periodic = (sequence: GameRun['sequence']) => sequence.every((key, i) => i < 4 || key === sequence[i - 4]);
    const seeds = Array.from({ length: 50 }, (_, i) => i + 1);
    const allPeriodic = seeds.every((seed) => periodic(createGameRun(spec('hopscotch-king'), false, seed).sequence));
    assert.equal(allPeriodic, false, '種子 1–50 產生的 40 個方向鍵，全部每 4 個重複一次');
  });
});

describe('中｜麻將配對', () => {
  it('已經配對的兩張牌，再選一次不能得分', () => {
    let run = createGameRun(spec('mahjong-match'), false, 2026);
    const second = run.tiles.findIndex((tile, i) => run.tiles.indexOf(tile) !== i);
    const first = run.tiles.indexOf(run.tiles[second]);
    const key = (i: number) => (['A', 'S', 'D'] as const)[i];
    const pick = () => {
      run = applyGameAction(run, key(first)); run = applyGameAction(run, 'ACTION');
      run = applyGameAction(run, key(second)); run = applyGameAction(run, 'ACTION');
    };
    pick();
    const afterFirstMatch = run.score;
    pick();
    assert.equal(run.score, afterFirstMatch, `同一對再配一次，分數從 ${afterFirstMatch} 變成 ${run.score}`);
  });

  it('開局的牌要能全部配完，才可能「清台」', () => {
    const { tiles } = createGameRun(spec('mahjong-match'), false, 2026);
    const counts = new Map<number, number>();
    for (const tile of tiles) counts.set(tile, (counts.get(tile) ?? 0) + 1);
    assert.ok([...counts.values()].every((n) => n % 2 === 0), `牌面 ${JSON.stringify(tiles)} 有配不到的牌`);
  });
});

describe('中｜不同遊戲要有不同規則', () => {
  // Same seed + same inputs; a distinct game should produce a different score trace.
  function scoreTrace(id: string) {
    let run = createGameRun(spec(id), false, 31);
    const trace: number[] = [];
    const actions = spec(id).actions.map((item) => item.action) as Action[];
    for (let i = 0; i < 30; i++) {
      run = applyGameAction(advanceGameRun(run, 0.4), actions[(i * 7) % actions.length]);
      trace.push(run.score);
    }
    return trace;
  }

  for (const [a, b] of [['oyster-omelet', 'sausage-chef'], ['braised-bites', 'fishball-skewer']]) {
    it(`${spec(a).title} 和 ${spec(b).title} 的計分不能完全一樣`, () => {
      assert.notDeepEqual(scoreTrace(a), scoreTrace(b));
    });
  }
});
