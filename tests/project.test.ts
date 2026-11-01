import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const target = fileURLToPath(new URL('../target', import.meta.url));

describe('低｜CI 與打包', () => {
  it('CI 要跑多人測試', () => {
    const workflow = readFileSync(`${target}/.github/workflows/deploy-pages.yml`, 'utf8');
    assert.match(workflow, /test:multiplayer/, 'deploy-pages.yml 只跑 npm test，沒有多人測試');
  });

  it('最大的 JS 檔要小於 500 KB（Vite 的警告門檻）', { timeout: 180_000 }, () => {
    if (!existsSync(`${target}/dist`)) execSync('npm run build', { cwd: target, stdio: 'ignore' });
    const assets = `${target}/dist/assets`;
    const sizes = readdirSync(assets).filter((name) => name.endsWith('.js')).map((name) => [name, statSync(`${assets}/${name}`).size] as const);
    const [name, size] = sizes.sort((a, b) => b[1] - a[1])[0];
    assert.ok(size < 500 * 1024, `${name} 是 ${(size / 1024).toFixed(0)} KB`);
  });
});
