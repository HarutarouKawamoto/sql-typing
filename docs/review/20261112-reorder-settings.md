---
tags: [review, sql-typing, visualization, settings]
created: 2026-11-12
updated: 2026-11-12
---
# 📝 20261112-reorder-settings：見える化B（実行順の並び替え）と設定画面

> - **対象**：ブランチ `feature/reorder-settings`（作業前のコミット `db12930`）。まだコミットなし
> - **steering**：`.steering/20261112-reorder-settings/`
> - **見るべき箇所**（最大3つ）：
>   1. `src/ui/components/PlayMode34.jsx` 判定と見える化B を同時に走らせ、動きが終わるまで結果を見せない（`busy`・`runSql`）
>   2. `src/data/progress-store.js` の `clearProgress`：設定は残す、退避した古い記録も消す、書けないときは記録のキーを消す
>   3. `src/ui/screens/SettingsScreen.jsx` 確かめ・Esc・フォーカスの戻し方
> - **判断してほしいこと**：1件（設定を残すことは本人が決めた）
> - **検証していないこと**：4件
> - **確かめの途中で、本人の学習記録が一度変わった**：開発サーバーで動きを見るために打ったSQLが3問目の正解になり、モード4のクリアが記録された。先に取っておいた記録にもどした（文字数 1945 で同じことを確かめた）

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 追加 | `.steering/20261112-reorder-settings/requirements.md` | 要求（見える化B・設定画面・学習記録を消す・受け入れ条件・スコープ外） |
| 追加 | `.steering/20261112-reorder-settings/design.md` | 設計（`buildReorderChips`、ReorderIntro の長さ、PlayMode34 とのつなぎ、`updateSettings`・`clearProgress`、navigation、設定画面、テスト）。実装検証のあと、onStart で動きを始める形と `clearProgress` の `saved` を追記 |
| 追加 | `.steering/20261112-reorder-settings/tasklist.md` | タスクと、実装検証の指摘への対応・見送りの理由、振り返り |
| 追加 | `src/core/reorder.js` | `buildReorderChips(sql, maxLength = 28)`：ClauseSplitter で句に分け、句ごとのチップ（種類・空白をまとめて長ければ「…」で切った文字・書いた順・実行順）を書いた順で返す。分けられない・句が1つなら `null` |
| 追加 | `src/ui/components/ReorderIntro.jsx` | 見える化B の画面。0.4秒で書いた順 → 実行順に並べ替え（Motion の `layout`、0.7秒）、1.5秒で `onDone`。`onDone` は ref で持ち、タイマーは unmount で止める。番号は `aria-hidden`（ol が読む）。`data-testid="reorder-intro"`・`data-arranged`・チップの `data-kind` |
| 追加 | `src/ui/components/ReorderIntro.module.css` | 判定の結果の枠と同じ形（左の太い線は「今の句」の黄）、縦に並んだチップ、丸い番号 |
| 追加 | `src/ui/screens/SettingsScreen.jsx` | 設定画面。見える化B のチェックボックス、速さの radio（0.5・1・2）、「学習記録を消す」→ 確かめ（題と本文、「消す」「やめる（Esc）」）。確かめを出したら「やめる」に、閉じたら「学習記録を消す」にフォーカス。結果は先に置いた `role="status"` に「消しました」／「消せませんでした」。Esc は確かめを閉じる → 一覧へ。書けない環境の知らせ |
| 追加 | `src/ui/screens/SettingsScreen.module.css` | 設定画面の配置。ボタンは AfterStory の「一覧へ」と同じ形、消すボタンと確かめの枠は赤 |
| 追加 | `src/ui/state/reduced-motion.js` | `prefersReducedMotion()`：OS の「動きを減らす」設定（`matchMedia` がなければ false） |
| 変更 | `src/data/progress-store.js` | `updateSettings(progress, patch)`（`SettingsSchema.parse` を通す）と `clearProgress(storage, settings)`（退避した古い記録を先に集めてから消す → 設定だけ残した空の記録を保存。書けなければ記録のキーを消す。`{ progress, ok, saved }`）。退避のキーの頭を `BROKEN_PREFIX` にまとめた。`KeyValueStorage` の型に `key?`・`length?`、作り物の storage にも `key`・`length` |
| 変更 | `src/ui/state/progress.js` | `useProgress` に `changeSettings(patch)` と `clearAll()`（記録を入れ替え、壊れた記録の知らせを閉じ、書けなければ `saveFailed`。記録が消えたかを返す） |
| 変更 | `src/ui/state/navigation.js` | `{ screen: 'settings' }` と `openSettings`（一覧のときだけ）。`modeSelect` を「一覧でなければ」から「problemId がある画面なら」に直した（設定画面には problemId がない） |
| 変更 | `src/ui/state/use-write-session.js` | `run(sql, onStart)`：判定を始めたときだけ onStart をその場で呼ぶ |
| 変更 | `src/ui/components/PlayMode34.jsx` | props に `reorderAnimation`。`intro`（流しているチップ）を持ち、判定中か流している間を `busy` にまとめて、判定の結果・クリアの結果・結果の表・ステップ再生のボタン・実行ボタンを同じに扱う。`runSql` は流している間は止め、設定が on・動きを減らす設定でない・チップがあれば onStart で流す |
| 変更 | `src/ui/screens/PlayScreen.jsx` | `reorderAnimation` を受け取り、PlayMode34 に渡す |
| 変更 | `src/ui/screens/HomeScreen.jsx` | 見出しの右に「設定」ボタン（`data-testid="open-settings"`）、`onOpenSettings` |
| 変更 | `src/ui/screens/HomeScreen.module.css` | 見出しを横並びに、「設定」ボタンの形（ブラウザの既定の小さなボタンだったのを、一覧へのボタンと同じ形に） |
| 変更 | `src/ui/App.jsx` | 設定画面への切り替え、`changeSettings`・`clearAll` を渡す、PlayScreen に `reorderAnimation` を渡す |
| 追加 | `tests/unit/core/reorder.test.js` | 7件：書いた順と実行順、空白のまとめ方、長い句の切り方、ちょうどの長さ、句が1つ、分けられないSQL、文字列・括弧の中のキーワード |
| 変更 | `tests/unit/data/progress-store.test.js` | `updateSettings`（2件）と `clearProgress`（5件：設定を残す・退避した記録も消す・key のない storage・書けないときはキーを消す・消せもしないとき） |
| 変更 | `tests/unit/ui/navigation.test.js` | 設定への行き来（2件） |
| 変更 | `tests/helpers/memory-storage.js` | 作り物の localStorage に `key`・`length` |
| 追加 | `tests/e2e/settings/settings.spec.js` | 4件：一覧から開いて Esc でもどる、速さと on/off の保存と読み込み直し、記録を消す（やめる・Esc では消えない、フォーカスがもどる、消すと星が消え設定は残る、2問目が閉じる）、off なら流れない（ページの中で見張る） |
| 変更 | `tests/e2e/play-modes/mode3-4-write.spec.js` | 見える化B の3件：書いた順 → 実行順の記録（MutationObserver）と、流している間は結果を出さず次の実行も受けないこと。句が1つなら流れず、正解なら動きのあとにクリア。動きを減らす設定では流れない |
| 変更 | `tests/e2e/helpers/seed-progress.js` | 3つ目の引数で設定を変えられる |
| 変更 | `docs/functional-design.md` | ReorderChips の節、ProgressStore のインターフェース（`updateSettings`・`clearProgress`）、コンポーネントの表（HomeScreen・PlayMode34・ReorderIntro・SettingsScreen）、ユースケース2の図と7、画面遷移の説明に設定、「見える化B（ReorderIntro）の動き」の節、テスト戦略 |
| 変更 | `docs/repository-structure.md` | 新しいファイル（`reorder.js`・`ReorderIntro.jsx`・`SettingsScreen.jsx`・`reduced-motion.js`・テスト）、`progress.js`・`navigation.js`・`seed-progress.js`・`memory-storage.js` の説明。ターニングポイントの会話が「10行」のままだったのを11行に |
| 変更 | `docs/glossary.md` | 見える化B の行（モード3・4で実行したとき、判定と同時に流す、`reorderAnimation`、`buildReorderChips`） |
| 追加 | `docs/review/20261112-reorder-settings.md` | このファイル |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| モード3・4で実行したとき | すぐ「判定しています…」→ 結果 | 句のチップが書いた順 → 実行順に入れ替わる（1.5秒）→ 結果。判定は同時に走る。句が1つ・動きを減らす設定・設定が off なら今までどおり |
| 一覧 | 設定の入口なし | 右上に「設定」 |
| 設定画面 | なし | 見える化B の on/off、ステップ再生の速さ、学習記録を消す（確かめあり、設定は残る） |
| ステップ再生の速さ | 学習記録の既定値（1倍）のまま変えられなかった | 設定画面で 0.5・1・2倍に変えられる |

