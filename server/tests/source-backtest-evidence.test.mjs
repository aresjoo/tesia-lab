import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

// Execute the shipped builders with synthetic state. No browser, market, model,
// private backtest artifact or external request participates in these checks.
const source = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
function section(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `actual source section ${start}`);
  return source.slice(from, to);
}
const builders = [
  section('function btReadFacts(){', 'function btReadKey(){'),
  section('function btFactsAt(d){', 'var BT_SYS_J='),
  section('function rsi(arr,i){', 'function fmtDate('),
].join('\n');

function fixture({ futures = false, mine = false } = {}) {
  const prices = Array.from({ length: 130 }, (_, i) => 200 - i);
  prices[100] = 800; // Deliberately different current-day RSI from day 99.
  const requested = { name: 'BTC 15분봉 EMA 교차 숏', timeframe: '15m', side: 'short', indicator: 'EMA', leverage: 5 };
  const cfg = { kind: 'rule', asset: 'BTC', rsiTh: 30, tp: 5, sl: -2, ...(futures ? { fut: 1, lev: 5 } : {}) };
  const closed = [
    { a: 'BTC', e: 70, x: 80, pnl: 10 },
    { a: 'BTC', e: 81, x: 90, pnl: -5 },
    { a: 'BTC', e: 91, x: 95, pnl: 0 },
  ];
  const open = [
    { a: 'ETH', e: 96, x: null, pnl: 99, open: 1 },
    { a: 'SOL', e: 97, x: null, pnl: -88, open: 1 },
  ];
  const context = createContext({
    BT: {
      amt: 1000,
      s: { kind: 'rule', name: mine ? requested.name : '계산 예시', mine, cfg },
      R: {
        r: { avgHold: 2, exposure: 40, liqN: 0, fundPaid: 0.002 },
        tr: [...closed, ...open], wins: [closed[0]], loss: closed.slice(1),
        dd: [{ a: 0, b: 0 }, { a: 0, b: 1 }], N: 2,
        eq: [{ i: 99, v: 1 }, { i: 100, v: 1.05 }],
        final: 1050, ret: 5, mdd: -2, benchFinal: 1100, benchRet: 10, benchMdd: -3,
        list: ['BTC'], D: [{ k: 'buy', side: 1 }, { k: 'buy', side: -1 }],
      },
    },
    window: { TETH_FUT: { sym: { BTC: { c: prices } } } },
    TETH_FUT: { sym: { BTC: { c: prices } } },
    MK_KIND: { rule: '규칙' }, MK_CRYPTO: { BTC: true },
    MK_FEE: 0.001, MK_FUT_FEE: 0.00055,
    MK_WHY_P: { signal: '평균선 하향 교차' }, FU_WHY_P: { signal: '평균선 하향 교차' },
    tfS: () => ({ aiSpec: requested }),
    mkHook: (s) => s.name, mkTk: (a) => a, mkPx: () => prices,
    mkPxFmt: (n) => String(n), mkPct0: (n) => n + '%',
    btYMD: (i) => 'synthetic-day-' + i,
    btR1: (v, d = 1) => v == null || !Number.isFinite(v) ? null : +v.toFixed(d),
    btAi: () => false,
    btRules: () => [['진입', '일봉 RSI 반등'], ['청산', '손절 또는 익절']],
    fuBtRules: () => [['청산', '신호 다음날 시가 청산']],
    fetch: () => { throw new Error('network forbidden in evidence fixture'); },
  });
  runInContext(builders, context);
  const read = (expression) => JSON.parse(JSON.stringify(runInContext(expression, context)));
  return { context, prices, requested, cfg, read };
}

function sell(context, { nextDay = true } = {}) {
  context.decision = {
    i: 100, j: 1, a: 'BTC', k: 'sell', tag: '롱 청산', tk: 'BTC', pnl: 78.9,
    e: { xi: nextDay ? 101 : 100, ep: 120, px: 9341, why: 'signal' },
  };
}

test('actual report separates Mock calculation, unmatched original strategy and cost-before benchmark', () => {
  const { read, requested, cfg } = fixture({ mine: true });
  const facts = read('btReadFacts()');
  assert.match(facts.자료구분, /Mock/);
  assert.match(facts.자료구분, /미검증/);
  assert.equal(facts.상품, '현물');
  assert.equal(facts.전략, requested.name);
  assert.deepEqual(facts.계산전략.cfg, cfg);
  assert.deepEqual(facts.계산전략.사용자원조건, requested);
  assert.match(facts.계산전략.원조건출처, /현재 aiSpec 일부/);
  assert.match(facts.계산전략.원조건출처, /계산당시.*미확인/);
  assert.match(facts.계산전략.원조건일치, /미검증/);
  assert.equal(facts.비용기준.동등비교, false);
  assert.match(facts.비용기준.전략, /수수료 차감/);
  assert.match(facts.비용기준.비교군, /수수료.*미반영/);
  assert.equal(facts.비용기준.수수료율, 0.001);
  assert.equal(facts.비용기준.MMR, '해당 없음');
  assert.match(facts.검증상태, /holdout.*미확인/);
  // The raw displayed difference survives without being promoted to fair outperformance.
  assert.equal(facts.그냥보유와의차이, '전략이 $50 덜 남김');
  assert.equal(facts.전략결과.남은금액, '$1,050');
});

