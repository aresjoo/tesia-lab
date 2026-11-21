// 터미널 오른쪽 판단 패널. 원본 tfTmBrain, tfTmFeed, tfTmDash, tfTmDone 과 뒤쪽에서 덮어쓴 sk-brain 계열
// (tfTmStatusBlock 최종본, tbThought, tbRuleLog, tbText, mktRailMount, mktHoldFix)을 합친 마지막 모양이다.
import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react';
import { fmtDate, idxToDate, mkPx, PRICE0, rsi, sma, type LogEv } from '../../../core/trade/engine';
import { tfTmSay, type Seg } from '../../../core/trade/say';
import { bcInit } from '../../../core/account/bc';
import { sktDate, tfAssetTicker, tfNFTime, tfTmAgo, tfTmDate, TF_TM_EVM, TF_TM_OPM, tfTmPct, tfTmPx, tfTmSign, tfTmWon, tfTmWonS, type TermCalc, type TermRow } from '../../../core/trade/term';
import { brainText } from '../../../core/trade/text';
import { tfIns2Ask } from '../bridge';
import { getPreview, getTf } from '../store';
import { tfTmTradeDlg, tfTmVerDlg } from './dialogs';
import { TermSide } from './Copy';
import { MktChev, TbIcon, Thought } from './parts';
import { capUpdate, setTm, TF_TM, tfTmApply, tfTmEvalAt, tfTmInert, tfTmReconnect, tfTmSetStatus, type BrainTab } from './tm';

type Bt = (t: string) => string;

/** tfTmStatusBlock(s,c): 지금 무엇을 들고 있는지. 금액 대신 진입가 대비 % */
function StatusBlock({ s, c, B }: { s: TermRow; c: TermCalc; B: Bt }) {
  const p = s.p;
  const st = s.status;
  const watch = !getPreview() && bcInit().mode === 'watch';
  const inPos = !!(c.pos && st === 'live');
  const tk = tfAssetTicker(s.asset);
  const head = st === 'live' ? (watch ? 'AI 판단이 잠시 멈춰 있습니다' : inPos ? tk + ' 롱 포지션을 보유하고 있습니다' : '진입 조건을 기다리고 있습니다') : st === 'off' ? '일시정지 중입니다' : st === 'ready' ? '실행 전입니다' : '연결 오류로 멈췄습니다';
  const ex = s.exL || '';
  const row = (k: string, v: ReactNode) => (
    <div className="tb-r">
      <span>{B(k)}</span>
      <b className="num">{v}</b>
    </div>
  );
  let th = '';
  let rows: ReactNode;
  if (inPos && c.pos) {
    const pc = c.pos.chg * 100;
    const left = Math.max(0, 25 - c.pos.bars);
    rows = (
      <>
        {row(
          '포지션',
          <>
            {B('롱 ' + c.pos.qty.toFixed(4) + ' ' + tk + ' ')}
            <i className={pc > 0.05 ? 'u' : pc < -0.05 ? 'd' : 'z'}>{tfTmPct(pc, 1)}</i>
          </>,
        )}
        {row('손절', B('진입가 대비 ' + p.sl + '%'))}
        {c.pos.tpP ? row('익절', B('진입가 대비 +' + p.tp + '%')) : null}
        {row('보유 기간', B(c.pos.bars + '일, 최대 25일'))}
      </>
    );
    th = '저는 정해 둔 청산 조건에 따라 ' + tk + ' 롱을 유지합니다. 진입가 대비 ' + p.sl + '%에 닿거나' + (c.pos.tpP ? ' +' + p.tp + '%에 닿거나' : '') + ' ' + left + '일 뒤 보유 기간이 끝나면 정리합니다.';
  } else {
    rows = (
      <>
        {row('포지션', B(c.flat ? '없음, 긴급 정지로 정리됨' : '없음'))}
        {row('진입 조건', B('RSI ' + p.rsiTh + ' 아래에서 0.5% 넘게 반등' + (p.trendFilter ? ', 20일과 60일 평균 차이 3% 초과' : '')))}
      </>
    );
    if (st === 'live') th = '저는 지금 포지션 없이 기다립니다. RSI가 ' + p.rsiTh + ' 아래로 눌렸다가 하루 0.5% 넘게 반등하는 날에만 진입합니다.';
    else if (st === 'off') th = '일시정지 중이라 새 주문을 내지 않습니다. 다시 시작하면 다음 봉 마감부터 판단합니다.';
  }
  return (
    <>
      <div className={'tm-status tb st-' + st}>
        <h3 className="tb-t">{B(head)}</h3>
        <p className="tb-d">
          {ex ? <TbIcon id={s.ex} /> : null}
          <span>
            {B((ex ? ex + (st === 'live' ? '에서 운용 중,' : '에 연결,') : '') + ' 마지막 확인 ')}
            <b id="tm-lastchk">{tfTmAgo(tfTmEvalAt(s))}</b>
          </span>
        </p>
        <div className="tb-list">{rows}</div>
        {watch && <p className="tb-w">{B('이용 한도로 AI 판단이 멈춰 있습니다. 손절과 익절 규칙은 계속 작동합니다.')}</p>}
      </div>
      <Thought t={th} B={B} />
    </>
  );
}