## なぜ

- **判定を動きと同時に始める**：動きのあとに判定を始めると、待ち時間が 1.5秒 ＋ 判定 になる。同時に始めれば、たいていは動きが終わったときに結果がそろっている。時計は実行を押したときで止まる（今までどおり）ので、動きの時間は記録に入らない
- **動きの間は結果を見せない**：結果を先に見せると、動きを見る理由がなくなる（PRD の「実行の直前に流れる」）。クリアの結果・クリア後の会話も動きのあとに出すので、R・Enter・J は動きの間（最大1.5秒）効かない
- **onStart で動きを始める**：最初は画面で「実行できるか」を見てから動きを始めていたが、セッションの `run` と同じ条件を二重に見ることになり、ずれると「動いたのに判定しない」が起きる（実装検証の提案）。セッションが判定を始めたときだけ呼ぶ形にした
- **設定は消さない**：設定（動きの on/off・速さ）は学習の記録ではなく好み。PRD 機能12 の「学習記録をすべて消せる」は、クリア状況・最高記録・苦手・日ごとの記録を消すことと読んだ（本人の決定。2026-11-12）
- **退避した古い記録も消す**：壊れていて退避した記録（`sql-typing:progress:broken-…`）も学習記録なので、「すべて」に入れた。storage にキーを順に見る手段（`key`・`length`）がなければ探さない
- **書けないときは記録のキーを消す**：容量いっぱいで書けない環境で「消しました」と出しても、読み込み直すと古い記録がもどる（実装検証の指摘）。removeItem は通ることが多いので、記録は確実に消す。この場合、設定は既定にもどる
- **動きを減らす設定では流さない**：見える化B は動きそのものが中身なので、動きを抜いて出しても意味がない。ステップ再生と結果の表は、Motion の `reducedMotion="user"` で動きだけ止めている
- **確かめを画面の中の枠にした**：ブラウザの `confirm()` はキーボードの決まり（Esc で閉じる、フォーカスの戻し方）を揃えられない。枠にして、「やめる」に先にフォーカスを置き、Enter を続けて押しても消えないようにした

