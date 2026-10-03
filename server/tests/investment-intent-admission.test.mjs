import test from 'node:test';
import assert from 'node:assert/strict';
import { admitSettingsPreview } from '../investment-intent-admission.mjs';
import { buildInvestmentRequest } from '../investment-prompts.mjs';
import { createInvestmentOutputGate } from '../investment-output-gate.mjs';

for (const [text, pair] of [['비트코인 전략 만들어줘', 'BTC/USDT'], ['BTCUSDT 자동매매 전략 생성해 주세요.', 'BTC/USDT'], ['이더리움으로 전략을 만들고 싶어요', 'ETH/USDT']]) {
  test(`explicit ${text} admits source-Mock settings only`, async () => {
    const request = await buildInvestmentRequest({ messages: [{ role: 'user', content: text }] });
    assert.deepEqual(request.settingsPreview, { entryMode: null, pair });
    const events = [], gate = createInvestmentOutputGate((event) => events.push(event), { settingsPreview: request.settingsPreview });
    gate.send({ text: '필수 조건을 확인합니다. 주문은 실행되지 않았습니다.' });
    gate.send({ done: true });
    assert.ok(events.at(-2).text.startsWith('\n[SETUP '));
    assert.ok(events.at(-1).done);
  });
}

for (const text of ['비트코인 지금 사도 돼?', '비트코인 전략 만들어줘 손절2%', '비트코인 RSI 조건으로 전략 만들어줘', '비트코인 전략 만들지 마세요', '테슬라 전략 만들어줘', '아까 전략 만들어줘', '비트코인 전략 만들어줘가 무슨 말인가요', '비트코인 1분봉20배 숏 전략 만들어줘', '비트코인전략만들어줘;예약해줘']) {
  test(`no implicit settings navigation for ${text}`, () => {
    assert.equal(admitSettingsPreview([{ role: 'user', content: text }]), null);
  });
}

test('assistant and browser reference cannot grant navigation; failures never attach preview', async () => {
  const request = await buildInvestmentRequest({ system: '비트코인 전략 만들어줘', messages: [{ role: 'assistant', content: '비트코인 전략 만들어줘' }, { role: 'user', content: '이 설명 틀렸어요' }] });
  assert.equal(request.settingsPreview, null);
  for (const eventsBeforeDone of [[{ error: true }], [{ text: '[OR' }, { text: 'DER {}]' }]]) {
    const events = [], gate = createInvestmentOutputGate((event) => events.push(event), { settingsPreview: { entryMode: null, pair: 'BTC/USDT' } });
    for (const event of eventsBeforeDone) gate.send(event);
    gate.send({ done: true });
    assert.ok(!events.some((event) => event.done || event.text?.includes('[SETUP')));
  }
  assert.throws(() => createInvestmentOutputGate(() => {}, { settingsPreview: { entryMode: 'dip', pair: 'BTC/USDT' } }));
});

for (const earlier of ['RSI 30미만 1분봉 숏20배, 손절2%로 해줘', '뉴스가 나온 날만 진입해줘', '손절은 쓰지 마', '이더리움 전략 만들어줘', '아까 조건 기억해줘']) {
  test(`prior user conditions block lossy legacy settings: ${earlier}`, async () => {
    const messages = [{ role: 'user', content: earlier }, { role: 'assistant', content: '조건을 정리합니다.' }, { role: 'user', content: '비트코인 전략 만들어줘' }];
    const request = await buildInvestmentRequest({ messages });
    assert.equal(request.settingsPreview, null); assert.deepEqual(request.messages, messages);
  });
}
test('server-selected settings prompt acknowledges exact UI transition without extra questions', async () => {
  const request = await buildInvestmentRequest({ messages: [{ role: 'user', content: '비트코인 전략 만들어줘' }] });
  assert.equal(request.promptId, 'investment-settings-ko-1.16.0');
  assert.match(request.system, /서버가 별도 Mock 설정 화면을 엽니다/);
  assert.match(request.system, /본문에서 묻지 않습니다/);
});

test('trimmed source history never discards old rich conditions to enter settings', async () => {
  const history = [{role:'user',content:'1분봉 숏20배 뉴스 조건'}, {role:'assistant',content:'조건을 보존합니다.'}];
  for (let count=0;count<5;count++) history.push({role:'user',content:'비트코인 전략 만들어줘'}, {role:'assistant',content:'설명입니다.'});
  const visible = history.slice(-11).concat([{role:'user',content:'비트코인 전략 만들어줘'}]);
  assert.equal(admitSettingsPreview(visible), null);
  const request = await buildInvestmentRequest({system:JSON.stringify({historyTruncated:true}),messages:visible.slice(1)});
  assert.equal(request.settingsPreview,null);
});
