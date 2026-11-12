# タスクリスト

## 🚨 タスク完全完了の原則

- 全タスクが `[x]` になるまで作業を続ける
- スキップは技術的な理由があるときだけ。理由を書く

## フェーズ1：コアと置き方
- [x] `plan-layout.test.js` を先に書き、`layoutPlan`・`edgeWidth`
- [x] `explainQuery` のテストを先に書き、実装する

## フェーズ2：画面
- [x] `PlanTree`・`PlanTreePanel`
- [x] PlayMode34 と見本のページにつなぐ

## フェーズ3：E2E と確かめ
- [x] E2E `plan-tree.spec.js`
- [x] 目で確かめる
- [x] `npm run check` と `npm run test:e2e`

## フェーズ4：検証と記録
- [x] 実装検証（implementation-validator）と指摘への対応
- [x] 永続ドキュメントを直す
- [x] `docs/review/20261112-plan-tree.md` を書き、`check-review-files.js` が通る
- [x] 振り返りを書く
- [x] コミットして main にマージ（本人の「上級まで作って」で決めた進め方）

## 実装検証の指摘への対応

| 指摘 | 対応 |
|---|---|
| [中] 箱の文字が箱からはみ出す（索引名・回数） | 直した。箱を 240×104 の5行にし、索引を別の行へ。入らない文字は `fitText` で後ろを「…」にし、全文は箱の `title` |
| [中] コメントが docs にない節を指す | 直した。docs の `PlanTree`・`PlanTreePanel` の行を足し、コメントを「docs/functional-design.md の PlanTree」に |
| [中] `NODE_WORDS` と IndexRace の `SCAN_WORDS` の言葉が違う | 直した。`SCAN_WORDS` を消し、IndexRace も `NODE_WORDS` を使う（IndexRace の言葉に寄せた） |
| [中] 実行されなかった節の文字まで薄い | 直した。箱を点線にし、文字は薄くしない（muted の色）。線と矢印だけ薄く |
| [低] 子が多い節で矢印が1点に重なる | 直した。`toOffset` で親の箱の下の辺の中で左右にずらす |
| [低] 線の行数の文字が隣の線とぶつかりうる | 見送り。文字は線が曲がっていく方と反対の側に置いた。節の多い木で重なるかは、上級の問題の SQL で目で確かめる |
| [低] 副問い合わせが普通の子と同じ見た目 | 直した。`PlanNode.subplan`（Parent Relationship が SubPlan・InitPlan）を足し、線を点線にして「副問い合わせ」と書く |
| [低] 読み上げの行数が区切られない、「に渡す節」 | 直した。3桁ごとに区切る、「〇〇 の下の節」。IndexRacePanel の同じ書き方は、この作業では触らない |
| [低] PlanTreePanel の分岐が複雑 | 見送り。IndexRacePanel と同じ形にそろえておく |
| テストの抜け（置き方・文字・WITH・小文字・pageerror・status） | 足した。JSON の形が違うとき・打ち切りは `compareChange` と同じ `explain` を通るので足していない。書く画面の経路は上級の問題の作業で E2E を足す |

## 申し送り事項（振り返り）

- **実装完了日**：2026-11-12
- **計画と実績の差分**
  - 設計では y を「一番深い深さ − d」で書いていたが、SVG は下へ y が増えるので d × 段の高さが正しかった（テストで気づいた）
  - 矢印を SVG の marker で描くと太い線で大きくなりすぎたので、線の太さに合わせた三角形にした
  - 実装検証のあと、副問い合わせ（`subplan`）・文字の縮め方・点線の箱を足した。見本を2つにした（実行されなかった節を見せるため）
- **学んだこと**
  - PostgreSQL は、外の行が0行だと行ごとの副問い合わせを1回も実行しない（loops 0）。Hash Join も、探す表が空なら外側を1行しか読まない
  - SVG の `<text>` は折り返さない。文字の幅を見積もって縮めるしかない
- **次回への改善提案**
  - 上級の問題に `visual: { kind: plan }` の問題を入れ、書く画面での木を E2E で確かめる
