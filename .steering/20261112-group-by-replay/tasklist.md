# タスクリスト

## 🚨 タスク完全完了の原則

- 全タスクが `[x]` になるまで作業を続ける
- スキップは技術的な理由があるときだけ。理由を書く

## フェーズ1：コア
- [x] `group-by.test.js` を先に書き、`splitGroupBy`（4件）
- [x] `group-by-steps.test.js`（統合）を先に書き、Stepper に GROUP BY・HAVING・集計の段階（集計の段階は `pushGroupedSteps` に分け、LIMIT の連続の確かめと最後の一致の確かめを関数にして共有。テストの「GROUP BY category で並び替わる」は、初期データが category の順なので間違い → 並び替わらないことを確かめ、supplier で並び替わるテストを足した）
- [x] `beginner-steps.test.js` の作れない形を直す（GROUP BY・集計関数・string_agg を外した）

## フェーズ2：画面
- [x] StepTable のグループの色、timing、一言、見本（HAVING で消える行はグループの色より赤を先に。集計でまとまる色は、前の段階のグループの色のまま。timing のテストが「知らない段階」の例に GROUP BY を使っていたので UNKNOWN に）

## フェーズ3：E2E と確かめ
- [x] E2E（見本のページの GROUP BY）（GROUP BY・HAVING の2件）
- [x] 目で確かめる（GROUP BY で寄る・HAVING で消える・集計でまとまる）（Playwright で印の場面を撮った。集計の SELECT で色がグループの色と変わっていたのをここで見つけて直した）
- [x] `npm run check`（503件）と `npm run test:e2e`（76件）（実装検証のあと 517件・76件）

## フェーズ4：検証と記録
- [x] 実装検証（implementation-validator）と指摘への対応（[必須] 2件・[推奨] 6件・[提案] 4件。検証役が PGlite で約55本のSQLを流して確かめた。別名・式・NULL・count(DISTINCT)・FILTER・HAVING のサブクエリ・複数列などは本物どおりだった）
  - 必須1 SELECT の中のサブクエリの集計（`price - (SELECT avg(price) ...)`）を「集計する」と取り違え、まとまらない30行を「29行まとまる」と見せていた → 集計関数かを `aggregates.js` で、サブクエリの括弧の中を数えずに決める。テストを先に書いた
  - 必須2 `GROUP BY (1)` が列の番号の見分けをすり抜け、全部が1グループになっていた → 列の番号（括弧つきも）を SELECT の項目の式に置き換える（`resolveGroupItems`）。あわせて「グループごとに1行」の最後の守りを足した
  - 推奨1 鍵の文字と本物のグループ分けがずれる（`1.0` と `1.00`）→ 最後の守りで mismatch。最初の守りは「行数 ≤ グループの数」で、この例を止められなかったので、LIMIT の前は「行数＝グループの数」にした
  - 推奨2 まとまる行がない集計で一言が「使う列だけが残る」になる → `diff.aggregated`
  - 推奨3 SELECT の別名・列の番号での GROUP BY が unsupported（中級でよく書く）→ どちらも式に置き換えて扱う（入力の列名と同じ名前は列を優先）
  - 推奨4 HAVING の赤を濃くした指定が WHERE・LIMIT の赤まで変えていた → `.removing` をグループの色の後ろに移し、濃さを元にもどした
  - 推奨5 `pushGroupedSteps` が長い・名前が紛らわしい → 段階ごとの関数（`readGroups`・`pushGroupStep`・`pushHavingStep`・`pushAggregateSteps`・`assertOneRowPerGroup`）に分け、SQLの式は `groupKeySql`、値は `rowKey` に
  - 推奨6 テストの足りないところ → 列の番号・括弧つき・別名・テーブルの別名・count(DISTINCT)・括弧とカンマの項目・ORDER BY の並び替え・LIMIT・まとまる行のない集計・サブクエリ・1.0 と 1.00 を足した。HAVING の E2E は、題が HAVING になるまで押す形に
  - 提案 1行だけのグループの色が集計の印の場面で消える → 前の段階の色を残す。一言を並び替わったかで分けた
  - 見送り：提案「30グループのように色がくり返す・色だけで区別する」（グループの番号の表示などは、中級の問題でグループの多い形が出たら考える）
- [x] 永続ドキュメントを直す（functional-design・repository-structure・glossary）（実装検証のあと architecture・product-requirements も）
- [x] `docs/review/20261112-group-by-replay.md` を書き、`check-review-files.js` が通る
- [x] 振り返りを書く
- [x] コミットして main にマージ（本人の「上級まで作って」で決めた進め方）

## 振り返り

- **実装完了日**：2026-11-12
- **計画と違ったこと**：GROUP BY の段階を「グループの鍵の文字」で作る方法は簡単だったが、最後の一致の確かめだけでは、途中の段階のうそ（サブクエリの集計・括弧つきの列の番号・`1.0` と `1.00`）を止められなかった。途中の段階にも「グループごとに1行」という確かめを入れた
- **計画と違ったこと**：最初は SELECT の別名・列の番号での GROUP BY を扱わない予定だったが、中級でよく書く形なので、SELECT の項目の式に置き換えて扱う形にした
- **学び**：見える化は「最後が合っていれば正しい」ではない。途中の段階ごとに、本物と同じであることを確かめる守りが要る
- **次に活かすこと**：JOIN の段階でも、行の目印（左右の ctid）がずれたときに途中の段階で止める守りを、最初から設計に入れる
