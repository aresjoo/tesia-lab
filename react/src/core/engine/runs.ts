// 세 판단 방식의 실행기와 선물 실행기. 모두 원장(ledger.ts)으로 계산한다.
// 원본 함수와 같은 순서, 같은 식이다. 숫자가 원본과 한 자리도 다르지 않아야 한다.
import { MK_UNI } from './catalog.data';
import { fuD, mkFng, mkOpen, mkPx } from './data';
/* rsi 는 cond 의 결과 항목(rsi)과 이름이 겹쳐 rsiAt 으로 부른다 */
import { fuMax, fuMin, fuSma, mkVol, rsi as rsiAt, sma } from './indicators';
import { fuLedger, mkLedger, mkStatsOf, type FutPos, type Pos } from './ledger';
import type { CatCfg, Ev, RunResult, Trade } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** mkCheckIn(PX,N,c): 입력 검사 */
function mkCheckIn(PX: number[][], N: number, c: { every: number; look?: number | null }) {
  for (let z = 0; z < PX.length; z++) {
    if (PX[z].length !== N) throw new Error('price length');
    for (let y = 0; y < N; y++) if (!(PX[z][y] > 0) || !isFinite(PX[z][y])) throw new Error('bad price');
  }
  if (!(c.every >= 1) || (c.look != null && !(c.look >= 2 && c.look < N - 1))) throw new Error('bad config');
}

export type AgentCfg = { uni: string[]; look: number; top: number; gate: number; every: number; trail: number; volT: number; minS: number; startI?: number };

