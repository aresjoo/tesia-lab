// 판단 기록의 글 만들기 (원본 mkChat*, fuChat*, mkRules, fuRules, mkSay). 화면 없이 글자와 순서만 낸다.
// 미리 써 둔 글(MK_VOICE)이 있으면 그 글이 이긴다. 없는 줄은 여기서 만든 문장을 쓴다.
import { FU_WHY, FU_WHY_P, MK_VOICE, MK_WHY_P } from '../share.data';
import { fuIs, mkUni } from './catalog';
import { MK_CRYPTO } from './catalog.data';
import { MK_ASOF, PRICE0, idxToDate, mkPx } from './data';
import { mkJ, mkMD, mkPct0, mkPxFmt, mkPxU, mkTk } from './format';
import type { CatCfg, Ev, RunResult, Strat } from './types';

type Cfg = Required<CatCfg>;
type Rules = Record<string, string>;
/** 판단 기록 한 줄 */
export type ChatMsg = { i: number; k: string; tag: string; t: string; ts: string; a?: string; cnt?: number; from?: number };

/** mkPolite(x): 「한다.」 말투를 「합니다.」로 */
export function mkPolite(x: string | null | undefined): string {
  return String(x || '').replace(/(.)(.)다\.(?=\s|$)/g, (_m, a: string, b: string) => {
    const cb = b.charCodeAt(0);
    const han = cb >= 0xac00 && cb <= 0xd7a3;
    const j = han ? (cb - 0xac00) % 28 : -1;
    if (b === '이') return a + '입니다.';
    if (b === '하') return a + '합니다.';
    if (b === '는') return a + '습니다.';
    if (j === 20 || j === 18) return a + b + '습니다.';
    if (j === 4) return a + String.fromCharCode(cb - 4 + 17) + '니다.';
    return a + b + '입니다.';
  });
}

/** mkSay(core,opt,R): 꼭 넣을 문장 뒤에, 길이가 남는 만큼 덧붙일 문장을 차례로 붙인다 */
export function mkSay(core0: (string | null | undefined)[], opt0: (string | null | undefined)[], R: Rules | null): string {
  const core = core0.map(mkPolite);
  const opt = opt0.map(mkPolite);
  let t = core.filter(Boolean).join(' ');
  const all = opt.slice();
  if (R) for (const k in R) all.push(mkPolite(R[k]));
  for (let i = 0; i < all.length && t.length < 205; i++) {
    const x = all[i];
    if (!x || t.indexOf(x) >= 0) continue;
    if (t.length + 1 + x.length > 300) continue;
    t += ' ' + x;
  }
  return t;
}

/** mkWords(s): 현물과 선물에서 쓰는 낱말 */
export function mkWords(s: Strat): { inst: string; tagIn: string; tagOut: string; buy: string; sell: string; hold: string } {
  const c = s.cfg || ({} as CatCfg);
  const fut = c.inst === 'futures';
  const sh = c.dir === 'short';
  if (c.fut) return { inst: '선물', tagIn: '선물 진입', tagOut: '선물 청산', buy: '진입', sell: '청산', hold: '포지션 유지' };
  if (!fut) return { inst: '현물', tagIn: '현물 매수', tagOut: '현물 매도', buy: '매수', sell: '매도', hold: '보유' };
  const d = sh ? '숏' : '롱';
  return { inst: '선물', tagIn: '선물 ' + d + ' 진입', tagOut: '선물 ' + d + ' 청산', buy: d + ' 진입', sell: d + ' 청산', hold: d + ' 포지션 유지' };
}

