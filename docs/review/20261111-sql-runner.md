---
tags: [review, sql-typing, pglite, web-worker, vitest, playwright]
created: 2026-11-11
updated: 2026-11-11
---
# 📝 20261111-sql-runner：DBが動く（SqlRunner）

> - **対象**：ブランチ `feature/sql-runner`（作業前のコミット `181d262`）。まだコミットなし
> - **steering**：`.steering/20261111-sql-runner/`
> - **見るべき箇所**（最大3つ）：
>   1. `src/data/sql-runner/sql-runner.js:216` 初期状態の作り直し（`ROLLBACK` → `DISCARD ALL` → スキーマの作り直し → 初期データ）。「何をされても戻る」の要
>   2. `src/data/sql-runner/sql-runner.js:310` 打ち切りのあと。作り直しに失敗しても timeout を返し、空のDBで実行しない
>   3. `src/data/sql-runner/worker-backend.js:29` Worker が落ちたら、以降の要求をすぐ失敗させる
> - **判断してほしいこと**：2件（配る量の目標は決定済み）
> - **検証していないこと**：4件

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 追加 | `data/seeds/beginner.sql` | 初級の初期データ。`products` 30行（kitchen 8・stationery 7・interior 8・bag 7）。在庫0が4行、仕入れ先 NULL が5行、`Mug` を含む名前が5行。値段と名前はすべて違う。値は英語と数字だけ |
| 変更 | `docs/architecture.md` | PGlite の行と「実行のしくみ」：付属の `PGliteWorker` ではなく自前の Worker にした理由とやりとりの形。打ち切りは Worker 版だけ効くこと、起動と流し直しの上限時間。配る量の目標を「gzip 5MB」から「brotli 5MB」に変え（本人の判断）、実測（brotli 3.71MB・gzip 5.49MB）を書いた。セキュリティに「配信の圧縮（brotli）」の判断を1行足した（BREACH・CRIME は当てはまらない理由と、見直す時期） |
| 変更 | `docs/functional-design.md` | SqlRunner の節を実装に合わせて書き直した（バックエンド、実行待ちの列、初期状態の戻し方をスナップショット方式から作り直し方式へ、戻らないもの、作り直したあと、上限時間、値の型、複数の文、エラーの扱い、Node 版の制約、PG のエラーの見分け方）。`QueryResult`・`PgError` の型。初期データの決まりに「値段と名前はすべて違う」。初級7問目の注記 |
| 変更 | `docs/glossary.md` | 「スナップショット」をやめ「初期状態の作り直し」に。「バックエンド」「複数の文」を追加 |
| 変更 | `docs/repository-structure.md` | `src/data/` の配置ファイル（Worker 版・value-parsers・index・seed-loader）、`src/ui/state/database.js`、`tests/unit/data/`・`tests/integration/sql-runner/`・`data-validation/answer-checks.test.js`、`tests/helpers/` の `make-runner.js`・`answer-checks.js` |
| 追加 | `src/data/seed-loader.js` | `data/seeds/*.sql` を `import.meta.glob` の `?raw` で文字列として読む `loadSeed()` |
| 追加 | `src/data/sql-runner/index.js` | 画面から使うもの（`SqlRunner`・Worker 版など）をまとめて export。Node 版は入れない |
| 追加 | `src/data/sql-runner/node-backend.js` | テスト用のバックエンド（同じプロセスで PGlite）。打ち切りの時計が動かない制約をコメントに書いた |
| 追加 | `src/data/sql-runner/pglite.worker.js` | Web Worker の中で PGlite を動かす。`ready`・`exec`・`query` の要求に答え、エラーは `{ code, message, position }` だけを返す |
| 追加 | `src/data/sql-runner/sql-runner.js` | `SqlRunner`。実行待ちの列、起動（30秒・3回まで）、初期状態の作り直し（15秒まで）、作り直したら必ず流し直す、5秒の打ち切り、PG のエラーと PG 以外のエラーの分け方、結果の形と値のそろえ方、複数の文の印 |
| 追加 | `src/data/sql-runner/value-parsers.js` | 型ごとの値の変換（DATE・TIMESTAMP は文字列のまま、NUMERIC・BIGINT は数値。大きすぎる BIGINT と NaN は文字列） |
| 追加 | `src/data/sql-runner/worker-backend.js` | ブラウザ用のバックエンド。要求に id を付けて返事と対応づける。Worker が落ちた（`error`・`messageerror`）ら以降はすぐ失敗。`terminate` で待っている要求を失敗させる |
| 変更 | `src/ui/App.jsx` | 「データベース：準備中…／準備完了（products 30行）／起動できませんでした」を `role="status"` で表示 |
| 追加 | `src/ui/state/database.js` | アプリに1つだけの `SqlRunner`（`getSqlRunner`）と、起動の状態を返す `useDatabaseStatus`。PGlite の起動と初期データの読み込みを同時に始める |
| 変更 | `tests/e2e/smoke/app-boot.spec.js` | ビルドしたものの上で PGlite が起動し「準備完了（products 30行）」が出ること、コンソールのエラーが出ないことを足した |
| 追加 | `tests/helpers/answer-checks.js` | PGlite を使う問題データの検証：正解SQLが実行でき、結果が空でない（書き換え系は1行以上変わる）。初期データが流せない章は章ごとに1回報告、chapters.yaml にない章の問題も報告 |
| 追加 | `tests/helpers/make-runner.js` | Node 版の SqlRunner を作る `makeNodeRunner`、初期データを読む `readSeed` |
| 追加 | `tests/integration/data-validation/answer-checks.test.js` | `checkAnswersRun` が、エラー・0行・壊れた extraSql・初期データのファイルがない・壊れた初期データ・ない章・1行も変わらない書き換えを見つけること |
| 変更 | `tests/integration/data-validation/problems.test.js` | 「PGlite で確かめる決まり」を追加：全問の正解SQLの実行、初級の初期データの決まり（30行・カテゴリ・在庫0・NULL・Mug・値段と名前の重なり・英数字だけ・値の範囲） |
| 追加 | `tests/integration/sql-runner/node-runner.test.js` | Node 版の PGlite で、結果の形・値の型・ctid・書き換えの行数・エラー・複数の文・末尾の `;`・初期状態への戻し方（UPDATE・DROP TABLE・閉じていない BEGIN・スキーマ・一時テーブル・インデックス・SET・SET ROLE・PREPARE・LISTEN・ロック・close・SERIAL・extraSql） |
| 追加 | `tests/unit/data/sql-runner.test.js` | 作り物のバックエンドで、順番、エラー、prepare 前の例外、流し直しの手順、打ち切りと作り直し（失敗しても timeout）、close のあと、PG 以外のエラーのあと、prepare の失敗、流し直しの時間切れ、起動の再試行と時間切れ |
| 追加 | `tests/unit/data/value-parsers.test.js` | 型ごとの変換 |
| 追加 | `tests/unit/data/worker-backend.test.js` | 作り物の Worker で、ready 待ち、id での対応づけ、PG のエラーの形、Worker が落ちたとき、messageerror、terminate、起動の失敗 |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| アプリを開いたとき | 「準備中」と出るだけ | 裏で PGlite を Worker の中に起動し、初級の初期データを流して「データベース：準備完了（products 30行）」と出す |
| 他の作業からSQLを実行するとき | 手段がない | `getSqlRunner().run(sql)` で `{ ok, result | error | timeout }` が返る |
| 学習者がDBを壊したとき | — | `reset()` で、`DROP TABLE`・`SET ROLE`・閉じていない `BEGIN` などのあとでも初期状態に戻る |
| 止まらないSQL | — | 5秒で打ち切り、Worker を作り直して初期状態を流し直す |
| `npm run validate:data` | 形とファイルをまたぐ決まりだけ | 加えて、初級の初期データの決まりと、全問の正解SQLが PGlite で実行できることを確かめる |
| `npm run build` の出力 | JS と CSS だけ（gzip 69KB） | PGlite の `.wasm`・`.data`・Worker が加わる（下の「検証」） |

