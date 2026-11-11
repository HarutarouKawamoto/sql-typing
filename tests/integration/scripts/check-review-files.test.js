import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectGitChanges } from '../../../scripts/check-review-files.js';

/*
 * 本物の git リポジトリ（一時フォルダ）で、差分の集め方を確かめる。
 * プロジェクトのリポジトリには触らない。
 */

let repo;

const git = (...args) =>
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.invalid', ...args], {
    cwd: repo,
    encoding: 'utf8',
  });
const write = (path, text = 'x') => {
  mkdirSync(join(repo, path, '..'), { recursive: true });
  writeFileSync(join(repo, path), text);
};

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'check-review-'));
  git('init', '-q', '-b', 'main');
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('collectGitChanges', () => {
  it('コミットが1つもないときは、すべてのファイルを追加として集める', () => {
    write('src/a.js');
    write('docs/b.md');
    expect([...collectGitChanges(undefined, repo)].sort()).toEqual([
      ['docs/b.md', '追加'],
      ['src/a.js', '追加'],
    ]);
  });

  it('サブフォルダから実行しても、ルートからのパスで、フォルダの外のファイルも集める', () => {
    write('src/a.js');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    write('src/a.js', 'changed');
    write('sub/z.js');
    write('top.js');
    expect([...collectGitChanges(undefined, join(repo, 'sub'))].sort()).toEqual([
      ['src/a.js', '変更'],
      ['sub/z.js', '追加'],
      ['top.js', '追加'],
    ]);
  });

  it('日本語と空白を含むパスを、そのままの名前で集める', () => {
    write('docs/日本語 メモ.md');
    expect([...collectGitChanges(undefined, repo)]).toEqual([['docs/日本語 メモ.md', '追加']]);
  });

  it('作業前のコミットを指定すると、そこからの差分を集める（git add した名前変更は名前変更）', () => {
    write('old.js', 'same content for rename detection');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    const base = git('rev-parse', 'HEAD').trim();
    write('next.js');
    git('add', '-A');
    git('commit', '-q', '-m', 'next');
    renameSync(join(repo, 'old.js'), join(repo, 'renamed.js'));
    git('add', '-A');
    expect([...collectGitChanges(base, repo)].sort()).toEqual([
      ['next.js', '追加'],
      ['renamed.js', '名前変更'],
    ]);
  });

  it('作業前のコミットとして存在しないものを渡すと例外になる', () => {
    write('a.js');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    expect(() => collectGitChanges('--output=x', repo)).toThrow();
  });
});
