---
tags: [review, sql-typing, git]
created: 2026-11-11
updated: 2026-11-11
---
# 📝 20261111-gitattributes-lf：改行を LF に固定

> - **対象**：ブランチ `chore/gitattributes-lf`（作業前のコミット `053cc54`）。まだコミットなし
> - **steering**：なし（手での小さな修正のため）
> - **見るべき箇所**（最大3つ）：
>   1. `.gitattributes:4` `* text=auto eol=lf`。全部の文字のファイルに効く
> - **判断してほしいこと**：1件
> - **検証していないこと**：1件

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 追加 | `.gitattributes` | 文字のファイルの改行を LF に固定。画像・フォント・`.wasm` を `binary` にした |
| 変更 | `docs/repository-structure.md` | ルートのファイルの図に `.gitattributes` を足し、「改行（.gitattributes）」の節を足した |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| git がファイルを書き出すとき（ブランチの切り替え・clone・`git checkout -- <ファイル>`） | `core.autocrlf=true` のため改行が CRLF になる | LF のまま |
| `npm run check` の Prettier の確認 | 書き出し直したファイルが CRLF になると落ちる | 落ちない |

## なぜ

- 最初のコミットのときに「LF will be replaced by CRLF」の警告が全ファイルで出た。この PC の git が `core.autocrlf=true` のため。手元のファイルは LF だったので、その時点では何も壊れていなかった
- Prettier は `endOfLine: lf`（既定）で確認するので、git が CRLF で書き出したファイルがあると `npm run format:check` が落ち、作業の完了条件の `npm run check` が通らなくなる
- 個人の git の設定（`core.autocrlf`）を変えるのではなく、リポジトリの `.gitattributes` で決めた。誰の PC で clone しても同じになるため
- `binary` の指定は、今は該当するファイルがない。上級で使う WebAssembly やフォントを同梱したときに、改行の変換で壊れないように先に書いた

## 検証

| やったこと | 結果 |
|---|---|
| `git add --renormalize .` | `.gitattributes` 以外に変わるファイルはなかった（索引にはもともと LF で入っていた） |
| `git ls-files --eol` | 48ファイルすべて、索引も作業ツリーも LF |
| `src/main.jsx` を消して `git checkout -- src/main.jsx` で書き出し直す | LF のまま（`i/lf w/lf attr/text=auto eol=lf`） |
| `npm run check` | 通った（77件） |
| `node scripts/check-review-files.js docs/review/20261111-gitattributes-lf.md 053cc54` | OK |

**検証していないこと**：
- **別の PC での clone**：この PC でファイルを書き出し直すところまでしか試していない。確かめ方：別のフォルダに `git clone` して `git ls-files --eol` と `npm run check`

## 判断してほしいこと

- **コミットとマージ**：まだコミットしていない。このブランチでコミットし、`main` にマージしてよいか
