---
tags: [review, sql-typing, visualization, join, intermediate]
created: 2026-11-12
updated: 2026-11-12
---
# 📝 20261112-join-replay：中級の初期データとステップ再生の JOIN

> - **対象**：ブランチ `feature/join-replay`（作業前のコミット `c401701`）
> - **steering**：`.steering/20261112-join-replay/`
> - **見るべき箇所**（最大3つ）：
>   1. `src/core/stepper/index.js` の `pushJoinStep` と行の目印の式（`ridSql`）、`selectColumnChanges`（列を位置で見る）、`readLimit`・`sliceLimit`
>   2. `src/core/stepper/from-clause.js`（FROM 句の読み方と扱わない形）
>   3. `data/seeds/intermediate.sql`（中級の問題で使うデータ）
> - **判断してほしいこと**：1件
> - **検証していないこと**：3件

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 追加 | `.steering/20261112-join-replay/requirements.md` | 要求（中級の初期データ・FROM 句の読み取り・JOIN の段階・画面・受け入れ条件・スコープ外） |
| 追加 | `.steering/20261112-join-replay/design.md` | 設計（parseFrom・行の目印・段階・画面・テスト） |
| 追加 | `.steering/20261112-join-replay/tasklist.md` | タスクと、実装検証の指摘への対応・見送り、振り返り |
| 追加 | `data/seeds/intermediate.sql` | 中級の初期データ。`beginner.sql` の全文（products 30行）のあとに customers 10・orders 20・order_items 33（外部キーつき） |
| 追加 | `src/core/stepper/from-clause.js` | `parseFrom`：最初のテーブルと `[INNER] JOIN`・`LEFT [OUTER] JOIN` の並び（名前・別名・ref・JOIN の文字の範囲）。`left(...)`・`right(...)` は ON の続き。RIGHT・FULL・CROSS・NATURAL・USING・カンマ・サブクエリ・LATERAL・スキーマ名つき・関数・別名のない同じテーブルは unsupported（形ごとの理由） |
| 変更 | `src/core/stepper/index.js` | JOIN の段階（`pushJoinStep`：合体した行の目印を最後の `+` で分けて `diff.join.pairs`、INNER で消える左の行）。行の目印の式 `ridSql`（つないだテーブルの ctid を + でつなぐ）で WHERE 以降・集計を作る。FROM の段階は最初のテーブルだけ。`isSingleTable` をやめた。`StepDiff` に `join`・`removedColumnIndexes`、`label` に JOIN。`selectColumnChanges` を列の位置で見る形に（テーブルの指定・`o.*`）。並べたあとの LIMIT は ORDER BY の段階の並びを切る（`readLimit`・`sliceLimit`。集計も） |
| 変更 | `src/core/stepper/select-list.js` | 項目に `sourceTable`（`o.id` の `o`） |
| 追加 | `src/ui/state/join-colors.js` | `joinColors`：多対1は右の行ごと、それ以外は左の行ごとの色。多対多で色が決められない右の行は `multi`。合体した行の色 |
| 変更 | `src/ui/components/StepTable.jsx` | 表を描く部分を `RowsTable` に分けた。JOIN の印の場面は左と右の表を並べ、色（`data-pair`）と印（`join-removing`・`join-null`・`join-unmatched`・`join-multi`）。変化の場面は合体した表を同じ色で。消える列は位置で印を付ける。表の見出しを読み上げの表の名前に |
| 変更 | `src/ui/components/StepTable.module.css` | 2つの表を並べる枠（狭いと縦）、見出し、NULL になる行の点線、つながらない右の行（薄く斜体）、多対多の斜線 |
| 変更 | `src/ui/components/StepPlayer.jsx` | JOIN の一言（INNER・LEFT） |
| 変更 | `src/ui/state/step-replay-timing.js` | JOIN の長さ（2.0 → 0.9秒）と、JOIN の段階は印の場面を作る |
| 変更 | `src/ui/screens/ReplayDemoScreen.jsx` | 開いたら中級の初期データで DB を準備する。JOIN・LEFT JOIN・JOIN と GROUP BY の見本 |
| 変更 | `tests/integration/data-validation/problems.test.js` | 中級の初期データの決まり10件（products が初級と同じ・全文を含む・行数・注文のない顧客・取り消し・3か月・注文されていない商品と値引き・文字・1対多と多対多の形・名前と地域と status・顧客ごとの合計が重ならない） |
| 追加 | `tests/unit/core/from-clause.test.js` | 19件 |
| 追加 | `tests/unit/ui/join-colors.test.js` | 4件（多対1・1対多・多対多・6色のくり返し） |
| 追加 | `tests/integration/stepper/join-steps.test.js` | 16件（INNER・LEFT・消える左の行・3つの JOIN と集計・自己結合・LEFT JOIN と count・LIMIT・同じ名前の列・`o.*`・1つのテーブルの位置・同じ値のある LIMIT 3つ・作れない形） |
| 変更 | `tests/integration/stepper/beginner-steps.test.js` | 作れない形から JOIN を外した（判断してほしいこと） |
| 変更 | `tests/unit/ui/step-replay-timing.test.js` | JOIN の印の場面と長さ |
| 変更 | `tests/e2e/visualization/step-replay-marks.spec.js` | JOIN（2つの表・色・つながらない右の行）と LEFT JOIN（NULL の印・22行） |
| 変更 | `docs/functional-design.md` | お店のDB（中級のテーブルと初期データの決まり）、Step の形（label・rid・join・removedColumnIndexes）、JOIN の段階の表と決まり、ステップ再生の動き（JOIN）、印の data 属性、見本のページ、テスト戦略 |
| 変更 | `docs/architecture.md` | ステップ再生の拡張（JOIN も済み）、pgsql-ast-parser を使わなかったこと |
| 変更 | `docs/repository-structure.md` | `from-clause.js`・`join-colors.js`・テスト、ステップ再生の新しい句の足し方 |
| 変更 | `docs/glossary.md` | 段階の label と StepDiff に JOIN |
| 変更 | `docs/product-requirements.md` | 機能8 A に JOIN・LEFT JOIN の行 |
| 追加 | `docs/review/20261112-join-replay.md` | このファイル |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| JOIN のSQLのステップ再生 | 「この形のステップ再生はまだありません」 | FROM（最初のテーブル）→ JOIN（2つの表が並び、つながる行が同じ色）→ 合体した表 → 今までの段階 |
| 見本のページ | 初級の初期データ | 中級の初期データ（products は同じ）。JOIN の見本3つ |
| SELECT の消える列の印 | 列の名前で付けていた | 列の位置で付ける（JOIN のあとの同じ名前の列も見分ける） |
| 並べたあとの LIMIT | 同じSQLを LIMIT つきで実行して行を決めていた | ORDER BY の段階の並びを切る（同じ並びの値の行があっても段階がずれない） |

