import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import * as displayContract from '../../investment-ui-contract.mjs';
import { admitSettingsPreview, settingsPreviewTag } from '../investment-intent-admission.mjs';

// Actual source functions, isolated UI collaborators, and scripted fetch/read
// promises. This does not call a provider, market, authenticated API, or browser.
const source = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const between = (start, end) => {
  const first = source.indexOf(start), last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing source boundary: ${start}`);
  return source.slice(first, last);
};
const streamSource = between('function taiStream(', '/* 컴포저 전송 버튼');
const aiSource=between('function taiAI(', '/* 세션 열기/생성');
const bindSource=between('function taiReleaseBusy(', '/* ── 영속 저장소');
const marketSource = between('function taiMarket(', '/* 하위 호환 별칭 */');
const historySource = between('function taiPushHist(', 'function taiPredictQ(');
const safeSource = between('function taiSafeInvestmentResponse(', 'function taiMarket(');
const tagSource = between('function taiTagJson(', '/* 사건×타임라인');
const plain = value => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(setImmediate); };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const frame = event => ({ done: false, value: new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`) });
function response(events) {
  const chunks = events.map(frame);
  return { ok: true, body: { getReader: () => ({ read: async () => chunks.shift() ?? { done: true } }) } };
}
function controlledResponse() {
  const reads = [], queued = [];
  return {
    response: { ok: true, body: { getReader: () => ({ read: () => {
      if (queued.length) return Promise.resolve(queued.shift());
      const d = deferred(); reads.push(d); return d.promise;
    } }) } },
    send(event) { const value = event === null ? { done: true } : frame(event); const d = reads.shift(); if (d) d.resolve(value); else queued.push(value); },
    fail(error) { assert.ok(reads.length, 'The real stream must already be awaiting read()'); reads.shift().reject(error); },
  };
}
function streamHarness(fetchImpl, resolveImpl) {
  const calls = [], events = [], resolutions = [];
  const context = createContext({
    TAI: { url: 'https://fixture.invalid/api/chat' }, window: { AbortController }, AbortController, TextDecoder,
    fetch: (...args) => { calls.push(args); return fetchImpl(...args); },
    taiBusySync: () => {},
    taiResolveProxy: cb => { resolutions.push(true); if (resolveImpl) resolveImpl(cb); else cb(); },
  });
  runInContext(streamSource, context);
  const start = label => context.taiStream('reference', [{ role: 'user', content: '질문' }],
    value => events.push([label, 'text', value]), () => events.push([label, 'done']),
    kind => events.push([label, 'fail', kind]), meta => events.push([label, 'meta', plain(meta)]));
  return { context, calls, events, resolutions, start };
}

