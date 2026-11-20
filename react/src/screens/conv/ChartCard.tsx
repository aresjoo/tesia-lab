// 차트 카드 (원본 taiChartOpen, taiTv, taiChartRender, taiChartPx, taiForecast, gPipOn).
import { useEffect, useRef } from 'react';
import type { Item, Ohlc } from '../../core/tai/types';
import { G } from '../../state/conv';

type ChartItem = Extract<Item, { k: 'chart' }>;
type TvWin = Window & { TradingView?: { widget: new (o: Record<string, unknown>) => unknown } };

let tvq: (() => void)[] | null = null;
/** taiTv(cb): 트레이딩뷰 스크립트를 한 번만 싣는다 */
function taiTv(cb: () => void) {
  if ((window as TvWin).TradingView) return cb();
  if (tvq) {
    tvq.push(cb);
    return;
  }
  tvq = [cb];
  const s = document.createElement('script');
  s.src = 'https://s3.tradingview.com/tv.js';
  s.onload = () => {
    const q = tvq || [];
    tvq = null;
    q.forEach((f) => f());
  };
  s.onerror = () => {
    tvq = null;
    try {
      s.remove();
    } catch {
      /* 무시 */
    }
  };
  document.head.appendChild(s);
}
const G_RM = (() => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
})();

