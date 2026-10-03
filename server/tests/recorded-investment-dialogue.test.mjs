import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PROMPTS, digestText } from '../investment-prompts.mjs';
import { createInvestmentOutputGate } from '../investment-output-gate.mjs';

const corpusBytes = readFileSync(new URL('./investment-dialogue-cases.json', import.meta.url));
const corpus = JSON.parse(corpusBytes);
const evidence = JSON.parse(readFileSync(new URL('./recorded-investment-dialogue.json', import.meta.url), 'utf8'));
const active = evidence.runs.at(-1);
const byId = Object.fromEntries(active.responses.map((row) => [row.id, row.answer]));

test('actual CLI batch receipts remain synthetic development evidence and exact prompt-bound', async () => {
  assert.equal(evidence.providerGatePass, false); assert.equal(evidence.hiddenHoldout, false);
  for (const run of evidence.runs) {
    assert.equal(run.respondent, 'claude-opus-5-5'); assert.equal(run.independentProviderCalls, false); assert.deepEqual(run.tools, []);
    assert.equal(run.promptSha256, await digestText(run.promptSnapshot));
    assert.equal(run.corpusSha256, createHash('sha256').update(corpusBytes).digest('hex'));
    assert.deepEqual(run.responses.map((row) => row.id), corpus.cases.map((row) => row.id));
  }
  assert.equal(active.promptSha256, PROMPTS.dialogue.sha256);
  assert.equal(active.promptSnapshot, PROMPTS.dialogue.text);
  assert.equal(evidence.runs[0].observedReviewIssues.length, 3);
});

for (const { id, answer } of active.responses) {
  test(`recorded ${id} preserves safe output and contains no model-generated action control`, () => {
    const events = [], gate = createInvestmentOutputGate((event) => events.push(event));
    for (const character of answer) gate.send({ text: character });
    gate.send({ done: true });
    assert.ok(events.at(-1).done, id);
    assert.equal(events.map((event) => event.text || '').join(''), answer);
  });
}

test('recorded corrections preserve leverage denominator and quote-unit conversion requirements', () => {
  assert.match(byId.leverage, /초기 증거금/);
  assert.match(byId.leverage, /계좌 전체 손실률이 아니/);
  assert.match(byId.provider_units, /환산/);
  assert.ok(!byId.provider_units.includes('0.17%'));
  assert.ok(!byId.uncertain_asset.includes('기간'));
  for (const token of ['1분봉', '숏', '20배', '20%', '뉴스']) assert.ok(byId.unsupported_strategy.includes(token));
  assert.match(byId.rate_units, /퍼센트포인트/);
  assert.match(byId.rate_units, /20%/);
  for (const token of ['채권', '리츠', '금']) assert.ok(byId.broad_finance.includes(token));
});

test('current recorded clarification asks margin type without asking exchange simultaneously',()=>{
  const question=byId.leverage.split('먼저').at(-1);
  assert.match(question,/격리.*교차/);assert.ok(!question.includes('거래소'));
  assert.ok(!byId.correction.includes('알려주'));
});
test('current recorded holdout is undecided rather than a positive-return approval',()=>{
  assert.match(byId.positive_holdout,/미판정/);assert.match(byId.positive_holdout,/자동.*통과/);
  assert.ok(!byId.positive_holdout.includes('실패가 아니라는 신호'));
  assert.equal(active.observedReviewIssues.length,1); // Preserve the known semantic shortcoming.
});
test('current recorded portfolio distinguishes MMF principal risk and redemption terms',()=>{
  assert.match(byId.portfolio,/MMF.*원금 손실.*환매/);
});
test('current recorded unsupported conditions avoid liquidation precedence without collateral',()=>{
  assert.match(byId.unsupported_strategy,/손절과 청산.*단정할 수 없습니다/);
  assert.ok(!byId.unsupported_strategy.includes('청산이 먼저 발생'));
});
