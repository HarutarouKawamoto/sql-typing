---
tags: [review, sql-typing, visualization, schema-map]
created: 2026-11-12
updated: 2026-11-12
---
# 📝 20261112-schema-map：DBの地図

> - **対象**：ブランチ `feature/schema-map`（作業前のコミット `287eebb`）
> - **steering**：`.steering/20261112-schema-map/`
> - **見るべき箇所**（最大3つ）：
>   1. `src/ui/components/SchemaMapPanel.jsx` 読み込みの時機（開いたとき・モード選択だけ DB を準備し直す・失敗したら開き直しで読み直す）と光らせ方
>   2. `src/data/schema-info.js` 主キー・外部キーの読み方（pg_constraint の列の並びを同じ番号で対応させる）
>   3. `src/ui/state/schema-layout.js` 親を左・子を右に置く（中級でテーブルが増えたときのため）
> - **判断してほしいこと**：なし（本人の「上級まで作って」で、完了条件を満たしたらコミットしてマージする）
> - **検証していないこと**：5件

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 追加 | `.steering/20261112-schema-map/requirements.md` | 要求（触っているテーブル・スキーマの読み込み・地図・出す場所・受け入れ条件・スコープ外） |
| 追加 | `.steering/20261112-schema-map/design.md` | 設計。実装と実装検証で変えたところ（`prepareDb`・`databaseStatus`・親を左に置く・`maskBlankAnswers`）を追記 |
| 追加 | `.steering/20261112-schema-map/tasklist.md` | タスクと、実装検証の指摘への対応、振り返り |
| 追加 | `src/core/touched-tables.js` | `touchedTables(sql, tableNames)`：字句（`tokenize`）で、SQLに出てくるテーブル名を返す。引用符なしは小文字で、引用符つきは中身のまま比べる。閉じていない引用符は最後の文字を切らない |
| 変更 | `src/core/blank-typing.js` | `maskBlankAnswers(displaySql, blanks)`：`locateBlanks` で見つけた空欄の答えの文字を空白にする（長さと改行は変えない） |
| 追加 | `src/data/schema-info.js` | `loadSchema(runner)`：表の列（ビューは除く）・短い型・主キーと、外部キーのつながり（`pg_constraint` の `conkey`・`confkey` を同じ番号で対応、指す先が public のものだけ）。`loadTablePreview(runner, table, limit = 20)`：先頭の行と `count(*)`。テーブル名は `"` で囲み中の `"` を2つに |
| 追加 | `src/ui/state/schema-layout.js` | `layoutTables(tables, relations)`：親をたどった深さを列にし、同じ列は上から積む。自分を指すつながりは使わない。輪でも止まる。`SCHEMA_LAYOUT`（箱の大きさの目安） |
| 追加 | `src/ui/components/SchemaMap.jsx` | React Flow の地図。箱（`TableNode`：名前・使用中・NEW・列名・PK・FK・型）、線（親の右 → 子の左、両方を触っていれば青く太く）。キー・ホイール・フォーカスを切る。図は `aria-hidden` にし、読み上げ用の一覧（テーブル・列・つながり）を出す |
| 追加 | `src/ui/components/SchemaMap.module.css` | 箱・光り方・印・線（見える線だけ）・つなぎ口を隠す・768px 未満で高さを足す・読み上げ用の隠し方 |
| 追加 | `src/ui/components/SchemaMapPanel.jsx` | 「DBの地図を見る」の `details`。開いたときに `runDbJob` で読む（モード選択は `prepareDb` を先に）。失敗したら開き直しで読み直す。章の `tables` だけ出す。光るテーブルは変わったときだけ。「中身を見る」のボタン（`aria-current`）と、先頭20行・全部の行数（`aria-live`）。`SchemaMap` は `lazy` で、開くまで読まない |
| 追加 | `src/ui/components/SchemaMapPanel.module.css` | 枠・状態の文・ボタン・中身の見出し |
| 変更 | `src/ui/screens/ModeSelect.jsx` | 「DBの地図を見る」を置く（光らせない）。props に `runner`・`chapter`・`prepareDb` |
| 変更 | `src/ui/App.jsx` | モード選択に、問題の章・runner・`prepareDb`（章の初期データと問題の `extraSql` で DB を作り直す）を渡す |
| 変更 | `src/ui/screens/PlayScreen.jsx` | 読み込んだ章も持ち、PlayMode12・PlayMode34 に渡す |
| 変更 | `src/ui/components/PlayMode12.jsx` | 「依頼の会話を見る」の下に地図。光らせるSQLは表示用SQL（モード2は `maskBlankAnswers` で空欄の答えを空白にしたもの）。props に `chapter` |
| 変更 | `src/ui/components/PlayMode34.jsx` | 依頼の下に地図（書いているSQLで光らせる）。props に `chapter` |
| 変更 | `playwright.config.js` | 1つのテストの上限を60秒に（並べて流すと PGlite の起動だけで20秒を超え、30秒の上限で落ちるテストがあった） |
| 追加 | `tests/unit/core/touched-tables.test.js` | 7件：大文字・小文字、文字列・コメント、語の一部、引用符つき、閉じていない引用符、打っている途中、列名と同じ名前 |
| 変更 | `tests/unit/core/blank-typing.test.js` | `maskBlankAnswers` の5件（1つ、改行・字下げ、大文字・小文字、2つ、空欄なし） |
| 追加 | `tests/unit/ui/schema-layout.test.js` | 7件：1つ、中級の形、自己結合、輪、地図にないテーブルへのつながり、つながりなし、空 |
| 追加 | `tests/integration/data/schema-info.test.js` | 11件：products の列・型・主キー、外部キーと型、2つの列の主キー、2つの列の外部キー、同じ名前の制約、別スキーマ・ビュー、空、先頭20行と行数、上限、変わった名前、ないテーブル |
| 追加 | `tests/e2e/map/schema-map.spec.js` | 7件：モード選択から開く（列・型・PK・NEW・光らない・中身）、「中身を見る」のあと遊べる、モード1で光る、モード4で書くと光り消すと消える、地図を開いたまま打てる、モード2で空欄の答えは光らない、幅375px |
| 変更 | `docs/functional-design.md` | TouchedTables・SchemaInfo の節、`maskBlankAnswers`、コンポーネントの表（ModeSelect・PlayScreen・PlayMode12・PlayMode34・SchemaMap・SchemaMapPanel）、狭い画面の説明、遊ぶ画面の配置（右下の小窓 → 開いて見る枠）、テスト戦略 |
| 変更 | `docs/repository-structure.md` | 新しいファイル（`touched-tables.js`・`schema-info.js`・`schema-layout.js`・`SchemaMap.jsx`・`SchemaMapPanel.jsx`・テスト・`map/`）、`table-list.js` の説明（仮ではなく、地図を開かなくても名前がわかるように残す） |
| 変更 | `docs/architecture.md` | E2E の1つのテストの上限を60秒にした理由 |
| 変更 | `docs/product-requirements.md` | 機能10「結合の線も光る」に、今は線の両方のテーブルを触っていれば光ると注記 |
| 追加 | `docs/review/20261112-schema-map.md` | このファイル |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| モード選択 | テーブルは見られない | 「DBの地図を見る」で箱（列・型・PK・NEW）と、押すと先頭20行。幅の狭い画面でも見られる |
| モード1・2 | テーブルは見られない | 「DBの地図を見る」（ふだんは閉じる）。表示用SQLが使うテーブルが光る（モード2の空欄の答えは光らせない） |
| モード3・4 | テーブルと列の名前の一覧だけ | 一覧に加えて「DBの地図を見る」。書いているSQLが使うテーブルが書くたびに光る |
| E2E | 1つのテストの上限30秒 | 60秒 |

