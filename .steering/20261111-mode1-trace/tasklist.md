# タスクリスト

## 🚨 タスク完全完了の原則

- 全タスクが `[x]` になるまで作業を続ける
- スキップは技術的な理由があるときだけ。理由を書く

## フェーズ1：コアレイヤー（テストを先に）
- [x] `sql-text.js` のテスト → 実装
- [x] `clause-splitter.js` のテスト → 実装
- [x] `typing-engine.js` のテスト → 実装
- [x] `scoring.js` のテスト → 実装（4つともテストを先に書き、モジュールがなくて失敗することを確かめてから実装。48件）
- [x] `@vitest/coverage-v8` を入れ、`src/core/` の行カバレッジ 90% を `npm run check` で確かめる（今は100%）

## フェーズ2：データ
- [x] `progress-store.js` のテスト → 実装（`tests/helpers/memory-storage.js`。12件）
- [x] `problem-loader.js`
- [x] 問題 `beginner-01` と、用語 `SELECT`・`FROM`。`chapters.yaml` に足す
- [x] 問題データの検証に「句の途中までのSQLを実行しても例外にならない」を足す（`checkClausePrefixes`）

## フェーズ3：画面
- [x] `use-typing-session.js`・`progress.js`（localStorage に触るのは `progress-store.js` の `getBrowserStorage` だけにした）
- [x] `TypingArea`・`ResultTable`・`TypingResult`・`PlayMode1`・`PlayScreen`
- [x] `App.jsx` の仮の入口
- [x] 見た目を `npm run dev` で確かめる（ライト・ダーク。1280px。ミスで止まる・表が30行・クリアの結果。コンソールのエラーなし）。そのために `.claude/launch.json` を足した

## フェーズ4：確かめる
- [x] `tests/e2e/play-modes/mode1-trace.spec.js`（6件：クリアと30行・ミスで止まる・Shift/Backspace/Enter・記録が残る・もう一度・壊れた記録）
- [x] `npm run check`・`npm run test:e2e` が通る（207件・E2E 8件）

## フェーズ5：検証と記録
- [x] 実装検証（implementation-validator）と指摘への対応
  - [x] [必須] 1：文字列・コメントの中の改行やタブで先に進めなくなる → `untypableSlots`（core）と、問題データの検証 `checkTypable`。ガイドラインに「打てるSQLにする」
  - [x] [必須] 2：打ちながら実行するかの判定が画面と検証で別 → `canRunWhileTyping`（core。SELECT ... INTO も false）を両方から使う
  - [x] [推奨] 3：長押しの繰り返しを数えない（打つところ・結果の Enter）
  - [x] [推奨] 4：日本語入力がオンなら知らせる。変換中の Esc では抜けない
  - [x] [推奨] 5：問題が変わったら作り直す（PlayScreen と PlayMode1 の key に問題ID）
  - [x] [推奨] 6・7：「最新の1つだけ実行」とキーの判定を `src/ui/state/typing-keys.js` に分け、単体テスト（作り直したときに予約が止まらない）。E2E に日本語入力と長押し
  - [x] [推奨] 8：ドキュメント（pressKey の引数、同期の load*、check のカバレッジ）
  - [x] [提案] 苦手は割合ではなく回数で見せる（1回に何度も間違えると100%を超えるため）、最高記録はランクを先に比べる、AltGr を通す、表の動きを OS の設定に合わせる、`IS DISTINCT FROM` の注記
  - [x] ~~[提案] フックの React での単体テスト（@testing-library/react）、壊れた記録の退避キーの上限、useProgress の初期化の副作用、weakPointKey のキャッシュ、幅768px未満の表示~~（理由：フックの中の判定は typing-keys.js に分けて単体テストしたので、React の部品を描くテストの道具は今は足さない。退避キーの掃除は設定画面の「学習記録を消す」（P1）で一緒にする。初期化は React が1回目の結果を使うので今は壊れない。キャッシュは SQL が短く効果が小さい。幅768px未満は一覧画面の作業で入口と一緒に作る）
- [x] 永続ドキュメントを直す（functional-design：TypingEngine・Scoring・ProgressStore・ProblemLoader。architecture：coverage。repository-structure：ui/state・helpers）
- [x] `docs/review/20261111-mode1-trace.md` を書き、`check-review-files.js` が通る（43ファイル）
- [x] 振り返りを書く

## 実装後の振り返り

**実装完了日**：2026-11-11

**計画と実績の差分**：
- 計画になかったもの：`typing-keys.js`（キーの判定と実行の間引きを React から分けた）、`untypableSlots`・`checkTypable`、`canRunWhileTyping`、日本語入力の知らせ、`.claude/launch.json`
- 計画から変えたもの：最高記録はランクを先に比べる、苦手は回数で見せる、`load*` の一部を同期に
- やらなかったもの：一覧画面・会話・幅768px未満の表示（スコープ外のまま）

**学んだこと**：
- テストを先に書くと、コアの4つは一度で通った。決まり（決定13）を先にテストの言葉にしたのが効いた
- 「同じ判定を2か所に書く」は必ずずれる（正規表現とClauseSplitterで、先頭のコメントの扱いが違った）。判定は1つの関数にして両方から呼ぶ
- React のフックの中の、競合しやすいところ（予約・作り直し・キーの判定）は、React に依存しない小さな部品に分けると、道具を足さずにテストできる
- ブラウザを動かす道具の `type` は keydown を出さない。`shift+8` は `*` にならない。画面のテストは Playwright（`keyboard.type`）の方が確実

**本人が打ってみたあとの変更**：入力エリアを画面の真ん中に大きく（2.4rem）、結果の表はそのすぐ下に横いっぱいに（2列 → 1列）。機能設計書の UI設計も直した

**次回への改善提案**：
- 本人に人の速さで打ってもらい、ランクの基準・ミスの見せ方・表の動きを見直す
- 次の作業「見える化A（ステップ再生）」で、ClauseSplitter と ResultTable をそのまま使う
