---
tags: [review, sql-typing, problems, content, intermediate]
created: 2026-11-12
updated: 2026-11-12
---
# 📝 20261112-intermediate-problems：中級の章（12問とターニングポイント）

> - **対象**：ブランチ `feature/intermediate-problems`（作業前のコミット `0b74976`）
> - **steering**：`.steering/20261112-intermediate-problems/`
> - **見るべき箇所**（最大3つ）：
>   1. `data/problems/intermediate/13-turning-point.yaml` 月次レポート（会話で月の形・単価・列名を決める）
>   2. `data/problems/intermediate/11-update.yaml` WHERE を付け忘れた事件の会話と判定
>   3. `tests/helpers/answer-checks.js` 並びが1つに決まるかの検証（JOIN の別名・`*`）
> - **判断してほしいこと**：なし（本人の「上級まで作って」で、完了条件を満たしたらコミットしてマージする）
> - **検証していないこと**：4件

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 追加 | `.steering/20261112-intermediate-problems/requirements.md` | 要求（中級の章・問題13個・用語・E2E） |
| 追加 | `.steering/20261112-intermediate-problems/design.md` | 問題の一覧（正解SQL・判定・空欄と間違い）、会話、キーワード、E2E |
| 追加 | `.steering/20261112-intermediate-problems/tasklist.md` | タスクと、実装検証の指摘への対応・見送り、振り返り |
| 変更 | `data/chapters.yaml` | 中級の章（level 2、`intermediate.sql`、テーブル4つ、新しいテーブル3つ、13問） |
| 変更 | `data/keywords.yaml` | 中級の用語20語（COUNT・SUM・MAX・AVG・GROUP BY・HAVING・JOIN・ON・LEFT JOIN・CASE・WHEN・THEN・ELSE・END・TO_CHAR・INSERT INTO・VALUES・UPDATE・SET・DELETE） |
| 追加 | `data/problems/intermediate/01-count-sum.yaml` | 1問目「商品は全部でいくつ？」：count・sum |
| 追加 | `data/problems/intermediate/02-group-by.yaml` | 2問目「カテゴリごとの品ぞろえ」：GROUP BY・count・max |
| 追加 | `data/problems/intermediate/03-having.yaml` | 3問目「在庫の多いカテゴリ」：HAVING（bag がちょうど90で `>=` と `>` が分かれる） |
| 追加 | `data/problems/intermediate/04-join.yaml` | 4問目「注文した人の名前」：JOIN・ON |
| 追加 | `data/problems/intermediate/05-left-join.yaml` | 5問目「まだ注文のないお客さん」：LEFT JOIN・IS NULL（require: LEFT JOIN） |
| 追加 | `data/problems/intermediate/06-join-count.yaml` | 6問目「お得意さまランキング」：LEFT JOIN と count(o.id)・GROUP BY |
| 追加 | `data/problems/intermediate/07-join-top.yaml` | 7問目「よく売れる商品トップ5」：明細と商品の JOIN・sum・LIMIT |
| 追加 | `data/problems/intermediate/08-subquery.yaml` | 8問目「平均より高い商品」：WHERE のサブクエリ・avg |
| 追加 | `data/problems/intermediate/09-case.yaml` | 9問目「値段の帯を付けて」：CASE（列名 band を比べる） |
| 追加 | `data/problems/intermediate/10-insert.yaml` | 10問目「新しいお客さん」：INSERT（customers を比べる、id は比べない） |
| 追加 | `data/problems/intermediate/11-update.yaml` | 11問目「キッチン用品だけ1割引き」：UPDATE・SET・WHERE（WHERE を付け忘れて全商品0円の事件を会話で） |
| 追加 | `data/problems/intermediate/12-delete.yaml` | 12問目「取り消した注文の片付け」：DELETE と IN のサブクエリ |
| 追加 | `data/problems/intermediate/13-turning-point.yaml` | ターニングポイント「社長に出す月次レポート」：注文と明細の JOIN・to_char・count(DISTINCT)・sum・GROUP BY（列名を比べる） |
| 変更 | `tests/helpers/answer-checks.js` | `checkOrderDetermined`：DISTINCT・GROUP BY・JOIN の形は、ORDER BY に出す列の番号を足して比べる（サブクエリで包むと ORDER BY のテーブルの別名が見えなかった）。`*` を含む形は確かめられない形で止める |
| 変更 | `tests/integration/data-validation/answer-checks.test.js` | 並びの検証の JOIN の形（別名・集計・同じ値の行・`*`） |
| 変更 | `src/ui/state/schema-layout.js` | DBの地図の列の間を広げ（280 → 360）、親を子のすぐ左の列まで寄せる（products → order_items の線が orders の箱の裏を通らないように） |
| 変更 | `tests/unit/ui/schema-layout.test.js` | 中級の形の期待値（products が orders の下） |
| 変更 | `src/ui/components/SchemaMap.jsx` | 線の名前をやめた（箱の下に隠れて読めなかった。FK の印と読み上げの一覧でわかる） |
| 変更 | `tests/e2e/progression/turning-point.spec.js` | モード1でクリアしたあとの表示（次の章はまだ開いていない）、モード4でクリアすると中級の1問目が開く |
| 追加 | `tests/e2e/progression/intermediate.spec.js` | 中級の一覧13問、UPDATE の問題（WHERE なしは不正解）、中級の DBの地図（4つの箱・3本の線・NEW） |
| 変更 | `tests/e2e/helpers/seed-progress.js` | `intermediateUpTo(n)`（初級を全部と中級の n 問目までクリアした状態） |
| 変更 | `tests/e2e/dictionary/dictionary.spec.js` | 初級の節の中で16語を数え、中級（20語）の見出しを確かめる |
| 変更 | `docs/functional-design.md` | 中級の章の問題の表と注意書き（同じ値の並び・列の別名・ターニングポイントの決め方・LEFT JOIN の require・9問目の既知の制限）、地図の置き方、並びの検証、E2E |
| 変更 | `docs/repository-structure.md` | data の木（intermediate.sql・problems/intermediate）、E2E のファイル、`schema-layout.js`・`seed-progress.js` の説明 |
| 変更 | `docs/development-guidelines.md` | 問題データの書き方：値の形・使う列も会話で決める、列の別名はテーブル名と重ねない、間違いの選択肢はエラーにしない |
| 変更 | `docs/product-requirements.md` | 中級の章：テーブルに order_items、作ったもの |
| 追加 | `docs/review/20261112-intermediate-problems.md` | このファイル |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| 一覧 | 初級9問 | 初級9問と中級13問 |
| 初級のターニングポイントをモード3・4でクリア | 次の問題はない | 中級の1問目が開く |
| 用語辞典 | 初級16語 | 初級16語・中級20語 |
| DBの地図（中級） | — | 4つの箱、親を子のすぐ左に、線に名前なし |