## なぜ

- **開いて見る枠にした（機能設計の「右下の小窓」をやめた）**：打つ画面は入力エリアを真ん中に大きく置いている。小窓を重ねると打つSQLや結果の表を隠す。「依頼の会話を見る」と同じ、ふだんは閉じる枠にそろえた
- **モード選択では光らせない**：モード4は依頼の会話だけで書く。どのテーブルを使うかを地図で見せると答えのヒントになる
- **モード2は空欄の答えを抜いて光らせる**：空欄にテーブル名がある問題（1問目の `FROM products`）で、地図から答えがわかってしまう。空欄の位置は本物の空欄と同じ `locateBlanks` で決める（実装検証で、文字の素朴な一致では改行・大文字小文字の違いでずれると指摘された）
- **モード選択で DB を作り直す**：DB は1つで、前に遊んだ問題の状態（中級以降は章ごとに違う初期データ）のままのことがある。遊ぶ画面に入るときも作り直すので、二度作ることになるが、作り直しは数ms
- **親を左・子を右**：初級はテーブルが1つで線がないが、中級で customers ← orders ← order_items → products になる。章の順に横に並べるだけだと、線が箱の裏を回る（実装検証の必須1）
- **pg_constraint で読む**：information_schema で結ぶと、2つの列の外部キーで（2×2の）4本の線になり、別のテーブルの同じ名前の制約が混ざる
- **図は読み上げから隠し、一覧で出す**：React Flow の図の中は、キーで箱に移っても何もできない（押す操作は「中身を見る」のボタンでできる）。同じ中身を文で読めるほうが確実
- **React Flow を開くまで読まない**：ふだんは閉じている機能で、ライブラリが大きい（地図の部品で 187KB）
- **E2E の上限を60秒に**：全部を並べて流すと、PGlite の起動中の画面のまま30秒の上限に当たるテストが毎回1〜2件出た（地図のテストに限らない）。テストの中の起動待ち（30秒）より長くした