/** tfTmRow(label,val,state) */
function Row({ label, val, state, B }: { label: string; val: string; state: 'ok' | 'no' | 'hit' | 'na'; B: Bt }) {
  const mark = state === 'ok' ? '✓' : state === 'no' ? '✗' : state === 'hit' ? '✓ 도달' : '미도달';
  return (
    <div className="tm-row">
      <span>{B(label)}</span>
      <b className="num">{B(val)}</b>
      <i className={state}>{B(mark)}</i>
    </div>
  );
}
type FeedEv = { k: LogEv['k']; i: number; txt: string; entryI: number | null };
/** tfLogCardRule(ev,s) 의 검사표와 결과 줄. 원본대로 비트코인 가격 줄(전역 PRICE)로 센다 */
function ruleBody(ev: FeedEv, s: TermRow, B: Bt): { rows: ReactNode; outs: ReactNode } {
  const PRICE = PRICE0;
  const p = s.p;
  const i = ev.i;
  const px = PRICE[i];
  const k = ev.k;
  const rows: ReactNode[] = [];
  let outs: ReactNode = null;
  if (k === 'watch' || k === 'entry') {
    const rp = rsi(PRICE, i - 1);
    const chg = (PRICE[i] / PRICE[i - 1] - 1) * 100;
    const s20 = sma(PRICE, 20, i);
    const s60 = sma(PRICE, 60, i);
    const gap = s20 != null && s60 != null ? (Math.abs(s20 - s60) / px) * 100 : null;
    rows.push(<Row key="a" label={'전봉 RSI < ' + p.rsiTh} val={rp.toFixed(1)} state={rp < p.rsiTh ? 'ok' : 'no'} B={B} />);
    rows.push(<Row key="b" label="반등 +0.5% 초과" val={(chg >= 0 ? '+' : '') + chg.toFixed(2) + '%'} state={chg > 0.5 ? 'ok' : 'no'} B={B} />);
    if (p.trendFilter) rows.push(<Row key="c" label="이평 괴리 > 3% (20/60)" val={gap == null ? '-' : gap.toFixed(1) + '%'} state={gap != null && gap > 3 ? 'ok' : 'no'} B={B} />);
    if (k === 'entry') {
      outs = (
        <>
          <div className="tm-out">
            <small>{B('주문')}</small>
            {B('시장가 매수 ' + (s.cap / px).toFixed(4) + ' ' + tfAssetTicker(s.asset) + ', ' + tfTmPx(px) + ' (시뮬레이션)')}
          </div>
          <div className="tm-out">
            <small>{B('리스크 규칙')}</small>
            {B('손절 ' + tfTmPx(px * (1 + p.sl / 100)) + ' (' + p.sl + '%)' + (p.tp != null ? ', 익절 ' + tfTmPx(px * (1 + p.tp / 100)) + ' (+' + p.tp + '%)' : '') + ', 25봉 청산')}
          </div>
        </>
      );
    }
  } else {
    const eI = ev.entryI != null ? ev.entryI : i;
    const ep = PRICE[eI];
    const ch2 = (px / ep - 1) * 100;
    const held = i - eI;
    const cur = (ch2 >= 0 ? '+' : '') + ch2.toFixed(1) + '%';
    rows.push(<Row key="a" label={'손절 ' + p.sl + '% (' + tfTmPx(ep * (1 + p.sl / 100)) + ')'} val={cur} state={k === 'exit-sl' ? 'hit' : 'na'} B={B} />);
    if (p.tp != null) rows.push(<Row key="b" label={'익절 +' + p.tp + '% (' + tfTmPx(ep * (1 + p.tp / 100)) + ')'} val={cur} state={k === 'exit-tp' ? 'hit' : 'na'} B={B} />);
    rows.push(<Row key="c" label="25봉 청산" val={held + '/25봉'} state={k === 'exit-time' ? 'hit' : 'na'} B={B} />);
    if (k !== 'risk') {
      const xp = k === 'exit-sl' ? ep * (1 + p.sl / 100) : k === 'exit-tp' ? ep * (1 + (p.tp as number) / 100) : px;
      const pnl = (xp / ep - 1) * 100;
      outs = (
        <>
          <div className="tm-out">
            <small>{B('주문')}</small>
            {B('시장가 매도 전량, ' + tfTmPx(xp) + ' (시뮬레이션)')}
          </div>
          <div className="tm-out">
            <small>{B('결과')}</small>
            <b className={tfTmSign(pnl)}>{tfTmPct(pnl, 1)}</b>
            {B(', 보유 ' + held + '봉')}
          </div>
        </>
      );
    }
  }
  return { rows: <div className="tm-rows">{rows}</div>, outs };
}

/** TB_RULE: 규칙형 기록의 꼬리표와 한 문장 */
const TB_RULE: Record<string, [string, string]> = { ho: ['보유 유지', '손절과 익절 조건에 닿지 않아 그대로 들고 있습니다.'], wa: ['관망', '진입 조건이 맞지 않아 주문을 내지 않았습니다.'], en: ['진입', '진입 조건이 모두 맞아 롱 포지션을 열었습니다.'], tp: ['익절 청산', '익절 목표에 닿아 정리했습니다.'], sl: ['손절 청산', '손절 기준에 닿아 정리했습니다.'], tm: ['기간 청산', '최대 보유 기간이 지나 정리했습니다.'] };

