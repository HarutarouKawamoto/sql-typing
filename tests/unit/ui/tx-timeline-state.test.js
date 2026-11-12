import { describe, it, expect } from 'vitest';
import { autoRun, startTx } from '../../../src/core/tx-simulation.js';
import { outcomeText, txTimelineReducer } from '../../../src/ui/state/tx-timeline-state.js';

describe('txTimelineReducer', () => {
  it('step で1つ進み、reset で同じ場面の最初にもどる', () => {
    const stepped = txTimelineReducer(startTx('locked'), { type: 'step', side: 'B' });
    expect(stepped.events).toHaveLength(1);
    const reset = txTimelineReducer(stepped, { type: 'reset' });
    expect(reset).toEqual(startTx('locked'));
  });

  it('scenario で場面を変えると、最初からになる', () => {
    const stepped = txTimelineReducer(startTx('unsafe'), { type: 'step', side: 'A' });
    expect(txTimelineReducer(stepped, { type: 'scenario', id: 'locked' })).toEqual(
      startTx('locked'),
    );
  });

  it('readFirstOrder は、途中からでも最初から両方が先に読む順で最後まで進める', () => {
    const stepped = txTimelineReducer(startTx('unsafe'), { type: 'step', side: 'A' });
    const end = txTimelineReducer(stepped, { type: 'readFirstOrder' });
    expect(end.stock).toBe(-1);
    expect(end.events.filter((e) => e.step === 'begin')).toHaveLength(2);
  });
});

describe('outcomeText', () => {
  it('終わっていなければ null', () => {
    expect(outcomeText(startTx('unsafe'))).toBeNull();
  });

  it('売りすぎ', () => {
    const end = txTimelineReducer(startTx('unsafe'), { type: 'readFirstOrder' });
    expect(outcomeText(end)).toMatch(
      /^売りすぎ：DB の在庫が -1 になり、1個しかない品に注文が 2 つ/,
    );
  });

  it('FOR UPDATE で守れたときは、待ったからだと書く', () => {
    const end = txTimelineReducer(startTx('locked'), { type: 'readFirstOrder' });
    expect(outcomeText(end)).toMatch(/^守れた：DB の在庫は 0、注文は 1 つです。B（Ben） は在庫 0/);
    expect(outcomeText(end)).toMatch(/FOR UPDATE の鍵/);
  });

  it('鍵なしで順番がよかっただけのときは、「守れた」と書かず、順番のおかげだと書く', () => {
    const end = autoRun(startTx('unsafe'), ['A', 'A', 'A', 'A', 'A']);
    expect(outcomeText(end)).toMatch(/^今回は売りすぎになりませんでした：/);
    expect(outcomeText(end)).toMatch(/順番がよかっただけ/);
  });

  it('鍵ありで待たずに終わったときも、FOR UPDATE が守ると書く（順番のおかげとは書かない）', () => {
    const end = autoRun(startTx('locked'), ['A', 'A', 'A', 'A', 'A']);
    expect(outcomeText(end)).toMatch(/^守れた：/);
    expect(outcomeText(end)).toMatch(/同時に読んでも FOR UPDATE の鍵で後から読む方が待ちます/);
    expect(outcomeText(end)).not.toMatch(/順番がよかった/);
  });
});
