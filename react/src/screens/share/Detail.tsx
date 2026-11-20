// 전략 상세 (원본 tfSS3DetailRenderCore): 머리(mk3Head) > 탭(개요, 전략 정보) > 몸통.
// 개요(mkOvTab)는 성과 지표, 그래프, 달력, 판단 기록, 거래 내역 순서다. 글자는 원본의 sk-detail 층(skd.ts)을 거친 값이다.
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { legacy } from '../../core/config';
import { MK_CRYPTO, MK_KIND } from '../../core/engine/catalog.data';
import { MK_PD_OK, fuIs, mkDaily, mkEx, mkMin, mkScope, mkSlice, mkUni, tfSSFind } from '../../core/engine/catalog';
import { PRICE0, idxToDate } from '../../core/engine/data';
import { mkDate, mkPct, mkPct0, mkSign, mkdDate, tfSSNe } from '../../core/engine/format';
import type { EqPt, RunResult, Strat } from '../../core/engine/types';
import { CPP_PAIR, MK_PER_L, MK_TIP } from '../../core/share.data';
import { useWinWidth } from '../../state/hooks';
import { nav, replaceHash } from '../../state/route';
import { getShare, setSS, setShare, useShare } from '../../state/share';
import { authOpen, getState, toast, useApp } from '../../state/store';
import { ChatLog } from './ChatLog';
import { cpSetupGo } from './copyActions';
import { OrdersSec, TradesTab, tabKeep, takeOvKeep } from './Orders';
import { Glyph } from './parts';
import { skdLabel, skdText } from './skd';

const MK_TAB_OK: Record<string, 1> = { ov: 1, info: 1, trades: 1 };

/** mkdTerm(t,tip): 점선 밑줄 낱말과 풀이 말풍선 */
function Term({ t, tip }: { t: string; tip: string }) {
  return (
    <button type="button" className="mkd-term">
      {skdText(t)}
      <span className="mkd-tip" role="tooltip">
        {skdText(tip)}
      </span>
    </button>
  );
}

/** mkdSince(s) */
const mkdSince = (s: Strat) => (s.r.eq && s.r.eq.length ? mkDate(s.r.eq[0].i) : '-');
/** mkInst(a) */
const mkInst = (a: string) => (MK_CRYPTO[a] ? '현물' : a === '나스닥' || a === 'S&P 500' ? '토큰화 지수' : a === '금' ? '토큰화 금' : '토큰화 주식');
/** mkInstList(s), fuInst(s) */
function mkInstList(s: Strat): string[] {
  const c = s.cfg;
  if (fuIs(s) && c) return ['선물 롱/숏' + ((c.lev || 0) > 1 ? ' ' + c.lev + '배' : '')];
  const l = c && c.uni ? mkUni(s).list : [s.asset];
  const o: string[] = [];
  l.forEach((a) => {
    const k = mkInst(a);
    if (o.indexOf(k) < 0) o.push(k);
  });
  return o;
}

/* ── 즐겨찾기 ── */
/** 가입 창을 띄운 즐겨찾기 누름. 가입을 마치면 이어서 담는다 (MK_WATCH_RESUME) */
let WATCH_RESUME: string | null = null;
/** tfSS3WatchTgl(ne) */
function watchTgl(s: Strat) {
  if (!getState().user) {
    authOpen('signup');
    WATCH_RESUME = s.nick;
    return;
  }
  const w = getShare().watch;
  const i = w.indexOf(s.nick);
  if (i >= 0) {
    setShare({ watch: w.filter((x) => x !== s.nick) });
    toast('관심 전략에서 제외했습니다');
  } else {
    setShare({ watch: w.concat(s.nick) });
    toast('관심 전략에 추가했습니다. 전략 복사 화면에서 모아볼 수 있습니다');
  }
}
/** mkAuthHook(): 가입이 끝나면 눌렀던 즐겨찾기를 담는다. 가입 없이 창을 닫으면 잊는다 */
function useWatchResume() {
  const user = useApp((s) => s.user);
  const open = useApp((s) => s.auth.open);
  useEffect(() => {
    if (!WATCH_RESUME) return;
    if (user) {
      const nick = WATCH_RESUME;
      WATCH_RESUME = null;
      const t = setTimeout(() => {
        const w = getShare().watch;
        if (w.indexOf(nick) < 0) {
          setShare({ watch: w.concat(nick) });
          toast('관심 전략에 추가했습니다');
        }
      }, 400);
      return () => clearTimeout(t);
    }
    if (!open) WATCH_RESUME = null;
  }, [user, open]);
}
/** tfSS3CopyLink(ne,pd): 보고 있는 기간까지 담은 주소를 복사한다 */
function copyLink(ne: string, pd: string) {
  const url = window.location.origin + window.location.pathname + '#/share/s/' + ne + '/' + pd;
  try {
    navigator.clipboard.writeText(url).then(
      () => toast('전략 링크를 복사했습니다'),
      () => toast(url),
    );
  } catch {
    toast(url);
  }
}

