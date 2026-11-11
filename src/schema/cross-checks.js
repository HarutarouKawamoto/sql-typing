/**
 * ファイルをまたぐ問題データの決まりを確かめる。
 * どの関数も、見つかった問題を「<ファイル>: <説明>」の文字列の配列で返す（問題がなければ空の配列）。
 * PGlite を使う決まり（正解SQLが動くか など）は tests/integration/data-validation/ で確かめる。
 * 元：docs/functional-design.md の Problem の「制約」
 */

/**
 * @typedef {import('./problem-schema.js').Problem} Problem
 * @typedef {import('./chapter-schema.js').Chapter} Chapter
 * @typedef {import('./keyword-schema.js').Keyword} Keyword
 * @typedef {import('./character-schema.js').Character} Character
 * @typedef {{ file: string, problem: Problem }} ProblemEntry  file は data/problems/ からの相対パス（例 'beginner/03-where.yaml'）
 */

/**
 * 選択肢どうしを比べるための形にそろえる。大文字・小文字と、連続する空白・改行の違いを無視する。
 * TypingEngine（文字列の中だけ大文字・小文字を区別する）より厳しめにそろえ、紛らわしい選択肢を確実に見つける。
 * @param {string} text
 * @returns {string}
 */
export function normalizeForCompare(text) {
  return text.replace(/\s+/g, ' ').trim().toUpperCase();
}

/**
 * SQLどうしが「打つ文字として同じか」を比べるための形にそろえる。
 * 文字列リテラル（'...'。'' は中の ' 1文字）の外だけ、大文字・小文字と連続する空白・改行の違いを無視する。
 * 文字列の中はそのまま残す（TypingEngine も文字列の中は区別するため。'Mug' と 'MUG' は別）。
 * @param {string} sql
 * @returns {string}
 */
export function normalizeSqlForMatch(sql) {
  let out = '';
  let inString = false;
  let pendingSpace = false;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    if (inString) {
      out += ch;
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          out += "'";
          i += 1;
        } else {
          inString = false;
        }
      }
      continue;
    }
    if (/\s/.test(ch)) {
      pendingSpace = out.length > 0;
      continue;
    }
    if (pendingSpace) out += ' ';
    pendingSpace = false;
    if (ch === "'") inString = true;
    out += ch.toUpperCase();
  }
  return out;
}

/**
 * @param {string} haystack
 * @param {string} needle
 * @returns {number}
 */
function countOccurrences(haystack, needle) {
  let count = 0;
  let from = 0;
  for (;;) {
    const found = haystack.indexOf(needle, from);
    if (found === -1) return count;
    count += 1;
    from = found + 1;
  }
}

/**
 * 問題IDとファイル名・フォルダ名が合っているか、IDが重なっていないか。
 * @param {ProblemEntry[]} entries
 * @returns {string[]}
 */
export function checkProblemFiles(entries) {
  const issues = [];
  const seen = new Map();
  for (const { file, problem } of entries) {
    // ファイル名の形が違っても、IDの重なりは確かめる
    if (seen.has(problem.id)) {
      issues.push(`${file}: 問題ID ${problem.id} が ${seen.get(problem.id)} と重なっています`);
    } else {
      seen.set(problem.id, file);
    }
    const match = /^([a-z]+)\/(\d{2})-[a-z0-9-]+\.yaml$/.exec(file);
    if (!match) {
      issues.push(`${file}: ファイルの置き場所・名前が <章id>/<2桁>-<英語>.yaml になっていません`);
      continue;
    }
    const [, folder, number] = match;
    const expectedId = `${folder}-${number}`;
    if (problem.id !== expectedId) {
      issues.push(
        `${file}: 問題IDがファイル名と合いません（id: ${problem.id}／ファイル名から: ${expectedId}）`,
      );
    }
    if (problem.chapterId !== folder) {
      issues.push(
        `${file}: chapterId（${problem.chapterId}）がフォルダ名（${folder}）と合いません`,
      );
    }
    if (problem.order !== Number(number)) {
      issues.push(
        `${file}: order（${problem.order}）がファイル名の番号（${Number(number)}）と合いません`,
      );
    }
  }
  return issues;
}

/**
 * 章・用語・登場人物の id（word）が重なっていないか。
 * 重なっていると、参照の確認（Set で受ける）が黙って通ってしまうため。
 * @param {Chapter[]} chapters
 * @param {Keyword[]} keywords
 * @param {Character[]} characters
 * @returns {string[]}
 */
export function checkUniqueIds(chapters, keywords, characters) {
  const issues = [];
  const report = (file, label, values) => {
    const seen = new Set();
    for (const value of values) {
      if (seen.has(value)) issues.push(`${file}: ${label} ${value} が2回以上あります`);
      seen.add(value);
    }
  };
  report(
    'chapters.yaml',
    '章',
    chapters.map((c) => c.id),
  );
  report(
    'keywords.yaml',
    'キーワード',
    keywords.map((k) => k.word),
  );
  report(
    'characters.yaml',
    '登場人物',
    characters.map((c) => c.id),
  );
  return issues;
}

/**
 * chapters.yaml の problemIds と問題ファイルが対応しているか。ターニングポイントの位置。
 * @param {Chapter[]} chapters
 * @param {ProblemEntry[]} entries
 * @returns {string[]}
 */
