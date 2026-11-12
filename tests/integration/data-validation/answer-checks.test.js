import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  checkAnswersRun,
  checkClausePrefixes,
  checkTypable,
  checkBlanksPlayable,
  checkStepsBuild,
  checkWrongChoices,
  checkOrderDetermined,
  checkVisuals,
} from '../../helpers/answer-checks.js';
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

  it('句の途中までのSQL：分けられる問題は0件、句の順番が違う表示用SQLは見つける', async () => {
    const run = (problem) =>
      checkClausePrefixes({
        runner,
        chapters: [makeChapter()],
        entries: [{ file: 'beginner/x.yaml', problem }],
        readSeed,
      });
    expect(await run(makeProblem())).toEqual([]);
    expect(
      await run(makeProblem({ answer: 'SELECT name FROM products ORDER BY name WHERE price > 1' })),
    ).toEqual([expect.stringContaining('打ちながら実行できません')]);
    // 書き換え系は確かめない
    expect(await run(makeProblem({ answer: 'UPDATE products SET price = 0' }))).toEqual([]);
  });

  it('ステップ再生：作れる問題・まだ対応していない形は0件、作れない（エラー）問題は見つける', async () => {
    const run = (problem) =>
      checkStepsBuild({
        runner,
        chapters: [makeChapter()],
        entries: [{ file: 'beginner/x.yaml', problem }],
        readSeed,
      });
    expect(await run(makeProblem())).toEqual([]);
    // 集計関数はまだステップ再生がない（unsupported）。画面は「まだありません」と出すので止めない
    expect(await run(makeProblem({ answer: 'SELECT count(*) FROM products' }))).toEqual([]);
    // 書き換え系は確かめない
    expect(await run(makeProblem({ answer: 'UPDATE products SET price = 0' }))).toEqual([]);
    expect(await run(makeProblem({ answer: 'SELECT nam FROM products' }))).toEqual([
      expect.stringContaining('ステップ再生を作れません'),
    ]);
  });

  it('打てない文字：文字列の中の改行を見つけ、普通の問題は0件', () => {
    const entry = (problem) => ({ file: 'beginner/x.yaml', problem });
    expect(checkTypable([entry(makeProblem())])).toEqual([]);
    expect(
      checkTypable([
        entry(makeProblem({ answer: "SELECT name FROM products WHERE name = 'a\nb'" })),
      ]),
    ).toEqual([expect.stringContaining('打てない文字 "\\n"')]);
  });

  it('モード2の空欄：表示用SQLにない空欄・重なる空欄・打てない選択肢を見つけ、普通の問題は0件', () => {
    const entry = (problem) => ({ file: 'beginner/x.yaml', problem });
    expect(checkBlanksPlayable([entry(makeProblem())])).toEqual([]);
    const blank = (answer, wrongText = 'x') => ({ answer, wrong: [{ text: wrongText, why: 'y' }] });
    expect(
      checkBlanksPlayable([entry(makeProblem({ blanks: [blank('WHERE stock > 0')] }))]),
    ).toEqual([expect.stringContaining('見つかりません')]);
    expect(
      checkBlanksPlayable([
        entry(makeProblem({ blanks: [blank('price >= 1000'), blank('1000')] })),
      ]),
    ).toEqual([expect.stringContaining('重なっています')]);
    // 1000 の途中で切れる空欄
    expect(checkBlanksPlayable([entry(makeProblem({ blanks: [blank('>= 100')] }))])).toEqual([
      expect.stringContaining('語の途中'),
    ]);
    expect(
      checkBlanksPlayable([
        entry(makeProblem({ blanks: [blank('price >= 1000', "name = 'a	b'")] })),
      ]),
    ).toEqual([expect.stringContaining('打てない文字')]);
  });

  it('句の途中までのSQL：SELECT ... INTO は打ちながら実行できないと見つける', async () => {
    const issues = await checkClausePrefixes({
      runner,
      chapters: [makeChapter()],
      entries: [
        {
          file: 'beginner/x.yaml',
          problem: makeProblem({ answer: 'SELECT name INTO copy FROM products' }),
        },
      ],
      readSeed,
    });
    expect(issues).toEqual([expect.stringContaining('打ちながら実行できません')]);
  });

  it('間違いの選択肢：判定で正解になってしまう選択肢を見つけ、本当に違う選択肢は0件', async () => {
    const run = (problem) =>
      checkWrongChoices({
        runner,
        chapters: [makeChapter()],
        entries: [{ file: 'beginner/x.yaml', problem }],
        readSeed,
      });
    // テスト用の初期データ（Mug 1200・Pen 300）では、price > 300 と price >= 1000 は同じ結果
    const sameResult = makeProblem({
      answer: 'SELECT name FROM products WHERE price >= 1000',
      blanks: [
        {
          answer: 'price >= 1000',
          wrong: [
            { text: 'price > 300', why: '-' },
            { text: 'price < 1000', why: '-' },
          ],
        },
      ],
    });
    expect(await run(sameResult)).toEqual([
      expect.stringContaining('「price > 300」を入れても正解'),
    ]);
    expect(await run(makeProblem())).toEqual([]);
  });

  it('間違いの選択肢：画面と同じ範囲で置き換える（大文字・小文字が違っても確かめる）。ない空欄は見つける', async () => {
    const run = (blankAnswer) =>
      checkWrongChoices({
        runner,
        chapters: [makeChapter()],
        entries: [
          {
            file: 'beginner/x.yaml',
            problem: makeProblem({
              blanks: [{ answer: blankAnswer, wrong: [{ text: 'ORDER BY price', why: '-' }] }],
            }),
          },
        ],
        readSeed,
      });
    expect(await run('where price >= 1000')).toEqual([]);
    expect(await run('WHERE stock > 0')).toEqual([expect.stringContaining('見つかりません')]);
  });

  it('並び：ordered で同じ値の行があると見つけ、1つに決まる問題は0件', async () => {
    const run = (answer) =>
      checkOrderDetermined({
        runner,
        chapters: [makeChapter()],
        entries: [
          {
            file: 'beginner/x.yaml',
            problem: makeProblem({
              answer,
              judge: { ordered: true, checkColumnNames: false, require: [], forbid: [] },
            }),
          },
        ],
        readSeed,
      });
    expect(await run('SELECT name, price FROM products ORDER BY price DESC')).toEqual([]);
    // 同じ値（price が同じ）の行を足すと、並びが決まらない
    const tied = await checkOrderDetermined({
      runner,
      chapters: [makeChapter()],
      entries: [
        {
          file: 'beginner/x.yaml',
          problem: makeProblem({
            answer: 'SELECT name FROM products ORDER BY price',
            judge: { ordered: true, checkColumnNames: false, require: [], forbid: [] },
          }),
        },
      ],
      readSeed: () => `${SEED}\nINSERT INTO products (name, price) VALUES ('Cup', 300);`,
    });
    expect(tied).toEqual([expect.stringContaining('並びが1つに決まりません')]);
    expect(await run('SELECT name FROM products')).toEqual([
      expect.stringContaining('ORDER BY がありません'),
    ]);
  });

  it('並び：DISTINCT の問題でも確かめられる', async () => {
    const issues = await checkOrderDetermined({
      runner,
      chapters: [makeChapter()],
      entries: [
        {
          file: 'beginner/x.yaml',
          problem: makeProblem({
            answer: 'SELECT DISTINCT name FROM products ORDER BY name',
            judge: { ordered: true, checkColumnNames: false, require: [], forbid: [] },
          }),
        },
      ],
      readSeed,
    });
    expect(issues).toEqual([]);
  });

  it('並び：JOIN・別名の ORDER BY でも確かめられ、同じ値の行・* の形を見つける', async () => {
    const joinSeed = () =>
      `${SEED}\nCREATE TABLE sales (product_id INT, qty INT);\nINSERT INTO sales VALUES (1, 2), (2, 2), (2, 5);`;
    const runJoin = (answer) =>
      checkOrderDetermined({
        runner,
        chapters: [makeChapter()],
        entries: [
          {
            file: 'beginner/x.yaml',
            problem: makeProblem({
              answer,
              judge: { ordered: true, checkColumnNames: false, require: [], forbid: [] },
            }),
          },
        ],
        readSeed: joinSeed,
      });
    // 別名つきの ORDER BY（サブクエリで包むと p.name が見えなくなっていた）
    expect(
      await runJoin(
        'SELECT p.name, s.qty FROM sales s JOIN products p ON p.id = s.product_id ORDER BY p.name, s.qty',
      ),
    ).toEqual([]);
    // 集計と JOIN：同じ合計の行がある並び
    expect(
      await runJoin(
        'SELECT p.name, sum(s.qty) AS total FROM sales s JOIN products p ON p.id = s.product_id GROUP BY p.name ORDER BY total DESC, p.name',
      ),
    ).toEqual([]);
    expect(
      await runJoin(
        'SELECT s.qty, p.name FROM sales s JOIN products p ON p.id = s.product_id ORDER BY s.qty',
      ),
    ).toEqual([expect.stringContaining('並びが1つに決まりません')]);
    // * は列の番号で並べられないので、確かめられない形として止める
    expect(
      await runJoin('SELECT * FROM sales s JOIN products p ON p.id = s.product_id ORDER BY s.qty'),
    ).toEqual([expect.stringContaining('確かめられない形')]);
  });

  it('書き換え系の正解SQLが行を書き換えれば問題0件', async () => {
    expect(
      await check([makeProblem({ answer: 'UPDATE products SET price = 0 WHERE id = 1' })]),
    ).toEqual([]);
  });
});

