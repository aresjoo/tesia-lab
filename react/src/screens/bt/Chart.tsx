// 잔고 그래프 (원본 btChartSvg, btChartDraw, btCursor, btMarks, btDD, btPulse, btPin, btHover, btChartClick).
import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { btGeo, btMarkList, btPath, btV, type Geo } from '../../core/bt/chart';
import { btNear, btUsd, btYMD, type BtR, type Dec } from '../../core/bt/compute';
import { idxToDate, mkPct0, mkSign } from '../../core/bt/engine';
import { skbText } from '../../core/bt/text';
import { btMarkClick, useBt } from './bt';
import { tx } from './parts';

const G1 = '#2fb98a';
const R1 = '#f0566a';

/** 축, 선, 표시처럼 한 번 그리면 그대로인 부분 */
function useStatic(R: BtR | null, G: Geo | null, amt: number, res: boolean) {
  return useMemo(() => {
    if (!R || !G) return null;
    const W = G.W;
    const H = G.H;
    const yb = G.Y(1);
    const base = H - G.pb;
    const grid = G.T.map((v, i) => {
      const y = G.Y(v / amt);
      return [
        <line key={'l' + i} x1={G.pl} x2={W - G.pr} y1={y.toFixed(1)} y2={y.toFixed(1)} stroke={'rgba(255,255,255,' + (Math.abs(v - amt) < 1e-6 ? '.26' : '.07') + ')'} />,
        <text key={'t' + i} x={G.pl - 10} y={(y + 4).toFixed(1)} textAnchor="end" fontSize="11" fill="#8b9096">
          {Math.round(v).toLocaleString()}
        </text>,
      ];
    });
    const nx = G.mob ? 4 : 6;
    const xl = [];
    for (let k = 0; k < nx; k++) {
      const j = Math.round((k * (R.N - 1)) / (nx - 1));
      const d = idxToDate(R.eq[j].i);
      xl.push(
        <text key={'x' + k} x={G.X(j).toFixed(1)} y={H - 8} textAnchor={k === 0 ? 'start' : k === nx - 1 ? 'end' : 'middle'} fontSize="11" fill="#8b9096">
          {String(d.getFullYear()).slice(2) + '.' + String(d.getMonth() + 1).padStart(2, '0')}
        </text>,
      );
    }
    const line = btPath(
      R.eq.map((p) => p.v),
      G,
    );
    const area = line + ' L' + G.X(R.N - 1).toFixed(1) + ' ' + yb.toFixed(1) + ' L' + G.X(0).toFixed(1) + ' ' + yb.toFixed(1) + ' Z';
    const ML = btMarkList(R, G, res);
    const sz = ML.length > 60 ? 0.72 : 1;
    return { W, H, yb, base, grid, xl, line, area, ML, sz, bench: btPath(R.bench, G) };
  }, [R, G, amt, res]);
}

