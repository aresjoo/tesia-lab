// 전략 카탈로그: MK_CAT 을 엔진에 돌린 결과(시드), 찾기, 기간별 계산, 목록의 거르기와 정렬과 쪽 나누기.
import { MK_ALIAS, MK_CAT_RAW, MK_EX, MK_KIND, MK_TK, MK_UNI } from './catalog.data';
import { PRICE0 } from './data';
import { mkTk, skSym } from './format';
import { mkRunCfg } from './runs';
import type { CatCfg, EqPt, RunResult, Strat } from './types';

/** MK_CAT: 이름의 코인은 심볼로 적는다 (원본이 실행 중에 바꾼다) */
export const MK_CAT: CatCfg[] = MK_CAT_RAW.map((c) => ({ ...c, name: skSym(c.name) }));

/** TFC.score (teth-copy.js): TETH 점수 산식 */
const SCORE = { wWin: 0.3, wRet: 0.28, wMdd: 0.27, wVol: 0.15, winLo: 35, winHi: 60, retLo: 0, retHi: 6, mddLo: -25, mddHi: -6, volLo: 9, volHi: 4 };
/** tfScore(res) */
export function tfScore(res: RunResult): number {
  const c = SCORE;
  const nz = (v: number, lo: number, hi: number) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  let sc = nz(res.winRate, c.winLo, c.winHi) * c.wWin + nz(res.cagr, c.retLo, c.retHi) * c.wRet + nz(res.mdd, c.mddLo, c.mddHi) * c.wMdd + nz(res.tradeVol, c.volLo, c.volHi) * c.wVol;
  sc *= 100;
  if (res.n < 4) sc *= 0.65; /* 표본 부족 */
  if (res.n < 6) sc = Math.min(sc, 79);
  return Math.max(5, Math.min(99, Math.round(sc)));
}

let SEEDS: Strat[] | null = null;
/** tfRankSeeds(), tfSSRows(): 카탈로그 전체를 한 번 계산해 둔다 */
export function tfRankSeeds(): Strat[] {
  if (SEEDS) return SEEDS;
  SEEDS = MK_CAT.map((c, k) => {
    const r = mkRunCfg(c);
    return { id: c.id, ord: k + 1, kind: c.kind, mkt: c.mkt, nick: c.name, name: c.name, one: c.one, asset: c.kind === 'rule' ? (c.asset as string) : MK_UNI[c.uni as string].label, uni: c.uni || null, cfg: c, ex: c.ex, p: null, fw: c.fw, by: c.by || '', score: tfScore(r), ret: r.ret, mdd: r.mdd, n: r.n, r };
  });
  return SEEDS;
}

/** tfSSFind(nick): 전략 ID, 지금 이름, 옛 이름(별칭) 모두 같은 전략을 돌려준다 */
export function tfSSFind(nick: string): Strat | null {
  const rows = tfRankSeeds();
  const id = MK_ALIAS[nick] || null;
  for (let i = 0; i < rows.length; i++) if (rows[i].id === nick || rows[i].nick === nick || (id && rows[i].id === id)) return rows[i];
  return null;
}

/** mkDaily(eq,endI): 비는 날은 직전 값으로 채워 하루 단위로 만든다 */
export function mkDaily(eq: EqPt[] | null | undefined, endI?: number): EqPt[] {
  if (!eq || !eq.length) return [];
  const o: EqPt[] = [];
  let k = 0;
  const e = Math.max(endI || 0, eq[eq.length - 1].i);
  for (let i = eq[0].i; i <= e; i++) {
    while (k + 1 < eq.length && eq[k + 1].i <= i) k++;
    o.push({ i, v: eq[k].v });
  }
  return o;
}

/** mk30(s): 최근 30일 수익률과 곡선 */
export function mk30(s: Strat): { ret: number; eq: EqPt[] } {
  const r = s.r;
  const e = r.eq || [];
  let d = (e.length && e[e.length - 1].i - e[0].i === e.length - 1 ? e : mkDaily(e, PRICE0.length - 1)).slice(-31);
  const b0 = d.length ? d[0].v : 1;
  d = d.map((x) => ({ i: x.i, v: x.v / b0 }));
  return { ret: d.length > 1 ? (d[d.length - 1].v - 1) * 100 : 0, eq: d };
}

