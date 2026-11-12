# 設計書

## 問題の一覧（機能設計書の表から決めたこと）

| # | ファイル | 正解SQL | 判定 | 空欄 → 間違いの選択肢 |
|---|---|---|---|---|
| 2 | `02-select-columns.yaml` | `SELECT name AS item, price FROM products` | checkColumnNames | `name AS item` → `item AS name`（逆向き）・`name AS price`（同じ名前の列が2つ） |
| 3 | `03-where.yaml` | `SELECT name, price FROM products WHERE price >= 1000` | | `price >= 1000` → `price <= 1000`・`price = 1000` |
| 4 | `04-and-or.yaml` | `... WHERE category = 'kitchen' AND stock < 5` | | `AND` → `OR`、`'kitchen'` → `kitchen`（列の名前になる） |
| 5 | `05-in-between.yaml` | `... WHERE category IN ('kitchen', 'bag') AND price BETWEEN 500 AND 2000` | require: [IN, BETWEEN] | `IN ('kitchen', 'bag')` → `NOT IN (...)`、`BETWEEN 500 AND 2000` → `BETWEEN 2000 AND 500`（1行も残らない） |
| 6 | `06-like-null.yaml` | `... WHERE name LIKE '%Mug%' OR supplier IS NULL` | require: [LIKE, IS NULL] | `'%Mug%'` → `'Mug%'`、`IS NULL` → `= NULL`（いつも真にならない） |
| 7 | `07-order-limit.yaml` | `SELECT name, price FROM products ORDER BY price DESC LIMIT 5` | ordered | `DESC` → `ASC`、`LIMIT 5` → `OFFSET 5` |
| 8 | `08-distinct.yaml` | `SELECT DISTINCT category FROM products ORDER BY category` | ordered | `DISTINCT` → `ALL` |
| TP | `09-turning-point.yaml` | 表の形で `LIMIT 5` | ordered, checkColumnNames | `IS NOT NULL` → `IS NULL`、`BETWEEN 1000 AND 5000` → `BETWEEN 5000 AND 1000`、`DESC` → `ASC` |

### 表から変えたこと
- **3問目の間違いに `>` を使わない**：初期データにちょうど1000円の商品がないので、`price > 1000` は正解と同じ結果になる（問題データの検証で止まる）。初期データは他の問題・テストが行数を数えているので変えない
- **ターニングポイントを `LIMIT 5` に**：表の `LIMIT 10` だと、WHERE のあとに8行しか残らず、LIMIT が何もしない。5にして LIMIT の意味が出るようにする（機能設計書の表も直す）

## 会話
- 話す人：店長（木村）・先輩（吉永）・営業（長島）・あなた
- 依頼の中に「管理画面で〜するときの裏で動く」「ネットショップの〜の画面」のような現実の場面を1つ入れる
- ターニングポイントは「セール前夜、先輩が手作業であきらめたリストを一発で出す」（壁打ちの決定8）

## 問題データの検証の追加
- `tests/helpers/answer-checks.js` に `checkStepsBuild`：章の初期データの上で、SELECT の問題の表示用SQLに `buildSteps` をかけ、`mismatch`・`error` にならない（形として対応していない `unsupported` は、初級では起きないはずだが、中級の JOIN などで起きるので許す）
- `tests/integration/stepper/beginner-steps.test.js` のターニングポイントの形も `LIMIT 5` に

## E2E
- `tests/e2e/progression/home-story.spec.js`：1問目のクリアのあとは「次の問題へ」が押せる前提に直し、Enter・J で2問目へ進むテストを足す
- `tests/e2e/progression/turning-point.spec.js`：学習記録を localStorage に入れて8問目までクリアした状態にし、ターニングポイントの印・モード選択の説明・モード1でクリアしたあとの画面を確かめる

## 実装の順序
1. keywords.yaml
2. 問題YAML（1問ずつ書いて `npm run validate:data`）
3. chapters.yaml
4. 検証の追加、stepper のテストの形
5. E2E
