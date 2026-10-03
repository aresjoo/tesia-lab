import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { admitSettingsPreview, settingsPreviewTag } from '../investment-intent-admission.mjs';

const source = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const original = source.slice(source.indexOf('function tfStart(act){'), source.indexOf('function tfAssetOpts(){'));
const wrapperStart = source.indexOf('  var ts0=tfStart; tfStart=function(act){');
const wrapper = source.slice(wrapperStart, source.indexOf('\n})();', wrapperStart));
const setupStart = source.indexOf('else if(setup&&conv&&live)');
const setupConsumer = source.slice(setupStart, source.indexOf('else if(ask&&live)', setupStart));
const consumeStart = setupConsumer.match(/tfStart\((\{type:[^\n]+?)\);/)[1];

for (const [user, expected, staleChart] of [
  ['비트코인 전략 만들어줘', 'BTC/USDT', { label: '이더리움', tv: 'BINANCE:ETHUSDT', data: 'binance:ETHUSDT' }],
  ['이더리움 전략 만들어줘', 'ETH/USDT', { label: '비트코인', tv: 'BINANCE:BTCUSDT', data: 'binance:BTCUSDT' }],
]) {
  test(`actual source overrides admit ${expected} settings without resending or stale-asset substitution`, () => {
    const tag = settingsPreviewTag(admitSettingsPreview([{ role: 'user', content: user }]));
    const setup = JSON.parse(tag.match(/\[SETUP\s+(\{[\s\S]*?\})\s*\]/)[1]);
    const state = {}, callbacks = [], messages = [];
    let sends = 0;
    const context = createContext({ setup, window: {}, G: { mode: 'conv', cur: {} }, document: { getElementById: () => ({ value: '' }) }, TAI: { chart: staleChart }, $: () => ({}), tfS: () => state, taiAI: () => ({}), tfAiMsg: (text) => messages.push(text), gEsc: (text) => text, tfIntakeNext: () => {}, tfSave: () => {}, TFCOPY: { intakeHello: '필수 조건을 확인합니다', intakeHelloSell: '매도 조건' }, delay: (milliseconds, callback) => callbacks.push({ milliseconds, callback }), gSend: () => { sends++; } });
    runInContext(original, context);
    runInContext(wrapper, context);
    runInContext('tfStart(' + consumeStart + ')', context);
    assert.equal(sends, 0);
    assert.equal(state.stage, 'intake');
    assert.equal(state.ctxAsset.data, 'binance:' + expected.replace('/', ''));
    assert.equal(state.qi, 1); // Already explicit asset is not asked again.
    assert.equal(state.plan, null); assert.equal(state.workDone, false);
    assert.equal(state.cur, null); assert.equal(state.score, 0);
    assert.equal(messages.length, 1); assert.equal(callbacks.length, 1);
    assert.equal(callbacks[0].milliseconds, 500);
  });
}
