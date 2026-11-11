import { describe, it, expect } from 'vitest';
import {
  checkProblemFiles,
  checkChapters,
  checkReferences,
  checkBlanks,
  checkUniqueIds,
  runAllChecks,
  normalizeForCompare,
  normalizeSqlForMatch,
} from '../../../src/schema/cross-checks.js';
import { makeProblem, makeChapter, KEYWORDS, CHARACTERS } from '../../helpers/problem-factory.js';

const entry = (problem, file = 'beginner/01-select.yaml') => ({ file, problem });

describe('normalizeForCompare', () => {
  it('大文字・小文字と連続する空白・改行の違いをなくす', () => {
    expect(normalizeForCompare('  where\n  price  >= 1 ')).toBe('WHERE PRICE >= 1');
  });
});

describe('normalizeSqlForMatch', () => {
  it('文字列の外だけ、大文字・小文字と空白・改行の違いをなくす', () => {
    expect(normalizeSqlForMatch("select  name\nfrom t where name = 'Mug  Cup'")).toBe(
      "SELECT NAME FROM T WHERE NAME = 'Mug  Cup'",
    );
  });

  it("文字列の中の '' は文字列の続きとして扱う", () => {
    expect(normalizeSqlForMatch("where a = 'It''s ok' and b")).toBe("WHERE A = 'It''s ok' AND B");
  });
});

describe('checkUniqueIds', () => {
  it('章・キーワード・登場人物の id の重なりを見つける', () => {
    const issues = checkUniqueIds(
      [makeChapter(), makeChapter()],
      [...KEYWORDS, KEYWORDS[0]],
      [...CHARACTERS, CHARACTERS[1]],
    );
    expect(issues).toEqual([
      'chapters.yaml: 章 beginner が2回以上あります',
      'keywords.yaml: キーワード SELECT が2回以上あります',
      'characters.yaml: 登場人物 tencho が2回以上あります',
    ]);
  });
});

describe('runAllChecks', () => {
  it('決まりを満たしたデータでは問題が0件', () => {
    const issues = runAllChecks({
      chapters: [makeChapter()],
      entries: [entry(makeProblem())],
      keywords: KEYWORDS,
      characters: CHARACTERS,
    });
    expect(issues).toEqual([]);
  });
});

