import { describe, it, expect } from 'vitest';
import { classifyEditorKey, insertIndent } from '../../../src/ui/state/editor-keys.js';

const keyEvent = (overrides) => ({
  key: 'a',
  isComposing: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides,
});

describe('classifyEditorKey', () => {
  it('Ctrl + Enter・⌘ + Enter は実行', () => {
    expect(classifyEditorKey(keyEvent({ key: 'Enter', ctrlKey: true }))).toBe('run');
    expect(classifyEditorKey(keyEvent({ key: 'Enter', metaKey: true }))).toBe('run');
  });

  it('Enter だけは改行（入力欄に任せる）', () => {
    expect(classifyEditorKey(keyEvent({ key: 'Enter' }))).toBe('none');
  });

  it('Tab はスペース2つ。Shift・Ctrl・Alt との組み合わせは入力欄の外へ移る（キーボードだけで抜けられるように）', () => {
    expect(classifyEditorKey(keyEvent({ key: 'Tab' }))).toBe('indent');
    expect(classifyEditorKey(keyEvent({ key: 'Tab', shiftKey: true }))).toBe('none');
    expect(classifyEditorKey(keyEvent({ key: 'Tab', ctrlKey: true }))).toBe('none');
    expect(classifyEditorKey(keyEvent({ key: 'Tab', altKey: true }))).toBe('none');
  });

  it('Esc は画面全体で受けるので、入力欄では何もしない', () => {
    expect(classifyEditorKey(keyEvent({ key: 'Escape' }))).toBe('none');
  });

  it('日本語入力の変換中は、どのキーも入力欄に任せる（変換の確定を奪わない）', () => {
    for (const key of ['Enter', 'Tab']) {
      expect(
        classifyEditorKey(keyEvent({ key, isComposing: true, ctrlKey: key === 'Enter' })),
      ).toBe('none');
    }
    expect(classifyEditorKey(keyEvent({ key: 'Process' }))).toBe('none');
  });

  it('ふつうの文字は入力欄に任せる', () => {
    expect(classifyEditorKey(keyEvent({ key: 'S' }))).toBe('none');
  });
});

describe('insertIndent', () => {
  it('カーソルの位置にスペース2つを入れ、カーソルはその後ろ', () => {
    expect(insertIndent('SELECT\nFROM', 7, 7)).toEqual({ value: 'SELECT\n  FROM', cursor: 9 });
  });

  it('選んだ範囲はスペース2つに置き換える', () => {
    expect(insertIndent('SELECT xx FROM', 7, 9)).toEqual({ value: 'SELECT    FROM', cursor: 9 });
  });

  it('先頭・末尾でも入る', () => {
    expect(insertIndent('', 0, 0)).toEqual({ value: '  ', cursor: 2 });
    expect(insertIndent('a', 1, 1)).toEqual({ value: 'a  ', cursor: 3 });
  });
});