/** mkSlice(s,days): 전체 기간 결과에서 최근 며칠만 잘라 다시 기준 1 로 */
export function mkSlice(s: Strat, days: number): RunResult {
  const r = s.r;
  const end = PRICE0.length - 1;
  const d = mkDaily(r.eq || [], end);
  const src = d.slice(-(days + 1));
  if (src.length < 2) return r;
  const b = src[0].v;
  const eq = src.map((x) => ({ i: x.i, v: x.v / b }));
  let pk = eq[0].v;
  let mdd = 0;
  eq.forEach((x) => {
    if (x.v > pk) pk = x.v;
    const dd = (x.v / pk - 1) * 100;
    if (dd < mdd) mdd = dd;
  });
  const from = src[0].i;
  const tr = (r.trades || []).filter((t) => t.exit > from);
  const win = tr.filter((t) => t.pnl > 0).length;
  return { ...r, eq, ret: (eq[eq.length - 1].v - 1) * 100, mdd, trades: tr, n: tr.length, winRate: tr.length ? (win / tr.length) * 100 : 0, params: { startI: from, endI: end }, mddStartI: null, byYear: {} };
}

const MK_PDC: Record<string, RunResult> = {};
export type Pd = 'all' | '1y' | '2y' | '30d' | '7d';
export const MK_PD_OK: Record<string, 1> = { all: 1, '1y': 1, '30d': 1, '7d': 1, '2y': 1 };
/** tfSS3PdCalc(s,pd): 기간별 결과 */
export function tfSS3PdCalc(s: Strat, pd: string): RunResult {
  if (pd === 'all' || !s.cfg) return s.r;
  const key = s.id + '|' + pd;
  const end = PRICE0.length - 1;
  if (pd === '7d' || pd === '30d') {
    if (!MK_PDC[key]) MK_PDC[key] = mkSlice(s, pd === '7d' ? 7 : 30);
    return MK_PDC[key];
  }
  const days = pd === '1y' ? 365 : 730;
  if (!MK_PDC[key]) MK_PDC[key] = mkRunCfg(s.cfg, Math.max(s.cfg.startI || 61, end - days));
  return MK_PDC[key];
}

/** mkUni(s): 전략이 보는 종목 묶음 */
export function mkUni(s: { uni?: string | null; asset?: string }): { label: string; list: string[] } {
  return (s.uni && MK_UNI[s.uni]) || { label: s.asset || '', list: s.asset ? [s.asset] : [] };
}
/** mkScope(s) */
export function mkScope(s: Strat): string {
  return s.kind === 'rule' || !s.uni ? s.asset : mkUni(s).label;
}
/** mkEx(s): [로고 파일 이름, 거래소 이름] */
export function mkEx(s: { ex?: string }): [string, string] {
  if (s.ex) for (let q = 0; q < MK_EX.length; q++) if (MK_EX[q][0] === 'app-' + s.ex) return MK_EX[q];
  return MK_EX[0];
}
/** mkOldNames(id): 검색에 걸리게 옛 이름을 모은다 */
export function mkOldNames(id: string): string {
  if (!id) return '';
  const o: string[] = [];
  for (const k in MK_ALIAS) if (MK_ALIAS[k] === id) o.push(k);
  return o.join(' ');
}
/** fuIs(s): 선물 전략인가 */
export function fuIs(s: Strat | null | undefined): boolean {
  return !!(s && s.cfg && s.cfg.fut);
}
/** mkMin(s): 복사 최소 금액 */
export function mkMin(s: Strat): number {
  const c = s.cfg;
  if (c && c.kind === 'agent') return (c.top as number) >= 3 ? 500 : c.top === 2 ? 300 : 200;
  const sl = c && c.sl != null ? Math.abs(c.sl) : 5;
  return sl >= 8 ? 500 : sl >= 5 ? 200 : 100;
}

/* ── 목록 (tfSS3GridHtml 의 거르기, 정렬, 쪽 나누기) ── */
export type ListState = { sort: string; dir: string; kind: string; asset: string; page: number; pgSig?: string };
export const LIST_PER = 10;
export const LIST_MAXP = 10;
/** 승률 정렬에서 앞에 설 수 있는 최소 거래 수 */
export const MK_WIN_MIN = 20;