/** mk3Head(s,ne,pd,watching) */
function Head({ s, ne, pd }: { s: Strat; ne: string; pd: string }) {
  const user = useApp((st) => st.user);
  const watch = useShare((st) => st.watch);
  const watching = !!user && watch.indexOf(s.nick) >= 0;
  const [menu, setMenu] = useState(false);
  const ex = mkEx(s);
  /* mkMenuTgl, mkMenuDoc: 어디든 누르면 닫힌다 */
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    const t = setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', close);
    };
  }, [menu]);
  return (
    <header className="mk-d-head mk3-dh">
      <div className="mk3-dh-top">
        <Glyph s={s} z={44} />
        <div className="mk3-dh-t">
          <h2>{s.name}</h2>
          <p>
            <b>{MK_KIND[s.kind] || '차트 규칙'}</b>
            <span>{skdText(mkScope(s))}</span>
            {s.by ? <span className="mk3-by">{skdText('@' + s.by + ' 등록')}</span> : null}
          </p>
        </div>
        <button type="button" className="mkd-ic" aria-label="링크 복사" onClick={() => copyLink(ne, pd)}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="6" cy="12" r="2.4" />
            <circle cx="18" cy="6" r="2.4" />
            <circle cx="18" cy="18" r="2.4" />
            <path d="M8 11l8-4M8 13l8 4" />
          </svg>
        </button>
        <button type="button" className="mkd-fav" aria-pressed={watching} onClick={() => watchTgl(s)}>
          {skdLabel('★ 즐겨찾기')}
        </button>
      </div>
      <p className="mk3-dh-one">{skdText(s.one || '')}</p>
      <div className="mk-d-acts mk3-dh-acts">
        <button type="button" className="mk-pri" onClick={() => cpSetupGo(s.id)}>
          전략 복사하기
        </button>
        {/* btOpen(ne): 백테스트 여정은 아직 원본으로 간다 */}
        <button
          type="button"
          className="mk3-bt2"
          aria-label="직접 검증하기, 백테스트"
          onClick={() => {
            if (!getState().user) authOpen('signup');
            else nav('#/share/bt/' + ne);
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 19V5" />
            <path d="M4 19h16" />
            <path d="M7.5 15l3.5-4 3 2.5 4.5-6" />
          </svg>
          <span>
            <b>직접 검증하기</b>
          </span>
        </button>
        <span className="mk3-dh-meta">
          <span className="mk-xtag">
            <img src={'assets/logos/' + ex[0] + '.png'} alt="" width={16} height={16} />
            <Term t={ex[1]} tip={MK_TIP.ex} />
          </span>
          <span>{skdText('최소 $' + mkMin(s))}</span>
          <span>{skdText(mkdSince(s) + ' 시작')}</span>
        </span>
        <div className="mk-more">
          <button
            type="button"
            className="mk-more-b"
            id="mk-menu-b"
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label="더 보기"
            onClick={(e) => {
              e.stopPropagation();
              setMenu(!menu);
            }}
          >
            ⋯
          </button>
          <div className="mk-menu" id="mk-menu" role="menu" hidden={!menu}>
            {/* tfSS3Ask(ne,pd): 대화 화면은 아직 원본에 있다 */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                if (!getState().user) authOpen('login');
                else window.location.href = legacy('#/share/s/' + ne + '/' + pd);
              }}
            >
              TETH에게 분석시키기
            </button>
            <button type="button" role="menuitem" id="ss3-watch-btn" aria-pressed={watching} onClick={() => watchTgl(s)}>
              {/* tfSS3WatchLb(on) */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill={watching ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" />
              </svg>
              관심
            </button>
            <button type="button" role="menuitem" onClick={() => copyLink(ne, pd)}>
              링크 복사
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ── 성과 그래프 ── */
type Mkd = { tab: 'ret' | 'pnl' | 'bal'; gran: 'day' | 'month'; per: number };
const TAB_L = { ret: '수익률', pnl: '수익금', bal: '잔고' };
/** mkChartW(): 좌표 폭을 화면 폭에 맞춘다 (글자 크기 유지) */
const mkChartW = (vw: number) => Math.round(Math.max(360, Math.min(1136, vw - (vw > 860 ? 304 : 40))) / 20) * 20;
/** mkdSeries() */
function mkdSeries(eq: EqPt[], m: Mkd): { d: string; y: number }[] {
  const src = m.per ? eq.slice(-m.per - 1) : eq.slice();
  if (src.length < 2) return [];
  const base = m.per ? src[0].v : 1;
  let pts = src;
  if (m.gran === 'month') {
    const seen: Record<string, EqPt> = {};
    const order: string[] = [];
    src.forEach((p) => {
      const k = mkdDate(p.i).slice(0, 7);
      if (!seen[k]) order.push(k);
      seen[k] = p;
    });
    pts = [src[0]].concat(order.map((k) => seen[k]).filter((p) => p !== src[0]));
  }
  return pts.map((p) => ({ d: mkdDate(p.i), y: m.tab === 'ret' ? (p.v / base - 1) * 100 : m.tab === 'pnl' ? 1000 * (p.v / base - 1) : (1000 * p.v) / base }));
}
/** mkdTicks(a,b,n): 최저와 최고가 같으면 위아래로 여유를 둔다 */
function mkdTicks(a: number, b: number, n: number): number[] {
  if (!(b - a > 1e-9 * Math.max(1, Math.abs(a)))) {
    const pd = Math.abs(a) >= 100 ? Math.max(10, Math.round(Math.abs(a) * 0.01)) : 1;
    return [a - pd, a, a + pd];
  }
  const span = b - a || 1;
  let st = Math.pow(10, Math.floor(Math.log10(span / n)));
  const e = span / n / st;
  st *= e < 1.5 ? 1 : e < 3 ? 2 : e < 7 ? 5 : 10;
  const lo = Math.floor(a / st) * st;
  const hi = Math.ceil(b / st) * st;
  const t: number[] = [];
  for (let v = lo; v <= hi + st / 2; v += st) t.push(+v.toFixed(6));
  return t;
}

/** mkdChartHtml(), mkdHover(ev) */
function Chart({ eq, m }: { eq: EqPt[]; m: Mkd }) {
  const vw = useWinWidth();
  const box = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const [hov, setHov] = useState<number | null>(null);
  const P = useMemo(() => mkdSeries(eq, m), [eq, m]);
  useEffect(() => setHov(null), [m]);
  const W = mkChartW(vw);
  const mob = W < 560;
  const H = mob ? 236 : 280;
  const pl = mob ? 46 : 54;
  const pr = 6;
  const pt = 24;
  const pb = 32;
  const X = (i: number) => pl + (i / Math.max(1, P.length - 1)) * (W - pl - pr);
  const base = m.tab === 'bal' ? 1000 : 0;
  const ys = P.map((p) => p.y);
  const T = P.length < 2 ? [0, 1] : mkdTicks(Math.min(...ys.concat(base)), Math.max(...ys.concat(base)), 5);
  const mn = T[0];
  const mx = T[T.length - 1];
  const Y = (v: number) => pt + (1 - (v - mn) / (mx - mn)) * (H - pt - pb);
  const A = P.map((p, i) => [X(i), Y(p.y)]);
  /* 손가락이나 마우스가 가리키는 날의 값을 띄운다 */
  useLayoutEffect(() => {
    const t = tip.current;
    const svg = box.current?.querySelector('svg');
    if (hov == null || !t || !svg || !A[hov]) return;
    const rc = svg.getBoundingClientRect();
    const a = A[hov];
    const tw = t.offsetWidth / 2 + 4;
    const px = Math.max(tw, Math.min(rc.width - tw, (a[0] / W) * rc.width));
    t.style.left = px.toFixed(1) + 'px';
    t.style.top = ((a[1] / H) * rc.height).toFixed(1) + 'px';
  });
  if (P.length < 2)
    return (
      <div className="mkd-chart" id="mkd-chart">
        <div className="mt2" style={{ padding: '40px 0', textAlign: 'center' }}>
          아직 그릴 기록이 없습니다
        </div>
      </div>
    );
  /* 하루 단위 값으로 본다 */
  const dsrc = m.per ? eq.slice(-m.per - 1) : eq;
  const flat = dsrc.length > 1 && dsrc.every((p) => Math.abs(p.v - dsrc[0].v) < 1e-12);
  const flatBase = flat && Math.abs(ys[0] - base) < 1e-9;
  const cl = (y: number) => Math.max(pt, Math.min(H - pb, y));
  let d = 'M' + A[0][0].toFixed(1) + ' ' + A[0][1].toFixed(1);
  for (let i = 0; i < A.length - 1; i++) {
    const p0 = A[Math.max(0, i - 1)];
    const p1 = A[i];
    const p2 = A[i + 1];
    const p3 = A[Math.min(A.length - 1, i + 2)];
    d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + cl(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + cl(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
  }
  const yb = Y(base);
  const area = d + ' L' + A[A.length - 1][0].toFixed(1) + ' ' + yb.toFixed(1) + ' L' + A[0][0].toFixed(1) + ' ' + yb.toFixed(1) + ' Z';
  const G = flatBase ? '#8b9096' : '#2fb98a';
  const R = flatBase ? '#8b9096' : '#f0566a';
  const dec = flat ? 0 : Math.abs(mx - mn) < 4 ? 2 : Math.abs(mx - mn) < 20 ? 1 : 0;
  const fmt = (v: number) => (m.tab === 'ret' ? (v > 0 ? '+' : '') + v.toFixed(dec) + '%' : Math.round(v).toLocaleString());
  let still = false;
  try {
    still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    /* 못 읽으면 움직임을 켠 채로 */
  }
  const nx = Math.min(mob ? 4 : 5, P.length);
  const long = m.gran === 'month' || !m.per || m.per > 200;
  const xl = [];
  for (let k = 0; k < nx; k++) {
    const ix = Math.round((k * (P.length - 1)) / (nx - 1 || 1));
    xl.push(
      <text key={'x' + k} x={X(ix).toFixed(1)} y={H - 8} textAnchor={k === 0 ? 'start' : k === nx - 1 ? 'end' : 'middle'} fontSize="11" fill="#8b9096">
        {long ? P[ix].d.slice(2, 7).replace('-', '.') : P[ix].d.slice(5).replace('-', '.')}
      </text>,
    );
  }
  const iMx = ys.indexOf(Math.max(...ys));
  const iMn = ys.indexOf(Math.min(...ys));
  const mark = (i: number, lb: string) => {
    const x = A[i][0];
    const y = A[i][1];
    let ty = lb === 'Max' ? y - 11 : y + 19;
    if (ty < 14) ty = y + 19;
    if (ty > H - pb - 4) ty = y - 11;
    const tx = Math.max(pl + 52, Math.min(W - pr - 52, x));
    return (
      <>
        <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="3.4" fill="#fff" />
        <text x={tx.toFixed(1)} y={ty.toFixed(1)} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">
          {skdText(lb + ' ' + (m.tab === 'ret' ? mkPct(P[i].y, 2) : '$' + Math.round(P[i].y).toLocaleString()))}
        </text>
      </>
    );
  };
  const move = (ev: PointerEvent) => {
    const svg = box.current?.querySelector('svg');
    if (!svg) return;
    const rc = svg.getBoundingClientRect();
    if (!rc.width) return;
    const x = ((ev.clientX - rc.left) / rc.width) * W;
    let bi = 0;
    let bd = 1e9;
    for (let i = 0; i < A.length; i++) {
      const dd = Math.abs(A[i][0] - x);
      if (dd < bd) {
        bd = dd;
        bi = i;
      }
    }
    setHov(bi);
  };
  const hp = hov != null ? P[hov] : null;
  const ha = hov != null ? A[hov] : null;
  return (
    <div className={'mkd-chart' + (hov != null ? ' hov' : '')} id="mkd-chart" ref={box} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHov(null)}>
      <svg key={m.tab + m.gran + m.per} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={TAB_L[m.tab] + ' 그래프'}>
        <defs>
          <linearGradient id="mkdgu" gradientUnits="userSpaceOnUse" x1="0" y1={pt} x2="0" y2={yb.toFixed(1)}>
            <stop offset="0" stopColor={G} stopOpacity=".30" />
            <stop offset="1" stopColor={G} stopOpacity=".02" />
          </linearGradient>
          <linearGradient id="mkdgd" gradientUnits="userSpaceOnUse" x1="0" y1={yb.toFixed(1)} x2="0" y2={H - pb}>
            <stop offset="0" stopColor={R} stopOpacity=".02" />
            <stop offset="1" stopColor={R} stopOpacity=".30" />
          </linearGradient>
          <clipPath id="mkdcu">
            <rect x="0" y="0" width={W} height={yb.toFixed(1)} />
          </clipPath>
          <clipPath id="mkdcd">
            <rect x="0" y={yb.toFixed(1)} width={W} height={(H - yb).toFixed(1)} />
          </clipPath>
          <clipPath id="mkdrv">
            <rect x="0" y="0" height={H} width={still ? W : 0}>
              {still ? null : <animate attributeName="width" from={pl} to={W} dur="0.9s" calcMode="spline" keyTimes="0;1" keySplines=".4 0 .2 1" fill="freeze" />}
            </rect>
          </clipPath>
        </defs>
        {T.map((v) => (
          <Fragment key={'t' + v}>
            <line x1={pl} x2={W - pr} y1={Y(v).toFixed(1)} y2={Y(v).toFixed(1)} stroke={'rgba(255,255,255,' + (v === base ? '.24' : '.08') + ')'} />
            <text x={pl - 10} y={(Y(v) + 4).toFixed(1)} textAnchor="end" fontSize="11" fill="#8b9096">
              {fmt(v)}
            </text>
          </Fragment>
        ))}
        {xl}
        <g clipPath="url(#mkdrv)">
          <path d={d} fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1.6" />
          <g clipPath="url(#mkdcu)">
            <path d={area} fill="url(#mkdgu)" />
            <path d={d} fill="none" stroke={G} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          </g>
          <g clipPath="url(#mkdcd)">
            <path d={area} fill="url(#mkdgd)" />
            <path d={d} fill="none" stroke={R} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        </g>
        {/* 시작점(기준)과 겹치는 표시는 생략 */}
        <g className="mkd-mk">
          {iMx !== iMn ? (
            <>
              {iMx > 0 ? mark(iMx, 'Max') : null}
              {iMn > 0 ? mark(iMn, 'Min') : null}
            </>
          ) : null}
        </g>
        <g className="mkd-cur">
          <line id="mkd-cl" x1={ha ? ha[0].toFixed(1) : '0'} x2={ha ? ha[0].toFixed(1) : '0'} y1={pt} y2={H - pb} stroke="rgba(255,255,255,.75)" strokeDasharray="4 4" />
          <circle id="mkd-cc" cx={ha ? ha[0].toFixed(1) : undefined} cy={ha ? ha[1].toFixed(1) : undefined} r="5" fill="#17191c" stroke="#fff" strokeWidth="2.2" />
        </g>
      </svg>
      <div className={'mkd-ht' + (ha && ha[1] > H - pb - 70 ? ' up' : '')} id="mkd-ht" role="status" ref={tip}>
        {hp ? (
          <>
            {(m.gran === 'month' && (hov as number) > 0 ? hp.d.slice(0, 7) : hp.d).replace(/-/g, '.')}
            <b>{m.tab === 'ret' ? '수익률 ' + mkPct(hp.y, 2) : m.tab === 'pnl' ? '수익금 ' + (hp.y >= 0 ? '+' : '-') + '$' + Math.abs(Math.round(hp.y)).toLocaleString() : '잔고 $' + Math.round(hp.y).toLocaleString()}</b>
          </>
        ) : null}
      </div>
      {flat ? <div className="mkd-flat">{'이 기간에는 ' + TAB_L[m.tab] + ' 변화가 없습니다'}</div> : null}
    </div>
  );
}

const PILLS: [Mkd['tab'], string, string][] = [
  ['ret', '수익률', '이 전략이 매매로 번 비율입니다. 돈을 더 넣거나 빼도 수익률은 그대로입니다. 수수료를 뺀 실제 수익입니다. 이 전략의 거래만 계산합니다.'],
  ['pnl', '수익금', '고른 기간의 첫날에 $1,000를 넣었다면 늘거나 줄어든 금액입니다. 수수료를 뺀 금액입니다.'],
  ['bal', '잔고', '고른 기간의 첫날에 $1,000를 넣었다면 그날 계좌에 들어 있던 금액입니다.'],
];
const PERS: [number, string][] = [
  [7, '최근 7일'],
  [30, '최근 30일'],
  [90, '최근 3개월'],
  [365, '최근 1년'],
  [0, '전체'],
];

/** mkOvKpi(s,per), mkKpi4(...) */
function Kpi({ s, per }: { s: Strat; per: number }) {
  const r = per ? mkSlice(s, per) : s.r;
  const a = s.r;
  const w = typeof a.winRate === 'number' && (a.n || 0) >= 5 ? Math.round(a.winRate) + '%' : '-';
  const cells: [string, string, string, string?][] = [
    [MK_PER_L[per] + ' 수익률', 'ret', mkPct0(r.ret), mkSign(r.ret)],
    [MK_PER_L[per] + ' 최대 낙폭', 'mdd', r.mdd.toFixed(1) + '%'],
    ['전체 기간 승률', 'win', w],
    ['전체 기간 거래 수', 'n', Number(a.n || 0).toLocaleString() + '회'],
  ];
  return (
    <div className="mk3-kpis num">
      {cells.map((x) => (
        <div key={x[1]}>
          <small>
            <Term t={x[0]} tip={MK_TIP[x[1]]} />
          </small>
          <b className={'num' + (x[3] || '')}>{x[2]}</b>
        </div>
      ))}
    </div>
  );
}

/** tfSS3CalHtml(r,mOff) 와 그 덮개: 날짜별 손익 달력. 칸 진하기는 손익 크기에 비례한다 */
function Calendar({ r }: { r: RunResult }) {
  const [mOff, setOff] = useState(0);
  const cal = useMemo(() => {
    const eq = r.eq || [];
    const day: Record<string, Record<number, number>> = {};
    if (eq.length < 2) return null;
    let prev = eq[0].v;
    for (let k = 1; k < eq.length; k++) {
      const d = idxToDate(eq[k].i);
      /* 월은 두 자리로 맞춘다. 글자 정렬에서 10월이 9월 앞에 오지 않게 */
      const key = d.getFullYear() + '-' + ('0' + d.getMonth()).slice(-2);
      const dk = d.getDate();
      day[key] = day[key] || {};
      day[key][dk] = (day[key][dk] || 0) + (eq[k].v / prev - 1) * 100;
      prev = eq[k].v;
    }
    return { day, months: Object.keys(day).sort() };
  }, [r]);
  if (!cal) return <div className="mt2">표시할 기간 데이터가 없습니다.</div>;
  const { day, months } = cal;
  if (!months.length) return null;
  const mi = Math.max(0, Math.min(months.length - 1, months.length - 1 + mOff));
  const mk = months[mi].split('-');
  const y = +mk[0];
  const mo = +mk[1];
  const dow = new Date(y, mo, 1).getDay();
  const dim = new Date(y, mo + 1, 0).getDate();
  const cells = [];
  for (let b = 0; b < dow; b++) cells.push(<span key={'b' + b} className="cal-c" />);
  let mprod = 1;
  for (let dd = 1; dd <= dim; dd++) {
    const v = day[months[mi]][dd];
    if (v == null)
      cells.push(
        <span key={dd} className="cal-c off">
          {dd}
        </span>,
      );
    else {
      mprod *= 1 + v / 100;
      const t = v.toFixed(2);
      cells.push(
        <span key={dd} className={'cal-c ' + (v >= 0.005 ? 'u' : v <= -0.005 ? 'd' : 'z')} style={{ ['--a' as string]: Math.min(1, Math.abs(+t) / 12).toFixed(2) }} title={t + '%'}>
          {dd}
          <i>{(v >= 0 ? '+' : '') + v.toFixed(1) + '%'}</i>
        </span>,
      );
    }
  }
  /* 단순 합산이 아니라 일 수익률 복리. 자산 곡선과 같은 계산 */
  const mtot = (mprod - 1) * 100;
  const nM = (r.trades || []).filter((x) => {
    const d3 = idxToDate(x.exit);
    return d3.getFullYear() === y && d3.getMonth() === mo;
  }).length;
  const head = mo + 1 + '월 수익률 ' + (mtot >= 0 ? '+' : '') + mtot.toFixed(1) + '%';
  return (
    <>
      <div className="ss3-ch" style={{ marginBottom: 10 }}>
        <b style={{ fontSize: 13 }}>
          {/* tfSS3CalRe() */}
          <button type="button" className="cal-nav" disabled={mi <= 0} onClick={() => setOff(mi - 1 - (months.length - 1))}>
            ‹
          </button>
          {' ' + y + '년 ' + (mo + 1) + '월 '}
          <button type="button" className="cal-nav" disabled={mi >= months.length - 1} onClick={() => setOff(mi + 1 - (months.length - 1))}>
            ›
          </button>
        </b>
        <span className="mt2">{nM ? head + ', 종료 거래 ' + nM + '회' : head + '이며, 청산한 거래는 없습니다'}</span>
      </div>
      <div className="cal-hd">
        {['일', '월', '화', '수', '목', '금', '토'].map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>
      <div className="cal-g">{cells}</div>
      <div className="mt2" style={{ marginTop: 8 }}>
        일별 수익률이며, 색이 진할수록 수익이나 손실이 큽니다.
      </div>
    </>
  );
}

/* 원본은 안쪽 칸(#g-scroll)의 자리만 다룬다. 문서가 통째로 스크롤되는 데스크톱에서는 맨 위로 돌아온다 */
function scrollSet(y: number) {
  const sc = document.getElementById('g-scroll');
  if (sc) sc.scrollTop = y;
  if (!y) window.scrollTo(0, 0);
}

/** mkOvTab(s,r,pd,ne) */
function Ov({ s, pd }: { s: Strat; pd: string }) {
  const eq = useMemo(() => mkDaily(s.r.eq || [], PRICE0.length - 1), [s]);
  /* mkOvRestore(ne): 거래 내역 화면에 다녀왔으면 그래프 조작 값과 스크롤 자리를 되살린다 (MK_OV_KEEP) */
  const [kept] = useState(() => takeOvKeep(s.id));
  const [m, setM] = useState<Mkd>(() => (kept && kept.per != null ? { tab: kept.tab as Mkd['tab'], gran: kept.gran as Mkd['gran'], per: kept.per } : { tab: 'ret', gran: 'day', per: 30 }));
  const live = useRef(m);
  live.current = m;
  useLayoutEffect(() => {
    if (!kept) return;
    const t = setTimeout(() => {
      const sc = document.getElementById('g-scroll');
      if (sc) sc.scrollTop = kept.top;
    }, 0);
    return () => clearTimeout(t);
  }, [kept]);
  /** mkdSet(k,v): 원본은 조작 줄을 통째로 다시 그려 누른 단추의 초점이 풀린다(초점에 뜨는 풀이 말풍선도 닫힌다) */
  const set = (patch: Partial<Mkd>) => {
    setM({ ...live.current, ...patch });
    const a = document.activeElement as HTMLElement | null;
    if (a && a.closest('#mkd-ctl')) a.blur();
  };
  /** mkdHintTxt() */
  const hint = m.tab === 'ret' ? '' : m.per ? MK_PER_L[m.per].replace('최근 ', '') + ' 전에 $1,000를 넣었다면' : '시작한 날에 $1,000를 넣었다면';
  return (
    <div className="mk3-ov">
      <section className="mk3-sec" style={{ marginTop: 0 }}>
        <h3>성과</h3>
        <div id="mk3-kpi-host">
          <Kpi s={s} per={m.per} />
        </div>
        {/* mkdCtlHtml(), mkdSet(k,v) */}
        <div className="mkd-ctl" id="mkd-ctl">
          <div className="mkd-pills" role="group" aria-label="그래프 종류">
            {PILLS.map((t) => (
              <button key={t[0]} type="button" className="mkd-pill" aria-pressed={m.tab === t[0]} onClick={() => set({ tab: t[0] })}>
                {skdLabel(t[1])}
                <i aria-hidden="true">i</i>
                <span className="mkd-tip" role="tooltip">
                  {t[2]}
                </span>
              </button>
            ))}
          </div>
          <div className="mkd-right">
            <div className="mkd-seg" role="group" aria-label="간격">
              {(
                [
                  ['day', '일별'],
                  ['month', '월별'],
                ] as [Mkd['gran'], string][]
              ).map((g) => (
                <button key={g[0]} type="button" aria-pressed={m.gran === g[0]} onClick={() => set({ gran: g[0] })}>
                  {g[1]}
                </button>
              ))}
            </div>
            <select className="mkd-per" aria-label="기간 선택" value={m.per} onChange={(e) => set({ per: +e.target.value })}>
              {PERS.map((o) => (
                <option key={o[0]} value={o[0]}>
                  {o[1]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mkd-hint" id="mkd-hint">
          {hint}
        </p>
        <Chart eq={eq} m={m} />
        <p className="mk3-since num">{skdText(mkdSince(s) + ' 시작 이후 ' + mkPct0(s.r.ret))}</p>
        <div className="mk3-cal" id="ss3-cal-host">
          <Calendar r={s.r} />
        </div>
      </section>
      <ChatLog s={s} pd={pd} />
      <OrdersSec s={s} pd={pd} keep={() => live.current} />
    </div>
  );
}

/** mkInfoTab(s,r,ne) */
function Info({ s }: { s: Strat }) {
  const a = s.r.params && s.r.params.startI != null ? s.r.params.startI : 61;
  const b = PRICE0.length - 1;
  const rows: [string, string][] = [
    ['판단 방식', MK_KIND[s.kind] || '차트 규칙'],
    ['거래 대상', s.cfg && s.cfg.uni ? mkUni(s).list.join(', ') : CPP_PAIR[s.asset] || s.asset],
    ['거래 상품', mkInstList(s).join(', ')],
    ['실행 거래소', mkEx(s)[1]],
    ['기록 기간', mkDate(a) + ' ~ ' + mkDate(b) + ' (' + Math.max(1, Math.round((b - a) / 30.44)) + '개월)'],
    ['등록', s.by ? '@' + s.by : 'TETH'],
  ];
  return (
    <div className="mk-info">
      {rows.map((x) => (
        <div key={x[0]} className="mk-info-r">
          <small>{skdLabel(x[0])}</small>
          <span>{skdLabel(x[1])}</span>
        </div>
      ))}
    </div>
  );
}

export function Detail({ ne: ne0, pd: pd0, tab: tab0, setup }: { ne: string; pd: string | null; tab: string | null; setup: boolean }) {
  let nick: string | null = null;
  try {
    nick = decodeURIComponent(ne0);
  } catch {
    /* 깨진 주소는 목록으로 */
  }
  const s = nick == null ? null : tfSSFind(nick);
  const ssPd = useShare((st) => st.ss.pd);
  const pd = pd0 && MK_PD_OK[pd0] ? pd0 : ssPd && MK_PD_OK[ssPd] ? ssPd : 'all';
  const tab = tab0 && MK_TAB_OK[tab0] ? tab0 : 'ov';
  const tabs = useRef<HTMLElement>(null);
  const keepScroll = useRef(false);
  const first = useRef(true);
  const setupDone = useRef(false);
  useWatchResume();
  /* 없는 전략이면 알리고 목록으로 */
  useEffect(() => {
    if (s) return;
    if (nick != null) toast('전략을 찾을 수 없습니다');
    replaceHash('#/share');
  }, [s, nick]);
  /* cpProfileRoute, cpSetupRoute: 주소를 상세 주소로 바꾸고, 복사 주소면 설정 창을 연다 */
  useEffect(() => {
    if (!s) return;
    if (window.location.hash.indexOf('#/share/s/') !== 0) replaceHash('#/share/s/' + tfSSNe(nick as string) + '/' + pd);
    /* 주소를 바꾸면 setup 이 꺼진 채 다시 그려진다. 그래도 한 번은 연다 */
    if (!setup) setupDone.current = false;
    else if (!setupDone.current) {
      setupDone.current = true;
      setTimeout(() => cpSetupGo(s.id), 0);
    }
  }, [s, setup]); // eslint-disable-line react-hooks/exhaustive-deps
  /* 탭을 눌러 바꾸면 스크롤과 초점을 지키고(tfSS3Go), 주소로 바뀌면 맨 위로 */
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (keepScroll.current || tabKeep.on) {
      keepScroll.current = tabKeep.on = false;
      tabs.current?.querySelector<HTMLButtonElement>('.mk-tab.on')?.focus();
    } else scrollSet(0);
  }, [tab, pd]);
  if (!s) return <div className="tf-page tfbk ss3 mk mk-detail" />;
  const ne = tfSSNe(nick as string); /* 주소 글자를 그대로 쓰지 않고 다시 정규화한다 */
  /** tfSS3Go(ne,pd,tab): 같은 상세 안의 탭 전환은 기록을 쌓지 않는다 */
  const go = (t: string) => {
    keepScroll.current = true;
    setSS({ pd });
    replaceHash('#/share/s/' + ne + '/' + pd + (t !== 'ov' ? '/' + t : ''));
  };
  return (
    <div className="tf-page tfbk ss3 mk mk-detail">
      <div className="tfbk-bc">
        <span className="lk" onClick={() => nav('#/share')}>
          전략 복사
        </span>
        {' / '}
        <span>{s.name}</span>
      </div>
      <Head s={s} ne={ne} pd={pd} />
      <nav className="mk-dtabs" role="tablist" ref={tabs}>
        {(
          [
            ['ov', '개요'],
            ['info', '정보'],
          ] as [string, string][]
        ).map((t2) => {
          /* 거래 내역 전체 화면은 개요의 일부 */
          const on = tab === t2[0] || (tab === 'trades' && t2[0] === 'ov');
          return (
            <button key={t2[0]} type="button" role="tab" className={'mk-tab' + (on ? ' on' : '')} aria-selected={on} onClick={() => go(t2[0])}>
              {skdLabel(t2[1])}
            </button>
          );
        })}
      </nav>
      <div className="mk-dbody">{tab === 'trades' ? <TradesTab s={s} pd={pd} /> : tab === 'info' ? <Info s={s} /> : <Ov key={pd} s={s} pd={pd} />}</div>
    </div>
  );
}
