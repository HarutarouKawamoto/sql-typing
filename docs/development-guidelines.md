# 開発ガイドライン (Development Guidelines)

> - 元にした資料：[architecture.md](architecture.md)、[repository-structure.md](repository-structure.md)、[product-requirements.md](product-requirements.md) の「開発プロセスの要件」。
> - 開発する人は本人1人と Claude Code。人がレビューで読むことを前提に、**「作業の完了条件」と「レビュー用の記録」を一番大事なルール**とする。

## 作業の完了条件（必ず守る）

1つの作業（`/add-feature` 1回、または手での修正1回）は、次の**すべて**を満たすまで完了ではない。

1. `npm run check` が通る（ESLint ＋ Prettier の確認 ＋ 単体テスト ＋ 統合テスト ＋ 問題データの検証）
2. 画面（`src/ui/`）を変えた作業は、`npm run test:e2e` も通る
3. 仕様を変えた場合は、`docs/` の該当する永続ドキュメントを同じ作業の中で直している
4. **`docs/review/` にレビュー用の記録を書き、`node scripts/check-review-files.js` が通る**（下の「レビュー用の記録」）
5. 検証できなかったことがあれば、レビュー用の記録の「検証していないこと」に書いている（隠さない）

テストが通らないまま「完了」と報告しない。通らない理由がわかっていても、通らないことを記録に書いて報告する。

## レビュー用の記録（`docs/review/`）

コードを作成・変更したら、その内容を**抜けなく** `.md` にまとめる（PRD の開発プロセスの要件、壁打ちの決定15）。

### ルール
- **単位**：`/add-feature` 1回（`.steering/` の1フォルダ）につき1ファイル。手での修正も1回につき1ファイル
- **ファイル名**：`docs/review/YYYYMMDD-<作業名>.md`。作業名は `.steering/` のフォルダ名と同じにする（例：`docs/review/20261112-mode1-typing.md`）
- **長さの上限はない**。抜けをなくすことを優先する。短くするためにファイルを省いたり、まとめて「その他」と書いたりしない
- **元にするもの**：実際の差分（`git diff --name-status <作業前のコミット>` と `git diff`）。記憶やコミットメッセージだけで書かない
- **「なぜ」がわからないとき**：差分からも会話からも理由がわからない変更は、理由を作らずに「判断してほしいこと」に書いて本人に聞く
- **抜けの確認**：`node scripts/check-review-files.js docs/review/<ファイル>.md <作業前のコミット>` で、「変更したファイル一覧」の表と `git diff --name-status` のファイル一覧が完全に一致することを確かめる。一致しなければ記録を直す
  - git に登録していないファイルの名前変更は「削除＋追加」に見える。記録に「名前変更」と書くなら、先に `git add -A` してから照合する
  - 表の区分は `追加`／`変更`／`削除`／`名前変更` だけ。同じパスを2回書かない。名前変更は `古い` → `新しい` の2つを書く（決まりに合わない表は照合できず、終了コード2になる）
- `docs/review/` 自身と `.steering/` の中のファイルは、一覧に載せなくてよい（スクリプトも除外する）

### 型

```markdown
---
tags: [review, sql-typing, <技術名>…]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
# 📝 YYYYMMDD-<作業名>：<作業の題名>

> - **対象**：commit `xxxxxxx`〜`yyyyyyy`（作業前のコミット `zzzzzzz`）
> - **steering**：`.steering/YYYYMMDD-<作業名>/`
> - **見るべき箇所**（最大3つ）：
>   1. `パス:行` 理由
> - **判断してほしいこと**：◯件
> - **検証していないこと**：◯件

## 変更したファイル一覧
| 区分 | ファイル | 何をしたか |
|---|---|---|
| 追加 | `src/core/typing-engine.js` | … |
| 変更 | `docs/functional-design.md` | … |
| 削除 | `…` | … |

## 挙動の変化
| どこで | 前 | 後 |
|---|---|---|

## なぜ
- その場にいたAIにしか書けない判断の理由。箇条書き

## 検証
| やったこと | 結果 |
|---|---|
| `npm run check` | 通った（単体 ◯件／統合 ◯件） |

**検証していないこと**：…（リスクと、確かめ方）。なければ「なし」と書く

## 判断してほしいこと
- 本人が決めるべき点。なければ「なし」と書く

<details>
<summary>捨てた案・補足</summary>

…

</details>
```

