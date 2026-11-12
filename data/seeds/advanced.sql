-- 上級の初期データ：中級（intermediate.sql と同じ）に、アクセスログ（access_logs）5万行を足したもの
-- 中級の部分は intermediate.sql と同じにする（同じであることを problems.test.js で確かめる）

-- 中級の初期データ：初級の products（beginner.sql と同じ30行）に、顧客・注文・注文の明細を足したもの
-- products の部分は beginner.sql と同じにする（同じであることを problems.test.js で確かめる）

-- 初級の初期データ：雑貨店の商品（products）30行
-- 決まり（tests/integration/data-validation/problems.test.js で確かめる）：
--   30行 / 4カテゴリそれぞれ5行以上 / stock = 0 が3行以上 / supplier IS NULL が3行以上 /
--   name に 'Mug' を含むものが3行以上 / 値段はすべて違う（ORDER BY price の並びが1つに決まるように）
-- 値は英語と数字だけ（タイピングで日本語入力を使わないため）

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  name        TEXT    NOT NULL,
  category    TEXT    NOT NULL,
  price       INTEGER NOT NULL,
  stock       INTEGER NOT NULL,
  supplier    TEXT,
  released_on DATE    NOT NULL
);

INSERT INTO products (name, category, price, stock, supplier, released_on) VALUES
  ('Mug Cup Blue',         'kitchen',    1200, 12, 'Aoba Trading', '2025-04-10'),
  ('Mug Cup White',        'kitchen',    1250,  0, 'Aoba Trading', '2025-04-10'),
  ('Mug Cup Large',        'kitchen',    1580,  7, NULL,           '2025-09-01'),
  ('Travel Mug',           'kitchen',    2480,  3, 'Sora Works',   '2026-02-14'),
  ('Wooden Spoon Set',     'kitchen',     880, 25, 'Kita Craft',   '2024-11-20'),
  ('Cutting Board Oak',    'kitchen',    3980,  4, 'Kita Craft',   '2025-06-05'),
  ('Glass Tumbler',        'kitchen',     650, 40, 'Minato Goods', '2024-08-15'),
  ('Tea Strainer',         'kitchen',     540,  2, NULL,           '2025-01-30'),
  ('Notebook A5 Dot',      'stationery',  450, 60, 'Minato Goods', '2024-05-01'),
  ('Fountain Pen Black',   'stationery', 4800,  6, 'Sora Works',   '2025-10-12'),
  ('Pencil Case Canvas',   'stationery', 1380,  0, 'Aoba Trading', '2025-03-03'),
  ('Washi Tape 3 Pack',    'stationery',  520, 35, NULL,           '2024-12-01'),
  ('Desk Calendar 2027',   'stationery',  990, 18, 'Minato Goods', '2026-09-01'),
  ('Brass Bookmark',       'stationery',  760,  9, 'Kita Craft',   '2025-07-07'),
  ('Letter Set Floral',    'stationery',  680, 14, 'Aoba Trading', '2025-02-11'),
  ('Linen Cushion Cover',  'interior',   2280, 11, 'Sora Works',   '2025-05-20'),
  ('Ceramic Vase Small',   'interior',   1980,  5, 'Kita Craft',   '2024-10-10'),
  ('Wall Clock Round',     'interior',   5480,  2, 'Minato Goods', '2025-11-25'),
  ('Scented Candle Fig',   'interior',   1680,  0, NULL,           '2025-12-01'),
  ('Photo Frame A4',       'interior',   1480, 16, 'Aoba Trading', '2024-09-09'),
  ('Rattan Basket',        'interior',   3280,  7, 'Sora Works',   '2026-03-03'),
  ('Table Lamp Mini',      'interior',   6980,  3, 'Kita Craft',   '2026-01-15'),
  ('Mug Rack Wood',        'interior',   2180,  8, 'Kita Craft',   '2025-08-08'),
  ('Tote Bag Navy',        'bag',        2680, 20, 'Aoba Trading', '2025-03-21'),
  ('Canvas Backpack',      'bag',        7980,  4, 'Sora Works',   '2025-09-19'),
  ('Mini Pouch',           'bag',        1080, 30, 'Minato Goods', '2024-06-06'),
  ('Eco Bag Fold',         'bag',         780,  0, 'Minato Goods', '2024-07-17'),
  ('Shoulder Bag Leather', 'bag',        9800,  1, 'Kita Craft',   '2026-04-01'),
  ('Lunch Bag Cooler',     'bag',        1880, 13, NULL,           '2025-05-05'),
  ('Drawstring Bag Set',   'bag',        1180, 22, 'Sora Works',   '2025-01-10');

-- ここから中級で増えるテーブル。顧客（customers）・注文（orders）・注文の明細（order_items）
-- 決まり（tests/integration/data-validation/problems.test.js で確かめる）：
--   注文のない顧客が2人以上（LEFT JOIN で NULL が出る） / 取り消し（cancelled）の注文が2件以上 /
--   注文は2026年8月・9月・10月の3か月 / 一度も注文されていない商品がある /
--   明細の unit_price は、値引きの1行を除いて商品の price と同じ

