import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { checkAnswersRun } from '../../helpers/answer-checks.js';
import { makeNodeRunner } from '../../helpers/make-runner.js';
import { makeProblem, makeChapter } from '../../helpers/problem-factory.js';

/*
 * 「正解SQLが実行でき、0行でない」の検証そのものが働くことを、テスト用の問題で確かめる。
 */

const SEED = `CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT, price INTEGER);
INSERT INTO products (name, price) VALUES ('Mug', 1200), ('Pen', 300);`;
const readSeed = (file) => {
  if (file !== 'beginner.sql') throw new Error('not found');
  return SEED;
};

let runner;

beforeAll(() => {
  runner = makeNodeRunner();
});

afterAll(async () => {
  await runner.close();
});

const check = (problems, chapters = [makeChapter()]) =>
  checkAnswersRun({
    runner,
    chapters,
    entries: problems.map((problem) => ({ file: `beginner/${problem.id}.yaml`, problem })),
    readSeed,
  });

describe('checkAnswersRun', () => {
  it('正解SQLが動いて行が返れば問題0件', async () => {
    expect(await check([makeProblem()])).toEqual([]);
  });

  it('正解SQLがエラーになる問題を見つける', async () => {
    const issues = await check([makeProblem({ answer: 'SELECT * FROM nope' })]);
    expect(issues).toEqual([expect.stringContaining('エラーになります（42P01')]);
  });

  it('正解SQLの結果が0行の問題を見つける', async () => {
    const issues = await check([
      makeProblem({ answer: 'SELECT name FROM products WHERE price > 99999' }),
    ]);
    expect(issues).toEqual([expect.stringContaining('0行です')]);
  });

  it('extraSql で足した行も使える', async () => {
    const problem = makeProblem({
      answer: "SELECT name FROM products WHERE name = 'Extra'",
      setup: { extraSql: "INSERT INTO products (name, price) VALUES ('Extra', 1);" },
    });
    expect(await check([problem])).toEqual([]);
  });

  it('extraSql が壊れている問題を見つける', async () => {
    const problem = makeProblem({ setup: { extraSql: 'INSERT INTO nope VALUES (1);' } });
    expect(await check([problem])).toEqual([expect.stringContaining('extraSql を流せません')]);
  });

  it('章の初期データのファイルがないと見つける', async () => {
    const issues = await check([], [makeChapter({ seed: 'missing.sql' })]);
    expect(issues).toEqual([expect.stringContaining('data/seeds/missing.sql がありません')]);
  });

  it('章の初期データが壊れていたら、章として1回だけ報告し、その章の問題は確かめない', async () => {
    const issues = await checkAnswersRun({
      runner,
      chapters: [makeChapter()],
      entries: [makeProblem(), makeProblem({ id: 'beginner-02', order: 2 })].map((problem) => ({
        file: `beginner/${problem.id}.yaml`,
        problem,
      })),
      readSeed: () => 'CREATE TABLE broken (;',
    });
    expect(issues).toEqual([expect.stringContaining('を流せません')]);
  });

  it('chapters.yaml にない章の問題を見つける', async () => {
    const issues = await check([makeProblem({ chapterId: 'advanced' })]);
    expect(issues).toEqual([
      expect.stringContaining('chapterId advanced の章が chapters.yaml にありません'),
    ]);
  });

  it('書き換え系の正解SQLが1行も書き換えないと見つける', async () => {
    const issues = await check([
      makeProblem({ answer: 'UPDATE products SET price = 0 WHERE id = 999' }),
    ]);
    expect(issues).toEqual([expect.stringContaining('1行も書き換えません')]);
  });

  it('書き換え系の正解SQLが行を書き換えれば問題0件', async () => {
    expect(
      await check([makeProblem({ answer: 'UPDATE products SET price = 0 WHERE id = 1' })]),
    ).toEqual([]);
  });
});