describe('checkProblemFiles', () => {
  it('問題IDがファイル名と合わないと見つける', () => {
    const issues = checkProblemFiles([entry(makeProblem({ id: 'beginner-02' }))]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('問題IDがファイル名と合いません');
  });

  it('chapterId がフォルダ名と合わないと見つける', () => {
    const issues = checkProblemFiles([
      entry(makeProblem({ id: 'beginner-01', chapterId: 'advanced' })),
    ]);
    expect(issues.some((i) => i.includes('フォルダ名'))).toBe(true);
  });

  it('ファイル名が決まった形でないと見つける', () => {
    const issues = checkProblemFiles([entry(makeProblem(), 'beginner/select.yaml')]);
    expect(issues[0]).toContain('ファイルの置き場所・名前');
  });

  it('IDの重なりを見つける', () => {
    const issues = checkProblemFiles([
      entry(makeProblem()),
      entry(makeProblem(), 'beginner/01-select-again.yaml'),
    ]);
    expect(issues.some((i) => i.includes('重なっています'))).toBe(true);
  });
});

describe('checkProblemFiles（ファイル名の形が違うとき）', () => {
  it('ファイル名の形が違っても、IDの重なりは見つける', () => {
    const issues = checkProblemFiles([
      entry(makeProblem()),
      entry(makeProblem(), 'beginner/select.yaml'),
    ]);
    expect(issues.some((i) => i.includes('重なっています'))).toBe(true);
  });
});

describe('checkChapters（並びの重なり・別の章）', () => {
  it('同じ問題が2回並んでいると見つける', () => {
    const issues = checkChapters(
      [makeChapter({ problemIds: ['beginner-01', 'beginner-01'] })],
      [entry(makeProblem())],
    );
    expect(issues.some((i) => i.includes('2回以上並んでいます'))).toBe(true);
  });

  it('別の章の問題が並んでいると見つける', () => {
    const issues = checkChapters(
      [makeChapter({ id: 'intermediate', level: 2, problemIds: ['beginner-01'] })],
      [entry(makeProblem())],
    );
    expect(issues.some((i) => i.includes('chapterId が beginner です'))).toBe(true);
  });
});

describe('checkChapters', () => {
  it('problemIds にあるのにファイルがない問題を見つける', () => {
    const issues = checkChapters(
      [makeChapter({ problemIds: ['beginner-01', 'beginner-02'] })],
      [entry(makeProblem())],
    );
    expect(issues.some((i) => i.includes('beginner-02 のファイルがありません'))).toBe(true);
  });

  it('problemIds に入っていない問題ファイルを見つける', () => {
    const issues = checkChapters([makeChapter({ problemIds: [] })], [entry(makeProblem())]);
    expect(issues[0]).toContain('problemIds に入っていません');
  });

  it('並び順と order が合わないと見つける', () => {
    const second = makeProblem({ id: 'beginner-02', order: 2 });
    const issues = checkChapters(
      [makeChapter({ problemIds: ['beginner-02', 'beginner-01'] })],
      [entry(makeProblem()), entry(second, 'beginner/02-next.yaml')],
    );
    expect(issues.some((i) => i.includes('1 番目に並んでいますが order は 2'))).toBe(true);
  });

  it('ターニングポイントが章の最後にないと見つける', () => {
    const tp = makeProblem({ kind: 'turningPoint' });
    const second = makeProblem({ id: 'beginner-02', order: 2 });
    const issues = checkChapters(
      [makeChapter({ problemIds: ['beginner-01', 'beginner-02'] })],
      [entry(tp), entry(second, 'beginner/02-next.yaml')],
    );
    expect(issues.some((i) => i.includes('章の最後にありません'))).toBe(true);
  });

  it('ターニングポイントが2問あると見つける', () => {
    const first = makeProblem({ kind: 'turningPoint' });
    const second = makeProblem({ id: 'beginner-02', order: 2, kind: 'turningPoint' });
    const issues = checkChapters(
      [makeChapter({ problemIds: ['beginner-01', 'beginner-02'] })],
      [entry(first), entry(second, 'beginner/02-next.yaml')],
    );
    expect(issues.some((i) => i.includes('1問まで'))).toBe(true);
  });
});

describe('checkReferences', () => {
  it('用語辞典にないキーワードを見つける', () => {
    const issues = checkReferences(
      [entry(makeProblem({ keywords: ['SELECT', 'BETWEEN'] }))],
      KEYWORDS,
      CHARACTERS,
    );
    expect(issues).toEqual([expect.stringContaining('キーワード BETWEEN')]);
  });

  it('登場人物にいない話す人を見つける', () => {
    const problem = makeProblem();
    problem.story.after = [{ speaker: 'shacho', text: 'よくやった。' }];
    const issues = checkReferences([entry(problem)], KEYWORDS, CHARACTERS);
    expect(issues).toEqual([expect.stringContaining('話す人 shacho')]);
  });
});

describe('checkBlanks', () => {
  const withBlank = (blank, extra = {}) => entry(makeProblem({ blanks: [blank], ...extra }));

  it('空欄の正解が表示用SQLにないと見つける', () => {
    const issues = checkBlanks([
      withBlank({ answer: 'WHERE stock > 0', wrong: [{ text: 'HAVING stock > 0', why: '-' }] }),
    ]);
    expect(issues).toEqual([expect.stringContaining('0 回出てきます')]);
  });

  it('display があるときは display の中を探す（改行と大文字・小文字の違いは無視する）', () => {
    const issues = checkBlanks([
      withBlank(
        { answer: 'where price >= 1000', wrong: [{ text: 'ORDER BY price', why: '-' }] },
        { display: 'SELECT name, price\nFROM products\nWHERE price >= 1000' },
      ),
    ]);
    expect(issues).toEqual([]);
  });

  it('ある選択肢が別の選択肢の先頭部分になっていると見つける', () => {
    const issues = checkBlanks([
      entry(
        makeProblem({
          answer: 'SELECT name FROM products WHERE price > 100',
          blanks: [{ answer: 'price > 100', wrong: [{ text: 'price > 1000', why: '-' }] }],
        }),
      ),
    ]);
    expect(issues).toEqual([expect.stringContaining('先頭部分になっています')]);
  });

  it('間違いの選択肢の先頭部分が正解になっていても見つける（逆向き）', () => {
    const issues = checkBlanks([
      entry(
        makeProblem({
          answer: 'SELECT name FROM products WHERE price > 1000',
          blanks: [{ answer: 'price > 1000', wrong: [{ text: 'price > 10', why: '-' }] }],
        }),
      ),
    ]);
    expect(issues).toEqual([expect.stringContaining('「price > 10」が「price > 1000」の先頭部分')]);
  });

  it('display と answer が違うSQLだと見つける', () => {
    const issues = checkBlanks([
      entry(makeProblem({ display: 'SELECT name, price\nFROM products\nWHERE price > 1000' })),
    ]);
    expect(issues.some((i) => i.includes('display と answer が違うSQL'))).toBe(true);
  });

  it('空欄の正解と表示用SQLで、文字列の中の大文字・小文字が違うと見つける', () => {
    const issues = checkBlanks([
      entry(
        makeProblem({
          answer: "SELECT name FROM products WHERE name = 'Mug'",
          blanks: [{ answer: "WHERE name = 'MUG'", wrong: [{ text: 'ORDER BY name', why: '-' }] }],
        }),
      ),
    ]);
    expect(issues).toEqual([expect.stringContaining('0 回出てきます')]);
  });

  it('同じ選択肢が2つあると見つける', () => {
    const issues = checkBlanks([
      withBlank({
        answer: 'WHERE price >= 1000',
        wrong: [{ text: 'where  price >= 1000', why: '-' }],
      }),
    ]);
    expect(issues).toEqual([expect.stringContaining('同じです')]);
  });
});
