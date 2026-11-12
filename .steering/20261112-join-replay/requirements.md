# 要求内容

## 概要

中級の初期データ（顧客 `customers`・注文 `orders`・注文の明細 `order_items`）を作り、ステップ再生（見える化A）を `JOIN` に広げる。JOIN の段階では2つの表を並べ、つながる行どうしを同じ色にして（INNER JOIN で相手のない行は消える、LEFT JOIN では右の列が NULL になる）、次の場面で1行に合体させる。

## 背景

- PRD「中級の章」：JOIN で2つの表の行がつながって1行に合体する、LEFT JOIN で相手のない行に NULL が入る
- 本人の「上級まで作って」（2026-11-12）の中級の2つ目。集計（GROUP BY）は1つのテーブルでできた。中級の問題（次の作業）は JOIN と集計を組み合わせる

## 実装対象の機能

### 1. 中級の初期データ（`data/seeds/intermediate.sql`）
- products は初級と同じ30行（`beginner.sql` をそのまま含める）
- customers 10人（region は north・south・east・west）、うち2人は注文がない
- orders 20件（2026年8〜10月、status は paid・shipped・cancelled。cancelled は2件）
- order_items 33行（主キーは order_id と product_id）。一度も注文されていない商品がある。値引きの1行を除き unit_price は商品の price と同じ
- 外部キー：orders.customer_id → customers.id、order_items.order_id → orders.id、order_items.product_id → products.id

### 2. FROM 句の読み取り（`src/core/stepper/from-clause.js`）
- `parseFrom(fromText)`：最初のテーブルと、続く `[INNER] JOIN`・`LEFT [OUTER] JOIN` の並び（テーブル名・別名・ON の条件の終わりの位置）
- 扱わない：RIGHT・FULL・CROSS・NATURAL JOIN、USING、カンマで並べたテーブル、サブクエリ、LATERAL

### 3. JOIN の段階
- 実行順：FROM（最初のテーブルの全行）→ JOIN（1つずつ）→ WHERE → GROUP BY → … 今までの段階は、行の目印を「つないだテーブルの ctid を + でつないだもの」にして同じように作る
- JOIN の段階の変化：右の表の行、左の行ごとのつながる右の行、INNER で消える左の行、LEFT で NULL がつく左の行
- 同じテーブルを2回使う（別名つき、自己結合）も扱う

### 4. 画面
- `StepTable`：JOIN の印の場面で、左（前の段階の表）と右の表を並べ、つながる行どうしを同じ色に。INNER で消える左の行は赤、LEFT で NULL がつく左の行は印、つながらない右の行は薄く。変化の場面は合体した表
- 段階の長さ・一言（INNER・LEFT で違う一言）
- 見本のページは中級の初期データで開き、JOIN（INNER・LEFT・JOIN と GROUP BY）の見本を足す

## 受け入れ条件

- [ ] 中級の初期データの決まり（統合テスト）
- [ ] `orders JOIN customers`：FROM（orders 20行）→ JOIN（20行、各行に顧客がつながる）→ 最後が元のSQLと一致（統合テスト）
- [ ] `customers LEFT JOIN orders`：注文のない2人の右の列が NULL（統合テスト）
- [ ] INNER JOIN で相手のない左の行が消える（統合テスト）
- [ ] 3つのテーブルの JOIN と GROUP BY（統合テスト）
- [ ] 見本のページで、JOIN の印（2つの表・色）と合体した表が見える（E2E）

## スコープ外

- 中級の章と問題（次の作業）
- RIGHT・FULL JOIN・USING・サブクエリの FROM
