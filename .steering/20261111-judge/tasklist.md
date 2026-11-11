# タスクリスト

## 🚨 タスク完全完了の原則

- 全タスクが `[x]` になるまで作業を続ける
- スキップは技術的な理由があるときだけ。理由を書く

## フェーズ1：エラーの和訳
- [x] `error-translator` のテスト → `error-messages.js`・`error-translator.js`

## フェーズ2：判定
- [x] 純粋な関数（normalizeCell・compareTables・findRuleViolation）のテスト → 実装
- [x] judge・computeExpected の統合テスト → 実装（3つともテストを先に書き、モジュールがなくて失敗することを確かめた。最初の2件の失敗はテストの思い込み：ちょうど1000円の商品がないので price > 1000 は正解になる。これを別解のテストにした）

## フェーズ3：問題データの検証
- [x] `checkWrongChoices`・`checkOrderDetermined` と、壊れた問題で見つけるテスト
- [x] `problems.test.js` に足す

## フェーズ4：確かめる
- [x] `npm run check`（327件、src/core 行 98.2%。画面は変えていないので E2E は対象外）

## フェーズ5：検証と記録
- [x] 実装検証（implementation-validator）と指摘への対応（[必須] 2件・[推奨] 6件・[提案] 7件）
  - M1 docs・レビュー記録がない → このフェーズで書いた
  - M2 NaN・±Infinity が NULL と同じになり、間違いが正解になる → 文字列の目印に変え、比べ方も `cellsEqual` に
  - R1 INSERT の VALUES の順番を変えた正解が SERIAL の id で落ちる → `ignoreColumns` を足した。DROP TABLE は `wrong / tableMissing` に
  - R2 `checkWrongChoices` が「結果は同じで ruleViolation」を見逃す → それも指摘する
  - R3 `checkOrderDetermined` が GROUP BY・JOIN で必ず落ちる、ORDER BY がないとの誤ったメッセージ → 行全体で並べるサブクエリの形にし、メッセージを分けた
  - R4 丸めで境目をまたぐ → 許容誤差で比べる（12桁・10桁に丸める案も試したが、境目の問題が残った）
  - R5 42P01・42803・22P02 の原因が合わない、22007・22008・2201W がない → 原文の形で出し分け、3つを足した
  - R6 `findRuleViolation` の誤検知と見逃し → 記号を残したトークンで探す、直前が `.` の語は数えない、関数名は `(` が続くときだけ、`missing !== undefined`
  - P1 列の並び順だけ違う → `columnOrder` を足した
  - P6 空のSQL → `wrong / empty`「SQLが空です」
  - 見送り（docs に既知の制限として書いた）：P2 大きな桁の NUMERIC、P3 同時に呼んだとき、P4 最後の reset の失敗、P5 回文の並び、P7 列名は小文字で比べる。サブクエリの中の語と NOT BETWEEN も制限として書いた
- [x] 永続ドキュメントを直す（functional-design・repository-structure・development-guidelines・glossary）
- [x] `docs/review/20261111-judge.md` を書き、`check-review-files.js` が通る
- [x] 振り返りを書く

## 振り返り

- **計画と違ったこと**：計画では値を丸めてから `Map` で数える作りだったが、丸めは目盛りの境目で同じ値を分ける。許容誤差で比べ、数値以外の列で組に分けてから1行ずつ探す形に変えた
- **計画と違ったこと**：書き換え系の `ignoreColumns`・`tableMissing`、`columnOrder`・`empty` は計画になく、実装検証の指摘で足した
- **学び**：判定の穴は「間違いが正解になる」向きが一番まずい。NaN が `JSON.stringify` で null になるのは、テストの値を NULL・NaN・Infinity の組で網羅して初めて見つかる
- **学び**：問題データの検証（`checkWrongChoices`）は、判定そのものを使うので、判定の結果の種類が増えたら検証も見直す（ruleViolation の見逃し）
- **次に活かすこと**：中級（GROUP BY・JOIN）を作る前に、`checkOrderDetermined` の回文の見逃しと、サブクエリの中の語を数える制限を見直す