for (const status of [400, 401, 403, 404, 422, 429, 503]) {
  test(`actual taiStream HTTP ${status} is one request and failure, with no retry`, async () => {
    const h = streamHarness(async () => ({ ok: false, status, body: {} }));
    h.start('request'); await flush();
    assert.equal(h.calls.length, 1); assert.equal(h.resolutions.length, 0);
    assert.deepEqual(h.events, [['request', 'fail', 'error']]);
    assert.equal(h.context.TAI.req, null);
  });
}
for (const partial of [false, true]) {
  test(`actual taiStream SSE error ${partial ? 'after text' : 'before text'} is not retried`, async () => {
    const h = streamHarness(async () => response([...(partial ? [{ text: '부분 답변' }] : []), { error: 'OUTPUT_REJECTED' }]));
    h.start('request'); await flush();
    assert.equal(h.calls.length, 1); assert.equal(h.resolutions.length, 0);
    assert.deepEqual(h.events.at(-1), ['request', 'fail', partial ? 'error-partial' : 'error']);
    assert.equal(h.events.filter(e => e[1] === 'done').length, 0);
    assert.equal(h.context.TAI.req, null);
  });
}
test('actual taiStream retries a pre-response fetch TypeError once at the same URL and body', async () => {
  let count = 0;
  const h = streamHarness(async () => { if (!count++) throw new TypeError('synthetic network failure'); return response([{ text: '완료 답변' }, { done: true }]); });
  h.start('request'); await flush();
  assert.equal(h.calls.length, 2); assert.equal(h.resolutions.length, 1);
  assert.equal(h.calls[0][0], h.calls[1][0]); assert.equal(h.calls[0][1].body, h.calls[1][1].body);
  assert.deepEqual(h.events, [['request', 'text', '완료 답변'], ['request', 'done']]);
});
test('actual taiStream repeated pre-response TypeError stops after its single retry', async () => {
  const h = streamHarness(async () => { throw new TypeError('synthetic network failure'); });
  h.start('request'); await flush();
  assert.equal(h.calls.length, 2); assert.equal(h.resolutions.length, 1);
  assert.deepEqual(h.events, [['request', 'fail', 'error']]);
});
for (const mode of ['non-network-fetch-error', 'response-reader-TypeError', 'read-TypeError']) {
  test(`actual taiStream ${mode} never retries`, async () => {
    const h = streamHarness(async () => {
      if (mode === 'non-network-fetch-error') throw new Error('synthetic application failure');
      return { ok: true, body: { getReader: () => {
        if (mode === 'response-reader-TypeError') throw new TypeError('synthetic getReader failure');
        return { read: async () => { throw new TypeError('synthetic read failure'); } };
      } } };
    });
    h.start('request'); await flush();
    assert.equal(h.calls.length, 1); assert.equal(h.resolutions.length, 0);
    assert.deepEqual(h.events, [['request', 'fail', 'error']]);
  });
}
for (const [label, events, kind] of [
  ['text without done', [{ text: '잘린 답변' }], 'error-partial'],
  ['empty EOF', [], 'error'],
  ['done without text', [{ done: true }], 'error'],
]) {
  test(`actual taiStream ${label} fails rather than silently settling`, async () => {
    const h = streamHarness(async () => response(events)); h.start('request'); await flush();
    assert.deepEqual(h.events.at(-1), ['request', 'fail', kind]);
    assert.equal(h.events.filter(e => e[1] === 'done').length, 0);
    assert.equal(h.calls.length, 1); assert.equal(h.context.TAI.req, null);
  });
}
test('actual taiStop cancels a scheduled pre-response retry', async () => {
  let retry;
  const h = streamHarness(async () => { throw new TypeError('synthetic network failure'); }, cb => { retry = cb; });
  h.start('request'); await flush(); assert.equal(typeof retry, 'function');
  h.context.taiStop(); retry(); await flush();
  assert.equal(h.calls.length, 1); assert.deepEqual(h.events, [['request', 'fail', 'abort']]);
  assert.equal(h.context.TAI.req, null);
});