/** tfTmFeed(s,c) + tbRuleLog(): 운영 기록, 연속 관망 묶음, 날짜와 꼬리표와 한 문장으로 접힌 판단 기록 */
function Feed({ s, c, B }: { s: TermRow; c: TermCalc; B: Bt }) {
  const t = getTf();
  const ops = ((t.termLog && t.termLog[s.key]) || []).slice().reverse();
  let entryI: number | null = null;
  let evs: FeedEv[] = [];
  c.L.evs.forEach((e) => {
    if (!e) return;
    if (e.k === 'entry') entryI = e.i;
    evs.push({ k: e.k, i: e.i, txt: e.txt, entryI });
  });
  evs.reverse();
  if (TF_TM.fmode === 'act') evs = evs.filter((e) => e.k === 'entry' || e.k.indexOf('exit') === 0);
  /* 연속 미충족 둘 이상은 칩 하나로 */
  const packed: (FeedEv | { grp: FeedEv[] })[] = [];
  let i9 = 0;
  while (i9 < evs.length) {
    const e9 = evs[i9];
    if (e9.k === 'watch') {
      let j9 = i9;
      while (j9 + 1 < evs.length && evs[j9 + 1].k === 'watch') j9++;
      if (j9 - i9 + 1 >= 2) {
        packed.push({ grp: evs.slice(i9, j9 + 1) });
        i9 = j9 + 1;
        continue;
      }
    }
    packed.push(e9);
    i9++;
  }
  const shown = packed.slice(0, TF_TM.feedN);
  /* tbRuleLog: 검사표 카드를 문서 순서대로 모아(펼친 묶음 안의 카드 포함) 같은 결론이 이어지면 묶는다 */
  const cards: FeedEv[] = [];
  const folds: ReactNode[] = [];
  shown.forEach((it) => {
    if (!('grp' in it)) {
      cards.push(it);
      return;
    }
    const grp = it.grp;
    const wk = 'wf' + s.key + '_' + grp[0].i;
    const open = !!TF_TM.exp[wk];
    const iN = grp[0].i;
    const i0 = grp[grp.length - 1].i;
    const days = iN - i0 + 1;
    if (open) grp.slice(0, 30).forEach((e) => cards.push(e));
    folds.push(
      <div className="tm-foldw" key={wk}>
        <button type="button" className="tm-fold" aria-expanded={open} onClick={() => setTm({ exp: { ...TF_TM.exp, [wk]: !TF_TM.exp[wk] } })}>
          <span className="num">{B(tfTmDate(i0) + ' ~ ' + tfTmDate(iN))}</span>
          <b>{B('관망 유지, ' + grp.length + '회, ' + days + '일')}</b>
          <i>{open ? '접기' : '펼치기'}</i>
        </button>
        {open && <div className="tm-foldx">{grp.length > 30 && <div className="tm-foldn">{B('이전 ' + (grp.length - 30) + '회도 같은 결과(조건 미충족)입니다')}</div>}</div>}
      </div>,
    );
  });
  const groups: { cls: string; n: number; to: number; from: number; el: FeedEv }[] = [];
  cards.forEach((cd) => {
    const cls = (TF_TM_EVM[cd.k] || ['판단', 'ho'])[1];
    const g = groups[groups.length - 1];
    if (g && g.cls === cls && (cls === 'ho' || cls === 'wa')) {
      g.n++;
      g.from = cd.i;
      return;
    }
    groups.push({ cls, n: 1, to: cd.i, from: cd.i, el: cd });
  });
  const yr = (d: string) => d.replace(/^\d{4}\. /, '');
  return (
    <>
      {ops.length > 0 && (
        <>
          <div className="tft-fsec">{B('운영 기록')}</div>
          {ops.slice(0, 4).map((o) => {
            const m = TF_TM_OPM[o.type] || [o.type, 'op'];
            const diff = o.extra && (o.extra as { diff?: string }).diff;
            return (
              <div className={'tft-ev ' + m[1]} key={o.id}>
                <span className="ax">
                  <i />
                </span>
                <div className="bd">
                  <div className="mh">
                    <span className="tm num">{B(tfNFTime(o.at))}</span>
                    <span className="bg">{B(m[0])}</span>
                    {o.ver ? <span className="vr num">{B(o.ver)}</span> : null}
                  </div>
                  <div className="tx">{B(o.txt)}</div>
                  {diff ? <div className="tx2">{B(diff)}</div> : null}
                </div>
              </div>
            );
          })}
        </>
      )}
      {s.status === 'err' && (
        <div className="tft-ev sl">
          <span className="ax">
            <i />
          </span>
          <div className="bd">
            <div className="mh">
              <span className="bg">{B('오류')}</span>
            </div>
            <div className="tx">{B(s.errMsg || '거래소 연결 오류')}</div>
            <div className="tx2">
              <a onClick={() => tfTmReconnect(s.key)} style={{ color: 'var(--gb2)', cursor: 'pointer' }}>
                {B('다시 연결')}
              </a>
            </div>
          </div>
        </div>
      )}
      <div className="tft-fsec" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {'판단 기록 '}
        <span style={{ flex: 1 }} />
        <button type="button" className={'ffc' + (TF_TM.fmode !== 'act' ? ' on' : '')} onClick={() => setTm({ fmode: 'all' })}>
          {B('전체')}
        </button>
        <button type="button" className={'ffc' + (TF_TM.fmode === 'act' ? ' on' : '')} onClick={() => setTm({ fmode: 'act' })}>
          {B('체결만')}
        </button>
      </div>
      {!evs.length && (
        <div className="tm-empty sm">
          <b>{B('아직 판단 기록이 없습니다')}</b>
          <span>{B('첫 평가가 끝나면 여기에 표시됩니다.')}</span>
        </div>
      )}
      {folds}
      {packed.length > TF_TM.feedN && (
        <button type="button" className="tft-more" onClick={() => setTm({ feedN: TF_TM.feedN + 20 })}>
          {B('이전 판단 더 보기 (' + (packed.length - TF_TM.feedN) + ')')}
        </button>
      )}
      {groups.length > 0 && (
        <div className="tb-feed tb-rfeed">
          {groups.map((g) => {
            const m = TB_RULE[g.cls] || TB_RULE.ho;
            const body = ruleBody(g.el, s, B);
            const to = sktDate(tfTmDate(g.to));
            const from = sktDate(tfTmDate(g.from));
            /* 묶음의 날짜 범위는 연도를 뗀다 (원본 tbRuleLog 의 from.replace(/^\d{4}\. /,'')).
               원본은 날짜 글자 바꾸기(sktText)가 먼저 돌았을 때만 연도가 떼어진다. 시세가 들어오는 보통 때가 그렇고,
               시세 주소가 모두 막힌 때는 순서가 뒤집혀 연도가 남는다. 여기서는 보통 때의 모양으로 고정한다 */
            const when = g.n > 1 ? yr(from) + ' ~ ' + yr(to) : to;
            return (
              <details className="tb-fc tb-rl" key={g.el.k + g.el.i}>
                <summary>
                  <span className="tb-ft num">{when}</span>
                  <b>{B(m[0] + (g.n > 1 ? ' ' + g.n + '회' : ''))}</b>
                  <span className="tb-fs">
                    {B(m[1] + ' ')}
                    <u className="tb-fx" aria-hidden="true" />
                  </span>
                </summary>
                <div className="tb-fr">
                  {body.rows}
                  {body.outs}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </>
  );
}

/** tfSS3Eq(eq,w,h,o): 검증 구간 누적 수익 곡선 */
export function SS3Eq({ eq, w, h, dates, tag }: { eq: { i: number; v: number }[]; w: number; h: number; dates?: boolean; tag?: boolean }) {
  const gid = useRef('eg' + Math.floor(Math.random() * 1e7)).current;
  if (!eq || eq.length < 2)
    return (
      <div className="ss3-empty" style={{ padding: '24px 0' }}>
        검증 곡선이 없습니다
      </div>
    );
  let min = 1e18;
  let max = -1e18;
  const i0 = eq[0].i;
  const i1 = eq[eq.length - 1].i;
  eq.forEach((e) => {
    if (e.v < min) min = e.v;
    if (e.v > max) max = e.v;
  });
  if (max - min < 1e-9) max = min + 1e-9;
  const padB = dates ? 18 : 4;
  const chh = h - 8 - padB;
  const X = (i: number) => ((i - i0) / Math.max(1, i1 - i0)) * w;
  const Y = (v: number) => 6 + chh - ((v - min) / (max - min)) * chh;
  const step = Math.max(1, Math.floor(eq.length / 120));
  const pts: string[] = [];
  for (let k = 0; k < eq.length; k += step) pts.push(X(eq[k].i).toFixed(1) + ',' + Y(eq[k].v).toFixed(1));
  pts.push(w.toFixed(1) + ',' + Y(eq[eq.length - 1].v).toFixed(1));
  const up = eq[eq.length - 1].v >= 1;
  const baseY = Y(Math.min(Math.max(1, min), max));
  const fd = (d: Date) => d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0');
  const maxPct = (max - 1) * 100;
  const col = up ? '#2fb98a' : '#ee766a';
  return (
    <svg className="ss3-eq" viewBox={'0 0 ' + w + ' ' + h} role="img" aria-label="검증 구간 누적 수익 곡선">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={col} stopOpacity=".15" />
          <stop offset="1" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line className="base" x1="0" y1={baseY.toFixed(1)} x2={w} y2={baseY.toFixed(1)} />
      <path fill={'url(#' + gid + ')'} stroke="none" d={'M' + pts.join(' L') + ' L' + w + ',' + (h - padB) + ' L0,' + (h - padB) + ' Z'} />
      <polyline className={'ln ' + (up ? 'up' : 'dn')} points={pts.join(' ')} />
      {tag && (
        <text className={'tag' + (up ? '' : ' dn')} x={w - 6} y="14" textAnchor="end">
          {(maxPct >= 0 ? '+' : '') + maxPct.toFixed(1) + '%'}
        </text>
      )}
      {dates && (
        <>
          <text x="2" y={h - 4}>
            {fd(idxToDate(i0))}
          </text>
          <text x={w - 2} y={h - 4} textAnchor="end">
            {fd(idxToDate(i1))}
          </text>
        </>
      )}
    </svg>
  );
}

/** 거래 한 건의 청산가: 손절과 익절은 규칙가, 기간 청산은 종가 */
export function exitPx(s: TermRow, tr: { entry: number; exit: number; kind: string }): number {
  const px = mkPx((s.p && s.p.px) || null);
  return tr.kind === 'sl' ? px[tr.entry] * (1 + s.p.sl / 100) : tr.kind === 'tp' ? px[tr.entry] * (1 + (s.p.tp as number) / 100) : px[tr.exit];
}
const usd0 = (n: number) => Math.round(n).toLocaleString();

/** tfTmDash(s,c): 대시보드 탭 */
function Dash({ s, c, B }: { s: TermRow; c: TermCalc; B: Bt }) {
  const r = c.r;
  const pf = r.lossCount === 0 && r.n > 0 ? '>9.9' : (r.pf || 0).toFixed(2);
  const wins = Math.round((r.n * (r.winRate || 0)) / 100);
  let big = 0;
  let bigL = 0;
  c.trades.forEach((tr) => {
    if (tr.krw > big) big = tr.krw;
    if (tr.krw < bigL) bigL = tr.krw;
  });
  const px = mkPx((s.p && s.p.px) || null);
  const lt = c.trades.slice(-25).reverse();
  const mg: [string, string, string][] = [
    ['승률', Math.round(r.winRate || 0) + '% (' + wins + 'W/' + (r.lossCount || 0) + 'L)', ''],
    ['최대 낙폭', (r.mdd || 0).toFixed(1) + '%', 'dn'],
    ['손익비', pf, ''],
    ['샤프', (r.sharpe || 0).toFixed(2), ''],
    ['평균 보유', (r.avgHold || 0).toFixed(1) + '봉', ''],
    ['시장 노출', Math.round(r.exposure || 0) + '%', ''],
    ['거래 수', r.n + '회', ''],
    ['최대 익/손', (big ? '+' + tfTmWon(big).replace('-', '') : '-') + ' / ' + (bigL ? tfTmWon(bigL) : '-'), ''],
  ];
  return (
    <>
      <div className="tft-pm num">
        <span className="c4">
          <small>{B('운용 자금')}</small>
          <b>{tfTmWon(s.cap)}</b>
        </span>
        <span className="c4">
          <small>
            {B('전략 NAV ')}
            <i>{B('시뮬레이션')}</i>
          </small>
          <b>{tfTmWon(c.nav)}</b>
        </span>
        <span className="c4">
          <small>{B('Total P&L')}</small>
          <b className={tfTmSign(c.pnl)}>
            {tfTmWonS(c.pnl) + ' '}
            <em>{tfTmPct(c.pnlPct)}</em>
          </b>
        </span>
        <span className="c4">
          <small>{B('실현 / 미실현')}</small>
          <b>
            <em className={tfTmSign(Math.abs(c.realized) < 1 ? 0 : c.realized)}>{tfTmWonS(c.realized)}</em>
            {' / '}
            <em className={tfTmSign(Math.abs(c.unreal) < 1 ? 0 : c.unreal)}>{tfTmWonS(c.unreal)}</em>
          </b>
        </span>
        <span className="c4" style={{ gridColumn: 'span 2' }}>
          <small>{B('수수료 (왕복 0.2%, 손익에 반영됨)')}</small>
          <b className="zz">{B('-' + tfTmWon(c.feeEst).replace('-', '') + ' 추정')}</b>
        </span>
      </div>
      <div className="tft-nav">
        <div className="nh2">
          {B('NAV 곡선 ')}
          <small>{B('검증 구간, 시뮬레이션')}</small>
        </div>
        {r.eq && r.eq.length > 1 ? (
          <SS3Eq eq={r.eq} w={700} h={150} dates />
        ) : (
          <div className="tft-empty" style={{ padding: '30px' }}>
            <b>{B('곡선 데이터가 없습니다')}</b>
          </div>
        )}
      </div>
      <div className="tft-mg num">
        {mg.map((m) => (
          <span className="c5" key={m[0]}>
            <small>{B(m[0])}</small>
            <b className={m[2]}>{B(m[1])}</b>
          </span>
        ))}
      </div>
      <div className="tft-fsec">{B('현재 포지션')}</div>
      {c.pos && s.status === 'live' ? (
        <div className="tft-posb num">
          <div className="pr1">
            <span className="sd lg">LONG</span>
            <b>{B(s.sym)}</b>
            <span className={tfTmSign(c.pos.chg * 100)} style={{ marginLeft: 'auto', fontWeight: 700 }}>
              {tfTmWonS(c.pos.krw) + ' (' + tfTmPct(c.pos.chg * 100, 1) + ')'}
            </span>
          </div>
          <div className="pr2">
            <span>
              <small>{B('진입가')}</small>
              <b>{'$' + usd0(c.pos.entryP)}</b>
            </span>
            <span>
              <small>{B('현재가')}</small>
              <b>{'$' + usd0(c.pos.curP)}</b>
            </span>
            <span>
              <small>{B('수량')}</small>
              <b>{c.pos.qty.toFixed(4)}</b>
            </span>
            <span>
              <small>{B('손절가')}</small>
              <b>{'$' + usd0(c.pos.stopP)}</b>
            </span>
            {c.pos.tpP ? (
              <span>
                <small>{B('목표가')}</small>
                <b>{'$' + usd0(c.pos.tpP)}</b>
              </span>
            ) : null}
            <span>
              <small>{B('보유')}</small>
              <b>{c.pos.bars + '봉'}</b>
            </span>
          </div>
        </div>
      ) : (
        <div className="tft-empty" style={{ padding: '26px 16px' }}>
          <b>{B('현재 포지션이 없습니다.')}</b>
          <span>{B(s.status === 'live' ? '진입 신호를 탐색하는 중입니다.' : '전략이 실행 중이 아닙니다.')}</span>
        </div>
      )}
      <div className="tft-fsec">
        {B('최근 거래 ')}
        <small>{lt.length + '건'}</small>
      </div>
      {lt.length ? (
        <div className="tft-tblw">
          <table className="tft-tbl">
            <thead>
              <tr>
                <th>{B('청산일')}</th>
                <th>{B('구분')}</th>
                <th className="r">{B('진입가')}</th>
                <th className="r">{B('청산가')}</th>
                <th className="r">{B('보유')}</th>
                <th className="r">{B('손익')}</th>
              </tr>
            </thead>
            <tbody>
              {lt.map((tr) => (
                <tr key={tr.entry} onClick={() => tfTmTradeDlg(s.key, tr.entry)}>
                  <td>{fmtDate(idxToDate(tr.exit))}</td>
                  <td>{B(({ sl: '손절', tp: '익절', time: '기간' } as Record<string, string>)[tr.kind] || tr.kind)}</td>
                  <td className="r num">{usd0(px[tr.entry])}</td>
                  <td className="r num">{usd0(exitPx(s, tr))}</td>
                  <td className="r num">{tr.exit - tr.entry + '봉'}</td>
                  <td className={'r num ' + tfTmSign(tr.krw)}>{tfTmWonS(tr.krw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tft-empty" style={{ padding: '22px' }}>
          <b>{B('이 구간 체결이 없습니다')}</b>
        </div>
      )}
      <div className="tft-vh">
        <a onClick={() => tfTmVerDlg(s.key)}>{B('버전 기록 보기 (' + s.ver + ')')}</a>
      </div>
    </>
  );
}

/** tfTmDone(s,c): 완료된 거래 탭 */
function Done({ s, c, B }: { s: TermRow; c: TermCalc; B: Bt }) {
  const tr = c.trades.slice().reverse().slice(0, 12);
  const px = mkPx((s.p && s.p.px) || null);
  if (!tr.length)
    return (
      <div className="tft-empty" style={{ padding: '50px 16px' }}>
        <b>{B('완료된 거래가 없습니다')}</b>
        <span>{B('검증 구간에서 완결된 거래가 생기면 여기에 정리됩니다.')}</span>
      </div>
    );
  return (
    <>
      <div className="tft-fsec">
        {B('완료된 거래 ')}
        <small>{B(c.trades.length + '건 중 최근 ' + tr.length + ', 시뮬레이션')}</small>
      </div>
      {tr.map((t2) => {
        const evE = c.L.evs[t2.entry - s.p.startI];
        const evX = c.L.evs[t2.exit - s.p.startI];
        return (
          <div className="tft-ct num" key={t2.entry}>
            <div className="h4">
              <span className="sd lg">LONG</span>
              <b>{B(s.asset)}</b>
              <span className={tfTmSign(t2.krw)} style={{ marginLeft: 'auto', fontWeight: 700 }}>
                {tfTmWonS(t2.krw) + ' '}
                <small>{'(' + tfTmPct(t2.pnl * 100, 1) + ')'}</small>
              </span>
            </div>
            <div className="g4">
              <span>
                <small>{B('진입')}</small>
                <b>{'$' + usd0(px[t2.entry])}</b>
              </span>
              <span>
                <small>{B('청산')}</small>
                <b>{'$' + usd0(exitPx(s, t2))}</b>
              </span>
              <span>
                <small>{B('보유')}</small>
                <b>{t2.exit - t2.entry + '봉'}</b>
              </span>
              <span>
                <small>{B('수수료')}</small>
                <b>{tfTmWon(t2.capB * 0.002)}</b>
              </span>
            </div>
            <div className="wy">
              <small>WHY ENTERED</small>
              {B(evE ? evE.txt : '진입 조건 충족')}
            </div>
            <div className="wy">
              <small>WHY EXITED</small>
              {B(evX ? evX.txt : '청산 규칙 실행')}
            </div>
            <button type="button" className="dt2" onClick={() => tfTmTradeDlg(s.key, t2.entry)}>
              {B('전체 판단 기록 →')}
            </button>
          </div>
        );
      })}
    </>
  );
}

const segs = (body: Seg[], B: Bt) =>
  body.map((x, i) => (typeof x === 'string' ? <Fragment key={i}>{B(x)}</Fragment> : 'b' in x ? <b key={i}>{B(x.b)}</b> : <br key={i} />));

/** #tft-prop: 질문의 답, 변경안 대조표, 적용 뒤 안내 */
function PropView({ s, c, B }: { s: TermRow; c: TermCalc; B: Bt }) {
  const pr = TF_TM.prop;
  if (!pr) return null;
  const close = () => setTm({ prop: null });
  if (pr.kind === 'applied')
    return (
      <div className="tft-applied">
        <span>{B(pr.nv + ' 적용 완료. 안전을 위해 전략은 중지 상태입니다.')}</span>
        <button
          type="button"
          onClick={() => {
            tfTmSetStatus(pr.key, 'live');
            setTm({ prop: null });
          }}
        >
          {B('바로 재개')}
        </button>
      </div>
    );
  if (pr.kind === 'ans')
    return (
      <div className="tft-ans">
        <b>{B(pr.title)}</b>
        <p>{segs(pr.body, B)}</p>
        <div className="acts">
          {pr.acts.map((a) =>
            a === 'deep' ? (
              <button key={a} onClick={() => tfIns2Ask(s.name + ' 전략(' + s.sym + ', 검증 수익 ' + c.r.ret.toFixed(1) + '%, MDD ' + c.r.mdd.toFixed(1) + '%)에 대해 더 깊게 분석해줘')}>
                {B('채팅에서 깊게 분석 →')}
              </button>
            ) : a === 'last' ? (
              <button
                key={a}
                onClick={() => {
                  if (TF_TM.lastQ) tfIns2Ask(TF_TM.lastQ + '. 이 전략 변경이 가능한지 알려줘');
                }}
              >
                {B('채팅에서 논의 →')}
              </button>
            ) : (
              <button key={a} onClick={close}>
                {B('닫기')}
              </button>
            ),
          )}
        </div>
      </div>
    );
  if (pr.kind !== 'diff') return null;
  const im = pr.imp;
  return (
    <div className="tft-diff num">
      <div className="dh4">
        {B('전략 변경안 ')}
        <small>{B(pr.ver + ' 기준, 재검증 실계산')}</small>
      </div>
      <div className="dt3">
        <span className="hd5">{B('항목')}</span>
        <span className="hd5">CURRENT</span>
        <span className="hd5">PROPOSED</span>
        <span className="hd5">Δ</span>
        {pr.rows.map((rw) => (
          <Fragment key={rw[0]}>
            <span>{B(rw[0])}</span>
            <span className="cu">{B(rw[1])}</span>
            <span className="pp2">{B(rw[2])}</span>
            <span className="dl">{B(rw[3])}</span>
          </Fragment>
        ))}
      </div>
      <div className="imp">
        <span>
          <small>{B('검증 수익')}</small>
          <b>
            {im.ret0 + ' → '}
            <em className={im.retCls}>{im.ret1}</em>
          </b>
        </span>
        <span>
          <small>{B('최대 낙폭')}</small>
          <b>
            {im.mdd0 + ' → '}
            <em className={im.mddCls}>{im.mdd1}</em>
          </b>
        </span>
        <span>
          <small>{B('거래 수')}</small>
          <b>{im.n0 + ' → ' + im.n1 + '회'}</b>
        </span>
        <span>
          <small>{B('재검증 점수')}</small>
          <b className={im.pass ? 'up' : 'dn'}>{B(im.sc2 + '점 ' + (im.pass ? '통과' : '기준 미달'))}</b>
        </span>
      </div>
      {pr.notes.length > 0 && <div className="nt2">{B(pr.notes.join(', '))}</div>}
      {pr.un.length > 0 && <div className="nt2 warn">{B('미지원이라 반영 안 됨: ' + pr.un.join(', '))}</div>}
      <div className="nt2">{B('요청 원문: "' + (pr.msg.length > 60 ? pr.msg.slice(0, 60) + '…' : pr.msg) + '". 위 표의 항목만 반영됩니다. 원문의 다른 표현은 해석되지 않았습니다.')}</div>
      {pr.live && (
        <div className="nt2">
          {B('적용 시 이 전략은 ')}
          <b>{B('중지')}</b>
          {B('됩니다. 자동 재개는 없으며, 확인 후 직접 재개해야 합니다.')}
        </div>
      )}
      <div className="acts2">
        <button className="rej" onClick={() => setTm({ cand: null, prop: null })}>
          {B('취소')}
        </button>
        {im.pass ? (
          <button className="ap" onClick={tfTmApply}>
            {B(pr.live ? '중지하고 적용' : '변경 적용')}
          </button>
        ) : (
          <button className="ap" disabled title="재검증 기준(80점) 미달">
            {B('기준 미달, 적용 불가')}
          </button>
        )}
      </div>
    </div>
  );
}

/** tfTmSay(msg): 질문이면 답을 띄우고, 수정 요청이면 재검증한 변경안을 띄운다 */
function say(msg: string, s: TermRow, c: TermCalc) {
  if (tfTmInert()) return;
  const r = tfTmSay(msg, s, c);
  if (!r) return;
  if (r.kind === 'cap') {
    /* 원본은 예산을 바꾼 뒤 「운용 예산을 바꿨습니다」 답을 만들지만, 그 전에 판단 패널을 다시 그려서(tfTmAfter)
       답이 떨어져 나간 옛 칸에 들어가 화면에는 나오지 않는다. 운영 기록 한 줄만 남는다. 그 모양을 따른다 */
    capUpdate(s.key, r.n);
    setTm({ prop: null });
    return;
  }
  if (r.kind === 'diff') {
    setTm({ cand: r.cand, prop: r });
    return;
  }
  setTm({ prop: r, lastQ: r.lastQ || TF_TM.lastQ });
}

const BTABS: [BrainTab, string][] = [['agent', '판단'], ['dash', '대시보드'], ['done', '완료된 거래']];
const CHIPS = ['왜 아직 진입 안 했어?', '지금 가장 큰 리스크는?', '다음 진입 조건은?', '더 보수적으로 바꿔줘'];

/** tfTmBrain(): 판단 패널 */
export function Brain({ s, c, count }: { s: TermRow | null; c: TermCalc | null; count: number }) {
  const input = useRef<HTMLInputElement>(null);
  const bbody = useRef<HTMLDivElement>(null);
  /* 원본은 판단 패널을 통째로 다시 그려서(tfTmBrain) 탭, 접힘, 걸러 보기, 전략과 상태가 바뀌면 기록 칸이 맨 위로 돌아간다 */
  useLayoutEffect(() => {
    if (bbody.current) bbody.current.scrollTop = 0;
  }, [s && s.key, s && s.status, s && s.ver, s && s.cap, s && s.name, TF_TM.tab, TF_TM.fmode, TF_TM.feedN, TF_TM.exp]);
  if (!s || !c) return <TermSide />;
  const pv = getPreview();
  /* 포지션을 들고 있으면 문구를 보유 기준으로 (mktHoldFix) */
  const hold = s.status === 'live' && !!c.pos;
  const B: Bt = (t) => brainText(t, hold);
  const tab = TF_TM.tab;
  const sayGo = () => {
    const el = input.current;
    if (!el || !el.value.trim()) return;
    const v = el.value.trim();
    el.value = '';
    say(v, s, c);
  };
  /** tfTmQuick(k): 손절, 익절, 예산 빠른 수정은 입력칸을 채운다 */
  const quick = (k: 'sl' | 'tp' | 'cap') => {
    if (tfTmInert()) return;
    const el = input.current;
    if (!el) return;
    const p = s.p;
    el.value = k === 'sl' ? '손절 ' + p.sl + '%로 바꿔줘' : k === 'tp' ? '익절 +' + (p.tp != null ? p.tp : 10) + '%로 바꿔줘' : '예산 ' + Math.round(s.cap / 1000).toLocaleString() + '달러로 바꿔줘';
    el.focus();
    try {
      el.setSelectionRange(0, el.value.length);
    } catch {
      /* 무시 */
    }
  };
  return (
    <>
      <div className="mks-hd">
        <button
          type="button"
          className="mks-btn"
          aria-haspopup="true"
          onClick={(e) => {
            e.stopPropagation();
            setTm({ railOpen: !TF_TM.railOpen });
          }}
        >
          <span>{B('전략 ' + count + '개')}</span>
          <b>{B(s.name)}</b>
          <MktChev />
        </button>
      </div>
      <div className="tft-btabs">
        {BTABS.map((tb) => (
          <button key={tb[0]} className={tab === tb[0] ? 'on' : ''} onClick={() => setTm({ tab: tb[0] })}>
            {B(tb[1])}
          </button>
        ))}
      </div>
      {tab === 'agent' && <StatusBlock s={s} c={c} B={B} />}
      <div className="tft-bbody" id="tft-bbody" ref={bbody} data-tb={tab === 'agent' ? '1' : undefined}>
        {tab === 'agent' ? <Feed s={s} c={c} B={B} /> : tab === 'dash' ? <Dash s={s} c={c} B={B} /> : <Done s={s} c={c} B={B} />}
      </div>
      {tab === 'agent' && (
        <div className="tft-comp">
          <div id="tft-prop">
            <PropView s={s} c={c} B={B} />
          </div>
          <div className="tm-manage">
            <small>{B('전략 관리')}</small>
            <button type="button" onClick={() => quick('sl')}>
              {B('손절 ' + s.p.sl + '%')}
            </button>
            <button type="button" onClick={() => quick('tp')}>
              {B('익절 ' + (s.p.tp != null ? '+' + s.p.tp + '%' : '없음'))}
            </button>
            <button type="button" onClick={() => quick('cap')}>
              {B('예산 ' + tfTmWon(s.cap))}
            </button>
          </div>
          <div className="chips">
            {CHIPS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={(e) => {
                  /* 원본은 단추에 보이는 글자를 그대로 보낸다 */
                  say(e.currentTarget.textContent || '', s, c);
                }}
              >
                {B(q)}
              </button>
            ))}
          </div>
          <div className="row">
            <input
              id="tft-say"
              placeholder="예: 손절을 -3%로 바꿔 주십시오"
              disabled={pv}
              ref={input}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sayGo();
              }}
            />
            <button className="snd" aria-label="보내기" disabled={pv} onClick={sayGo}>
              ↵
            </button>
          </div>
        </div>
      )}
    </>
  );
}