- 「変更したファイル一覧」の区分は `追加`／`変更`／`削除`／`名前変更` のどれか（`git diff --name-status` の A / M / D / R に合わせる）
- 「挙動の変化」と「検証」で、一覧のすべてのファイルがどこかに出てくるようにする（テストファイルは「検証」に、ドキュメントは「挙動の変化」の代わりに一覧の「何をしたか」で足りる）

## コーディング規約

### 言語の決まり（JavaScript）

- ES Modules（`import` / `export`）。CommonJS（`require`）は使わない
- 名前付き `export` だけを使う。`export default` は使わない（名前を探しやすくするため）。ただし設定ファイル（`vite.config.js` など）はツールの決まりに従う
- `var` は使わない。再代入しないものは `const`
- 型は JSDoc で書く。データの形は `src/schema/` の Zod スキーマから作り、型とスキーマを二重に書かない

```js
// ✅ 良い例：スキーマから型を作る
/** @typedef {import('zod').infer<typeof ProblemSchema>} Problem */

/**
 * 1回のキー入力を判定する
 * @param {TypingState} state - 今の状態（変更しない）
 * @param {string} key - KeyboardEvent.key
 * @returns {{ state: TypingState, result: 'ok'|'miss'|'ignored', clauseEnded?: number }}
 */
export function pressKey(state, key) { /* ... */ }

// ❌ 悪い例：型の説明がなく、引数の state を書き換えている
export function press(s, k) { s.pos++; return s; }
```

### 命名規則

| 対象 | 規則 | 例 |
|---|---|---|
| 変数 | camelCase、名詞 | `typedSlots`、`expectedResult` |
| 関数 | camelCase、動詞で始める | `buildTarget`、`translateError` |
| 真偽値 | `is` / `has` / `should` で始める | `isUnlocked`、`hasMiss` |
| 定数 | UPPER_SNAKE_CASE | `TIMEOUT_MS`、`ERROR_MESSAGES` |
| React コンポーネント | PascalCase | `TypingArea` |
| フック | `use` で始める camelCase | `usePlaySession` |
| クラス | PascalCase、名詞 | `SqlRunner` |
| Zod スキーマ | PascalCase ＋ `Schema` | `ProblemSchema` |
| ファイル | リポジトリ構造定義書のとおり | `typing-engine.js`、`TypingArea.jsx` |

このアプリ特有の言葉（スロット、句、段階、ターニングポイントなど）は、[用語集](glossary.md) の英語名をそのまま使う。同じものに別の名前を付けない。

### コアレイヤー（`src/core/`）の書き方

- **純粋な関数にする**：同じ引数なら同じ結果。引数を書き換えず、新しいオブジェクトを返す
- **外の世界を引数で受け取る**：`SqlRunner`・乱数（`randomFn`）・現在時刻（`now`）は引数で受け取る。中で `Math.random()`・`Date.now()` を呼ばない（テストで固定できるように）
- **画面の言葉を持たない**：表示用の日本語の文（エラーの和訳、判定の説明）は返してよいが、HTML や CSS のクラス名は返さない

### 画面レイヤー（`src/ui/`）の書き方

- 関数コンポーネントとフックだけを使う
- 状態は「画面全体のもの（今の画面、学習記録、SqlRunner）」を Context に、「1つの画面の中のもの」をその画面の `useReducer` / `useState` に置く
- キー入力は `keydown` を1か所（遊ぶ画面のフック）で受け、コアレイヤーの `pressKey` に渡す。部品ごとに `keydown` を付けない（二重に反応するのを防ぐ）
- `dangerouslySetInnerHTML` は使わない（ESLint で禁止）
- 色・余白は `src/ui/styles/tokens.css` の CSS 変数を使う。部品の CSS に色の値を直接書かない
- 大きさ（文字・余白・幅・角）は `rem` で書く。`px` は線の太さ（`1px`・`2px`）だけ。サイト全体の大きさはルートの文字（`html { font-size: 125% }`）で決めているので、`px` で書くとそこだけ大きくならない

