import { useEffect, useState } from 'react';
import { loadProblem } from '../../data/problem-loader.js';
import { MODE_LABELS } from '../state/best-text.js';
import { StoryPanel } from '../components/StoryPanel.jsx';
import styles from './StoryScreen.module.css';

/**
 * 依頼の会話の画面。遊ぶ前（mode あり）と、読み返し（mode が null。幅の狭い画面でも読める）で使う。
 * Esc で一覧へ。
 * @param {{
 *   problemId: string,
 *   mode: '1' | '2' | '3' | '4' | null,
 *   onDone: () => void,
 *   onHome: () => void,
 * }} props
 */
export function StoryScreen({ problemId, mode, onDone, onHome }) {
  const [problem, setProblem] = useState(
    /** @type {import('../../schema/problem-schema.js').Problem | { error: string } | null} */ (
      null
    ),
  );

  useEffect(() => {
    let active = true;
    loadProblem(problemId).then(
      (loaded) => active && setProblem(loaded),
      (error) => {
        console.error(error);
        if (active) setProblem({ error: String(error?.message ?? error) });
      },
    );
    return () => {
      active = false;
    };
  }, [problemId]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !event.isComposing && !event.repeat) onHome();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onHome]);

  if (!problem) return <p>会話を読み込んでいます…</p>;
  if ('error' in problem) {
    return <p role="alert">問題を開けませんでした（{problem.error}）。Esc でもどります。</p>;
  }
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>{problem.title}</h1>
        <p className={styles.sub}>
          {mode === null
            ? '依頼の会話（読み返し）'
            : `このあと：モード${mode} ${MODE_LABELS[mode]}`}
          ・Esc で一覧へ
        </p>
      </header>
      <StoryPanel
        lines={problem.story.before}
        onDone={onDone}
        doneLabel={mode === null ? 'モード選択にもどる' : '始める'}
      />
    </div>
  );
}
