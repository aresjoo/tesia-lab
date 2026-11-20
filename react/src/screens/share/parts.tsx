// 전략 복사 화면이 같이 쓰는 작은 그림들: 식별 도식, 30일 작은 그래프, 따라가는 사람 수.
import { useId, type ReactNode } from 'react';
import { MK_USHAPE } from '../../core/engine/catalog.data';
import { mkUni } from '../../core/engine/catalog';
import type { CatCfg, EqPt, Strat } from '../../core/engine/types';

const f1 = (n: number) => n.toFixed(1);

/** mkMark(x,y,r,sh,fill): 동그라미(코인), 네모(주식), 마름모(지수와 금) */
function Mark({ x, y, r, sh, fill }: { x: number; y: number; r: number; sh: string; fill: string }) {
  if (sh === 's') return <rect x={f1(x - r)} y={f1(y - r)} width={f1(r * 2)} height={f1(r * 2)} rx=".6" fill={fill} />;
  if (sh === 'd') return <rect x={f1(x - r)} y={f1(y - r)} width={f1(r * 2)} height={f1(r * 2)} rx=".4" fill={fill} transform={`rotate(45 ${f1(x)} ${f1(y)})`} />;
  return <circle cx={f1(x)} cy={f1(y)} r={f1(r)} fill={fill} />;
}
/** mkDots(n,cx,cy,w,h) */
function mkDots(n: number, cx: number, cy: number, w: number, h: number): [number, number][] {
  const cols = n <= 3 ? n : n <= 6 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    pts.push([cx + (cols > 1 ? (c / (cols - 1) - 0.5) * w : 0), cy + (rows > 1 ? (r / (rows - 1) - 0.5) * h : 0)]);
  }
  return pts;
}
/** mkCurve(c,x0,x1,W,D): 떨어졌다 오르는 꺾은선 */
function Curve({ c, x0, x1, W, D }: { c: Partial<CatCfg>; x0: number; x1: number; W: string; D: string }) {
  const th = c.rsiTh || 40;
  const dep = th <= 26 ? 19 : th <= 32 ? 16 : th <= 40 ? 13 : th <= 46 ? 10 : th <= 50 ? 7 : 4;
  const tp = c.tp || 8;
  const k = tp <= 5 ? 0 : tp <= 8 ? 1 : tp <= 15 ? 2 : 3;
  const w = x1 - x0;
  const yT = 5;
  const xb = x0 + w * 0.3;
  const xe = xb + w * 0.22 + k * (w > 15 ? 3 : 1.7);
  const sh = c.mkt === 'stock' ? 's' : c.mkt === 'index' ? 'd' : 'c';
  const ye = yT + dep - Math.min(dep, 3 + k * 1.7);
  return (
    <>
      <path d={`M${f1(x0)} ${yT}L${f1(xb)} ${yT + dep}L${f1(xe)} ${f1(ye)}`} fill="none" stroke={W} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <Mark x={xe} y={ye} r={w > 15 ? 2.1 : 1.8} sh={w > 15 ? sh : 'c'} fill={W} />
      {c.tf ? <path d={`M${f1(x0 - 1.6)} 4v20`} stroke={D} strokeWidth="1.4" strokeLinecap="round" /> : null}
    </>
  );
}

/** mkGlyph(s,z), mkGlyphB1(s,z): 전략의 판단 방식을 그린 식별 도식 */
export function Glyph({ s, z = 28 }: { s: Strat; z?: number }) {
  const c = s.cfg || ({} as Partial<CatCfg>);
  const W = '#e9ebee';
  const D = 'rgba(233,235,238,.34)';
  const sh = (s.uni && MK_USHAPE[s.uni]) || 'c';
  let body: ReactNode;
  if (s.kind === 'agent') {
    const n = mkUni(s).list.length;
    const P = mkDots(n, 14, 14, n <= 3 ? 14 : 17, n <= 3 ? 0 : 8);
    body = P.map((p, i) => <Mark key={i} x={p[0]} y={p[1]} r={i < (c.top || 1) ? 2.5 : 1.5} sh={sh} fill={i < (c.top || 1) ? W : D} />);
  } else if (s.kind === 'mix') {
    const n = mkUni(s).list.length;
    const cols = n <= 6 ? 3 : 4;
    const P: [number, number][] = n <= 3 ? mkDots(n, 6.5, 14, 0, 13) : mkDots(n, 7, 14, 6, n <= 6 ? 12 : 15).map((_, j) => [4.5 + Math.floor(j / cols) * 5, 14 + ((j % cols) / (cols - 1) - 0.5) * (n <= 6 ? 12 : 15)]);
    body = (
      <>
        {P.map((p, i) => (
          <Mark key={i} x={p[0]} y={p[1]} r={i === 0 ? 2 : 1.2} sh={sh} fill={i === 0 ? W : D} />
        ))}
        <Curve c={c} x0={14.5} x1={25} W={W} D={D} />
      </>
    );
  } else body = <Curve c={c} x0={5} x1={24} W={W} D={D} />;
  return (
    <svg className="mk3-g" width={z} height={z} viewBox="0 0 28 28" aria-hidden="true">
      <rect x=".5" y=".5" width="27" height="27" rx="7" fill="#1a1d21" stroke="rgba(255,255,255,.14)" />
      {body}
    </svg>
  );
}

