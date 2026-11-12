/**
 * PGlite を使う問題データの検証。
 * - 正解SQLが、その章の初期データ＋extraSql の上で実行でき、結果が空でない（checkAnswersRun）
 * - 句の途中までのSQLを実行しても止まらない（checkClausePrefixes）
 * - モード2の間違いの選択肢を入れたSQLが、判定で正解にならない（checkWrongChoices）
 * - ordered の問題の並びが1つに決まる（checkOrderDetermined）
 * - 正解SQLのステップ再生が作れる（checkStepsBuild）
 * PGlite を使わない検証もここに置く（打てる文字か checkTypable、モード2の空欄が遊べるか checkBlanksPlayable）
 *
 * 注意：Node 版の PGlite では打ち切りの時計が動かない（node-backend.js）。
 * 終わらない正解SQLがあると、この検証（と npm run build の prebuild）自体が止まる。
 */
import { splitClauses, canRunWhileTyping } from '../../src/core/clause-splitter.js';
import { judge, computeExpected } from '../../src/core/judge.js';
import { tokenize } from '../../src/core/sql-text.js';
import { splitSelectList } from '../../src/core/stepper/select-list.js';
import { buildTarget, untypableSlots } from '../../src/core/typing-engine.js';
import { locateBlanks } from '../../src/core/blank-typing.js';
import { buildSteps } from '../../src/core/stepper/index.js';

/**
 * 問題ごとに、章の初期データ＋extraSql の状態にしてから fn を呼ぶ（章・初期データがない問題は飛ばす。別の検証で報告する）
 * @param {Parameters<typeof checkAnswersRun>[0]} args
 * @param {(entry: { file: string, problem: import('../../src/schema/problem-schema.js').Problem }) => Promise<string[]>} fn
 */
async function forEachPrepared({ runner, chapters, entries, readSeed }, fn) {
  const seedOf = new Map(chapters.map((chapter) => [chapter.id, chapter.seed]));
  const issues = [];
  for (const entry of entries) {
    const seedFile = seedOf.get(entry.problem.chapterId);
    if (!seedFile) continue;
    try {
      await runner.prepare({ seedSql: readSeed(seedFile), extraSql: entry.problem.setup.extraSql });
    } catch {
      continue; // 初期データ・extraSql の問題は checkAnswersRun が報告する
    }
    issues.push(...(await fn(entry)));
  }
  return issues;
}

/**
 * モード2の間違いの選択肢を空欄に入れたSQLが、判定で正解にならないか。
 * （例：ちょうど1000円の商品がないと、price >= 1000 の問題の「price > 1000」は正解になってしまう）
 * @param {Parameters<typeof checkAnswersRun>[0]} args
 * @returns {Promise<string[]>}
 */
export async function checkWrongChoices(args) {
  return forEachPrepared(args, async ({ file, problem }) => {
    const issues = [];
    const expected = await computeExpected({ problem, runner: args.runner });
    if (!expected.ok) return issues; // 正解SQLの問題は checkAnswersRun が報告する
    const shown = problem.display ?? problem.answer;
    let ranges;
    try {
      ranges = blankCharRanges(shown, problem.blanks);
    } catch (error) {
      // 画面で遊べない空欄。checkBlanksPlayable も同じ理由で報告する
      issues.push(`${file}: ${error.message}（置き換えて確かめられない）`);
      return issues;
    }
    for (const { blank, from, to } of ranges) {
      const index = problem.blanks.indexOf(blank);
      for (const wrong of blank.wrong) {
        // 画面と同じ範囲（locateBlanks）を置き換える。改行・字下げ・大文字小文字が表示用SQLと違っても確かめられる
        const sql = shown.slice(0, from) + wrong.text + shown.slice(to);
        const result = await judge({ sql, problem, runner: args.runner, expected });
        if (result.status === 'correct') {
          issues.push(
            `${file}: 空欄${index + 1}の間違いの選択肢「${wrong.text}」を入れても正解になります（初期データでは結果が同じ）`,
          );
        } else if (result.status === 'ruleViolation') {
          // 結果が同じで、条件（require・forbid）だけが違う。モード2では「間違いなのに結果が同じ」に見える
          issues.push(
            `${file}: 空欄${index + 1}の間違いの選択肢「${wrong.text}」を入れても結果は同じです（条件だけが違う。結果が変わる選択肢にする）`,
          );
        }
      }
    }
    return issues;
  });
}

