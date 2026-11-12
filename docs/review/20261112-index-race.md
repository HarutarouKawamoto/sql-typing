---
tags: [review, sql-typing, visualization, advanced, index]
created: 2026-11-12
updated: 2026-11-12
---
# 📝 20261112-index-race：上級の初期データと、インデックスあり・なしの比較

> - **対象**：ブランチ `feature/index-race`（作業前のコミット `81fe6ef`）
> - **steering**：`.steering/20261112-index-race/`
> - **見るべき箇所**（最大3つ）：
>   1. `src/core/explain.js` 読んだ行の数え方（`rowsRead`）と、変える前と後の比較（`compareChange`。SELECT だけ・前と後に初期状態へ）
>   2. `src/ui/components/IndexRace.jsx` カウンターと棒
>   3. `src/ui/components/PlayMode34.jsx` 書く画面で比べる条件（実行のたびに比べる）
> - **判断してほしいこと**：なし（本人の「上級まで作って」で、完了条件を満たしたらコミットしてマージする）
> - **検証していないこと**：3件

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 追加 | `.steering/20261112-index-race/requirements.md` | 要求（上級の初期データ・実行計画を読む・画面・受け入れ条件・スコープ外） |
| 追加 | `.steering/20261112-index-race/design.md` | 設計（explain.js・画面・テスト） |
| 追加 | `.steering/20261112-index-race/tasklist.md` | タスクと、実装検証の指摘への対応・見送り、振り返り |
| 追加 | `data/seeds/advanced.sql` | 上級の初期データ：`intermediate.sql` の全文と access_logs 5万行（`generate_series`、session_id はすべて違う、最後に ANALYZE） |
| 追加 | `src/core/explain.js` | `parseExplain`（計画の木・時間。rows・removed は loops を掛けて丸める、loops 0 はそのまま）、`rowsRead`、`scanKinds`、`isSelectQuery`、`compareChange`（SELECT だけ、前と後に reset、読めなければ ok: false） |
| 変更 | `src/schema/problem-schema.js` | `visual: { kind: index \| plan \| transaction, query? }`。index には SELECT の query がいる（refine） |
| 追加 | `src/ui/state/use-count-up.js` | 数を0から目標まで増やすフック（requestAnimationFrame。動きを減らす設定ならすぐ） |
| 追加 | `src/ui/components/IndexRace.jsx` | 左右の列（読み方・カウンター・棒・時間）と、下の一言（N 分の1・ほとんど変わらない・かえって長く・測れないほど短く） |
| 追加 | `src/ui/components/IndexRace.module.css` | 2列の枠、カウンター、棒 |
| 追加 | `src/ui/components/IndexRacePanel.jsx` | `runDbJob` で `compareChange` を呼び、読み込み中・失敗・結果を出す。読み上げの枠を先に置く |
| 追加 | `src/ui/components/IndexRacePanel.module.css` | 枠・問い合わせ・状態の文（結果が出たら見た目は隠す） |
| 変更 | `src/ui/components/PlayMode34.jsx` | 問題に `visual.kind === 'index'` があり、判定がエラー・打ち切りでなければ、書いたSQLで比べる |
| 変更 | `src/ui/screens/ReplayDemoScreen.jsx` | 上級の初期データで開く。「上級：インデックスで1行を探す」の見本 |
| 追加 | `tests/helpers/fixtures/explain/seq-scan.json` | PGlite の実際の EXPLAIN の出力（Seq Scan） |
| 追加 | `tests/helpers/fixtures/explain/index-scan.json` | 同（Index Scan） |
| 追加 | `tests/helpers/fixtures/explain/bitmap.json` | 同（Bitmap Heap Scan） |
| 追加 | `tests/helpers/fixtures/explain/join.json` | 同（集計と Hash Join） |
| 追加 | `tests/helpers/fixtures/explain/nested-loop.json` | 同（Nested Loop・Memoize・内側の Index Scan） |
| 追加 | `tests/helpers/fixtures/explain/index-only.json` | 同（Index Only Scan） |
| 追加 | `tests/unit/core/explain.test.js` | 計画の木・読んだ行（各節・ループ・小数・loops 0）・読み方 |
| 追加 | `tests/integration/explain/compare-change.test.js` | 5万行 → 1行、初期状態に戻る、関係のないインデックス、変えるSQLのエラー、SELECT 以外を断る、after で失敗、問い合わせのエラー |
| 変更 | `tests/integration/data-validation/problems.test.js` | 上級の初期データの決まり（全文を含む・5万行・session_id・顧客とパス）、`checkVisuals` を全問に |
| 変更 | `tests/helpers/answer-checks.js` | `checkVisuals`：visual.kind が index の問題で、正解SQLで読む行が減るか |
| 変更 | `tests/integration/data-validation/answer-checks.test.js` | `checkVisuals` が減る・減らない・対象外を見分けること |
| 変更 | `tests/unit/schema/schemas.test.js` | `visual` の形（index の query、SELECT だけ、WITH の書き換えを止める） |
| 追加 | `tests/e2e/visualization/index-race.spec.js` | 見本のページで、なし5万行・あり1行・カウンター・読み方 |
| 変更 | `docs/functional-design.md` | お店のDB（access_logs）、初期データの決まり（上級）、Explain の節、Problem の visual、IndexRace・IndexRacePanel・ReplayDemoScreen、問題データの検証、テスト戦略 |
| 変更 | `docs/repository-structure.md` | 新しいファイル、上級の見える化の置き場所（`viz/` ではなく `components/` と `core/`）、`checkVisuals` |
| 変更 | `docs/development-guidelines.md` | 問題データの書き方に `visual` |
| 変更 | `docs/architecture.md` | 上級の初期データの入れ直しの重さ |
| 変更 | `docs/glossary.md` | 実行計画・読んだ行・変える前と後の比較 |
| 変更 | `docs/product-requirements.md` | 上級の見える化1（インデックス）を作ったこと |
| 追加 | `docs/review/20261112-index-race.md` | このファイル |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| 見本のページ | 中級の初期データ・ステップ再生の見本だけ | 上級の初期データ（開くのに約2秒）。インデックスの比較の見本 |
| 書く画面（上級の問題、まだない） | — | 問題に visual があれば、実行のたびにインデックスの比較を出す |

