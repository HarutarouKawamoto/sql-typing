import { useEffect, useRef, useState } from 'react';
import { getKeywordMap } from '../state/keyword-words.js';
import styles from './KeywordTipLayer.module.css';

/** 説明の幅の上限（px。画面の右にはみ出さないように左の位置を決めるため） */
const TIP_MAX_WIDTH_PX = 320;
const MARGIN_PX = 8;
const GAP_PX = 6;
/** 説明を出した場所が画面から消えていないかを見る間隔 */
const CHECK_INTERVAL_MS = 300;
const TIP_ID = 'keyword-tip';

/**
 * @param {EventTarget | null} target
 * @returns {Element | null} いちばん近い、説明を出す場所（data-keyword の付いた要素）
 */
const keywordOf = (target) => (target instanceof Element ? target.closest('[data-keyword]') : null);

/**
 * 同じ語の中か（TypingArea は1文字ずつ別の要素なので、data-keyword-group で同じ語かを見る）。
 * @param {Element | null} a
 * @param {Element | null} b
 */
const sameWord = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  const group = a.getAttribute('data-keyword-group');
  return (
    group !== null &&
    group === b.getAttribute('data-keyword-group') &&
    a.parentElement === b.parentElement
  );
};

/**
 * キーワードの説明（KeywordTip）。App に1つだけ置き、ページ全体の data-keyword の付いた場所を見る。
 * - マウスのカーソルを当てると出し、離れたら消す。キーボードで語に移っても出す（移ったら消す）
 * - 指で押す（タップ）と出し、同じ所をもう一度押すか外を押すと消す（スマホのため）。マウスのクリックでは変えない
 * - キーを押したら・スクロールしたら・画面の大きさが変わったら消す
 * - マウスが動いていないのに来る「当てた」は数えない。打った文字の要素が作り直されたり、画面が切り替わって
 *   止まっているカーソルの下に語が来たりすると、ブラウザが同じ位置で「当てた」を送ってくるため
 *   （タイピング中・画面を開いた直後に勝手に出さない）。マウスが実際に動いたら出す
 * - 説明を出した場所が画面から消えたら消す
 */
export function KeywordTipLayer() {
  const [tip, setTip] = useState(
    /** @type {{ word: string, element: Element, top: number, left: number, above: boolean, maxWidth: number } | null} */ (
      null
    ),
  );
  const shownRef = useRef(/** @type {Element | null} */ (null));

  useEffect(() => {
    /** @param {Element} element */
    const show = (element) => {
      const word = element.getAttribute('data-keyword');
      if (!word || !getKeywordMap().has(word)) return;
      hide();
      shownRef.current = element;
      element.setAttribute('aria-describedby', TIP_ID);
      const rect = element.getBoundingClientRect();
      // 画面の下半分なら上に出す（下にはみ出さないように）
      const above = rect.bottom > window.innerHeight / 2;
      const maxWidth = Math.min(TIP_MAX_WIDTH_PX, window.innerWidth - MARGIN_PX * 2);
      setTip({
        word,
        element,
        top: above ? rect.top - GAP_PX : rect.bottom + GAP_PX,
        left: Math.max(MARGIN_PX, Math.min(rect.left, window.innerWidth - maxWidth - MARGIN_PX)),
        above,
        maxWidth,
      });
    };
    const hide = () => {
      shownRef.current?.removeAttribute('aria-describedby');
      shownRef.current = null;
      setTip(null);
    };

    // 最後にマウスが実際に動いた位置。同じ位置の「当てた」「動いた」は、画面の描き直しで来たもの
    let lastMove = /** @type {{ x: number, y: number } | null} */ (null);
    /** @param {PointerEvent} event */
    const moved = (event) =>
      lastMove === null || lastMove.x !== event.clientX || lastMove.y !== event.clientY;

    /** @param {PointerEvent} event */
    const onPointerOver = (event) => {
      if (event.pointerType !== 'mouse' || !moved(event)) return;
      const element = keywordOf(event.target);
      // 同じ語の中を動いただけなら出し直さない（説明が1文字ずつ動かないように）
      if (element && !sameWord(element, shownRef.current)) show(element);
    };
    /** @param {PointerEvent} event */
    const onPointerMove = (event) => {
      if (event.pointerType !== 'mouse' || !moved(event)) return;
      lastMove = { x: event.clientX, y: event.clientY };
      // 描き直しで来た「当てた」を数えなかった語の上で、マウスが動いたときに出す
      const element = keywordOf(event.target);
      if (element && !sameWord(element, shownRef.current)) show(element);
    };
    /** @param {PointerEvent} event */
    const onPointerOut = (event) => {
      if (event.pointerType !== 'mouse') return;
      const from = keywordOf(event.target);
      if (!from || sameWord(from, keywordOf(event.relatedTarget))) return;
      hide();
    };
    /** @param {MouseEvent} event */
    const onClick = (event) => {
      const element = keywordOf(event.target);
      if (!element) {
        hide();
        return;
      }
      // マウスはカーソルを当てたときに出ているので、クリックでは変えない（指で押したときだけ出し入れする）
      if ('pointerType' in event && event.pointerType === 'mouse') return;
      if (shownRef.current === element) hide();
      else show(element);
    };
    const onKeyDown = () => hide();
    /** @param {FocusEvent} event */
    const onFocusIn = (event) => {
      const element = keywordOf(event.target);
      // キーボードで移ったときだけ（タップで移ったフォーカスで出すと、続く「押した」で消えてしまう）
      if (element && event.target === element && element.matches(':focus-visible')) show(element);
    };
    /** @param {FocusEvent} event */
    const onFocusOut = (event) => {
      if (keywordOf(event.target) === shownRef.current) hide();
    };

    document.addEventListener('pointerover', onPointerOver);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerout', onPointerOut);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerout', onPointerOut);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, []);

  // 説明を出した場所が消えたら（画面の切り替え・自動で進む描き直し）消す。消えたかは DOM を見るしかないので、出している間だけ見る
  useEffect(() => {
    if (!tip) return undefined;
    const timer = setInterval(() => {
      if (!tip.element.isConnected) {
        shownRef.current = null;
        setTip(null);
      }
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [tip]);

  if (!tip || !tip.element.isConnected) return null;
  const keyword = getKeywordMap().get(tip.word);
  return (
    <div
      id={TIP_ID}
      className={tip.above ? `${styles.tip} ${styles.above}` : styles.tip}
      style={{ top: tip.top, left: tip.left, maxWidth: tip.maxWidth }}
      role="tooltip"
      data-testid="keyword-tip"
    >
      <code className={styles.word}>{keyword.word}</code>
      <dl className={styles.list}>
        <dt>英語</dt>
        <dd>{keyword.english}</dd>
        <dt>SQLでの意味</dt>
        <dd>{keyword.meaning}</dd>
        <dt>例</dt>
        <dd>
          <code>{keyword.example}</code>
        </dd>
      </dl>
    </div>
  );
}