export function Chart() {
  const R = useBt((s) => s.R);
  const phase = useBt((s) => s.phase);
  const amt = useBt((s) => s.amt);
  const draw = useBt((s) => s.draw);
  const vj = useBt((s) => s.vj);
  const marksJ = useBt((s) => s.marksJ);
  const ddJ = useBt((s) => s.ddJ);
  const pulseJ = useBt((s) => s.pulseJ);
  const sel = useBt((s) => s.sel);
  const host = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  /* 그릴 때의 상자 폭으로 축을 잡는다 (btGeo). 그린 때의 단계가 class 와 표시 묶음을 정한다 */
  const [geo, setGeo] = useState<{ G: Geo; R: BtR; phase: string } | null>(null);
  const [hov, setHov] = useState<{ j: number; near: Dec | null; raw: boolean } | null>(null);
  useLayoutEffect(() => {
    if (!R) return;
    setGeo({ G: btGeo(R, amt, host.current ? host.current.clientWidth : null, window.innerHeight), R, phase });
    setHov(null);
    // 그래프는 원본처럼 btChartDraw 가 불릴 때(draw 가 오를 때)만 다시 잰다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw]);
  const G = geo && geo.R === R ? geo.G : null;
  const drawn = geo ? geo.phase : phase;
  const res = drawn === 'result';
  const S = useStatic(R, G, amt, res);

  /* 툴팁 자리: 원본은 글자 교체 전의 글로 폭을 재어 자리를 잡는다. 같은 자리가 되게 교체 전 글로 한 번 그려 재고, 곧바로 교체한 글로 바꾼다 */
  useLayoutEffect(() => {
    const h = host.current;
    const t = tip.current;
    if (!hov || !hov.raw || !h || !t || !G || !R) return;
    const b = h.getBoundingClientRect();
    const px = G.X(hov.j);
    const py = G.Y(R.eq[hov.j].v);
    const tw = t.offsetWidth || 190;
    let left = (px / G.W) * b.width + 14;
    if (left + tw > b.width - 6) left = (px / G.W) * b.width - tw - 14;
    t.style.left = Math.max(4, left) + 'px';
    t.style.top = Math.max(6, Math.min(b.height - t.offsetHeight - 40, (py / G.H) * b.height - 30)) + 'px';
    setHov({ ...hov, raw: false });
  }, [hov, G, R]);

  const hoverJ = (ev: { clientX: number }) => {
    const b = (host.current as HTMLDivElement).getBoundingClientRect();
    const x = ((ev.clientX - b.left) / b.width) * (G as Geo).W;
    return Math.max(0, Math.min((R as BtR).N - 1, Math.round(((x - (G as Geo).pl) / ((G as Geo).W - (G as Geo).pl - (G as Geo).pr)) * ((R as BtR).N - 1))));
  };
  const onMove = (ev: PointerEvent) => {
    if (phase !== 'result' || !G || !R) return;
    const j = hoverJ(ev);
    setHov({ j, near: btNear(R, j), raw: true });
  };

  let svg = null;
  if (R && G && S) {
    const { W, H, yb, base } = S;
    /* 커서: 재생 중에는 지나온 날, 결과에서는 가리킨 날 */
    const cj = hov ? hov.j : vj;
    const cx = cj != null ? G.X(cj) : 0;
    const cy = cj != null ? G.Y(hov ? R.eq[hov.j].v : btV(R, cj)) : undefined;
    const rvW = res ? W : vj == null || vj < 0 ? 0 : G.X(vj) + 1;
    const d = ddJ >= 0 && ddJ < R.dd.length ? R.dd[ddJ] : null;
    const ddOn = !!d && !(d.v > -0.03);
    const dx = d ? G.X(d.a) : 0;
    const dw = d ? Math.max(3, G.X(d.b) - dx) : 0;
    const dlx = Math.max(G.pl + 92, Math.min(W - G.pr - 92, dx + dw / 2));
    const pin = res && sel ? sel.j : null;
    svg = (
      <svg viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label="잔고 그래프">
        <defs>
          <linearGradient id="btgu" gradientUnits="userSpaceOnUse" x1="0" y1={G.pt} x2="0" y2={yb.toFixed(1)}>
            <stop offset="0" stopColor={G1} stopOpacity=".26" />
            <stop offset="1" stopColor={G1} stopOpacity=".02" />
          </linearGradient>
          <linearGradient id="btgd" gradientUnits="userSpaceOnUse" x1="0" y1={yb.toFixed(1)} x2="0" y2={base}>
            <stop offset="0" stopColor={R1} stopOpacity=".02" />
            <stop offset="1" stopColor={R1} stopOpacity=".26" />
          </linearGradient>
          <clipPath id="btcu">
            <rect x="0" y="0" width={W} height={yb.toFixed(1)} />
          </clipPath>
          <clipPath id="btcd">
            <rect x="0" y={yb.toFixed(1)} width={W} height={(H - yb).toFixed(1)} />
          </clipPath>
          <clipPath id="btrv">
            <rect id="bt-rv" x="0" y="0" height={H} width={rvW} />
          </clipPath>
        </defs>
        {S.grid}
        {S.xl}
        {/* 가장 나빴던 구간: 시간 축을 따라 놓인 띠와 이름표 */}
        <g className={'bt-dd' + (ddOn ? ' on' : '')} id="bt-dd">
          <rect id="bt-ddr" x={ddOn ? dx : 0} y={base + 3} width={ddOn ? dw : 0} height="4" rx="2" fill="#f0566a" />
          <line id="bt-dda" x1={ddOn ? dx : 0} x2={ddOn ? dx : 0} y1={G.pt} y2={base} stroke="rgba(240,86,106,.32)" strokeDasharray="2 5" />
          <line id="bt-ddb" x1={ddOn ? dx + dw : 0} x2={ddOn ? dx + dw : 0} y1={G.pt} y2={base} stroke="rgba(240,86,106,.32)" strokeDasharray="2 5" />
          <text id="bt-ddt" x={ddOn ? dlx : 0} y={base - 8} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#f58a98">
            {ddOn && d ? tx((phase === 'result' ? '가장 나빴던 구간 ' : '지금까지 가장 나빴던 구간 ') + (d.v * 100).toFixed(1) + '%') : ''}
          </text>
        </g>
        {/* 색이 바뀌는 기준(시작 금액) 선 */}
        <g className="skb-base">
          <line x1={G.pl} x2={W - G.pr} y1={yb.toFixed(1)} y2={yb.toFixed(1)} stroke="rgba(255,255,255,.45)" strokeWidth="1" />
        </g>
        <g clipPath="url(#btrv)">
          <path className="bt-bench" d={S.bench} fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1.3" strokeDasharray="2 4" />
        </g>
        <g clipPath="url(#btrv)">
          <g clipPath="url(#btcu)">
            <path d={S.area} fill="url(#btgu)" />
            <path d={S.line} fill="none" stroke={G1} strokeWidth="1.9" strokeLinejoin="round" />
          </g>
          <g clipPath="url(#btcd)">
            <path d={S.area} fill="url(#btgd)" />
            <path d={S.line} fill="none" stroke={R1} strokeWidth="1.9" strokeLinejoin="round" />
          </g>
        </g>
        <g id="bt-mk">
          {S.ML.map((m) => {
            const x = G.X(m.j);
            const y = G.Y(R.eq[m.j].v);
            const col = (m.pnl as number) >= 0 ? G1 : R1;
            const a = 5 * S.sz;
            const h = 8 * S.sz;
            const short = m.k === 'buy' && (m.side || 0) < 0;
            const go = () => btMarkClick(m.ix, m.k === 'skip' ? m.ix2 : m.ix);
            return (
              <g
                key={m.ix}
                className={'bt-m k-' + m.k + (m.j <= (res ? R.N : marksJ) ? ' on' : '')}
                data-j={m.j}
                data-ix={m.ix}
                tabIndex={res ? 0 : -1}
                role="button"
                aria-label={btYMD(R.eq[m.j].i) + ' ' + m.t + (m.n > 1 && m.k === 'skip' ? ' 외 ' + (m.n - 1) + '번' : '')}
                onClick={(e) => {
                  e.stopPropagation();
                  go();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    go();
                  }
                }}
              >
                <rect x={(x - 11).toFixed(1)} y={(y - (m.k === 'buy' && !short ? -2 : 34)).toFixed(1)} width="22" height={m.k === 'skip' ? 34 : 20} fill="transparent" />
                {short ? (
                  <path d={'M' + x.toFixed(1) + ' ' + (y - 7).toFixed(1) + ' l' + a + ' -' + h + ' h-' + 2 * a + ' z'} fill="#b08cf5" />
                ) : m.k === 'buy' ? (
                  <path d={'M' + x.toFixed(1) + ' ' + (y + 7).toFixed(1) + ' l' + a + ' ' + h + ' h-' + 2 * a + ' z'} fill={G1} />
                ) : m.k === 'sell' ? (
                  <path d={'M' + x.toFixed(1) + ' ' + (y - 7).toFixed(1) + ' l' + a + ' -' + h + ' h-' + 2 * a + ' z'} fill="#15171a" stroke={col} strokeWidth="1.5" strokeLinejoin="round" />
                ) : (
                  <>
                    <rect x={(x - 4.5).toFixed(1)} y={(y - 24.5).toFixed(1)} width="9" height="9" transform={'rotate(45 ' + x.toFixed(1) + ' ' + (y - 20).toFixed(1) + ')'} fill="#15171a" stroke="#f0b840" strokeWidth="1.7" />
                    {m.n > 1 && (
                      <text x={(x + 9).toFixed(1)} y={(y - 27).toFixed(1)} fontSize="10.5" fontWeight="700" fill="#f0b840">
                        {m.n}번
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}
        </g>
        <g className={'bt-pu' + (pulseJ != null ? ' on' : '')} id="bt-pu">
          <circle id="bt-pu1" r="7" fill="none" stroke="#c8f43c" strokeWidth="1.6" cx={pulseJ != null ? G.X(pulseJ) : undefined} cy={pulseJ != null ? G.Y(btV(R, pulseJ)) : undefined} />
          <circle id="bt-pu2" r="3.2" fill="#c8f43c" cx={pulseJ != null ? G.X(pulseJ) : undefined} cy={pulseJ != null ? G.Y(btV(R, pulseJ)) : undefined} />
        </g>
        <g className="bt-cur" id="bt-cur">
          <line id="bt-cl" x1={cx} x2={cx} y1={G.pt} y2={base} stroke="rgba(255,255,255,.7)" strokeDasharray="4 4" />
          <circle id="bt-cc" r="4.5" fill="#15171a" stroke="#fff" strokeWidth="2" cx={cj != null ? cx : undefined} cy={cy} />
        </g>
        <g className={'bt-pin' + (pin != null ? ' on' : '')} id="bt-pin">
          <line id="bt-pl" x1={pin != null ? G.X(pin) : 0} x2={pin != null ? G.X(pin) : 0} y1={G.pt} y2={base} stroke="#f0b840" strokeWidth="1.2" />
          <circle id="bt-pc" r="5" fill="#f0b840" cx={pin != null ? G.X(pin) : undefined} cy={pin != null ? G.Y(R.eq[pin].v) : undefined} />
        </g>
      </svg>
    );
  }
  const v = hov && R ? R.eq[hov.j].v : 1;
  const near = hov ? hov.near : null;
  const tt = (t: string) => (hov && hov.raw ? t : skbText(t));
  return (
    <div
      className={'bt-chart ph-' + drawn + (hov ? ' hov' + (near ? ' ev' : '') : '')}
      id="bt-chart"
      ref={host}
      onPointerMove={onMove}
      onPointerLeave={() => setHov(null)}
      onClick={(ev) => {
        if (phase !== 'result' || !G || !R) return;
        const d = btNear(R, hoverJ(ev));
        if (d) btMarkClick(d.ix, d.ix);
      }}
    >
      {svg}
      <div className="bt-tip" id="bt-tip" role="status" ref={tip}>
        {hov && R && (
          <>
            <b className="num">{tt(btYMD(R.eq[hov.j].i))}</b>
            <span>
              잔고 <i className="num">{btUsd(amt * v)}</i> <i className={'num' + mkSign((v - 1) * 100)}>{mkPct0((v - 1) * 100, 1)}</i>
            </span>
            <span className="g">
              그냥 들고 있었다면 <i className="num">{btUsd(amt * R.bench[hov.j])}</i>
            </span>
            {near && (
              <span className="e">
                <em className="num">{tt(btYMD(near.i))}</em>
                {tt((near.tk ? near.tk + ' ' : '') + near.tag + (near.pnl != null ? ' ' : ''))}
                {near.pnl != null && <i className={'num' + mkSign(near.pnl)}>{mkPct0(near.pnl, 1)}</i>}
                <em>누르면 이유가 열립니다</em>
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