## なぜ

- **自前の Worker にした**：付属の `PGliteWorker` は複数タブで1つのDBを共有する仕組み（リーダーの選出など）を持っていて、打ち切りのときに止めて作り直す動きが読みにくい。このアプリはタブごとに別のDBでよく、`worker.terminate()` で確実に止められる自前の Worker の方が単純
- **初期状態はスナップショットではなく作り直しにした**：機能設計書のスナップショット方式（テーブルの中身をコピーしておく）では、学習者の `DROP TABLE`・`ALTER TABLE`・`CREATE INDEX` で戻せない。スキーマの作り直しは PGlite で実測3ms
- **`DISCARD ALL` を `ROLLBACK` と別に流す**：最初は `RESET ALL; DISCARD TEMP;` にしていたが、実装検証で `SET ROLE`（スーパーユーザーでないロール）のあと `reset` が永久に失敗すると指摘された（`RESET ALL` は role を戻さない）。`DISCARD ALL` はトランザクションの中で実行できず、1回の `exec` に並べると失敗するので分けた
- **作り直したら必ず流し直す（`#restored` の印）**：最初は `close()` のあとや打ち切り後の作り直しに失敗したあと、空のDBで実行されてしまっていた（実装検証で実測された）。「空のDBで学習者のSQLが動いて、ないテーブルのエラーになる」のは学習の邪魔になるので、どの道でも初期状態を流してから実行する
- **`prepare()` の前の `run()` を例外にした**：初期状態が前提の API なので、`reset()` と同じにそろえた
- **複数の文は PGlite のエラーで見分ける**：PGlite の `query()` はもともと2つ以上の文を受け付けない（`42601`）。自前で `;` を数えると文字列やコメントの中の `;` を見分ける必要があり、コアレイヤーの字句解析を data レイヤーから使えない（依存のルール）ため
- **NUMERIC・BIGINT を数値にした**：判定で `1000` と `1000.0`、`count(*)` の `30` を同じに扱うため。表示の桁（`ROUND(x, 2)` の `1.50` が `1.5` になる）は判定・結果の表の作業で決める
- **戻らないものは「問題として出さない」にした**：ロール・データベースなどクラスタ全体に残るものは、スキーマの作り直しでは戻せない。権限の管理はスコープ外（PRD）なので、確実に戻す（`reset` のたびに PGlite ごと作り直す）重さを今は払わない
- **E2E は2本目のテストで PGlite の起動を確かめた**：土台づくりで「PGlite が Vite で本当に動くか」を検証していなかったため