/** mkAgentRun(c): AI 판단. 정해진 날마다 종목을 비교해 강한 것을 나눠 담는다 */
export function mkAgentRun(c: AgentCfg): RunResult {
  const U = c.uni;
  const PX = U.map((k) => mkPx(k));
  const N = PX[0].length;
  const endI = N - 1;
  const startI = Math.max(61, c.look + 1, c.startI || 61);
  const top = Math.max(1, Math.min(4, c.top));
  mkCheckIn(PX, N, c);
  const J: Record<string, number> = {};
  U.forEach((k, j) => {
    J[k] = j;
  });
  const L = mkLedger();
  const eq: { i: number; v: number }[] = [];
  let ev: Ev[] = [];
  let invested = 0;
  let cur = startI;
  const px = (k: string) => PX[J[k]][cur];
  type Pend = { t: 'sell'; p: Pos; why: string; ev: Ev } | { t: 'buy'; k: string; w: number; ev: Ev };
  let pend: Pend[] = [];
  function scan(i: number) {
    const rows = U.map((k, j) => {
      const P = PX[j];
      const v = mkVol(P, i, 20);
      const m = P[i] / P[i - c.look] - 1;
      return { k, mom: m, vol: v, score: m / (v * Math.sqrt(c.look)), above: P[i] > (sma(P, 60, i) as number), px: P[i] };
    });
    const up = rows.filter((r) => r.above).length;
    rows.sort((a, b) => b.score - a.score);
    return { rows, up, of: U.length, breadth: up / U.length };
  }
  const selling = (p: Pos) => pend.some((o) => o.t === 'sell' && o.p === p);
  const buying = (k: string) => pend.some((o) => o.t === 'buy' && o.k === k);
  /* 파는 결정: 그날 종가로 정하고, 다음 거래일 종가에 판다 */
  function out(p: Pos, i: number, why: string) {
    if (selling(p)) return;
    const e: Ev = { i, t: 'exit', a: p.k, why, _pend: 1 };
    ev.push(e);
    pend.push({ t: 'sell', p, why, ev: e });
  }
  for (let i = startI; i <= endI; i++) {
    cur = i;
    /* 0) 대기 주문 체결: 판 다음에 산다. 그 자산이 거래되는 날의 종가 */
    if (pend.length) {
      const keep: Pend[] = [];
      pend.forEach((o) => {
        if (o.t !== 'sell') return;
        if (!mkOpen(o.p.k, i)) {
          keep.push(o);
          return;
        }
        const t = L.sell(o.p, px(o.p.k), i, o.why);
        const e = o.ev;
        delete e._pend;
        e.xi = i;
        e.tid = t.id;
        e.px = t.xp;
        e.units = t.units;
        e.got = t.got;
        e.fee = t.fee;
        e.pnl = t.pnl * 100;
      });
      const tot0 = L.value(px);
      pend.forEach((o) => {
        if (o.t !== 'buy') return;
        if (!mkOpen(o.k, i)) {
          keep.push(o);
          return;
        }
        const p2 = L.buy(o.k, px(o.k), o.w * tot0, i, { w: o.w });
        const e = o.ev;
        if (!p2) {
          e._drop = 1;
          return;
        }
        delete e._pend;
        e.xi = i;
        e.tid = p2.id;
        e.px = px(o.k);
        e.units = p2.units;
        e.cost = p2.cost;
        e.fee = p2.fee;
        e.w = p2.cost / tot0;
      });
      pend = keep;
    }
    L.pos.forEach((p) => {
      if (mkOpen(p.k, i)) {
        const v = px(p.k);
        if (v > p.hi) p.hi = v;
      }
    });
    /* 1) 이탈: 든 뒤 고점에서 trail% 밀리면 내린다(그 자산이 거래된 날에만 판단) */
    L.pos.slice().forEach((p) => {
      if (i > p.ei && mkOpen(p.k, i) && px(p.k) <= p.hi * (1 - c.trail / 100)) out(p, i, 'trail');
    });
    /* 2) 재평가 */
    if ((i - startI) % c.every === 0) {
      const S = scan(i);
      const weak = S.breadth < c.gate;
      const rank: Record<string, number> = {};
      S.rows.forEach((r, q) => {
        rank[r.k] = q;
      });
      L.pos.slice().forEach((p) => {
        if (!mkOpen(p.k, i) || selling(p)) return;
        const r = S.rows[rank[p.k]];
        if (i > p.ei && (r.score < 0 || !r.above)) out(p, i, 'weak');
        else if (i > p.ei && rank[p.k] > top + 1) out(p, i, 'rot');
      });
      const cand = S.rows.filter((r) => r.above && r.score >= c.minS && mkOpen(r.k, i) && !L.pos.some((p) => p.k === r.k) && !buying(r.k));
      const top3 = S.rows.slice(0, 3).map((r) => ({ k: r.k, mom: r.mom * 100, above: r.above }));
      const held = () => L.pos.filter((p) => !selling(p)).map((p) => p.k);
      const effN = () => L.pos.filter((p) => !selling(p)).length + pend.filter((o) => o.t === 'buy').length;
      if (weak) ev.push({ i, t: 'skip', why: 'gate', up: S.up, of: S.of, top: top3, held: held() });
      else if (effN() >= top) ev.push({ i, t: 'hold', up: S.up, of: S.of, top: top3, held: held() });
      else if (!cand.length) ev.push({ i, t: 'skip', why: 'none', up: S.up, of: S.of, top: top3, held: held() });
      else {
        while (effN() < top && cand.length) {
          const r2 = cand.shift() as (typeof cand)[number];
          const w = Math.max(0.1, Math.min(1 / top, ((1 / top) * c.volT) / r2.vol));
          const skip: { k: string; why: string }[] = [];
          const rk = rank[r2.k];
          for (let sq = 0; sq < rk; sq++) {
            const sr = S.rows[sq];
            skip.push({ k: sr.k, why: L.pos.some((p) => p.k === sr.k) ? 'held' : !sr.above ? 'below' : 'weak' });
          }
          const e2: Ev = { i, t: 'enter', a: r2.k, mom: r2.mom * 100, w, rank: rk + 1, skip, cut: w < 1 / top - 1e-9, up: S.up, of: S.of, top: top3, _pend: 1 };
          ev.push(e2);
          pend.push({ t: 'buy', k: r2.k, w, ev: e2 });
        }
      }
    }
    const v2 = L.value(px);
    eq.push({ i, v: v2 });
    invested += (v2 - L.cash) / v2;
  }
  ev = ev.filter((e) => !e._pend && !e._drop); /* 마지막 날까지 체결되지 않은 결정은 거래로 치지 않는다 */
  cur = endI;
  const now = scan(endI);
  const r3 = mkStatsOf(eq, L, { startI, endI }, startI, endI, invested);
  const total2 = L.value(px);
  r3.events = ev;
  r3.state = {
    asOf: endI,
    cash: L.cash / total2,
    open: L.pos.map((p) => {
      const v = px(p.k);
      return { k: p.k, tid: p.id, entry: p.ei, ep: p.ep, units: p.units, cost: p.cost, px: v, chg: (v / p.ep - 1) * 100, w: (p.units * v) / total2, hi: p.hi, stop: p.hi * (1 - c.trail / 100) };
    }),
    scan: {
      up: now.up,
      of: now.of,
      weak: now.breadth < c.gate,
      top: now.rows.slice(0, 4).map((x) => ({ k: x.k, mom: x.mom * 100, above: x.above })),
      rows: now.rows.map((x, q) => ({ k: x.k, rank: q + 1, mom: x.mom * 100, above: x.above, ok: x.above && x.score >= c.minS, held: L.pos.some((p) => p.k === x.k) })),
    },
    lastEval: startI + Math.floor((endI - startI) / c.every) * c.every,
    nextEval: startI + (Math.floor((endI - startI) / c.every) + 1) * c.every,
  };
  return r3;
}