describe('検証で見つかった見逃し', () => {
  it('間違いの選択肢：結果は同じで条件だけ違う（ruleViolation）選択肢も見つける', async () => {
    const problem = makeProblem({
      answer: 'SELECT name FROM products WHERE price BETWEEN 300 AND 1200',
      blanks: [
        {
          answer: 'BETWEEN 300 AND 1200',
          wrong: [{ text: '>= 300 AND price <= 1200', why: '-' }],
        },
      ],
      judge: { ordered: false, checkColumnNames: false, require: ['BETWEEN'], forbid: [] },
    });
    const issues = await checkWrongChoices({
      runner,
      chapters: [makeChapter()],
      entries: [{ file: 'beginner/x.yaml', problem }],
      readSeed,
    });
    expect(issues).toEqual([expect.stringContaining('条件だけが違う')]);
  });

  it('並び：GROUP BY の問題でも確かめられ、WITH は確かめられない形として知らせる', async () => {
    const run = (answer) =>
      checkOrderDetermined({
        runner,
        chapters: [makeChapter()],
        entries: [
          {
            file: 'beginner/x.yaml',
            problem: makeProblem({
              answer,
              judge: { ordered: true, checkColumnNames: false, require: [], forbid: [] },
            }),
          },
        ],
        readSeed,
      });
    expect(await run('SELECT name, count(*) FROM products GROUP BY name ORDER BY name')).toEqual(
      [],
    );
    expect(
      await run('WITH t AS (SELECT name FROM products) SELECT name FROM t ORDER BY name'),
    ).toEqual([expect.stringContaining('確かめられない形')]);
  });
});

