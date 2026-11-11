---
tags: [review, sql-typing, visualization, stepper, react, motion]
created: 2026-11-11
updated: 2026-11-11
---
# 📝 20261111-step-replay：見える化A（ステップ再生）

> - **対象**：ブランチ `feature/step-replay`（作業前のコミット `350fa57`）。まだコミットなし
> - **steering**：`.steering/20261111-step-replay/`
> - **見るべき箇所**（最大3つ）：
>   1. `src/core/stepper/index.js:252` 段階のSQLの作り方と、対応しない形を先に止めるところ。「間違った見える化を見せない」の要
>   2. `src/core/stepper/index.js:372` LIMIT の段階。元の ORDER BY と LIMIT で行の目印つきに実行し、並べた表の中で続いているかを確かめる
>   3. `src/ui/state/step-replay-machine.js:43` 進み方の決まり（印 → 変化 → 次へ、最後で止まる）
> - **判断してほしいこと**：1件
> - **検証していないこと**：4件

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 変更 | `docs/architecture.md` | `pgsql-ast-parser` は今は使っていない（句の範囲で切り貼りする）こと、中級で使う予定 |
| 変更 | `docs/functional-design.md` | 見本のページと `data-mark`、DISTINCT の組ごとの色、`ReplayDemoScreen` の行。Stepper：`mismatch`・`rowCountBefore`、作り方の表（ORDER BY・LIMIT）、切り貼りで作ること、対応する形、行の目印を末尾に、元のSQLと段階のSQLのエラーの分け方、消えた列・名前の変わった列の決め方。ステップ再生の動きの表（印 → 変化の長さ）、印と変化の場面、自動再生、操作（ボタンのフォーカス）、最後まで見た記録、入口、`StepTable` の行 |
| 変更 | `docs/glossary.md` | 「印の場面・変化の場面」「見本のページ」を足した |
| 変更 | `docs/repository-structure.md` | `src/core/stepper/` の中身（`index.js`・`select-list.js`）、`src/ui/state/` の `use-step-replay.js`・`step-replay-timing.js`・`step-replay-machine.js`、`StepPlayer`・`StepTable`・`ReplayDemoScreen`、テストのフォルダ（`tests/unit/ui/`・`tests/integration/stepper/`・`tests/e2e/visualization/`） |
| 追加 | `src/core/stepper/index.js` | `buildSteps(sql, runner)`：FROM・WHERE・SELECT・DISTINCT・ORDER BY・LIMIT の段階を、本物のSQLで作る。対応しない形（JOIN・GROUP BY・集計・INTO・OFFSET の外置き・FETCH・DISTINCT ON など）を先に unsupported に、最後の段階が元のSQLの結果と違えば mismatch に。コアから data を import しないよう、使う型をここで決めた |
| 追加 | `src/core/stepper/select-list.js` | `splitSelectList`：SELECT 句を括弧・文字列の外のカンマで項目に分け、元の列と別名、DISTINCT、まだ扱わない書き方（DISTINCT ON・SELECT ALL）を見分ける |
| 変更 | `src/data/progress-store.js` | `markStepReplayFinished`：ステップ再生を最後まで見たことを記録する |
| 変更 | `src/ui/App.jsx` | 再生の速さ（`settings.replaySpeed`）と `markReplayFinished` を PlayScreen に渡す。`/?demo`（と `speed`）を読んで見本のページを出す。もどるときは URL から `?demo` を消す |
| 変更 | `src/ui/components/PlayMode1.jsx` | クリアの結果に「ステップ再生を見る」ボタン。押すと結果の表の欄が StepPlayer に変わる（SQLを key にして作り直す）。ボタンにフォーカスがあるときの Enter は「もう一度」にしない |
| 変更 | `src/ui/components/PlayMode1.module.css` | 「ステップ再生を見る」ボタンの見た目 |
| 追加 | `src/ui/components/StepPlayer.jsx` | 段階を作り、SQLの句に実行順の番号を付けて今の句を光らせる。再生・一時停止・戻る・次へ・最初から（ボタンと → ← Space Home）。段階の一言の説明。作れない形は「この形のステップ再生はまだありません」 |
| 追加 | `src/ui/components/StepPlayer.module.css` | 番号付きのSQL、光る句、操作ボタン |
| 追加 | `src/ui/components/StepTable.jsx` | 1段階の表：印の場面（消える行は赤と打ち消し線、まとまる行は組ごとの色で残る行は太字・消える行は薄い打ち消し線、消える列は灰色）と変化の場面、行数の変化、AS の「元 → 新」。行の目印を key にして、並び替え・消える動きを Motion で。印に `data-mark` を付けて E2E で数えられるように |
| 追加 | `src/ui/components/StepTable.module.css` | 印の色（まとまる組の6色は tokens.css の色を借りる）、表 |
| 追加 | `src/ui/screens/ReplayDemoScreen.jsx` | ステップ再生の見本（`/?demo`）。WHERE・AS・DISTINCT・LIMIT・AND の5つのSQLを選んで見られる |
| 追加 | `src/ui/screens/ReplayDemoScreen.module.css` | 見本のページの見た目 |
| 変更 | `src/ui/screens/PlayScreen.jsx` | 再生の速さと `onReplayFinished` を PlayMode1 に渡す |
| 変更 | `src/ui/state/progress.js` | `commit` にまとめ、`markReplayFinished`（2回目からは保存し直さない）を足した |
| 追加 | `src/ui/state/step-replay-machine.js` | 進み方の reducer（next・back・first・toggle・markDone・advance） |
| 追加 | `src/ui/state/step-replay-timing.js` | 段階ごとの長さ（印 → 変化）と速さの掛け算、印が要る段階か。印の長さは本人の指摘で 1.5〜1.8秒（最初は 0.3〜0.4秒） |
| 変更 | `src/ui/state/typing-keys.js` | `isInteractiveTarget`：ボタン・入力欄にフォーカスがあるか |
| 追加 | `src/ui/state/use-step-replay.js` | reducer をタイマーと React につなぐ。最後の段階まで見たら onFinished を1回だけ |
| 追加 | `tests/e2e/visualization/step-replay-marks.spec.js` | 5件：見本のページで、WHERE の消える9行（そのあと21行）、SELECT の消える5列と「name → item」、DISTINCT のまとまって消える26行と残る4行、LIMIT の消える25行、入口へもどる |
| 追加 | `tests/e2e/visualization/step-replay.spec.js` | 4件：FROM → SELECT と進む・戻る、最後まで見た記録、ボタンにフォーカスして Enter、Enter でもう一度・Esc でもどる |
| 追加 | `tests/integration/stepper/beginner-steps.test.js` | 初級9問の形すべてで最後の段階が一致、各段階の変化（WHERE・SELECT・AS・DISTINCT・ORDER BY・LIMIT・OFFSET・別名）、間違った見える化を見せない形（同じ値の LIMIT OFFSET・ORDER BY 2・大文字の列・TRUE・同じ列2回・`*, name`・INTO）、作れない形 |
| 追加 | `tests/unit/core/select-list.test.js` | 項目の分け方、元の列と別名、DISTINCT・DISTINCT ON・ALL、`*`、文字列の中のカンマ |
| 変更 | `tests/unit/data/progress-store.test.js` | `markStepReplayFinished` |
| 追加 | `tests/unit/ui/step-replay-machine.test.js` | 自動再生（印 → 変化 → 次へ、最後で止まる）、手で動かす、toggle |
| 追加 | `tests/unit/ui/step-replay-timing.test.js` | 印が要る段階、長さ、速さ |
| 変更 | `tests/unit/ui/typing-keys.test.js` | `isInteractiveTarget` |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| モード1のクリアの結果 | 結果と表だけ | 「ステップ再生を見る（DBの中でどう動いたか）」ボタン。押すと表の欄がステップ再生になる |
| ステップ再生 | なかった | SQLの句に実行順の番号（① FROM ② SELECT …）。自動再生で1句ずつ光り、その時点の表に変わる。消える行は赤くなってから消える。最後で止まる。→ ← Space Home で操作 |
| 学習記録 | — | ステップ再生を最後まで見たら `stepReplayFinished: true` |
| 作れない形（JOIN・GROUP BY など） | — | 「この形のステップ再生はまだありません（理由）」 |
| 結果の画面で、ボタンにフォーカスして Enter | — | そのボタンが押される（「もう一度」にならない） |