function marketHarness(fetchImpl, { preflight = false } = {}) {
  const h = streamHarness(fetchImpl);
  const sess = { id: 'owned', title: '기존 대화', convo: [], thread: [] };
  const ai = { hist: [], tf: '1d', currentTurn: 0, chart: preflight ? { data: 'binance:BTCUSDT', tv: 'BINANCE:BTCUSDT', label: '비트코인' } : null };
  sess.ai=ai;
  const preflights = [], runs = [], delays = [], errors = [], saves = [];
  Object.assign(h.context, {
    G: { cur: sess, sessions: [sess], mode: 'conv' }, S: { user: {}, strategy: {}, versions: [] },
    $: id => id === 'g-thread' ? {} : null,
    taiAI: () => ai, taiTfFrom: () => null, taiAssetFrom: () => null,
    taiPredictQ: () => false, taiScope: () => ({}), TAI_AST: [],
    taiClearQuestions: () => {}, taiNextClear: () => {}, taiActClear: () => {},
    toast: () => {}, setInterval: () => 1, clearInterval: () => {},
    actStart: () => { const run = { data: { status: 'running' } }; runs.push(run); return run; },
    actFinish: (run, status) => { run.data.status = status; },
    actStep: () => ({ st: { t0: Date.now() }, done() {} }),
    taiThreadAdd: html => { const current=h.context.G.cur; if(h.context.G.mode==='conv')current.convo.push(html);else current.thread.push({doc:h.context.G.openDoc,html}); return null; },
    taiBuildSystem: () => '{}', taiSafeInvestmentResponse: () => true,
    taiDisplayValue: () => null, taiTagJson: () => null,
    taiStripInvestmentDisplays: text => text, taiMd: text => text, taiActs: () => '',
    taiErrCard: text => errors.push(text), taiCancelChips: () => {}, taiSpacerTrim: () => {},
    gEsc: text => text, delay: (ms, cb) => delays.push({ ms, cb }),
    STORE: { save: () => saves.push(true) }, taiOhlc: cb => preflights.push(cb),
  });
  runInContext(aiSource + bindSource + historySource + marketSource, h.context);
  const start = text => h.context.taiMarket(text, null, () => assert.fail('Unexpected fallback'));
  return { ...h, sess, ai, preflights, runs, errors, saves, start };
}
for (const ending of ['done', 'SSE-error', 'read-TypeError']) {
  test(`actual taiMarket + taiStream stale ${ending} cannot release new busy state or mutate its history`, async () => {
    const old = controlledResponse(), fresh = controlledResponse(); let request = 0;
    const h = marketHarness(async () => (++request === 1 ? old.response : fresh.response));
    h.start('첫 질문'); await flush(); old.send({ text: '이전 부분 답변' }); await flush();
    // Session navigation/cancellation relinquishes the active transport before
    // returning to this same session. Leave the old read pending deliberately.
    h.context.taiStop(); h.context.TAI.req = null; h.context.TAI.busy = false;
    h.start('새 질문'); await flush(); fresh.send({ text: '새 답변' }); await flush();
    const requestId = h.context.TAI.req.id, before = plain({ hist: h.ai.hist, convo: h.sess.convo });
    if (ending === 'done') { old.send({ done: true }); old.send(null); }
    else if (ending === 'SSE-error') old.send({ error: 'OLD_ERROR' });
    else old.fail(new TypeError('synthetic old reader failure'));
    await flush();
    assert.equal(h.context.TAI.busy, true); assert.equal(h.context.TAI.req.id, requestId);
    assert.deepEqual(plain({ hist: h.ai.hist, convo: h.sess.convo }), before);
    assert.equal(h.errors.length, 0); assert.equal(h.saves.length, 0);
    fresh.send({ done: true }); fresh.send(null); await flush();
    assert.equal(h.context.TAI.busy, false); assert.equal(h.context.TAI.req, null);
    assert.deepEqual(plain(h.ai.hist), [{ role: 'user', content: '새 질문' }, { role: 'assistant', content: '새 답변' }]);
    assert.equal(h.calls.length, 2); assert.equal(h.resolutions.length, 0);
  });
}
test('actual taiMarket truncated stream releases busy and records only an explicitly incomplete answer', async () => {
  const h = marketHarness(async () => response([{ text: '부분 답변' }]));
  h.start('질문'); await flush();
  assert.equal(h.context.TAI.busy, false); assert.equal(h.context.TAI.req, null);
  assert.equal(h.ai.hist.length, 2); assert.equal(h.ai.hist[0].content, '질문');
  assert.match(h.ai.hist[1].content, /미완성 초안/);
  assert.match(h.sess.convo.join(''), /완성하지 못했습니다/);
  assert.equal(h.runs[0].data.status, 'error');
});
for (const stale of ['same-session-new-turn', 'different-session']) {
  test(`actual taiMarket delayed proceed ${stale} cannot send or clear current busy state`, () => {
    const h = marketHarness(() => assert.fail('Stale preflight must not fetch'), { preflight: true });
    h.start('첫 질문'); assert.equal(h.preflights.length, 1);
    if (stale === 'same-session-new-turn') h.ai.currentTurn++;
    else h.context.G.cur = { id: 'different-session' };
    h.context.TAI.busy = true; h.context.TAI.busyOwner={sess:h.context.G.cur,turn:h.ai.currentTurn};
    h.preflights[0]('old market context');
    assert.equal(h.calls.length, 0); assert.equal(h.context.TAI.busy, true);
    assert.deepEqual(h.ai.hist, []); assert.equal(h.runs[0].data.status, 'abort');
  });
}

