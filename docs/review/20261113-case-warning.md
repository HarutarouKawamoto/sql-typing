---
tags: [review, sql-typing, bugfix, typing]
created: 2026-11-13
updated: 2026-11-13
---
# 📝 20261113-case-warning：文字列の大文字・小文字で止まったように見える

> - **対象**：作業前のコミット `2ced34d`（公開した `main`）
> - **steering**：なし（本人の不具合の知らせ「初級のターニングポイントで、ここで画面が止まってしまいます」）
> - **見るべき箇所**（最大3つ）：
>   1. `src/core/typing-engine.js` 大文字・小文字だけが違う miss の `caseOnly`
>   2. `src/ui/state/use-typing-session.js` 知らせを出す条件（`caseOnly` か Caps Lock）
>   3. `src/ui/components/PlayMode12.jsx` 知らせの文
> - **判断してほしいこと**：なし
> - **検証していないこと**：2件

## 何が起きていたか

- モード2で、初級のターニングポイントの `AND category IN ('kitchen', …)` の `k` で先に進めなくなった（本人の画面では `k` が赤い打ち間違いの印）
- 手元のビルドと公開した URL で、同じ文字を打つと最後まで打ち切れた。なので、打っているキーの違いを疑った
- 打つ決まりでは、文字列（`'…'`）の中だけは大文字・小文字を区別する（SQL として正しい）。Caps Lock がオンのまま打つと、キーワードは大文字でも通るので気づかず、最初の文字列の `k` で `K` が打ち間違いになり続ける。理由が出ないので、止まったように見えた（推定。本人の環境で Caps Lock だったかは確かめていない）

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 変更 | `src/core/typing-engine.js` | 文字列・識別子の中で、大文字・小文字だけが違う miss に `caseOnly: true` を付ける（決まりは変えない） |
| 変更 | `src/core/blank-typing.js` | 空欄つきの打ち方の結果の型に `caseOnly`（空欄の外の打ち方から受け継ぐ） |
| 変更 | `src/ui/state/use-typing-session.js` | `caseOnly` の miss か、Caps Lock がオンのまま打ち間違えたら `caseWarning` を立て、正しく打てたら消す |
| 変更 | `src/ui/components/PlayMode12.jsx` | 「文字列（'…' の中）は大文字・小文字を区別します。Caps Lock がオンになっていませんか？」を、日本語入力の知らせと同じ形で出す |
| 変更 | `tests/unit/core/typing-engine.test.js` | `caseOnly` が付くこと・違う文字や文字列の外では付かないこと |
| 変更 | `tests/unit/core/blank-typing.test.js` | 空欄つきの打ち方でも `caseOnly` が届くこと |
| 変更 | `tests/e2e/play-modes/mode1-trace.spec.js` | 初級4問目で、大文字で打ってきて `'K'` を打つと知らせが出て、`k` で消えること |
| 変更 | `docs/functional-design.md` | 打つ決まりに `caseOnly` と知らせ、画面の配置、テスト戦略 |
| 追加 | `docs/review/20261113-case-warning.md` | このファイル |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| モード1・2で文字列の中を大文字・小文字違いで打つ | 赤い印だけで、理由が出ない | 理由と「Caps Lock がオンになっていませんか？」を出す。正しく打てたら消える |
| 打つ決まり | — | 変わらない（文字列の中は区別する） |

## 検証

| やったこと | 結果 |
|---|---|
| 再現を試した（手元のビルドと公開した URL。同じ文字、打ち間違いを1回はさむ形も） | どちらも最後まで打ち切れた（止まらない）。Playwright の打ち方では本人の止まり方は再現しなかった |
| テストを先に書いた | `caseOnly` の単体テストは失敗を見てから実装した |
| `npm run check` | 通った（658件）。1回目は、再現に使った一時ファイルがフォルダに残っていて lint で落ちた（消した） |
| `npm run test:e2e` | 通った（100件） |
| `node scripts/check-review-files.js docs/review/20261113-case-warning.md 2ced34d` | OK |

**検証していないこと**：
- **本人の環境で Caps Lock が原因だったか**：推定。違う原因（日本語入力のかな入力など）なら、この知らせは出ない
- **モード2の空欄の選択肢を大文字で打ったとき**：Caps Lock の判定（`getModifierState`）で知らせるが、E2E では確かめていない

## 判断してほしいこと

- なし
