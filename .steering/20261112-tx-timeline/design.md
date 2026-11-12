# 設計書

## `src/core/tx-simulation.js`（React・DB を使わない純粋な関数）

```js
export const TX_SCENARIOS; // { unsafe, locked }：{ id, title, initialStock, sides: { A, B } }
/** @returns {TxState} */
export function startTx(scenarioId) {}
export function canStep(state, side) {} // 'A' | 'B'
export function nextStep(state, side) {} // 次に実行する手順（SQL 付き）。終わっていれば null
export function stepTx(state, side) {} // 1つ進めた新しい状態（元の状態は変えない）
export function autoRun(state, order) {} // order の順に進める。進めない側の番はもう片方
export function txOutcome(state) {} // null | { kind: 'oversold' | 'safe', stock, orders }
export const READ_FIRST_ORDER; // 両方が先に読む順
```

- 手順の種類：`begin`・`read`（`lock: true` なら FOR UPDATE）・`update`・`insert`・`commit`・`rollback`
- 各側の状態：`{ pc, seen, ownStock（自分の変更を入れた在庫。null なら変更なし）, ownOrders, waiting（待っている手順）, ended: null | 'commit' | 'rollback' }`
- 全体：`{ scenarioId, stock（確定）, orders（確定）, lockOwner, sides, events }`
- 手順の進め方
  - `read`：鍵なしなら、自分の変更があればそれ、なければ確定した在庫を見る。鍵ありなら鍵を取る（相手が持っていれば待つ）
  - 読んだ在庫が1未満なら、次の手順を `rollback` にする
  - `update`：鍵を取る（持っていなければ）。相手が持っていれば待つ。進んだら「確定した最新の在庫 − 1」を自分の変更にする（PostgreSQL は待ったあと、最新の行で計算し直す）
  - `commit`：自分の変更を確定し、鍵を外す。相手が待っていれば、その手順をすぐ進める
  - `rollback`：変更を捨て、鍵を外す。相手が待っていれば進める
- events：`{ side, sql, kind: 'run' | 'wait' | 'resume', note }`。時間の順に積む

## 画面 `src/ui/components/TxTimeline.jsx`

- useReducer：`{ type: 'step', side }`・`{ type: 'reset' }`・`{ type: 'scenario', id }`・`{ type: 'auto' }`
- 上：場面の切り替え（2つのボタン、aria-pressed）、状態（確定した在庫・注文・鍵）
- 真ん中：タイムライン（3列のグリッド：番号・A・B）。待ちは黄色の枠、COMMIT は緑、ROLLBACK は灰色
- 下：各列の「次を実行」ボタン、「両方が先に読む順で進める」「やり直す」、結果の文
- `role="status"`：最後の event の一言

## テスト
- 単体：`tests/unit/core/tx-simulation.test.js`（受け入れ条件と、元の状態を変えない、終わった側は進めない、全部の順）
- E2E：`tests/e2e/visualization/tx-timeline.spec.js`