## 検証

| やったこと | 結果 |
|---|---|
| `npm run check`（ESLint ＋ Prettier ＋ Vitest） | 通った（145件。単体93件・統合52件） |
| `npm run test:e2e`（build ＋ Playwright） | 通った（2件。ビルドしたものの上で PGlite が Worker の中で起動し「準備完了（products 30行）」） |
| `npm run validate:data`（build の前に自動で走る） | 通った（30件） |
| PGlite の挙動を Node で実際に確かめた（作業の最初） | 起動1.4秒、スキーマの作り直し3ms、`query()` は複数の文で `42601`、型ごとの値（DATE→Date、NUMERIC→文字列、count→数値、bool） |
| 配る量（`dist/assets` を gzip・brotli で測った） | **gzip 5.49MB・brotli 3.71MB**。内訳はほぼ PGlite 本体（`.wasm` gzip 3.2MB・`.data` gzip 2.1MB・Worker gzip 128KB）。画面の表示に必要な JS は gzip 69KB |
| 実装検証（implementation-validator） | [必須] 3件・[推奨] 7件・[提案] 6件。P1（NUMERIC の表示の桁）と P4（返す行数の上限）以外はすべて対応（`.steering/20261111-sql-runner/tasklist.md`） |
| `npm audit` | 土台づくりと同じ ESLint の中の4件だけ（増えていない） |
| `node scripts/check-review-files.js docs/review/20261111-sql-runner.md 181d262` | OK |

**検証していないこと**：
- **ブラウザでの打ち切り**：5秒の打ち切りと Worker の作り直しは、作り物のバックエンド・作り物の Worker でしか確かめていない。本物のブラウザで `SELECT pg_sleep(10)` を流すテストはない（判定・モード3の画面ができたら E2E で確かめる）
- **ブラウザで Worker が落ちたとき**：作り物の Worker の `error` イベントでしか確かめていない
- **初回表示の速さ（3秒以内）と PGlite の起動時間（ブラウザ）**：E2E では手元の `vite preview` で3秒ほどで準備完了になったが、家庭用回線の速さでは測っていない
- **Chrome 以外**：E2E は Chromium だけ（PRD の対応は Chrome・Edge）

## 判断してほしいこと

- ~~**配る量の目標**~~：決定済み。gzip で 5.49MB と「初回 gzip 5MB 以内」を超えたため、本人の判断で目標を「brotli で 5MB 以内」に変えた（実測 3.71MB で満たす）。`docs/architecture.md` に反映
- **戻らないもの**：`CREATE ROLE`・`CREATE DATABASE` などは `reset` で戻らない。「問題として出さない」で良いか（権限はスコープ外）
- **コミット**：まだしていない。このブランチでコミットし、`main` にマージしてよいか

<details>
<summary>捨てた案・補足</summary>

- **付属の `PGliteWorker`**：上の「なぜ」のとおり。複数タブで1つのDBを共有したくなったら（学習記録とは別に、遊んでいる途中のDBを共有するなど）見直す
- **`reset` のたびに PGlite ごと作り直す**：何をされても確実に戻るが、Node で1.4秒、ブラウザでは WebAssembly の読み直しでもっと重い。毎回の実行の前に `reset` するので使えない
- **`dumpDataDir` で初期状態を保存して戻す**：ロールなども戻せる可能性があるが、まだ試していない。戻らないものを問題に使いたくなったら検討する
- **自前で `;` を数えて複数の文を見分ける**：文字列・コメント・`$$` の中の `;` を見分ける必要があり、PGlite のエラーで足りる
- **返す行数の上限**：`SELECT * FROM generate_series(1, 5000000)` のような結果は Worker からまるごと送られる。結果の表（50行まで表示）を作る作業で、表示と合わせて上限を決める
- **NUMERIC の表示の桁**：判定用の値と表示用の文字列を分けるかどうかは、判定の作業で決める。`NaN`（float8）は `NaN !== NaN` なので判定で気をつける
- ビルドで PGlite の中の直接の `eval` について警告が出る（ライブラリの中のこと。動きには影響しない）

</details>
