---
tags: [review, sql-typing, home, story, navigation]
created: 2026-11-12
updated: 2026-11-12
---
# 📝 20261112-story-home：ストーリーと一覧画面

> - **対象**：ブランチ `feature/story-home`（作業前のコミット `555eaee`）。まだコミットなし
> - **steering**：`.steering/20261112-story-home/`
> - **見るべき箇所**（最大3つ）：
>   1. `src/data/progress-store.js:223` 進む条件。ターニングポイントは問題の kind で決まるので、ID の集合を受け取る
>   2. `src/ui/state/navigation.js:33` 画面の切り替え（一覧 → モード選択 → 会話 → 遊ぶ、読み返し、狭い画面でのもどり）
>   3. `src/ui/App.jsx:60` 画面ごとの出し分けと、次の問題・ターニングポイントの渡し方
> - **判断してほしいこと**：1件
> - **検証していないこと**：4件

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 変更 | `docs/functional-design.md` | ProgressStore の `isUnlocked`（ターニングポイントの ID を受け取る）と `nextProblemId`。コンポーネントの表に `App` の中身、`HomeScreen`・`ModeSelect`・`StoryScreen`・`StoryPanel`・`StoryLines`・`AfterStory`。画面遷移図の下に、クリアの結果のキー（Enter・J で次の問題へ、R でもう一度。本人の決定）、Esc、会話のあいだに狭くなったとき、一覧の読み上げの名前。モード3・4の帯の下の説明。単体テスト・E2E の方針 |
| 変更 | `docs/glossary.md` | 「開く」に、前がターニングポイントならモード3・4だけ、を足した |
| 変更 | `docs/repository-structure.md` | `typing-keys.js` の `classifyResultKey`、`screens/` の中身、`state/` の `navigation.js`・`use-problems.js`・`use-narrow-screen.js`・`best-text.js`、会話の部品、`tests/unit/ui/` の2つ、`tests/e2e/` の `progression/home-story.spec.js`・`device/narrow-screen.spec.js`・`helpers/open-play.js` |
| 変更 | `src/data/progress-store.js` | `nextProblemId`（次の問題。章の終わりなら次の章の最初）、`isUnlocked`（最初の章の最初はいつも開く。前の問題がターニングポイントならモード3・4、それ以外はどれかのモードのクリアで開く） |
| 変更 | `src/ui/App.jsx` | 仮の入口を消し、navigation の画面ごとに一覧・モード選択・会話・遊ぶ画面を出す。全章の問題を `useProblems` で1回読み、ターニングポイントの ID・題名を渡す。会話を終えたとき狭ければモード選択へ |
| 追加 | `src/ui/components/AfterStory.jsx` | クリアの結果の下の、反応の会話・「次の問題へ（Enter / J）」（ないとき・開いていないときは押せない）・「もう一度（R）」・「一覧へ（Esc）」・添え書き。結果を出しているときのキーはここで受ける（`classifyResultKey`） |
| 追加 | `src/ui/components/AfterStory.module.css` | クリア後の会話とボタンの見た目 |
| 変更 | `src/ui/components/PlayMode12.jsx` | `afterClear` を受け取り、クリアの結果の下に出す。結果の「Enter でもう一度」（と `onRestart`）を消した（AfterStory が R で受ける） |
| 変更 | `src/ui/components/PlayMode34.jsx` | `afterClear` を受け取り、クリアの結果の下に出す。依頼の会話の描き方を `StoryLines` に。クリアのあとの「Enter でもう一度」（と `onRestart`）を消した |
| 変更 | `src/ui/components/PlayMode34.module.css` | 会話の行の CSS を消した（`StoryLines` に移った）。依頼の欄のコメントを今の役目に |
| 変更 | `src/ui/components/TypingResult.jsx` | 結果の下のキーの案内（「Enter：もう一度 ／ Esc：もどる」）を消した（AfterStory のボタンにキーを書いた） |
| 変更 | `src/ui/components/TypingResult.module.css` | キーの案内の CSS（`.keys`）を消した |
| 変更 | `src/ui/components/WriteResult.jsx` | キーの案内を消した。見出しにフォーカスを移す理由のコメントを、新しいキーに |
| 変更 | `src/ui/components/WriteResult.module.css` | キーの案内の CSS（`.keys`）を消した |
| 追加 | `src/ui/components/StoryLines.jsx` | 会話の行を、話している人の名前（登場人物の色）と並べる |
| 追加 | `src/ui/components/StoryLines.module.css` | 行と名前の見た目 |
| 追加 | `src/ui/components/StoryPanel.jsx` | 会話を1行ずつ足していく。Enter（ボタンにフォーカスがないとき）・行のクリック（最後の行では進まない）・ボタンで次へ、スキップ、最後の行の次で onDone |
| 追加 | `src/ui/components/StoryPanel.module.css` | 会話の欄とボタンの見た目 |
| 追加 | `src/ui/screens/HomeScreen.jsx` | 章と問題の一覧。番号・題名・ターニングポイントの印・星4つ、開いていない問題は 🔒 で選べない、読み上げ用の名前。データベースの状態、学習記録が壊れていたときの知らせ。問題を読み終えるまでは一覧を出さない |
| 追加 | `src/ui/screens/HomeScreen.module.css` | 一覧の見た目 |
| 追加 | `src/ui/screens/ModeSelect.jsx` | 4つのモードのボタン（星・最高記録）、1〜4のキー、Esc で一覧、ターニングポイントの説明。準備中・起動の失敗・狭い画面では選べない。「依頼の会話を読む」 |
| 追加 | `src/ui/screens/ModeSelect.module.css` | モード選択の見た目 |
| 変更 | `src/ui/screens/PlayScreen.jsx` | `next`・`turningPoint`・`onNext` を受け取り、`AfterStory` を作って PlayMode12・PlayMode34 に渡す（もう一度は AfterStory に渡し、PlayMode12・PlayMode34 には渡さない）。ターニングポイントの添え書きは、モード1・2でクリアし次の章がまだ開いていないときだけ |
| 追加 | `src/ui/screens/StoryScreen.jsx` | 依頼の会話の画面（遊ぶ前と読み返し）。問題を読み、StoryPanel を出す。Esc で一覧 |
| 追加 | `src/ui/screens/StoryScreen.module.css` | 会話の画面の見た目 |
| 追加 | `src/ui/state/best-text.js` | モードの名前 `MODE_LABELS` と、最高記録の文 `formatBest` |
| 追加 | `src/ui/state/navigation.js` | 画面の切り替えの reducer（`openProblem`・`chooseMode`・`readStory`・`storyDone`・`modeSelect`・`home`・`next`） |
| 追加 | `src/ui/state/use-narrow-screen.js` | 画面の幅が 768px 未満か（幅が変わったら描き直す） |
| 変更 | `src/ui/state/typing-keys.js` | `classifyResultKey`（クリアの結果のキー：Enter・J は次の問題へ、R はもう一度。修飾キーつき・長押し・変換中・入力欄の中は何もしない、ボタンにフォーカスがあるときの Enter はボタンに任せる） |
| 追加 | `src/ui/state/use-problems.js` | 全章の問題を1回読み、ターニングポイントの ID の集合を返す |
| 変更 | `src/ui/styles/global.css` | 仮の入口の CSS（`.app-title` など）を消した |
| 追加 | `tests/e2e/device/narrow-screen.spec.js` | 2件：幅375pxでは選べず知らせが出て、キーでも選べず、会話は読める。会話のあいだに狭くなったら遊ぶ画面へ進まない |
| 追加 | `tests/e2e/helpers/open-play.js` | 一覧から1問目のモードを選び、会話を飛ばして遊ぶ画面を開く `openPlay`、`openModeSelect`、`homeProblem` |
| 変更 | `tests/e2e/play-modes/mode1-trace.spec.js` | 入口を `openPlay` に。結果の「Enter でもう一度」を R に（次の問題がないときの Enter は何もしない）。最高記録は一覧の星とモード選択で確かめる。壊れた学習記録のテストの待ち方を一覧の問題に |
| 変更 | `tests/e2e/play-modes/mode2-choice.spec.js` | 入口を `openPlay` に。結果の「Enter でもう一度」を R に。最高記録はモード選択で確かめる |
| 変更 | `tests/e2e/play-modes/mode3-4-write.spec.js` | 入口を `openPlay` に。クリアのあとの「Enter でもう一度」を R に。記録は一覧の星とモード選択で、Esc のあとは一覧の問題で確かめる |
| 追加 | `tests/e2e/progression/home-story.spec.js` | 6件：一覧と星、キーの1で選んで会話を Enter で送って遊ぶ、クリック・スキップ・Esc、読み返し、クリア後の会話（次の問題はまだなく Enter・J は何もしない・R でもう一度・一覧で星）、モード選択の Esc |
| 変更 | `tests/e2e/visualization/step-replay-marks.spec.js` | 見本のページから入口へもどったときの確かめを、一覧の問題に |
| 変更 | `tests/e2e/visualization/step-replay.spec.js` | 入口を `openPlay` に。結果の「Enter でもう一度」を R に。Esc のあとの確かめを一覧の問題に |
| 変更 | `tests/unit/data/progress-store.test.js` | `isUnlocked`（最初の問題、前のクリア、クリアしなかった回、ターニングポイントはモード3・4だけ、ターニングポイントのない章、知らない問題）と `nextProblemId` |
| 変更 | `tests/unit/ui/typing-keys.test.js` | `classifyResultKey`（Enter・J・R、修飾キー・長押し・変換中、ボタンにフォーカス、入力欄の中） |
| 追加 | `tests/unit/ui/best-text.test.js` | モードの名前、記録なし、モード1・2、モード3・4の文 |
| 追加 | `tests/unit/ui/navigation.test.js` | 一覧からの流れ、読み返し、`modeSelect`、`home`、`next`、意味のない動き |
| 変更 | `vitest.config.js` | 統合テストの `hookTimeout` を `testTimeout` と同じ30秒に（beforeAll で PGlite を起動するため） |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| ページを開いたとき | 仮の入口（1問目のボタンが4つ） | 章と問題の一覧（星4つ・開いていない問題は選べない） |
| 問題を選んだあと | すぐ遊ぶ画面 | モード選択（星・最高記録・1〜4のキー）→ 依頼の会話を1行ずつ（スキップできる）→ 遊ぶ画面 |
| クリアのあと | 結果だけ。Enter でもう一度、Esc で入口 | 結果の下に反応の会話と「次の問題へ（Enter / J）」「もう一度（R）」「一覧へ（Esc）」 |
| 遊ぶ画面の Esc | 入口へ | 一覧へ |
| 最高記録 | 入口に1問目のモードごと | モード選択に、一覧には星 |
| 幅768px未満 | 遊べた | モード選択で選べず「PCで遊んでください」。会話は読める |
| `npm run check` の統合テスト | beforeAll は10秒まで | 30秒まで |

