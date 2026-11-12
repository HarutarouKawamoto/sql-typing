---
tags: [review, sql-typing, visualization, advanced, transaction]
created: 2026-11-12
updated: 2026-11-12
---
# 📝 20261112-tx-timeline：トランザクションの2列タイムライン

> - **対象**：ブランチ `claude/changes`（作業前のコミット `5516668`）。ブランチ名は、ブランチを決めるダイアログで本人が選んだもの（CLAUDE.md の `feature/<作業名>` とは違う）
> - **steering**：`.steering/20261112-tx-timeline/`
> - **見るべき箇所**（最大3つ）：
>   1. `src/core/tx-simulation.js` 見え方（自分の変更だけ見える）と行の鍵（待つ・COMMIT で進む・待ったあとは最新の在庫で計算し直す）
>   2. `src/ui/state/tx-timeline-state.js` 結果の文（場面ごとに分ける）
>   3. `src/ui/components/TxTimeline.jsx` ボタンの説明とフォーカス
> - **判断してほしいこと**：1件（初期データの限定品）
> - **検証していないこと**：3件

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 追加 | `.steering/20261112-tx-timeline/requirements.md` | 要求（シミュレーション・画面・つなぐ・受け入れ条件・スコープ外） |
| 追加 | `.steering/20261112-tx-timeline/design.md` | 設計（tx-simulation の関数と状態・手順の進め方・画面・テスト） |
| 追加 | `.steering/20261112-tx-timeline/tasklist.md` | タスクと、実装検証の指摘への対応・見送り、振り返り |
| 追加 | `src/core/tx-simulation.js` | `TX_SCENARIOS`（鍵なし・鍵あり）、`startTx`・`nextStep`・`canStep`・`stepTx`（元を変えない）・`autoRun`・`txOutcome`・`READ_FIRST_ORDER`。READ COMMITTED の見え方と行の鍵（待つ・COMMIT・ROLLBACK で外れて相手が進む・待ったあとの UPDATE は最新の在庫から） |
| 追加 | `src/ui/state/tx-timeline-state.js` | `txTimelineReducer`（step・reset・scenario・readFirstOrder）、`outcomeText`（売りすぎ・鍵で守れた（待った・待たなかった）・鍵なしで順番がよかった）、`TX_SIDE_NAMES` |
| 追加 | `src/ui/components/TxTimeline.jsx` | 場面の切り替え、DB の在庫・注文・鍵、時間の順のタイムライン（A・B の2列）、「次を実行」ボタン（次の SQL・理由を説明に、押せなくなったらフォーカスを移す）、見本の順・やり直す、結果の文、読み上げの枠 |
| 追加 | `src/ui/components/TxTimeline.module.css` | 3列のグリッド（番号・A・B）、待ち・COMMIT・ROLLBACK の枠の色、状態の枠、結果の文、読み上げ用の隠し方 |
| 変更 | `src/ui/components/PlayMode34.jsx` | 問題に `visual.kind === 'transaction'` があれば、1回実行したあとはタイムラインを出したままにする |
| 変更 | `src/ui/screens/ReplayDemoScreen.jsx` | 見本「上級：トランザクション（在庫1個に2人が注文）」 |
| 追加 | `tests/unit/core/tx-simulation.test.js` | 売りすぎ・待って進む（最新の在庫・一言）・A が先なら B は ROLLBACK・COMMIT 前は見えない・鍵なしは順で変わる・鍵ありは36通りすべて在庫 0・元を変えない・最初の状態・FOR UPDATE の SQL・終わった側・知らない場面・`autoRun` |
| 追加 | `tests/unit/ui/tx-timeline-state.test.js` | reducer（step・reset・scenario・readFirstOrder）、結果の文4つ |
| 追加 | `tests/e2e/visualization/tx-timeline.spec.js` | 見本のページで、1つずつ進めて売りすぎ、FOR UPDATE で待って守れる・やり直す、キーボード・ボタンの説明・フォーカス・幅375px |
| 変更 | `docs/functional-design.md` | Problem の visual（transaction）、TxSimulation の節、TxTimeline の行、テスト戦略（単体・E2E） |
| 変更 | `docs/repository-structure.md` | `tx-simulation.js`・`tx-timeline-state.js`・`TxTimeline.jsx`・テストのファイル、上級の見える化の置き場所 |
| 変更 | `docs/architecture.md` | 上級の見える化は `visual` で出す（古い `viz` の書き方を直した）、トランザクションのシミュレーションの場所 |
| 変更 | `docs/development-guidelines.md` | 問題データの書き方に `visual: { kind: transaction }` |
| 変更 | `docs/glossary.md` | トランザクションのタイムライン、行の鍵（`lockOwner`）、売りすぎ（`oversold`） |
| 変更 | `docs/product-requirements.md` | 上級の見える化3を作ったこと |
| 追加 | `docs/review/20261112-tx-timeline.md` | このファイル |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| 見本のページ | 実行計画の木まで | トランザクションのタイムラインの見本 |
| 書く画面（上級の問題、まだない） | — | 問題に `visual: { kind: transaction }` があれば、実行したあとにタイムラインを出す |

