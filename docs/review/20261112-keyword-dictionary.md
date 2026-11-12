---
tags: [review, sql-typing, keyword, dictionary]
created: 2026-11-12
updated: 2026-11-12
---
# 📝 20261112-keyword-dictionary：キーワードの説明と用語辞典

> - **対象**：ブランチ `feature/keyword-dictionary`（作業前のコミット `4367028`）
> - **steering**：`.steering/20261112-keyword-dictionary/`
> - **見るべき箇所**（最大3つ）：
>   1. `src/ui/components/KeywordTipLayer.jsx` いつ出していつ消すか（マウスが動いていない「当てた」を数えない、タップとクリックとキーボード）
>   2. `src/ui/components/TypingArea.jsx` モード2で空欄が残っているあいだは説明を出さない
>   3. `src/core/keyword-spans.js` 複数語の用語のまとめ方
> - **判断してほしいこと**：なし（本人の「上級まで作って」で、完了条件を満たしたらコミットしてマージする）
> - **検証していないこと**：4件

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 追加 | `.steering/20261112-keyword-dictionary/requirements.md` | 要求（キーワードの場所・用語辞典の中身・説明を出す・出す場所・用語辞典の画面・受け入れ条件・スコープ外） |
| 追加 | `.steering/20261112-keyword-dictionary/design.md` | 設計。実装と実装検証で変えたところ（pointer のイベント、`getKeywordWords`、`keywordsOfSlots`、モード2の扱い）を追記 |
| 追加 | `.steering/20261112-keyword-dictionary/tasklist.md` | タスクと、実装検証の指摘への対応・見送り、振り返り |
| 追加 | `src/core/keyword-spans.js` | `findKeywordSpans(sql, words)`：字句の `word` を見て、空白だけをはさむ語を3語・2語・1語の順にまとめる。`keywordsOfSlots(target, words)`：スロットごとの語と組（何番目の語か） |
| 追加 | `src/core/dictionary.js` | `buildDictionary(keywords, problems)`：レベルごとに並べ、出題順で最初にその語を `keywords` に入れている問題を付ける |
| 変更 | `src/ui/state/navigation.js` | `{ screen: 'dictionary' }` と `openDictionary`（一覧のときだけ） |
| 追加 | `src/ui/state/keyword-words.js` | 用語を最初に使うときに1回だけ読む `getKeywordWords()`・`getKeywordMap()` |
| 追加 | `src/ui/components/KeywordTipLayer.jsx` | ページ全体で1つの説明。マウスを当てる（動いていない「当てた」は数えない・同じ語の中では出し直さない）、タップで出し入れ（マウスのクリックでは変えない）、キーボードのフォーカス（`:focus-visible`）、キー・スクロール・画面の大きさの変化で消す、出した場所が消えたら消す、`aria-describedby` で結ぶ |
| 追加 | `src/ui/components/KeywordTipLayer.module.css` | 説明の箱（`position: fixed`、上に出すときは上へずらす、`pointer-events: none`） |
| 追加 | `src/ui/components/KeywordText.jsx` | SQLの文字の語に `data-keyword`・点線の下線・`tabIndex={0}` を付けて描く |
| 追加 | `src/ui/components/KeywordText.module.css` | 点線の下線とフォーカスの枠 |
| 変更 | `src/ui/components/TypingArea.jsx` | スロットに `data-keyword`・`data-keyword-group`（見た目は変えない）。モード2で埋まっていない空欄があるあいだは付けない |
| 変更 | `src/ui/components/StepPlayer.jsx` | ステップ再生のSQLの文字を `KeywordText` で描く |
| 変更 | `src/ui/components/HintPanel.jsx` | ヒント③の骨組みを `KeywordText` で描く |
| 追加 | `src/ui/screens/DictionaryScreen.jsx` | 用語辞典。レベルごとの見出し、各語（英語・SQLでの意味・例・初めて出てくる問題）。開いている問題は押すとモード選択へ。問題の読み込みの失敗、Esc で一覧へ |
| 追加 | `src/ui/screens/DictionaryScreen.module.css` | 用語辞典の配置 |
| 変更 | `src/ui/screens/HomeScreen.jsx` | 見出しの右に「用語辞典」ボタン（「設定」の隣） |
| 変更 | `src/ui/screens/HomeScreen.module.css` | 見出しの右のボタンを並べる枠 |
| 変更 | `src/ui/App.jsx` | 画面の切り替えを中の関数 `Screens` に分け、`KeywordTipLayer` を横に1つ置く。用語辞典の中身を問題を読み終えてから作り、用語辞典の画面に渡す |
| 追加 | `tests/unit/core/keyword-spans.test.js` | 8件：大文字・小文字、2語・3語、複数語の一部、文字列・コメント、語の一部、空。スロットごとの語と組2件 |
| 追加 | `tests/unit/core/dictionary.test.js` | 3件：並びと初めて出てくる問題、出てこない語、空 |
| 変更 | `tests/unit/ui/navigation.test.js` | 用語辞典への行き来 |
| 追加 | `tests/e2e/dictionary/keyword-tip.spec.js` | 5件：モード1で当てると出てキーで消える、マウスを置いたまま打ち間違えても戻らず動かすと出る、マウスのクリックで消えない、モード2で空欄が残っているあいだは出ない、ステップ再生（当てる・離れる・キーボードで移る） |
| 追加 | `tests/e2e/dictionary/dictionary.spec.js` | 3件：16語・語の中身・初めて出てくる問題からモード選択へ、Esc、幅375pxでタップ |
| 変更 | `docs/functional-design.md` | KeywordSpans・Dictionary の節、コンポーネント（KeywordTipLayer・KeywordText・DictionaryScreen・HomeScreen・TypingArea）、狭い画面・画面の切り替えの説明、テスト戦略 |
| 変更 | `docs/repository-structure.md` | 新しいファイル（`keyword-spans.js`・`dictionary.js`・`keyword-words.js`・`KeywordTipLayer.jsx`・`KeywordText.jsx`・`DictionaryScreen.jsx`・テスト・`dictionary/`） |
| 変更 | `docs/glossary.md` | 用語辞典の行（`DictionaryScreen`・`KeywordTipLayer`、初めて出てくる問題の作り方） |
| 変更 | `docs/development-guidelines.md` | 画面にSQLを出す部品は `KeywordText` で描く、打つ画面は `data-keyword` だけ、答えを隠している間は付けない |
| 変更 | `docs/product-requirements.md` | 機能11に、キーボードで説明を見られる場所と見られない場所 |
| 追加 | `docs/review/20261112-keyword-dictionary.md` | このファイル |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| 一覧 | 用語辞典の入口なし | 「用語辞典」ボタン |
| 用語辞典 | なし | 初級16語。英語の意味・SQLでの意味・例・初めて出てくる問題（開いていれば押すとモード選択へ）。幅の狭い画面でも見られる |
| モード1の打つSQL・ステップ再生・ヒント③ | 文字だけ | キーワードにカーソルを当てる（スマホではタップ、キーボードでは Tab で移る）と説明が出る。キーを押すと消える |
| モード2の打つSQL | 文字だけ | 空欄がすべて埋まるまでは説明は出ない。埋まったあとは出る |

