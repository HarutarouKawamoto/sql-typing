---
tags: [review, sql-typing, design, ui]
created: 2026-11-13
updated: 2026-11-13
---
# 📝 20261113-ledger-design：見た目の作り直し（事務所の伝票と判子）

> - **対象**：ブランチ `claude/changes`（作業前のコミット `96fee8b`）。ブランチ名はダイアログで本人が選んだもの。前の同じ名前のブランチはマージ済みだったので、`main` の位置から作り直した
> - **steering**：なし（`/add-feature` ではなく、本人の「frontend-design を使って、UI のデザインを改良して AI っぽさをなくして」での作業。方針はチャットで見せて承認をもらった）
> - **見るべき箇所**（最大3つ）：
>   1. `src/ui/styles/tokens.css` 色・書体の変数（役目ごとに分けた）
>   2. `src/ui/screens/HomeScreen.jsx`・`HomeScreen.module.css` 一覧を依頼の綴りと判子に
>   3. `src/ui/components/Stamp.jsx` 判子と、押す動き
> - **判断してほしいこと**：1件（スキルのファイルは、本人の判断で `.gitignore` に足した）
> - **検証していないこと**：3件

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 変更 | `package.json` | `@fontsource/biz-udpgothic`・`@fontsource/biz-udgothic`・`@fontsource/ibm-plex-mono`（書体の同梱） |
| 変更 | `package-lock.json` | 上の3つを入れた結果 |
| 変更 | `src/main.jsx` | 書体を読み込む（画面 BIZ UDPゴシック 400・700、SQL の日本語 BIZ UDゴシック 400、SQL の英数字 IBM Plex Mono 400・600） |
| 変更 | `src/ui/styles/tokens.css` | 色を作り直した（帳簿の紙・伝票・紺のインク・罫線・朱肉・蛍光ペン）。役目ごとの変数 `--color-rule-strong`・`--color-marker`・`--color-stamp`・`--color-primary`・`--color-on-primary`・`--color-focus` を足した。ダークは「夜の事務所」。書体の変数、`--radius` を 0.15rem に |
| 変更 | `src/ui/styles/global.css` | チェック・ラジオの色を紺（`accent-color`） |
| 追加 | `src/ui/components/Stamp.jsx` | クリアの判子（朱の丸に「済」、モードごとに決まった傾き、`pressed` で1回押す動き） |
| 追加 | `src/ui/components/Stamp.module.css` | 判子の形・大きさ・押す動き（動きを減らす設定では動かさない） |
| 変更 | `src/ui/screens/HomeScreen.jsx` | 一覧を依頼の綴りに（見出しの行・依頼人の欄・承認欄のます・判子）。🔒 の絵文字をやめた。`data-testid`（`problem-…`・`star-…`）と読み上げの名前はそのまま |
| 変更 | `src/ui/screens/HomeScreen.module.css` | 題字（等幅をやめて太字）と締めの二重線、綴りの罫線の表、蛍光ペンの触った行、ターニングポイントの角印、承認欄のます |
| 変更 | `src/ui/screens/ModeSelect.jsx` | 星（★ クリア・☆）を判子に。読み上げ用に「クリア」の文字を残す |
| 変更 | `src/ui/screens/ModeSelect.module.css` | 見出しを左寄せと二重線に、モードの行を罫線の表に、承認欄のます、ターニングポイントの文を朱に、注意の枠を紺に |
| 変更 | `src/ui/screens/StoryScreen.module.css` | 見出しを左寄せと二重線に |
| 変更 | `src/ui/screens/SettingsScreen.module.css` | 見出しを左寄せと二重線に、フォーカスの輪を `--color-focus` に |
| 変更 | `src/ui/screens/DictionaryScreen.module.css` | 見出しを左寄せと二重線に、フォーカスの輪を `--color-focus` に |
| 変更 | `src/ui/screens/ReplayDemoScreen.module.css` | 選んでいる見本の塗りを蛍光ペンに、フォーカスの輪を `--color-focus` に |
| 変更 | `src/ui/components/PlayMode12.jsx` | 上の帯（時間・速さ・正確さ）を中黒でつながず、欄に分けた（欄の名前と値の間の空白は残す。E2E の文字のため）。結果の部品に `mode` を渡す |
| 変更 | `src/ui/components/PlayMode12.module.css` | 上の帯の欄（罫線で区切る）、モードのラベルを紺に、ステップ再生のボタンを紺の塗りに |
| 変更 | `src/ui/components/PlayMode34.jsx` | 上の帯（時間・実行・ヒント）を欄に分けた、テーブルの列の名前を SQL の書体で、結果の部品に `mode` を渡す |
| 変更 | `src/ui/components/PlayMode34.module.css` | 上の帯の欄、列の名前の書体、モードのラベル・確かめの枠を紺に、実行・ステップ再生のボタンを紺の塗りに |
| 変更 | `src/ui/components/WriteResult.jsx` | 右上に、このモードの判子を押す |
| 変更 | `src/ui/components/WriteResult.module.css` | 枠を罫線に、見出しを紺に、判子の位置 |
| 変更 | `src/ui/components/TypingResult.jsx` | 右上に、このモードの判子を押す |
| 変更 | `src/ui/components/TypingResult.module.css` | 枠を罫線に、見出しを紺に、判子の位置、ランクを朱に |
| 変更 | `src/ui/components/AfterStory.module.css` | 「次の問題へ」を紺の塗りに、メモの文字を紺に |
| 変更 | `src/ui/components/StoryPanel.module.css` | 「次へ」を紺の塗りに、フォーカスの輪を `--color-focus` に |
| 変更 | `src/ui/components/HintPanel.module.css` | ヒントの枠・文字を罫線と紺に、フォーカスの輪を `--color-focus` に |
| 変更 | `src/ui/components/SqlEditor.module.css` | 書く欄のフォーカスの枠を紺に |
| 変更 | `src/ui/components/TypingArea.module.css` | 今打つ文字・空欄の塗りを蛍光ペンに |
| 変更 | `src/ui/components/StepPlayer.module.css` | 実行中の句の塗りを蛍光ペンに、フォーカスの輪を `--color-focus` に |
| 変更 | `src/ui/components/SchemaMap.module.css` | NEW の印を蛍光ペンの塗りと紺の文字に、PK の印を薄い紺に |
| 変更 | `src/ui/components/SchemaMapPanel.module.css` | フォーカスの輪を `--color-focus` に |
| 変更 | `docs/functional-design.md` | 「見た目の方針」の節、カラーコーディングを変数つきで作り直した、HomeScreen・ModeSelect・WriteResult の行、一覧の読み上げ |
| 変更 | `docs/architecture.md` | 依存の表に書体のパッケージ |
| 変更 | `docs/glossary.md` | 星は画面では判子として見せる |
| 変更 | `docs/product-requirements.md` | クリア状況は画面では判子 |
| 変更 | `docs/repository-structure.md` | `Stamp.jsx`、`tokens.css` の説明 |
| 変更 | `.gitignore` | `npx skills add` で入れたスキル（`.agents/`・`.claude/skills/`・`skills-lock.json`）をリポジトリに入れない（本人の判断） |
| 追加 | `docs/review/20261113-ledger-design.md` | このファイル |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| 全体 | 灰色と青、黄土色のボタン、OS の書体 | 帳簿の紙・紺のインク・罫線、紺のボタン、BIZ UDPゴシックと IBM Plex Mono（同梱） |
| 一覧 | 同じ角丸の箱が並ぶ、★☆、🔒 | 罫線の依頼の綴り（依頼人・承認欄）、朱の判子、ターニングポイントの角印 |
| モード選択・会話・設定・用語辞典 | 見出しが中央寄せ | 左寄せと締めの二重線 |
| 遊ぶ画面の上の帯 | `0.8秒 ・ 2577 文字/分 ・ 正確さ 100%` | 罫線で区切った欄 |
| クリアの結果 | 緑の見出し | 右上に判子を押す（1回だけ動く） |

