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