### コードフォーマット

- **インデント**：2スペース
- **行の長さ**：最大100文字
- **引用符**：シングルクォート。JSX の属性はダブルクォート
- **セミコロン**：付ける
- Prettier（`.prettierrc.json`）に任せ、手で整形しない

```js
// Prettier の設定
{ "singleQuote": true, "jsxSingleQuote": false, "semi": true, "printWidth": 100, "trailingComma": "all" }
```

### コメント規約

- `export` する関数・クラスには JSDoc（何をするか、引数、戻り値）を書く
- 中のコメントは「なぜそうするか」だけを書く。「何をしているか」はコードでわかるので書かない
- コメントは日本語で書く

```js
// ✅ 良い例：なぜ
// statement_timeout は WebAssembly の中で確実に止まる保証がないので、Worker ごと作り直す
worker.terminate();

// ❌ 悪い例：何を（コードを見ればわかる）
// Worker を終了する
worker.terminate();
```

### エラーハンドリング

**原則**：
- **学習者の操作で当然起こること**（SQLのエラー、不正解、タイムアウト、ステップ再生に未対応の形）は**例外にしない**。`{ ok: false, ... }` や `status: 'error'` のような結果のオブジェクトで返す
- **プログラムの間違い**（ありえない状態、スキーマに合わないデータ）は `throw` する。握りつぶさない
- `catch` したら、必ず「表示する」「結果のオブジェクトに変える」「投げ直す」のどれかをする。空の `catch` は書かない

```js
// ✅ 良い例：学習者のSQLのエラーは結果として返す
export async function judge({ sql, problem, runner }) {
  const mine = await runner.run(sql);
  if (!mine.ok && mine.timeout) return { status: 'timeout' };
  if (!mine.ok) return { status: 'error', error: translateError(mine.error) };
  // ...
}

// ✅ 良い例：ありえない状態は投げる
if (!CLAUSE_ORDER[kind]) throw new Error(`未知の句: ${kind}`);

// ❌ 悪い例：エラーを握りつぶす
try { await runner.run(sql); } catch (e) {}
```

## 問題データの書き方（`data/`）

問題YAMLの形は [機能設計書](functional-design.md) の Problem と、`src/schema/problem-schema.js` に従う。形のほかに、次の中身のルールを守る。

- **値は英語と数字だけ**：SQL・テーブル・列・データの値に日本語を入れない。日本語は `title`・`story`・`hints`・`why` だけ
- **打てるSQLにする**：`answer`・`display` の文字列・識別子の中に改行やタブを入れない（区切りでないところの Enter・Tab は画面で打てず、先に進めなくなる。`checkTypable` で止まる）。コメント（`--`・`/* */`）も1文字ずつ打つことになるので書かない
- **打ちながら実行できる SELECT にする**：`SELECT ... INTO` は書かない（途中で実行すると表ができてしまう。`canRunWhileTyping` で止まる）
- **会話**：`before` は3〜8行（ターニングポイントは10行程度）、`after` は1〜4行。1行は全角40文字以内。主人公がSQLであっさり片付け、周りが驚く「俺つええ」の味付けにする。依頼の中に、そのSQLが現実のどの操作の裏で動くかが伝わる一言を入れる
- **モード2の選択肢**：正解と「似ているが意味が違う」ものにする（`WHERE` と `HAVING`、`>` と `>=`、`AND` と `OR`）。でたらめな選択肢は置かない。`why` は「なぜ違うか」を1文で。間違いの選択肢を入れたSQLの**結果が正解と変わる**ように初期データを用意する（`>` と `>=` なら、境目の値の行を入れる。`checkWrongChoices` で止まる）。空欄は語の切れ目で始めて終える（`x = 10` の `= 1` のように語の途中で切らない。`checkBlanksPlayable` で止まる）
- **依頼に、出す列と並び順を書く**：モード4は依頼の会話だけを見て書くので、「名前と値段を」「高い順に」「アルファベット順で」のように、判定で比べるもの（列・`ordered` の並び・`checkColumnNames` の列名）が会話から決まるようにする
- **ヒント3段階**：①使う句 ②句の順番 ③骨組み（値や条件だけを `???` にしたSQL）
- **順番が1つに決まること**：`ordered: true` の問題は、並び順が同じ値の行で入れ替わらないように初期データを用意する（`checkOrderDetermined` で止まる）
- **書き換え系の比べない列**：`INSERT` の問題で SERIAL の `id` のように、正しい書き方でも値が変わる列は `judge.ignoreColumns` に書く
- **新しいキーワード**：問題で初めて使うキーワードは、同じ作業の中で `data/keywords.yaml` に追加する
- 問題を足したら、`npm run validate:data` が通ることを確かめる