/** mkSpark3(eq): 30일 작은 그래프. 시작값이 기준선, 위는 초록 아래는 빨강 */
export function Spark3({ eq }: { eq: EqPt[] }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const W = 170;
  const H = 78;
  const pad = 5;
  const n = eq ? eq.length : 0;
  if (n < 2) return <span className="mk-spark" />;
  const base = eq[0].v;
  let min = base;
  let max = base;
  for (let i = 0; i < n; i++) {
    if (eq[i].v < min) min = eq[i].v;
    if (eq[i].v > max) max = eq[i].v;
  }
  if (max - min < 1e-9)
    return (
      <svg className="mk-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="rgba(255,255,255,.34)" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  const X = (j: number) => 1 + (j / (n - 1)) * (W - 2);
  const Y = (v: number) => pad + (1 - (v - min) / (max - min)) * (H - pad * 2);
  const P = eq.map((e, j) => [X(j), Y(e.v)]);
  /* 꺾이는 곳만 살짝 둥글게(반지름 2.5). 평평한 구간은 평평하게 남는다 */
  let d = 'M' + f1(P[0][0]) + ' ' + f1(P[0][1]);
  const R = 2.5;
  for (let i = 1; i < n - 1; i++) {
    const a = P[i - 1];
    const b = P[i];
    const c = P[i + 1];
    const l1 = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
    const l2 = Math.sqrt((c[0] - b[0]) * (c[0] - b[0]) + (c[1] - b[1]) * (c[1] - b[1]));
    const r1 = Math.min(R, l1 / 2);
    const r2 = Math.min(R, l2 / 2);
    if (l1 < 1e-6 || l2 < 1e-6) {
      d += ' L' + f1(b[0]) + ' ' + f1(b[1]);
      continue;
    }
    d += ' L' + f1(b[0] - ((b[0] - a[0]) / l1) * r1) + ' ' + f1(b[1] - ((b[1] - a[1]) / l1) * r1) + ' Q' + f1(b[0]) + ' ' + f1(b[1]) + ' ' + f1(b[0] + ((c[0] - b[0]) / l2) * r2) + ' ' + f1(b[1] + ((c[1] - b[1]) / l2) * r2);
  }
  d += ' L' + f1(P[n - 1][0]) + ' ' + f1(P[n - 1][1]);
  const yb = Y(base);
  const neg = min < base - 1e-9;
  const G = '#2ebd85';
  const Rd = '#f0566a';
  const ln = (col: string) => <path d={d} fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
  if (!neg)
    return (
      <svg className="mk-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {ln(G)}
      </svg>
    );
  /* mkFlatAtBase: 기준선 위에 붙어 있는 평평한 구간은 초록으로 덧그린다 */
  let flat = '';
  for (let i = 0; i < eq.length - 1; i++) if (Math.abs(eq[i].v - base) < 1e-12 && Math.abs(eq[i + 1].v - base) < 1e-12) flat += 'M' + f1(X(i)) + ' ' + f1(Y(base)) + ' L' + f1(X(i + 1)) + ' ' + f1(Y(base)) + ' ';
  return (
    <svg className="mk-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <clipPath id={uid + 'u'}>
          <rect x="-2" y="-2" width={W + 4} height={f1(yb + 2)} />
        </clipPath>
        <clipPath id={uid + 'd'}>
          <rect x="-2" y={f1(yb)} width={W + 4} height={f1(H - yb + 2)} />
        </clipPath>
      </defs>
      <line x1="0" y1={f1(yb)} x2={W} y2={f1(yb)} stroke="rgba(255,255,255,.2)" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      <g clipPath={`url(#${uid}u)`}>{ln(G)}</g>
      <g clipPath={`url(#${uid}d)`}>{ln(Rd)}</g>
      {flat ? <path d={flat} fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" /> : null}
    </svg>
  );
}

/** mkFwHtml(n): 따라가는 사람 수 */
export function FwLine({ n }: { n: number }) {
  n = +n || 0;
  if (n <= 0) return null;
  const num = n >= 10000 ? '약 ' + Math.round(n / 1000) / 10 + '만' : n.toLocaleString();
  const tier = n >= 1000 ? 't3' : n >= 500 ? 't2' : 't1';
  return (
    <div className={'mk3-fw num ' + tier}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="8" r="3.4" />
        <path d="M2.8 19.5c.5-3.3 3-5.4 6.2-5.4s5.7 2.1 6.2 5.4" />
        <path d="M15.2 4.9a3.4 3.4 0 0 1 0 6.3" />
        <path d="M17.6 14.4c2.1.6 3.4 2.4 3.7 5.1" />
      </svg>
      <span>
        <b>{num + '명'}</b>이 따라가는 중
      </span>
    </div>
  );
}