export type HybridCfg = { asset?: string | null; uni?: string[]; look?: number; every?: number; rsiTh: number; tp?: number | null; sl: number; tf?: boolean | number; fng?: number | null; gate?: number; startI?: number };

/** mkRuleRun(c): 차트 규칙. 한 종목에 조건이 맞을 때만 */
export function mkRuleRun(c: HybridCfg): RunResult {
  return mkHybridRun({ asset: c.asset, rsiTh: c.rsiTh, tp: c.tp, sl: c.sl, tf: c.tf, fng: c.fng, every: 1, gate: 0, startI: c.startI });
}

/** mkHybridRun(c): 혼합 전략. AI 가 종목을 고르고 규칙이 시점을 정한다 */
export function mkHybridRun(c: HybridCfg): RunResult {
  const fixed = c.asset || null;
  const U = fixed ? [fixed] : (c.uni as string[]);
  const PX = U.map((k) => mkPx(k));
  const N = PX[0].length;
  const endI = N - 1;
  const startI = Math.max(61, (c.look || 0) + 1, c.startI || 61);
  mkCheckIn(PX, N, { every: c.every || 1, look: c.look });
  const look = c.look as number;
  const every = c.every as number;
  function upN(i: number) {
    let u = 0;
    for (let z = 0; z < U.length; z++) if (PX[z][i] > (sma(PX[z], 60, i) as number)) u++;
    return u;
  }
  function cond(P: number[], i: number) {
    const rv = rsiAt(P, i - 1);
    const bo = (P[i] / P[i - 1] - 1) * 100;
    const s20 = sma(P, 20, i) as number;
    const s60 = sma(P, 60, i) as number;
    const gap = (Math.abs(s20 - s60) / P[i]) * 100;
    const up = upN(i);
    return { i, rsi: rv, rsiOk: rv < c.rsiTh, bounce: bo, bounceOk: bo > 0.5, gap, trendOk: !c.tf || gap > 3, fng: mkFng(i), fngOk: c.fng == null || (mkFng(i) != null && (mkFng(i) as number) <= c.fng), up, of: U.length, mktOk: !!fixed || !c.gate || up / U.length >= c.gate };
  }
  const J: Record<string, number> = {};
  U.forEach((k, j) => {
    J[k] = j;
  });
  const L = mkLedger();
  const eq: { i: number; v: number }[] = [];
  let ev: Ev[] = [];
  let pick: string | null = fixed;
  let cur = startI;
  let topAt: number | null = null;
  let lastTop: { k: string; mom: number }[] | null = null;
  let invested = 0;
  const px = (k: string) => PX[J[k]][cur];
  type Pend = { t: 'buy'; k: string; ev: Ev } | { t: 'sell'; k: string; p: Pos; why: string; ev: Ev };
  let pend: Pend | null = null;
  function choose(i: number) {
    const rows = U.map((k, j) => {
      const P = PX[j];
      return { k, mom: P[i] / P[i - look] - 1, above: P[i] > (sma(P, 60, i) as number) };
    });
    const up = rows.filter((r) => r.above);
    up.sort((a, b) => b.mom - a.mom);
    return { rows: up, up: up.length };
  }
  for (let i = startI; i <= endI; i++) {
    cur = i;
    /* 대기 주문 체결: 판단한 다음 거래일 종가 */
    if (pend && mkOpen(pend.k, i)) {
      const pd: Pend = pend;
      const e0 = pd.ev;
      delete e0._pend;
      e0.xi = i;
      if (pd.t === 'buy') {
        const Pb = PX[J[pd.k]];
        const bb = L.buy(pd.k, Pb[i], L.cash, i, { w: 1 });
        if (bb) {
          e0.tid = bb.id;
          e0.px = Pb[i];
          e0.units = bb.units;
          e0.cost = bb.cost;
          e0.fee = bb.fee;
        } else e0._drop = 1;
      } else {
        const ts = L.sell(pd.p, px(pd.p.k), i, pd.why);
        e0.tid = ts.id;
        e0.px = ts.xp;
        e0.units = ts.units;
        e0.got = ts.got;
        e0.fee = ts.fee;
        e0.chg = ((ts.xp as number) / pd.p.ep - 1) * 100;
        e0.pnl = ts.pnl * 100;
      }
      pend = null;
    }
    const p: Pos | null = L.pos[0] || null;
    if (!fixed && !p && !pend && (i - startI) % every === 0) {
      const C = choose(i);
      topAt = i;
      lastTop = C.rows.slice(0, 3).map((r) => ({ k: r.k, mom: r.mom * 100 }));
      if (!C.rows.length) {
        if (pick !== null) ev.push({ i, t: 'unpick' });
        pick = null;
      } else if (pick !== C.rows[0].k) {
        pick = C.rows[0].k;
        ev.push({ i, t: 'pick', a: pick, mom: C.rows[0].mom * 100, top: lastTop });
      }
    }
    if (!p && !pend) {
      if (pick !== null && mkOpen(pick, i)) {
        const P = PX[J[pick]];
        const q = cond(P, i);
        if (q.rsiOk && q.bounceOk && q.trendOk && q.fngOk) {
          const up2 = q.up;
          if (!q.mktOk) ev.push({ i, t: 'veto', a: pick, up: up2, of: U.length, rsi: q.rsi, bounce: q.bounce });
          else {
            const eb: Ev = { i, t: 'enter', a: pick, rsi: q.rsi, bounce: q.bounce, fng: q.fng, up: up2, of: U.length, _pend: 1 };
            ev.push(eb);
            pend = { t: 'buy', k: pick, ev: eb };
          }
        }
      }
    } else if (p && !pend && i > p.ei && mkOpen(p.k, i)) {
      const v = px(p.k);
      const chg = (v / p.ep - 1) * 100;
      const why = chg <= c.sl ? 'sl' : c.tp != null && chg >= c.tp ? 'tp' : i - p.ei >= 25 ? 'time' : null;
      if (why) {
        const es: Ev = { i, t: 'exit', a: p.k, why, _pend: 1 };
        ev.push(es);
        pend = { t: 'sell', k: p.k, p, why, ev: es };
      }
    }
    const v3 = L.value(px);
    eq.push({ i, v: v3 });
    invested += (v3 - L.cash) / v3;
  }
  ev = ev.filter((e) => !e._pend && !e._drop); /* 마지막 날까지 체결되지 않은 결정은 뺀다 */
  cur = endI;
  const r = mkStatsOf(eq, L, { startI, endI, sl: c.sl, tp: c.tp, rsiTh: c.rsiTh }, startI, endI, invested);
  const o: Pos | null = L.pos[0] || null;
  const Pn = pick !== null ? PX[J[pick]] : null;
  const ev1 = c.every || 1;
  r.events = ev;
  r.state = {
    asOf: endI,
    pick,
    top: lastTop,
    topAt,
    open: o ? { k: o.k, tid: o.id, entry: o.ei, ep: o.ep, units: o.units, cost: o.cost, px: px(o.k), chg: (px(o.k) / o.ep - 1) * 100, held: endI - o.ei } : null,
    cond: Pn ? cond(Pn, endI) : null,
    lastEval: startI + Math.floor((endI - startI) / ev1) * ev1,
    nextEval: startI + (Math.floor((endI - startI) / ev1) + 1) * ev1,
  };
  return r;
}
/** mkFutRun(c): 선물. 롱과 숏 양방향, 레버리지, 펀딩비, 강제 청산 */
export function mkFutRun(c0: Omit<Partial<CatCfg>, 'uni'> & { uni?: string[] }): RunResult {
  const c = c0 as any;
  const U: string[] = c.asset ? [c.asset] : c.uni;
  const DT = U.map(fuD);
  const N = DT[0].c.length;
  const endI = N - 1;
  const J: Record<string, number> = {};
  U.forEach((k, j) => {
    J[k] = j;
  });
  const need = Math.max(61, (c.n || 0) + 2, (c.look || 0) + 2, (c.reg || 0) + 2, (c.slow || 0) + 2);
  const startI = Math.max(need, c.startI || 61);
  const lev = Math.max(1, Math.min(10, c.lev || 1));
  const L = fuLedger();
  const eq: { i: number; v: number }[] = [];
  let ev: Ev[] = [];
  type Pend = { t: 'close'; p: FutPos; why: string; ev: Ev } | { t: 'open'; k: string; side: number; w: number; ev: Ev };
  let pend: Pend[] = [];
  let cur = startI;
  let invested = 0;
  const px = (k: string) => DT[J[k]].c[cur];
  const top = Math.max(1, Math.min(4, c.top || 1));
  const every = c.every || 1;
  let pickL: string | null = c.asset || null;
  let pickS: string | null = c.asset || null;
  let lastTop: any = null;
  let regime = c.asset ? 2 : 0; /* 2=양쪽, 1=롱만, -1=숏만, 0=쉼 */
  function qClose(p: FutPos, why: string, i: number, extra?: Record<string, any>) {
    if (pend.some((o) => o.t === 'close' && o.p === p)) return;
    const e: Ev = { i, t: 'exit', a: p.k, side: p.side, lev: p.lev, why, _pend: 1 };
    if (extra) for (const k in extra) e[k] = extra[k];
    ev.push(e);
    pend.push({ t: 'close', p, why, ev: e });
  }
  function qOpen(k: string, side: number, w: number, i: number, extra: Record<string, any>) {
    const e: Ev = { i, t: 'enter', a: k, side, lev, _pend: 1 };
    for (const x in extra) e[x] = extra[x];
    ev.push(e);
    pend.push({ t: 'open', k, side, w, ev: e });
  }
  function fillExit(e: Ev, t: Trade) {
    delete e._pend;
    e.xi = t.exit;
    e.tid = t.id;
    e.px = t.xp;
    e.units = Math.abs(t.units as number);
    e.got = t.got;
    e.fee = t.fee;
    e.fund = t.fund;
    e.ep = t.ep;
    e.chg = (t.side as number) * ((t.xp as number) / (t.ep as number) - 1) * 100;
    e.pnl = t.pnl * 100;
  }
  /* 규칙 신호: 그 종목의 그날 종가 기준. +1 롱 진입, -1 숏 진입, 0 없음 */
  function sig(j: number, i: number): number {
    const D = DT[j];
    const C = D.c;
    let s = 0;
    if (c.mode === 'brk') {
      if (C[i] > fuMax(D.h, i - c.n, i - 1)) s = 1;
      else if (C[i] < fuMin(D.l, i - c.n, i - 1)) s = -1;
    } else if (c.mode === 'ma') {
      const f0 = fuSma(C, c.fast, i);
      const s0 = fuSma(C, c.slow, i);
      const f1 = fuSma(C, c.fast, i - 1);
      const s1 = fuSma(C, c.slow, i - 1);
      if (f0 > s0 && f1 <= s1) s = 1;
      else if (f0 < s0 && f1 >= s1) s = -1;
    } else if (c.mode === 'fg') {
      const g = mkFng(i);
      const r = C[i] / C[i - 1] - 1;
      if (g != null && g <= c.lo && r > 0.005) s = 1;
      else if (g != null && g >= c.hi && r < -0.005) s = -1;
    } else if (c.mode === 'dip') {
      const r2 = C[i] / C[i - 1] - 1;
      const dd = C[i] / fuMax(D.h, i - c.n, i) - 1;
      const up = C[i] / fuMin(D.l, i - c.n, i) - 1;
      if (dd <= -c.dip / 100 && r2 > 0.005) s = 1;
      else if (up >= c.dip / 100 && r2 < -0.005) s = -1;
    }
    if (s && c.reg) {
      const m = fuSma(C, c.reg, i);
      if (s > 0 && C[i] < m) s = 0;
      if (s < 0 && C[i] > m) s = 0;
    }
    if (s > 0 && c.dir === 'short') s = 0;
    if (s < 0 && c.dir === 'long') s = 0;
    return s;
  }
  function scan(i: number) {
    const rows = U.map((k, j) => {
      const C = DT[j].c;
      const m = C[i] / C[i - c.look] - 1;
      const v = mkVol(C, i, 20);
      return { k, j, mom: m, vol: v, score: m / (v * Math.sqrt(c.look)), above: C[i] > fuSma(C, 60, i) };
    });
    const up = rows.filter((r) => r.above).length;
    rows.sort((a, b) => b.score - a.score);
    return { rows, up, of: U.length, br: up / U.length };
  }
  for (let i = startI; i <= endI; i++) {
    cur = i;
    /* ① 전날 정한 주문: 시가 체결. 닫고 나서 연다 */
    if (pend.length) {
      const opx = (k: string) => DT[J[k]].o[i];
      pend.forEach((o) => {
        if (o.t !== 'close' || L.pos.indexOf(o.p) < 0) {
          if (o.t === 'close') o.ev._drop = 1;
          return;
        }
        const po = opx(o.p.k);
        const lq = L.liqPx(o.p);
        const gl = o.p.side > 0 ? po <= lq : po >= lq;
        if (gl) o.ev.why = 'liq';
        fillExit(o.ev, L.close(o.p, po, i, gl ? 'liq' : o.why, gl));
      });
      let tot = L.cash;
      L.pos.forEach((p) => {
        tot += Math.max(0, L.eqOf(p, opx(p.k)));
      });
      pend.forEach((o) => {
        if (o.t !== 'open') return;
        const p = L.open(o.k, o.side, o.w * tot, lev, opx(o.k), i, { w: o.w });
        const e = o.ev;
        if (!p) {
          e._drop = 1;
          return;
        }
        delete e._pend;
        e.xi = i;
        e.tid = p.id;
        e.px = p.ep;
        e.units = p.units;
        e.cost = p.cost;
        e.fee = p.fee;
        e.liq = L.liqPx(p);
      });
      pend = [];
    }
    /* ② 장중: 강제 청산, 손절, 고점 추적 손절, 익절 */
    L.pos.slice().forEach((p) => {
      const D = DT[J[p.k]];
      const o = D.o[i];
      const hi = D.h[i];
      const lo = D.l[i];
      const fresh = p.ei === i;
      const liq = L.liqPx(p);
      const stop: number | null = c.sl ? p.ep * (1 - (p.side * c.sl) / 100) : null;
      const tr: number | null = c.trail && !fresh ? p.best * (1 - (p.side * c.trail) / 100) : null;
      const tp: number | null = c.tp ? p.ep * (1 + (p.side * c.tp) / 100) : null;
      const worse = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : p.side > 0 ? Math.max(a, b) : Math.min(a, b));
      const s0 = worse(stop, tr);
      const hitAdv = (x: number | null) => x != null && (p.side > 0 ? lo <= x : hi >= x);
      const gap = (x: number) => (p.side > 0 ? o <= x : o >= x);
      let e: Ev;
      /* 시가가 이미 강제 청산 가격이나 익절 가격을 넘어 시작한 날: 시가에서 먼저 처리한다 */
      if (!fresh && (p.side > 0 ? o <= liq : o >= liq)) {
        e = { i, t: 'exit', a: p.k, side: p.side, lev: p.lev, why: 'liq', ref: liq };
        ev.push(e);
        fillExit(e, L.close(p, o, i, 'liq', true));
        return;
      }
      if (!fresh && tp != null && (p.side > 0 ? o >= tp : o <= tp)) {
        e = { i, t: 'exit', a: p.k, side: p.side, lev: p.lev, why: 'tp', ref: tp };
        ev.push(e);
        fillExit(e, L.close(p, o, i, 'tp', true));
        return;
      }
      if (s0 != null && (p.side > 0 ? s0 > liq : s0 < liq) && hitAdv(s0)) {
        const why = tr != null && s0 === tr ? 'trail' : 'sl';
        e = { i, t: 'exit', a: p.k, side: p.side, lev: p.lev, why, ref: s0 };
        ev.push(e);
        fillExit(e, L.close(p, !fresh && gap(s0) ? o : s0, i, why));
        return;
      }
      if (hitAdv(liq)) {
        e = { i, t: 'exit', a: p.k, side: p.side, lev: p.lev, why: 'liq', ref: liq };
        ev.push(e);
        fillExit(e, L.close(p, liq, i, 'liq', true));
        return;
      }
      if (tp != null && (p.side > 0 ? hi >= tp : lo <= tp)) {
        e = { i, t: 'exit', a: p.k, side: p.side, lev: p.lev, why: 'tp', ref: tp };
        ev.push(e);
        fillExit(e, L.close(p, !fresh && (p.side > 0 ? o >= tp : o <= tp) ? o : tp, i, 'tp', true));
        return;
      }
    });
    /* ③ 펀딩비: 롱은 펀딩비가 양수일 때 내고, 숏은 받는다 */
    L.pos.forEach((p) => {
      const D = DT[J[p.k]];
      p.fund += (p.side * p.units * D.c[i] * D.f[i]) / 1e4;
      if (p.side > 0 ? D.c[i] > p.best : D.c[i] < p.best) p.best = D.c[i];
    });
    /* ④ 종가로 다음 날 주문을 정한다 */
    const held = (k: string) => L.pos.filter((p) => p.k === k)[0] || null;
    if (c.kind === 'agent') {
      if ((i + (c.ph || 0)) % every === 0) {
        const S = scan(i);
        const rk: Record<string, number> = {};
        S.rows.forEach((r, q) => {
          rk[r.k] = q;
        });
        const n = S.rows.length;
        const reg = c.neutral ? 2 : S.br >= c.gate ? 1 : S.br <= 1 - c.gate ? -1 : 0;
        let wantL = reg === 1 || reg === 2 ? S.rows.slice(0, top).filter((r) => c.neutral || (r.above && r.score > 0)) : [];
        let wantS = reg === -1 || reg === 2 ? S.rows.slice(n - top).filter((r) => c.neutral || (!r.above && r.score < 0)) : [];
        if (c.dir === 'long') wantS = [];
        if (c.dir === 'short') wantL = [];
        const top3 = S.rows.slice(0, 3).map((r) => ({ k: r.k, mom: r.mom * 100 }));
        const bot3 = S.rows
          .slice(n - 3)
          .reverse()
          .map((r) => ({ k: r.k, mom: r.mom * 100 }));
        const want: Record<string, number> = {};
        wantL.forEach((r) => {
          want[r.k] = 1;
        });
        wantS.forEach((r) => {
          want[r.k] = -1;
        });
        L.pos.slice().forEach((p) => {
          if (want[p.k] !== p.side) qClose(p, want[p.k] ? 'flip' : reg === 0 ? 'rest' : 'rot', i);
        });
        const slots = (c.neutral ? 2 : 1) * top;
        let fresh2 = 0;
        ([] as [(typeof S.rows)[number], number][]).concat(
          wantL.map((r) => [r, 1] as [(typeof S.rows)[number], number]),
          wantS.map((r) => [r, -1] as [(typeof S.rows)[number], number]),
        ).forEach((x) => {
          const r = x[0];
          const sd = x[1];
          const h = held(r.k);
          if (h && h.side === sd) return;
          fresh2++;
          qOpen(r.k, sd, 1 / slots, i, { mom: r.mom * 100, rank: sd > 0 ? rk[r.k] + 1 : n - rk[r.k], up: S.up, of: S.of, top: top3, bot: bot3, w: 1 / slots });
        });
        if (!fresh2) ev.push({ i, t: wantL.length + wantS.length ? 'hold' : 'skip', why: reg === 0 ? 'gate' : 'none', up: S.up, of: S.of, top: top3, bot: bot3, held: L.pos.map((p) => p.k) });
      }
    } else {
      if (c.kind === 'mix' && (i + (c.ph || 0)) % every === 0 && !L.pos.length) {
        const S2 = scan(i);
        const n2 = S2.rows.length;
        const a = S2.rows[0];
        const b = S2.rows[n2 - 1];
        regime = S2.br >= c.gate ? 1 : S2.br <= 1 - c.gate ? -1 : 0;
        lastTop = {
          up: S2.up,
          of: S2.of,
          top: S2.rows.slice(0, 3).map((r) => ({ k: r.k, mom: r.mom * 100 })),
          bot: S2.rows
            .slice(n2 - 3)
            .reverse()
            .map((r) => ({ k: r.k, mom: r.mom * 100 })),
        };
        const nl = regime > 0 ? a.k : null;
        const ns = regime < 0 ? b.k : null;
        if (nl !== pickL || ns !== pickS) {
          pickL = nl;
          pickS = ns;
          ev.push(nl || ns ? { i, t: 'pick', a: (nl || ns) as string, side: nl ? 1 : -1, mom: (nl ? a : b).mom * 100, up: S2.up, of: S2.of, top: lastTop.top, bot: lastTop.bot } : { i, t: 'unpick', up: S2.up, of: S2.of });
        }
      }
      const p0: FutPos | null = L.pos[0] || null;
      /* 보유 중: 반대 신호나 출구 채널, 보유 기한 */
      if (p0 && !pend.length) {
        const jj = J[p0.k];
        const D0 = DT[jj];
        const sg = sig(jj, i);
        let out: string | null = null;
        if (c.exitN && (p0.side > 0 ? D0.c[i] < fuMin(D0.l, i - c.exitN, i - 1) : D0.c[i] > fuMax(D0.h, i - c.exitN, i - 1))) out = 'chan';
        else if (c.hold && i - p0.ei >= c.hold) out = 'time';
        if (sg && sg !== p0.side && (c.kind !== 'mix' || regime === sg || regime === 2)) {
          qClose(p0, 'flip', i);
          qOpen(p0.k, sg, 1, i, { n: c.n, ref: sg > 0 ? fuMax(D0.h, i - (c.n || 1), i - 1) : fuMin(D0.l, i - (c.n || 1), i - 1), fng: mkFng(i), up: lastTop && lastTop.up, of: lastTop && lastTop.of });
        } else if (out) qClose(p0, out, i);
      } else if (!p0 && !pend.length) {
        const cand: string[] = c.kind === 'mix' ? ([pickL, pickS].filter((k) => k) as string[]) : [c.asset];
        cand.forEach((k) => {
          if (pend.length) return;
          const j2 = J[k];
          const D2 = DT[j2];
          const s2 = sig(j2, i);
          if (!s2) return;
          if (c.kind === 'mix') {
            const okSide = (k === pickL && s2 > 0) || (k === pickS && s2 < 0);
            if (!okSide) {
              ev.push({ i, t: 'veto', a: k, side: s2, up: lastTop && lastTop.up, of: lastTop && lastTop.of, reg: regime });
              return;
            }
          }
          qOpen(k, s2, 1, i, { n: c.n, ref: c.mode === 'brk' ? (s2 > 0 ? fuMax(D2.h, i - c.n, i - 1) : fuMin(D2.l, i - c.n, i - 1)) : null, chg1: (D2.c[i] / D2.c[i - 1] - 1) * 100, fng: mkFng(i), up: lastTop && lastTop.up, of: lastTop && lastTop.of });
        });
      }
    }
    const v = L.value(px);
    eq.push({ i, v });
    invested += v > 0 ? (v - L.cash) / v : 0;
    if (v <= 1e-6) {
      for (let z = i + 1; z <= endI; z++) eq.push({ i: z, v: 0 });
      break;
    }
  }
  ev = ev.filter((e) => !e._pend && !e._drop);
  cur = endI;
  const r = mkStatsOf(eq, L, { startI, endI }, startI, endI, invested);
  const tv = L.value(px);
  r.events = ev;
  r.fut = 1;
  r.liqN = L.liq;
  r.fundPaid = L.fund + L.pos.reduce((a, p) => a + p.fund, 0);
  r.feesPaid = L.fees;
  const openList = L.pos.map((p) => {
    const v2 = px(p.k);
    return { held: endI - p.ei, k: p.k, tid: p.id, side: p.side, lev: p.lev, entry: p.ei, ep: p.ep, units: p.side * p.units, cost: p.cost, px: v2, chg: p.side * (v2 / p.ep - 1) * 100, pnl: (Math.max(0, L.eqOf(p, v2)) / p.cost - 1) * 100, liq: L.liqPx(p), w: tv > 0 ? Math.max(0, L.eqOf(p, v2)) / tv : 0, fut: 1 };
  });
  r.state = { asOf: endI, fut: 1, cash: tv > 0 ? L.cash / tv : 1, pickL, pickS, regime, top: lastTop, open: c.kind === 'agent' ? openList : openList[0] || null };
  return r;
}

