# プロジェクト用語集 (Glossary)

## 概要

このドキュメントは、SQL Typing（仮）で使う用語の定義をまとめる。ドキュメント・コード・会話で同じものを同じ名前で呼ぶための決まりで、**コードの中では「英語表記（コード）」の列の名前をそのまま使う**（[開発ガイドライン](development-guidelines.md) の命名規則）。

**更新日**: 2026-11-11

## ドメイン用語

### 遊び方の単位

| 用語 | 英語表記（コード） | 定義 | 関連用語・使用例 |
|---|---|---|---|
| 章 | `Chapter` | レベル1つ分のまとまり。初級・中級・上級の3つ。章の中に問題が出題順に並ぶ | `chapters.yaml`、`level`（1〜3） |
| 問題 | `Problem` | 1つの依頼と、その正解SQL・空欄・ヒント・判定のルールのまとまり。1問1ファイルのYAML | 問題ID `beginner-03` |
| モード | `mode`（`1`〜`4`） | 1つの問題の遊び方。同じ問題を4つのモードのどれでも遊べる | 下の表 |
| ターニングポイント | `turningPoint`（`kind`） | 章の最後の山場の問題。モード3か4でクリアしたときだけクリア扱いになり、次の章が開く。**「ボス」とは呼ばない** | 複合問題、開く |
| 複合問題 | `composite`（`kind`） | そのレベルの内容に、前のレベルの内容を混ぜた問題。中級は初級を、上級は初級・中級を混ぜる | ターニングポイントは複合問題にする |
| 開く | `unlock`（`isUnlocked`） | 問題を選べる状態になること。前の問題をどれかのモードでクリアすると開く（前がターニングポイントならモード3・4だけ）。保存せず、毎回クリア状況から計算する | 学習記録 |
| クリア | `cleared` | そのモードで問題を最後まで正しく終えること | 星 |

**モードの一覧**

| 番号 | 名前 | 英語表記（コード） | 中身 |
|---|---|---|---|
| 1 | なぞり書き | `trace` | 表示された正解SQLを打ち写す |
| 2 | 打って選ぶ | `choice` | 空欄の選択肢を、打ち切ることで選ぶ |
| 3 | ヒントありで書く | `hinted` | 依頼文とヒント（3段階）を見て、白紙から書く |
| 4 | ヒントなしで書く | `blind` | 依頼文だけを見て、白紙から書く |

### ストーリー

| 用語 | 英語表記（コード） | 定義 | 関連用語・使用例 |
|---|---|---|---|
| 依頼の会話 | `story.before` | 問題の最初に出る、社内の人からの依頼（3〜8行） | 依頼する人 |
| 反応の会話 | `story.after` | クリア後に出る、驚き・感謝の会話（1〜4行） | 俺つええ |
| 登場人物 | `Character` | 依頼する数人（店長・先輩・営業）と主人公。`characters.yaml` | `speaker` |
| 主人公 | `player` | プレイヤー自身。ネットショップに入った新人データ担当 | |
| 俺つええ | — | 主人公がSQLであっさり片付け、周りが驚く話の味付け | 問題データの書き方 |
| お店のDB | `shop DB` | 物語の舞台のネットショップのDB。最初から最後まで同じもので、章が進むとテーブルが増える | `products`・`customers`・`orders`・`order_items` |

### タイピング（モード1・2）