## Git運用ルール

### ブランチ戦略

開発者が1人なので、Git Flow の `develop` は置かず、`main` と作業用ブランチだけにする。

- `main`：いつでも `npm run check` が通り、遊べる状態
- `feature/<作業名>`：`/add-feature` 1回分。作業名は `.steering/` のフォルダ名から日付を除いたもの（例：`feature/mode1-typing`）
- `fix/<内容>`：不具合の修正
- `docs/<内容>`：ドキュメントだけの変更

作業用ブランチは、完了条件をすべて満たしてから `main` にマージする。

### コミットメッセージ規約

**フォーマット**（Conventional Commits、件名は日本語）:
```
<type>(<scope>): <件名>

<本文：何を・なぜ>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
（最後の行は Claude Code がコミットするときに付ける）

**type**：`feat`（機能）／`fix`（不具合）／`docs`（ドキュメント）／`test`（テスト）／`refactor`（動きを変えない整理）／`style`（整形）／`chore`（設定・依存）／`content`（問題データ・会話・用語辞典の追加や修正）

**scope**：`typing`、`choice`、`judge`、`stepper`、`runner`、`progress`、`ui`、`data`、`docs` など

**例**:
```
feat(typing): なぞり書きの判定エンジンを追加

大文字・小文字を区別せず、文字列の中だけ区別する。
連続する空白と改行は1つの区切りスロットにまとめ、Space と Enter のどちらでも通す。
句の終わりで clauseEnded を返し、見える化C から使えるようにした。
```

### プルリクエスト（GitHub に置いた場合）

**作成前のチェック**：作業の完了条件（このガイドの最初の章）をすべて満たしている

**PRテンプレート**：
```markdown
## 概要
## 変更理由
## レビュー用の記録
docs/review/YYYYMMDD-<作業名>.md
## テスト
- [ ] npm run check
- [ ] npm run test:e2e（画面を変えた場合）
```
PR の本文は短くしてよい。詳しい内容は `docs/review/` の記録を正とする。

## テスト戦略

### テストの種類と目標

| 種類 | ツール | 対象 | 目標 |
|---|---|---|---|
| 単体テスト | Vitest | `src/core/` 全部、`src/data/progress-store.js` | `src/core/` の行カバレッジ 90% 以上 |
| 統合テスト | Vitest ＋ PGlite（Node 版） | `Judge`、`Stepper`、`SqlRunner` | 機能設計の項目をすべて |
| 問題データの検証 | Vitest ＋ PGlite（Node 版） | `data/` の全ファイル | 1件でも失敗したらビルドを止める |
| E2E | Playwright | 4モードのクリア、ターニングポイント、記録、狭い画面 | 機能設計のシナリオをすべて |

### テストの書き方

- `describe` に対象（関数名）、`it` に「どんなときに、どうなるか」を日本語で書く
- 1つの `it` で確かめることは1つにする
- 準備・実行・確認の順に書く

```js
describe('pressKey', () => {
  it('キーワードを小文字で打っても ok になる', () => {
    const state = createTypingState(buildTarget('SELECT * FROM products'));
    const { result } = pressKey(state, 's');
    expect(result).toBe('ok');
  });

  it('文字列の中で大文字・小文字が違うと miss になり、位置は進まない', () => {
    // typeText はテスト用の部品（tests/helpers/）。文字列を1文字ずつ pressKey する
    const state = typeText(createTypingState(buildTarget("WHERE name = 'Mug'")), "WHERE name = '");
    const next = pressKey(state, 'm');
    expect(next.result).toBe('miss');
    expect(next.state.position).toBe(state.position);
  });
});
```

### モック・作り物の使い方

- **PGlite は作り物にしない**：判定とステップ再生は本物の PostgreSQL の結果が大事なので、統合テストでは Node 版の PGlite を本当に動かす
- **localStorage**：`tests/helpers/memory-storage.js` の作り物に差し替える
- **乱数・時刻**：引数で固定の値を渡す

### TDD

コアレイヤー（`src/core/`）は、テストを先に書いてから実装する（`/tdd` スキルの red → green → refactor）。画面レイヤーは、先に E2E のシナリオを決めてから作る。

## コードレビュー基準

### レビューポイント

**機能性**
- [ ] PRD の受け入れ条件と、機能設計書の決まりを満たしているか
- [ ] 学習者の操作で起こること（エラー、タイムアウト、未対応の形）が結果のオブジェクトで扱われているか

**レイヤーと依存**
- [ ] `src/core/` が React・PGlite・DOM・localStorage を使っていないか
- [ ] 依存の向きのルール（アーキテクチャ設計書）を守っているか

**学習アプリとしての正しさ**
- [ ] 見える化が、実際の実行結果と一致しているか（最後の段階が元のSQLの結果と同じか）
- [ ] 判定が別解を正解にできているか
- [ ] 問題データの中身のルールを守っているか

**記録**
- [ ] `docs/review/` の記録があり、`check-review-files.js` が通っているか
- [ ] 「検証していないこと」が正直に書かれているか

### レビューコメントの書き方
- 優先度を付ける：`[必須]` 直さないとマージしない／`[推奨]`／`[提案]`／`[質問]`
- 問題だけでなく、代わりの案を書く

## 品質の自動化

- `npm run check`：ESLint ＋ Vitest（単体・統合・問題データの検証）
- `npm run validate:data`：問題データの検証だけ（問題を書いている間に使う）
- `npm run build` の前に `validate:data` が自動で走る（`prebuild`）
- GitHub に置いたら、GitHub Actions で `npm run check` と `npm run test:e2e` を push のたびに回す（P1 の公開と同じ時期に設定する）

## 開発環境セットアップ

### 必要なツール

| ツール | バージョン | インストール方法 |
|--------|-----------|-----------------|
| Node.js | v26.x | 公式サイトのインストーラー（手元は v26.12.1） |
| npm | 11.x | Node.js に同梱 |
| Git | 2.x | Git for Windows |
| Playwright のブラウザ | — | `npx playwright install chromium` |

### セットアップ手順

```bash
# 1. フォルダへ移動
cd C:\Development\sql-typing

