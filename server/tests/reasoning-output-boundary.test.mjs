import test from 'node:test';
import assert from 'node:assert/strict';
import { createInvestmentOutputGate } from '../investment-output-gate.mjs';

function stream(parts, options) {
  const events = [];
  const gate = createInvestmentOutputGate((event) => events.push(event), options);
  for (const text of parts) gate.send({ text });
  gate.send({ done: true });
  return { events, gate, text: events.map((event) => event.text || '').join('') };
}

function assertRejected(parts) {
  const result = stream(parts);
  assert.equal(result.text, '');
  assert.deepEqual(result.events, [{ error: true }]);
  assert.equal(result.events.some((event) => event.done), false);
  assert.equal(result.gate.failed, true);
}

// Harmless synthetic reproduction of the raw-tag shape observed in the preserved
// policy 1.38 evidence. The actual answer remains only in the private evidence file.
const syntheticObservedShape = '<reasoning>synthetic private deliberation</reasoning>사용자 답변입니다.';
// Static Opus 1.40 M-N4 hypothesis, not an observed policy 1.40 model output.
const syntheticThinkingHypothesis = '<thinking>synthetic private deliberation</thinking>사용자 답변입니다.';

test('raw reasoning text never leaks at any chunk boundary and cannot complete', () => {
  for (const text of [syntheticObservedShape, syntheticThinkingHypothesis]) {
    for (let split = 0; split <= text.length; split++) {
      assertRejected([
        text.slice(0, split),
        text.slice(split),
      ]);
    }
  }
});

test('reasoning control tags are case-insensitive and opening or closing forms fail closed', () => {
  for (const tag of [
    '</ThInK>',
    '<ThInKiNg>',
    '<THINKING data-kind="private">',
    '<thinking/>',
    '</ThInKiNg>',
    '</thinking >',
    '<ReAsOnInG>',
    '<REASONING data-kind="private">',
    '<reasoning/>',
    '</ReAsOnInG>',
    '</reasoning >',
  ]) {
    for (let split = 0; split <= tag.length; split++) {
      assertRejected([tag.slice(0, split), tag.slice(split)]);
    }
  }
});

test('incomplete and long reasoning prefixes stay private and end as the existing error contract', () => {
  for (const prefix of [
    '<r',
    '<reason',
    '<reasoning',
    '</reasoning',
    '<thinking',
    '</thinking',
    '</think',
    '<ReAsOnInG' + ' '.repeat(300),
    '<ThInKiNg' + ' '.repeat(300),
  ]) assertRejected([...prefix]);
});

test('ordinary angle-bracket prose and near-name citations preserve exact bytes', () => {
  for (const text of [
    '<https://example.com/reasoning>',
    '<reasoning-guide>citation</reasoning-guide>',
    '<thinker>ordinary word</thinker>',
    '<thinkingful>ordinary word</thinkingful>',
    '<reasonable>ordinary term</reasonable>',
    '비교값은 1 < 2이고 근거는 [Reasoning guide](https://example.com)입니다.',
  ]) {
    const result = stream([...text]);
    assert.equal(result.text, text);
    assert.equal(result.events.some((event) => event.error), false);
    assert.equal(result.events.some((event) => event.done), true);
  }
});

test('existing think-event suppression, blocked tags, and DISPLAY output remain unchanged', () => {
  const narrated = [];
  const gate = createInvestmentOutputGate((event) => narrated.push(event));
  gate.send({ think: 'private chain of thought' });
  gate.send({ text: '사용자에게 제공할 설명' });
  gate.send({ done: true });
  assert.deepEqual(narrated, [{ text: '사용자에게 제공할 설명' }, { done: true }]);

  for (const tag of ['<think>private</think>', '[ORDER {}]']) assertRejected([...tag]);

  const display = '[TITLE "조건 비교"]';
  const displayed = stream([...display]);
  assert.equal(displayed.text, display);
  assert.equal(displayed.events.some((event) => event.done), true);
});
