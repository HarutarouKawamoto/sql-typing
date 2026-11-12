---
tags: [review, sql-typing, problems, content, beginner]
created: 2026-11-12
updated: 2026-11-12
---
# 📝 20261112-beginner-problems：初級1章の問題（2〜8問目とターニングポイント）

> - **対象**：ブランチ `feature/beginner-problems`（作業前のコミット `6008d3f`）。まだコミットなし
> - **steering**：`.steering/20261112-beginner-problems/`
> - **見るべき箇所**（最大3つ）：
>   1. `data/problems/beginner/09-turning-point.yaml` ターニングポイント（会話11行、空欄3つ、LIMIT 5 にした理由）
>   2. `data/problems/beginner/03-where.yaml` 間違いの選択肢に `>` を使わない理由（ちょうど1000円の商品がない）
>   3. `src/ui/styles/global.css` 合字をサイト全体で切る（`>=` が ≥ に描かれていた）
> - **判断してほしいこと**：1件
> - **検証していないこと**：4件
> - **本人が遊んでの指摘を2つ入れた**：打っている途中に入力欄の大きさが変わる → 直した、直したあと空白の区切りで印がずれて2つ出た → 直した、問題を解いているときに依頼の会話を見返せない → モード1・2に「依頼の会話を見る」

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 変更 | `data/chapters.yaml` | 初級の `problemIds` を9問に（最後がターニングポイント）。「2〜9問目はあとで足す」のコメントを消した |
| 変更 | `data/keywords.yaml` | AS・WHERE・AND・OR・IN・BETWEEN・LIKE・IS NULL・IS NOT NULL・ORDER BY・DESC・ASC・LIMIT・DISTINCT の14語 |
| 追加 | `data/problems/beginner/02-select-columns.yaml` | 2問目「名前と値段だけでいい」：`SELECT name AS item, price FROM products`（列の名前も比べる）。空欄 `name AS item`（間違い：逆向きの `item AS name`、同じ名前が2つになる `name AS price`） |
| 追加 | `data/problems/beginner/03-where.yaml` | 3問目「1000円以上の商品」：`WHERE price >= 1000`（21行）。空欄 `price >= 1000`（間違い：`price <= 1000`・`price = 1000`） |
| 追加 | `data/problems/beginner/04-and-or.yaml` | 4問目「キッチン用品の在庫切れ間近」：`WHERE category = 'kitchen' AND stock < 5`（4行）。空欄 `'kitchen'`（間違い：' のない `kitchen`）と `AND`（間違い：`OR`）。表示用SQLは句ごとに改行 |
| 追加 | `data/problems/beginner/05-in-between.yaml` | 5問目「特集に合う商品」：`IN ('kitchen', 'bag') AND price BETWEEN 500 AND 2000`（10行、IN と BETWEEN を必ず使う）。空欄 `IN (...)`（間違い：`NOT IN (...)`）と `BETWEEN 500 AND 2000`（間違い：逆の `BETWEEN 2000 AND 500`） |
| 追加 | `data/problems/beginner/06-like-null.yaml` | 6問目「仕入れ先の確認」：`name LIKE '%Mug%' OR supplier IS NULL`（9行、LIKE と IS NULL を必ず使う）。空欄 `'%Mug%'`（間違い：`'Mug%'`）と `IS NULL`（間違い：`= NULL`） |
| 追加 | `data/problems/beginner/07-order-limit.yaml` | 7問目「高い順に5つ」：`ORDER BY price DESC LIMIT 5`（並びも比べる）。空欄 `DESC`（間違い：`ASC`）と `LIMIT 5`（間違い：`OFFSET 5`） |
| 追加 | `data/problems/beginner/08-distinct.yaml` | 8問目「扱っているカテゴリ」：`SELECT DISTINCT category ... ORDER BY category`（4行、並びも比べる）。空欄 `DISTINCT`（間違い：`ALL`） |
| 追加 | `data/problems/beginner/09-turning-point.yaml` | ターニングポイント「セール前夜のリスト」：WHERE に4つの条件、ORDER BY、LIMIT 5（5行、並びと列の名前も比べる）。会話11行。空欄 `IS NOT NULL`・`BETWEEN 1000 AND 5000`・`DESC` |
| 変更 | `docs/development-guidelines.md` | 問題データの書き方に「依頼に、出す列と並び順を書く」（モード4は会話だけで書くため） |
| 変更 | `docs/functional-design.md` | 「初級1章の問題（案）」を「初級1章の問題」に。PlayMode12 に依頼の会話、TypingArea の大きさを打ち終えた形に固定、遊ぶ画面の配置（帯の下、モード1・2）。ターニングポイントを LIMIT 5 に、その理由と、3問目の間違いに `>` を使わない理由。問題データの検証に `checkStepsBuild`。E2E の方針（次の問題へ、ターニングポイント、合字） |
| 変更 | `docs/repository-structure.md` | `tests/e2e/play-modes/typing-layout.spec.js`、`data/problems/beginner/` の例、`tests/e2e/progression/turning-point.spec.js`・`helpers/seed-progress.js` の説明、`checkStepsBuild` |
| 変更 | `src/ui/components/PlayMode12.jsx` | 帯の下に「依頼の会話を見る」（details。ふだんは閉じる。開いたまま打てる）（本人の希望） |
| 変更 | `src/ui/components/PlayMode12.module.css` | 依頼の会話の欄の見た目 |
| 変更 | `src/ui/components/TypingArea.jsx` | 打ち終えた形（表示用SQLそのまま）の見えない文字を重ね、入力欄の大きさを固定する。表示の中身を `content` の span に入れた。改行を含む区切りに `lineBreak` のクラス（本人の指摘） |
| 変更 | `src/ui/components/TypingArea.module.css` | 入力欄を grid にして、見えない文字（`::before` の `attr(data-text)`）と今の表示を重ねる。今の位置が改行を含む区切りのときの印を、inline-block の幅ではなく absolute の `::after` で描く（空白の区切りには付けない） |
| 変更 | `src/ui/styles/global.css` | 合字（`>=` を ≥ の1文字に描くなど）を body でサイト全体に切る。入力欄はブラウザの既定で受け継がないので `code`・`pre`・`textarea` にも書く |
| 変更 | `tests/e2e/helpers/open-play.js` | `openPlay`・`openModeSelect` に、開く問題を選べる引数を足した（既定は1問目） |
| 追加 | `tests/e2e/helpers/seed-progress.js` | 学習記録（progress-schema の形）を localStorage に入れてからページを開く `seedProgress`、8問目までクリアした状態 `BEFORE_TURNING_POINT` |
| 変更 | `tests/e2e/play-modes/mode1-trace.spec.js` | 「次の問題がないときの Enter は何もしない」を消した（1問目のあとは2問目がある）。打つSQLが合字を使わないことのテスト |
| 変更 | `tests/e2e/play-modes/mode3-4-write.spec.js` | ヒント③の骨組みと入力欄が合字を使わないことのテスト |
| 変更 | `tests/e2e/progression/home-story.spec.js` | 一覧に9問・2問目は閉じている・最後にターニングポイントの印。1問目のクリアで2問目が開く。クリアのあとの Enter・J で2問目のモード選択へ。前の「次の問題はまだありません」のテストを置き換えた |
| 追加 | `tests/e2e/play-modes/typing-layout.spec.js` | 4件：今の位置の印（空白は重ねる印なし、改行は重ねる印あり）、7問目をモード1で1文字ずつ打っても入力欄の大きさが変わらない、4問目のモード2で空欄が埋まっても変わらない、依頼の会話を開いて見られ開いたまま打ち終えられる |
| 追加 | `tests/e2e/progression/turning-point.spec.js` | 3件：8問目までクリアでターニングポイントが開き、印と説明が出る。7問目までだとまだ閉じている。会話11行、モード1でクリアすると反応の会話（次の章はまだないので Enter・J は何もしない） |
| 変更 | `tests/helpers/answer-checks.js` | `checkStepsBuild`（正解SQLのステップ再生が作れる。mismatch・error を止め、unsupported と書き換え系は止めない） |
| 変更 | `tests/integration/data-validation/answer-checks.test.js` | `checkStepsBuild` が、作れる問題・集計（unsupported）・書き換え系を通し、エラーになる問題を見つけること |
| 変更 | `tests/integration/data-validation/problems.test.js` | 本物の問題データに `checkStepsBuild` をかける |
| 変更 | `tests/integration/stepper/beginner-steps.test.js` | ターニングポイントの形を LIMIT 5 に |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| 一覧 | 初級1問（その問題にターニングポイントの印はなし） | 初級9問。1問目をクリアすると2問目が開き、順に開いていく。9問目にターニングポイントの印 |
| クリアのあと | 次の問題はまだない | Enter・J で次の問題のモード選択へ |
| SQLの文字 | `>=` などが合字で ≥ の1文字に描かれていた | 2文字のまま描く（打つSQL・ヒント・入力欄・結果の表など、サイト全体） |
| 問題データの検証 | ステップ再生が作れるかは見ていなかった | 全問の正解SQLで、ステップ再生が作れることを確かめる |
| 打っている途中の入力欄 | 改行の区切りが今の位置のとき、次の行が前の行の後ろに付いて大きさ・形が変わった。モード2で空欄が埋まると広がった | 大きさは打ち終えた形のまま変わらない |
| モード1・2の画面 | 依頼の会話は遊ぶ前にしか読めない | 「依頼の会話を見る」で開いて見られる |