CREATE TABLE customers (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  region    TEXT NOT NULL,
  joined_on DATE NOT NULL
);

INSERT INTO customers (name, region, joined_on) VALUES
  ('Aiko Tanaka',  'north', '2025-04-02'),
  ('Ben Sato',     'south', '2025-05-15'),
  ('Chika Mori',   'east',  '2025-06-20'),
  ('Daichi Ito',   'west',  '2025-07-07'),
  ('Emi Kato',     'north', '2025-09-01'),
  ('Fumi Abe',     'south', '2025-11-11'),
  ('Goro Ueda',    'east',  '2026-01-05'),
  ('Hana Ono',     'west',  '2026-03-03'),
  ('Ichiro Kudo',  'north', '2026-06-18'),
  ('Jun Hayashi',  'east',  '2026-09-30');

CREATE TABLE orders (
  id          SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers (id),
  ordered_at  TIMESTAMP NOT NULL,
  status      TEXT NOT NULL
);

INSERT INTO orders (customer_id, ordered_at, status) VALUES
  (1, '2026-08-03 10:15:00', 'shipped'),
  (2, '2026-08-05 14:20:00', 'shipped'),
  (3, '2026-08-11 09:05:00', 'shipped'),
  (1, '2026-08-19 20:40:00', 'shipped'),
  (4, '2026-08-24 12:00:00', 'cancelled'),
  (5, '2026-08-30 16:45:00', 'shipped'),
  (2, '2026-09-02 11:30:00', 'shipped'),
  (6, '2026-09-07 18:10:00', 'shipped'),
  (3, '2026-09-12 08:55:00', 'shipped'),
  (7, '2026-09-15 13:25:00', 'shipped'),
  (1, '2026-09-21 19:00:00', 'shipped'),
  (8, '2026-09-26 10:40:00', 'cancelled'),
  (4, '2026-10-01 15:15:00', 'shipped'),
  (5, '2026-10-04 09:30:00', 'paid'),
  (2, '2026-10-08 21:05:00', 'paid'),
  (6, '2026-10-12 12:50:00', 'paid'),
  (3, '2026-10-15 17:35:00', 'paid'),
  (8, '2026-10-18 10:10:00', 'paid'),
  (1, '2026-10-22 14:00:00', 'paid'),
  (7, '2026-10-27 19:45:00', 'paid');

CREATE TABLE order_items (
  order_id   INTEGER NOT NULL REFERENCES orders (id),
  product_id INTEGER NOT NULL REFERENCES products (id),
  quantity   INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  PRIMARY KEY (order_id, product_id)
);

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
  (1,  1,  2, 1200),
  (1,  9,  3,  450),
  (2,  24, 1, 2680),
  (3,  16, 2, 2280),
  (3,  7,  4,  650),
  (4,  4,  1, 2480),
  (5,  22, 1, 6980),
  (6,  10, 1, 4800),
  (6,  14, 2,  760),
  (7,  1,  1, 1200),
  (7,  26, 2, 1080),
  (8,  18, 1, 5480),
  (9,  12, 5,  520),
  (9,  13, 1,  990),
  (10, 25, 1, 7980),
  (11, 3,  2, 1580),
  (11, 8,  1,  540),
  (12, 28, 1, 9800),
  (13, 5,  3,  880),
  (13, 20, 1, 1480),
  (14, 17, 1, 1980),
  (14, 1,  2, 1100),
  (15, 29, 1, 1880),
  (16, 21, 1, 3280),
  (16, 9,  2,  450),
  (17, 24, 2, 2680),
  (17, 15, 1,  680),
  (18, 6,  1, 3980),
  (19, 2,  1, 1250),
  (19, 23, 1, 2180),
  (20, 10, 1, 4800),
  (20, 26, 1, 1080),
  (20, 7,  2,  650);

-- ここから上級で増えるテーブル。ネットショップのアクセスログ（access_logs）5万行
-- インデックスのあり・なしで、読む行の数と時間の違いが見えるように、行を多くする
-- 決まり（tests/integration/data-validation/problems.test.js で確かめる）：
--   50000行 / session_id はすべて違う（1行だけを探す問い合わせができる） / customer_id は 1〜10
-- 行は generate_series で作る（ファイルを小さく保ち、毎回同じ行になるように）

CREATE TABLE access_logs (
  id          SERIAL PRIMARY KEY,
  customer_id INTEGER   NOT NULL REFERENCES customers (id),
  session_id  TEXT      NOT NULL,
  path        TEXT      NOT NULL,
  accessed_at TIMESTAMP NOT NULL
);

INSERT INTO access_logs (customer_id, session_id, path, accessed_at)
SELECT
  1 + (g * 7) % 10,
  's-' || lpad(((g * 7919) % 50000)::text, 5, '0'),
  '/products/' || (1 + (g * 31) % 30),
  TIMESTAMP '2026-10-01 00:00:00' + g * INTERVAL '47 seconds'
FROM generate_series(1, 50000) AS g;

-- 行の数の見積もりを最新にする（インデックスを作ったときに、使うかどうかを正しく決めるため）
ANALYZE access_logs;