## なぜ

- **会話の数字は PGlite で出してから書いた**：30種類・377個、バッグ7つ・9800円、文房具142個、high 4つ・middle 17 など
- **11問目で事件を話す**：決定8「WHERE を付け忘れた UPDATE で全商品が0円の事件を体験させる」。モード2の空欄の間違いでは WHERE を消せない（空の選択肢は置けない）ので、会話で事件を語り、判定（モード3・4）で WHERE なしを不正解にする
- **ターニングポイントは注文と明細の2つ**：「注文の数」を数えるときに明細の行で増える落とし穴（count(DISTINCT)）が、中級の複合問題としてちょうどよい。3つ以上の結合は上級
- **並びの検証を列の番号に**：中級の JOIN の問題で、サブクエリで包む今までの方法が ORDER BY の o.id を見られず止まった。出す列が全部同じ行は同じ行なので、列の番号で並べ替えても見つける力は同じ
- **地図の置き方**：中級の4つのテーブルで、線が箱の下に隠れ、products → order_items の線が orders の裏を通って、products と orders がつながっているように見えた

## 検証

| やったこと | 結果 |
|---|---|
| `npm run validate:data` | 57件通った。最初は2つで止まった（2問目の間違いの選択肢が正解の先頭部分、並びの検証が JOIN の別名を扱えない） |
| `npm run check` | 通った（567件） |
| `npm run test:e2e` | 通った（82件） |
| 目で確かめた（Playwright で撮った） | 中級の DBの地図（モード選択・4問目・7問目）。箱が近すぎて線が隠れ、線が別の箱の裏を通るのをここで見つけて直した |
| 実装検証（implementation-validator） | [必須] 2件・[推奨] 5件・[提案] 7件。検証役が判定に正解・間違い・別解を流した。対応と見送りは `.steering/20261112-intermediate-problems/tasklist.md` |
| `node scripts/check-review-files.js docs/review/20261112-intermediate-problems.md 0b74976` | OK |

**検証していないこと**：
- **13問を画面で遊んで通すこと**：E2E は UPDATE の問題（モード4）と、初級のターニングポイントからの開き方だけ。ほかの問題は問題データの検証（正解・間違い・並び・ステップ再生・途中までの実行）で確かめた
- **モード4で、会話だけを読んで各問題を書けるか**：実装検証が別解を流して確かめたが、本人が遊んで確かめてはいない
- **9問目の `>` と `>=`**：ちょうど5000円・1000円の商品がないので区別できない（既知の制限）
- **5問目の `LEFT OUTER JOIN`**：require の決まりで ruleViolation になる（既知の制限）

## 判断してほしいこと

- なし

<details>
<summary>捨てた案・補足</summary>

- **中級の初期データにちょうど5000円の商品を足す**：products は初級と同じ30行にそろえる決まり（初級の問題・テストが行数を数えている）
- **ターニングポイントで顧客・注文・明細・商品の4つをつなぐ**：上級の「3つ以上の結合」と重なる
- **線の名前を残して位置をずらす**：箱の FK の印で足りる

</details>
