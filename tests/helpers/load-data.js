import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

/**
 * data/ フォルダの YAML を Node から読む（検証テスト用）。
 * アプリは @rollup/plugin-yaml で読むので、この関数はテストからだけ使う。
 * 形の検証はせず、読んだままの値を返す（検証はテストの側で行う）。
 * 読めないファイル・置き場所の違うファイルは、例外にせず loadIssues に「<ファイル>: 理由」で入れる
 * （黙って検証の対象から外れないように）。
 *
 * @param {string} dataDir - data/ フォルダの絶対パス
 * @returns {{
 *   chapters: unknown, characters: unknown, keywords: unknown,
 *   problemFiles: { file: string, raw: unknown }[],
 *   loadIssues: string[],
 * }}
 */
export function loadDataDir(dataDir) {
  const loadIssues = [];

  /** @param {string} path @param {string} label */
  const readYaml = (path, label) => {
    try {
      return parse(readFileSync(path, 'utf8'));
    } catch (error) {
      loadIssues.push(`${label}: 読めません（${error.message.split('\n')[0]}）`);
      return undefined;
    }
  };

  const problemsDir = join(dataDir, 'problems');
  const problemFiles = [];
  if (existsSync(problemsDir)) {
    for (const item of readdirSync(problemsDir, { withFileTypes: true })) {
      if (!item.isDirectory()) {
        loadIssues.push(`problems/${item.name}: 問題は problems/<章id>/ の中に置く`);
        continue;
      }
      const dir = join(problemsDir, item.name);
      for (const child of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        const file = `${item.name}/${child.name}`;
        if (child.isDirectory()) {
          loadIssues.push(`problems/${file}: 章のフォルダの中にフォルダを作らない`);
        } else if (!child.name.endsWith('.yaml')) {
          loadIssues.push(
            `problems/${file}: 問題ファイルの拡張子は .yaml（.yml などは検証されない）`,
          );
        } else {
          problemFiles.push({ file, raw: readYaml(join(dir, child.name), `problems/${file}`) });
        }
      }
    }
  }

  return {
    chapters: readYaml(join(dataDir, 'chapters.yaml'), 'chapters.yaml'),
    characters: readYaml(join(dataDir, 'characters.yaml'), 'characters.yaml'),
    keywords: readYaml(join(dataDir, 'keywords.yaml'), 'keywords.yaml'),
    problemFiles,
    loadIssues,
  };
}

/**
 * Zod の検証の失敗を「どの項目が・なぜ」の1行ずつにする。
 * @param {string} label
 * @param {import('zod').ZodError} error
 * @returns {string[]}
 */
export function describeZodError(label, error) {
  return error.issues.map(
    (issue) => `${label}: ${issue.path.join('.') || '(全体)'} — ${issue.message}`,
  );
}