## なぜ

- **3問目の間違いに `>` を使わない**：初期データにちょうど1000円の商品がないので、`price > 1000` は正解と同じ結果になる（問題データの検証で止まる）。境目の行を足すと、ほかの問題とテスト（30行・印の数など）が数えている行数が変わるので、初期データは変えず、`<=` と `=` にした
- **ターニングポイントを LIMIT 5 に**：機能設計書の表の `LIMIT 10` だと、WHERE のあとに8行しか残らず LIMIT が何もしない。ステップ再生でも LIMIT の段階で何も起きない
- **依頼に、出す列と並び順を書いた**：実装検証で、3〜7問目は会話に出す列がなく、8問目は並べ替えの指定がないと指摘された。モード4は依頼の会話だけを見て書くので、`SELECT *` や ORDER BY なしで書くと、理由がわからないまま不正解になる。開発ガイドラインの決まりにも足した
- **合字をサイト全体で切る**：開発サーバーで3問目を見たとき、`>=` が ≥ の1文字に描かれていた（コード用のフォント Cascadia Code の合字）。見えた形のまま打とうとすると打てない。最初は `code`・`pre`・`textarea` だけに付けたが、実装検証でヒント③（span）に効いていないと実測された。SQLが出る場所は多いので、受け継がれる値として body に1回書いた
- **ステップ再生が作れるかを問題データの検証に足した**：画面ではクリアの結果と書く画面からステップ再生を開ける。作れない（mismatch・error）と「作れませんでした」と出てしまうので、問題を足したときに機械で止める
- **入力欄の大きさを打ち終えた形に固定した**：本人が7問目を遊んで、DESC のあとで LIMIT 5 が前の行に上がり、入力欄の大きさが変わると指摘した。原因は、今の位置の区切りを見やすくするために inline-block で最低限の幅を付けていたこと。改行の区切りが箱の中に閉じ込められ、次の行が前の行の後ろに付いていた。印を行の並びに影響しない absolute の `::after` で重ねる形にした。最初は空白の区切りにも付けたので、空白の背景の色とずれて2つの印が出た（本人の指摘）。重ねる印は改行を含む区切りだけにした。さらに、モード2で空欄が埋まると「？」の箱と答えの幅の違いで広がるので、打ち終えた形の見えない文字を同じ場所に重ねて大きさを決めた（文字は `::before` の `attr()` で描くので、読み上げ・textContent には入らず、答えが画面の文字として漏れない）
- **依頼の会話をモード1・2の画面で開けるようにした**：本人の希望。入力エリアを下へ押し下げないよう、ふだんは閉じた `details` にした。開くためにクリックしたあと、フォーカスが「依頼の会話を見る」に残っても、Space・Enter は打つキーとして使われ（打つ処理が preventDefault する）、閉じない
- **ファイル名を機能設計書にそろえた**：最初は `02-columns-as.yaml` などで書いたが、機能設計書の一覧（`02-select-columns.yaml`・`03-where.yaml`・`04-and-or.yaml`）に合わせた

