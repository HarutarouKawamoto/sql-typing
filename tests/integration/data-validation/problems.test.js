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
import { checkAnswersRun } from '../../helpers/answer-checks.js';

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