| 用語 | 英語表記（コード） | 定義 | 関連用語・使用例 |
|---|---|---|---|
| スロット | `slot` | 打つべき位置1つ分。普通は1文字に1つ | `TypingTarget` |
| 区切りスロット | `separator slot` | 文字列の外の、連続する空白・改行をまとめた1つのスロット。Space と Enter のどちらでも正解 | |
| ミス | `miss` | 正しくないキーを押したこと。位置は進まず、そのスロットが赤く光る | 正確さ、苦手 |
| 空欄 | `Blank` | モード2で、選択肢から埋める部分。1問に1〜3個 | 選択肢 |
| 選択肢 | `Choice` | 空欄の下に並ぶ文字列。正解1つと、似ているが意味が違う間違い1〜3つ。間違いには `why`（なぜ違うか）が付く | `blanks[].wrong` |
| 候補 | `candidate` | まだ確定していない選択肢のうち、打った文字と先頭が合っているもの。光って表示される | |
| 確定 | `decide`（`decidedCorrect` / `decidedWrong`） | 候補の1つを最後まで打ち切ること。その選択肢を選んだことになる | 打つことで選ぶ |
| 選び間違い | `wrongChoices` | モード2で、間違いの選択肢を確定した回数。結果に出す。速さ・正確さとは別に数える | 確定 |

### 記録と評価

| 用語 | 英語表記（コード） | 定義 | 関連用語・使用例 |
|---|---|---|---|
| 星 | `star` | モードごとのクリアの印。1問に4つ（モード1〜4）。**速さの評価ではない** | ランクと区別する |
| ランク | `rank`（`S`/`A`/`B`/`C`） | モード1・2の、速さと正確さによる評価 | 星と区別する |
| 速さ | `cpm`（characters per minute） | 1分あたりの正しく打ったスロットの数 | |
| 正確さ | `accuracy` | 正しく打った数 ÷（正しく打った数＋ミスの数）× 100 | |
| 苦手 | `weak points`（`mistakes` / `typed`） | ミスの多い記号・キーワード。`mistakes ÷ typed` の大きい順に上位3つを結果画面に出す | |
| 学習記録 | `Progress` | クリア状況・最高記録・苦手・日ごとの記録・設定。localStorage に1つのJSONで保存 | `sql-typing:progress` |

### 判定

| 用語 | 英語表記（コード） | 定義 | 関連用語・使用例 |
|---|---|---|---|
| 判定 | `judge` | 書いたSQLと正解SQLの実行結果を比べ、正解かどうかを決めること | `JudgeResult.status` |
| 判定の結果 | `correct` / `wrong` / `ruleViolation` / `error` / `timeout` | 正解／不正解／結果は正しいが条件違反／SQLのエラー／5秒の打ち切り | |
| 必ず使う・使ってはいけない | `require` / `forbid` | 問題ごとの、使うべき・使ってはいけないキーワードの条件 | `ruleViolation` |
| 順番を比べる | `ordered` | true の問題だけ、行の順番も判定で比べる | `ORDER BY` が必要な問題 |
| 別解 | — | 正解SQLと書き方は違うが、結果が同じSQL。正解にする | 判定は実行結果で行う |
| 不正解の理由 | `reason` | `wrong` のときの、どこが違ったか。`empty`・`columnCount`・`columnNames`・`columnOrder`・`rowCount`・`values`・`order`・`tableMissing` | `JudgeResult.reason` |
| 正解の結果 | `expected`（`computeExpected`） | 正解SQLを初期状態で実行した結果。問題を開いたときに1回だけ作り、判定のたびに使う | 書き換え系は実行後のテーブルの中身 |
| 比べない列 | `ignoreColumns` | 書き換え系で、正しい書き方でも値が変わる列（SERIAL の `id` など）。判定で比べない | `INSERT` の問題 |
| 初期状態 | `initial state`（`prepare` / `reset`） | 章の初期データ＋問題の `extraSql` を流した直後のDB。問題を始めるたび・実行するたびにここへ戻す。戻すときはスキーマごと作り直して流し直す | 初期状態の作り直し |
| エラーの和訳 | `TranslatedError` | PostgreSQL のエラー（SQLSTATE）を、日本語の題名とよくある原因にしたもの | `ErrorTranslator` |

### 見える化