## 検証

| やったこと | 結果 |
|---|---|
| 問題データの検証（`npm run validate:data`） | 9問とも、形・会話の行数と長さ・空欄と選択肢・間違いの選択肢で結果が変わる・並びが1つに決まる・句の途中まで実行できる・打てる・ステップ再生が作れる、を通った。最初は `chapters.yaml` に入れるまで「problemIds に入っていない」で止まった |
| `checkStepsBuild` はテストを先に書いた | 関数がなくて失敗することを確かめてから実装した |
| `npm run check` | 通った（431件。`src/core/` の行カバレッジ 98.2%。今回 `src/core/` は変えていない） |
| `npm run test:e2e` | 通った（52件。本人の指摘の分が4件）。ターニングポイントの E2E は最初、会話の1行目が出る前に Enter を押して4回に2回落ちた → 1行目を待つように直し、4回くり返して通った |
| 開発サーバーで目で確かめた（1280px、ダーク） | 一覧の9問、4問目のモード2の隣り合う空欄と選択肢、3問目のステップ再生で WHERE の印9行（30行 → 21行）、クリア後の会話。`>=` が ≥ に描かれていたのはここで見つけた。確かめのために開発用のページの学習記録に「8問目までクリア」を入れ、終わったあと元の記録にもどした |
| 実装検証（implementation-validator） | [必須] 0件・[推奨] 4件・[提案] 8件。全問の正解SQL・間違いの選択肢・会話の数字（21商品・4つ・5つ・レザーのショルダーバッグなど）を Node の PGlite で実際に流して確かめられ、すべて合っていた。対応と見送りの理由は `.steering/20261112-beginner-problems/tasklist.md` |
| `node scripts/check-review-files.js docs/review/20261112-beginner-problems.md 6008d3f` | OK |

