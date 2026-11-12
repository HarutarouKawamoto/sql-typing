---
tags: [review, sql-typing, deploy, security]
created: 2026-11-13
updated: 2026-11-13
---
# 📝 20261113-github-pages：GitHub Pages で公開する準備

> - **対象**：ブランチ `claude/changes`（作業前のコミット `cb0428b`。見た目の作り直しを `main` にマージしたところ）
> - **steering**：なし（本人の「公開もしていいんじゃない？」「GitHub Pages がいい」での作業。決めることはチャットで聞いた）
> - **見るべき箇所**（最大3つ）：
>   1. `vite.config.js` 相対パスと Content Security Policy の `<meta>`
>   2. `.github/workflows/pages.yml` チェック・E2E を流してから公開
>   3. `src/schema/zod-config.js` CSP のための Zod の設定
> - **判断してほしいこと**：1件（配る量の目安）
> - **検証していないこと**：3件

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 変更 | `vite.config.js` | `base: './'`（GitHub Pages のサブフォルダ `/sql-typing/` でも、手元のルートでも動く）。ビルドのときだけ HTML の先頭に Content Security Policy の `<meta>` を入れるプラグイン（`font-src 'self' data:` を足した） |
| 追加 | `.github/workflows/pages.yml` | `main` への push（と手動）で、`npm ci` → Playwright の chromium → `npm run check` → `npm run test:e2e`（ビルドを含む）→ `dist/` を GitHub Pages に公開 |
| 追加 | `src/schema/zod-config.js` | Zod を `jitless` にする（CSP が `new Function` を許さず、Zod が試すたびに違反の知らせが出たため） |
| 変更 | `src/schema/index.js` | 最初に `zod-config.js` を読む |
| 変更 | `tests/e2e/smoke/app-boot.spec.js` | 公開する HTML に CSP が入り、見本のページ（Worker・WebAssembly・JOIN の再生・実行計画の木）で違反が起きないこと |
| 変更 | `docs/product-requirements.md` | 公開先を GitHub Pages に（URL、本人の希望で変えたこと、Actions で公開） |
| 変更 | `docs/architecture.md` | 依存の表（wrangler をやめた）、配る量の実測（2026-11-13）と何で測るか、CSP の入れ方と `font-src`・Zod、置き場所（相対パス）、圧縮（gzip） |
| 変更 | `docs/development-guidelines.md` | GitHub Actions で push のたびにチェックと E2E、通ったら公開 |
| 変更 | `docs/repository-structure.md` | `.github/workflows/pages.yml`・`vite.config.js` の説明、`zod-config.js` |
| 追加 | `docs/review/20261113-github-pages.md` | このファイル |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| ビルドした HTML | CSP なし、絶対パス（`/assets/…`） | 先頭に CSP の `<meta>`、相対パス（`./assets/…`） |
| 開発サーバー（`npm run dev`） | — | 変わらない（CSP を入れない） |
| データの形の検証（Zod） | 速い検証を試す | 試さない（結果は同じ） |

## なぜ

- **GitHub Pages**：本人の希望（最初の予定は Cloudflare Pages）
- **`<meta>` の CSP**：GitHub Pages はレスポンスのヘッダーを足せない。開発サーバーは React の再読み込みのためにページの中に直接スクリプトを書くので、ビルドのときだけ入れる
- **`font-src data:`**：ビルドの道具が 4KB 未満の書体のファイルを CSS に埋め込む。同梱の書体なので、外から読み込むわけではない。埋め込みをやめる（`assetsInlineLimit: 0`）と小さなファイルへの読み込みが増えるので、こちらにした
- **相対パス**：置き場所がサブフォルダになっても、手元の E2E（ルート）と同じビルドが動く
- **Actions でチェックと E2E を通してから公開**：開発ガイドラインの予定どおり。壊れたものを公開しない

## 検証

| やったこと | 結果 |
|---|---|
| CSP の違反を E2E で確かめた | 最初は書体（`data:`）と Zod（`eval`）が止められていた。直して、違反なし |
| 配る量を測った（一覧を開いて DB の準備が終わるまでに読むファイルを、gzip・brotli で縮めて足した） | brotli 4.42MB・gzip 6.30MB（79ファイル） |
| `npm run check` | 通った（656件） |
| `npm run test:e2e` | 通った（99件） |
| `node scripts/check-review-files.js docs/review/20261113-github-pages.md cb0428b` | OK |

**検証していないこと**：
- **GitHub の上での動き**：Actions の実行と、`https://harutaroukawamoto.github.io/sql-typing/` で開けることは、push のあとに確かめる（この記録の時点ではまだ push していない）
- **サブフォルダの上での動き**：手元の E2E はルート（`/`）で開いている。相対パスなのでサブフォルダでも同じはずだが、公開してから確かめる
- **GitHub Pages が `.wasm`・`.data` を gzip で配るか**：測った gzip の量は、全部のファイルが gzip で配られる前提

## 判断してほしいこと

- **配る量の目安（初回 5MB）**：GitHub Pages は gzip で配るので、初めて開くときは約 6.30MB になり、目安を超える（brotli なら 4.42MB）。大半は PGlite 本体で、削れるのは書体（約 0.5MB）くらい。目安を「gzip 6.5MB」に変えるか、書体を減らすかを決めてほしい

<details>
<summary>捨てた案・補足</summary>

- **Cloudflare Pages と wrangler**：本人の希望で GitHub Pages に変えた
- **`base: '/sql-typing/'`**：手元の E2E（ルートで開く）と合わなくなる

</details>
