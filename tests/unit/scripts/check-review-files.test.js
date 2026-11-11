import { describe, it, expect } from 'vitest';
import {
  parseReviewTable,
  parseNameStatusZ,
  compareFileLists,
  isExcluded,
} from '../../../scripts/check-review-files.js';

const REVIEW = `# 📝 記録

## 変更したファイル一覧
| 区分 | ファイル | 何をしたか |
|---|---|---|
| 追加 | \`src/core/typing-engine.js\` | 判定 |
| 変更 | \`docs/architecture.md\` | 追記 |
| 名前変更 | \`old.js\` → \`new.js\` | 名前 |

## 挙動の変化
| 追加 | \`ignored.js\` | 次の章の表は読まない |
`;

const table = (rows) =>
  `## 変更したファイル一覧\n| 区分 | ファイル | 何をしたか |\n|---|---|---|\n${rows}\n`;

describe('parseReviewTable', () => {
  it('変更したファイル一覧の表だけを読み、パスと区分を返す', () => {
    const parsed = parseReviewTable(REVIEW);
    expect(parsed.ok).toBe(true);
    expect([...parsed.files]).toEqual([
      ['src/core/typing-engine.js', '追加'],
      ['docs/architecture.md', '変更'],
      ['new.js', '名前変更'],
    ]);
  });

  it('見出しがないと ok: false', () => {
    expect(parseReviewTable('# 記録\n').ok).toBe(false);
  });

  it('パスがバッククォートで囲まれていないと ok: false', () => {
    expect(parseReviewTable(table('| 追加 | src/a.js | x |')).ok).toBe(false);
  });

  it('決まっていない区分（表記ゆれ）があると ok: false', () => {
    const parsed = parseReviewTable(table('| 新規 | `src/a.js` | x |'));
    expect(parsed).toEqual({ ok: false, reason: expect.stringContaining('区分「新規」') });
  });

  it('同じパスが2回あると ok: false', () => {
    const parsed = parseReviewTable(table('| 追加 | `a.js` | x |\n| 変更 | `a.js` | y |'));
    expect(parsed).toEqual({ ok: false, reason: expect.stringContaining('2回') });
  });

  it('名前変更に古いパスがないと ok: false', () => {
    expect(parseReviewTable(table('| 名前変更 | `new.js` | x |')).ok).toBe(false);
  });

  it('表に行がないと ok: false', () => {
    expect(parseReviewTable(table('')).ok).toBe(false);
  });
});

describe('parseNameStatusZ', () => {
  it('追加・変更・削除・名前変更を区分にする（名前変更は新しいパス）', () => {
    const files = parseNameStatusZ('A\0src/a.js\0M\0src/b.js\0D\0src/c.js\0R087\0old.js\0new.js\0');
    expect([...files]).toEqual([
      ['src/a.js', '追加'],
      ['src/b.js', '変更'],
      ['src/c.js', '削除'],
      ['new.js', '名前変更'],
    ]);
  });

  it('日本語や空白を含むパスをそのまま読む', () => {
    const files = parseNameStatusZ('A\0docs/日本語 メモ.md\0');
    expect([...files]).toEqual([['docs/日本語 メモ.md', '追加']]);
  });

  it('除外フォルダへの名前変更は、古いパスの削除として扱う', () => {
    const files = parseNameStatusZ('R100\0src/a.js\0.steering/x/a.js\0');
    expect([...files]).toEqual([['src/a.js', '削除']]);
  });

  it('除外フォルダからの名前変更は、新しいパスの追加として扱う', () => {
    const files = parseNameStatusZ('R100\0docs/review/a.md\0docs/a.md\0');
    expect([...files]).toEqual([['docs/a.md', '追加']]);
  });

  it('扱えない状態（衝突など）は例外にする', () => {
    expect(() => parseNameStatusZ('U\0src/a.js\0')).toThrow('扱えない git の状態');
  });
});

describe('compareFileLists', () => {
  const map = (entries) => new Map(entries);

  it('一致していれば食い違いは0件', () => {
    expect(compareFileLists(map([['a.js', '追加']]), map([['a.js', '追加']]))).toEqual([]);
  });

  it('記録にないファイルを見つける', () => {
    expect(compareFileLists(map([]), map([['a.js', '追加']]))).toEqual(['記録にない：追加 a.js']);
  });

  it('git の差分にないファイルを見つける', () => {
    expect(compareFileLists(map([['a.js', '変更']]), map([]))).toEqual([
      'git の差分にない：変更 a.js',
    ]);
  });

  it('区分の違いを見つける', () => {
    expect(compareFileLists(map([['a.js', '変更']]), map([['a.js', '追加']]))).toEqual([
      '区分が違う：a.js（記録：変更／git：追加）',
    ]);
  });

  it('docs/review/ と .steering/ は比べない', () => {
    const actual = map([
      ['docs/review/20261111-x.md', '追加'],
      ['.steering/20261111-x/tasklist.md', '追加'],
    ]);
    expect(compareFileLists(map([]), actual)).toEqual([]);
    expect(isExcluded('docs/reviewer.md')).toBe(false);
  });
});