## なぜ

- **行の目印を ctid の + つなぎに**：段階ごとに本物のSQLを流す作り（初級から）をそのまま使える。LEFT JOIN の相手のない行は `-` で区別できる。最後の `+` で分ければ、前の段階（左）の目印に戻れる
- **JOIN の印の場面で2つの表を並べる**：PRD の「2つの表の行が線でつながって1行に合体する」を、線の代わりに同じ色で見せる。線を描くより表の読みやすさを保てる
- **多対1は右の行ごとの色**：注文 → 顧客のように多くの左の行が同じ右の行につながるとき、右の行ごとに色を付けると「同じ顧客の注文」が見える
- **列を位置で見る**：合体した表には `id` が2つある。名前で見ると、消える customers.id に印が付かない（実装検証の必須）
- **LIMIT は前の段階の並びを切る**：1対多の JOIN の後ろは並びの鍵に同じ値が出やすい。段階ごとに別のSQLを流すと、同じ値の行の並びがずれて「続いていない」で止まっていた
- **products は beginner.sql をそのまま含める**：初級の問題の形（30行・値段が全部違うなど）を中級でも使える。同じであることをテストで確かめる

## 検証

| やったこと | 結果 |
|---|---|
| テストを先に書いた | 初期データの決まり（データは一度で通った）、`parseFrom`、JOIN の段階、実装検証のあとの列の位置・LIMIT・色分けも失敗を見てから実装した |
| `npm run check` | 通った（566件。`src/core/` の行カバレッジ 98.63%） |
| `npm run test:e2e` | 通った（78件） |
| 目で確かめた（Playwright で撮った） | JOIN・LEFT JOIN の印の場面（ダーク）、JOIN のあとの SELECT の印（ライト、customers.id にだけ打ち消し線） |
| 実装検証（implementation-validator） | [必須] 1件・[推奨] 6件・[提案] 6件。検証役が PGlite で約50本のSQLを流した。直したものと見送りは `.steering/20261112-join-replay/tasklist.md` |
| `node scripts/check-review-files.js docs/review/20261112-join-replay.md c401701` | OK |

**検証していないこと**：
- **50行を超える JOIN**：表は50行までしか描かないので、印の付いた行が隠れることがある（中級の初期データでは起きない）
- **色が6色でくり返すこと**：顧客10人のうち4組は、ほかの組と同じ色になる。色だけで見分けられない
- **幅の狭い画面での JOIN の2つの表**：縦に並ぶことはコードで確かめたが、画面では見ていない（遊ぶ画面は幅768px以上）

## 判断してほしいこと

- **`beginner-steps.test.js` から「JOIN は unsupported」の行を外した**：JOIN は今は作れる形。作れない形（RIGHT JOIN・USING・カンマ）のテストは `join-steps.test.js` と `from-clause.test.js` にある

<details>
<summary>捨てた案・補足</summary>

- **つながる行を線で結ぶ**：表の行の位置が変わる・スクロールする中で線を描き直すのが難しい。同じ色にした
- **pgsql-ast-parser で FROM を読む**：JOIN の並び・ON の範囲だけなら字句で足りた
- **build() を段階ごとに分ける**：実装検証で長さを指摘された。ふるまいを変えない分割だけの作業として、上級の句を足す前にやる

</details>