function safeResponse(text, current, history = [], state = {}) {
  const context = createContext({ window: { TETH_INVESTMENT_UI: displayContract } });
  runInContext(tagSource + safeSource, context);
  return context.taiSafeInvestmentResponse(text, current, history, state);
}
for (const current of ['비트코인 전략 만들어줘', '이더리움 전략 만들어줘']) {
  test(`actual server admission and source SETUP validator agree on NFD ${current}`, () => {
    const nfd = current.normalize('NFD'); assert.notEqual(nfd, current);
    const preview = admitSettingsPreview([{ role: 'user', content: nfd }]);
    assert.ok(preview);
    const output = '설정을 확인합니다.' + settingsPreviewTag(preview);
    assert.equal(safeResponse(output, nfd), true);
    const history = [{ role: 'user', content: nfd }, { role: 'assistant', content: '설정을 확인합니다.' }];
    assert.ok(admitSettingsPreview([...history, { role: 'user', content: nfd }]));
    assert.equal(safeResponse(output, nfd, history), true);
  });
}
for (const earlier of ['이더리움 전략 만들어줘', '비트코인 손절 2% 전략 만들어줘']) {
  test(`NFD prior conditions remain binding for actual server and source: ${earlier}`, () => {
    const history = [{ role: 'user', content: earlier.normalize('NFD') }, { role: 'assistant', content: '확인했습니다.' }];
    const current = '비트코인 전략 만들어줘'.normalize('NFD');
    const preview = { entryMode: null, pair: 'BTC/USDT' };
    assert.equal(admitSettingsPreview([...history, { role: 'user', content: current }]), null);
    assert.equal(safeResponse(settingsPreviewTag(preview), current, history), false);
  });
}
test('NFD explicit new-strategy reset permits navigation without inheriting earlier rich conditions', () => {
  const history = [{ role: 'user', content: '이더리움 손절 2% 전략'.normalize('NFD') }];
  const current = '이전 조건과 별개로 비트코인 전략 만들어줘'.normalize('NFD');
  const preview = admitSettingsPreview([...history, { role: 'user', content: current }], { historyTruncated: true });
  assert.ok(preview); assert.equal(preview.pair, 'BTC/USDT');
  assert.equal(safeResponse(settingsPreviewTag(preview), current, history, { olderContextOmitted: true }), true);
});

for(const stage of ['preflight','stream'])test('actual taiBind session switch releases owned '+stage+' and stale completion preserves new request',async()=>{
 const old=controlledResponse(),fresh=controlledResponse();let n=0;
 const h=marketHarness(async()=>++n===1?old.response:fresh.response,{preflight:stage==='preflight'});
 h.start('첫 질문');if(stage==='stream')await flush();
 assert.equal(h.context.TAI.busy,true);
 const next={id:'next',convo:[],thread:[]};h.context.G.sessions.push(next);h.context.G.cur=next;
 h.context.taiBind(next);
 assert.equal(h.context.TAI.busy,false);assert.equal(h.context.TAI.busyOwner,null);assert.equal(h.context.TAI.req,null);
 h.start('새 질문');await flush();const owner=h.context.TAI.busyOwner,request=h.context.TAI.req;
 if(stage==='preflight')h.preflights[0]('stale facts');else{old.send({done:true});old.send(null);await flush();}
 assert.equal(h.context.TAI.busy,true);assert.equal(h.context.TAI.busyOwner,owner);assert.equal(h.context.TAI.req,request);
 assert.equal(h.runs[0].data.status,'abort');assert.equal(h.ai.hist[0].content,'첫 질문');assert.match(h.ai.hist[1].content,/미완성/);assert.deepEqual(plain(next.ai.hist),[]);
});
test('actual busy ownership prevents expired old preflight from releasing a fresh same-session request',()=>{
 const h=marketHarness(()=>assert.fail('No fetch expected'),{preflight:true});
 h.start('first');h.context.TAI.busyAt=Date.now()-180001;h.start('fresh');
 const owner=h.context.TAI.busyOwner;h.preflights[0]('old');
 assert.equal(h.context.TAI.busy,true);assert.equal(h.context.TAI.busyOwner,owner);assert.equal(h.runs[0].data.status,'abort');
});

