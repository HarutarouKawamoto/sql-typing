#!/usr/bin/env node
/**
 * レビュー用の記録（docs/review/*.md）の「変更したファイル一覧」と、git の差分を照らし合わせる。
 *
 * 使い方：
 *   node scripts/check-review-files.js docs/review/20261111-scaffold.md [作業前のコミット]
 *
 * - 作業前のコミットを省くと、コミットがあれば HEAD、まだ1つもなければ空のツリーと比べる
 * - どのフォルダから実行しても、パスはリポジトリのルートからの相対パスで比べる
 * - git に登録していないファイルの名前変更は「削除＋追加」に見える。記録に「名前変更」と書くなら、
 *   先に `git add -A` してから実行する
 * 終了コード：0=一致 / 1=一致しない / 2=照合できない（git が使えない・記録の表が読めない など）
 * 決まり：docs/development-guidelines.md の「レビュー用の記録」
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** git の空のツリー（SHA-1）。コミットが1つもないときの比べる相手 */
export const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

/** 照合しないファイル（記録そのものと計画） */
export const EXCLUDED_PREFIXES = ['docs/review/', '.steering/'];

/** git の状態の記号 → 記録の「区分」 */
const STATUS_TO_KIND = { A: '追加', M: '変更', T: '変更', D: '削除', R: '名前変更', C: '追加' };

export const KINDS = ['追加', '変更', '削除', '名前変更'];

/**
 * @param {string} path
 * @returns {boolean}
 */
export function isExcluded(path) {
  return EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * 記録の「## 変更したファイル一覧」の表を読む。
 * 2列目のパスは `パス` のようにバッククォートで囲む。名前変更は `古い` → `新しい` と書く（新しい方で比べる）。
 * @param {string} markdown
 * @returns {{ ok: true, files: Map<string, string> } | { ok: false, reason: string }}
 */
export function parseReviewTable(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+変更したファイル一覧\s*$/.test(line));
  if (start === -1) return { ok: false, reason: '「## 変更したファイル一覧」の見出しがありません' };

  const files = new Map();
  let headerSeen = false;
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s/.test(line)) break; // 次の章で終わり
    if (!line.trim().startsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 2) continue;
    const [kind, pathCell] = cells;
    if (!headerSeen) {
      headerSeen = true; // 1行目は見出し行
      continue;
    }
    if (/^:?-+:?$/.test(kind)) continue; // 区切り行
    if (!KINDS.includes(kind)) {
      return { ok: false, reason: `区分「${kind}」は使えません（${KINDS.join('／')}）：${line}` };
    }
    const paths = [...pathCell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (paths.length === 0) {
      return { ok: false, reason: `パスがバッククォートで囲まれていない行があります：${line}` };
    }
    if (kind === '名前変更' && paths.length !== 2) {
      return {
        ok: false,
        reason: `名前変更は \`古い\` → \`新しい\` の2つのパスを書きます：${line}`,
      };
    }
    const path = paths.at(-1);
    if (files.has(path)) return { ok: false, reason: `同じパスが2回書かれています：${path}` };
    files.set(path, kind);
  }
  if (files.size === 0) return { ok: false, reason: '変更したファイル一覧の表に行がありません' };
  return { ok: true, files };
}

/**
 * `git diff --name-status -z` の出力（NUL 区切り）を読む。
 * 名前変更は、新しいパスが除外フォルダの中なら「古いパスの削除」、古いパスが除外フォルダの中なら
 * 「新しいパスの追加」として扱う（除外フォルダとの出し入れで照合から漏れないように）。
 * @param {string} output
 * @returns {Map<string, string>} パス → 区分
 */
