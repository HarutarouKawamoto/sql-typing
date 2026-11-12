# タスクリスト

## 🚨 タスク完全完了の原則

- 全タスクが `[x]` になるまで作業を続ける
- スキップは技術的な理由があるときだけ。理由を書く

## フェーズ1：データとコア
- [x] 上級の初期データの決まりのテストを先に書き、`advanced.sql`（intermediate.sql の全文と access_logs 5万行。初期状態に戻すのは温まったあと 0.2〜0.3 秒）
- [x] `explain.test.js` を先に書き、`parseExplain`・`rowsRead`・`scanKinds`（PGlite の実際の出力を `tests/helpers/fixtures/explain/` に保存して使う）
- [x] `compare-change.test.js` を先に書き、`compareChange`

## フェーズ2：画面
- [x] 問題の形に `visual`
- [x] `IndexRace`・`use-count-up.js`・`IndexRacePanel`（長いシェルのコマンドが壊れたので、ファイルは1つずつ書いた）
- [x] PlayMode34 と見本のページにつなぐ（見本のページは上級の初期データで開く）

## フェーズ3：E2E と確かめ
- [x] E2E `index-race.spec.js`
- [x] 目で確かめる（ブラウザの PGlite はインデックスありの時間を 0 と返し「0.000 ms」と出ていた → 0.001 ms 未満と書き、「測れないほど短く」と出す）
- [x] `npm run check`（585件）と `npm run test:e2e`（83件）（実装検証のあと 596件・83件）

## フェーズ4：検証と記録
- [x] 実装検証（implementation-validator）と指摘への対応（[必須] 2件・[推奨] 6件・[提案] 5件。検証役が PGlite とビルド済みサイトのブラウザで確かめた。rowsRead の数え方は、LIMIT・Nested Loop・Memoize・Bitmap・Index Only Scan で実測と合っていた）
  - 必須1 棒が最初から最後の長さで出て、カウンターと一緒に伸びない（transition が効かない）→ 棒の長さをカウンターの値から出す
  - 必須2 compareChange が SELECT 以外の query も実行する（reset で戻るがガードがない）→ `isSelectQuery` で断る。問題データの形（`visual` の refine）でも止める
  - 推奨1 `kind: index` で query を省ける → refine で必須に。スキーマの単体テスト、問題データの検証 `checkVisuals`（正解SQLで読む行が減るか）を足した（checkVisuals は実装のあとにテストを流したので、失敗は見ていない）
  - 推奨2 小数の Actual Rows × loops → 丸める。推奨3 loops 0 を 1 にしていた → 0 のまま
  - 推奨4 判定のたびに比べるので次の判定が約2秒待つ → 間違いでも比べるのは学びになる（関係のない列のインデックスでは読む行が減らない）ので、今の形のまま仕様として機能設計書に書いた
  - 推奨5 読み上げの枠が結果と一緒に出る → 先に置いた `role="status"` に結果の一文を入れる（見た目は隠す）
  - 推奨6 テスト → Nested Loop（Memoize の下の Index Scan）・Index Only Scan の実物の fixture、小数・loops 0、SELECT 以外を断る、after で失敗（DROP TABLE）を足した
  - 提案 動きを減らす設定で最初の1フレームの0、遅くなったときの一言（「かえって長くなりました」）、実行計画を読めないときも ok: false で返す、を直した
  - 見送り：提案「before も2回流して温める」（傾向は変わらない）、「見本ごとに初期データを分ける」（見本を開くときに1回だけ約2秒）
- [x] 永続ドキュメントを直す（functional-design・repository-structure・product-requirements。実装検証のあと development-guidelines・architecture・glossary も）
- [x] `docs/review/20261112-index-race.md` を書き、`check-review-files.js` が通る
- [x] 振り返りを書く
- [x] コミットして main にマージ（本人の「上級まで作って」で決めた進め方）

## 振り返り

- **実装完了日**：2026-11-12
- **計画と違ったこと**：EXPLAIN ANALYZE の出力は、実物を fixture に保存してから単体テストを書くと、形の思い込み（Actual Rows が小数になる、Memoize がはさまる）を避けられた。最初は Hash Join しか保存しておらず、Nested Loop・Index Only Scan は実装検証のあとに足した
- **計画と違ったこと**：ブラウザの PGlite は短い実行時間を 0 と返す。Node と同じ数が出る前提で文言を作ると「0.000 ms」「?分の1」になる
- **学び**：CSS の transition は、最初から最後の値でマウントすると動かない。数と一緒に伸ばしたいなら、数から長さを出す
- **次に活かすこと**：実行計画の木（次の作業）は `parseExplain` の木をそのまま使う。loops 0 の節（実行されなかった）を見せる