/**
 * ordered: true の問題で、行の並びが1つに決まるか。
 * 同じ並びの値の行があると、同じ値どうしの並べ方（ctid や行全体の向き）を変えたときに並び（と LIMIT で残る行）が変わる。
 * - 単一のテーブルで DISTINCT・GROUP BY のない形：`… ORDER BY o, ctid ASC` と `DESC` を比べる
 * - それ以外（DISTINCT・GROUP BY・HAVING・JOIN・サブクエリ）：`… ORDER BY o, 1 ASC, 2 ASC, …` と `DESC` を比べる
 *   （出す列の番号で同じ値の行を並べる。ctid が使えず、サブクエリで包むと ORDER BY の o.id のようなテーブルの別名が見えなくなるため。
 *   出す列が全部同じ行は同じ行なので、並べ方が変わっても結果は同じ）
 * - 列の番号で並べる形で、SELECT に * があるもの（`SELECT *`・`p.*`）は、番号と出す列の数がずれるので確かめられない形として止める
 * 既知の制限：同じ値の行が3つ以上で、並びが a, b, a のように前後対称だと見逃す
 * @param {Parameters<typeof checkAnswersRun>[0]} args
 * @returns {Promise<string[]>}
 */
export async function checkOrderDetermined(args) {
  const ordered = args.entries.filter(({ problem }) => problem.judge.ordered);
  return forEachPrepared({ ...args, entries: ordered }, async ({ file, problem }) => {
    const sql = problem.answer;
    const { ok, clauses } = splitClauses(sql);
    if (!ok) {
      return [`${file}: 並びが1つに決まるか確かめられない形のSQLです（WITH・UNION など）`];
    }
    const byKind = Object.fromEntries(clauses.map((c) => [c.kind, c]));
    if (!byKind['ORDER BY']) {
      return [`${file}: ordered: true なのに ORDER BY がありません（並びが決まらない）`];
    }
    const text = (kind) => (byKind[kind] ? sql.slice(byKind[kind].start, byKind[kind].end) : '');
    const { distinct, items } = splitSelectList(text('SELECT'));
    const list = items.map((item) => item.text).join(', ');
    const rest = [text('FROM'), text('WHERE'), text('GROUP BY'), text('HAVING')].join(' ');
    const fromTokens = tokenize(text('FROM')).filter((t) => t.type !== 'space');
    const simple =
      !distinct &&
      !byKind['GROUP BY'] &&
      !byKind.HAVING &&
      !fromTokens.some((t) => t.text === ',' || t.text === '(' || /^join$/i.test(t.text));
    // 出す列の番号で並べる形は、* があると番号が出す列の数とずれて見逃すので、確かめられない形にする
    if (!simple && items.some((item) => /(^|\.)\*$/.test(item.text.trim()))) {
      return [
        `${file}: 並びが1つに決まるか確かめられない形です（* で出す列を書いた DISTINCT・GROUP BY・JOIN）`,
      ];
    }
    const twoWays = simple
      ? ['ASC', 'DESC'].map(
          (dir) => `SELECT ${list} ${rest} ${text('ORDER BY')}, ctid ${dir} ${text('LIMIT')}`,
        )
      : ['ASC', 'DESC'].map(
          (dir) =>
            `SELECT ${distinct ? 'DISTINCT ' : ''}${list} ${rest} ${text('ORDER BY')}, ${items
              .map((_, i) => `${i + 1} ${dir}`)
              .join(', ')} ${text('LIMIT')}`,
        );
    const results = [];
    for (const query of twoWays) {
      const outcome = await args.runner.run(query);
      if (!outcome.ok) {
        return [
          `${file}: 並びが1つに決まるか確かめられません（${'error' in outcome ? outcome.error.message : '打ち切り'}）`,
        ];
      }
      results.push(JSON.stringify(outcome.result.rows));
    }
    return results[0] === results[1]
      ? []
      : [
          `${file}: 並びが1つに決まりません（ORDER BY の値が同じ行がある。並べる列を足すか初期データを変える）`,
        ];
  });
}

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
 * 空欄の、表示用SQLの中の文字の範囲（画面と同じ locateBlanks で探す）。見つからない・重なるなら投げる。
 * @param {string} shown
 * @param {import('../../src/schema/problem-schema.js').Blank[]} blanks
 * @returns {{ blank: import('../../src/schema/problem-schema.js').Blank, from: number, to: number }[]}
 */