/** taiForecast(): 실제 봉 뒤로 위아래 시나리오가 그려진다 */
function drawForecast(cv: HTMLCanvasElement, j: Ohlc) {
  const cx = cv.getContext('2d');
  if (!cx) return () => {};
  const rows = j.rows.slice(-40);
  const last = j.rows[j.rows.length - 1][4];
  let up = Math.max(...j.closes30);
  let dn = Math.min(...j.closes30);
  if (up <= last * 1.005) up = last * 1.05;
  if (dn >= last * 0.995) dn = last * 0.95; /* 목표가가 지금 가격에 붙으면 살짝 벌린다 */
  const t0 = performance.now();
  let sizedW = 0;
  let sizedH = 0;
  let raf = 0;
  const draw = (now: number) => {
    if (!cv.isConnected) return;
    const r = cv.getBoundingClientRect();
    const d = Math.min(devicePixelRatio || 1, 2);
    if (r.width !== sizedW || r.height !== sizedH) {
      sizedW = r.width;
      sizedH = r.height;
      cv.width = Math.round(r.width * d);
      cv.height = Math.round(r.height * d);
      cx.setTransform(d, 0, 0, d, 0, 0);
    }
    const W = r.width;
    const H = r.height;
    const lt = document.body.classList.contains('light');
    let q = G_RM ? 1 : Math.min(1, (now - t0) / 1700);
    q = q * q * (3 - 2 * q);
    const split = W * 0.55;
    let hi = Math.max(up, ...rows.map((k) => k[2]));
    let lo = Math.min(dn, ...rows.map((k) => k[3]));
    const pad = (hi - lo) * 0.14 || 1;
    hi += pad;
    lo -= pad;
    const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = lt ? 'rgba(52,98,214,.05)' : 'rgba(143,178,255,.05)';
    cx.fillRect(split, 0, W - split, H);
    cx.strokeStyle = lt ? 'rgba(52,98,214,.25)' : 'rgba(143,178,255,.22)';
    cx.setLineDash([3, 4]);
    cx.beginPath();
    cx.moveTo(split, 0);
    cx.lineTo(split, H);
    cx.stroke();
    cx.setLineDash([]);
    const bw = split / rows.length;
    for (let i = 0; i < rows.length; i++) {
      const k = rows[i];
      const x = i * bw + bw / 2;
      const upc = k[4] >= k[1];
      const col = upc ? (lt ? 'rgba(30,142,62,.8)' : 'rgba(96,200,140,.85)') : lt ? 'rgba(197,57,41,.8)' : 'rgba(235,120,110,.85)';
      cx.strokeStyle = col;
      cx.fillStyle = col;
      cx.lineWidth = 1;
      cx.beginPath();
      cx.moveTo(x, y(k[2]));
      cx.lineTo(x, y(k[3]));
      cx.stroke();
      cx.fillRect(x - bw * 0.3, Math.min(y(k[1]), y(k[4])), bw * 0.6, Math.max(1.5, Math.abs(y(k[1]) - y(k[4]))));
    }
    const x0 = split;
    const y0 = y(last);
    const x1 = x0 + (W - split - 52) * q;
    const yu = y0 + (y(up) - y0) * q;
    const yd = y0 + (y(dn) - y0) * q;
    const cone = cx.createLinearGradient(x0, 0, W, 0);
    cone.addColorStop(0, lt ? 'rgba(52,98,214,.14)' : 'rgba(143,178,255,.13)');
    cone.addColorStop(1, 'rgba(143,178,255,0)');
    cx.fillStyle = cone;
    cx.beginPath();
    cx.moveTo(x0, y0);
    cx.lineTo(x1, yu);
    cx.lineTo(x1, yd);
    cx.closePath();
    cx.fill();
    cx.setLineDash([6, 5]);
    cx.lineWidth = 1.6;
    cx.strokeStyle = lt ? 'rgba(30,142,62,.85)' : 'rgba(96,200,140,.9)';
    cx.beginPath();
    cx.moveTo(x0, y0);
    cx.lineTo(x1, yu);
    cx.stroke();
    cx.strokeStyle = lt ? 'rgba(197,57,41,.85)' : 'rgba(235,120,110,.9)';
    cx.beginPath();
    cx.moveTo(x0, y0);
    cx.lineTo(x1, yd);
    cx.stroke();
    cx.setLineDash([]);
    cx.fillStyle = lt ? '#3462d6' : '#8fb2ff';
    cx.beginPath();
    cx.arc(x0, y0, 3, 0, 6.283);
    cx.fill();
    cx.font = '600 10.5px Geist,"Noto Sans KR",sans-serif';
    if (q > 0.96) {
      cx.fillStyle = lt ? 'rgba(30,142,62,.95)' : 'rgba(96,200,140,1)';
      cx.fillText('상방 ' + +up.toPrecision(5), x1 + 6, yu + 3.5);
      cx.fillStyle = lt ? 'rgba(197,57,41,.95)' : 'rgba(235,120,110,1)';
      cx.fillText('하방 ' + +dn.toPrecision(5), x1 + 6, yd + 3.5);
    }
    if (q < 1) raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(raf);
}

export function ChartCard({ it }: { it: ChartItem }) {
  const c = G.chart && G.chart.cid === it.cid ? G.chart : null;
  const rev = G.chartRev;
  const cv = useRef<HTMLCanvasElement>(null);
  const fcBox = useRef<HTMLDivElement>(null);
  /* taiChartRender(): 지금 대화의 차트만 위젯을 띄운다. 간격이나 범위가 바뀌면 다시 띄운다 */
  useEffect(() => {
    if (!c) return;
    let dead = false;
    taiTv(() => {
      const host = document.getElementById(c.cid);
      const TV = (window as TvWin).TradingView;
      if (dead || !host || !TV) return;
      host.innerHTML = '';
      new TV.widget({ container_id: c.cid, symbol: c.tv, interval: c.interval, range: c.range || undefined, autosize: true, theme: document.body.classList.contains('light') ? 'light' : 'dark', locale: 'kr', hide_side_toolbar: true, allow_symbol_change: false, save_image: false, hide_top_toolbar: false });
    });
    return () => {
      dead = true;
    };
  }, [c && c.cid, c && c.tv, c && c.interval, c && c.range, rev]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const j = G.ohlc;
    if (!it.fc || !cv.current || !j) return;
    /* 위에서 읽는 중이면 끼어든 높이만큼 스크롤을 맞춰 본문이 밀리지 않게 한다 */
    const fc = fcBox.current;
    const sf = document.getElementById('g-scroll');
    if (G.stick === false && sf && fc && fc.offsetHeight) {
      const fr = fc.getBoundingClientRect();
      const srr = sf.getBoundingClientRect();
      if (fr.top < srr.top + srr.height * 0.5) {
        G.autoAt = Date.now();
        sf.scrollTop += fc.offsetHeight;
      }
    }
    return drawForecast(cv.current, j);
  }, [it.fc]);
  const px = it.px;
  return (
    <>
      {it.pip != null && <div className="g-pip-ph" style={{ height: it.pip + 'px' }} />}
      <div className={'g-chartcard' + (it.pip != null ? ' pip' : '')}>
        <div className="hd">
          <span>{it.label}</span>
          {px && (
            <span className={'px' + (px.flash ? ' fl-' + px.flash : '')} key={px.flash ? 'f' + px.last : 'p'}>
              {String(px.last)}
              <em className={px.up ? 'u' : 'd'}>
                {(px.up ? '+' : '') + px.chg + '% ' + px.per}
              </em>
              <i>{px.at + ' 업데이트'}</i>
            </span>
          )}
          <span className="tvtag">TradingView</span>
        </div>
        <div className="bd" id={it.cid} />
        {it.fc != null && (
          <div className="fc" ref={fcBox}>
            <canvas ref={cv} />
            <div className="lb">최근 30봉 관측 범위 기반 시나리오, 참고용, 예측 보장 아님</div>
          </div>
        )}
      </div>
    </>
  );
}