/** mkInst(a): 자산의 상품 종류 */
export function mkInst(a: string): string {
  return MK_CRYPTO[a] ? '현물' : a === '나스닥' || a === 'S&P 500' ? '토큰화 지수' : a === '금' ? '토큰화 금' : '토큰화 주식';
}
/** mkTagIO(s,a,out) */
export function mkTagIO(s: Strat, a: string, out: number): string {
  const W = mkWords(s);
  return W.inst === '선물' ? (out ? W.tagOut : W.tagIn) : mkInst(a) + (out ? ' 매도' : ' 매수');
}
const mkList = (a: string[]) => a.join(', ');
/** mkDepthN(th) */
const mkDepthN = (th: number) => (th <= 32 ? '깊은' : th <= 44 ? '중간 폭의' : '얕은');
/** mkDipAt(a,i): 최근 20일 고점 대비 */
function mkDipAt(a: string, i: number): number {
  const P = mkPx(a);
  let hi = 0;
  for (let k = Math.max(0, i - 19); k <= i; k++) if (P[k] > hi) hi = P[k];
  return (P[i] / hi - 1) * 100;
}
/** mkDipTxt(a,i) */
function mkDipTxt(a: string, i: number): string {
  const d = mkDipAt(a, i);
  return d < -0.05 ? '진입 시점에 ' + mkJ(a, '은', '는') + ' 최근 20일 고점 대비 ' + Math.abs(d).toFixed(1) + '% 아래에 있었다.' : '';
}
/** mkDipNow(a) */
function mkDipNow(a: string): string {
  const d = mkDipAt(a, mkPx(a).length - 1);
  return d < -0.05 ? '현재 ' + mkJ(a, '은', '는') + ' 최근 20일 고점 대비 ' + Math.abs(d).toFixed(1) + '% 아래에 있다.' : '현재 ' + mkJ(a, '은', '는') + ' 최근 20일 고점에 있다.';
}
/** mkTopTxt(top) */
function mkTopTxt(top: { k: string; mom: number }[] | undefined): string {
  return (top || [])
    .slice(0, 2)
    .map((x) => x.k + ' ' + mkPct0(x.mom, 0))
    .join(', ');
}
/** mkHeldTxt(r,tid): 보유하는 동안의 최고와 최저 */
function mkHeldTxt(r: RunResult, tid: number | undefined): string {
  let tr: RunResult['trades'][number] | null = null;
  (r.trades || []).forEach((x) => {
    if (x.id === tid) tr = x;
  });
  if (!tr) return '';
  const t = tr as RunResult['trades'][number];
  const P = mkPx(t.asset);
  let hi = -1e9;
  let lo = 1e9;
  for (let i = t.entry; i <= t.exit; i++) {
    const v = (P[i] / (t.ep as number) - 1) * 100;
    if (v > hi) hi = v;
    if (v < lo) lo = v;
  }
  return '보유 ' + (t.exit - t.entry) + '일 동안 진입가 대비 최고 ' + mkPct0(Math.max(0, hi)) + ', 최저 ' + mkPct0(Math.min(0, lo)) + '였다.';
}

/** mkTS(s,i,a,salt): 판단 기록의 시각. 올해가 아니면 연도를 붙인다 */
export function mkTS(s: Strat, i: number, a: string | null | undefined, salt: number): string {
  const cr = a ? !!MK_CRYPTO[a] : s.mkt === 'crypto' || s.mkt === 'multi';
  const d = idxToDate(i);
  let h = 0;
  const k = String(s.id || s.nick) + '|' + i + '|' + (salt || 0);
  for (let x = 0; x < k.length; x++) h = (h * 31 + k.charCodeAt(x)) >>> 0;
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + (cr ? 1 : 0), cr ? 0 : 20, 0, 2 + (h % 47)));
  const now = new Date(Date.UTC(MK_ASOF[0], MK_ASOF[1] - 1, MK_ASOF[2], 20, 0, 0));
  const p = (n: number) => (n < 10 ? '0' : '') + n;
  return (t.getFullYear() !== now.getFullYear() ? t.getFullYear() + '/' : '') + p(t.getMonth() + 1) + '/' + p(t.getDate()) + ' ' + p(t.getHours()) + ':' + p(t.getMinutes()) + ':' + p(t.getSeconds());
}