| 用語 | 英語表記（コード） | 定義 | 関連用語・使用例 |
|---|---|---|---|
| 見える化 | `viz` | SQLがDBの中でどう処理されるかを目に見える形にすること | 下のA〜D |
| 句 | `Clause` | SQLの最上位の部品。`SELECT` / `FROM` / `WHERE` / `GROUP BY` / `HAVING` / `ORDER BY` / `LIMIT` | `ClauseSplitter` |
| 書いた順 | `writtenOrder` | SQLに句を書く順番（SELECT が最初） | 実行順 |
| 実行順 | `execOrder` | DBが句を処理する順番（FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT） | 書いた順 |
| 段階 | `Step` | ステップ再生の1コマ。実行順のある時点での表と、前の段階からの変化（`label` は FROM・JOIN・WHERE・GROUP BY・HAVING・SELECT・DISTINCT・ORDER BY・LIMIT） | `StepDiff`（消えた行・列、まとまった行、並び替わったか、グループの番号 `groups`、集計したか `aggregated`、JOIN のつながり `join`） |
| 印の場面・変化の場面 | `phase: 'mark' \| 'apply'` | ステップ再生の1段階の2つの場面。印の場面は前の段階の表に「消える行（赤）・まとまる行（組ごとの色）・消える列（灰色）・グループ（GROUP BY・HAVING の色）」の印を付け、変化の場面でこの段階の表にする | StepTable |
| グループの鍵 | `__grp` | 集計するSQLのステップ再生で、各行がどのグループかを表す値（`ROW(GROUP BY の項目)::text`）。集計のあとの行を、グループの最初の行につなぐ | `pushGroupedSteps` |
| 見本のページ | `ReplayDemoScreen`（`/?demo`） | 初級の形と集計のSQLでステップ再生を見られるページ。入口からはリンクしない。印の見た目を確かめるため | ステップ再生 |
| 行の目印 | `rid` | 段階と段階の間で同じ行を見分ける印。元のテーブルの `ctid` を使う | `__rid` |
| ステップ再生（見える化A） | `stepReplay`（`StepPlayer`） | 実行順に1句ずつ光らせ、その時点の表を見せる再生 | 再生・一時停止・進む・戻る |
| 実行順の並び替え（見える化B） | `reorderIntro`（`ReorderIntro`） | モード3・4で実行したとき、書いた順の句が実行順に入れ替わる1.5秒のアニメーション（判定と同時に流し、終わってから結果を見せる） | 設定（`reorderAnimation`）で止められる。チップは `buildReorderChips` |
| 打ちながら変化（見える化C） | `liveResult` | モード1・2で、句を打ち終えるたびに結果の表が変わること | 句の終わり（`clauseEnded`） |
| 予想クイズ（見える化D） | `prediction` | 実行前に結果の行数などを当てさせる（P2） | |
| 実行計画 | `PlanNode`（`parseExplain`） | DB がSQLをどう実行したかの木。`EXPLAIN (ANALYZE, FORMAT JSON)` で取る | `explain.js` |
| 読んだ行 | `rowsRead` | 実行計画のうち、テーブルの行を読む節が読んだ行の数（返した行 + 条件で取り除いた行）。インデックスの比較のカウンター | Seq Scan なら全部の行 |
| 変える前と後の比較 | `compareChange` | 同じ問い合わせを、あるSQL（インデックスを作るなど）を実行する前と後で EXPLAIN ANALYZE して比べる | `IndexRace` |
| DBの地図 | `SchemaMap` | お店のDBのテーブルとつながりの図（ER図）。今のSQLが触るテーブルを光らせる | 全レベル共通 |
| 用語辞典 | `Dictionary` / `Keyword` | SQLのキーワードの、英語の意味とSQLでの意味の一覧（`DictionaryScreen`）。キーワードにカーソルを当てる（スマホではタップ）と出る説明（`KeywordTip`、`KeywordTipLayer`）も同じデータを使う | `keywords.yaml`。初めて出てくる問題は問題の `keywords` から作る |
| インデックス比較 | `indexRace` | 上級：インデックスあり・なしで、読んだ行数と実測時間を左右で比べる（P2） | `EXPLAIN ANALYZE` |
| 実行計画の木 | `planTree`（`PlanTree`） | 上級：`EXPLAIN ANALYZE` の結果を木の図にし、データの流れを見せる。葉（テーブルを読む節）が下、結果が上。線の太さは流れる行の数（P2） | `explainQuery`・`layoutPlan` |
| 節 | `PlanNode` | 実行計画の木の1つの箱（Seq Scan・Hash Join・Sort など）。下の節から行を受け取り、上の節へ返す | 実行されなかった節は loops 0 |
| トランザクションのタイムライン | `txTimeline` | 上級：2人の同時の注文を2列で並べるシミュレーション（P2） | PGlite は接続が1つ |

