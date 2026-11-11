# タスクリスト

## 🚨 タスク完全完了の原則

- 全タスクが `[x]` になるまで作業を続ける
- スキップは技術的な理由があるときだけ。理由を書く

## フェーズ1：SqlRunner
- [x] `value-parsers.js` と単体テスト
- [x] `sql-runner.js`（実行待ちの列・打ち切り・起動の再試行・複数の文・結果の形）
- [x] 作り物のバックエンドでの単体テスト
- [x] `node-backend.js` と `tests/helpers/make-runner.js`
- [x] Node 版での統合テスト（結果・型・エラー・reset・SERIAL。学習者のスキーマ・一時テーブル・インデックス・設定も）

## フェーズ2：初期データと検証
- [x] `data/seeds/beginner.sql`（products 30行）
- [x] 初期データの決まりの検証（値段と名前はすべて違う、も足した）
- [x] 正解SQLの実行の検証（`tests/helpers/answer-checks.js`）と、壊れた問題で失敗することのテスト（テスト用の問題は YAML ではなく `problem-factory.js` で作った）

## フェーズ3：ブラウザ
- [x] `pglite.worker.js`・`worker-backend.js`・`index.js`
- [x] `seed-loader.js`
- [x] `src/ui/state/database.js` と `App.jsx`
- [x] E2E を「準備完了（products 30行）」まで確かめる形にし、通す
- [x] ビルドの配る量を測る（gzip 5.49MB・brotli 3.71MB。目標の gzip 5MB を超える。ほぼ PGlite 本体。判断を本人に聞く）

## フェーズ4：検証と記録
- [x] `npm run check`・`npm run test:e2e` が通る（122件・2件）
- [x] 実装検証（implementation-validator）と指摘への対応
  - [x] [必須] M1：`RESET ALL; DISCARD TEMP;` では `SET ROLE` などが戻らない → `ROLLBACK` と `DISCARD ALL` を別々に流す。統合テストに `SET ROLE`・`PREPARE`・`LISTEN`・アドバイザリーロック
  - [x] [必須] M2：`close()`・作り直しの失敗のあとに空のDBで実行される → `#restored` の印で、作り直したら必ず流し直す。作り直しに失敗しても timeout を返す
  - [x] [必須] M3：Worker が落ちても使い続ける・起動が止まると「準備中」のまま → Worker 版は `error`・`messageerror` で以降を即失敗、SqlRunner は PG 以外のエラーでバックエンドを捨てる、起動30秒・流し直し15秒の上限
  - [x] [推奨] R1：戻らないもの（ロール・データベース・ラージオブジェクトなど）を「問題として出さない」と機能設計書に書いた
  - [x] [推奨] R2・R3：`prepare()` が失敗したら前の初期状態のまま、`prepare()` の前の `run()` は例外
  - [x] [推奨] R4：Worker 版の単体テスト（作り物の Worker）、close・流し直しの失敗・PG 以外のエラー・prepare の失敗・起動の時間切れの単体テスト、Node 版の時計の制約を書いた
  - [x] [推奨] R5：初期データの「英語・数字・記号だけ」と値の範囲の検証
  - [x] [推奨] R6：書き換え系で1行も変わらない正解、chapters.yaml にない章、壊れた初期データは章ごとに1回
  - [x] [推奨] R7：SQLSTATE の形で PG のエラーを見分ける、undefined の reject を Error にする
  - [x] [提案] P2（close の失敗を無視）・P3（`??` → `||`）・P5（起動と初期データの読み込みを同時に）・P6（ドキュメント）
  - [x] ~~[提案] P1（NUMERIC の表示の桁）・P4（返す行数の上限）~~（理由：表示の桁は判定・結果の表を作る作業で決める方がよい。行数の上限は結果の表（50行まで表示）を作る作業で、表示と合わせて決める。レビュー記録の「判断してほしいこと」に書いた）
- [x] 永続ドキュメントを直す（初期状態の戻し方、自前の Worker、値の型）：functional-design・architecture・glossary・repository-structure
- [x] `docs/review/20261111-sql-runner.md` を書き、`check-review-files.js` が通る（23ファイル）
- [x] 振り返りを書く

## 実装後の振り返り

**実装完了日**：2026-11-11

**計画と実績の差分**：
- 計画になかったもの：`tests/unit/data/worker-backend.test.js`（作り物の Worker）、起動と流し直しの上限時間、`#restored` の印、初期データの「英数字だけ」「値の範囲」「名前の重なり」の検証
- 計画から変えたもの：`RESET ALL; DISCARD TEMP;` → `ROLLBACK` と `DISCARD ALL` を別々に。`prepare()` の前の `run()` は例外に。壊れた初期データは章ごとに1回の報告に
- やらなかったもの：NUMERIC の表示の桁、返す行数の上限（理由は上のタスク）

**学んだこと**：
- PostgreSQL の `RESET ALL` は `role`・`session_authorization` を戻さない。セッションを丸ごと片付けるなら `DISCARD ALL`（トランザクションの外で）
- 「作り直した」と「初期状態を流した」は別の状態。印を持たないと、作り直した直後の空のDBで実行してしまう
- Node の同じプロセスで WebAssembly を動かすと、実行中はタイマーも止まる。打ち切りは作り物でしかテストできない
- テストを書き間違えたと思ったら、その原因が「WHERE のあとにウィンドウ関数が計算される」という、このアプリで教える実行順そのものだった

**次回への改善提案**：
- 判定（Judge）の作業で、「間違いの選択肢が不正解になる」「順番が1つに決まる」の検証を `answer-checks.js` に足す。NUMERIC の表示の桁と判定の比べ方を一緒に決める
- 判定・モード3の画面ができたら、本物のブラウザで打ち切り（`pg_sleep(10)`）を E2E で確かめる
- ~~配る量の目標を本人の判断に合わせて architecture.md に反映する~~ → 反映済み（brotli で 5MB 以内）
