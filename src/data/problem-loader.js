import chaptersRaw from '/data/chapters.yaml';
import charactersRaw from '/data/characters.yaml';
import keywordsRaw from '/data/keywords.yaml';
import {
  ChaptersFileSchema,
  CharactersFileSchema,
  KeywordsFileSchema,
  ProblemSchema,
} from '../schema/index.js';

/**
 * 問題データ（data/）を読み、Zod で確かめて返す。
 * 本番のデータはビルド前の検証（npm run validate:data）で止まっているので、ここで形が合わないのは開発中だけ。
 * 問題ファイルは章ごとに、必要になったときに読み込む。
 * 元：docs/functional-design.md の ProblemLoader
 */

const PROBLEM_FILES = import.meta.glob('/data/problems/*/*.yaml', { import: 'default' });

/**
 * @template T
 * @param {import('zod').ZodType<T>} schema
 * @param {unknown} raw
 * @param {string} label
 * @returns {T}
 */
function parseOrThrow(schema, raw, label) {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.') || '(全体)'}: ${issue.message}`)
    .join(' / ');
  throw new Error(`${label} の形が合いません（${details}）`);
}

/** @returns {import('../schema/chapter-schema.js').Chapter[]} */
export function loadChapters() {
  return parseOrThrow(ChaptersFileSchema, chaptersRaw, 'data/chapters.yaml');
}

/** @returns {import('../schema/character-schema.js').Character[]} */
export function loadCharacters() {
  return parseOrThrow(CharactersFileSchema, charactersRaw, 'data/characters.yaml');
}

/** @returns {import('../schema/keyword-schema.js').Keyword[]} */
export function loadKeywords() {
  return parseOrThrow(KeywordsFileSchema, keywordsRaw, 'data/keywords.yaml');
}

/**
 * 章の問題を、chapters.yaml の出題順で返す。
 * @param {string} chapterId
 * @returns {Promise<import('../schema/problem-schema.js').Problem[]>}
 */
export async function loadProblems(chapterId) {
  const chapter = loadChapters().find((c) => c.id === chapterId);
  if (!chapter) throw new Error(`章 ${chapterId} が data/chapters.yaml にありません`);
  const prefix = `/data/problems/${chapterId}/`;
  const entries = Object.entries(PROBLEM_FILES).filter(([path]) => path.startsWith(prefix));
  const problems = await Promise.all(
    entries.map(async ([path, load]) => parseOrThrow(ProblemSchema, await load(), path)),
  );
  const byId = new Map(problems.map((p) => [p.id, p]));
  return chapter.problemIds.map((id) => {
    const problem = byId.get(id);
    if (!problem) throw new Error(`問題 ${id} のファイルが ${prefix} にありません`);
    return problem;
  });
}

/**
 * @param {string} problemId - 'beginner-01' など
 */
export async function loadProblem(problemId) {
  const chapterId = problemId.split('-')[0];
  const problem = (await loadProblems(chapterId)).find((p) => p.id === problemId);
  if (!problem) throw new Error(`問題 ${problemId} がありません`);
  return problem;
}