test('actual tool handoff updates busy owner to the current progress run before session cancellation',async()=>{
 const old=controlledResponse();const h=marketHarness(async()=>old.response);
 h.start('질문');await flush();old.send({text:'자료를 설명합니다.'});await flush();
 old.send({tool:{name:'market_data',id:'one',q:'BTC'}});await flush();
 assert.equal(h.runs.length,2);assert.equal(h.context.TAI.busyOwner.run,h.runs[1]);
 const next={id:'next'};h.context.G.cur=next;h.context.taiBind(next);
 assert.equal(h.runs[1].data.status,'abort');assert.equal(h.context.TAI.busy,false);
});

test('actual session cancellation preserves partial transcript and retry only in the owned session',async()=>{
 const old=controlledResponse(),fresh=controlledResponse();let n=0;const h=marketHarness(async()=>++n===1?old.response:fresh.response);
 h.start('원래 <조건>');await flush();old.send({text:'부분 설명을 보존합니다.'});await flush();
 const next={id:'next',convo:[],thread:[]};h.context.G.sessions.push(next);h.context.G.cur=next;h.context.taiBind(next);
 assert.deepEqual(plain(h.ai.hist),[{role:'user',content:'원래 <조건>'},{role:'assistant',content:'부분 설명을 보존합니다.\n\n[대화 이동으로 중단된 미완성 응답이며 최종 결론과 출처 검증이 끝나지 않았다]'}]);
 assert.match(h.sess.convo.join(''),/부분 설명을 보존합니다/);assert.match(h.sess.convo.join(''),/다시 생성/);assert.match(h.sess.convo.join(''),/미완성/);assert.ok(!h.sess.convo.some(v=>v.includes('<span class="tai-txt"></span>')));
 assert.deepEqual(plain(next.ai.hist),[]);assert.deepEqual(next.convo,[]);
 h.start('새 조건');await flush();const owner=h.context.TAI.busyOwner;
 old.send({done:true});old.send(null);await flush();assert.equal(h.context.TAI.busyOwner,owner);assert.equal(h.context.TAI.busy,true);assert.equal(h.ai.hist.length,2);
 fresh.send({text:'새 설명'});fresh.send({done:true});fresh.send(null);await flush();assert.deepEqual(plain(next.ai.hist),[{role:'user',content:'새 조건'},{role:'assistant',content:'새 설명'}]);assert.ok(!h.sess.convo.join('').includes('새 설명'));assert.ok(next.convo.length>0);
});

test('actual artifact cancellation binds its saved partial answer to the original document',async()=>{
 const old=controlledResponse();const h=marketHarness(async()=>old.response);
 h.context.G.mode='artifact';h.context.G.openDoc='report';
 h.context.taiThreadAdd=html=>{h.sess.thread.push({doc:h.context.G.openDoc,html});return null;};
 h.start('문서 질문');await flush();old.send({text:'문서 부분 설명'});await flush();
 const next={id:'next',convo:[],thread:[]};h.context.G.cur=next;h.context.G.openDoc='other';h.context.taiBind(next);
 const restored=h.sess.thread.filter(t=>t.doc==='report').map(t=>t.html).join('');
 assert.match(restored,/문서 부분 설명/);assert.match(restored,/다시 생성/);assert.match(restored,/미완성/);assert.equal(h.sess.thread.filter(t=>t.doc==='other').length,0);assert.deepEqual(next.thread,[]);assert.deepEqual(plain(next.ai.hist),[]);
});
