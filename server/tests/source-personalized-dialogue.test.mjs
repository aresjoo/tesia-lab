import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { buildInvestmentRequest, MAX_CONTEXT_CHARS } from '../investment-prompts.mjs';

// Execute the actual source functions and its final quota wrapper. These are
// network-free route/state regressions, not model-quality or browser evidence.
const source = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const between = (start, end) => {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing actual source boundary: ${start}`);
  return source.slice(first, last);
};
const send = between('function gSend(){', '/* ── boot ── */');
const finalSend = source.split(/\r?\n/).find(line => line.includes("var gs0=gSend; gSend=function()"));
assert.ok(finalSend, 'The actual final gSend quota wrapper must be exercised');
const aiState = between('function taiAI(sx){', '/* ── 영속 저장소:');
const settingsState = between('function tfS(){', 'function tfSave(){');
const pushHistory = between('function taiPushHist(sess,t,acc){', 'function taiPredictQ(t)');
const buildContext = between('function taiEarlierUserStatements(ai){', '/* 스레드 공용 append');
const requestMessages = source.split(/\r?\n/).find(line => /var msgs=ai\.hist\.slice/.test(line));
assert.ok(requestMessages, 'Use the actual taiMarket request window');
const plain = value => JSON.parse(JSON.stringify(value));

function sender(step, text, { pending, edit = false, blocked = false, mode = 'conv', online = true } = {}) {
  const actions = [], submitted = [], gateCalls = [], visible = [], documentMessages = [];
  const input = { value: text, style: {}, closest: () => null };
  const strategy = { pair: 'BTC/USDT', entryMode: 'trend', slNum: -5, tpNum: 7 };
  const cur = { id: 'owned-conversation', convo: ['preserve-other-content'], btHist: [{ id: 'existing-mock-result' }], ...(pending ? { pendingChips: pending } : {}) };
  const state = { user: {}, strategy, versions: [{ params: { sl: -5, tp: 7 } }] };
  const context = createContext({
    TAI: {}, G: { mode, cur }, S: state, gStep: step,
    window: { TF_BT_EDIT: edit }, document: { getElementById: () => null },
    $: id => id === 'g-in' ? input : null,
    aiGate: kind => { gateCalls.push(kind); return blocked ? 'block' : 'allow'; },
    aiBlocked: () => actions.push(['quota-blocked']), tfAiGate: () => true,
    toast: text => actions.push(['toast', text]),
    gConvUser: text => visible.push(text), gThink: (_, __, callback) => callback(),
    gPickPair: pair => { actions.push(['pair', pair]); strategy.pair = pair; },
    gClDropPending: () => actions.push(['drop-pending']),
    gPickRisk: value => { actions.push(['risk', value]); strategy.slNum = value; },
    gChipAct: (...args) => actions.push(['chip', ...args]),
    gNextAfterMode: () => actions.push(['mode', strategy.entryMode]),
    gPickTf: value => actions.push(['timeframe', value]),
    taiEnsure: callback => callback(online), gUserPin: () => {},
    taiAskConv: text => submitted.push(text),
    taiAsk: (text, result) => { submitted.push(text); assert.equal(result, state.versions.at(-1)); },
    gEsc: text => text, gDocThread: html => documentMessages.push(html),
    delay: (_, callback) => callback(),
    runBacktest: () => { throw new Error('Natural language must not execute a Mock backtest'); },
    gBtRun: () => actions.push(['backtest']),
  });
  const before = plain({ state, btHist: cur.btHist });
  runInContext(send, context);
  runInContext(finalSend, context);
  runInContext('gSend()', context);
  return { actions, submitted, gateCalls, visible, documentMessages, input, context, state, cur, before };
}

for (const [step, text] of [
  ['pair', '이더리움 말고 비트코인으로 바꿔줘'],
  ['pair', '이더리움이랑 비트코인 차이가 뭐야?'],
  ['risk', '계좌 100만원이고 손절은 2%로'],
  ['risk', '손절 2%는 무슨 뜻이야?'],
  ['risk', '손절 2% 말고 3%로 정정할게'],
  ['mode', '추세가 아니라 반등이 무슨 뜻인지 설명해줘'],
]) {
  test(`actual final gSend forwards rather than selects: ${step} / ${text}`, () => {
    const result = sender(step, text);
    assert.deepEqual(result.submitted, [text]);
    assert.deepEqual(result.actions, []);
    assert.deepEqual(plain({ state: result.state, btHist: result.cur.btHist }), result.before);
    assert.deepEqual(result.visible, [text]);
    assert.deepEqual(result.gateCalls, ['new']);
  });
}

for (const [step, text, expected] of [
  ['pair', 'ETH/USDT', ['pair', 'ETH/USDT']],
  ['pair', '비트코인', ['pair', 'BTC/USDT']],
  ['pair', ' btcusdt ', ['pair', 'BTC/USDT']],
  ['mode', '반등 매수', ['mode', 'dip']],
  ['mode', '추세 매수', ['mode', 'trend']],
  ['tf', '1 시간봉', ['timeframe', '1시간봉']],
  ['tf', '일봉', ['timeframe', '일봉']],
  ['risk', '-2.5%', ['risk', -2.5]],
  ['tp', '+7%', ['chip', 'tp', '7', null, true]],
  ['tp', '익절 없이', ['chip', 'tp', null, null, true]],
]) {
  test(`actual exact choice preserves local Mock input: ${step} / ${text}`, () => {
    const result = sender(step, text);
    assert.deepEqual(result.submitted, []);
    assert.deepEqual(result.actions.filter(action => action[0] !== 'drop-pending'), [expected]);
    assert.deepEqual(result.gateCalls, ['new']);
  });
}

for (const text of ['2', '0%', '100%', '-100%', '2%와 3%', '손절 2%', '２％']) {
  test(`bare, invalid or ambiguous risk text stays a discussion: ${text}`, () => {
    const result = sender('risk', text);
    assert.deepEqual(result.submitted, [text]);
    assert.deepEqual(result.actions, []);
    assert.deepEqual(plain(result.state), result.before.state);
  });
}

for (const text of ['반등', '반등 매수 말고 추세 매수', '반등 매수가 뭐야?', '추세']) {
  test(`pending chip substring never consumes user text: ${text}`, () => {
    const pending = { id: 'pending-selection', items: [{ label: '반등 매수 (설명)', act: 'mode', arg: 'dip' }] };
    const result = sender(null, text, { pending });
    assert.deepEqual(result.submitted, [text]);
    assert.deepEqual(result.actions, []);
    assert.equal(result.cur.pendingChips, pending);
    assert.deepEqual(result.cur.convo, ['preserve-other-content']);
  });
}

test('an exact pending chip remains an explicit Mock selection', () => {
  const pending = { id: 'pending-selection', items: [{ label: '반등 매수 (설명)', act: 'mode', arg: 'dip' }] };
  const result = sender(null, '반등 매수', { pending });
  assert.deepEqual(result.actions, [['chip', 'mode', 'dip', '반등 매수 (설명)', true]]);
  assert.deepEqual(result.submitted, []);
  assert.equal(result.cur.pendingChips, null);
  assert.deepEqual(result.cur.convo, ['preserve-other-content']);
});

for (const text of ['손절 2%는 무슨 뜻이야?', '손절 2% 말고 3%로 정정할게', '익절 없이 추세로 다시 해줘']) {
  test(`TF_BT_EDIT does not mutate or rerun a natural language discussion: ${text}`, () => {
    const result = sender(null, text, { edit: true });
    assert.deepEqual(result.submitted, [text]);
    assert.deepEqual(result.actions, []);
    assert.deepEqual(plain({ state: result.state, btHist: result.cur.btHist }), result.before);
    assert.equal(result.context.window.TF_BT_EDIT, false);
  });
}

test('the final quota wrapper still preserves blocked input without a submission', () => {
  const result = sender('risk', '손절 2%는 무슨 뜻이야?', { blocked: true });
  assert.deepEqual(result.actions, [['quota-blocked']]);
  assert.deepEqual(result.submitted, []);
  assert.equal(result.input.value, '손절 2%는 무슨 뜻이야?');
  assert.deepEqual(result.visible, []);
});

for (const text of ['보고서를 짧게 다시 설명해줘', '손절을 3%로 수정하면 어떻게 달라질까?', '이 결과가 왜 손실인지 설명해줘']) {
  test(`document free text is discussion without an implicit backtest: ${text}`, () => {
    const result = sender(null, text, { mode: 'document' });
    assert.deepEqual(result.submitted, [text]);
    assert.deepEqual(result.actions, []);
    assert.deepEqual(plain({ state: result.state, btHist: result.cur.btHist }), result.before);
    assert.ok(!result.documentMessages.some(html => /재검증 완료|수정 생성|Quant Validator/.test(html)));
  });
}

test('offline document fallback leaves results unchanged without invented causation or holdout approval', () => {
  const result = sender(null, '왜 손실났는지 다시 설명해줘', { mode: 'document', online: false });
  assert.deepEqual(result.submitted, []);
  assert.deepEqual(result.actions, []);
  assert.deepEqual(plain({ state: result.state, btHist: result.cur.btHist }), result.before);
  const html = result.documentMessages.join('');
  assert.match(html, /AI 연결을 사용할 수 없어/);
  assert.ok(!/Holdout.*통과|정확도가 떨어졌|재검증 완료/.test(html));
});

function historyHarness() {
  const first = { id: 'first-session' }, second = { id: 'second-session' };
  const context = createContext({
    G: { cur: first }, S: { strategy: {}, versions: [] }, TAI: {},
    gStep: null, holdoutOf: () => null,
  });
  runInContext(aiState + settingsState + pushHistory + buildContext, context);
  const append = (session, user, assistant) => {
    context.targetSession = session; context.userText = user; context.assistantText = assistant;
    runInContext('taiPushHist(targetSession,userText,assistantText)', context);
  };
  const reference = session => {
    context.G.cur = session;
    return JSON.parse(runInContext('taiBuildSystem(null,true)', context));
  };
  const messages = session => {
    context.G.cur = session; context.ai = session.ai; context.t = '현재 질문';
    runInContext(requestMessages, context);
    return plain(context.msgs);
  };
  return { first, second, context, append, reference, messages };
}

test('actual taiMarket sends seven complete prior pairs and preserves earlier full user statements', async () => {
  const h = historyHarness();
  const initial = '초보입니다. 한국어 두 문장으로. 3년 뒤 전세자금, 손실감내는 계좌 대비5%. BTC현물1시간봉 손절2% 익절7%.';
  const correction = '이전 손절2%는3%로 정정하고 자산·기간·익절은 그대로 유지해주세요.';
  const users = [initial, correction];
  for (let index = 2; index < 13; index++) users.push(`사용자 조건 원문 ${index}: 단위 KRW, 기간3년.`);
  users.forEach((user, index) => h.append(h.first, user, `assistant-suggestion-not-user-confirmed-${index}`));
  const reference = h.reference(h.first), messages = h.messages(h.first);
  assert.equal(messages.length, 15);
  assert.equal(messages[0].role, 'user');
  assert.deepEqual(messages.slice(0, -1).map(message => message.role), Array.from({ length: 14 }, (_, index) => index % 2 ? 'assistant' : 'user'));
  assert.deepEqual(messages.filter(message => message.role === 'user').slice(0, -1).map(message => message.content), users.slice(-7));
  assert.deepEqual(reference.earlierUserStatements, users.slice(0, -7));
  assert.equal(reference.historyTruncated, true);
  assert.equal(reference.earlierContextOmitted, false);
  assert.equal(reference.kind, 'unverified_browser_reference');
  assert.ok(!reference.earlierUserStatements.some(statement => statement.includes('assistant-suggestion')));
  assert.equal(h.first.ai.hist.length, 24);
  assert.deepEqual(plain(h.first.ai.olderUserStatements), [initial]);
  const serialized = JSON.stringify(reference);
  assert.ok(serialized.length < MAX_CONTEXT_CHARS);
  const request = await buildInvestmentRequest({ system: serialized, messages });
  assert.equal(request.settingsPreview, null);
  assert.equal(request.messages.at(-1).content, '현재 질문');
  assert.ok(request.messages[0].content.includes(initial));
});

test('a new session has no borrowed history, archive or omission flag', () => {
  const h = historyHarness();
  for (let index = 0; index < 14; index++) h.append(h.first, `first-only-user-${index}`, `first-only-assistant-${index}`);
  h.append(h.second, 'second-only-user', 'second-only-assistant');
  const second = h.reference(h.second);
  assert.deepEqual(second.earlierUserStatements, []);
  assert.equal(second.historyTruncated, false);
  assert.equal(second.earlierContextOmitted, false);
  assert.ok(!JSON.stringify(h.messages(h.second)).includes('first-only'));
  const before = JSON.stringify(h.second.ai);
  h.context.G.cur = h.second;
  h.append(h.first, 'late-first-result', 'late-first-assistant');
  assert.equal(JSON.stringify(h.second.ai), before);
  assert.equal(h.first.ai.hist.at(-2).content, 'late-first-result');
  assert.ok(!JSON.stringify(h.reference(h.second)).includes('late-first'));
});

test('actual global tfS intake cannot supply another conversation\'s conditions to its reference', () => {
  const h = historyHarness();
  h.context.S.tf = {
    intakeSession: h.first.id,
    intake: {
      asset: { label: 'first-session-only-ETH' },
      period: { label: 'first-session-only-3years' },
      stop: { label: 'first-session-only-2percent' },
    },
    aiSpec: { sess: h.first.id },
  };
  h.append(h.first, 'first-session-condition', 'first-session-answer');
  assert.deepEqual(h.reference(h.first).mockSettings, {
    asset: 'first-session-only-ETH',
    period: 'first-session-only-3years',
    stop: 'first-session-only-2percent',
  });
  h.append(h.second, '채권 duration을 설명해줘', 'second-session-answer');
  assert.ok(!JSON.stringify(h.reference(h.second)).includes('first-session-only-'));
});

test('unbound legacy intake is omitted, and bound context contains only selected label fields', () => {
  const h = historyHarness();
  h.context.S.tf = { intake: {
    asset: { label: '명시 BTC', rec: true },
    budget: { label: '100만원' },
    style: { label: '짧게 비교' },
    period: { raw: 'unselected-period-candidate' },
    extraCandidate: { label: 'not-a-user-selection' },
  } };
  assert.equal(h.reference(h.first).mockSettings, undefined);
  h.context.S.tf.intakeSession = h.first.id;
  assert.deepEqual(h.reference(h.first).mockSettings, {
    asset: '명시 BTC', budget: '100만원', style: '짧게 비교',
  });
  assert.ok(!JSON.stringify(h.reference(h.first)).includes('not-a-user-selection'));
  assert.ok(!JSON.stringify(h.reference(h.second)).includes('100만원'));
});

test('oversized earlier statements are omitted as complete values, never sliced into changed conditions', () => {
  const h = historyHarness();
  const oversized = 'BEGIN-condition-' + '원문'.repeat(1001) + '-END-preserve-this-condition';
  h.append(h.first, oversized, 'assistant never becomes a user statement');
  for (let index = 1; index < 9; index++) h.append(h.first, `short-user-${index}`, `short-assistant-${index}`);
  const reference = h.reference(h.first);
  assert.equal(reference.earlierContextOmitted, true);
  assert.equal(reference.historyTruncated, true);
  assert.deepEqual(reference.earlierUserStatements, ['short-user-1']);
  assert.ok(!JSON.stringify(reference).includes('BEGIN-condition'));
  // Evicting the same oversized original from the retained history also marks
  // the omission in the permanent session archive; no partial string is stored.
  for (let index = 9; index < 14; index++) h.append(h.first, `short-user-${index}`, `short-assistant-${index}`);
  assert.equal(h.first.ai.olderContextOmitted, true);
  assert.ok(!JSON.stringify(h.first.ai.olderUserStatements).includes('BEGIN-condition'));
});

test('archive count and character overflow remain bounded and visibly incomplete', () => {
  const h = historyHarness(), originals = [];
  for (let index = 0; index < 25; index++) {
    const user = `complete-${index}:` + 'a'.repeat(1390) + ':END';
    originals.push(user); h.append(h.first, user, `assistant-${index}`);
  }
  const reference = h.reference(h.first);
  assert.equal(reference.earlierContextOmitted, true);
  assert.equal(reference.historyTruncated, true);
  assert.ok(reference.earlierUserStatements.length <= 8);
  assert.ok(reference.earlierUserStatements.join('').length <= 4000);
  assert.ok(reference.earlierUserStatements.every(value => originals.includes(value)));
  assert.ok(h.first.ai.olderUserStatements.length <= 8);
  assert.ok(h.first.ai.olderUserStatements.join('').length <= 4000);
  assert.ok(h.first.ai.olderUserStatements.every(value => originals.includes(value)));
  assert.ok(JSON.stringify(reference).length < MAX_CONTEXT_CHARS);
});

test('short-statement count overflow is marked even when characters fit the archive budget', () => {
  const h = historyHarness();
  for (let index = 0; index < 30; index++) h.append(h.first, `short-complete-user-${index}`, `assistant-${index}`);
  const reference = h.reference(h.first);
  assert.equal(reference.earlierContextOmitted, true);
  assert.equal(reference.historyTruncated, true);
  assert.ok(reference.earlierUserStatements.length <= 8);
  assert.equal(h.first.ai.olderUserStatements.length, 8);
  assert.ok(reference.earlierUserStatements.every(value => /^short-complete-user-\d+$/.test(value)));
  assert.equal(h.messages(h.first)[0].role, 'user');
});