export function parseNameStatusZ(output) {
  const files = new Map();
  const tokens = output.split('\0');
  let i = 0;
  while (i < tokens.length) {
    const status = tokens[i];
    if (!status) {
      i += 1;
      continue;
    }
    const kind = STATUS_TO_KIND[status[0]];
    if (!kind) throw new Error(`扱えない git の状態「${status}」があります（${tokens[i + 1]}）`);
    if (status[0] === 'R' || status[0] === 'C') {
      const [from, to] = [tokens[i + 1], tokens[i + 2]];
      if (status[0] === 'R' && isExcluded(to) && !isExcluded(from)) files.set(from, '削除');
      else if (status[0] === 'R' && isExcluded(from) && !isExcluded(to)) files.set(to, '追加');
      else files.set(to, kind);
      i += 3;
    } else {
      files.set(tokens[i + 1], kind);
      i += 2;
    }
  }
  return files;
}

/**
 * 記録の一覧と git の差分を比べる。
 * @param {Map<string, string>} recorded - 記録の表
 * @param {Map<string, string>} actual - git の差分
 * @returns {string[]} 食い違い（なければ空）
 */
export function compareFileLists(recorded, actual) {
  const problems = [];
  for (const [path, kind] of actual) {
    if (isExcluded(path)) continue;
    if (!recorded.has(path)) problems.push(`記録にない：${kind} ${path}`);
    else if (recorded.get(path) !== kind) {
      problems.push(`区分が違う：${path}（記録：${recorded.get(path)}／git：${kind}）`);
    }
  }
  for (const [path, kind] of recorded) {
    if (isExcluded(path)) continue;
    if (!actual.has(path)) problems.push(`git の差分にない：${kind} ${path}`);
  }
  return problems;
}

/**
 * @param {string[]} args
 * @param {string} [cwd]
 * @returns {string}
 */
function git(args, cwd) {
  // 引数をシェルに通さないよう execFileSync を使う
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * 作業前から今の作業ツリーまでの差分（git に登録していないファイルを含む）。
 * @param {string | undefined} base
 * @param {string} [cwd] - 実行する場所（既定は今いるフォルダ。リポジトリの中ならどこでもよい）
 * @returns {Map<string, string>}
 */
export function collectGitChanges(base, cwd = process.cwd()) {
  // git diff はルート基準、git ls-files は今いるフォルダ基準で出すので、ルートで実行してそろえる
  const root = git(['rev-parse', '--show-toplevel'], cwd).trim();

  let from;
  if (base) {
    // オプションとして解釈されないよう --end-of-options を付け、コミットに解決してから使う
    from = git(['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`], root).trim();
  } else {
    try {
      from = git(['rev-parse', '--verify', 'HEAD'], root).trim();
    } catch {
      from = EMPTY_TREE; // まだコミットが1つもない
    }
  }

  const changes = parseNameStatusZ(git(['diff', '--name-status', '-M', '-z', from, '--'], root));
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], root);
  for (const path of untracked.split('\0')) {
    // 追跡をやめたファイル（git rm --cached）は差分の側に「削除」で出ているので、上書きしない
    if (path && !changes.has(path)) changes.set(path, '追加');
  }
  return changes;
}

function main() {
  const [reviewPath, base] = process.argv.slice(2);
  if (!reviewPath) {
    console.error(
      '使い方：node scripts/check-review-files.js <docs/review/....md> [作業前のコミット]',
    );
    process.exit(2);
  }

  let parsed;
  try {
    parsed = parseReviewTable(readFileSync(reviewPath, 'utf8'));
  } catch (error) {
    console.error(`記録を読めません：${reviewPath}（${error.message}）`);
    process.exit(2);
  }
  if (!parsed.ok) {
    console.error(`記録の表を読めません：${parsed.reason}`);
    process.exit(2);
  }

  let actual;
  try {
    actual = collectGitChanges(base);
  } catch (error) {
    console.error(`git の差分を取れません：${error.message}`);
    process.exit(2);
  }

  const problems = compareFileLists(parsed.files, actual);
  if (problems.length > 0) {
    console.error(
      `NG：記録の「変更したファイル一覧」と git の差分が ${problems.length} か所食い違っています`,
    );
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  const count = [...actual.keys()].filter((p) => !isExcluded(p)).length;
  console.log(`OK：記録の一覧と git の差分が一致しました（${count} ファイル）`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