/** mkSortKey(t) */
export function mkSortKey(sort: string): string {
  return { pick: 1, ret: 1, fw: 1, win: 1 }[sort] ? sort : 'pick';
}

/**
 * 목록 한 쪽을 만든다. 필터와 검색이 없을 때는 카탈로그를 10쪽으로 반복한다(정렬은 반복 전에 끝낸다).
 * 돌려주는 page 는 조건이 바뀌었을 때 1 로 되돌린 값이다.
 */
export function listPage(st: ListState, q: string, myExIds: string[] = []): { rows: Strat[]; pages: number; page: number; pgSig: string; empty: boolean; myN: number } {
  let rows = tfRankSeeds().slice();
  const sort = mkSortKey(st.sort);
  if (st.asset && st.asset !== 'all') rows = rows.filter((s) => s.mkt === st.asset);
  if (st.kind && st.kind !== 'all') rows = rows.filter((s) => (s.kind || 'rule') === st.kind);
  if (q) {
    const ql = q.toLowerCase();
    rows = rows.filter(
      (s) =>
        [s.nick, s.asset, s.name, s.one || '', s.by ? '@' + s.by : '', s.id || '', mkOldNames(s.id), MK_KIND[s.kind] || '', mkUni(s).list.join(' '), mkUni(s).list.map(mkTk).join(' '), MK_TK[s.asset || ''] || s.asset || '']
          .join(' ')
          .toLowerCase()
          .indexOf(ql) >= 0,
    );
  }
  /* tfMyExFilter(rows): 「내 거래소」를 켜면 그 거래소에서 실행하는 전략만 (TF_MYEX_N 은 거른 뒤의 수) */
  if (myExIds.length)
    rows = rows.filter((s) => {
      /* 원본은 내가 공개한 전략(s.me)도 뺀다. 이 판의 목록에는 그런 전략이 없다 */
      const id = String(mkEx(s)[0] || '').replace(/^app-/, '');
      return myExIds.indexOf(id) >= 0;
    });
  const myN = rows.length;
  const f: Record<string, (a: Strat, b: Strat) => number> = {
    pick: (a, b) => (a.ord || 0) - (b.ord || 0),
    ret: (a, b) => mk30(b).ret - mk30(a).ret,
    fw: (a, b) => (b.fw || 0) - (a.fw || 0),
    win: (a, b) => (b.r.winRate || 0) - (a.r.winRate || 0),
  };
  rows.sort(f[sort]);
  if (st.dir === 'asc') rows.reverse();
  const pgSig = [st.asset, st.kind, q, sort, st.dir].join('|');
  if (!rows.length) return { rows: [], pages: 1, page: 1, pgSig, empty: true, myN };
  const plain = (!st.asset || st.asset === 'all') && (!st.kind || st.kind === 'all') && !q && !myExIds.length;
  if (plain) {
    const base = rows.slice();
    let all = rows.slice();
    for (let rp = 1; rp < LIST_MAXP && base.length; rp++) all = all.concat(base);
    rows = all;
  }
  rows = rows.slice(0, LIST_PER * LIST_MAXP);
  if (sort === 'win') {
    const few = (s: Strat) => ((s.r && s.r.n) || 0) < MK_WIN_MIN;
    rows = rows.filter((s) => !few(s)).concat(rows.filter(few));
  }
  let page = st.pgSig !== pgSig ? 1 : st.page || 1;
  const pages = Math.max(1, Math.ceil(rows.length / LIST_PER));
  page = Math.min(pages, Math.max(1, page));
  return { rows: rows.slice((page - 1) * LIST_PER, page * LIST_PER), pages, page, pgSig, empty: false, myN };
}

/** 판단 방식별 전략 수 (mk3Controls 의 cnt) */
export function kindCounts(): Record<string, number> {
  const cnt: Record<string, number> = { all: 0, agent: 0, rule: 0, mix: 0 };
  tfRankSeeds().forEach((s) => {
    cnt.all++;
    cnt[s.kind || 'rule']++;
  });
  return cnt;
}