test('catalog report has no invented original user conditions or strategy-match verification', () => {
  const facts = fixture().read('btReadFacts()');
  assert.equal(facts.계산전략.사용자원조건, null);
  assert.match(facts.계산전략.원조건일치, /미검증/);
});

test('report keeps completed trades distinct from open positions and excludes unrealized extremes', () => {
  const facts = fixture().read('btReadFacts()');
  assert.equal(facts.끝난거래, 3);
  assert.equal(facts.미청산포지션, 2);
  assert.equal(facts.이긴거래, 1);
  assert.equal(facts.진거래, 1);
  assert.equal(facts.본전거래, 1);
  assert.equal(facts.이긴거래 + facts.진거래 + facts.본전거래, facts.끝난거래);
  assert.equal(facts.가장좋았던거래, 'BTC 10%');
  assert.equal(facts.가장나빴던거래, 'BTC -5%');
});

test('futures report uses its own fee model and exposes liquidation limitations and funding denominator', () => {
  const facts = fixture({ futures: true }).read('btReadFacts()');
  assert.equal(facts.비용기준.수수료율, 0.00055);
  assert.match(facts.비용기준.슬리피지, /모형.*미검증/);
  assert.match(facts.비용기준.MMR, /모형.*미검증/);
  assert.equal(facts.강제청산, 0);
  assert.equal(facts.낸펀딩비, '-0.2% (시작 금액 대비)');
  assert.equal(facts.롱진입, 1);
  assert.equal(facts.숏진입, 1);
});

test('actual judgment separates signal day from next-day execution and omits future fill price and PnL', () => {
  const { context, read } = fixture({ futures: true });
  sell(context);
  const facts = read('btFactsAt(decision)');
  assert.equal(facts.날짜, 'synthetic-day-100');
  assert.equal(facts.관측.signalDate, facts.날짜);
  assert.equal(facts.관측.fillDate, 'synthetic-day-101');
  assert.match(facts.관측.fillStatus, /next-day.*excluded/);
  assert.match(facts['내려진 결정'], /신호일.*다음날/);
  assert.match(facts['기록된 신호'], /롱 청산/);
  assert.equal(facts['이 거래'].진입가, 120);
  assert.equal(facts['이 거래'].사유, '평균선 하향 교차');
  assert.equal(Object.hasOwn(facts['이 거래'], '청산가'), false);
  assert.equal(Object.hasOwn(facts['이 거래'], '손익'), false);
  assert.doesNotMatch(JSON.stringify(facts), /9341|78\.9/);
  assert.match(facts.자료구분, /Mock.*미검증/);
});

test('changing future prices and future fills cannot alter signal-day observations or rationale inputs', () => {
  const { context, read, prices } = fixture({ futures: true });
  sell(context);
  const before = read('btFactsAt(decision)');
  for (let i = 101; i < prices.length; i++) prices[i] = 1_000_000 + i;
  context.decision.e.px = 1234567;
  context.decision.pnl = -99.8;
  const after = read('btFactsAt(decision)');
  assert.deepEqual(after, before);
});

test('spot judgment labels the actual previous-day RSI separately from signal-day closing observations', () => {
  const { context, read } = fixture();
  sell(context, { nextDay: false });
  const facts = read('btFactsAt(decision)');
  assert.equal(facts.종목.종가, 800);
  assert.equal(facts.종목.RSI, 0);
  assert.equal(facts.종목.RSI관측일, 'synthetic-day-99');
  assert.equal(facts.단위.변화및평균대비, '퍼센트(%)');
  assert.equal(facts.단위.RSI, '0~100 지표값');
  assert.match(facts.단위.가격, /호가통화 미검증/);
  assert.equal(facts.관측.signalDate, 'synthetic-day-100');
  assert.equal(facts.종목['되돌림 점수 기준'], '30 아래');
  assert.ok(read('rsi(mkPx("BTC"),100)') > 90, 'fixture distinguishes the two observation dates');
  assert.match(facts.관측.fillStatus, /intraday.*unverified/);
});

test('futures judgment does not invent RSI observations or dates when that indicator was not computed', () => {
  const { context, read } = fixture({ futures: true });
  sell(context);
  const facts = read('btFactsAt(decision)');
  assert.equal(Object.hasOwn(facts.종목, 'RSI'), false);
  assert.equal(Object.hasOwn(facts.종목, 'RSI관측일'), false);
});

test('missing fee evidence stays null rather than becoming a verified zero fee', () => {
  for (const futures of [false, true]) {
    const { context, read } = fixture({ futures });
    delete context[futures ? 'MK_FUT_FEE' : 'MK_FEE'];
    const facts = read('btReadFacts()');
    assert.equal(facts.비용기준.수수료율, null);
    assert.equal(facts.비용기준.동등비교, false);
    assert.match(facts.비용기준.수수료단위, /편도.*명목금액.*소수/);
  }
});