### 作り方（ハーネス）

| 用語 | 英語表記（コード） | 定義 | 関連用語・使用例 |
|---|---|---|---|
| 作業の完了条件 | `definition of done` | 作業を完了と言うための条件。`npm run check` が通る／画面を変えたら E2E も通る／ドキュメントを直した／レビュー用の記録を書いた | [開発ガイドライン](development-guidelines.md) |
| レビュー用の記録 | `review record` | 作業ごとに `docs/review/YYYYMMDD-<作業名>.md` に書く、変更内容の抜けのない記録。長さの上限なし | `check-review-files.js` |
| 変更したファイル一覧 | — | レビュー用の記録の表。`git diff --name-status` と完全に一致させる | |
| 問題データの検証 | `data validation`（`validate:data`） | `data/` の全ファイルが形どおりで、正解SQLが実行でき、選択肢の決まりを満たすかのテスト。失敗したらビルドを止める | 安全柵 |
| 安全柵 | `guardrail` | 間違いを人の注意ではなく機械で止める仕組み。問題データの検証・テスト・ESLint の依存ルール・レビュー記録の照合 | ハーネス |
| ステアリング | `steering` | `/add-feature` 1回分の計画（`.steering/YYYYMMDD-<作業名>/`）。要件・設計・タスクリスト | レビュー用の記録と同じ名前 |

## 技術用語

| 用語 | 定義 | 本プロジェクトでの用途 | バージョン |
|---|---|---|---|
| PostgreSQL | オープンソースのリレーショナルデータベース | 学習するSQLの方言。型と制約が厳しく、実行計画が詳しい | PGlite に含まれるもの |
| PGlite | PostgreSQL を WebAssembly にしたもの。ブラウザと Node で動く | ブラウザの中のお店のDB（Worker 版）、テストのDB（Node 版） | ^0.5（`~0.5` で固定） |
| WebAssembly | ブラウザで高速に動く、機械語に近い形式 | PGlite を動かす土台 | — |
| Web Worker | 画面とは別の流れ（スレッド）でJSを動かす仕組み | PGlite を置き、重いSQLでも画面を止めない。打ち切りのときは作り直す | — |
| pgsql-ast-parser | PostgreSQL のSQLを構文木にし、SQLに戻せるライブラリ | ステップ再生で、句を組み直したSQLを作る | ^12.0 |
| React | 画面を部品（コンポーネント）で組み立てるライブラリ | 画面レイヤー | ^19.3 |
| Vite | 開発サーバーとビルドの道具 | 開発・ビルド。Worker と WebAssembly の読み込み | ^8.3 |
| Motion | React のアニメーションライブラリ（旧 Framer Motion） | 行が消える・並び替わるなどのステップ再生の動き | ^14.12 |
| React Flow | 箱と線の図を描く React のライブラリ（`@xyflow/react`） | DBの地図 | ^12.12 |
| Zod | データの形を決めて検証するライブラリ | 問題データ・学習記録の検証。JSDoc の型もここから作る | ^4.6 |
| YAML | 人が読み書きしやすいデータの書き方 | 問題データ・章・登場人物・用語辞典 | yaml ^2.9 |
| JSDoc | JSのコメントで型や説明を書く書き方 | TypeScript の代わりの型の補助 | — |
| localStorage | ブラウザにデータを保存する仕組み | 学習記録 | — |
| Vitest | Vite と同じ設定で動くテストの道具 | 単体テスト・統合テスト・問題データの検証 | ^5.1 |
| Playwright | 本物のブラウザを動かしてテストする道具 | E2E（4モードのクリアなど） | ^1.65 |
| ctid | PostgreSQL の、テーブルの中の行の物理的な位置 | 段階をまたいで同じ行を見分ける行の目印 | — |

