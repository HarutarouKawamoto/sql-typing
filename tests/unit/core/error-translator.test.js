import { describe, it, expect } from 'vitest';
import { translateError } from '../../../src/core/error-translator.js';
import { ERROR_MESSAGES } from '../../../src/core/error-messages.js';

const pg = (code, message, extra = {}) => ({ code, message, multipleStatements: false, ...extra });

describe('ERROR_MESSAGES', () => {
  it('機能設計書の表の15種類がそろっていて、題名と原因が日本語で1つ以上ある', () => {
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual(
      [
        '42601',
        '42P01',
        '42703',
        '42883',
        '22P02',
        '42804',
        '42803',
        '42702',
        '22012',
        '42P10',
        '23502',
        '23505',
        '22007',
        '22008',
        '2201W',
      ].sort(),
    );
    for (const { title, causes } of Object.values(ERROR_MESSAGES)) {
      expect(title).toMatch(/[ぁ-んァ-ヶ一-龠]/);
      expect(causes.length).toBeGreaterThan(0);
    }
  });
});

describe('translateError', () => {
  it('知っているコードは題名と原因、英語の原文を返す', () => {
    expect(translateError(pg('42P01', 'relation "product" does not exist'))).toEqual({
      code: '42P01',
      original: 'relation "product" does not exist',
      title: 'そのテーブルはありません',
      causes: ERROR_MESSAGES['42P01'].causes,
    });
  });

  it('2つ以上の文は「1回に実行できるSQLは1つです」', () => {
    const translated = translateError(
      pg('42601', 'cannot insert multiple commands into a prepared statement', {
        multipleStatements: true,
      }),
    );
    expect(translated.title).toBe('1回に実行できるSQLは1つです');
    expect(translated.causes[0]).toContain(';');
  });

  it('文の途中で終わっているときは、その原因を先頭に足す', () => {
    const translated = translateError(pg('42601', 'syntax error at end of input'));
    expect(translated.title).toBe(ERROR_MESSAGES['42601'].title);
    expect(translated.causes[0]).toContain('途中で終わっています');
    expect(translated.causes.slice(1)).toEqual(ERROR_MESSAGES['42601'].causes);
  });

  it.each([
    ['42P01', 'invalid reference to FROM-clause entry for table "products"', '別名'],
    ['42803', 'aggregate functions are not allowed in WHERE', 'HAVING'],
    ['22P02', 'invalid input syntax for type boolean: "x"', 'AND'],
  ])('同じコードでも原文で原因が違うもの：%s', (code, message, word) => {
    const translated = translateError(pg(code, message));
    expect(translated.title).not.toBe(ERROR_MESSAGES[code].title);
    expect(translated.causes.join('')).toContain(word);
  });

  it('知らないコードは「エラーが起きました」と英語の原文', () => {
    expect(translateError(pg('XX000', 'internal error'))).toEqual({
      code: 'XX000',
      original: 'internal error',
      title: 'エラーが起きました',
      causes: [],
    });
  });
});
