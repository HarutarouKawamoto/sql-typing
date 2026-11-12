import { useMemo } from 'react';
import { findKeywordSpans } from '../../core/keyword-spans.js';
import { getKeywordWords } from '../state/keyword-words.js';
import styles from './KeywordText.module.css';

/**
 * SQLの文字を描き、用語辞典の語に data-keyword を付ける（カーソルを当てると KeywordTipLayer が説明を出す）。
 * 語には点線の下線を付けて、説明が見られることを知らせる。キーボードでも見られるよう、語に Tab で移れる（移ると説明が出る）。
 * @param {{ text: string }} props
 */
export function KeywordText({ text }) {
  const parts = useMemo(() => {
    const result = [];
    let cursor = 0;
    for (const span of findKeywordSpans(text, getKeywordWords())) {
      if (span.start > cursor) result.push({ text: text.slice(cursor, span.start) });
      result.push({ text: text.slice(span.start, span.end), word: span.word });
      cursor = span.end;
    }
    if (cursor < text.length) result.push({ text: text.slice(cursor) });
    return result;
  }, [text]);

  return parts.map((part, index) =>
    part.word ? (
      <span key={index} className={styles.keyword} data-keyword={part.word} tabIndex={0}>
        {part.text}
      </span>
    ) : (
      part.text
    ),
  );
}
