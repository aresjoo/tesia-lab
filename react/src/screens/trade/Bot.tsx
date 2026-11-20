// 전략(봇) 상세 #/trade/bot/<id> (원본 tfBotView, G.mode 'nfbot').
// 행동 기록(tfBotLogRender)과 전략 수정 창(tfBotEdit, tfBotEditRun, tfBotEditDirty, tfBotEditApply)까지 옮겼다.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TF_EX_NAME } from '../../core/account/derive';
import { fmtDate, idxToDate, PRICE0, runBacktest, tfBotLogEvents, tfScore } from '../../core/trade/engine';
import { TF_STOP } from '../../core/trade/say';
import { TFC, type RuleP, type Strat } from '../../core/trade/state';
import { nav } from '../../state/route';
import { toast } from '../../state/store';
import { getTf, updateTf, useTf } from './store';
import { TermOverlays, tfSS3Dlg, tfSS3DlgClose } from './term/overlay';
import { tfNotify } from '../../core/account/nf';
import { botCtl, tfNFCanRun } from './term/tm';

/** NFX_IC 가운데 이 화면이 쓰는 것 */
const Svg = ({ z, sw = 2, cls, children }: { z: number; sw?: number; cls?: string; children: ReactNode }) => (
  <svg className={cls} width={z} height={z} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const IcInfo = () => (
  <Svg z={14}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </Svg>
);
const IcZap = () => (
  <Svg z={15}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </Svg>
);
const IcWon = () => (
  <Svg z={17}>
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </Svg>
);
const IcTrend = () => (
  <Svg z={18}>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </Svg>
);
const IcChev = () => (
  <Svg z={14} sw={2.5} cls="nfx-arrow">
    <polyline points="9 18 15 12 9 6" />
  </Svg>
);
const IcEmpty = () => (
  <Svg z={24} sw={1.8}>
    <circle cx="12" cy="12" r="10" />
    <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </Svg>
);

/** tfWon(n) */
const tfWon = (n: number) => '$' + Math.round((+n || 0) / 1000).toLocaleString();
/** tfExOf(exId).name: 표에 없으면 첫 줄(Binance) */
const exName = (id: string) => TF_EX_NAME[id] || 'Binance';
/** tfBotFind(id) */
const tfBotFind = (id: string): Strat | undefined => (getTf().strat || []).find((x) => String(x.at) === String(id));

/** tfBotCtl(botId,act): 일시정지, 재개, 시작, 가상과 라이브 전환 */
function tfBotCtl(botId: string, act: 'pause' | 'resume' | 'start' | 'env') {
  updateTf((t) => {
    const b = (t.strat || []).find((x) => String(x.at) === botId);
    if (!b) return;
    if (act === 'env') {
      const toLive = b.env === 'paper';
      if (toLive && !tfNFCanRun(t)) return;
      b.env = toLive ? 'live' : 'paper';
      toast(b.env === 'paper' ? '가상 실행으로 전환했습니다' : '라이브(시뮬레이션)로 전환했습니다');
    } else botCtl(t, b, act);
  });
}

type Cand = { id: string; p: RuleP; r: { ret: number; mdd: number; n: number; winRate: number }; score: number };
type EditRes = null | { k: 'dirty' } | { k: 'res'; sc: number; ret: number; mdd: number; n: number; pass: boolean };
/** TFCOPY.intakeOpt.stop */
const STOPS: [string, string][] = [['-3%까지', '짧게 끊기'], ['-5%까지', '표준'], ['-8%까지', '여유있게'], ['-12%까지', '길게 버티기']];

/** tfBotEdit(botId) 의 창 안쪽: 후보는 따로 두고 재검증을 통과해야 같은 전략에만 적용한다 */
function BotEdit({ botId }: { botId: string }) {
  const b = tfBotFind(botId);
  const cand = useRef<Cand | null>(null);
  const [res, setRes] = useState<EditRes>(null);
  const [canApply, setCanApply] = useState(false);
  const sl = useRef<HTMLSelectElement>(null);
  const tp = useRef<HTMLSelectElement>(null);
  const rs = useRef<HTMLSelectElement>(null);
  const tf = useRef<HTMLSelectElement>(null);
  const [live] = useState(() => !!b && b.status === 'live');
  const [p] = useState(() => (b ? b.p : null));
  if (!b || !p) return null;
  const read = () => ({ sl: +sl.current!.value, tp: +tp.current!.value, rsiTh: +rs.current!.value, trendFilter: tf.current!.value === '1' });
  /** tfBotEditDirty() */
  const dirty = () => {
    cand.current = null;
    setCanApply(false);
    setRes({ k: 'dirty' });
  };
  /** tfBotEditRun(botId) */
  const run = () => {
    const cur = tfBotFind(botId);
    if (!cur || !cur.p) return;
    const p2: RuleP = { ...read(), startI: cur.p.startI, endI: cur.p.endI };
    const r = runBacktest({ ...p2, purpose: 'edit' });
    const sc = tfScore(r);
    const pass = sc >= TFC.score.pass;
    cand.current = pass ? { id: botId, p: p2, r: { ret: r.ret, mdd: r.mdd, n: r.n, winRate: r.winRate }, score: sc } : null;
    setRes({ k: 'res', sc, ret: r.ret, mdd: r.mdd, n: r.n, pass });
    setCanApply(pass);
  };
  /** tfBotEditApply(botId) */
  const apply = () => {
    const c = cand.current;
    if (!c || c.id !== botId) {
      toast('먼저 바꾼 설정으로 다시 돌려 봐 주십시오');
      return;
    }
    const v = read();
    if (v.sl !== c.p.sl || v.tp !== c.p.tp || v.rsiTh !== c.p.rsiTh || v.trendFilter !== c.p.trendFilter) {
      dirty();
      return;
    }
    let paused = false;
    updateTf((t) => {
      const x = (t.strat || []).find((y) => String(y.at) === botId);
      if (!x) return;
      x.p = { sl: c.p.sl, tp: c.p.tp, rsiTh: c.p.rsiTh, trendFilter: c.p.trendFilter, startI: c.p.startI, endI: c.p.endI };
      x.score = c.score;
      x.ret = c.r.ret;
      x.mdd = c.r.mdd;
      x.n = c.r.n;
      x.winRate = c.r.winRate;
      if (x.status === 'live') {
        x.status = 'off';
        paused = true;
      }
      tfNotify('bot', 'be:' + botId + ':' + Date.now(), x.name + ' 설정을 수정했습니다 (재검증 통과)', paused ? '적용을 위해 일시정지됐습니다. 재개하면 새 설정으로 실행됩니다.' : '다음 실행부터 새 설정이 적용됩니다.', '#/trade/bot/' + botId);
    });
    cand.current = null;
    tfSS3DlgClose();
    toast('전략 설정이 적용됐습니다' + (paused ? ' (일시정지됨)' : ''));
  };
  return (
    <div className="ss3-cp">
      <div className="ntc">{'설정을 바꾸면 같은 구간에서 다시 돌려 봅니다. 결과를 보고 이 전략에 적용할 수 있습니다.' + (live ? ' 적용 시 실행이 일시정지됩니다.' : '')}</div>
      <div className="fld3">
        <label htmlFor="tfbe-sl">손절선</label>
        <select id="tfbe-sl" ref={sl} onChange={dirty} defaultValue={TF_STOP.includes(p.sl) ? p.sl : undefined}>
          {TF_STOP.map((v, i) => (
            <option key={v} value={v}>
              {STOPS[i][0] + ' (' + STOPS[i][1] + ')'}
            </option>
          ))}
        </select>
      </div>
      <div className="fld3">
        <label htmlFor="tfbe-tp">익절 목표</label>
        <select id="tfbe-tp" ref={tp} onChange={dirty} defaultValue={p.tp != null && [8, 10, 12, 15].includes(p.tp) ? p.tp : undefined}>
          {[8, 10, 12, 15].map((v) => (
            <option key={v} value={v}>
              {'+' + v + '%'}
            </option>
          ))}
        </select>
      </div>
      <div className="fld3">
        <label htmlFor="tfbe-rsi">진입 RSI 임계</label>
        <select id="tfbe-rsi" ref={rs} onChange={dirty} defaultValue={[38, 40, 42, 44, 46].includes(p.rsiTh) ? p.rsiTh : undefined}>
          {[38, 40, 42, 44, 46].map((v) => (
            <option key={v} value={v}>
              {'RSI ' + v + ' 이하'}
            </option>
          ))}
        </select>
      </div>
      <div className="fld3">
        <label htmlFor="tfbe-tf">추세 필터</label>
        <select id="tfbe-tf" ref={tf} onChange={dirty} defaultValue={p.trendFilter ? '1' : '0'}>
          <option value="1">사용 (20/60일 이평)</option>
          <option value="0">사용 안 함</option>
        </select>
      </div>
      <div id="tfbe-res" className="ntc" style={{ display: res ? 'block' : 'none' }}>
        {res && res.k === 'dirty' && (
          <>
            설정이 바뀌었습니다. <b>재검증</b>을 다시 통과해야 적용할 수 있습니다.
          </>
        )}
        {res && res.k === 'res' && (
          <>
            재검증 결과: TETH <b>{res.sc}점</b>, 검증 수익 <b style={{ color: 'var(' + (res.ret >= 0 ? '--gg' : '--gr') + ')' }}>{(res.ret >= 0 ? '+' : '') + res.ret.toFixed(1) + '%'}</b>
            {', 최대 낙폭 ' + res.mdd.toFixed(1) + '%, 체결 ' + res.n + '회 '}
            <span style={{ color: 'var(--gt3)' }}>(시뮬레이션)</span>
            {!res.pass && (
              <>
                <br />
                설정을 조정해 다시 검증해보십시오. 통과 전에는 적용되지 않습니다.
              </>
            )}
          </>
        )}
      </div>
      <div className="acts3">
        <button type="button" className="obtn" onClick={() => tfSS3DlgClose()}>
          취소
        </button>
        <button type="button" className="wbtn" id="tfbe-run" onClick={run}>
          재검증
        </button>
        <button type="button" className="wbtn" id="tfbe-apply" style={canApply ? undefined : { display: 'none' }} onClick={apply}>
          이 전략에 적용
        </button>
      </div>
    </div>
  );
}
/** tfBotEdit(botId) */
function tfBotEdit(botId: string) {
  const b = tfBotFind(botId);
  if (!b || !b.p) {
    toast('이 전략은 저장된 검증 설정이 없어 수정할 수 없습니다');
    return;
  }
  tfSS3Dlg('전략 수정: ' + b.name, <BotEdit botId={botId} />);
}

/** tfBotLogRender(botId): AI 행동 기록. 저장하지 않고 그릴 때마다 엔진 규칙을 다시 돌린다 */
function BotLog({ b }: { b: Strat }) {
  const [mode, setMode] = useState<'all' | 'fills'>('all');
  /* 원본대로 비트코인 가격 줄(전역 PRICE)로 센다 */
  const L = tfBotLogEvents(b.p, PRICE0);
  const rows = mode === 'fills' ? L.evs.filter((e) => e.k === 'entry' || e.k.indexOf('exit') === 0) : L.evs;
  const show = rows.slice(-14);
  return (
    <div id="nfxl-host">
      <div className="nfxl-sum">
        <span>
          검증 구간 평가 <b>{L.bars}봉</b>
        </span>
        <span>
          관망 <b>{L.cnt.watch}</b>
        </span>
        <span>
          진입 <b>{L.cnt.entry}</b>
        </span>
        <span>
          청산 <b>{L.cnt.exit}</b>
        </span>
        <span className="nfxl-rsi">
          <span>
            마지막 봉 RSI <b>{L.last.rsi.toFixed(1)}</b>
          </span>
          <span className="tr">
            <span className="fl" style={{ width: Math.min(100, L.last.rsi) + '%' }} />
            <span className="pin" style={{ left: b.p.rsiTh + '%' }} title={'임계 ' + b.p.rsiTh} />
          </span>
        </span>
      </div>
      <div className="nfxh-fchips">
        <button className={'nfxh-fchip' + (mode === 'all' ? ' on' : '')} onClick={() => setMode('all')}>
          전체
        </button>
        <button className={'nfxh-fchip' + (mode === 'fills' ? ' on' : '')} onClick={() => setMode('fills')}>
          체결만<span className="c2">{L.cnt.entry + L.cnt.exit}</span>
        </button>
        <span style={{ fontSize: '11.5px', color: 'var(--gt3)', marginLeft: 'auto' }}>{'최근 ' + show.length + '개 표시, 이전 ' + (rows.length - show.length) + '개'}</span>
      </div>
      <div className="nfxl-tl">
        {show.map((e) => (
          <div className={'nfxl-ev ' + e.k} key={e.i}>
            <span className="tm2">{fmtDate(idxToDate(e.i))}</span>
            <span className="node">
              <span className="dt" />
              <span className="ln" />
            </span>
            <div className="card">
              <span className="tp2">{e.tag}</span>
              {e.txt}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type FillRow = { side: 'b' | 's'; label: string; pnl: number; kind?: string; fid?: string; botId?: string | number };
type Rev = { id: string; fid?: string; botId?: string | number };

/** tfBotView(id) */
export function Bot({ id }: { id: string }) {
  const t = useTf();
  const b = (t.strat || []).find((x) => String(x.at) === String(id));
  const [ring, setRing] = useState(false);
  useEffect(() => {
    if (b) return;
    toast('전략을 찾을 수 없습니다');
    nav('#/trade');
  }, [b]);
  useEffect(() => {
    const h = setTimeout(() => setRing(true), 60);
    return () => clearTimeout(h);
  }, []);
  if (!b) return null;
  const botId = String(b.at);
  /* 전략별 체결은 쌓아 둔 원장(fillLog)이 먼저 */
  let fills = ((t.fillLog as FillRow[]) || []).filter((f) => String(f.botId) === botId);
  if (!fills.length) fills = ((t.fills as FillRow[]) || []).filter((f) => !f.botId || String(f.botId) === botId);
  const revs = (t.reviews as Rev[]).filter((r) => String(r.botId) === botId);
  const env = b.status === 'ready' ? 'ready' : b.status === 'off' ? 'stop' : b.env === 'paper' ? 'paper' : 'live';
  const envL = { ready: '시작 대기', stop: '중지됨', paper: '가상 실행', live: '라이브 (시뮬레이션)' }[env];
  const rb = ((t.rebates as { botId?: string | number; amt: number }[]) || []).filter((r) => String(r.botId) === botId).reduce((a, r) => a + r.amt, 0);
  const p: RuleP = b.p || { sl: -5, tp: null, rsiTh: 44, trendFilter: true, startI: null, endI: null };
  const asset = b.name.replace(' 위임 전략', '');
  /* 검증 수익 곡선: 저장된 설정으로 다시 계산한다 */
  let eqPath = '';
  let eqArea = '';
  const eqUp = b.ret >= 0;
  try {
    const r0 = runBacktest({ sl: p.sl, tp: p.tp, rsiTh: p.rsiTh, trendFilter: p.trendFilter, startI: p.startI, endI: p.endI, purpose: 'view' });
    const eq = r0.eq || [];
    if (eq.length > 1) {
      let mn = Infinity;
      let mx = -Infinity;
      eq.forEach((q) => {
        if (q.v < mn) mn = q.v;
        if (q.v > mx) mx = q.v;
      });
      if (mx - mn < 1e-9) mx = mn + 1e-9;
      eqPath = eq.map((q, i) => (i ? 'L ' : 'M ') + Math.round((i / (eq.length - 1)) * 800) + ' ' + Math.round(130 - ((q.v - mn) / (mx - mn)) * 115)).join(' ');
      eqArea = eqPath + ' L 800 140 L 0 140 Z';
    }
  } catch {
    /* 곡선 없이 그린다 */
  }
  const days = p.endI != null && p.startI != null ? p.endI - p.startI : null;
  const ruleTxt = 'RSI ' + p.rsiTh + ' 눌림 진입, 손절 ' + p.sl + '%, ' + (p.tp != null ? '익절 +' + p.tp + '%' : '기간 청산') + (p.trendFilter ? ', 추세 필터' : '');
  const exId = t.api ? t.api.ex : t.ex || null;
  const posPill = b.status === 'live' ? (b.env === 'paper' ? '가상 신호 탐색 중' : '신호 탐색 중') : '실행 대기';
  const col = eqUp ? '#4ec08d' : '#e0604b';
  const sim = <span className="nfx-badge sim">시뮬레이션</span>;
  return (
    <>
      <div className="nfx-page">
        <div className="nfx-glow" />
        <div className="nfx-bc">
          <span className="lk" onClick={() => nav('#/trade')}>
            AI 트레이딩
          </span>
          <span>/</span>
          <span style={{ color: 'var(--gt2)' }}>{b.name}</span>
        </div>
        <section className="nfxb-hero">
          <div className="nfxb-toprow">
            <div style={{ minWidth: 0 }}>
              <div className="nfxb-tline">
                <h1 className="nfxb-title">{b.name}</h1>
                <span className={'nfxb-st ' + env}>
                  <span className={'nfx-dot' + (b.status === 'live' ? ' pulse' : '')} />
                  {envL}
                </span>
                {sim}
              </div>
              {b.src ? (
                <span className="nfxb-origin">
                  원본: <b style={{ color: 'var(--gt)' }}>{b.src}</b>
                </span>
              ) : null}
            </div>
            <div className="nfxb-actions">
              {b.status === 'live' ? (
                <>
                  <button className="nfx-btn dng" onClick={() => tfBotCtl(botId, 'pause')}>
                    실행 일시정지
                  </button>
                  <button className="nfx-btn sec" onClick={() => tfBotCtl(botId, 'env')}>
                    {b.env === 'paper' ? '라이브(시뮬레이션)로 전환' : '가상 시뮬레이션으로 전환'}
                  </button>
                </>
              ) : b.status === 'off' ? (
                <button className="nfx-btn pri" onClick={() => tfBotCtl(botId, 'resume')}>
                  <IcZap />
                  재개
                </button>
              ) : b.status === 'ready' ? (
                <button className="nfx-btn pri" onClick={() => tfBotCtl(botId, 'start')}>
                  <IcZap />
                  지금 시작하기
                </button>
              ) : null}
              {b.p ? (
                <button className="nfx-btn out" onClick={() => tfBotEdit(botId)}>
                  전략 수정
                </button>
              ) : null}
            </div>
          </div>
          <div className="nfxb-notice">
            <IcInfo />
            <span>{env === 'paper' ? '가상 실행은 자산 차감 없이 신호와 체결을 재현합니다.' : '체험 모드입니다. 이 화면의 실행과 체결은 시뮬레이션입니다.'}</span>
          </div>
        </section>
        <section className="nfxb-mgrid">
          <div className="nfxb-mcard score">
            <div className="nfxb-mhd">
              <span className="nfxb-mlb">TETH Score</span>
              <span className="nfxb-chipp">{'검증 ' + (b.n || 0) + '회'}</span>
            </div>
            <div className="nfxb-scorebody">
              <div className="nfxb-ring">
                <svg viewBox="0 0 100 100">
                  <circle className="bg" cx="50" cy="50" r="40" />
                  <circle className="fg" id="nfxb-ringfg" cx="50" cy="50" r="40" style={ring ? { strokeDashoffset: String(251.3 * (1 - Math.min(100, b.score) / 100)) } : undefined} />
                </svg>
                <div className="val">
                  <span>{b.score}</span>
                  <span className="mx">/100</span>
                </div>
              </div>
              <div className="nfxb-smeta">
                <span className="nfxb-srank">검증한 전략</span>
                <span className="nfxb-sdesc">{ruleTxt}</span>
              </div>
            </div>
          </div>
          <div className="nfxb-mcard">
            <div className="nfxb-mhd">
              <span className="nfxb-mlb">검증 수익률</span>
              {sim}
            </div>
            <div>
              <div className={'nfxb-bigval ' + (b.ret >= 0 ? 'up' : 'dn')}>{(b.ret >= 0 ? '+' : '') + b.ret.toFixed(1) + '%'}</div>
              <div className="nfxb-subtx">{'검증 체결 ' + (b.n || 0) + '회, 승률 ' + Math.round(b.winRate || 0) + '%'}</div>
            </div>
            <div className="nfxb-rbar">
              <i style={{ width: Math.min(100, Math.max(4, Math.round(Math.abs(b.ret) * 4))) + '%', background: 'var(' + (b.ret >= 0 ? '--gg' : '--gr') + ')' }} />
            </div>
          </div>
          <div className="nfxb-mcard">
            <div className="nfxb-mhd">
              <span className="nfxb-mlb">최대 낙폭 (MDD)</span>
              <span className="nfxb-chipp">리스크</span>
            </div>
            <div>
              <div className="nfxb-bigval">{b.mdd.toFixed(1) + '%'}</div>
              <div className="nfxb-subtx">{'손절 ' + p.sl + '% 규칙 안에서 관리된 낙폭'}</div>
            </div>
            <div className="nfxb-rbar">
              <i style={{ width: Math.min(100, Math.max(4, Math.round(Math.abs(b.mdd) * 4))) + '%', background: 'linear-gradient(90deg,var(--gg),var(--ga))' }} />
            </div>
          </div>
        </section>
        {eqPath ? (
          <section className="nfxb-chart">
            <div className="nfxb-chd">
              <h2 className="nfxb-ctit">
                검증 수익 곡선<span className="nfxb-cbadge">검증 시뮬레이션</span>
              </h2>
              <div className="nfxb-cstats">
                <span>
                  기준 자산: <b>{asset}</b>
                </span>
                {days ? (
                  <span>
                    검증 기간: <b>{days}일</b>
                  </span>
                ) : null}
                <span>
                  승률: <b style={{ color: 'var(--gg)' }}>{Math.round(b.winRate || 0)}%</b>
                </span>
              </div>
            </div>
            <div className="nfxb-spark">
              <svg viewBox="0 0 800 140" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="nfxbGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={col} stopOpacity=".32" />
                    <stop offset="60%" stopColor={col} stopOpacity=".08" />
                    <stop offset="100%" stopColor={col} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line className="nfxb-grid" x1="0" y1="20" x2="800" y2="20" />
                <line className="nfxb-grid" x1="0" y1="70" x2="800" y2="70" />
                <line className="nfxb-grid" x1="0" y1="120" x2="800" y2="120" />
                <path className="nfxb-area" fill="url(#nfxbGrad)" d={eqArea} />
                <path className={'nfxb-line' + (eqUp ? '' : ' dn')} d={eqPath} />
              </svg>
            </div>
          </section>
        ) : null}
        <div className="nfxb-grid2">
          <section className="nfxb-scard">
            <div className="nfx-sechead">
              <h2 className="nfx-sectit">주문 내역 {sim}</h2>
              <span className="nfxb-fee">
                <IcWon />
                적립 누계 <b>{'+' + tfWon(rb)}</b>
              </span>
            </div>
            {fills.length ? (
              <div className="nfx-rows">
                {fills.map((f, i) => {
                  const rv = revs.find((r) => r.fid === f.fid);
                  const kindL = ({ sl: '손절', tp: '익절', time: '기간 청산' } as Record<string, string>)[f.kind || ''] || '청산';
                  const go = rv ? () => nav('#/review/' + rv.id) : undefined;
                  /* tfNFRow({ic:'trend',...}) */
                  return (
                    <div
                      className={'nfx-row' + (go ? ' lk' : '') + ' nfx-stag s' + Math.min(i + 1, 8)}
                      key={i}
                      onClick={go}
                      role={go ? 'link' : undefined}
                      tabIndex={go ? 0 : undefined}
                      onKeyDown={
                        go
                          ? (e) => {
                              if (e.key === 'Enter') go();
                            }
                          : undefined
                      }
                    >
                      <div className="nfx-rl">
                        <div className={'nfx-ric ' + (f.side === 'b' ? 'gg' : 'gr')}>
                          <IcTrend />
                        </div>
                        <div className="nfx-rtx">
                          <span className="nfx-rlb">{(f.side === 'b' ? '매수' : '매도') + ', ' + f.label}</span>
                          <span className="nfx-rds">{kindL + (rv ? ', 복기 리포트 도착' : '')}</span>
                        </div>
                      </div>
                      <div className="nfx-rr">
                        <span className={'nfx-rval ' + (f.pnl >= 0 ? 'gain' : 'loss')}>{(f.pnl >= 0 ? '+' : '') + (f.pnl * 100).toFixed(1) + '%'}</span>
                        {rv ? <IcChev /> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="nfx-empty">
                <div className="nfx-eicon">
                  <IcEmpty />
                </div>
                <div className="nfx-etit">아직 체결이 없습니다</div>
                <div className="nfx-edesc">{b.status === 'ready' ? '전략을 시작하면 검증 시뮬레이션 체결이 여기에 쌓입니다.' : '신호가 발생해 체결이 확정되면 여기에 표시됩니다.'}</div>
                {b.status === 'ready' ? (
                  <button className="nfx-btn pri" style={{ marginTop: '6px' }} onClick={() => tfBotCtl(botId, 'start')}>
                    지금 시작하기
                  </button>
                ) : null}
              </div>
            )}
          </section>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <section className="nfxb-scard">
              <div className="nfx-sechead">
                <h2 className="nfx-sectit">현재 포지션 {sim}</h2>
                <span className="nfxb-pill-amber">
                  <span className={'nfx-dot' + (b.status === 'live' ? ' pulse' : '')} />
                  {posPill}
                </span>
              </div>
              <div className="nfxb-posbox">
                <div>
                  <div className="nfxb-postit">현재 열린 포지션이 없습니다</div>
                  <div className="nfxb-posdesc">진입 신호가 발생하면 여기에 표시됩니다. (시뮬레이션)</div>
                </div>
                <div className="nfxb-check">
                  <span className="d" />
                  <span>{'신호 규칙: RSI ' + p.rsiTh + ' 이하 눌림 후 반등 진입' + (p.trendFilter ? ' (추세 필터)' : '')}</span>
                </div>
                <div className="nfxb-check">
                  <span className="d" />
                  <span>{'리스크 가드: 손절 ' + p.sl + '% 규칙 적용'}</span>
                </div>
              </div>
            </section>
            <section className="nfxb-scard">
              <div className="nfx-sechead">
                <h2 className="nfx-sectit">전략 실행 환경</h2>
                <span className="nfxb-chipp">설정 요약</span>
              </div>
              <div className="nfxb-specs">
                <div className="nfxb-spec">
                  <span className="k">연결 거래소</span>
                  <span className="v">{exId ? exName(exId) : '미연결'}</span>
                </div>
                <div className="nfxb-spec">
                  <span className="k">실행 환경</span>
                  <span className="v">{envL}</span>
                </div>
                <div className="nfxb-spec">
                  <span className="k">실행 권한</span>
                  <span className="v" style={{ color: 'var(--gg)' }}>
                    출금 권한 없음
                  </span>
                </div>
                <div className="nfxb-spec">
                  <span className="k">등록일</span>
                  <span className="v">{new Date(b.at).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>
            </section>
          </div>
        </div>
        {b.p ? (
          <section className="nfxb-scard" style={{ marginTop: '20px' }}>
            <div className="nfx-sechead">
              <h2 className="nfx-sectit">AI 행동 로그</h2>
              <span className="nfx-badge">엔진 신호 기준, 시뮬레이션</span>
            </div>
            <BotLog b={b} />
          </section>
        ) : null}
      </div>
      <TermOverlays />
    </>
  );
}