export function checkChapters(chapters, entries) {
  const issues = [];
  const byId = new Map(entries.map((entry) => [entry.problem.id, entry]));
  const listed = new Set();

  for (const chapter of chapters) {
    const label = `chapters.yaml（${chapter.id}）`;
    chapter.problemIds.forEach((problemId, index) => {
      if (listed.has(problemId)) {
        issues.push(`${label}: 問題 ${problemId} が2回以上並んでいます`);
      }
      listed.add(problemId);
      const entry = byId.get(problemId);
      if (!entry) {
        issues.push(`${label}: 問題 ${problemId} のファイルがありません`);
        return;
      }
      if (entry.problem.chapterId !== chapter.id) {
        issues.push(`${label}: 問題 ${problemId} の chapterId が ${entry.problem.chapterId} です`);
      }
      if (entry.problem.order !== index + 1) {
        issues.push(
          `${label}: 問題 ${problemId} は ${index + 1} 番目に並んでいますが order は ${entry.problem.order} です`,
        );
      }
    });

    const turningPoints = chapter.problemIds.filter(
      (problemId) => byId.get(problemId)?.problem.kind === 'turningPoint',
    );
    if (turningPoints.length > 1) {
      issues.push(`${label}: ターニングポイントが ${turningPoints.length} 問あります（1問まで）`);
    }
    if (turningPoints.length === 1 && chapter.problemIds.at(-1) !== turningPoints[0]) {
      issues.push(`${label}: ターニングポイント ${turningPoints[0]} が章の最後にありません`);
    }
  }

  for (const { file, problem } of entries) {
    if (!listed.has(problem.id)) {
      issues.push(`${file}: chapters.yaml の problemIds に入っていません`);
    }
  }
  return issues;
}

/**
 * 問題の keywords が用語辞典に、会話の speaker が登場人物にあるか。
 * @param {ProblemEntry[]} entries
 * @param {Keyword[]} keywords
 * @param {Character[]} characters
 * @returns {string[]}
 */
export function checkReferences(entries, keywords, characters) {
  const issues = [];
  const words = new Set(keywords.map((k) => k.word));
  const speakers = new Set(characters.map((c) => c.id));
  for (const { file, problem } of entries) {
    for (const word of problem.keywords) {
      if (!words.has(word))
        issues.push(`${file}: キーワード ${word} が用語辞典（keywords.yaml）にありません`);
    }
    for (const line of [...problem.story.before, ...problem.story.after]) {
      if (!speakers.has(line.speaker)) {
        issues.push(`${file}: 話す人 ${line.speaker} が登場人物（characters.yaml）にいません`);
      }
    }
  }
  return issues;
}

/**
 * モード1・2で打つSQLと、モード2の空欄・選択肢の決まり。
 * - display（整形済みの表示用SQL）があるなら、answer と打つ文字として同じ（改行・字下げの違いだけ）
 * - 空欄の正解が、表示用SQL（display、なければ answer）にちょうど1回出てくる
 * - 選択肢（正解＋間違い）が2〜4個で、同じものがない
 * - どの選択肢も、別の選択肢の先頭部分になっていない（打ち切った時点で1つに決まるため）
 * @param {ProblemEntry[]} entries
 * @returns {string[]}
 */
export function checkBlanks(entries) {
  const issues = [];
  for (const { file, problem } of entries) {
    if (
      problem.display !== undefined &&
      normalizeSqlForMatch(problem.display) !== normalizeSqlForMatch(problem.answer)
    ) {
      issues.push(
        `${file}: display と answer が違うSQLになっています（違ってよいのは改行・字下げだけ）`,
      );
    }
    const shown = normalizeSqlForMatch(problem.display ?? problem.answer);
    problem.blanks.forEach((blank, index) => {
      const label = `${file}: 空欄${index + 1}`;
      const times = countOccurrences(shown, normalizeSqlForMatch(blank.answer));
      if (times !== 1) {
        issues.push(
          `${label}: 正解「${blank.answer}」が表示用SQLに ${times} 回出てきます（1回だけにする）`,
        );
      }

      // wrong の数は Zod でも 1〜3 個に絞っている。ここは選択肢の合計の決まりとしての二重の安全網
      const choices = [blank.answer, ...blank.wrong.map((w) => w.text)];
      if (choices.length < 2 || choices.length > 4) {
        issues.push(`${label}: 選択肢は2〜4個（今は ${choices.length} 個）`);
      }
      const normalized = choices.map(normalizeForCompare);
      for (let i = 0; i < normalized.length; i += 1) {
        for (let j = 0; j < normalized.length; j += 1) {
          if (i === j) continue;
          if (normalized[i] === normalized[j]) {
            if (i < j)
              issues.push(`${label}: 選択肢「${choices[i]}」と「${choices[j]}」が同じです`);
          } else if (normalized[j].startsWith(normalized[i])) {
            issues.push(
              `${label}: 選択肢「${choices[i]}」が「${choices[j]}」の先頭部分になっています`,
            );
          }
        }
      }
    });
  }
  return issues;
}

/**
 * ファイルをまたぐ決まりをすべて確かめる。
 * @param {{ chapters: Chapter[], entries: ProblemEntry[], keywords: Keyword[], characters: Character[] }} data
 * @returns {string[]}
 */
export function runAllChecks({ chapters, entries, keywords, characters }) {
  return [
    ...checkUniqueIds(chapters, keywords, characters),
    ...checkProblemFiles(entries),
    ...checkChapters(chapters, entries),
    ...checkReferences(entries, keywords, characters),
    ...checkBlanks(entries),
  ];
}
