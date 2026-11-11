# タスクリスト

## 🚨 タスク完全完了の原則

- 全タスクが `[x]` になるまで作業を続ける
- スキップは技術的な理由があるときだけ。理由を書く

## フェーズ1：コア（テストを先に）
- [x] `select-list.js` のテスト → 実装
- [x] `stepper/index.js` の統合テスト（初級9問の形・各段階の差・unsupported・エラー）→ 実装（テストを先に書き、モジュールがなくて失敗することを確かめた。31件が一度で通った）
- [ ] `src/core/` の行カバレッジ 90% 以上

## フェーズ2：学習記録
- [x] `markStepReplayFinished` のテスト → 実装、`useProgress` に足す（テストと実装を同じ手順で書いたので、先に失敗することは確かめていない）

## フェーズ3：画面
- [x] `step-replay-timing.js` のテスト → 実装
- [x] `use-step-replay.js`・`StepTable`・`StepPlayer`
- [x] モード1の結果に「ステップ再生を見る」
- [x] 開発サーバーで目で確かめる（1問目：実行順の番号 ②SELECT ①FROM、今の句が光る、自動再生が最後で止まる、← で戻る、stepReplayFinished が保存される。WHERE の赤い印などは1問目にないので目では見ていない）

## フェーズ4：確かめる
- [x] E2E `tests/e2e/visualization/step-replay.spec.js`（3件。最初はテストが入力エリアを待たずに打っていて失敗したので、待つように直した）
- [x] `npm run check`・`npm run test:e2e`（262件・src/core 行 98.8%）

## フェーズ5：検証と記録
- [x] 実装検証（implementation-validator）と指摘への対応
  - [x] [必須] 1：ボタンにフォーカスして Enter を押すと「もう一度」になる → `isInteractiveTarget` でボタンに任せる（Space も）。E2E を足した
  - [x] [必須] 2：LIMIT の外の OFFSET・FETCH・FOR などが別の段階に混ざる → 括弧の外にあれば unsupported
  - [x] [必須] 3：同じ値が続くと LIMIT で消える行を取り違える → 元の ORDER BY と LIMIT を行の目印つきで実行し、並べた表の中で続いているかも確かめる
  - [x] [推奨] 1：SELECT ... INTO を実行してしまう → `canRunWhileTyping` で先に unsupported
  - [x] [推奨] 2：段階のSQLだけの失敗は unsupported（学習者が書いていないSQLのエラーを見せない）。DISTINCT ON・SELECT ALL・string_agg などを先に見分ける
  - [x] [推奨] 3：消えた列・名前の変わった列を「実在する元の列」から決める（大文字、TRUE、別の列に元の名前、同じ列を2回）
  - [x] [推奨] 4：行の目印を末尾に（ORDER BY 2 がずれない）
  - [x] [推奨] 5：SQLが変わったら StepPlayer を作り直す（key）、index を範囲の中に丸める
  - [x] [推奨] 6・[提案] 1・2：進み方を `step-replay-machine.js`（reducer）に分けて単体テスト。続けて押しても1つずつ進む、最後で止まるのも reducer で決める（タイマーで止めない）
  - [x] [推奨] 7：統合テストに危ない形・作れない形を足した
  - [x] [提案] 3：コアから data の型を import しない（Stepper の中で使う形を決めた）
  - [x] ~~[推奨] 6 の一部：WHERE・DISTINCT・LIMIT を含む問題の E2E、[提案] 4：長い文字列のセルを切る、[提案] 5：同じ値が並ぶ ORDER BY と LIMIT を扱えるようにする~~（理由：WHERE などを含む問題は初級2〜9問目の作業で入るので、そのときに E2E を足す。セルの切り方は全体の見た目の作業で決める。同じ値が並ぶ並び替えは、今は mismatch で安全に止まる。並びが1つに決まる初期データにしてある）
- [x] 永続ドキュメントを直す（functional-design・architecture・glossary・repository-structure）
- [x] `docs/review/20261111-step-replay.md` を書き、`check-review-files.js` が通る（27ファイル）
- [x] 振り返りを書く

## 実装後の振り返り

**実装完了日**：2026-11-11

**計画と実績の差分**：
- 計画になかったもの：`step-replay-machine.js`（進み方の reducer）、`isInteractiveTarget`、対応しない形を先に止める走査、コアの中の Runner の型
- 計画から変えたもの：LIMIT の段階の作り方（値の並びで探す → 元の ORDER BY と LIMIT を行の目印つきで実行）、行の目印を末尾に、段階のSQLだけの失敗は unsupported
- やらなかったもの：WHERE などを含む問題の E2E（初級2〜9問目の作業で）

**学んだこと**：
- 「最後の結果が一致するか」の照合だけでは、途中の段階のうそを止められない。照合をすり抜ける経路（句に混ざる語、同じ値の行の取り違え）は、先に形で止めるか、行の目印で確かめる
- 画面全体のキー（Enter＝もう一度）は、ボタンのキー操作とぶつかる。フォーカスがある部品を先に見る
- 進み方の決まりを reducer にすると、タイマーで状態を直す回避策（`setTimeout(0)`）がいらなくなった

**本人の指摘のあとの変更**：印の見た目を一度も画面で見ていない点を本人も気にしていたので、見本のページ（`/?demo`）と `data-mark`、印の数を数える E2E（5件）を足した。見本で見ると DISTINCT の黄色が見分けにくかったので、組ごとの色・残る行は太字・消える行は薄い打ち消し線に直した

**次回への改善提案**：
- 初級2〜9問目を入れたら、WHERE・DISTINCT・LIMIT を含む問題でステップ再生の E2E を足し、印の見た目を本人に見てもらう
- 次の作業は「判定（Judge）」。そのときに `answer-checks.js` に「間違いの選択肢が不正解になる」「順番が1つに決まる」を足す