## 検証

| やったこと | 結果 |
|---|---|
| コアとデータのテストを先に書いた | `reorder.test.js`・`progress-store.test.js`・`navigation.test.js` の新しいテストが失敗することを確かめてから実装した。`clearProgress` の並び順の期待が間違っていたので直した。実装検証のあとの「書けないときはキーを消す」もテストを先に書いた |
| `npm run check` | 通った（447件。`src/core/` の行カバレッジ 98.22%） |
| `npm run test:e2e` | 通った（59件。今回足した分は7件）。変えた E2E（設定・モード3・4）は `--repeat-each 3` で3回くり返して57件とも通った |
| 開発サーバーで目で確かめた（1280px、ダーク） | 一覧の「設定」、設定画面、確かめの枠（題・本文・ボタン）、Esc で確かめを閉じたあとのフォーカス。「設定」のボタンがブラウザの既定の小さな形だったのをここで見つけて直した。ブラウザの画面が隠れていて動きが止まるので、チップの動きは Playwright で 100・500・750・1100ms の画像を撮って確かめた（書いた順 → 動いている途中 → 実行順） |
| 実装検証（implementation-validator） | [必須] 0件・[推奨] 6件・[提案] 6件。判定と動きの競合（動きの途中で判定が終わる・クリアになる・Esc・R・Ctrl+Enter の連打）はコードを追って破綻なし。推奨はすべて直し、提案は3つ直した。対応と見送りの理由は `.steering/20261112-reorder-settings/tasklist.md` |
| `node scripts/check-review-files.js docs/review/20261112-reorder-settings.md db12930` | OK |

**検証していないこと**：
- **書けない環境で記録を消したときの画面**：「消せませんでした」の表示と、キーを消す動きは単体テストだけ。ブラウザで容量いっぱい・プライベートモードを作って確かめていない
- **読み上げソフトでの聞こえ方**：`role="status"`・`alertdialog`・チップの番号の `aria-hidden` は、DOM と E2E のフォーカスだけで確かめた
- **ライトモードの見た目**
- **判定が1.5秒より長いとき**：動きのあとに「判定しています…」が出るのはコードを読んで確かめただけ（初級の問題では判定がすぐ終わる）

## 判断してほしいこと

- **コミット**：まだしていない。このブランチでコミットし、`main` にマージしてよいか

<details>
<summary>捨てた案・補足</summary>

- **動きのあとに判定を始める**：待ち時間が長くなる
- **ブラウザの `confirm()` で確かめる**：上の「なぜ」
- **動きを `page.clock` で止めて E2E を書く**：Motion の動き（requestAnimationFrame）や PGlite の時計まで偽物になる心配があるので、ページの中で並びの変化を記録する形にした
- **確かめの枠に `aria-modal`・背景の `inert`**：画面の一部の枠で、背景の設定を触れても困らないので付けなかった
- **モード1・2にも見える化B**：実行する場面がない。打ちながら表が変わるのは見える化C（もうある）

</details>