## なぜ

- **`pgsql-ast-parser` を使わず、句の範囲で切り貼りした**：初級の単一テーブルなら句の文字をつなぎ直すだけで段階のSQLが作れる。構文木を経由すると、解析できない書き方や `toSql` で書き方が変わる心配が増える。正しさは毎回「最後の段階が元のSQLの結果と一致するか」で確かめる
- **対応しない形を先に止める**：実装検証で、ClauseSplitter が句として数えない語（LIMIT の外の OFFSET、FETCH）が直前の句の文字に混ざり、WHERE や ORDER BY の段階で行が減るのに、最後の表は一致して `ok: true` になる経路が見つかった。最後の照合だけでは「途中の段階のうそ」を止められないので、混ざる語を先に見つけて止める
- **LIMIT は元の ORDER BY と LIMIT を行の目印つきで実行する**：最初は「元の結果と同じ値の並びが最初に現れる位置」で探していたが、同じ値が続くと OFFSET を無視して別の行に印を付けていた（値は同じなので照合をすり抜ける）
- **段階のSQLだけの失敗は unsupported**：元のSQLが成功しているのに段階のSQLが失敗するのは、学習者が書いていないSQLの失敗。PostgreSQL のメッセージを見せると、学習者が間違えたように見える
- **消えた列は「元の列」から決める**：結果の列名との一致で決めると、`SELECT id AS name` で元の name 列が残ったように見える、`SELECT TRUE flag` で「TRUE → flag」と出る、などが起きた
- **行の目印を末尾に**：先頭に足すと `ORDER BY 2` が1つずれる（今回は mismatch で止まっていたが、データしだいですり抜ける）
- **進み方を reducer に分けた**：React の部品を描くテストの道具を足さずに、「印 → 変化 → 次へ」「最後で止まる」「続けて押しても1つずつ進む」を単体テストするため。最初は最後で止まるのを `setTimeout(0)` で行っていたが、reducer の中で決める形にした
- **ボタンにフォーカスがあるときの Enter・Space はボタンに任せる**：実装検証で、Tab で「ステップ再生を見る」に移って Enter を押すと「もう一度」になる（キーボードだけではボタンを押せない）と見つかった
- **見本のページ（`/?demo`）を足した**：1問目（`SELECT * FROM products`）には消える行・まとまる行がなく、印の見た目を画面で一度も見られていなかった（本人も気にしていた）。2〜9問目を待たずに、初級の形のSQLで目と E2E で確かめるため。入口からはリンクしない
- **DISTINCT を組ごとの色にした**：見本のページで見ると、最初の作り（まとまる30行がすべて同じ黄色）では「どの行とどの行がまとまるか」が見分けられず、暗い背景では黄色がほとんど見えなかった。機能設計書の「同じ値の行が同じ色になり」に合わせ、組ごとに6色を使い分け、残る行を太字に、消える行を薄い打ち消し線にした
- **印の場面を長くした**：本人が見本のページで見て「赤く表示されてから消えるまでが早すぎる」と指摘した。機能設計書の最初の長さ（0.3〜0.4秒）では、どの行が消えるのかを読む前に消える。WHERE・DISTINCT は1.8秒、SELECT・LIMIT は1.5秒にした（速さ1倍のとき）
- **コアから data の型を import しない**：ESLint は JSDoc の `import()` を見ないが、「SqlRunner は引数で受け取る」方針に合わせ、Stepper の中で使う形（`run` と結果の形）だけを決めた

