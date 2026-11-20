// 전략 복사 계정의 원장 (원본 cpCalc 와 그 둘레: cpCfg, cpHash, cpMeta, cpxTrades).
// 화면이 없다. 넣고 뺀 돈(ledger)과 원본 전략의 자산 곡선만으로 내 계좌를 다시 계산한다.
import { mkPx } from './engine/data';
import { tfSSFind } from './engine/catalog';
import type { Strat, Trade } from './engine/types';

/** 예산을 넣거나 뺀 기록 한 줄. i 는 그때의 봉 */
export type LedgerRow = { at: number; type: 'add' | 'out'; amt: number; i: number | null };
/** 복사 한 건 (원본 cp.copies 의 원소) */
export type Copy = {
  id: string;
  nick: string;
  mode: string;
  amount: number;
  pairs: string[];
  gen?: { asof: number[]; len: number };
  /** 데모: 시작을 30봉 전으로 본다 */
  simStartI: number | null;
  adv: { marginMode: string; lev: string; slip: string; maxMarginPct: number; maxPosX: number; maxLoss: number; existing: string };
  at: number;
  status: string;
  ledger: LedgerRow[];
  /* 새 진입 멈춤 */
  winding?: boolean;
  windAt?: number;
  stopMode?: string;
  stopI?: number | null;
  /* 포지션만 정리 */
  flats?: number[];
  flatI?: number | null;
  /* 복사 끝 */
  endI?: number | null;
  closedAt?: number;
  settle?: { net: number; share: number; back: number };
};

/** cpCfg(): TFC.copytrade (teth-copy.js) */
export const CP_CFG = { PROFIT_SHARE: 0, COPIER_CAP: 500, LOSS_GUARD: -0.2, MIN_COPY_USDT: 50 };

/** cpHash(str) */
export function cpHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

/** cpMeta(nick): 이름에서 정해지는 전략 둘레 값 */
export function cpMeta(nick: string) {
  const h = cpHash(nick);
  const aum = 25000 + (h % 90) * 1000;
  return {
    nick,
    days: 34 + (h % 420),
    share: CP_CFG.PROFIT_SHARE != null ? CP_CFG.PROFIT_SHARE : 0.1,
    copiers: 3 + (h % 97),
    cap: CP_CFG.COPIER_CAP || 500,
    aum,
    total: Math.round(aum * 1.6) + (h % 7000),
    lastTradeMin: 5 + (h % 700),
    bio: ['원칙대로만 삽니다. 손절은 기계처럼.', '추세가 확인되기 전에는 움직이지 않습니다.', '하락장에서 살아남는 것이 첫 번째 목표입니다.', '복리는 지루함을 견딘 사람의 몫입니다.'][h % 4],
  };
}

/** 봉 b 까지 재생한 내 계좌 */
export type CpAt = { units: number; cb: number; waiting: number; cbw: number; invested: number; value: number; dep: number; wd: number; pnl: number; cost: number };
export type CpCalc = {
  inv: number;
  grossIn: number;
  pnlPct: number;
  myPct: number;
  total: number;
  realized: number;
  unreal: number;
  share: number;
  net: number;
  est: number;
  avail: number;
  value: number;
  invested: number;
  waiting: number;
  units: number;
  posOpen: boolean;
  missing?: boolean;
  closedN: number;
  immediate: boolean;
  entriesYear: number;
  lots: { i: number | null; inv: number | null }[];
  at: (b: number) => Pick<CpAt, 'invested' | 'waiting' | 'value' | 'pnl'> & Partial<CpAt>;
  stopI?: number | null;
  windEnd?: number | null;
  endBar?: number | null;
};

type OpenPos = { k: string; entry?: number | null; units?: number | null; fut?: number; w?: number; side?: number; lev?: number; ep?: number; px?: number; chg?: number; pnl?: number };
/** 원본 상태의 열린 포지션을 늘 배열로 (AI 판단은 배열, 규칙은 하나) */
export function openList(s: Strat | null): OpenPos[] {
  const op = s && s.r && s.r.state ? s.r.state.open : null;
  return op ? (op.length != null ? op : [op]) : [];
}