## なぜ

- **事務所の伝票と判子**：題材がお店の事務所の新人データ担当なので、その世界の道具（帳簿・伝票・判子）から見た目を決めた。frontend-design スキルの「生成っぽい特徴」（同じ角丸の箱、中黒でつないだ情報、等幅の題字、題材と関係のない色）を避けた
- **目立たせるのは判子だけ**：ほかは罫線と書体で静かにする。動くのも判子を押す瞬間だけ
- **黄土色を役目で分けた**：フォーカスの輪・主なボタン・今どこか・ラベルに同じ黄土色を使っていて、何が大事かが色から読めなかった
- **SQL の書体を途中で変えた**：BIZ UDゴシックの英字は幅が狭く、小さい文字で `_` がほとんど見えなかった（撮って見直して気づいた）
- **判子の朱と打ち間違いの赤**：朱は橙寄り、打ち間違いは深紅にして分け、形（丸い判子と文字の色）でも見分けられるようにした（方針を見せたとき、本人がこのまま進めると決めた）

## 検証

| やったこと | 結果 |
|---|---|
| 撮って見直した（Playwright。ライト・ダーク） | 一覧・モード選択（判子あり）・会話・書く画面のクリア・なぞり書きの途中とクリア・設定・用語辞典。見直して、SQL の書体・列の名前の書体・「次の問題へ」の色・設定と用語辞典の見出し・チェックの色を直した |
| `npm run check` | 通った（656件） |
| `npm run test:e2e` | 通った（98件） |
| `node scripts/check-review-files.js docs/review/20261113-ledger-design.md 96fee8b` | OK |

**検証していないこと**：
- **すべての画面を撮って見ること**：ステップ再生・JOIN の色分け・DBの地図・見える化（インデックス・実行計画・タイムライン・予想クイズ）は、色の変数が変わっただけで、撮って見直していない
- **幅375pxの画面**：一覧の綴り（4列）が狭い画面でどう見えるかは撮っていない（遊ぶ画面は375pxでは遊べない作り）
- **書体の読み込みの重さ**：同梱した書体のファイルの大きさと、初めて開くときの速さは測っていない

## 判断してほしいこと

- **一覧の幅の狭い画面**：上の「検証していないこと」のとおり、まだ見ていない。狭い画面で4列が窮屈なら、依頼人の欄を隠すなどの手当てが要る

<details>
<summary>捨てた案・補足</summary>

- **SQL も BIZ UDゴシック（1つの家族にそろえる）**：英字の幅が狭く `_` が見えにくかった
- **判子を紺に**：方針を見せたとき、朱のままと決まった
- **一覧以外も新聞のような罫線の段組みに**：スキルの「生成っぽい特徴」の1つに近いので、中身が本当に表のところ（一覧・モード・上の帯）だけにした

</details>