## 検証

| やったこと | 結果 |
|---|---|
| コア・データ・置き方のテストを先に書いた | `touched-tables`・`schema-info`・`schema-layout` の17件、実装検証のあとの `maskBlankAnswers`・中級の置き方・2つの列の外部キーなど12件も、失敗を見てから実装した |
| `npm run check` | 通った（477件。`src/core/` の行カバレッジ 98.27%） |
| `npm run test:e2e` | 通った（66件。今回足した分は7件）。全部を流すと、PGlite の起動の遅さで30秒の上限に当たるテストがあった → 上限を60秒にしてから通った。home-story を4回くり返しても通った |
| 目で確かめた（Playwright で撮った） | モード選択（1280px ダーク・375px ライト）の地図と中身、モード1で光った地図、モード4で書いて光った地図（「使用中」の印）。モード1で地図を開いたまま打てた |
| 実装検証（implementation-validator） | [必須] 2件・[推奨] 5件・[提案] 5件。すべて直した。対応は `.steering/20261112-schema-map/tasklist.md` |
| `node scripts/check-review-files.js docs/review/20261112-schema-map.md 287eebb` | OK |

**検証していないこと**：
- **中級のテーブルが入ったときの見た目**：線と置き方は単体テストの位置だけ。中級の初期データを入れる作業で目で確かめる
- **幅375pxで、テーブルが4つ以上あるときの文字の大きさ**：高さは足したが、中級のテーブルで見ていない
- **地図の枠のつまみ（summary）にフォーカスがあるときの Enter**：モード1・2では打つキーとして使われるので、期待の文字でない Enter が地図を閉じるかは確かめていない（「依頼の会話を見る」と同じ）
- **読み上げソフトでの聞こえ方**：読み上げ用の一覧は DOM で見ただけ
- **地図を読めなかったときの画面と、開き直しで読み直すこと**：コードを読んで確かめただけ（失敗を起こすテストがない）

## 判断してほしいこと

- なし

<details>
<summary>捨てた案・補足</summary>

- **右下の小窓（機能設計の最初の案）**：上の「なぜ」
- **一覧画面に章ごとの地図**：要求のスコープ外。用語辞典の画面を作るときに、一覧からの入口と一緒に考える
- **JOIN の ON で使ったつながりだけ光らせる**：要求のスコープ外。今は線の両方のテーブルを触っていれば光る
- **地図を開いたまま、テーブルを押す操作をキーでも**：図の中はフォーカスしない。「中身を見る」のボタンで同じことができる

</details>
