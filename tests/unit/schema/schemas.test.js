import { describe, it, expect } from 'vitest';
import {
  ProblemSchema,
  ChapterSchema,
  CharactersFileSchema,
  KeywordSchema,
  ProgressSchema,
} from '../../../src/schema/index.js';
import { makeProblem, makeChapter, CHARACTERS } from '../../helpers/problem-factory.js';

const line = (speaker = 'tencho') => ({ speaker, text: '依頼。' });
const lines = (n) => Array.from({ length: n }, () => line());

describe('ProblemSchema', () => {
  it('決まりを満たした問題は通り、省略した項目に既定値が入る', () => {
    const { judge, setup, ...rest } = makeProblem();
    const parsed = ProblemSchema.parse({ ...rest, judge: { ordered: false } });
    expect(parsed.judge).toEqual({
      ordered: false,
      checkColumnNames: false,
      require: [],
      forbid: [],
    });
    expect(parsed.setup).toEqual({});
    expect(setup).toEqual({});
    expect(judge.ordered).toBe(false);
  });

  it('通常の問題は依頼の会話が9行で失敗する', () => {
    const problem = makeProblem();
    problem.story.before = lines(9);
    expect(ProblemSchema.safeParse(problem).success).toBe(false);
  });

  it('ターニングポイントは依頼の会話が12行まで通り、13行で失敗する', () => {
    const problem = makeProblem({ kind: 'turningPoint' });
    problem.story.before = lines(12);
    expect(ProblemSchema.safeParse(problem).success).toBe(true);
    problem.story.before = lines(13);
    expect(ProblemSchema.safeParse(problem).success).toBe(false);
  });

  it('会話の1行が41文字だと失敗する', () => {
    const problem = makeProblem();
    problem.story.after = [{ speaker: 'senpai', text: 'あ'.repeat(41) }];
    expect(ProblemSchema.safeParse(problem).success).toBe(false);
  });

  it('keywords に同じ語が2回あると失敗する', () => {
    expect(ProblemSchema.safeParse(makeProblem({ keywords: ['SELECT', 'SELECT'] })).success).toBe(
      false,
    );
  });

  it('選択肢に日本語があると失敗する', () => {
    const problem = makeProblem();
    problem.blanks[0].wrong[0].text = "WHERE name = 'マグ'";
    expect(ProblemSchema.safeParse(problem).success).toBe(false);
  });

  it('決めていない項目があると失敗する（書き間違いを見つけるため）', () => {
    expect(ProblemSchema.safeParse({ ...makeProblem(), hint: 'typo' }).success).toBe(false);
  });
});

describe('ChapterSchema', () => {
  it('newTables に tables にないテーブルがあると失敗する', () => {
    const result = ChapterSchema.safeParse(makeChapter({ newTables: ['orders'] }));
    expect(result.success).toBe(false);
  });

  it('作っている途中の章は問題が0問でも通る', () => {
    expect(ChapterSchema.safeParse(makeChapter({ problemIds: [] })).success).toBe(true);
  });
});

describe('CharactersFileSchema', () => {
  it('主人公（player）がいないと失敗する', () => {
    const others = CHARACTERS.filter((c) => c.id !== 'player');
    expect(CharactersFileSchema.safeParse(others).success).toBe(false);
  });
});

describe('KeywordSchema', () => {
  const keyword = (word) => ({ word, english: 'e', meaning: 'm', example: 'x', level: 1 });

  it('複数語のキーワードは半角スペース1つで区切れば通る', () => {
    expect(KeywordSchema.safeParse(keyword('ORDER BY')).success).toBe(true);
    expect(KeywordSchema.safeParse(keyword('IS NULL')).success).toBe(true);
  });

  it('小文字やスペース2つは失敗する', () => {
    expect(KeywordSchema.safeParse(keyword('select')).success).toBe(false);
    expect(KeywordSchema.safeParse(keyword('ORDER  BY')).success).toBe(false);
  });
});

describe('ProgressSchema', () => {
  const progress = (overrides = {}) => ({
    version: 1,
    problems: {
      'beginner-01': {
        modes: {
          1: {
            cleared: true,
            plays: 2,
            best: { timeMs: 12000, cpm: 180, accuracy: 96.5, rank: 'A' },
          },
        },
        stepReplayFinished: false,
      },
    },
    mistakes: { '(': 3 },
    typed: { '(': 20 },
    days: { '2026-11-11': { plays: 2, cleared: 1 } },
    settings: {},
    ...overrides,
  });

  it('一部のモードだけの記録が通り、設定に既定値が入る', () => {
    const parsed = ProgressSchema.parse(progress());
    expect(parsed.settings).toEqual({ reorderAnimation: true, replaySpeed: 1 });
  });

  it('モードの番号が 1〜4 以外だと失敗する', () => {
    const bad = progress();
    bad.problems['beginner-01'].modes = { 5: { cleared: true, plays: 1 } };
    expect(ProgressSchema.safeParse(bad).success).toBe(false);
  });

  it('日付のキーが YYYY-MM-DD でないと失敗する', () => {
    expect(
      ProgressSchema.safeParse(progress({ days: { '11/11': { plays: 1, cleared: 0 } } })).success,
    ).toBe(false);
  });

  it('version が 1 でないと失敗する', () => {
    expect(ProgressSchema.safeParse(progress({ version: 2 })).success).toBe(false);
  });

  it('再生の速さが決めた値（0.5 / 1 / 2）以外だと失敗する', () => {
    expect(ProgressSchema.safeParse(progress({ settings: { replaySpeed: 3 } })).success).toBe(
      false,
    );
  });
});