## 検証

| やったこと | 結果 |
|---|---|
| Stepper・SELECT の項目はテストを先に書いた | モジュールがなくて失敗することを確かめてから実装し、31件が一度で通った |
| `npm run check` | 通った（287件。単体192件・統合95件。`src/core/` の行カバレッジ 97.8%） |
| `npm run test:e2e` | 通った（18件。ステップ再生が4件、印の数が5件） |
| 開発サーバーで目で確かめた（1280px、ダーク、1問目） | 実行順の番号（② SELECT ① FROM）、今の句が光る、自動再生が最後で止まる、← で戻る、`stepReplayFinished` が保存される |
| 見本のページで印を目で確かめた（1280px、ダーク、速さ0.05倍） | WHERE：消える行が赤く打ち消し線（9行）。SELECT：消える列が灰色（6列）。DISTINCT：最初は30行すべて同じ黄色で見分けにくかった → 組ごとの色に直し、kitchen が青・stationery が緑、残る行が太字で見分けられることを確かめた |
| 実装検証（implementation-validator） | [必須] 3件・[推奨] 7件・[提案] 5件。対応と見送ったものの理由は `.steering/20261111-step-replay/tasklist.md` |
| `node scripts/check-review-files.js docs/review/20261111-step-replay.md 350fa57` | OK |

**検証していないこと**：
- **印のライトモードでの見た目と、本人の目での確認**：見本のページで、ダークモードでだけ私が見た。確かめ方：`npm run dev` で `/?demo&speed=0.2` を開き、ライト・ダークを切り替える
- **問題を遊んだあとのステップ再生での印**：WHERE などを含む問題がまだないので、印は見本のページでだけ確かめた（初級2〜9問目の作業で、問題からの流れの E2E を足す）
- **速さ 0.5倍・2倍の実際の動き**：長さの計算は単体テストだけ。速さを変える設定画面がまだない
- **同じ値が並ぶ ORDER BY と LIMIT**（`ORDER BY category LIMIT 7` など）：元のSQLと段階のSQLで同じ値の行の並びが違うと mismatch になる（間違った表は出さないが、ステップ再生は見られない）。初級の初期データは値段と名前が重ならないので、初級の問題では起きない
- **「動きを減らす」設定・スマホ幅**

## 判断してほしいこと

- **コミット**：まだしていない。このブランチでコミットし、`main` にマージしてよいか

<details>
<summary>捨てた案・補足</summary>

- **`pgsql-ast-parser` で組み立て直す**：上の「なぜ」のとおり。中級の JOIN・GROUP BY で、句の中身（結合の条件・グループの式）を扱うときに使う
- **ステップ再生を別の画面にする**：表の欄を差し替える方が、打ち終えた直後の流れ（打つ → 表 → どう動いたか）が途切れない
- **フックを @testing-library/react でテストする**：依存が増える。進み方を reducer に分けて単体テストし、タイマーとのつながりは E2E で確かめた
- **同じ値が並ぶ並び替えにも対応する**（段階のSQLに ctid の並びを足す）：元のSQLと別の行が選ばれることがあり、照合で止まるか、うその表になる。今は mismatch で安全に止める
- 長い文字列のセルを切る表示は、全体の見た目の作業で決める

</details>