/* ── 선물 ── */
/** fuSd(v) */
export const fuSd = (v: number) => (v > 0 ? '롱' : '숏');
/** fuOp(st): 열린 포지션 목록 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fuOp(st: Record<string, any> | undefined): any[] {
  const o = st && st.open;
  return !o ? [] : o.length != null ? o : [o];
}
/** fuNeed(c,n) */
function fuNeed(c: Cfg, n: number): { L: number; S: number } {
  return { L: Math.ceil(c.gate * n - 1e-9), S: Math.floor((1 - c.gate) * n + 1e-9) };
}
/** fuAiTxt(s) */
function fuAiTxt(s: Strat): string {
  const c = s.cfg as Cfg;
  const u = mkUni(s);
  const n = u.list.length;
  const q = fuNeed(c, n);
  const ev = c.every === 1 ? '매일' : c.every + '일마다';
  const cL = q.L >= n ? n + '종목이 모두 오름세면' : '오름세 종목이 ' + q.L + '개 이상이면';
  const cS = q.S <= 0 ? '하나도 오름세가 아니면' : '오름세 종목이 ' + q.S + '개 이하면';
  if (c.kind === 'agent') return ev + ' ' + n + '종목을 비교합니다. ' + cL + ' 가장 강한 ' + c.top + '종목을 롱, ' + cS + ' 가장 약한 ' + c.top + '종목을 숏' + (q.L - q.S > 1 ? ', 그 사이면 쉽니다' : '');
  return ev + ' 방향과 종목을 정합니다. ' + cL + ' 가장 강한 종목을 롱 후보로, ' + cS + ' 가장 약한 종목을 숏 후보로' + (q.L - q.S > 1 ? ', 그 사이면 후보를 비웁니다' : ' 고릅니다');
}
/** fuSig(c): 진입 신호 설명 */
function fuSig(c: Cfg): string {
  if (c.mode === 'brk') return '종가가 최근 ' + c.n + '일 최고가를 넘으면 롱, 최근 ' + c.n + '일 최저가 아래로 내려가면 숏';
  if (c.mode === 'ma') return c.fast + '일 평균 가격이 ' + c.slow + '일 평균을 위로 넘으면 롱, 아래로 내려가면 숏';
  if (c.mode === 'dip') return '최근 ' + c.n + '일 고점에서 ' + c.dip + '% 넘게 밀렸다가 반등하면 롱, 저점에서 ' + c.dip + '% 넘게 올랐다가 꺾이면 숏';
  if (c.mode === 'fg') return '공포 탐욕 지수가 ' + c.lo + ' 이하일 때 반등하면 롱, ' + c.hi + ' 이상일 때 꺾이면 숏';
  return '';
}
/** fuOuts(c): 청산 조건 목록 */
function fuOuts(c: Cfg): string[] {
  const o: string[] = [];
  if (c.kind !== 'agent') o.push('반대 방향 신호가 나오면 닫고 방향을 바꿉니다');
  if (c.exitN) o.push('종가가 반대쪽 ' + c.exitN + '일 기준선을 벗어나면 닫습니다');
  if (c.trail) o.push('가장 유리했던 종가에서 ' + c.trail + '% 되돌리면 닫습니다');
  if (c.sl) o.push('진입가에서 ' + c.sl + '% 불리하게 움직이면 닫습니다');
  if (c.tp) o.push('진입가에서 ' + c.tp + '% 유리하게 움직이면 닫습니다');
  if (c.hold) o.push('길어도 ' + c.hold + '일');
  return o;
}
/** fuRules(s) */
function fuRules(s: Strat): Rules {
  const c = s.cfg as Cfg;
  const u = mkUni(s);
  return {
    what: c.kind === 'rule' ? s.asset + ' 선물 한 종목을 롱과 숏 양방향으로 거래한다.' : c.kind === 'mix' ? '방향과 종목은 AI가, 진입과 청산 시점은 사전에 정한 차트 규칙이 맡는다. ' + u.label + ' 선물이 대상이다.' : mkJ(u.label, '을', '를') + ' 비교해 강한 종목은 롱, 약한 종목은 숏으로 잡는다.',
    buy: c.kind === 'agent' ? fuAiTxt(s) + '.' : fuSig(c) + ' 포지션에 진입한다. 체결은 신호 다음 날 시가다.',
    sell:
      fuOuts(c)
        .map((x) =>
          x
            .replace(/요$/, '')
            .replace(/닫아$/, '청산한다')
            .replace(/바꿔$/, '바꾼다'),
        )
        .join('. ') + '.',
    size: (c.lev > 1 ? '레버리지는 ' + c.lev + '배다. ' : '레버리지는 쓰지 않는다. ') + '손실은 포지션에 넣은 증거금으로 한정된다.',
    rest: '판단은 하루 한 번 UTC 0시 종가 기준으로 한다. 수수료와 펀딩비는 실제 값으로 반영한다.',
  };
}
/** fuEv(s,e): 선물 판단 한 건을 관찰, 결정, 실행으로 푼다 */
function fuEv(s: Strat, e: Ev): { k: string; obs: string; dec: string } {
  const c = s.cfg as Cfg;
  const tk = e.a ? mkTk(e.a) : '';
  const sd = e.side ? fuSd(e.side) : '';
  if (e.t === 'pick') return { k: 'pick', obs: e.of + '종 중 ' + e.up + '종이 오름세. ' + ((e.side as number) > 0 ? '가장 강한 건 ' + mkTopTxt(e.top) : '가장 약한 건 ' + mkTopTxt(e.bot)), dec: mkJ(tk, '을', '를') + ' ' + sd + ' 후보로 골랐습니다' };
  if (e.t === 'unpick') return { k: 'wait', obs: e.of + '종 중 ' + e.up + '종이 오름세. 방향이 애매함', dec: '후보를 비웠습니다' };
  if (e.t === 'veto') return { k: 'wait', obs: tk + ' ' + fuSd(e.side as number) + ' 신호 발생. 그런데 AI가 본 시장 방향과 달라요(' + e.of + '종 중 ' + e.up + '종 오름세)', dec: '진입을 보류했습니다' };
  if (e.t === 'skip') return { k: 'wait', obs: e.of + '종 중 ' + e.up + '종이 오름세', dec: e.why === 'gate' ? '방향이 애매해 쉬었습니다' : '조건에 맞는 종목이 없어 쉬었습니다' };
  if (e.t === 'hold') return { k: 'hold', obs: e.of + '종 중 ' + e.up + '종이 오름세. 가장 강한 건 ' + mkTopTxt(e.top), dec: '포지션을 바꾸지 않았습니다' };
  if (e.t === 'enter')
    return {
      k: 'buy',
      obs:
        c.kind === 'agent'
          ? e.of + '종 중 ' + e.up + '종이 오름세. ' + tk + '의 ' + c.look + '일 흐름 ' + mkPct0(e.mom, 0) + ', ' + ((e.side as number) > 0 ? '강한 쪽 ' : '약한 쪽 ') + e.rank + '위'
          : tk +
            ', ' +
            (c.mode === 'brk'
              ? '종가가 최근 ' + c.n + '일 ' + ((e.side as number) > 0 ? '최고가' : '최저가') + ' ' + mkPxFmt(e.ref) + '을(를) ' + ((e.side as number) > 0 ? '넘음' : '아래로 벗어남')
              : c.mode === 'ma'
                ? c.fast + '일 평균이 ' + c.slow + '일 평균을 ' + ((e.side as number) > 0 ? '위로' : '아래로') + ' 넘음'
                : '진입 조건 충족'),
      dec: sd + ' 진입 조건이 맞았습니다',
    };
  return { k: 'sell', obs: tk + ' ' + sd + ', 진입가 대비 가격 ' + mkPct0(((e.px as number) / e.ep - 1) * 100) + '. ' + (FU_WHY[e.why as string] || ''), dec: e.why === 'liq' ? '강제 청산됐습니다' : sd + ' 포지션을 닫았습니다' };
}
type Said = { k: string; tag: string; a?: string; t: string };
/** fuChatEv(s,e) */
function fuChatEv(s: Strat, e: Ev): Said {
  const R = fuRules(s);
  const x = fuEv(s, e);
  const sd = e.side ? fuSd(e.side) : '';
  const a = e.a as string;
  if (e.t === 'enter') return { k: 'buy', tag: '선물 ' + sd + ' 진입', a: e.a, t: mkSay([mkJ(a, '을', '를') + ' 체결가 ' + mkPxU(a, e.px as number) + '에 ' + sd + ' 진입했다.', x.obs + '.', R.size], [R.sell, R.what, R.rest], null) };
  if (e.t === 'exit') return { k: 'sell', tag: '선물 ' + sd + ' 청산', a: e.a, t: mkSay([e.a + '의 ' + sd + ' 포지션을 체결가 ' + mkPxU(a, e.px as number) + '에 청산했다.', (FU_WHY_P[e.why as string] || '') + '.', '실현 손익은 수수료와 펀딩비를 뺀 뒤 넣은 돈 기준 ' + mkPct0(e.pnl as number) + '다.'], [R.sell, R.size, R.what], null) };
  if (e.t === 'pick') return { k: 'pick', tag: sd + ' 후보 선정', a: e.a, t: mkSay([mkJ(a, '을', '를') + ' ' + sd + ' 후보로 선정했다.', x.obs + '.', '아직 진입하지는 않았다.'], [R.buy, R.sell, R.what], null) };
  return { k: x.k === 'hold' ? 'hold' : 'wait', tag: x.k === 'hold' ? '포지션 유지' : '관망', a: e.a, t: mkSay([x.dec.replace(/어요$/, '다') + '.', x.obs + '.'], [R.what, R.buy, R.sell], null) };
}
/** fuChatIntro(s) */
function fuChatIntro(s: Strat): string {
  const R = fuRules(s);
  return mkSay([R.what, R.buy, R.sell], [R.size, R.rest], null);
}
/** fuChatNow(s,r) */
function fuChatNow(s: Strat, r: RunResult): string {
  const R = fuRules(s);
  const op = fuOp(r.state);
  if (op.length) return mkSay(['현재 ' + op.map((o) => o.k + ' ' + fuSd(o.side)).join(', ') + ' 포지션을 보유 중이다.', '넣은 돈 기준 손익은 ' + op.map((o) => o.k + ' ' + mkPct0(o.pnl)).join(', ') + '다.', R.sell], [R.size, R.what, R.rest], null);
  return mkSay(['현재 포지션이 없다.', '진입 신호를 기다리는 중이다.', R.buy], [R.what, R.sell, R.size, R.rest], null);
}

