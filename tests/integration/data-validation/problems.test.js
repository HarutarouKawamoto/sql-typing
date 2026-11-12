import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import {
  ChaptersFileSchema,
  CharactersFileSchema,
  KeywordsFileSchema,
  ProblemSchema,
  runAllChecks,
} from '../../../src/schema/index.js';
import { loadDataDir, describeZodError } from '../../helpers/load-data.js';
import { makeNodeRunner, readSeed } from '../../helpers/make-runner.js';
import {
  checkAnswersRun,
  checkClausePrefixes,
  checkTypable,
  checkBlanksPlayable,
  checkStepsBuild,
  checkVisuals,
  checkWrongChoices,
  checkOrderDetermined,
} from '../../helpers/answer-checks.js';

/*
 * 問題データの検証（安全柵）。1つでも失敗したら prebuild で build が止まる。
 * PGlite を使う検証のうち「間違いの選択肢が判定で不正解になるか・順番が1つに決まるか」は
 * Judge を作る作業でここに足す。
 */

const DATA_DIR = fileURLToPath(new URL('../../../data', import.meta.url));
const TOKENS_CSS = fileURLToPath(new URL('../../../src/ui/styles/tokens.css', import.meta.url));
const FIXTURE = fileURLToPath(
  new URL('../../helpers/fixtures/broken-problem.yaml', import.meta.url),
);

const data = loadDataDir(DATA_DIR);

/**
 * @template T
 * @param {string} label
 * @param {import('zod').ZodType<T>} schema
 * @param {unknown} raw
 * @returns {{ value?: T, issues: string[] }}
 */
function validate(label, schema, raw) {
  const result = schema.safeParse(raw);
  return result.success
    ? { value: result.data, issues: [] }
    : { issues: describeZodError(label, result.error) };
}

const chapters = validate('chapters.yaml', ChaptersFileSchema, data.chapters);
const characters = validate('characters.yaml', CharactersFileSchema, data.characters);
const keywords = validate('keywords.yaml', KeywordsFileSchema, data.keywords);
const problems = data.problemFiles.map(({ file, raw }) => ({
  file,
  ...validate(file, ProblemSchema, raw),
}));

describe('data/ の読み込み', () => {
  it('すべてのファイルが読めて、決まった場所・拡張子にある', () => {
    expect(data.loadIssues).toEqual([]);
  });
});

describe('data/ の形（Zod）', () => {
  it('chapters.yaml が形どおり', () => {
    expect(chapters.issues).toEqual([]);
  });

  it('characters.yaml が形どおり', () => {
    expect(characters.issues).toEqual([]);
  });

  it('keywords.yaml が形どおり', () => {
    expect(keywords.issues).toEqual([]);
  });

  it('すべての問題ファイルが形どおり', () => {
    expect(problems.flatMap((p) => p.issues)).toEqual([]);
  });
});

describe('data/ のファイルをまたぐ決まり', () => {
  it('問題ID・章の並び・ターニングポイント・用語・登場人物・選択肢・IDの重なりの決まりを満たす', () => {
    // 形の違反は上のテストで報告するので、ここでは形の正しいものだけで確かめる
    const issues = runAllChecks({
      chapters: chapters.value ?? [],
      entries: problems.filter((p) => p.value).map((p) => ({ file: p.file, problem: p.value })),
      keywords: keywords.value ?? [],
      characters: characters.value ?? [],
    });
    expect(issues).toEqual([]);
  });

  it('モード1・2で打つSQLに、キーボードで打てない文字がない', () => {
    const entries = problems
      .filter((p) => p.value)
      .map((p) => ({ file: p.file, problem: p.value }));
    expect(checkTypable(entries)).toEqual([]);
  });

  it('モード2の空欄が、表示用SQLの中に見つかり、選択肢がすべて打てる', () => {
    const entries = problems
      .filter((p) => p.value)
      .map((p) => ({ file: p.file, problem: p.value }));
    expect(checkBlanksPlayable(entries)).toEqual([]);
  });

  it('登場人物の color が tokens.css に定義されている', () => {
    const css = readFileSync(TOKENS_CSS, 'utf8');
    const missing = (characters.value ?? [])
      .map((c) => c.color)
      .filter((name) => !new RegExp(`${name}\\s*:`).test(css));
    expect(missing).toEqual([]);
  });
});

