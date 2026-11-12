# 設計書

## コア

### `src/core/keyword-spans.js`
```js
/** @returns {{ start: number, end: number, word: string }[]} 前から順。word は用語辞典の表記（大文字） */
export function findKeywordSpans(sql, words) {}
```
- `tokenize` の `word` だけを見る。語と語の間が `space` だけなら続けて見て、3語・2語・1語の順に用語辞典にあるかを調べる（長いものが先）。コメントをはさんだら別の語
- `words` は大文字の表記（`keywords.yaml` の `word`）

### `src/core/dictionary.js`
```js
/**
 * @param {Keyword[]} keywords - keywords.yaml の順
 * @param {{ id: string, title: string, keywords: string[] }[]} problems - 出題順（全章）
 * @returns {{ level: 1|2|3, entries: (Keyword & { firstProblem: { id: string, title: string } | null })[] }[]}
 *   出てくるレベルだけ。レベルの中は keywords.yaml の順
 */
export function buildDictionary(keywords, problems) {}
```

## 画面

### `src/ui/components/KeywordTipLayer.jsx`
- App に1つだけ置く。`document` の `mouseover`・`mouseout`・`click`・`keydown`・`scroll`（capture）を受ける
  - （実装で変えた）マウスとタップを分けるため `pointerover`・`pointermove`・`pointerout` にした。実装検証のあと、マウスが動いていない「当てた」を数えない・マウスのクリックでは変えない・キーボードのフォーカス（`:focus-visible`）でも出す・`resize` でも消す・出した場所が消えたら消す・`aria-describedby` で結ぶ、を足した
- `mouseover` の対象から `closest('[data-keyword]')` を探し、あればその要素の `getBoundingClientRect()` の下に `position: fixed` で説明を出す（画面の下にはみ出すなら上に）
- `mouseout` で、移った先が同じ語の要素の中でなければ消す
- `click`：`[data-keyword]` なら、出ていなければ出す・同じ要素なら消す。外を押したら消す
- `keydown`・`scroll`：消す
- 説明：語（`code`）、「英語：…」「SQL：…」「例：…」。`role="tooltip"`、`data-testid="keyword-tip"`
- 用語は `loadKeywords()`（同期）を1回だけ読む

### `src/ui/components/KeywordText.jsx`
- `{ text }` を受け（用語は `getKeywordWords()` を読む。実装で変えた）、キーワードの所を `<span data-keyword className={styles.keyword}>` にして描く（点線の下線）。ほかは文字のまま
- 用語の表は `src/ui/state/keyword-words.js` の `getKeywordWords()`・`getKeywordMap()`（最初に使うときに1回だけ読む。実装検証で、import しただけで読む形から変えた）。語には `tabIndex={0}`

### つなぐ場所
- `TypingArea`：core の `keywordsOfSlots` でスロット → 語と組を作り、スロットの span に `data-keyword`・`data-keyword-group` を付ける（打つ処理には影響しない）。点線の下線はつけない（打つ文字の見た目を変えない）。モード2で埋まっていない空欄があるあいだは付けない（実装検証の必須2：説明の例から答えがわかる）
- `StepPlayer`：セグメントの文字を `KeywordText` で描く（段の番号はそのまま）
- `HintPanel`：③の骨組みを `KeywordText` で
- `DictionaryScreen`：例を `KeywordText` で

### `src/ui/screens/DictionaryScreen.jsx`
- props：`{ dictionary, isUnlocked(problemId), onOpenProblem(problemId), onHome }`
- レベルの見出し（初級・中級・上級）、各語は `<article>`（`data-testid="dict-<WORD>"`、空白は `-`）
- Esc で一覧へ

### 画面の切り替え
- `navigation.js`：`{ screen: 'dictionary' }`、`openDictionary`（一覧のときだけ）。`openProblem` は今のまま（どこからでもモード選択へ）
- `HomeScreen`：「用語辞典」ボタン（`data-testid="open-dictionary"`）を「設定」の隣に
- `App`：辞書の中身は `useMemo` で `problems` が読めてから作る

## テスト
- 単体：`keyword-spans.test.js`・`dictionary.test.js`・`navigation.test.js`（openDictionary）
- E2E：`tests/e2e/dictionary/keyword-tip.spec.js`（モード1の WHERE…3問目、キーで消える、ステップ再生）、`dictionary.spec.js`（一覧から開く・16語・リンク・閉じた問題・Esc・幅375pxでタップ）

## 影響するドキュメント
- functional-design：コアに KeywordSpans・Dictionary、コンポーネント（KeywordTipLayer・KeywordText・DictionaryScreen・HomeScreen・TypingArea・StepPlayer・HintPanel）、狭い画面の説明、テスト戦略
- repository-structure：新しいファイル
- glossary：用語辞典の行