## なぜ

- **ターニングポイントを問題の kind で決める**：最初は「章の最後の問題」で決めたが、今は1問しかないので1問目にターニングポイントの印が出た。問題データの決まり（`cross-checks.js`）ではターニングポイントは kind で決まり、章の最後に1問まで（作っている途中の章にはない）。決まりを書いた場所と同じ言葉で実装した。そのため全章の問題を App で1回読み、読み終えるまで一覧を出さない（進む条件が決まらないため）
- **結果のキー：Enter・J で次の問題へ、R でもう一度**：最初は今までの形（Enter でもう一度、次の問題は N）で作り、本人に聞いた。本人の決定で、機能設計書の「次へ＝Enter」に合わせて Enter・J を次の問題へ、R をもう一度にした（2026-11-12）。キーは AfterStory 1か所で受け、マウスでも押せるように「もう一度（R）」のボタンを足した。Ctrl+R（読み込み直し）・実行の Ctrl+Enter の続け押しは数えない
- **クリア後の会話を結果の下に出す**：別の画面にすると、結果・ステップ再生と会話を行き来することになる。結果の続きとして読める
- **画面の切り替えを reducer にした**：React の部品を描かずに、流れ（読み返し・狭い画面でのもどり・意味のない動き）を単体テストできる。ステップ再生・書く画面と同じやり方
- **会話のあいだに狭くなったらモード選択へもどす**：実装検証で、広い画面でモードを選んだあと幅を狭めると、狭いまま遊ぶ画面に入れると指摘された
- **統合テストの hookTimeout を延ばした**：`npm run check` で、PGlite を起動する beforeAll が既定の10秒を超えて3ファイル落ちた。1つだけなら4秒で通り、テストを流す前から PC の CPU が77%使われていた（ほかのアプリ）。テストそのものと同じ30秒にそろえた
- **E2E の入口を `open-play.js` にまとめた**：今までの E2E は仮の入口のボタンから始めていた。一覧からの開き方が変わっても1か所を直せばよい

