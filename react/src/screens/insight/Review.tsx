// 거래복기 (#/review/<id>, 원본 tfReviewView) 와 주간, 월간 보고서 (#/periodic/<id>, 원본 tfPeriodicView).
import { useEffect, useRef } from 'react';
import type { TfBot } from '../../core/insight/insight';
import { koDate, periodicEvs, periodicWr, pnlPct, REVIEW_STEP, reviewPeriodic, reviewRebate, tfBotFind, tfWon, type Periodic, type Review } from '../../core/insight/review';
import { nav } from '../../state/route';
import { NFRow, NFX_IC, useViewEnter } from './NFView';

const go = (r: string) => () => nav(r);
const STEP0: (typeof REVIEW_STEP)[string] = ['STEP', '', 'doc'];

/** tfReviewView(id) */
export function ReviewView({ r, periodics, strat }: { r: Review; periodics: Periodic[]; strat: (TfBot | null)[] }) {
  useViewEnter('review:' + r.id);
  const won = r.pnl >= 0;
  const pd = reviewPeriodic(r, periodics);
  const b = tfBotFind(strat, r.botId);
  return (
    <div className="nfx-page">
      <div className="nfx-glow" />
      <div className="nfx-bc">
        <span className="lk" onClick={go('#/trade')}>
          AI 트레이딩
        </span>
        <span>/</span>
        <span style={{ color: 'var(--gt2)' }}>거래복기</span>
      </div>
      <section className={'nfx-card nfx-card-hero nfxr-hero ' + (won ? 'win' : 'loss')}>
        <div className="nfx-chead">
          <span className="nfx-ctitle">
            {r.asset + ' ' + r.kindL + ' 복기'}
            <span className="nfx-badge sim">시뮬레이션</span>
          </span>
          {pd && (
            <button className="nfx-btn out" style={{ padding: '7px 13px', fontSize: '12.5px' }} onClick={go('#/periodic/' + pd.id)}>
              {pd.label + ' 보고서로'}
            </button>
          )}
        </div>
        <div>
          <div className="nfx-hero-label">{'실현 손익, ' + (won ? '규칙 작동' : '손실 제한')}</div>
          <div className={'nfx-hero ' + (won ? 'cg' : 'cr')}>
            {(won ? '+' : '') + (r.pnl * 100).toFixed(1) + '%'}
          </div>
          <div className="nfx-hero-desc" style={{ marginTop: 6 }}>
            {won ? '규칙이 작동한 거래입니다. 진입과 청산 모두 검증된 조건대로 실행됐습니다.' : '손절 규칙이 손실을 제한한 거래입니다.'}
          </div>
        </div>
        <div className="nfxr-chiprow">
          <span className="nfxr-chip">
            구분 <b>{r.kindL}</b>
          </span>
          <span className="nfxr-chip">
            수수료 적립 <b style={{ color: 'var(--gg)' }}>{'+' + tfWon(reviewRebate(r))}</b>
          </span>
          {b && (
            <span className="nfxr-chip">
              전략 <b>{b.name}</b>
            </span>
          )}
        </div>
      </section>
      <section className="nfx-card">
        <div className="nfx-sechead">
          <h2 className="nfx-sectit">TETH 의 인과 분석</h2>
          <span className="nfx-badge">규칙 엔진 신호 기준</span>
        </div>
        <div className="nfxr-steps">
          {r.causes.map((c, i) => {
            const m = REVIEW_STEP[c[0]] || STEP0;
            return (
              <div className={'nfxr-step nfx-stag s' + (i + 1)} key={i}>
                <div className={'nfxr-sic ' + m[1]}>{NFX_IC[m[2]]()}</div>
                <div style={{ minWidth: 0 }}>
                  <div>
                    <span className="nfxr-stag">
                      {'0' + (i + 1) + ' ' + m[0]}
                    </span>
                    <span className="nfxr-stit">{c[0]}</span>
                  </div>
                  <div className="nfxr-sbody">{c[1]}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <div className="nfx-cta">
        <button className="nfx-btn pri" onClick={go('#/trade/bot/' + r.botId)}>
          {NFX_IC.zap()}이 전략 상세로
        </button>
        <button className="nfx-btn out" onClick={go('#/trade')}>
          AI 트레이딩
        </button>
      </div>
    </div>
  );
}

/** tfPeriodicView(id) */
export function PeriodicView({ p, reviews }: { p: Periodic; reviews: Review[] }) {
  useViewEnter('periodic:' + p.id);
  const wr = periodicWr(p);
  const evs = periodicEvs(p, reviews);
  /* 승률 고리는 그린 뒤 60ms 에 채운다 (CSS transition) */
  const ring = useRef<SVGCircleElement>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      if (ring.current) ring.current.style.strokeDashoffset = String(163.4 * (1 - wr / 100));
    }, 60);
    return () => clearTimeout(t);
  }, [p.id, wr]);
  const up = p.pnl >= 0;
  return (
    <div className="nfx-page">
      <div className="nfx-glow" />
      <div className="nfx-bc">
        <span className="lk" onClick={go('#/trade')}>
          AI 트레이딩
        </span>
        <span>/</span>
        <span style={{ color: 'var(--gt2)' }}>{p.label + ' 보고서'}</span>
      </div>
      <section className={'nfx-card nfx-card-hero nfxr-hero ' + (up ? 'win' : 'loss')}>
        <div className="nfx-chead">
          <span className="nfx-ctitle">
            {p.label + ' 성과 보고서'}
            <span className="nfx-badge sim">시뮬레이션</span>
          </span>
          <span className="nfx-badge">
            {koDate(p.from || p.until - 1) + ' ~ ' + koDate(p.until - 1)}
          </span>
        </div>
        <div>
          <div className="nfx-hero-label">기간 합산 손익</div>
          <div className={'nfx-hero ' + (up ? 'cg' : 'cr')}>{pnlPct(p.pnl)}</div>
        </div>
        <div className="nfxr-stats">
          <div className="nfxr-ring">
            <svg viewBox="0 0 60 60">
              <circle className="bg" cx="30" cy="30" r="26" />
              <circle className="fg" id="nfxr-wring" ref={ring} cx="30" cy="30" r="26" />
            </svg>
            <span className="val">{wr + '%'}</span>
          </div>
          <div className="nfx-mbox" style={{ minWidth: 120 }}>
            <span className="nfx-mtit">체결</span>
            <span className="nfx-mval">{p.n + '회'}</span>
          </div>
          <div className="nfx-mbox" style={{ minWidth: 120 }}>
            <span className="nfx-mtit">승률</span>
            <span className="nfx-mval">{wr + '%'}</span>
          </div>
          <div className="nfx-mbox" style={{ minWidth: 140 }}>
            <span className="nfx-mtit">수수료 적립</span>
            <span className="nfx-mval" style={{ color: 'var(--gg)' }}>
              {'+' + tfWon(p.rebate)}
            </span>
          </div>
        </div>
      </section>
      <section className="nfx-card">
        <div className="nfx-sechead">
          <h2 className="nfx-sectit">기간 체결 복기</h2>
          <span className="nfx-badge">{evs.length ? evs.length + '건' : '없음'}</span>
        </div>
        {evs.length ? (
          <div className="nfx-rows">
            {evs.map((r, i) => (
              <NFRow
                key={r.id}
                ic="doc"
                icc={r.pnl >= 0 ? 'gg' : 'gr'}
                lb={r.asset + ' ' + r.kindL}
                ds={koDate(r.at)}
                val={<span className={'nfx-rval ' + (r.pnl >= 0 ? 'gain' : 'loss')}>{pnlPct(r.pnl)}</span>}
                arrow
                stag={Math.min(i + 1, 8)}
                click={go('#/review/' + r.id)}
              />
            ))}
          </div>
        ) : (
          <div className="nfx-empty">
            <div className="nfx-eicon">{NFX_IC.empty()}</div>
            <div className="nfx-etit">현재 조회 가능한 복기가 없습니다</div>
            <div className="nfx-edesc">이 기간의 복기 리포트가 보관 기간을 지나 정리됐습니다. 요약 수치는 위에 그대로 남아 있습니다.</div>
          </div>
        )}
      </section>
      <div className="nfx-cta">
        <button className="nfx-btn pri" onClick={go('#/trade')}>
          {NFX_IC.zap()}AI 트레이딩
        </button>
        <button className="nfx-btn out" onClick={go('#/plan/rebates')}>
          정산 내역 보기 (전체)
        </button>
      </div>
    </div>
  );
}
