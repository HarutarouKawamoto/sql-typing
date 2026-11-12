# 設計書

## コア：`src/core/reorder.js`

```js
/**
 * @typedef {{ kind: ClauseKind, label: string, writtenOrder: number, execOrder: number }} ReorderChip
 * @returns {ReorderChip[] | null} 書いた順。流さないときは null
 */
export function buildReorderChips(sql, maxLength = 28) {}
```

- `splitClauses(sql)` を使う。`ok: false` か句が2つ未満なら `null`
- `label`：句の文字（`sql.slice(start, end)`）の空白・改行を1つの空白にまとめて前後を切る。`maxLength` 文字を超えたら `maxLength - 1` 文字で切って「…」
- 純粋な関数。テストを先に書く（`tests/unit/core/reorder.test.js`）

## 画面：`src/ui/components/ReorderIntro.jsx`

- props：`{ chips, onDone }`
- 並びの状態 `arranged`（false＝書いた順、true＝実行順）。マウントから 0.4秒で true にし、1.5秒で `onDone`
- `motion.li` に `layout` と `key={kind}`（同じSQLに同じ句は1つだけなので key になる）。並べる順は `arranged` で `writtenOrder` か `execOrder`
- 見出し：「書いた順」→「実行される順」。チップの頭に今の並びの番号
- `data-testid="reorder-intro"`、`data-arranged`（E2E で入れ替わったことを見る）、チップは `data-testid="reorder-chip"`
- タイマーは unmount で止める。`onDone` は ref で持つ（親の再描画でタイマーを作り直さない）

## PlayMode34 とのつなぎ

- 新しい props：`reorderAnimation: boolean`
- `intro` の状態：`{ run: number, chips } | null`
- 実行（ボタン・Ctrl+Enter）：`busy`（判定中・アニメーション中）なら何もしない。`session.run(sql)` を呼ぶ前に、流す条件（設定が on・動きを減らす設定でない・チップがある・実行できる）を満たせば `intro` を入れる
  - （実装検証の提案2で変えた）流す条件のうち「実行できる」は画面で見ず、`session.run(sql, onStart)` が判定を始めたときに呼ぶ onStart で `intro` を入れる。画面とセッションで同じ条件を二重に見ない
- 判定の結果の場所：`intro` があれば `ReorderIntro`、なければ今までどおり `JudgePanel`／クリアの結果
- 結果の表・ステップ再生のボタンも、`intro` の間は「判定しています…」のときと同じに隠す
- `canRun` の判定はセッションに任せる（上の onStart）
- 動きを減らす設定は `window.matchMedia('(prefers-reduced-motion: reduce)')` を実行のときに読む（`src/ui/state/reduced-motion.js`）

## 学習記録

- `updateSettings(progress, patch)`：`{ ...progress, settings: SettingsSchema.parse({ ...progress.settings, ...patch }) }`（形の違う値を入れない）
- `clearProgress(storage, settings)`（実装検証の推奨3で、書けないときは記録のキーを消し、`saved` も返す形にした）：
  1. `storage.key`・`storage.length` があれば、`sql-typing:progress:broken-` で始まるキーを集めて消す
  2. `createEmptyProgress()` に `settings` を入れて保存
  3. `{ progress, ok }` を返す（書けなくても例外にしない）
- `KeyValueStorage` の型に `key?`・`length?` を足す。作り物の storage（`getBrowserStorage` の代わり）にも足す
- `useProgress`：`changeSettings(patch)`（`commit(updateSettings(...))`）、`clearAll()`（`clearProgress` を呼んで ref と state を入れ替え、書けなければ `saveFailed`）

## 画面の切り替え

- `navigation.js`：`{ screen: 'settings' }`、`openSettings`（一覧のときだけ）。もどるのは今の `home`
- `App.jsx`：`settings` のとき `SettingsScreen`。`PlayScreen` に `reorderAnimation` を渡す → `PlayMode34`
- `HomeScreen`：見出しの横に「設定」ボタン（`data-testid="open-settings"`）

## 設定画面：`src/ui/screens/SettingsScreen.jsx`

- props：`{ settings, onChange, onClear, saveFailed, onHome }`
- 見える化B：`<input type="checkbox">`「実行の前に、句が実行順に入れ替わる動きを流す（見える化B）」
- 速さ：`<fieldset>` に3つの radio（0.5・1・2）
- 学習記録を消す：ボタン → 確かめ（`role="alertdialog"` の枠、「消す」「やめる」）→ 消したら `role="status"` で「学習記録を消しました」
- Esc：確かめが出ていれば閉じる、なければ一覧へ（変換中は何もしない）
- 書けない環境（saveFailed）なら「この環境では設定が保存されません」

## テスト

- 単体：`reorder.test.js`（新規）、`progress-store.test.js`（updateSettings・clearProgress）、`navigation.test.js`（openSettings）
- E2E：`tests/e2e/settings/settings.spec.js`（一覧から開く・Esc・速さの保存・記録を消す（やめる／消す、設定は残る）・B を off にするとチップが出ない）、`mode3-4-write.spec.js` に見える化B のテスト（チップが書いた順 → 実行順、そのあと結果）

## 影響するドキュメント

- `docs/functional-design.md`：ProgressStore のインターフェース、ユースケース2の7、コンポーネントの表（ReorderIntro・SettingsScreen・HomeScreen）、画面遷移の説明、見える化B の動き
- `docs/repository-structure.md`：新しいファイル
- `docs/glossary.md`：見える化B の行（1.5秒・設定で止める）は合っているか確かめる
