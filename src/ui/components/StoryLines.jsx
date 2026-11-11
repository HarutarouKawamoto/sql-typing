import { useState } from 'react';
import { loadCharacters } from '../../data/problem-loader.js';
import styles from './StoryLines.module.css';

/**
 * 会話の行を、話している人の名前（登場人物の色）と一緒に並べる。
 * 依頼の会話（StoryPanel）・クリア後の会話（AfterStory）・書く画面の依頼で共有する。
 * @param {{ lines: { speaker: string, text: string }[] }} props
 */
export function StoryLines({ lines }) {
  const [characters] = useState(() => new Map(loadCharacters().map((c) => [c.id, c])));
  return (
    <ul className={styles.lines}>
      {lines.map((line, index) => {
        const character = characters.get(line.speaker);
        return (
          <li key={index} className={styles.line}>
            <span
              className={styles.speaker}
              style={character ? { color: `var(${character.color})` } : undefined}
            >
              {character?.name ?? line.speaker}
            </span>
            <span>{line.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
