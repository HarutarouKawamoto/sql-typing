# タスクリスト

## 🚨 タスク完全完了の原則

- 全タスクが `[x]` になるまで作業を続ける
- スキップは技術的な理由があるときだけ。理由を書く

## フェーズ1：データとコア
- [x] 中級の初期データの決まりのテストを先に書き、`intermediate.sql`（beginner.sql をそのまま含め、後ろに3つのテーブル。決まりのテストは6件。一度で通った）
- [x] `from-clause.test.js` を先に書き、`parseFrom`（15件）
- [x] `join-steps.test.js` を先に書き、Stepper に JOIN の段階（行の目印の式 `ridSql` を、つないだテーブルの ctid を + でつなぐ形にし、今までの段階の `ctid::text` を置き換えた。初級のテストの「JOIN は unsupported」を外した）

## フェーズ2：画面
- [x] StepTable の JOIN の印、timing、一言、見本のページ（中級の初期データ）（表を描く部分を `RowsTable` に分け、JOIN の印の場面は2つ並べる。多対1なら右の行ごと、そうでなければ左の行ごとの色）

## フェーズ3：E2E と確かめ
- [x] E2E（見本の JOIN）（JOIN・LEFT JOIN の2件）
- [x] 目で確かめる（JOIN・LEFT JOIN の印の場面を撮った。右の表の見出しが別名の c だけだったので「customers c」に）
- [x] `npm run check`（548件）と `npm run test:e2e`（78件）（実装検証のあと 566件・78件）

## フェーズ4：検証と記録
- [x] 実装検証（implementation-validator）と指摘への対応（[必須] 1件・[推奨] 6件・[提案] 6件。検証役が PGlite で約50本のSQLを流し、目印のつなぎ方は全部の形で正しかった。途中で使用量の上限で止まり、再開した）
  - 必須1 JOIN のあと同じ名前の列（orders.id と customers.id）があると、SELECT で消える customers.id に印が付かない → 消える列を位置（`removedColumnIndexes`）で持つ。`o.id` のテーブルの指定・`o.*` を見分ける（`select-list.js` に `sourceTable`）。テストを先に書いた
  - 推奨1 1対多の JOIN と並びの鍵に同じ値のある LIMIT で mismatch になる → 並べたあとの LIMIT は ORDER BY の段階の並びをそのまま切る（`readLimit`・`sliceLimit`。集計の LIMIT も）。テストを先に書いた
  - 推奨2 多対多で右の行の色がそろわない → 2つ以上の色の左の行につながる右の行は色を付けず斜線（`join-multi`）
  - 推奨3 色分けの無駄な計算 → `src/ui/state/join-colors.js` に出し、つながる右の行の集合を1回だけ作る。単体テスト4件
  - 推奨4 unsupported の理由の文がおかしい（`.`・`(`・`left(...)` を JOIN と読む）→ スキーマ名つき・関数の FROM は専用の文、RIGHT などだけ「〜 JOIN」、ほかは「この形の FROM」。`left(...)`・`right(...)` は ON の続き。引用符の名前の `""` も直した
  - 推奨5 中級の初期データの決まりが足りない → 1対多・多対多の形、名前が重ならない、地域4つ、paid・shipped、顧客ごとの合計が重ならない、beginner.sql の全文を含む、を足した（データは直さずに通った）
  - 推奨6 E2E の色の確かめが弱い → 色分けを単体テストで確かめる形にした（E2E は件数のまま）
  - 提案 表の見出しを読み上げで表の名前に（`aria-label`）、つながらない右の行は斜体、NULL になる行の点線を文字の色に、1対多の一言に「行が増える」
  - 見送り：提案「`build()` を分ける」（上級の句を足す前に、ふるまいを変えない分割だけの作業でやる。repository-structure に書いた）、「色の隣に相手の id を出す」
- [x] 永続ドキュメントを直す（functional-design・repository-structure・architecture・glossary・product-requirements）
- [x] `docs/review/20261112-join-replay.md` を書き、`check-review-files.js` が通る
- [x] 振り返りを書く
- [x] コミットして main にマージ（本人の「上級まで作って」で決めた進め方）

## 振り返り

- **実装完了日**：2026-11-12
- **計画と違ったこと**：行の目印を「つないだテーブルの ctid を + でつなぐ」だけで、今までの段階（WHERE・集計・ORDER BY・LIMIT）はほぼそのまま使えた。一方で、列を名前で見ていたところ（SELECT の消える列）は、JOIN の同じ名前の列で崩れた。列は位置で見る形にした
- **計画と違ったこと**：段階ごとに別のSQLを流す作りは、並びの鍵に同じ値があると段階どうしで並びがずれる。1つのテーブルではほとんど起きなかったが、1対多の JOIN では普通に起きる。LIMIT は前の段階の並びを切る形にした
- **学び**：中級のデータは「1対多・多対多・相手なし・同じ値」が自然に出る。初級のデータで作った決まり（並びは1つに決まる、列の名前は重ならない）が成り立たなくなる前提で、作り方を見直す
- **次に活かすこと**：中級の問題を書くとき、ORDER BY の並びが1つに決まるか（`checkOrderDetermined`）と、ステップ再生が作れるか（`checkStepsBuild`）を、問題データの検証で確かめる。上級の句を足す前に `build()` を分ける
