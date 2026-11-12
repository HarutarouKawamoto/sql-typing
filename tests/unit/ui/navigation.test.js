import { describe, it, expect } from 'vitest';
import { HOME, navigationReducer } from '../../../src/ui/state/navigation.js';

const go = (state, ...actions) =>
  actions.reduce((s, action) => navigationReducer(s, action), state);

describe('navigationReducer', () => {
  it('一覧 → 問題を選ぶとモード選択 → モードを選ぶと依頼の会話 → 会話を終えると遊ぶ', () => {
    const mode = go(HOME, { type: 'openProblem', problemId: 'beginner-01' });
    expect(mode).toEqual({ screen: 'mode', problemId: 'beginner-01' });
    const story = go(mode, { type: 'chooseMode', mode: '3' });
    expect(story).toEqual({ screen: 'story', problemId: 'beginner-01', mode: '3' });
    expect(go(story, { type: 'storyDone' })).toEqual({
      screen: 'play',
      problemId: 'beginner-01',
      mode: '3',
    });
  });

  it('会話の読み返し（遊ばない）は、終えたらモード選択に戻る', () => {
    const reading = go(
      HOME,
      { type: 'openProblem', problemId: 'beginner-01' },
      { type: 'readStory' },
    );
    expect(reading).toEqual({ screen: 'story', problemId: 'beginner-01', mode: null });
    expect(go(reading, { type: 'storyDone' })).toEqual({
      screen: 'mode',
      problemId: 'beginner-01',
    });
  });

  it('modeSelect は今の問題のモード選択へ（狭い画面になったとき、遊ぶ画面へ進ませない）', () => {
    const story = { screen: 'story', problemId: 'beginner-01', mode: '1' };
    expect(go(story, { type: 'modeSelect' })).toEqual({ screen: 'mode', problemId: 'beginner-01' });
    expect(go(HOME, { type: 'modeSelect' })).toBe(HOME);
  });

  it('home はどこからでも一覧へ', () => {
    const play = { screen: 'play', problemId: 'beginner-01', mode: '1' };
    expect(go(play, { type: 'home' })).toBe(HOME);
  });

  it('next は次の問題のモード選択へ。次がなければ一覧へ', () => {
    const play = { screen: 'play', problemId: 'beginner-01', mode: '1' };
    expect(go(play, { type: 'next', problemId: 'beginner-02' })).toEqual({
      screen: 'mode',
      problemId: 'beginner-02',
    });
    expect(go(play, { type: 'next', problemId: null })).toBe(HOME);
  });

  it('一覧から設定へ。設定からは home で一覧へ。一覧のほかからは設定へ行かない', () => {
    const settings = go(HOME, { type: 'openSettings' });
    expect(settings).toEqual({ screen: 'settings' });
    expect(go(settings, { type: 'home' })).toBe(HOME);
    const mode = { screen: 'mode', problemId: 'beginner-01' };
    expect(go(mode, { type: 'openSettings' })).toBe(mode);
  });

  it('設定の画面では、問題につながる動き（modeSelect・chooseMode・storyDone）は何もしない', () => {
    const settings = { screen: 'settings' };
    expect(go(settings, { type: 'modeSelect' })).toBe(settings);
    expect(go(settings, { type: 'chooseMode', mode: '1' })).toBe(settings);
    expect(go(settings, { type: 'storyDone' })).toBe(settings);
    expect(go(settings, { type: 'readStory' })).toBe(settings);
  });

  it('その画面で意味のない動き（一覧での chooseMode・storyDone など）は何もしない', () => {
    expect(go(HOME, { type: 'chooseMode', mode: '1' })).toBe(HOME);
    expect(go(HOME, { type: 'storyDone' })).toBe(HOME);
    expect(go(HOME, { type: 'readStory' })).toBe(HOME);
    const play = { screen: 'play', problemId: 'beginner-01', mode: '1' };
    expect(go(play, { type: 'chooseMode', mode: '2' })).toBe(play);
  });
});