describe('PGlite で確かめる決まり', () => {
  let runner;

  beforeAll(() => {
    runner = makeNodeRunner();
  });

  afterAll(async () => {
    await runner.close();
  });

  it('すべての問題の正解SQLが、その章の初期データの上で実行でき、0行でない', async () => {
    const issues = await checkAnswersRun({
      runner,
      chapters: chapters.value ?? [],
      entries: problems.filter((p) => p.value).map((p) => ({ file: p.file, problem: p.value })),
      readSeed,
    });
    expect(issues).toEqual([]);
  });

  it('SELECT の問題は句に分けられ、句の途中までのSQLを実行しても止まらない（見える化C）', async () => {
    const issues = await checkClausePrefixes({
      runner,
      chapters: chapters.value ?? [],
      entries: problems.filter((p) => p.value).map((p) => ({ file: p.file, problem: p.value })),
      readSeed,
    });
    expect(issues).toEqual([]);
  });

  it('モード2の間違いの選択肢を入れたSQLが、判定で正解にならない', async () => {
    const issues = await checkWrongChoices({
      runner,
      chapters: chapters.value ?? [],
      entries: problems.filter((p) => p.value).map((p) => ({ file: p.file, problem: p.value })),
      readSeed,
    });
    expect(issues).toEqual([]);
    // 上級は初期状態に戻すたびにアクセスログ5万行を入れ直すので、選択肢ごとの判定が長くかかる
  }, 300_000);

  it('正解SQLのステップ再生が作れる（最後の段階が結果と一致する）', async () => {
    const issues = await checkStepsBuild({
      runner,
      chapters: chapters.value ?? [],
      entries: problems.filter((p) => p.value).map((p) => ({ file: p.file, problem: p.value })),
      readSeed,
    });
    expect(issues).toEqual([]);
  });

  it('上級の見える化（インデックス）の問題は、正解SQLで比べる問い合わせの読む行が減る', async () => {
    const issues = await checkVisuals({
      runner,
      chapters: chapters.value ?? [],
      entries: problems.filter((p) => p.value).map((p) => ({ file: p.file, problem: p.value })),
      readSeed,
    });
    expect(issues).toEqual([]);
  });

  it('ordered: true の問題は、行の並びが1つに決まる', async () => {
    const issues = await checkOrderDetermined({
      runner,
      chapters: chapters.value ?? [],
      entries: problems.filter((p) => p.value).map((p) => ({ file: p.file, problem: p.value })),
      readSeed,
    });
    expect(issues).toEqual([]);
  });

  describe('初級の初期データ（beginner.sql）の決まり', () => {
    const count = async (where) => {
      const outcome = await runner.run(`SELECT count(*) FROM products WHERE ${where}`);
      if (!outcome.ok) throw new Error(JSON.stringify(outcome));
      return outcome.result.rows[0][0];
    };

    beforeAll(async () => {
      await runner.prepare({ seedSql: readSeed('beginner.sql') });
    });

    it('products は30行', async () => {
      expect(await count('true')).toBe(30);
    });

    it('4つのカテゴリそれぞれに5行以上', async () => {
      const outcome = await runner.run(
        'SELECT category, count(*) FROM products GROUP BY category ORDER BY category',
      );
      expect(outcome.ok && outcome.result.rows.map(([c]) => c)).toEqual([
        'bag',
        'interior',
        'kitchen',
        'stationery',
      ]);
      expect(outcome.ok && outcome.result.rows.every(([, n]) => n >= 5)).toBe(true);
    });

    it('在庫0・仕入れ先 NULL・名前に Mug を含む行が、それぞれ3行以上', async () => {
      expect(await count('stock = 0')).toBeGreaterThanOrEqual(3);
      expect(await count('supplier IS NULL')).toBeGreaterThanOrEqual(3);
      expect(await count("name LIKE '%Mug%'")).toBeGreaterThanOrEqual(3);
    });

    it('値段はすべて違う（ORDER BY price の並びが1つに決まる）', async () => {
      const outcome = await runner.run('SELECT count(DISTINCT price) FROM products');
      expect(outcome.ok && outcome.result.rows[0][0]).toBe(30);
    });

    it('文字の値は英語・数字・記号だけ（日本語入力を使わないため）', async () => {
      expect(
        await count(
          "name !~ '^[ -~]+$' OR category !~ '^[ -~]+$' OR (supplier IS NOT NULL AND supplier !~ '^[ -~]+$')",
        ),
      ).toBe(0);
    });

    it('値段は1円以上、在庫は0以上', async () => {
      expect(await count('price < 1 OR stock < 0')).toBe(0);
    });

    it('名前はすべて違う', async () => {
      const outcome = await runner.run('SELECT count(DISTINCT name) FROM products');
      expect(outcome.ok && outcome.result.rows[0][0]).toBe(30);
    });
  });

  describe('上級の初期データ（advanced.sql）の決まり', () => {
    /** @param {string} sql */
    const one = async (sql) => {
      const outcome = await runner.run(sql);
      if (!outcome.ok) throw new Error(JSON.stringify(outcome));
      return outcome.result.rows[0][0];
    };

    beforeAll(async () => {
      await runner.prepare({ seedSql: readSeed('advanced.sql') });
    });

    it('advanced.sql は intermediate.sql の全文を含む（中級の問題の形をそのまま使える）', () => {
      expect(readSeed('advanced.sql').includes(readSeed('intermediate.sql'))).toBe(true);
    });

    it('アクセスログは5万行で、session_id はすべて違う（1行だけを探す問い合わせができる）', async () => {
      expect(await one('SELECT count(*) FROM access_logs')).toBe(50000);
      expect(await one('SELECT count(DISTINCT session_id) FROM access_logs')).toBe(50000);
    });

    it('顧客は 1〜10、パスは /products/1〜30', async () => {
      expect(
        await one('SELECT count(*) FROM access_logs WHERE customer_id NOT BETWEEN 1 AND 10'),
      ).toBe(0);
      expect(await one('SELECT count(DISTINCT path) FROM access_logs')).toBe(30);
    });
  });

  describe('中級の初期データ（intermediate.sql）の決まり', () => {
    /** @param {string} sql */
    const one = async (sql) => {
      const outcome = await runner.run(sql);
      if (!outcome.ok) throw new Error(JSON.stringify(outcome));
      return outcome.result.rows[0][0];
    };

    let beginnerProducts;
    beforeAll(async () => {
      await runner.prepare({ seedSql: readSeed('beginner.sql') });
      const outcome = await runner.run('SELECT * FROM products ORDER BY id');
      beginnerProducts = outcome.ok ? outcome.result.rows : null;
      await runner.prepare({ seedSql: readSeed('intermediate.sql') });
    });

    it('products は初級と同じ30行（初級の問題の形を中級でもそのまま使えるように）', async () => {
      const outcome = await runner.run('SELECT * FROM products ORDER BY id');
      expect(outcome.ok && outcome.result.rows).toEqual(beginnerProducts);
    });

    it('顧客10人・注文20件・明細33行', async () => {
      expect(await one('SELECT count(*) FROM customers')).toBe(10);
      expect(await one('SELECT count(*) FROM orders')).toBe(20);
      expect(await one('SELECT count(*) FROM order_items')).toBe(33);
    });

    it('注文のない顧客が2人以上（LEFT JOIN で NULL が出る）', async () => {
      expect(
        await one(
          'SELECT count(*) FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL',
        ),
      ).toBeGreaterThanOrEqual(2);
    });

    it('取り消しの注文が2件以上、注文は2026年8〜10月の3か月', async () => {
      expect(
        await one("SELECT count(*) FROM orders WHERE status = 'cancelled'"),
      ).toBeGreaterThanOrEqual(2);
      expect(await one("SELECT count(DISTINCT to_char(ordered_at, 'YYYY-MM')) FROM orders")).toBe(
        3,
      );
      expect(await one("SELECT min(to_char(ordered_at, 'YYYY-MM')) FROM orders")).toBe('2026-08');
      expect(
        await one(
          "SELECT count(*) FROM orders WHERE status NOT IN ('paid', 'shipped', 'cancelled')",
        ),
      ).toBe(0);
    });

    it('一度も注文されていない商品がある。明細の値段は、値引きの1行を除いて商品の値段と同じ', async () => {
      expect(
        await one(
          'SELECT count(*) FROM products p WHERE NOT EXISTS (SELECT 1 FROM order_items i WHERE i.product_id = p.id)',
        ),
      ).toBeGreaterThanOrEqual(1);
      expect(
        await one(
          'SELECT count(*) FROM order_items i JOIN products p ON p.id = i.product_id WHERE i.unit_price <> p.price',
        ),
      ).toBe(1);
    });

    it('文字の値は英語・数字・記号だけ', async () => {
      expect(
        await one(
          "SELECT count(*) FROM customers WHERE name !~ '^[ -~]+$' OR region !~ '^[ -~]+$'",
        ),
      ).toBe(0);
    });

    it('intermediate.sql は beginner.sql の全文を含む（products の作り方まで同じ）', () => {
      expect(readSeed('intermediate.sql').includes(readSeed('beginner.sql'))).toBe(true);
    });

    it('JOIN の練習になる形：2件以上の注文の顧客・2行以上の明細の注文・2つ以上の注文に入る商品', async () => {
      const atLeastTwo = (table, column) =>
        one(
          `SELECT count(*) FROM (SELECT ${column} FROM ${table} GROUP BY ${column} HAVING count(*) >= 2) AS t`,
        );
      expect(await atLeastTwo('orders', 'customer_id')).toBeGreaterThanOrEqual(2);
      expect(await atLeastTwo('order_items', 'order_id')).toBeGreaterThanOrEqual(2);
      expect(await atLeastTwo('order_items', 'product_id')).toBeGreaterThanOrEqual(2);
    });

    it('顧客の名前は重ならず、地域は4つ、paid・shipped の注文がそれぞれある', async () => {
      expect(await one('SELECT count(DISTINCT name) FROM customers')).toBe(10);
      expect(await one('SELECT count(DISTINCT region) FROM customers')).toBe(4);
      expect(await one("SELECT count(*) FROM orders WHERE status = 'paid'")).toBeGreaterThan(0);
      expect(await one("SELECT count(*) FROM orders WHERE status = 'shipped'")).toBeGreaterThan(0);
    });

    it('顧客ごとの合計金額は重ならない（取り消しを入れても外しても。上位N人が1つに決まるように）', async () => {
      for (const where of ['', "WHERE o.status <> 'cancelled'"]) {
        expect(
          await one(
            `SELECT count(*) = count(DISTINCT total) FROM (SELECT sum(i.quantity * i.unit_price) AS total FROM orders o JOIN order_items i ON i.order_id = o.id ${where} GROUP BY o.customer_id) AS t`,
          ),
        ).toBe(true);
      }
    });
  });
});

describe('検証そのものが働くこと', () => {
  const { issues } = validate(
    'broken-problem.yaml',
    ProblemSchema,
    parse(readFileSync(FIXTURE, 'utf8')),
  );

  it.each([
    ['id', 'id —'],
    ['会話の行数', 'story.before —'],
    ['正解SQLの日本語と ;', 'answer —'],
    ['ヒントの数', 'hints —'],
    ['keywords がない', 'keywords —'],
  ])('決まりを破った問題ファイルは失敗する：%s', (_label, expected) => {
    expect(issues.join('\n')).toContain(expected);
  });
});