/* ── 현물 ── */
/** mkRules(s,of): 전략의 규칙을 문장으로 */
function mkRules(s: Strat, of?: number): Rules {
  if (fuIs(s)) return fuRules(s);
  const c = (s.cfg || {}) as Cfg;
  const u = mkUni(s);
  const W = mkWords(s);
  const ev = c.every === 1 ? '매일' : c.every + '일마다';
  const n = of || u.list.length;
  const need = Math.ceil((c.gate || 0) * n);
  const sell = '진입 후 ' + c.tp + '% 이상 오르면 익절, ' + Math.abs(c.sl) + '% 이상 내리면 손절한다.';
  const cap = '둘 다 아니면 매수 후 25일이 지난 날 청산한다.';
  if (s.kind === 'agent')
    return {
      what: mkJ(u.label, '을', '를') + ' ' + ev + ' 비교해 모멘텀이 강하고 변동성이 낮은 종목을 최대 ' + c.top + '종목까지 분산 보유한다.',
      sell: '보유 종목이 진입 후 고점 대비 ' + c.trail + '% 하락하면 재평가를 기다리지 않고 당일 ' + W.sell + '한다. 추적 손절이다.',
      rest: '상승 추세 종목이 ' + n + '종 중 ' + need + '종 미만이면 시장 약세로 보고 신규 ' + W.buy + '를 하지 않는다.',
      size: '종목당 비중은 자산의 ' + Math.round(100 / c.top) + '%가 상한이고, 변동성이 큰 종목은 비중을 줄인다.',
      skip: '60일 이동평균 아래에 있는 종목은 상승률이 높아도 ' + W.buy + '하지 않는다.',
      swap: '재평가일에 모멘텀이 꺾였거나 순위가 ' + (c.top + 2) + '위 밖으로 밀린 종목은 ' + W.sell + '한다.',
    };
  if (s.kind === 'mix')
    return {
      what: '종목 선정은 AI가, 진입과 청산 시점은 사전에 정한 차트 규칙이 맡는다.',
      pick: 'AI는 ' + u.label + ' 중 60일 이동평균 위에 있고 최근 ' + c.look + '일 상승률이 가장 높은 종목 하나를 선정한다.',
      buy: '선정 종목이 되돌림 후 하루 0.5% 넘게 반등하는 날 ' + W.buy + '한다.',
      sell,
      cap,
      rest: c.gate ? '상승 추세 종목이 ' + n + '종 중 ' + need + '종 미만이면 조건이 충족돼도 AI가 진입을 보류한다.' : '',
      size: '진입 시 가용 자금 전액을 한 종목에 투입한다.',
      again: '미보유 상태에서는 ' + c.every + '일마다 종목을 다시 선정하고, 보유 중에는 교체하지 않는다.',
    };
  return {
    what: s.asset + ' 한 종목만 거래한다. ' + mkDepthN(c.rsiTh) + ' 되돌림 후 하루 0.5% 넘게 반등한 것을 확인하고 ' + W.buy + '한다.',
    sell,
    cap,
    rest: '판단은 하루 한 번 종가 기준으로 한다. 조건이 충족되지 않은 날은 주문을 내지 않는다.',
    size: '진입 시 가용 자금 전액을 투입한다.',
    tf: c.tf ? '20일과 60일 이동평균의 간격이 3% 이하로 추세가 불분명하면 진입하지 않는다.' : '',
  };
}
/** mkChatWait(q,tf,a): 진입을 기다리는 까닭 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mkChatWait(q: Record<string, any> | null | undefined, tf: unknown, a: string): string {
  if (!q) return '진입 조건 충족을 기다린다.';
  if (!q.rsiOk) return a + '의 되돌림이 아직 진입 기준에 못 미친다.';
  if (!q.bounceOk) return mkJ(a, '은', '는') + ' 충분히 되돌렸으나 반등이 확인되지 않았다. 전일 대비 ' + mkPct0(q.bounce) + '다.';
  if (tf && !q.trendOk) return '되돌림과 반등은 확인됐으나 추세가 불분명하다.';
  if (q.mktOk === false) return '진입 조건은 충족됐으나 ' + q.of + '종 중 ' + q.up + '종만 상승 추세여서 보류 중이다.';
  return '진입 조건 충족을 기다린다.';
}
/** mkChatEv(s,e): 판단 한 건을 글로 */
export function mkChatEv(s: Strat, e: Ev): Said {
  if (fuIs(s)) return fuChatEv(s, e);
  const c = (s.cfg || {}) as Cfg;
  const R = mkRules(s, e.of);
  const W = mkWords(s);
  const a = e.a as string;
  const held = () => (e.held && e.held.length ? mkJ(mkList(e.held), '은', '는') + ' 계속 ' + W.hold + '한다.' : '');
  if (s.kind === 'agent') {
    if (e.t === 'enter') {
      const g: Record<string, string[]> = { held: [], below: [], weak: [] };
      (e.skip || []).forEach((x: { why: string; k: string }) => {
        g[x.why].push(x.k);
      });
      return {
        k: 'buy',
        tag: mkTagIO(s, a, 0),
        a: e.a,
        t: mkSay(
          [
            mkJ(a, '을', '를') + ' 신규 ' + W.buy + '했다.',
            e.of + '종 중 ' + e.up + '종이 상승 추세였고, ' + e.a + '의 최근 ' + c.look + '일 상승률은 ' + mkPct0(e.mom, 0) + '다.',
            g.below.length ? mkJ(mkList(g.below), '은', '는') + ' 순위가 더 높았으나 60일 이동평균 아래여서 제외했다.' : '',
            g.held.length ? mkJ(mkList(g.held), '은', '는') + ' 이미 보유 중이었다.' : '',
            '자산의 ' + Math.round(e.w * 100) + '%를 체결가 ' + mkPxU(a, e.px as number) + '에 투입했다.' + (e.cut ? ' 변동성이 커서 비중을 줄였다.' : ''),
          ],
          [R.sell, R.size, R.swap, R.what],
          R,
        ),
      };
    }
    if (e.t === 'exit')
      return {
        k: 'sell',
        tag: mkTagIO(s, a, 1),
        a: e.a,
        t: mkSay(
          [mkJ(a, '을', '를') + ' 체결가 ' + mkPxU(a, e.px as number) + '에 ' + W.sell + '했다.', MK_WHY_P[e.why as string] + '.', '실현 손익은 비용 차감 후 ' + mkPct0(e.pnl as number) + '다.'],
          [mkHeldTxt(s.r, e.tid), e.why === 'trail' ? R.sell : R.swap, (e.pnl as number) < 0 ? '손실로 끝나는 거래도 있다. 하락하는 종목을 오래 들고 있지 않기 위한 규칙이다.' : '', R.what, e.why === 'trail' ? R.swap : R.sell, R.rest],
          R,
        ),
      };
    if (e.t === 'skip' && e.why === 'gate') return { k: 'wait', tag: '관망', t: mkSay(['신규 ' + W.buy + '를 하지 않았다.', e.of + '종 중 ' + e.up + '종만 상승 추세여서 시장 약세로 판단했다.', held()], [R.rest, R.what, R.sell, R.skip], R) };
    if (e.t === 'skip') return { k: 'wait', tag: '관망', t: mkSay(['신규 ' + W.buy + '를 하지 않았다.', '기준을 넘는 종목이 없었다.' + ((e.top || []).length ? ' 순위 상위는 ' + mkTopTxt(e.top) + '였다. 순위는 상승률을 변동성으로 나눠 매긴다.' : ''), held()], [R.skip, R.what, R.size, R.sell], R) };
    return { k: 'hold', tag: '보유 유지', t: mkSay(['종목을 교체하지 않았다.', W.hold + ' 중인 ' + mkJ(mkList(e.held), '이', '가') + ' 여전히 상위권이다.', (e.top || []).length ? '순위 상위는 ' + mkTopTxt(e.top) + '다. 순위는 상승률을 변동성으로 나눠 매기므로 상승률 순서와 다를 수 있다.' : ''], [R.swap, R.sell, R.what, R.rest], R) };
  }
  if (e.t === 'pick')
    return {
      k: 'pick',
      tag: '종목 선정',
      a: e.a,
      t: mkSay(
        [
          mkJ(a, '을', '를') + ' 거래 대상으로 선정했다.',
          '최근 ' +
            c.look +
            '일 상승률이 가장 높았다.' +
            ((e.top || []).length
              ? ' 비교 결과는 ' +
                e.top
                  .slice(0, 3)
                  .map((x: { k: string; mom: number }) => x.k + ' ' + mkPct0(x.mom, 0))
                  .join(', ') +
                '였다.'
              : ''),
          '아직 ' + W.buy + '하지는 않았다.',
        ],
        [R.buy, R.rest, R.sell, R.cap, R.what],
        R,
      ),
    };
  if (e.t === 'unpick') return { k: 'wait', tag: '관망', t: mkSay(['거래 대상을 비웠다.', '60일 이동평균 위에 있는 종목이 없었다.'], [R.pick, R.again, R.what, R.buy, R.sell], R) };
  if (e.t === 'veto') return { k: 'wait', tag: '관망', a: e.a, t: mkSay([mkJ(a, '이', '가') + ' 되돌림 후 반등했으나 진입하지 않았다.', e.of + '종 중 ' + e.up + '종만 상승 추세여서 시장 약세로 판단했다.'], [R.rest, R.what, R.buy, R.sell], R) };
  if (e.t === 'enter') return { k: 'buy', tag: mkTagIO(s, a, 0), a: e.a, t: mkSay([mkJ(a, '을', '를') + ' 체결가 ' + mkPxU(a, e.px as number) + '에 ' + W.buy + '했다.', '되돌림 후 하루 만에 ' + mkPct0(e.bounce) + ' 반등해 진입 조건이 충족됐다.', R.size], [mkDipTxt(a, e.i), R.sell, R.cap, s.kind === 'mix' ? R.again : R.what, R.tf, R.rest], R) };
  return {
    k: 'sell',
    tag: mkTagIO(s, a, 1),
    a: e.a,
    t: mkSay(
      [mkJ(a, '을', '를') + ' 체결가 ' + mkPxU(a, e.px as number) + '에 ' + W.sell + '했다.', MK_WHY_P[e.why as string] + '.', '실현 손익은 비용 차감 후 ' + mkPct0(e.pnl as number) + '다.'],
      [
        mkHeldTxt(s.r, e.tid),
        e.why === 'time' ? '25일은 최대 보유 기간이다. 목표에 닿지 않아도 그날 청산한다.' : e.why === 'sl' ? Math.abs(c.sl) + '% 이상 하락하면 추가로 기다리지 않도록 정해 두었다.' : '익절 목표는 진입가 대비 +' + c.tp + '%다.',
        s.kind === 'mix' ? R.again : R.what,
        s.kind === 'mix' ? R.pick : R.rest,
        R.tf,
        R.buy,
      ],
      R,
    ),
  };
}
/** mkChatIntro(s): 전략 개요 */
export function mkChatIntro(s: Strat): string {
  if (fuIs(s)) return fuChatIntro(s);
  const R = mkRules(s);
  const u = mkUni(s);
  if (s.kind === 'agent') return mkSay([R.what, R.skip, R.size], [R.swap, R.sell, R.rest, '비교 대상은 ' + mkList(u.list) + '다.'], R);
  if (s.kind === 'mix') return mkSay([R.what, R.pick, R.buy], [R.sell, R.cap, R.rest, R.size, R.again], R);
  return mkSay([R.what, R.tf, R.sell], [R.cap, R.size, R.rest, '진입과 청산은 사전에 정한 규칙만 따르고 재량으로 바꾸지 않는다.'], R);
}
/** mkChatNow(s,r): 지금 상태 */
export function mkChatNow(s: Strat, r: RunResult): string {
  if (fuIs(s)) return fuChatNow(s, r);
  const st = r.state;
  const c = (s.cfg || {}) as Cfg;
  const W = mkWords(s);
  if (!st) return '';
  const R = mkRules(s, st.scan && st.scan.of);
  if (s.kind === 'agent') {
    if (st.open.length)
      return mkSay(
        [
          '현재 ' + mkList(st.open.map((o: { k: string }) => o.k)) + ' ' + W.hold + ' 중이다.',
          '진입 후 수익률은 ' + st.open.map((o: { k: string; chg: number }) => o.k + ' ' + mkPct0(o.chg)).join(', ') + '다.',
          '다음 재평가는 ' + mkMD(st.nextEval) + '이며 ' + st.scan.of + '종을 다시 비교한다.',
        ],
        [R.what, R.sell, R.swap, R.rest, R.size],
        R,
      );
    return mkSay(['현재 보유 종목이 없다.', st.scan.weak ? st.scan.of + '종 중 ' + st.scan.up + '종만 상승 추세여서 관망 중이다.' : '기준을 넘는 종목이 없어 관망 중이다.', '다음 재평가는 ' + mkMD(st.nextEval) + '이다.'], [R.what, R.rest, R.skip, R.size, R.sell], R);
  }
  if (st.open)
    return mkSay(
      [
        '현재 ' + st.open.k + ' ' + W.hold + ' 중이다.',
        mkMD(st.open.entry) + '에 ' + mkPxU(st.open.k, st.open.ep) + '에 ' + W.buy + '했고 현재 수익률은 ' + mkPct0(st.open.chg) + ', 매수 후 ' + st.open.held + '일이 지났다.',
        c.tp + '% 이상 오르면 익절, ' + Math.abs(c.sl) + '% 이상 내리면 손절한다.',
        '그 전에 청산되지 않으면 ' + Math.max(0, 25 - st.open.held) + '일 뒤 기간 만료로 청산한다.',
      ],
      [R.what, s.kind === 'mix' ? R.pick : R.rest, R.size, R.again, R.tf],
      R,
    );
  if (s.kind === 'mix') {
    if (!st.pick) return mkSay(['현재 선정 종목이 없어 관망 중이다.', '다음 종목 선정은 ' + mkMD(st.nextEval) + '이다.'], [R.what, R.pick, R.buy, R.sell, R.rest], R);
    return mkSay([mkJ(st.pick, '을', '를') + ' 선정해 두고 진입을 대기 중이다.', mkChatWait(st.cond, false, st.pick), '다음 확인은 다음 거래일 종가다.'], [mkDipNow(st.pick), R.buy, R.what, R.sell, R.rest, R.cap, R.again], R);
  }
  return mkSay(['현재 미보유, 진입 대기 중이다.', mkChatWait(st.cond, c.tf, s.asset), '다음 확인은 다음 거래일 종가다.'], [mkDipNow(s.asset), R.what, R.tf, R.sell, R.cap, R.size, R.rest], R);
}