# 2. 依存関係のインストール
npm ci

# 3. E2E用のブラウザ
npx playwright install chromium

# 4. 開発サーバーの起動
npm run dev
```
環境変数（`.env`）は使わない。

### npm スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー（Vite） |
| `npm run build` | ビルド（前に `validate:data`） |
| `npm run preview` | ビルドしたものを手元で開く |
| `npm run check` | ESLint ＋ Prettier の確認 ＋ 単体 ＋ 統合 ＋ 問題データの検証 ＋ `src/core/` の行カバレッジ 90%（`vitest run --coverage`） |
| `npm run validate:data` | 問題データの検証だけ |
| `npm run test:e2e` | ビルド ＋ Playwright |
| `npm run test:unit` / `npm run test:integration` | 単体だけ／統合だけ |
| `npm run check:review -- <記録> [作業前のコミット]` | レビュー用の記録と git の差分の照合（`node scripts/check-review-files.js` と同じ） |
| `npm run format` | Prettier で整形（Markdown は対象外） |
| `npm run format:check` | 整形のずれがないかの確認だけ（`npm run check` に含まれる） |

### 推奨開発ツール
- VS Code ＋ ESLint・Prettier の拡張機能（`jsconfig.json` の `checkJs` で JSDoc の型の間違いがエディタに出る）
- YAML の拡張機能（問題データを書くとき）
