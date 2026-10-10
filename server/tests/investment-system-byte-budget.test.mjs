import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PROMPTS, buildInvestmentRequest } from '../investment-prompts.mjs';
import { responsePreferenceFrame } from '../investment-response-preferences.mjs';

const SYSTEM_BYTE_CAP = 32768;
const encoder = new TextEncoder();
const bytes = (value) => encoder.encode(value).length;
const missing = Symbol('missing');

const languages = [missing, 'ko', 'en', 'ja'];
const sentenceCounts = [missing, null, ...Array.from({ length: 20 }, (_, index) => index + 1)];
const questionsStoppedValues = [missing, true, false];

function valuesFor(language, sentenceCount, questionsStopped) {
  return Object.fromEntries([
    ['language', language],
    ['sentenceCount', sentenceCount],
    ['questionsStopped', questionsStopped],
  ].filter(([, value]) => value !== missing));
}

function assembleLikeBuilder(prompt, values) {
  const frame = responsePreferenceFrame(values);
  return values.sentenceCount === 1
    ? prompt.text + '\n\n' + frame
    : frame + prompt.text;
}

test('all 1,056 valid policy and response-preference assemblies fit the 32,768-byte system cap', () => {
  const violations = [];
  let valueCombinations = 0;
  let assemblies = 0;
  let largestFrame = { bytes: -1, values: null };

  for (const language of languages) {
    for (const sentenceCount of sentenceCounts) {
      for (const questionsStopped of questionsStoppedValues) {
        const values = valuesFor(language, sentenceCount, questionsStopped);
        const frameBytes = bytes(responsePreferenceFrame(values));
        valueCombinations++;
        if (frameBytes > largestFrame.bytes) largestFrame = { bytes: frameBytes, values };

        for (const [promptName, prompt] of Object.entries(PROMPTS)) {
          const systemBytes = bytes(assembleLikeBuilder(prompt, values));
          assemblies++;
          if (systemBytes > SYSTEM_BYTE_CAP) {
            violations.push({ promptName, promptId: prompt.id, values, systemBytes });
          }
        }
      }
    }
  }

  assert.equal(valueCombinations, 4 * 22 * 3);
  assert.equal(Object.keys(PROMPTS).length, 4);
  assert.equal(assemblies, 4 * 22 * 3 * 4);
  assert.deepEqual(largestFrame, {
    bytes: 985,
    values: { language: 'ko', sentenceCount: 1, questionsStopped: false },
  });
  const largestViolation = violations.reduce((largest, violation) => (
    !largest || violation.systemBytes > largest.systemBytes ? violation : largest
  ), null);
  assert.equal(violations.length, 0, JSON.stringify({
    violationCount: violations.length,
    firstViolations: violations.slice(0, 3),
    largestViolation,
  }));
});

const source = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const legacy = (name) => source.match(new RegExp("var " + name + "='([^']*)';"))[1];
const preference = { role: 'user', content: '앞으로 한국어 한 문장으로 답해줘. 질문해도 돼.' };
const acknowledged = { role: 'assistant', content: '알겠습니다.' };
const completePreferences = { language: 'ko', sentenceCount: 1, questionsStopped: false };
const taskPreferences = { language: 'ko', questionsStopped: false };

const builderCases = [
  {
    name: 'dialogue',
    payload: { messages: [preference, acknowledged, { role: 'user', content: 'RSI가 뭐야?' }] },
    mode: 'dialogue',
    responseFormat: completePreferences,
  },
  {
    name: 'settings',
    payload: { messages: [preference, acknowledged, { role: 'user', content: '이전 조건과 별개로 BTC 새 전략 만들어줘' }] },
    mode: 'dialogue',
    responseFormat: taskPreferences,
    settingsPreview: { entryMode: null, pair: 'BTC/USDT' },
  },
  {
    name: 'judgment',
    payload: { plain: true, system: legacy('BT_SYS_J'), messages: [preference] },
    mode: 'judgment',
    responseFormat: taskPreferences,
  },
  {
    name: 'report',
    payload: { plain: true, system: legacy('BT_SYS_R'), messages: [preference] },
    mode: 'report',
    responseFormat: taskPreferences,
  },
];

for (const builderCase of builderCases) {
  test(`actual ${builderCase.name} builder assembles its admitted response frame within the system cap`, async () => {
    const result = await buildInvestmentRequest(builderCase.payload);
    const prompt = PROMPTS[builderCase.name];

    assert.equal(result.mode, builderCase.mode);
    assert.equal(result.promptId, prompt.id);
    assert.equal(result.basePolicySha256, prompt.sha256);
    assert.deepEqual(result.responsePreferences.values, completePreferences);
    assert.deepEqual(result.responseFormat, builderCase.responseFormat);
    assert.deepEqual(result.settingsPreview, builderCase.settingsPreview ?? null);
    assert.equal(result.system, assembleLikeBuilder(prompt, builderCase.responseFormat));
    assert.ok(bytes(result.system) <= SYSTEM_BYTE_CAP, `${builderCase.name}: ${bytes(result.system)} > ${SYSTEM_BYTE_CAP}`);
  });
}