/** mkChatMsgs(s,r,n): 지금 상태, 최근 판단 n건(같은 관망과 유지는 묶는다), 전략 개요 */
export function mkChatMsgs(s: Strat, r: RunResult, n?: number): ChatMsg[] {
  const out: ChatMsg[] = [];
  const ev = r.events || [];
  const end = PRICE0.length - 1;
  const now = mkChatNow(s, r);
  if (now) out.push({ i: end, k: 'now', tag: '현재 상태', t: now, ts: mkTS(s, end, null, 9) });
  for (let i = ev.length - 1; i >= 0 && out.length < (n || 6) + 1; i--) {
    const m = mkChatEv(s, ev[i]);
    const p = out[out.length - 1];
    if (p && p.k === m.k && (m.k === 'hold' || m.k === 'wait') && p.tag === m.tag && p.i - ev[i].i <= 40) {
      p.cnt = (p.cnt || 1) + 1;
      p.from = ev[i].i;
      continue;
    }
    out.push({ ...m, i: ev[i].i, ts: mkTS(s, ev[i].i, m.a, i) });
  }
  const i0 = s.cfg && s.cfg.startI != null ? s.cfg.startI : 0;
  out.push({ i: i0, k: 'intro', tag: '전략 개요', t: mkChatIntro(s), ts: mkTS(s, i0, null, 1) });
  /* 미리 써 둔 글이 있으면 그 글을 쓴다. 열쇠는 기록의 종류와 날짜 번호와 종목 */
  const V = MK_VOICE[s.id] || null;
  if (V)
    out.forEach((m) => {
      const key = m.k === 'now' ? 'now' : m.k === 'intro' ? 'intro' : 'e' + m.i + (m.a ? '_' + m.a : '') + '_' + m.k;
      if (V[key]) m.t = V[key];
    });
  return out;
}

/** mkChatTitle(s,m): 줄 제목 */
export function mkChatTitle(m: ChatMsg): string {
  const a = m.a ? mkTk(m.a) : '';
  const fut = /^선물 /.test(m.tag || '');
  const t = fut ? m.tag.replace(/^선물 /, '') : '';
  if (m.k === 'now') return '현재 판단';
  if (m.k === 'intro') return '전략 개요';
  if (m.k === 'buy') return a + ' ' + (fut ? t : '매수');
  if (m.k === 'sell') return a + ' ' + (fut ? t : '매도');
  if (m.k === 'pick') return a + (fut ? ' ' + t : ' 선정');
  if (m.k === 'hold') return '보유 유지';
  return a ? a + ' 관망' : '관망';
}
/** mkChatOut(m): 매도 줄의 손익 (제목 옆) */
export function mkChatOut(m: ChatMsg): string | null {
  if (m.k !== 'sell') return null;
  const x = /손익은[^+-]*([+-]\d[\d,]*(?:\.\d+)?%)/.exec(m.t || '');
  return x ? x[1] : null;
}