describe('checkVisuals（上級の見える化の問題）', () => {
  const bigSeed = () =>
    `${SEED}
CREATE TABLE logs (id SERIAL PRIMARY KEY, code TEXT);
INSERT INTO logs (code) SELECT 'c' || g FROM generate_series(1, 20000) AS g;
ANALYZE logs;`;
  const run = (answer, visual) =>
    checkVisuals({
      runner,
      chapters: [makeChapter()],
      entries: [
        {
          file: 'beginner/x.yaml',
          problem: makeProblem({ answer, visual }),
        },
      ],
      readSeed: bigSeed,
    });
  const visual = { kind: 'index', query: "SELECT * FROM logs WHERE code = 'c777'" };

  it('正解SQL（インデックスを作る）で読む行が減れば問題0件', async () => {
    expect(await run('CREATE INDEX ON logs (code)', visual)).toEqual([]);
  });

  it('正解SQLで読む行が減らなければ見つける', async () => {
    expect(await run('CREATE INDEX ON logs (id)', visual)).toEqual([
      expect.stringContaining('読む行が減りません'),
    ]);
  });

  it('visual のない問題・index 以外は確かめない', async () => {
    expect(await run('SELECT 1', undefined)).toEqual([]);
    expect(await run('SELECT 1', { kind: 'plan' })).toEqual([]);
  });
});
