import { describe, it, expect, vi } from 'vitest';
import { classifyKeyEvent, createLatestOnlyRunner } from '../../../src/ui/state/typing-keys.js';

const keyEvent = (overrides) => ({
  key: 'a',
  isComposing: false,
  repeat: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  getModifierState: () => false,
  ...overrides,
});

describe('classifyKeyEvent', () => {
  it('普通のキーは key、Esc は exit', () => {
    expect(classifyKeyEvent(keyEvent({}))).toBe('key');
    expect(classifyKeyEvent(keyEvent({ key: 'Escape' }))).toBe('exit');
  });

  it('日本語入力（変換中・Process）は ime。変換中の Esc も画面を抜けない', () => {
    expect(classifyKeyEvent(keyEvent({ isComposing: true }))).toBe('ime');
    expect(classifyKeyEvent(keyEvent({ key: 'Process' }))).toBe('ime');
    expect(classifyKeyEvent(keyEvent({ key: 'Escape', isComposing: true }))).toBe('ime');
  });

  it('長押しの繰り返しと、Ctrl / Meta / Alt との組み合わせは skip', () => {
    expect(classifyKeyEvent(keyEvent({ repeat: true }))).toBe('skip');
    expect(classifyKeyEvent(keyEvent({ ctrlKey: true }))).toBe('skip');
    expect(classifyKeyEvent(keyEvent({ metaKey: true }))).toBe('skip');
    expect(classifyKeyEvent(keyEvent({ altKey: true }))).toBe('skip');
  });

  it('AltGr（Ctrl + Alt に見える）で打つ記号は通す', () => {
    const altGr = keyEvent({
      key: '{',
      ctrlKey: true,
      altKey: true,
      getModifierState: (name) => name === 'AltGraph',
    });
    expect(classifyKeyEvent(altGr)).toBe('key');
  });
});

/** 解決を外から決められる run */
function controllableRun() {
  const calls = [];
  const run = vi.fn((sql) => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    calls.push({ sql, resolve, reject });
    return promise;
  });
  return { run, calls };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createLatestOnlyRunner', () => {
  it('実行中に来た予約は、最新の1つだけを前の実行のあとに流す', async () => {
    const { run, calls } = controllableRun();
    const onOutcome = vi.fn();
    const scheduler = createLatestOnlyRunner(run, onOutcome);
    scheduler.request('A');
    scheduler.request('B');
    scheduler.request('C');
    expect(calls.map((c) => c.sql)).toEqual(['A']);
    calls[0].resolve('result A');
    await flush();
    expect(calls.map((c) => c.sql)).toEqual(['A', 'C']);
    calls[1].resolve('result C');
    await flush();
    expect(onOutcome.mock.calls).toEqual([['result A'], ['result C']]);
  });

  it('失敗した実行は知らせず、予約は流す', async () => {
    const { run, calls } = controllableRun();
    const onOutcome = vi.fn();
    const scheduler = createLatestOnlyRunner(run, onOutcome);
    scheduler.request('A');
    scheduler.request('B');
    calls[0].reject(new Error('worker crashed'));
    await flush();
    expect(calls.map((c) => c.sql)).toEqual(['A', 'B']);
    expect(onOutcome).not.toHaveBeenCalled();
  });

  it('dispose のあとは結果を知らせず、予約も流さない。新しく作った方はすぐ動く', async () => {
    const { run, calls } = controllableRun();
    const onOld = vi.fn();
    const old = createLatestOnlyRunner(run, onOld);
    old.request('A');
    old.request('B');
    old.dispose();
    old.request('C');
    // 画面を作り直した（effect をやり直した）ときの新しい方は、古い方の実行中でも待たない
    const onNew = vi.fn();
    const fresh = createLatestOnlyRunner(run, onNew);
    fresh.request('D');
    expect(calls.map((c) => c.sql)).toEqual(['A', 'D']);
    calls[0].resolve('result A');
    calls[1].resolve('result D');
    await flush();
    expect(onOld).not.toHaveBeenCalled();
    expect(onNew.mock.calls).toEqual([['result D']]);
    expect(calls).toHaveLength(2);
  });
});