## 検証

| やったこと | 結果 |
|---|---|
| 進む条件・navigation はテストを先に書いた | モジュール・関数がなくて失敗することを確かめてから実装した。`best-text.js` はテストと実装を一緒に書いた |
| `npm run check` | 通った（429件。`src/core/` の行カバレッジ 98.2%。今回 `src/core/` は変えていない）。hookTimeout を延ばす前は、上のとおり3ファイルが落ちた |
| `npm run test:e2e` | 通った（41件。結果のキーを変えたあとにも流した。一覧と会話が6件、狭い画面が2件） |
| 開発サーバーで目で確かめた（1280px、ダーク） | 一覧（1問目にターニングポイントの印が出ていた → 直した）、モード選択（星・最高記録）、キーの3でモード3、会話を Enter で1行ずつ（2/5） |
| 実装検証（implementation-validator） | [必須] 0件・[推奨] 5件・[提案] 5件。進む条件は node で、キーのぶつかり・狭い画面・クリア後のフォーカスは Playwright で実際に試された。対応と見送りの理由は `.steering/20261112-story-home/tasklist.md` |
| `node scripts/check-review-files.js docs/review/20261112-story-home.md 555eaee` | OK |

**検証していないこと**：
- **「次の問題へ」と Enter・J で次の問題に進むこと**：初級は今1問だけなので、次の問題がない。`isUnlocked`・`nextProblemId` の単体テストだけ。初級2〜9問目を足す作業で E2E を足す
- **ターニングポイントの流れ**（モード1・2でクリアしても次の章が開かない、添え書き）：ターニングポイントの問題がまだない。単体テストだけ
- **データベースの起動に失敗したときのモード選択、問題の読み込みに失敗したときの一覧**：失敗させる仕組みがないので、画面では見ていない
- **ライトモードの見た目と、直したあとの会話・モード選択の目での確認**：ダークで、実装検証の直しの前に見た（直したあとは、一覧の1問目からターニングポイントの印が消えたことだけ見た）

## 判断してほしいこと

- **コミット**：まだしていない。このブランチでコミットし、`main` にマージしてよいか

<details>
<summary>捨てた案・補足</summary>

- **ターニングポイント＝章の最後の問題**：上の「なぜ」のとおり、作っている途中の章で間違える
- **`isTurningPoint` を `progress-store.js` に置く**：kind を見るには問題を読む必要があり、データ層の進む条件は「ID の集合を受け取る」だけにした
- **クリア後の会話を別の画面（StoryAfter）にする**：画面遷移図の形だが、結果と行き来することになる
- **遊んでいる途中に幅が狭くなったら止める**：打っている途中で画面が変わると記録が中途半端になる。遊ぶ前（会話を終えたとき）だけ止める
- **一覧に最高記録の数字を並べる**：1問に4モード分は多い。一覧は星、数字はモード選択で見る

</details>
