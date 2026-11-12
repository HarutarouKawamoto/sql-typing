import { useEffect, useRef, useState } from 'react';
import styles from './SettingsScreen.module.css';

const SPEEDS = /** @type {const} */ ([
  { value: 0.5, label: 'ゆっくり（0.5倍）' },
  { value: 1, label: 'ふつう（1倍）' },
  { value: 2, label: '速く（2倍）' },
]);

/**
 * 設定画面。見える化B（実行順の並び替え）の on/off、ステップ再生の速さ、学習記録を消す。
 * 設定は変えたらすぐ保存する（App の useProgress）。学習記録を消すときは確かめを1回はさむ（PRD 機能12）。
 * Esc：確かめを出していれば閉じる。出していなければ一覧へ。
 * onClear は、保存されていた記録が消えたかを返す（消せない環境では「消せませんでした」と出す）。
 * @param {{
 *   settings: import('../../schema/progress-schema.js').Progress['settings'],
 *   onChange: (patch: Partial<import('../../schema/progress-schema.js').Progress['settings']>) => void,
 *   onClear: () => boolean,
 *   saveFailed: boolean,
 *   onHome: () => void,
 * }} props
 */
export function SettingsScreen({ settings, onChange, onClear, saveFailed, onHome }) {
  const [confirming, setConfirming] = useState(false);
  // 消したあとの知らせ（消せなかったときは 'failed'）
  const [result, setResult] = useState(/** @type {'cleared' | 'failed' | null} */ (null));
  const cancelRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const clearRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const wasConfirming = useRef(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.isComposing || event.repeat || event.key !== 'Escape') return;
      if (confirming) setConfirming(false);
      else onHome();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirming, onHome]);

  // 確かめを出したら「やめる」にフォーカス（Enter を続けて押しても消えないように）。
  // 閉じたら「学習記録を消す」にもどす（押したボタンが消えて、フォーカスが行き場をなくさないように）
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
    else if (wasConfirming.current) clearRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  const clear = () => {
    setResult(onClear() ? 'cleared' : 'failed');
    setConfirming(false);
  };

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>設定</h1>
        <p className={styles.sub}>変えるとすぐ保存されます。Esc で一覧へ。</p>
      </header>
      {saveFailed && (
        <p className={styles.notice} role="alert">
          この環境では学習記録と設定が保存されません（ページを閉じると元にもどります）。
        </p>
      )}

      <section className={styles.section} aria-labelledby="settings-visual">
        <h2 id="settings-visual" className={styles.heading}>
          見える化
        </h2>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={settings.reorderAnimation}
            onChange={(event) => onChange({ reorderAnimation: event.target.checked })}
            data-testid="setting-reorder"
          />
          モード3・4で実行するとき、句が実行順に入れ替わる動きを流す（見える化B・1.5秒）
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={settings.predictionQuiz}
            onChange={(event) => onChange({ predictionQuiz: event.target.checked })}
            data-testid="setting-prediction"
          />
          ステップ再生の前に、結果の行の数を予想するクイズを出す（見える化D）
        </label>
        <fieldset className={styles.speeds}>
          <legend>ステップ再生の速さ</legend>
          {SPEEDS.map(({ value, label }) => (
            <label key={value} className={styles.speed}>
              <input
                type="radio"
                name="replay-speed"
                value={value}
                checked={settings.replaySpeed === value}
                onChange={() => onChange({ replaySpeed: value })}
                data-testid={`setting-speed-${value}`}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </section>

      <section className={styles.section} aria-labelledby="settings-progress">
        <h2 id="settings-progress" className={styles.heading}>
          学習記録
        </h2>
        {confirming ? (
          <div
            className={styles.confirm}
            role="alertdialog"
            aria-labelledby="clear-confirm-title"
            aria-describedby="clear-confirm-text"
            data-testid="clear-confirm"
          >
            <p id="clear-confirm-title" className={styles.confirmTitle}>
              学習記録を消しますか？
            </p>
            <p id="clear-confirm-text" className={styles.confirmText}>
              クリア状況・最高記録・苦手の記録をすべて消します。元にもどせません。上の設定は残ります。
            </p>
            <div className={styles.buttons}>
              <button
                type="button"
                className={`${styles.button} ${styles.danger}`}
                onClick={clear}
                data-testid="clear-yes"
              >
                消す
              </button>
              <button
                type="button"
                className={styles.button}
                ref={cancelRef}
                onClick={() => setConfirming(false)}
                data-testid="clear-no"
              >
                やめる（Esc）
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            ref={clearRef}
            className={`${styles.button} ${styles.danger}`}
            onClick={() => {
              setResult(null);
              setConfirming(true);
            }}
            data-testid="clear-progress"
          >
            学習記録を消す
          </button>
        )}
        {/* 知らせの場所は先に置いておく（中身ごと出すと読み上げない環境があるため） */}
        <p className={result === 'failed' ? styles.failed : styles.done} role="status">
          {result === 'cleared' && '学習記録を消しました。'}
          {result === 'failed' &&
            'この環境では学習記録を消せませんでした。ページを読み込み直すと、記録がもどります。'}
        </p>
      </section>

      <button type="button" className={`${styles.button} ${styles.back}`} onClick={onHome}>
        一覧へもどる（Esc）
      </button>
    </div>
  );
}