## 略語・頭字語

| 略語 | 正式名称 | 意味・本プロジェクトでの使用 |
|---|---|---|
| SQL | Structured Query Language | DBに問い合わせる言語。このサイトで学ぶもの |
| SQLSTATE | — | PostgreSQL のエラーの5文字のコード（例 `42601`）。エラーの和訳の鍵 |
| AST | Abstract Syntax Tree（構文木） | SQLを木の形にしたもの。pgsql-ast-parser が作る |
| SPA | Single Page Application | 1つのページの中で画面を切り替えるアプリ。このサイトの形 |
| ER図 | Entity Relationship Diagram | テーブルとつながりの図。DBの地図 |
| CTE | Common Table Expression | `WITH` で名前を付けた一時的な結果。上級で扱う |
| cpm | characters per minute | 速さの単位 |
| E2E | End to End | 画面を実際に操作して最初から最後まで確かめるテスト |
| MVP | Minimum Viable Product | 最初の版。初級1章（8問＋ターニングポイント） |
| PRD | Product Requirements Document | プロダクト要求定義書 |
| KPI | Key Performance Indicator | 学習の進み具合を測る数値（PRD） |
| CSP | Content Security Policy | 読み込めるスクリプトや接続先を制限する決まり。公開時に設定する |
| P0 / P1 / P2 | Priority 0〜2 | 優先度。P0＝MVPに必須、P1＝すぐ後、P2＝できれば |

## アーキテクチャ用語

| 用語 | 英語表記（コード） | 定義 | 関連 |
|---|---|---|---|
| 画面レイヤー | `src/ui/` | 表示と入力の受付。学習のルールを持たない | [アーキテクチャ設計書](architecture.md) |
| コアレイヤー | `src/core/` | 学習のルールそのもの。React・PGlite・DOM に依存しない純粋な関数 | |
| データレイヤー | `src/data/` | PGlite・問題データ・学習記録の入出力 | |
| 共通の決まり | `src/schema/` | Zod スキーマ。全レイヤーとテストから使う | |
| 依存のルール | — | `ui → core / data → schema` の向きだけ許す。ESLint で止める | |
| SqlRunner | `SqlRunner` | PGlite への窓口。初期状態の準備と戻し、実行待ちの列、5秒の打ち切り | Worker 版・Node 版 |
| 打ち切り | `timeout` | 5秒で返事がないSQLを、Worker ごと作り直して止めること | |
| 初期状態の作り直し | `restore`（`reset` の中身） | `ROLLBACK`・`DISCARD ALL` のあと、スキーマを消して作り直し、初期データと `extraSql` を流し直すこと。学習者が `DROP TABLE`・`SET ROLE` などをしても戻る。ロール・データベースなどクラスタ全体に残るものは戻らない（問題として出さない） | 初期状態 |
| バックエンド | `SqlBackend`（`createWorkerBackend` / `createNodeBackend`） | `SqlRunner` の中身。実際に PGlite を動かす部分。ブラウザは Worker 版、テストは Node 版 | SqlRunner |
| 複数の文 | `multipleStatements` | `;` で区切った2つ以上の文。実行せずにエラーで返す（PGlite の `42601`） | PgError |
