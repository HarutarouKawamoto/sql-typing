---
tags: [review, sql-typing, content, advanced, judge]
created: 2026-11-12
updated: 2026-11-12
---
# 📝 20261112-advanced-problems：上級の章（11問とターニングポイント）

> - **対象**：ブランチ `claude/changes`（作業前のコミット `dc1fb89`）。ブランチ名は、ブランチを決めるダイアログで本人が選んだもの。同じ名前の前のブランチはマージ済みだったので、`main` の位置から作り直した
> - **steering**：`.steering/20261112-advanced-problems/`
> - **見るべき箇所**（最大3つ）：
>   1. `src/core/judge.js` 作る系の判定 `compareQuery`（実行したあとに SELECT を流して比べる）
>   2. `data/problems/advanced/12-turning-point.yaml` ターニングポイント（extraSql で数量を変えて、数量を見ない書き方を落とす）
>   3. `src/core/tx-simulation.js` 3つ目の場面「1文で確かめて減らす」と、場面の商品（id 28）
> - **判断してほしいこと**：1件（9問目の CHECK の判定の制限）
> - **検証していないこと**：3件

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 追加 | `.steering/20261112-advanced-problems/requirements.md` | 要求（compareQuery・タイムラインの直し・12問の一覧・E2E・受け入れ条件・スコープ外） |
| 追加 | `.steering/20261112-advanced-problems/design.md` | 設計（compareQuery・問題で使う compareQuery・タイムライン・問題データの判定・E2E） |
| 追加 | `.steering/20261112-advanced-problems/tasklist.md` | タスク、実装検証の指摘への対応・見送り、振り返り |
| 変更 | `src/schema/problem-schema.js` | `judge.compareQuery`（SELECT で始まる SQL の文字）。`compareTable` と一緒なら失敗 |
| 変更 | `src/core/judge.js` | `compareQuery` があれば学習者の SQL のあとにそれを流して比べる（並び・列の名前は比べない）。`tableMissing` は `compareTable` のときだけ。作る系の不正解の文を決まった文にする |
| 変更 | `src/core/tx-simulation.js` | 場面の商品を id 28 に。3つ目の場面 `atomic`（`UPDATE ... AND stock > 0`。待ったあと確定した在庫で確かめ直し、1行も変えなければ鍵を外して ROLLBACK へ） |
| 変更 | `src/ui/state/tx-timeline-state.js` | atomic の結果の文（待った・待たなかった）、待ちは読む手順に限らず数える、見本の順のボタンの文 `readFirstLabel` |
| 変更 | `src/ui/components/TxTimeline.jsx` | 説明を「Shoulder Bag Leather（id 28）は在庫1個」に。ボタンの文を `readFirstLabel` から |
| 変更 | `data/chapters.yaml` | 上級の章（level 3、advanced.sql、テーブルに access_logs、12問） |
| 変更 | `data/keywords.yaml` | 上級の10語（WITH・OVER・PARTITION BY・RANK・CREATE INDEX・CREATE TABLE・PRIMARY KEY・NOT NULL・CHECK・FOR UPDATE） |
| 追加 | `data/problems/advanced/01-join-four.yaml` | 4つのテーブルをつなぐ（支払い済みの注文の中身） |
| 追加 | `data/problems/advanced/02-self-join.yaml` | 自己結合（Travel Mug より安い同じカテゴリの品） |
| 追加 | `data/problems/advanced/03-with.yaml` | WITH（取り消しを除いた注文の数） |
| 追加 | `data/problems/advanced/04-with-average.yaml` | WITH を2回（売上が平均より多い地域） |
| 追加 | `data/problems/advanced/05-rank.yaml` | RANK() OVER (PARTITION BY)（カテゴリの中の値段の順位） |
| 追加 | `data/problems/advanced/06-running-total.yaml` | SUM() OVER (ORDER BY)（月ごとの売上と累計） |
| 追加 | `data/problems/advanced/07-plan.yaml` | 地域ごとのアクセス数、visual: plan |
| 追加 | `data/problems/advanced/08-create-index.yaml` | CREATE INDEX、compareQuery（インデックスの列）、visual: index |
| 追加 | `data/problems/advanced/09-create-table.yaml` | CREATE TABLE と制約、compareQuery（列と制約） |
| 追加 | `data/problems/advanced/10-for-update.yaml` | SELECT ... FOR UPDATE、require、visual: transaction |
| 追加 | `data/problems/advanced/11-category-top.yaml` | 複合：WITH 2つ・結合・RANK（カテゴリごとの売上1位） |
| 追加 | `data/problems/advanced/12-turning-point.yaml` | ターニングポイント：在庫が足りるときだけ引く UPDATE ... FROM、extraSql で注文19の数量、visual: transaction |
| 変更 | `tests/helpers/answer-checks.js` | `checkAnswersRun`：compareQuery の問題は、正解SQLのあと compareQuery が1行以上・エラーなし |
| 変更 | `tests/integration/data-validation/answer-checks.test.js` | compareQuery の枝（行がある・0行・エラー・正解SQLのエラー） |
| 変更 | `tests/integration/data-validation/problems.test.js` | 選択肢の確かめの時間の上限を5分に（上級は5万行を入れ直すため） |
| 変更 | `tests/integration/judge/judge.test.js` | compareQuery（名前の違うインデックスは正解、違う列・作らない SQL は不正解、不正解の文、テーブルを作らないとき、判定のあと消える） |
| 変更 | `tests/unit/schema/schemas.test.js` | compareQuery の形（SELECT だけ、compareTable と一緒は不可） |
| 変更 | `tests/unit/core/tx-simulation.test.js` | 場面が3つ、atomic（SQL・待って確かめ直す・鍵を外す・どの順でも守れる） |
| 変更 | `tests/unit/ui/tx-timeline-state.test.js` | atomic の結果の文（待った・待たなかった）、ボタンの文 |
| 変更 | `tests/e2e/helpers/seed-progress.js` | `advancedUpTo(n)` |
| 追加 | `tests/e2e/progression/advanced.spec.js` | 一覧の12問、インデックス・実行計画・テーブルを作る問題、ターニングポイントとタイムライン |
| 変更 | `tests/e2e/dictionary/dictionary.spec.js` | 上級の10語、FOR UPDATE の初めて出てくる問題 |
| 変更 | `tests/e2e/visualization/step-replay-marks.spec.js` | 見本のページで「段階 1/」を待つ時間を30秒に（上級の E2E が増えて、全体を流すと見本のページの DB の準備が5秒を超え、2回続けて落ちた） |
| 変更 | `docs/functional-design.md` | お店のDB（上級）、Judge の compareQuery、判定の順番、TxSimulation（id 28・atomic）、TxTimeline、上級の章の問題の表と注記、データ検証、テスト戦略 |
| 変更 | `docs/development-guidelines.md` | 作る系の判定、WITH の問題の書き方 |
| 変更 | `docs/repository-structure.md` | `data/problems/advanced/`、`advanced.spec.js`、`advancedUpTo` |
| 変更 | `docs/glossary.md` | 作る系の判定（`compareQuery`） |
| 変更 | `docs/product-requirements.md` | 上級の章を作ったこと |
| 追加 | `docs/review/20261112-advanced-problems.md` | このファイル |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| 一覧 | 初級・中級 | 上級（12問）。中級のターニングポイントをモード3・4でクリアすると開く |
| 用語辞典 | 初級16語・中級20語 | 上級10語も |
| タイムライン | 場面2つ、商品 id 4（初期データと合っていない） | 場面3つ、商品 id 28（初期データでも在庫1個） |
| 判定 | 中身・テーブルの中身で比べる | 作る系（`compareQuery`）も |

