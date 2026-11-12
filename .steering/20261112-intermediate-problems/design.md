# 設計書

## 問題の一覧

| # | ファイル | 正解SQL（形） | 判定 | 空欄 → 間違い |
|---|---|---|---|---|
| 1 | `01-count-sum.yaml` | `SELECT count(*) AS items, sum(stock) AS total_stock FROM products` | | `count(*)` → `count(supplier)`（NULL を数えない）、`sum(stock)` → `max(stock)` |
| 2 | `02-group-by.yaml` | `SELECT category, count(*) AS items, max(price) AS top_price FROM products GROUP BY category ORDER BY category` | ordered | `GROUP BY category` → `GROUP BY category, price`、`max(price)` → `min(price)` |
| 3 | `03-having.yaml` | `SELECT category, sum(stock) AS total FROM products GROUP BY category HAVING sum(stock) >= 90 ORDER BY category` | ordered | `HAVING sum(stock) >= 90` → `HAVING sum(stock) > 90`（bag がちょうど90） |
| 4 | `04-join.yaml` | `SELECT o.id, c.name, o.status FROM orders o JOIN customers c ON c.id = o.customer_id ORDER BY o.id` | ordered | `ON c.id = o.customer_id` → `ON c.id = o.id` |
| 5 | `05-left-join.yaml` | `SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL ORDER BY c.name` | ordered, require LEFT JOIN | `LEFT JOIN` → `JOIN`、`IS NULL` → `IS NOT NULL` |
| 6 | `06-join-count.yaml` | `SELECT c.name, count(o.id) AS orders FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.name ORDER BY orders DESC, c.name` | ordered | `count(o.id)` → `count(*)` |
| 7 | `07-join-top.yaml` | `SELECT p.name, sum(i.quantity) AS sold FROM order_items i JOIN products p ON p.id = i.product_id GROUP BY p.name ORDER BY sold DESC, p.name LIMIT 5` | ordered | `sum(i.quantity)` → `count(*)` |
| 8 | `08-subquery.yaml` | `SELECT name, price FROM products WHERE price > (SELECT avg(price) FROM products) ORDER BY price DESC` | ordered | `avg(price)` → `max(price)`、`>` → `<` |
| 9 | `09-case.yaml` | `SELECT name, price, CASE WHEN price >= 5000 THEN 'high' WHEN price >= 1000 THEN 'middle' ELSE 'low' END AS band FROM products ORDER BY price DESC` | ordered, checkColumnNames | `>= 1000` → `>= 2000`、`ELSE 'low'` → `ELSE 'high'` |
| 10 | `10-insert.yaml` | `INSERT INTO customers (name, region, joined_on) VALUES ('Kei Mori', 'south', '2026-11-01')` | compareTable customers, ignoreColumns [id] | 値の並び違い |
| 11 | `11-update.yaml` | `UPDATE products SET price = price * 9 / 10 WHERE category = 'kitchen'` | compareTable products | `price * 9 / 10` → `price - 10`、`= 'kitchen'` → `<> 'kitchen'` |
| 12 | `12-delete.yaml` | `DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE status = 'cancelled')` | compareTable order_items | `IN` → `NOT IN`、`'cancelled'` → `'paid'` |
| TP | `13-turning-point.yaml` | 月ごとの注文数と売上（取り消しを除く、`GROUP BY month`） | ordered, checkColumnNames | `count(DISTINCT o.id)` → `count(o.id)`、`<>` → `=`、`GROUP BY month` → `GROUP BY o.ordered_at` |

## 会話
- 話す人は初級と同じ（店長 木村・先輩 吉永・営業 長島・あなた）
- 依頼に、出す列・列名（checkColumnNames のとき）・並び順を書く
- UPDATE の問題：先輩が「去年、WHERE を忘れて全商品0円にした人がいた」と話す
- ターニングポイント：オーナー（社長）が明日来て月次レポートを見る。今まで先輩が表計算で丸1日かけていた

## キーワード（level 2）
COUNT・SUM・MAX・AVG・GROUP BY・HAVING・JOIN・ON・LEFT JOIN・CASE・WHEN・THEN・ELSE・END・INSERT INTO・VALUES・UPDATE・SET・DELETE

## E2E
- `tests/e2e/progression/turning-point.spec.js`：初級のターニングポイントをモード4でクリア → 中級の1問目が開く
- `tests/e2e/progression/intermediate.spec.js`：UPDATE の問題をモード4で解く（WHERE を付け忘れると不正解）、中級の DBの地図（4つの箱と3本の線）
