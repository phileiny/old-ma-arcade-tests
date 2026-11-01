# old-ma-arcade-tests

這個 repo 專門測試 [tonnychiulab/old-ma-noodle-arcade](https://github.com/tonnychiulab/old-ma-noodle-arcade)（老馬麵攤製作：台灣夜市街機 30 合 1）。

每個測試檢查「正確的行為」。bug 還在時，測試會失敗；修好後，測試會通過。

原專案用 git submodule 放在 `target/`，固定在 commit `1141003`。

## 結果（2026-11-01）

**結論：有 bug。下面 7 個問題全部是真的。**

### 怎麼看測試結果

每個測試檢查遊戲「應該」怎麼運作，例如「閃過障礙拿到的分數不能消失」。

| 測試結果 | 意思 |
|---|---|
| 失敗 ❌ | 有 bug（現在的狀態） |
| 通過 ✅ | 沒 bug（修好之後會變成這樣） |

- 這個 repo 的 14 個測試：全部失敗。也就是 14 個檢查點都抓到 bug，整理成下表的 7 個問題。
- 原專案自己的 12 個測試：全部通過。但它們沒有檢查這些地方，所以抓不到這些 bug。通過不代表沒 bug。

| 嚴重度 | 問題 | 測試 | 實際結果 |
|---|---|---|---|
| 高 | 巷口碰碰車的閃避分每秒被蓋掉 | `rules` | 閃避後 13 分，1 秒後變成 4 分 |
| 高 | 多人碰碰車一定平手 | `multiplayer` | 房主閃過 24 次、朋友不動，40 秒後兩人都是 40 分 |
| 高 | 序列類遊戲只用前 3 個鍵 | `rules` | 滷味、魚丸、攤位大亨按序列第 4 個鍵被判錯 |
| 高 | 方向鍵序列永遠是同一個 4 鍵循環 | `rules` | 種子 1–50 全部每 4 個重複 |
| 中 | 麻將配對可重複刷同一對 | `rules` | 同一對再配一次，12 分變 24 分 |
| 中 | 麻將永遠不能清台 | `rules` | 牌面 `[1,1,2]` 有一張配不到 |
| 中 | 兩款遊戲規則完全一樣 | `rules` | 蚵仔煎＝烤香腸、滷味＝魚丸，計分完全相同 |
| 中 | 快速連按時，畫面和伺服器分數不同 | `multiplayer` | 畫面 30 分，伺服器 8 分 |
| 低 | 房主交給斷線中的玩家 | `multiplayer` | 新房主是「斷線玩家」，在線 = false |
| 低 | CI 沒跑多人測試 | `project` | `deploy-pages.yml` 只跑 `npm test` |
| 低 | JS 檔太大 | `project` | `phaser.esm-*.js` 1646 KB（門檻 500 KB） |

## 怎麼跑

需要 Node.js 22（見 `.nvmrc`）。

```bash
git clone --recurse-submodules https://github.com/phileiny/old-ma-arcade-tests.git
cd old-ma-arcade-tests
npm ci --prefix target   # 原專案的套件
npm install              # 測試用的套件
npm test                 # 全部（多人測試含一場 40 秒對戰）
```

只跑一部分：`npm run test:rules`、`npm run test:multiplayer`、`npm run test:project`。
跑原專案自己的測試：`npm run test:original`。

多人測試會自己在 port 2577 啟動房間伺服器，跑完會關掉。

## 測試修正後的版本

把 `target/` 切到新的 commit，再跑一次：

```bash
git -C target fetch && git -C target checkout <commit>
npm test
```
