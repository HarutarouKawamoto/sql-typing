import { useEffect } from 'react';
import { KeywordText } from '../components/KeywordText.jsx';
import styles from './DictionaryScreen.module.css';

const LEVEL_NAMES = { 1: '初級', 2: '中級', 3: '上級' };

/**
 * 用語辞典。レベルごとに、キーワードの英語の意味・SQLでの意味・短い例・初めて出てくる問題。
 * 初めて出てくる問題が開いていれば、押すとその問題のモード選択へ。Esc で一覧へ。幅の狭い画面でも見られる。
 * @param {{
 *   dictionary: ReturnType<typeof import('../../core/dictionary.js').buildDictionary> | null,
 *   loadError: string | null,
 *   isUnlocked: (problemId: string) => boolean,
 *   onOpenProblem: (problemId: string) => void,
 *   onHome: () => void,
 * }} props
 *   dictionary：問題を読み終えるまでは null（初めて出てくる問題が決まらないため）
 */
export function DictionaryScreen({ dictionary, loadError, isUnlocked, onOpenProblem, onHome }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.isComposing || event.key !== 'Escape') return;
      onHome();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onHome]);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>用語辞典</h1>
        <p className={styles.sub}>
          SQLのキーワードの、英語としての意味とSQLでの意味。Esc で一覧へ。
          問題のSQLでも、キーワードにカーソルを当てる（スマホではタップ）と同じ説明が出ます。
        </p>
      </header>
      {loadError && (
        <p className={styles.error} role="alert">
          問題を読み込めなかったため、用語辞典を作れませんでした（{loadError}）
        </p>
      )}
      {dictionary === null && !loadError && (
        <p className={styles.status}>問題を読み込んでいます…</p>
      )}
      {dictionary?.map(({ level, entries }) => (
        <section key={level} className={styles.level} aria-labelledby={`dict-level-${level}`}>
          <h2 id={`dict-level-${level}`} className={styles.levelTitle}>
            {LEVEL_NAMES[level]}（{entries.length}語）
          </h2>
          {entries.map((entry) => (
            <article
              key={entry.word}
              className={styles.entry}
              data-testid={`dict-${entry.word.replaceAll(' ', '-')}`}
            >
              <h3 className={styles.word}>{entry.word}</h3>
              <dl className={styles.list}>
                <dt>英語</dt>
                <dd>{entry.english}</dd>
                <dt>SQLでの意味</dt>
                <dd>{entry.meaning}</dd>
                <dt>例</dt>
                <dd>
                  <code className={styles.example}>
                    <KeywordText text={entry.example} />
                  </code>
                </dd>
                <dt>初めて出てくる問題</dt>
                <dd>
                  {entry.firstProblem === null && (
                    <span className={styles.muted}>問題にはまだ出てきません</span>
                  )}
                  {entry.firstProblem !== null && isUnlocked(entry.firstProblem.id) && (
                    <button
                      type="button"
                      className={styles.link}
                      onClick={() => onOpenProblem(entry.firstProblem.id)}
                    >
                      {entry.firstProblem.title}
                    </button>
                  )}
                  {entry.firstProblem !== null && !isUnlocked(entry.firstProblem.id) && (
                    <span className={styles.muted}>
                      {entry.firstProblem.title}（まだ開いていません）
                    </span>
                  )}
                </dd>
              </dl>
            </article>
          ))}
        </section>
      ))}
      <button type="button" className={styles.back} onClick={onHome}>
        一覧へもどる（Esc）
      </button>
    </div>
  );
}