## なぜ

- **シミュレーション**：PGlite は接続が1つで、2つのトランザクションを同時に動かせない（決定11）
- **在庫1個の1行だけ**：売りすぎの仕組み（相手の COMMIT 前の値を見て決める）を見せるのに、1行で足りる。一般の SQL を真似るのは大きすぎる
- **待ったあとの UPDATE は最新の在庫から**：PostgreSQL の READ COMMITTED の動き。そのため鍵なしでも「両方が 0 にする」ではなく -1 になる
- **学習者が順番を選ぶ**：PRD のとおり。順番によって売りすぎが起きたり起きなかったりすることを、自分で試せる。見本の順のボタンもある
- **結果の文を場面で分ける**：鍵なしで売りすぎにならなかったのは順番のおかげなので「守れた」と書かない

## 検証

| やったこと | 結果 |
|---|---|
| テストを先に書いた | シミュレーションのテストは実装の前に書いたが、続けて実装したので失敗するところは見ていない。実装検証のあとのテスト（待たない結果の文・`autoRun`）は、1つ期待が間違っていて直した |
| `npm run check` | 通った（634件） |
| `npm run test:e2e` | 通った（88件） |
| 目で確かめた（Playwright で撮った） | 鍵なしで売りすぎ（ライト）、鍵ありで待つ（ダーク）、幅375px、途中（待ったあとの一言） |
| 実装検証（implementation-validator） | [中] 4件・[低] 6件とテストの抜け。対応と見送りは `.steering/20261112-tx-timeline/tasklist.md` |
| `node scripts/check-review-files.js docs/review/20261112-tx-timeline.md 5516668` | OK |

**検証していないこと**：
- **書く画面でのタイムライン**：上級の問題がまだないので、PlayMode34 の表示は E2E で見ていない（上級の問題の作業で E2E を足す）
- **本物の PostgreSQL の2つの接続との突き合わせ**：PGlite ではできない。動きは PostgreSQL の文書の READ COMMITTED の説明に合わせた
- **読み上げソフトでの聞こえ方**

## 判断してほしいこと

- **初期データの限定品**：画面は「products の id 4 の在庫が、残り1個になった場面」と書いた。初期データ（`advanced.sql`）の id 4 は Travel Mug で在庫 3。上級の問題で学習者が `SELECT` すると 3 が見える。次の作業（上級の問題）で、在庫1個の限定品を初期データに足し、場面の行をそれに合わせるつもり

<details>
<summary>捨てた案・補足</summary>

- **学習者の書いた SQL をタイムラインに入れる**：2つの接続を真似るには SQL を解釈する必要があり、大きすぎる。場面を2つに決めた
- **待ちのあいだ時計で自動に進める**：順番を学習者が選ぶ形にしたので、時間ではなく手順で進める
- **デッドロック**：1行では起きない。2行の場面はスコープ外

</details>