## なぜ

- **説明の層をページに1つ**：SQLを出す場所は多い（打つSQL・ステップ再生・ヒント・用語辞典）。それぞれに説明の部品を置くより、`data-keyword` を付けるだけにして1か所で出すほうが、出し方・消し方をそろえやすい
- **マウスが動いていない「当てた」を数えない**：打つと文字の要素が作り直され（間違えたときの光り直しのため）、止まっているカーソルの下で、ブラウザが「当てた」をもう一度送ってくる。画面を開いた直後に、止まっているカーソルの下に語が来たときも同じ。PRD の「タイピング中に勝手に出てこない」を守るため、最後にマウスが動いた位置と同じ位置の「当てた」は数えない（実装検証の必須1）
- **モード2は空欄が残っているあいだ出さない**：見えている語の説明の「例」に空欄の答えがそのまま書いてある（6問目の LIKE の例 `'%Mug%'`、7問目の ORDER BY の例 `DESC`）。用語の例を問題ごとに避けるより、答えを隠している間は出さないほうが確実（実装検証の必須2）
- **マウスのクリックでは変えない**：マウスは当てた時点で出ているので、クリックで出し入れすると、当てて押したら消える不自然な動きになる。タップは「当てた」がないので、押すたびに出し入れする
- **キーボードは `:focus-visible` のときだけ**：タップでも語にフォーカスが移る。フォーカスで出すと、続く「押した」で消えてしまう
- **説明の上にマウスを移せない（WCAG 1.4.13 の一部を満たさない）**：説明は打つSQLやボタンの上に重なることがある。重なっても押せるよう、説明はマウスを受けない。中身は用語辞典でいつでも読める
- **打つ画面の語には Tab で移れない**：モード1・2は Tab も打つキーの判定に入るので、語に移る動きと混ざる

## 検証

| やったこと | 結果 |
|---|---|
| コアのテストを先に書いた | `keyword-spans`・`dictionary`・`navigation` の新しいテストが失敗することを確かめてから実装した。実装検証のあとの `keywordsOfSlots` も同じ |
| `npm run check` | 通った（489件。`src/core/` の行カバレッジ 98.37%） |
| `npm run test:e2e` | 通った（74件。今回足した分は8件）。用語辞典の E2E は2回くり返して16件とも通った |
| 目で確かめた（Playwright で撮った） | モード1の FROM に当てた説明（ダーク、語の上に出る）、375px の用語辞典で ORDER BY をタップした説明（ライト） |
| 実装検証（implementation-validator） | [必須] 2件・[推奨] 7件・[提案] 4件。必須・推奨は直した（WCAG 1.4.13 の一部は理由を書いて見送り）。対応は `.steering/20261112-keyword-dictionary/tasklist.md` |
| `node scripts/check-review-files.js docs/review/20261112-keyword-dictionary.md 4367028` | OK |

**検証していないこと**：
- **実機のスマホのタップ**：Playwright のタッチ（`hasTouch`）でだけ確かめた
- **読み上げソフトでの聞こえ方**：`aria-describedby` が付くことは E2E で見たが、読み上げは聞いていない
- **ブラウザによる「当てた」の送り方の違い**：Chromium だけで確かめた。ほかのブラウザで、描き直しのときに位置の違う「動いた」を送るなら、説明が出ることがある
- **説明を出したままのほかの操作**（ステップ再生の ← → Space、モード3・4の Ctrl+Enter）：キーを押すと説明は消えるだけで、キーはそのまま届く作り（コードを読んで確かめた）

## 判断してほしいこと

- なし

<details>
<summary>捨てた案・補足</summary>

- **部品ごとに説明の部品を置く**：上の「なぜ」
- **モード2では例の行だけ隠す**：「SQLでの意味」にも答えに近いことが書いてある語がある（ORDER BY の意味に ASC）。まとめて出さないほうが確実
- **用語辞典の検索・用語辞典から開いた問題のもどり先を用語辞典に**：要求のスコープ外
- **キーワードを keywords に書き忘れた問題を検証で止める**：今の初級9問では書き忘れはない。中級の問題を書くときに考える

</details>