## なぜ

- **5万行で1行を探す問い合わせ**：インデックスのない Seq Scan は5万行を全部読み、作ったあとは1行。数の差が一目でわかる
- **読んだ行 = 返した行 + 取り除いた行**：Seq Scan が「条件に合わない行も全部読んでいる」ことを数で見せる。時間はブラウザで 0 と出ることがあり、行の数のほうが安定して比べられる
- **compareChange は SELECT だけ**：EXPLAIN ANALYZE は実際に実行する。reset で戻るとはいえ、問題データの書き間違いで書き換えが走らないよう、2か所で止める
- **実行のたびに比べる**：関係のない列にインデックスを作ると読む行が減らないことも、比較で見せたい。次の判定が約2秒待つのは受け入れる

## 検証

| やったこと | 結果 |
|---|---|
| テストを先に書いた | 初期データの決まり・explain・compareChange、実装検証のあとの小数・loops・SELECT だけ・visual の形も失敗を見てから実装した。`checkVisuals` は実装のあとにテストを流した |
| `npm run check` | 通った（596件。`src/core/` の行カバレッジ 98.58%） |
| `npm run test:e2e` | 通った（83件） |
| 目で確かめた（Playwright で撮った） | 見本のページのインデックスの比較（ダーク）。ブラウザの時間が 0 と出ていたのを見つけて直した |
| 実装検証（implementation-validator） | [必須] 2件・[推奨] 6件・[提案] 5件。PGlite とビルド済みサイトで確かめた。対応と見送りは `.steering/20261112-index-race/tasklist.md` |
| `node scripts/check-review-files.js docs/review/20261112-index-race.md 81fe6ef` | OK |

**検証していないこと**：
- **書く画面での比較**：上級の問題がまだないので、PlayMode34 の表示は E2E で見ていない（上級の問題の作業で E2E を足す）
- **ブラウザでの打ち切り**：比べる問い合わせが時間内に終わらないときの表示（Node 版は打ち切れないので試せない）
- **読み上げソフトでの聞こえ方**

## 判断してほしいこと

- なし

<details>
<summary>捨てた案・補足</summary>

- **時間だけで比べる**：ブラウザの PGlite は短い時間を 0 と返す。読んだ行の数を主にした
- **正解のときだけ比べる**：間違いの比較（読む行が減らない）も学びになる
- **見本ごとに初期データを分ける**：見本を開くときに1回だけ約2秒かかるだけ

</details>
