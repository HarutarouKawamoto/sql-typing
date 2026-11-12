---
tags: [review, sql-typing, visualization, group-by]
created: 2026-11-12
updated: 2026-11-12
---
# 📝 20261112-group-by-replay：ステップ再生の GROUP BY・HAVING・集計

> - **対象**：ブランチ `feature/group-by-replay`（作業前のコミット `c6281cc`）
> - **steering**：`.steering/20261112-group-by-replay/`
> - **見るべき箇所**（最大3つ）：
>   1. `src/core/stepper/index.js` の `pushGroupedSteps` 以下（グループの鍵で行をつなぐ・最後の守り `assertOneRowPerGroup`）
>   2. `src/core/stepper/group-by.js` の `resolveGroupItems`（列の番号・SELECT の別名を式に置き換える）
>   3. `src/core/stepper/aggregates.js`（サブクエリの中の集計を数えない）
> - **判断してほしいこと**：なし（本人の「上級まで作って」で、完了条件を満たしたらコミットしてマージする）
> - **検証していないこと**：3件

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 追加 | `.steering/20261112-group-by-replay/requirements.md` | 要求（GROUP BY 句の項目・段階・画面・受け入れ条件・スコープ外） |
| 追加 | `.steering/20261112-group-by-replay/design.md` | 設計（段階のSQL・Step の形・画面・テスト）。実装検証のあとの変更を追記 |
| 追加 | `.steering/20261112-group-by-replay/tasklist.md` | タスクと、実装検証の指摘への対応、振り返り |
| 追加 | `src/core/stepper/group-by.js` | `splitGroupBy`（GROUP BY 句を括弧・文字列の外のカンマで分ける。ROLLUP・CUBE・GROUPING は扱わない）、`resolveGroupItems`（列の番号・括弧つきの列の番号・SELECT の別名を SELECT の項目の式に置き換える。入力の列名を優先。集計の項目を指す番号は扱わない） |
| 追加 | `src/core/stepper/aggregates.js` | `hasAggregate`（サブクエリの括弧の外の集計関数）・`hasWindow`（OVER）。`index.js` から移した |
| 変更 | `src/core/stepper/index.js` | 集計の段階（`pushGroupedSteps` → `readGroups`・`pushGroupStep`・`pushHavingStep`・`pushAggregateSteps`・`assertOneRowPerGroup`）。GROUP BY・HAVING・集計関数の unsupported をやめ、DISTINCT と集計・ウィンドウ関数は unsupported のまま。`StepDiff` に `groups`・`aggregated`、`label` に GROUP BY・HAVING。LIMIT の連続の確かめ（`assertContiguous`）と最後の一致の確かめ（`checkLast`）を関数にして共有 |
| 変更 | `src/ui/components/StepTable.jsx` | GROUP BY・HAVING の段階は行をグループの色で塗り `data-group` を付ける。集計でまとまる色は前の段階のグループの色のまま。集計の印の場面で1行だけのグループの色も残す |
| 変更 | `src/ui/components/StepTable.module.css` | グループの色の説明。消える行（`.removing`）をグループの色の後ろに移し、HAVING で赤が先に見えるように（濃さは今まで通り） |
| 変更 | `src/ui/components/StepPlayer.jsx` | 段階の一言（GROUP BY・HAVING）。集計した SELECT は「1つのグループが1行にまとまり、集計した値が出る」、並び替わらない GROUP BY は「同じグループの行が同じ色になる（もう寄って並んでいる）」（`explanationOf`） |
| 変更 | `src/ui/state/step-replay-timing.js` | GROUP BY・HAVING の長さ（1.8 → 0.8秒）。グループの色が付く段階も印の場面を作る |
| 変更 | `src/ui/screens/ReplayDemoScreen.jsx` | 見本に GROUP BY・HAVING・集計関数だけの3つを足した |
| 追加 | `tests/unit/core/group-by.test.js` | 9件：項目の分け方（関数・文字列のカンマ・括弧・コメント）、ROLLUP など、空、列の番号・別名の置き換え、入力の列名の優先、範囲の外・集計の項目の番号 |
| 変更 | `tests/unit/ui/step-replay-timing.test.js` | グループの色の印の場面、GROUP BY・HAVING の長さ。「知らない段階」の例を GROUP BY から UNKNOWN に |
| 追加 | `tests/integration/stepper/group-by-steps.test.js` | 22件：GROUP BY で寄る・SELECT で4行、並び替わる GROUP BY、全部の句、GROUP BY のない集計（0行・HAVING も）、式・NULL、よく書く形6つ、ORDER BY・LIMIT、まとまる行のない集計、サブクエリの集計、1.0 と 1.00、作れない形 |
| 変更 | `tests/integration/stepper/beginner-steps.test.js` | 作れない形から GROUP BY・集計関数・string_agg を外した |
| 変更 | `tests/e2e/visualization/step-replay-marks.spec.js` | GROUP BY（30行に色・5グループ・SELECT でまとまる）と HAVING（消える行がグループごと） |
| 変更 | `docs/functional-design.md` | Step の形（label・rid・groups・aggregated）、集計の段階の表と決まり、扱う形・扱わない形、ステップ再生の動き（GROUP BY・HAVING・集計の SELECT）、StepPlayer・ReplayDemoScreen、テスト戦略 |
| 変更 | `docs/architecture.md` | 段階のSQLの本数（最大7本）、ステップ再生の拡張（集計は済み、JOIN が残る） |
| 変更 | `docs/repository-structure.md` | `group-by.js`・`aggregates.js`・テストのファイル、JOIN の段階を足すときの置き場所 |
| 変更 | `docs/glossary.md` | 段階（label と StepDiff）、印の場面（グループの色）、グループの鍵、見本のページ |
| 変更 | `docs/product-requirements.md` | 機能8 A に中級の GROUP BY・HAVING・集計の行（1つのテーブルの形で作った） |
| 追加 | `docs/review/20261112-group-by-replay.md` | このファイル |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| GROUP BY・HAVING・集計関数のSQLのステップ再生 | 「この形のステップ再生はまだありません」 | FROM → WHERE → GROUP BY（グループの色で寄る）→ HAVING（グループごと消える）→ SELECT（1グループ1行）→ ORDER BY → LIMIT |
| `GROUP BY 1`・SELECT の別名での GROUP BY | （集計がそもそも作れなかった） | SELECT の項目の式に置き換えて作れる |
| 見本のページ | 初級の形5つ | 集計の見本3つを足した |