**検証していないこと**：
- **ターニングポイントをモード3・4でクリアすると次の章が開くこと**：次の章（中級）がまだない。進む条件の単体テストだけ
- **モード4で、会話だけを読んで各問題を書けるか**：会話に列と並びを足したが、本人が遊んで確かめてはいない
- **直したあとの会話の目での確認**：会話を直したあとの画面は、7問目の依頼の会話（「依頼の会話を見る」を開いたところ）しか見ていない
- **ライトモードの見た目**

## 判断してほしいこと

- **コミット**：まだしていない。このブランチでコミットし、`main` にマージしてよいか

<details>
<summary>捨てた案・補足</summary>

- **初期データにちょうど1000円の商品を足す**：3問目で `>` と `>=` の違いを見せられるが、30行・印の数・各問題の行数を数えているテストと会話がすべて変わる
- **エラーになる間違いの選択肢を、結果の変わる選択肢に置き換える**（02 の `item AS name`、04 の `kitchen`）：' の付け忘れ・AS を逆に書くのは、初心者がよくする間違いそのもの。エラーのときは判定で和訳が出る（モード2は why を出す）
- **stepper のテストを YAML から作る**：形の違う例も並べたテストなので手書きのまま。本物の全問は `checkStepsBuild` で確かめる
- **ASC を問題の keywords に入れる**：どの問題でも正解SQLには出てこない（7問目の間違いの選択肢だけ）。用語辞典の画面の作業で、「問題で使わない語」の出し方を決める

</details>