function blankCharRanges(shown, blanks) {
  const target = buildTarget(shown);
  return locateBlanks(target, blanks).map(({ start, end, blank }) => {
    const last = target.slots[end - 1];
    return {
      blank,
      from: target.slots[start].start,
      to: last.kind === 'separator' ? last.end : last.start + 1,
    };
  });
}

/**
 * @param {{ start: number, end: number }[]} tokens
 * @param {number} at - 文字の位置
 * @returns {boolean} その位置が、1つの語（トークン）の途中か
 */
function insideToken(tokens, at) {
  return tokens.some((token) => token.start < at && at < token.end);
}

/**
 * モード2の空欄が画面で遊べるか（PGlite を使わない）。
 * - 空欄の正解が、表示用SQLのスロットの中に見つかり、空欄どうしが重ならない（画面と同じ locateBlanks で確かめる）
 * - 空欄の始まり・終わりが、語の途中でない（`x = 10` の `= 1` を空欄にすると、残りの `0` だけを打つことになる）
 * - 選択肢（正解・間違い）に、打てない文字がない
 * @param {{ file: string, problem: import('../../src/schema/problem-schema.js').Problem }[]} entries
 * @returns {string[]}
 */
export function checkBlanksPlayable(entries) {
  return entries.flatMap(({ file, problem }) => {
    const issues = [];
    const shown = problem.display ?? problem.answer;
    try {
      const tokens = tokenize(shown);
      for (const { blank, from, to } of blankCharRanges(shown, problem.blanks)) {
        if (insideToken(tokens, from) || insideToken(tokens, to)) {
          issues.push(`${file}: 空欄「${blank.answer}」の始まりか終わりが、語の途中です`);
        }
      }
    } catch (error) {
      issues.push(`${file}: ${error.message}`);
    }
    for (const blank of problem.blanks) {
      for (const text of [blank.answer, ...blank.wrong.map((w) => w.text)]) {
        for (const { char } of untypableSlots(buildTarget(text))) {
          issues.push(
            `${file}: 選択肢「${text}」に打てない文字 ${JSON.stringify(char)} があります`,
          );
        }
      }
    }
    return issues;
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

/**
 * 正解SQL（表示用SQL）のステップ再生が作れるか。画面では、クリアの結果と書く画面から開ける。
 * - mismatch（最後の段階が結果と合わない）・error は止める（画面に「作れませんでした」と出てしまう）
 * - unsupported（JOIN・集計など、まだ段階を作れない形）は止めない（画面は「まだありません」と出す）
 * - 書き換え系は確かめない（ステップ再生は SELECT だけ）
 * @param {Parameters<typeof checkAnswersRun>[0]} args
 * @returns {Promise<string[]>}
 */
export async function checkStepsBuild(args) {
  return forEachPrepared(args, async ({ file, problem }) => {
    const shown = problem.display ?? problem.answer;
    const firstWord = tokenize(shown).find((t) => t.type !== 'space' && t.type !== 'comment');
    if (firstWord?.text.toUpperCase() !== 'SELECT') return [];
    const built = await buildSteps(shown, args.runner);
    if (built.ok || built.reason === 'unsupported') return [];
    return [`${file}: 正解SQLのステップ再生を作れません（${built.reason}：${built.message}）`];
  });
}