## なぜ

- **グループの鍵 `ROW(GROUP BY の項目)::text`**：JS で値を比べるより、PostgreSQL に「この行はどのグループか」を答えさせる方が、式・NULL・型の違いで本物とずれにくい
- **最後の守り（グループごとに1行）**：鍵の文字が同じでも本物は別のグループ（その逆も）になることがある（`1.0` と `1.00`）。最後の表の一致だけでは、途中の GROUP BY の段階の色分けのうそを止められない（実装検証）
- **集計の SELECT の行の目印をグループの最初の行にする**：DISTINCT と同じ「まとまる」の印（残る行は太字、まとまる行は薄く打ち消し線）をそのまま使える
- **サブクエリの中の集計を数えない**：外の行をまとめないので、集計するSQLとして扱うと「まとまらない行がまとまる」うそになる
- **列の番号・別名を式に置き換える**：段階のSQLの中では `GROUP BY 1` は「1という値」、別名は「ない列」になる。中級の月次の集計などでよく書く形なので、扱えるようにした
- **初級の products で作った**：集計は1つのテーブルで作って確かめられる。中級のテーブル（customers・orders）は、2つ以上のテーブルを扱う JOIN の作業で足す

## 検証

| やったこと | 結果 |
|---|---|
| テストを先に書いた | `splitGroupBy`・集計の段階、実装検証のあとの `resolveGroupItems`・サブクエリ・最後の守りも、失敗を見てから実装した |
| `npm run check` | 通った（517件。`src/core/` の行カバレッジ 98.54%） |
| `npm run test:e2e` | 通った（76件） |
| 目で確かめた（Playwright で撮った） | 見本の HAVING の SQL で GROUP BY・HAVING・SELECT の印の場面。集計の SELECT で色がグループの色と変わっていたのを見つけて直した |
| 実装検証（implementation-validator） | [必須] 2件・[推奨] 6件・[提案] 4件。検証役が PGlite で約55本のSQLを流した。直したものと見送りは `.steering/20261112-group-by-replay/tasklist.md` |
| `node scripts/check-review-files.js docs/review/20261112-group-by-replay.md c6281cc` | OK |

**検証していないこと**：
- **グループが6つより多いとき**：色が6色でくり返すので、色だけでは別のグループと見分けられない（中級の問題でグループの多い形が出たら、番号の表示などを考える）
- **1行に入らない長い SELECT の項目の一言・表の見た目**：見本の SQL でだけ見た
- **JOIN と集計を一緒に使うSQL**：JOIN は次の作業。今は JOIN があれば unsupported

## 判断してほしいこと

- なし

<details>
<summary>捨てた案・補足</summary>

- **JS でグループを計算する**：値の比べ方（NULL・数の型・文字の並べ方）を PostgreSQL と合わせるのが難しい
- **pgsql-ast-parser で GROUP BY を解く**：別名・列の番号の置き換えは、SELECT の項目の文字で足りた。構文木を通すと書き方が変わる心配が増える（初級のときと同じ判断）
- **SELECT の別名での GROUP BY を unsupported のままにする**：最初はそうしたが、中級でよく書く形なので扱った

</details>