/** mkRunCfg(c,startI): 카탈로그 한 줄을 그 판단 방식의 실행기로 돌린다 */
export function mkRunCfg(c: CatCfg, startI?: number | null): RunResult {
  const st = startI != null ? startI : c.startI;
  if (c.fut) {
    const f: Record<string, unknown> = {};
    for (const k in c) f[k] = (c as Record<string, unknown>)[k];
    if (c.uni) f.uni = MK_UNI[c.uni].list;
    f.startI = st;
    return mkFutRun(f as Omit<Partial<CatCfg>, 'uni'> & { uni?: string[] });
  }
  if (c.kind === 'agent') return mkAgentRun({ uni: MK_UNI[c.uni as string].list, look: c.look as number, top: c.top as number, gate: c.gate as number, every: c.every as number, trail: c.trail as number, volT: c.volT as number, minS: c.minS as number, startI: st });
  if (c.kind === 'mix') return mkHybridRun({ uni: MK_UNI[c.uni as string].list, every: c.every, look: c.look, rsiTh: c.rsiTh as number, tp: c.tp, sl: c.sl as number, gate: c.gate, startI: st });
  return mkRuleRun({ asset: c.asset, rsiTh: c.rsiTh as number, tp: c.tp, sl: c.sl as number, tf: !!c.tf, fng: c.fng, startI: st });
}
