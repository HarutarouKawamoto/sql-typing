import { describe, it, expect } from 'vitest';
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

/*
 * 問題データの検証（安全柵）。1つでも失敗したら prebuild で build が止まる。
 * PGlite を使う検証（正解SQLが動くか・0行でないか・間違いの選択肢が不正解になるか・順番が1つに決まるか）は
 * SqlRunner を作る作業でここに足す。
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