/** cpCalc(c2): 복사 한 건의 지금 값 */
export function cpCalc(c2: Copy): CpCalc {
  const s2 = tfSSFind(c2.nick);
  const m = s2 ? cpMeta(c2.nick) : null;
  const led = c2.ledger || [];
  const inv = led.reduce((a, e) => a + (e.type === 'add' ? e.amt : -e.amt), 0);
  const grossIn = led.reduce((a, e) => a + (e.type === 'add' ? e.amt : 0), 0);
  const none: CpCalc = { inv, grossIn, pnlPct: 0, myPct: 0, total: 0, realized: 0, unreal: 0, share: 0, net: 0, est: inv, avail: inv, value: inv, invested: 0, waiting: inv, units: 0, posOpen: false, missing: !s2, closedN: 0, immediate: false, entriesYear: 0, lots: led.map((e) => ({ i: e.i, inv: null })), at: () => ({ invested: 0, waiting: inv, value: inv, pnl: 0 }) };
  if (!s2 || !s2.r.eq || s2.r.eq.length < 32) return none;
  const eq = s2.r.eq;
  const last = eq[eq.length - 1];
  const st = s2.r.state || {};
  const T = last.i;
  const trades: Trade[] = s2.r.trades || [];
  const startI = c2.simStartI != null ? c2.simStartI : eq[eq.length - 31].i;
  /* 끝 봉(endBar): 전략 복사를 끝낸 봉. 수동 정리 봉(manI): 복사한 전략에 포지션만 정리한 봉, 다음 진입부터 다시 들어간다.
     멈춘 봉(stopI): 새 진입을 멈춘 봉. 그때 들고 있던 포지션이 모두 끝나는 봉(windEnd)까지만 따라간다 */
  const endBar = c2.endI != null ? c2.endI : c2.status === 'closed' && c2.flatI != null ? c2.flatI : null;
  const manI = c2.flatI != null && !(c2.endI == null && c2.status === 'closed') ? c2.flatI : null;
  const mans = (c2.flats && c2.flats.length ? c2.flats.slice() : manI != null ? [manI] : []).sort((a, b) => a - b); /* 수동 정리는 여러 번일 수 있다 */
  const stopI = (c2.winding && c2.status === 'active') || c2.stopI != null ? (c2.stopI != null ? c2.stopI : T) : null;
  /* 봉 i의 기준가(그 봉 이전의 마지막 값) */
  const navAt = (i: number) => {
    let v: number | null = null;
    for (let k = 0; k < eq.length; k++) {
      if (eq[k].i > i) break;
      v = eq[k].v;
    }
    return v != null ? v : eq[0].v;
  };
  const immediate = s2.kind === 'agent' || !!(c2.adv && c2.adv.existing === 'copy');
  /* 진입 봉: 끝난 거래의 진입과 지금 열린 포지션의 진입 */
  const opL = openList(s2);
  let entries: number[] = trades.map((x) => x.entry);
  opL.forEach((o) => {
    if (o && o.entry != null) entries.push(o.entry);
  });
  entries = entries.filter((i) => i != null).sort((a, b) => a - b);
  let windEnd: number | null = null;
  if (stopI != null) {
    const held = trades.filter((x) => x.entry <= stopI && x.exit != null && x.exit > stopI);
    const stillOpen = opL.some((o) => o && o.entry != null && o.entry <= stopI);
    windEnd = stillOpen ? null : held.length ? Math.max(...held.map((x) => x.exit)) : stopI;
  }
  /* 멈춘 뒤의 기준가: 멈춘 봉의 기준가에, 그때 들고 있던 종목의 값 변화만 더한다. 원본이 그 뒤에 새로 산 종목은 넣지 않는다 */
  let frozen: ((i: number) => number) | null = null;
  if (stopI != null) {
    type Held = { k: string; u: number; exit: number | null; got: number | null; fut?: number; xp?: number };
    const hp: Held[] = trades.filter((x) => x.entry <= stopI && x.exit != null && x.exit > stopI && x.units != null).map((x) => ({ k: x.asset as string, u: x.units as number, exit: x.exit, got: x.got as number, fut: x.fut, xp: x.xp }));
    opL.forEach((o) => {
      if (o && o.entry != null && o.entry <= stopI && o.units != null) hp.push({ k: o.k, u: o.units, exit: null, got: null, fut: o.fut });
    });
    const n0 = navAt(stopI);
    const pxs: Record<string, number[]> = {};
    hp.forEach((h) => {
      if (!pxs[h.k]) pxs[h.k] = mkPx(h.k);
    });
    frozen = (i) => {
      let v = n0;
      const b = Math.min(i, T);
      hp.forEach((h) => {
        const P = pxs[h.k];
        const a = h.u * P[stopI];
        v += h.fut ? h.u * ((h.exit != null && b >= h.exit ? (h.xp as number) : P[b]) - P[stopI]) : (h.exit != null && b >= h.exit ? (h.got as number) : h.u * P[b]) - a;
      });
      return v;
    };
  }
  const navF = (i: number) => (frozen && stopI != null && i > stopI ? frozen(i) : navAt(i));
  const investAt = (i: number): number | null => {
    if ((endBar != null && i >= endBar) || (stopI != null && i > stopI)) return null;
    /* 수동 정리 뒤 아직 원본이 새로 진입하지 않은 동안(현금 상태)의 입금은 다음 진입부터. 그 밖에는 판단 방식대로 */
    const inCash = mans.some((mm) => {
      if (mm > i) return false;
      for (let k = 0; k < entries.length; k++) if (entries[k] > mm) return entries[k] > i;
      return true;
    });
    if (immediate && !inCash) return i;
    for (let k = 0; k < entries.length; k++) if (inCash ? entries[k] > i : entries[k] >= i) return entries[k];
    return null;
  };
  const ev = led.map((e, idx) => {
    const i = e.i != null ? e.i : idx === 0 ? startI : T;
    return { type: e.type, amt: e.amt, i, inv: e.type === 'add' ? investAt(i) : null, idx };
  });
  /* 봉 b까지 원장을 재생한 내 계좌: 좌수(u)와 그 매입 원금(cb), 대기 현금(w)과 그 원금(cbw) */
  const stateAt = (b: number): CpAt => {
    let u = 0;
    let cb = 0;
    let w = 0;
    let cbw = 0;
    let dep = 0;
    let wd = 0;
    let pend: { amt: number; cost?: number; inv: number | null }[] = [];
    let dead = false;
    const nextEntry = (x: number) => {
      for (let k = 0; k < entries.length; k++) if (entries[k] > x) return entries[k];
      return null;
    };
    const conv = (x: number) => {
      if (dead) return;
      pend = pend.filter((p) => {
        if (p.inv != null && p.inv <= x && (stopI == null || p.inv <= stopI)) {
          const c0 = p.cost != null ? p.cost : p.amt;
          u += p.amt / navF(p.inv);
          cb += c0;
          w -= p.amt;
          cbw -= c0;
          return false;
        }
        return true;
      });
    };
    /* 정리: 좌수를 그 봉의 기준가로 현금으로 바꾼다. 수동 정리(re)는 그 돈을 다음 진입의 대기금으로 두고 매입 원금도 이어 간다 */
    const doFlat = (x: number, re: boolean) => {
      if (u > 1e-12) {
        const P = u * navF(x);
        w += P;
        cbw += cb;
        if (re) pend.push({ amt: P, cost: cb, inv: nextEntry(x) });
        u = 0;
        cb = 0;
      }
      if (!re) dead = true;
    };
    const flats: { i: number; re: boolean }[] = [];
    mans.forEach((mm) => {
      flats.push({ i: mm, re: true });
    });
    if (windEnd != null) flats.push({ i: windEnd, re: false });
    if (endBar != null) flats.push({ i: endBar, re: false });
    const bars: number[] = [];
    ev.forEach((e) => {
      if (e.i <= b && bars.indexOf(e.i) < 0) bars.push(e.i);
    });
    flats.forEach((f) => {
      if (f.i <= b && bars.indexOf(f.i) < 0) bars.push(f.i);
    });
    bars.sort((a, b2) => a - b2);
    bars.forEach((x) => {
      ev.forEach((e) => {
        if (e.i === x && e.type === 'add') {
          dep += e.amt;
          w += e.amt;
          cbw += e.amt;
          pend.push({ amt: e.amt, inv: e.inv });
        }
      });
      conv(x);
      flats.forEach((f) => {
        if (f.i === x) doFlat(x, f.re);
      });
      ev.forEach((e) => {
        if (e.i === x && e.type !== 'add') {
          let r = e.amt;
          wd += e.amt;
          const fw = Math.min(r, Math.max(0, w)); /* 대기 현금부터 뺀다 */
          if (fw > 0) {
            const k2 = (w - fw) / w;
            cbw *= k2;
            pend.forEach((p) => {
              p.amt *= k2;
              if (p.cost != null) p.cost *= k2;
            });
            w -= fw;
            r -= fw;
          }
          if (r > 1e-9 && u > 1e-12) {
            const nv = navF(x);
            const sold = Math.min(u, r / nv);
            cb -= cb * (sold / u);
            u -= sold;
          } /* 나머지는 좌수를 판다. 평균 매입 원금도 같은 비율로 줄인다 */
        }
      });
    });
    conv(b);
    const nv2 = navF(b);
    const invested = u * nv2;
    const value = invested + w;
    return { units: u, cb, waiting: w, cbw, invested, value, dep, wd, pnl: value + wd - dep, cost: cb + cbw };
  };
  const S = stateAt(T);
  const total = S.pnl;
  const endI = endBar != null ? endBar : windEnd != null ? windEnd : T;
  const pnlPct = navAt(endI) / navAt(startI) - 1; /* 같은 기간 전략 수익률: 넣고 뺀 돈과 무관 */
  const myPct = S.cost > 1e-9 ? S.value / S.cost - 1 : 0; /* 내 수익률: 평균 매입 기준가 대비 */
  const closed = trades.filter((x) => {
    const e = x.exit != null ? x.exit : x.entry;
    return e >= startI && e <= T;
  });
  const exits = closed.map((x) => (x.exit != null ? x.exit : x.entry)).sort((a, b) => a - b);
  /* 실현 = 마지막 청산 봉까지의 손익. 미실현 = 그 뒤의 변화 (같은 척도라 가상 포지션이 생기지 않는다) */
  let realized = exits.length ? stateAt(exits[exits.length - 1]).pnl : 0;
  let hwm = 0;
  exits.forEach((x) => {
    const p = stateAt(x).pnl;
    if (p > hwm) hwm = p;
  }); /* 분배는 실현 손익의 최고점을 넘긴 부분에만 (이중 부과 방지) */
  if (endBar != null || windEnd != null) {
    realized = total;
    if (total > hwm) hwm = total;
  } else if (mans.length) {
    mans.forEach((mm) => {
      const pm = stateAt(mm).pnl;
      if (pm > hwm) hwm = pm;
    });
    const lm = mans[mans.length - 1];
    if (!exits.length || exits[exits.length - 1] < lm) realized = stateAt(lm).pnl;
  } /* 수동 정리도 손익을 확정한다 */
  const unreal = total - realized;
  const share = Math.max(0, hwm) * (m ? m.share : 0.1);
  const net = total - share;
  const hasOpen = s2.kind === 'agent' ? !!(st.open && st.open.length) : !!st.open;
  const posOpen = endBar == null && windEnd == null && S.units > 1e-9 && hasOpen;
  const cashRatio = s2.kind === 'agent' ? (st.cash != null ? st.cash : 1) : st.open ? 0 : 1;
  const est = S.value - share;
  const avail = Math.max(0, S.waiting + S.invested * (endBar != null ? 1 : cashRatio) - share);
  const lots: { i: number | null; inv: number | null }[] = [];
  ev.forEach((e) => {
    lots[e.idx] = { i: e.i, inv: e.inv };
  });
  return { inv, grossIn, pnlPct, myPct, total, realized, unreal, share, net, est, avail, value: S.value, invested: S.invested, waiting: S.waiting, units: S.units, posOpen, closedN: closed.length, immediate, entriesYear: entries.filter((i) => i > T - 365).length, lots, at: stateAt, stopI, windEnd, endBar };
}

/** cpxTrades(c2,d): 내가 참여한 끝난 거래(새것부터) */
export function cpxTrades(c2: Copy, d: CpCalc): { x: Trade; inv: number; pnl: number }[] {
  const s2 = tfSSFind(c2.nick);
  if (!s2) return [];
  const startI = c2.simStartI != null ? c2.simStartI : 0;
  const endI = c2.endI != null ? c2.endI : c2.status === 'closed' && c2.flatI != null ? c2.flatI : 1e15;
  return (s2.r.trades || [])
    .filter((x) => {
      const e = x.exit != null ? x.exit : x.entry;
      return e >= startI && e <= endI;
    })
    .map((x) => {
      const inv = d.at(x.entry).invested * (x.w != null ? x.w : 1);
      return { x, inv, pnl: x.pnl * inv };
    })
    .filter((r) => r.inv > 0.005)
    .reverse();
}
