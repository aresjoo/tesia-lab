// 백테스트 화면이 같이 쓰는 작은 부품: 글자 규칙, 아이콘, 전략 글리프, 용어 단추.
import type { ReactNode } from 'react';
import { MK_GLOSS, MK_GLOSS_K, mkPolite, mkUni, type Cfg, type Strat } from '../../core/bt/engine';
import { isFut } from '../../core/bt/compute';
import { SKB_DT, btText, fuW } from '../../core/bt/text';
import { BT } from './bt';

/** 화면에 내는 글 한 마디. 선물 전략이면 선물의 말로 바꾼 뒤 교체표를 적용한다. label 은 통째 교체가 되는 라벨 자리 */
export const tx = (t: string, label = false) => btText(t, isFut(BT.s), label);

const Svg = ({ z, sw, children, cls }: { z: number; sw: number; children: ReactNode; cls?: string }) => (
  <svg className={cls} width={z} height={z} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden={cls ? true : undefined}>
    {children}
  </svg>
);
/** 펼침 화살표 */
export const Chev = () => (
  <Svg z={16} sw={2} cls="cv">
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
/** TAI_CHECK */
export const Check = () => (
  <Svg z={14} sw={1.8}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.2l2.4 2.4 4.6-5" />
  </Svg>
);
export const Back = () => (
  <Svg z={19} sw={2}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);

/* ── 전략 글리프 (원본 mkGlyph, mkGlyphB1, mkCurve, mkMark, mkDots) ── */
const MK_USHAPE: Record<string, string> = { coin8: 'c', big3: 'c', tech8: 's', macro6: 'd', idx3: 'd' };
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
function mkMark(key: string, x: number, y: number, r: number, sh: string, fill: string) {
  if (sh === 's') return <rect key={key} x={(x - r).toFixed(1)} y={(y - r).toFixed(1)} width={(r * 2).toFixed(1)} height={(r * 2).toFixed(1)} rx=".6" fill={fill} />;
  if (sh === 'd') return <rect key={key} x={(x - r).toFixed(1)} y={(y - r).toFixed(1)} width={(r * 2).toFixed(1)} height={(r * 2).toFixed(1)} rx=".4" fill={fill} transform={'rotate(45 ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')'} />;
  return <circle key={key} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(1)} fill={fill} />;
}
function mkCurve(c: Cfg, x0: number, x1: number, W: string, D: string) {
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
  return [
    <path key="cv" d={'M' + x0.toFixed(1) + ' ' + yT + 'L' + xb.toFixed(1) + ' ' + (yT + dep) + 'L' + xe.toFixed(1) + ' ' + ye.toFixed(1)} fill="none" stroke={W} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />,
    mkMark('ce', xe, ye, w > 15 ? 2.1 : 1.8, w > 15 ? sh : 'c', W),
    c.tf ? <path key="tf" d={'M' + (x0 - 1.6).toFixed(1) + ' 4v20'} stroke={D} strokeWidth="1.4" strokeLinecap="round" /> : null,
  ];
}
/** mkGlyph(s,z) */
export function MkGlyph({ s, z = 28 }: { s: Strat; z?: number }) {
  const box = <rect x=".5" y=".5" width="27" height="27" rx="7" fill="#1a1d21" stroke="rgba(255,255,255,.14)" />;
  if (!s.cfg)
    return (
      <svg className="mk3-g" width={z} height={z} viewBox="0 0 28 28" aria-hidden="true">
        {box}
        <path d="M8 14h12M14 8v12" stroke="#e9ebee" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  const c = s.cfg;
  const W = '#e9ebee';
  const D = 'rgba(233,235,238,.34)';
  const sh = MK_USHAPE[s.uni || ''] || 'c';
  const o: ReactNode[] = [];
  if (s.kind === 'agent') {
    const n = mkUni(s).list.length;
    const P = mkDots(n, 14, 14, n <= 3 ? 14 : 17, n <= 3 ? 0 : 8);
    for (let i = 0; i < n; i++) o.push(mkMark('m' + i, P[i][0], P[i][1], i < (c.top || 1) ? 2.5 : 1.5, sh, i < (c.top || 1) ? W : D));
  } else if (s.kind === 'mix') {
    const n = mkUni(s).list.length;
    const q = n <= 6 ? 3 : 4;
    const P: [number, number][] = n <= 3 ? mkDots(n, 6.5, 14, 0, 13) : mkDots(n, 7, 14, 6, n <= 6 ? 12 : 15).map((_, j) => [4.5 + Math.floor(j / q) * 5, 14 + ((j % q) / (q - 1) - 0.5) * (n <= 6 ? 12 : 15)]);
    for (let i = 0; i < n; i++) o.push(mkMark('m' + i, P[i][0], P[i][1], i === 0 ? 2 : 1.2, sh, i === 0 ? W : D));
    o.push(...mkCurve(c, 14.5, 25, W, D));
  } else o.push(...mkCurve(c, 5, 24, W, D));
  return (
    <svg className="mk3-g" width={z} height={z} viewBox="0 0 28 28" aria-hidden="true">
      {box}
      {o}
    </svg>
  );
}

/* ── 용어 단추와 풀이 창 (원본 mkGloss, mkGlossOpen, mkGlossClose) ── */
function glossDoc(e: MouseEvent) {
  const p = document.getElementById('mkg-pop');
  const t = e.target as Element | null;
  if (p && t && p.contains(t)) return;
  if (t && t.closest && t.closest('.mkg')) return;
  mkGlossClose();
}
function glossKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  const a = document.querySelector<HTMLElement>('.mkg[aria-expanded="true"]');
  mkGlossClose();
  if (a)
    try {
      a.focus();
    } catch {
      /* 무시 */
    }
}
/** mkGlossClose() */
export function mkGlossClose() {
  const p = document.getElementById('mkg-pop');
  if (p) p.remove();
  const a = document.querySelector('.mkg[aria-expanded="true"]');
  if (a) a.setAttribute('aria-expanded', 'false');
  document.removeEventListener('click', glossDoc, true);
  document.removeEventListener('keydown', glossKey);
  const sc = document.getElementById('g-scroll');
  if (sc) sc.removeEventListener('scroll', mkGlossClose);
  window.removeEventListener('resize', mkGlossClose);
}
/** mkGlossOpen(b,ev): 풀이 창은 원본처럼 body 끝에 붙는 떠 있는 상자다 */
function mkGlossOpen(b: HTMLElement) {
  const was = b.getAttribute('aria-expanded') === 'true';
  mkGlossClose();
  if (was) return;
  const k = b.getAttribute('data-g') || '';
  const p = document.createElement('div');
  p.id = 'mkg-pop';
  p.className = 'mkg-pop';
  p.setAttribute('role', 'dialog');
  p.setAttribute('aria-label', k + ' 뜻');
  const h = document.createElement('b');
  h.textContent = k;
  const body = document.createElement('p');
  body.textContent = mkPolite(MK_GLOSS[k] || '')
    .split(/(?<=[.])s+/) /* 원본의 식 그대로: 마지막 문장만 「입니다.」로 맺는다 */
    .map((x) => (/니다[.]$/.test(x) ? x : x.replace(/[.]$/, '입니다.')))
    .join(' ');
  p.append(h, body);
  document.body.appendChild(p);
  b.setAttribute('aria-expanded', 'true');
  const r = b.getBoundingClientRect();
  const w = p.offsetWidth;
  const ph = p.offsetHeight;
  const x = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2));
  let y = r.bottom + 8;
  if (y + ph > window.innerHeight - 12) y = Math.max(12, r.top - ph - 8);
  p.style.left = x + 'px';
  p.style.top = y + 'px';
  document.addEventListener('click', glossDoc, true);
  document.addEventListener('keydown', glossKey);
  const sc = document.getElementById('g-scroll');
  if (sc) sc.addEventListener('scroll', mkGlossClose);
  window.addEventListener('resize', mkGlossClose);
}
/** mkGloss(html,body): 글 속의 용어를 풀이 단추로. body 가 참이면 매수, 매도는 그냥 둔다 */
export function Gloss({ text, body, label }: { text: string; body?: boolean; label?: boolean }) {
  const hold: string[] = [];
  let out = text;
  MK_GLOSS_K.forEach((k) => {
    if (body && (k === '매수' || k === '매도')) return;
    const i = out.indexOf(k);
    if (i < 0) return;
    hold.push(k);
    out = out.slice(0, i) + '\u0001' + (hold.length - 1) + '\u0002' + out.slice(i + k.length);
  });
  const fut = isFut(BT.s);
  return (
    <>
      {out.split(/(\u0001\d+\u0002)/).map((seg, i) => {
        const m = seg.match(/^\u0001(\d+)\u0002$/);
        if (!m) return seg ? tx(seg, label) : null;
        const k = fut ? fuW(hold[+m[1]]) : hold[+m[1]];
        return (
          <button
            key={i}
            type="button"
            className="mkg"
            data-g={k}
            aria-haspopup="dialog"
            onClick={(e) => {
              e.stopPropagation();
              mkGlossOpen(e.currentTarget);
            }}
          >
            {tx(hold[+m[1]], label)}
          </button>
        );
      })}
    </>
  );
}
/** 규칙 표의 이름 칸. 이름이 「진입」, 「청산」이면 「진입 조건」, 「청산 조건」으로 통째 바뀐다 (원본 SKB_DT) */
export function Dt({ text, gloss }: { text: string; gloss?: boolean }) {
  const full = tx(text, true).trim();
  if (SKB_DT[full]) return <dt>{SKB_DT[full]}</dt>;
  return <dt>{gloss ? <Gloss text={text} label /> : tx(text, true)}</dt>;
}
/** btFacts(L,gl): 이름과 값의 표. 값은 글이거나 부품 */
export function Facts({ rows, gl }: { rows: [string, ReactNode][]; gl?: boolean }) {
  return (
    <dl className="bt-dl">
      {rows.map((f, i) => (
        <div key={i}>
          <Dt text={f[0]} gloss={gl} />
          <dd className="num">{typeof f[1] === 'string' ? tx(f[1]) : f[1]}</dd>
        </div>
      ))}
    </dl>
  );
}
/** mkdTerm(t,tip) */
export const MkdTerm = ({ t, tip }: { t: string; tip: string }) => (
  <button type="button" className="mkd-term">
    {tx(t, true)}
    <span className="mkd-tip" role="tooltip">
      {tx(tip, true)}
    </span>
  </button>
);
