/**
 * 書く画面（モード3・4）の入力欄で使う、React に依存しない小さな部品（単体テストできるように分けた）。
 */

const INDENT = '  ';

/**
 * 入力欄の keydown をどう扱うかを決める。
 * - 'run'：Ctrl / ⌘ + Enter で実行
 * - 'indent'：Tab でスペース2つ（Shift などと一緒の Tab は、入力欄の外へ移れるように任せる）
 * - 'none'：入力欄に任せる（ふつうの文字・改行・日本語入力の変換中）
 * Esc（もどる）は画面全体で受けるので、ここでは扱わない。
 * @param {{ key: string, isComposing?: boolean, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean, shiftKey?: boolean }} event
 * @returns {'run' | 'indent' | 'none'}
 */
export function classifyEditorKey(event) {
  // 変換中の Enter は確定なので奪わない
  if (event.isComposing || event.key === 'Process') return 'none';
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) return 'run';
  if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
    return 'indent';
  }
  return 'none';
}

/**
 * 選んだ範囲（なければカーソルの位置）をスペース2つにする。
 * @param {string} value
 * @param {number} start - selectionStart
 * @param {number} end - selectionEnd
 * @returns {{ value: string, cursor: number }}
 */
export function insertIndent(value, start, end) {
  return {
    value: value.slice(0, start) + INDENT + value.slice(end),
    cursor: start + INDENT.length,
  };
}
