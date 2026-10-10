import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInvestmentRequest } from '../investment-prompts.mjs';
import { createInvestmentOutputGate } from '../investment-output-gate.mjs';

const remembered = { language: 'ko', sentenceCount: 1 };
const cases = [
  ['stop-with-only-topic', '질문은 그만하고 손실 위험만 설명해줘.', { ...remembered, questionsStopped: true }],
  ['polite-stop', '질문은 하지 말아줘.', { ...remembered, questionsStopped: true }],
  ['input-language', '영어로 투자 전략을 설명한 고객의 이메일을 요약해줘.', remembered],
  ['input-sentence-count', '세 문장으로 투자 위험을 설명한 보고서의 제목을 알려줘.', remembered],
  ['input-past-language', 'Explain the report we wrote in English.', remembered],
  ['direct-language', '영어로 투자 전략을 설명해줘.', { language: 'en', sentenceCount: 1 }],
  ['direct-count', '세 문장으로 투자 위험을 설명해줘.', { language: 'ko', sentenceCount: 3 }],
  ['reference-then-direct-language', '한국어로 투자 전략을 설명한 고객의 이메일을 영어로 설명해줘.', { language: 'en', sentenceCount: 1 }],
  ['reference-then-direct-count', '한 문장으로 투자 위험을 설명한 보고서를 두 문장으로 설명해줘.', { language: 'ko', sentenceCount: 2 }],
  ['english-direct-language', 'Explain investment risk in English.', { language: 'en', sentenceCount: 1 }],
  ['recipient-not-language-reference', '영어로 채권을 받은 고객에게 설명해줘.', { language: 'en', sentenceCount: 1 }],
  ['reported-stop', '친구가 질문은 하지 말아줘라고 했어.', remembered],
  ['past-stop', '어제 질문은 그만하고 손실 위험만 설명해줬어.', remembered],
];

for (const [id, content, expected] of cases) test('ordinary response preference usage: ' + id, async () => {
  const messages = [
    { role: 'user', content: '앞으로 한국어 한 문장으로 답해줘.' },
    { role: 'assistant', content: '알겠습니다.' },
    { role: 'user', content },
  ];
  const current = await buildInvestmentRequest({ messages });
  const following = await buildInvestmentRequest({ messages: [...messages,
    { role: 'assistant', content: '알겠습니다.' }, { role: 'user', content: '분산투자가 뭐야?' },
  ] });
  assert.deepEqual(current.responseFormat, expected, 'current response');
  assert.deepEqual(following.responseFormat, expected, 'following response');
  if (expected.questionsStopped) {
    const events = [];
    const gate = createInvestmentOutputGate(event => events.push(event), {
      allowQuestions: current.responsePreferences.values.questionsStopped !== true,
    });
    gate.send({ text: '설명입니다.\n[NEXT ["더 알아볼까요?"]]' });
    gate.send({ done: true });
    assert.equal(gate.failed, false);
    assert.equal(events.some(e => e.text?.includes('[NEXT')), false, 'server must suppress follow-up questions');
    assert.equal(events.at(-1).done, true);
  }
});