## なぜ

- **`compareQuery`**：`CREATE INDEX`・`CREATE TABLE` は行を書き換えないので、中身を比べると何を書いても正解になる。カタログから作ったものを読み、人によって違う名前は読まない
- **ターニングポイントを1文の UPDATE ... FROM に**：`SqlRunner` は1回に1文だけなので、BEGIN … COMMIT の問題は書けない。「確かめと書き換えを1文にする」は、実際に二重注文を防ぐ書き方でもある。同時の2人での違いはタイムラインの3つ目の場面で見せる
- **場面の商品を id 28 に**：初期データを変えると、見本のページの E2E（products の行の数）が変わる。もともと在庫1個の品があった
- **WITH の問題は `ordered: false`**：`checkOrderDetermined` が WITH の並びを確かめられない

## 検証

| やったこと | 結果 |
|---|---|
| テストを先に書いた | compareQuery（形・判定）・タイムラインの3つ目の場面は、失敗を見てから実装した。実装検証のあとの不正解の文・鍵・ボタンの文も失敗を見てから。データ検証の compareQuery の枝のテストは、テスト用の初期データに category がなく1回直した |
| 正解SQLを初期データで流した | 全問の結果を見て、会話・反応の数字と合わせた（実装検証でも全問を流して確かめた） |
| `npm run validate:data` | 通った（66件） |
| `npm run check` | 通った（648件） |
| `npm run test:e2e` | 1回目は1件、2回目は2件落ちた（どちらも見本のページの「ステップ再生の印」で、DB の準備を5秒しか待っていなかった）。待ち時間を30秒にして、93件すべて通った |
| 目で確かめた（Playwright で撮った） | 上級の一覧、モード1（長い WITH）、モード2（ターニングポイントの空欄）、モード4でターニングポイントをクリアしたあとのタイムライン。長い行の折り返しを見て、4・5・6・11問目の表示用SQLを句の切れ目で改行した |
| 実装検証（implementation-validator） | [中] 4件・[低] 7件とテストの抜け。対応と見送りは `.steering/20261112-advanced-problems/tasklist.md` |
| `node scripts/check-review-files.js docs/review/20261112-advanced-problems.md dc1fb89` | OK |

**検証していないこと**：
- **全問を全モードで最後まで打つこと**：E2E はインデックス・実行計画・テーブル・ターニングポイントのモード4だけ。ほかの問題・モードは問題データの検証（打てる文字・空欄・選択肢・句の途中の実行）に頼っている
- **モード4で会話だけから書けるか**：会話から列・並び・値の形が決まるように書き、実装検証でも読んだが、人が解いてはいない
- **読み上げソフトでの聞こえ方**

## 判断してほしいこと

- **9問目の CHECK の判定**：CHECK は式の形で比べるので、`discount > 0 AND discount <= 50` や CHECK を2つに分ける書き方は、意味が同じでも不正解になる。会話で「CHECK で BETWEEN 1 AND 50」と形まで決めて逃げた。値を入れて試す判定（関数を使うなど）にするかは、今は見送っている

<details>
<summary>捨てた案・補足</summary>

- **初期データに限定品を足す**：見本のページの E2E の行の数が変わる。もともと在庫1個の id 28 を使った
- **BEGIN; …; COMMIT の問題**：1回に1文しか実行できない
- **アクセスログで二重注文を探すターニングポイント**：初期データに注文を足すと、見本のページの E2E と中級の結果が変わる
- **compareQuery にインデックスの名前・制約の名前を入れる**：人によって違う

</details>
