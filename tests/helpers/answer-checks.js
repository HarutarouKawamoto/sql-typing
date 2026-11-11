/**
 * PGlite を使う問題データの検証。
 * 今は「正解SQLが、その章の初期データ＋extraSql の上で実行でき、結果が空でない」を確かめる。
 * 「間違いの選択肢が判定で不正解になる」「順番が1つに決まる」は Judge を作る作業で足す。
 *
 * 注意：Node 版の PGlite では打ち切りの時計が動かない（node-backend.js）。
 * 終わらない正解SQLがあると、この検証（と npm run build の prebuild）自体が止まる。
 */
import { splitClauses, canRunWhileTyping } from '../../src/core/clause-splitter.js';
import { tokenize } from '../../src/core/sql-text.js';
import { buildTarget, untypableSlots } from '../../src/core/typing-engine.js';

/**
 * モード1・2で打つSQL（display、なければ answer）に、キーボードから1回のキーで打てない文字がないか。
 * 文字列・コメントの中の改行やタブ、全角文字があると、画面では先に進めなくなる。
 * @param {{ file: string, problem: import('../../src/schema/problem-schema.js').Problem }[]} entries
 * @returns {string[]}
 */
export function checkTypable(entries) {
  return entries.flatMap(({ file, problem }) => {
    const shown = problem.display ?? problem.answer;
    return untypableSlots(buildTarget(shown)).map(
      ({ char, start }) =>
        `${file}: 表示用SQLの ${start + 1} 文字目に打てない文字 ${JSON.stringify(char)} があります（文字列・コメントの中に改行やタブを入れない）`,
    );
  });
}

/**
 * @param {{
 *   runner: import('../../src/data/sql-runner/sql-runner.js').SqlRunner,
 *   chapters: import('../../src/schema/chapter-schema.js').Chapter[],
 *   entries: { file: string, problem: import('../../src/schema/problem-schema.js').Problem }[],
 *   readSeed: (seedFile: string) => string,
 * }} args
 * @returns {Promise<string[]>} 見つかった問題（なければ空）
 */
export async function checkAnswersRun({ runner, chapters, entries, readSeed }) {
  const issues = [];

  // 章ごとに、初期データがあって流せるかを1回だけ確かめる（壊れていたら同じ章の問題は確かめない）
  const usableSeeds = new Map();
  for (const chapter of chapters) {
    const label = `chapters.yaml（${chapter.id}）`;
    let seedSql;
    try {
      seedSql = readSeed(chapter.seed);
    } catch {
      issues.push(`${label}: 初期データ data/seeds/${chapter.seed} がありません`);
      continue;
    }
    try {
      await runner.prepare({ seedSql });
      usableSeeds.set(chapter.id, seedSql);
    } catch (error) {
      issues.push(
        `${label}: 初期データ data/seeds/${chapter.seed} を流せません（${error.message}）`,
      );
    }
  }

  const chapterIds = new Set(chapters.map((chapter) => chapter.id));
  for (const { file, problem } of entries) {
    if (!chapterIds.has(problem.chapterId)) {
      issues.push(`${file}: chapterId ${problem.chapterId} の章が chapters.yaml にありません`);
      continue;
    }
    const seedSql = usableSeeds.get(problem.chapterId);
    if (seedSql === undefined) continue; // 初期データの問題は章として上で報告している
    try {
      await runner.prepare({ seedSql, extraSql: problem.setup.extraSql });
    } catch (error) {
      issues.push(`${file}: extraSql を流せません（${error.message}）`);
      continue;
    }
    const outcome = await runner.run(problem.answer);
    if (!outcome.ok && 'timeout' in outcome) {
      issues.push(`${file}: 正解SQLが時間内に終わりません`);
    } else if (!outcome.ok) {
      issues.push(
        `${file}: 正解SQLがエラーになります（${outcome.error.code} ${outcome.error.message}）`,
      );
    } else if (outcome.result.columns.length > 0 && outcome.result.rows.length === 0) {
      issues.push(
        `${file}: 正解SQLの結果が0行です（判定の意味がなくなるので、行が返る問題にする）`,
      );
    } else if (outcome.result.columns.length === 0 && outcome.result.affectedRows === 0) {
      issues.push(
        `${file}: 正解SQL（書き換え系）が1行も書き換えません（判定の意味がなくなるので、行が変わる問題にする）`,
      );
    }
  }
  return issues;
}

/**
 * 見える化C（打ちながら変化）のための検証。SELECT で始まる問題について：
 * - 表示用SQL（display、なければ answer）を ClauseSplitter で句に分けられる
 * - 各句の終わりまでの途中のSQLを実行しても、打ち切りや例外にならない（エラーになるのはよい）
 * - 最後の句までのSQL（＝全体）はエラーにならない
 * @param {Parameters<typeof checkAnswersRun>[0]} args
 * @returns {Promise<string[]>}
 */
export async function checkClausePrefixes({ runner, chapters, entries, readSeed }) {
  const issues = [];
  const seedOf = new Map(chapters.map((chapter) => [chapter.id, chapter.seed]));
  for (const { file, problem } of entries) {
    const shown = problem.display ?? problem.answer;
    const firstWord = tokenize(shown).find((t) => t.type !== 'space' && t.type !== 'comment');
    if (firstWord?.text.toUpperCase() !== 'SELECT') continue; // 書き換え系は打ちながら実行しない
    // 画面（use-typing-session）と同じ判定を使う
    if (!canRunWhileTyping(shown)) {
      issues.push(
        `${file}: 表示用SQLを打ちながら実行できません（句の重なり・順番、または SELECT ... INTO を確かめる）`,
      );
      continue;
    }
    const { clauses } = splitClauses(shown);
    const seedFile = seedOf.get(problem.chapterId);
    if (!seedFile) continue; // 章がない問題は checkAnswersRun が報告する
    await runner.prepare({ seedSql: readSeed(seedFile), extraSql: problem.setup.extraSql });
    for (const [index, clause] of clauses.entries()) {
      const prefix = shown.slice(0, clause.end);
      let outcome;
      try {
        outcome = await runner.run(prefix);
      } catch (error) {
        issues.push(`${file}: 途中までのSQL「${prefix}」で例外になりました（${error.message}）`);
        continue;
      }
      if (!outcome.ok && 'timeout' in outcome) {
        issues.push(`${file}: 途中までのSQL「${prefix}」が時間内に終わりません`);
      } else if (index === clauses.length - 1 && !outcome.ok) {
        issues.push(`${file}: 表示用SQLの全体がエラーになります（${outcome.error.code}）`);
      }
    }
  }
  return issues;
}
