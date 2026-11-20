// 실행 준비 화면 #/share/bt/<전략>/go (원본 btGoPage, btGoMe, btGoSpark, pxHead, pxBStart)와
// 전략 시작 동작(btMineStart, tfStartStrategy, tfLater), 준비 완료 화면 #/strategy/done (tfDoneView).
// 거래소를 고르고 잇는 단계 화면은 거래소 연결 조각의 것이다. 여기서는 연결이 끝난 내 전략의 시작 화면만 그리고, 그 밖은 원본의 같은 주소를 연다.
import { useLayoutEffect, useMemo } from 'react';
import { btSparkGeo } from '../../core/bt/chart';
import { btAi, btOppL, btPerL, btSkipL, btUsd, btUsdS, btWinTxt, type BtR } from '../../core/bt/compute';
import { LEGACY_URL } from '../../core/config';
import { MK_KIND, TF_BUDGET, mkHook, mkPct0, mkScope, mkSign, type Strat } from '../../core/bt/engine';
import { btMineDone, btMineStale, tfWon } from '../../core/bt/tf';
import { TFC_SCORE } from '../../core/bt/tfc.data';
import { useBodyClass } from '../../state/hooks';
import { nav } from '../../state/route';
import { getState, toast } from '../../state/store';
import { AC_CFG, acConnList, acConnOk, acName, acS, acUsd } from './ac';
import { BT, backToChat, btGoTo, useBt } from './bt';
import { Back, MkGlyph, tx } from './parts';
import { tfRefresh, tfS, tfSave, tfTrack } from './tfState';

/** btGoSpark() */
function Spark({ R }: { R: BtR }) {
  const g = btSparkGeo(R);
  const { W, H, p, X, Y } = g;
  const col = R.ret >= 0 ? '#2fb98a' : '#f0566a';
  return (
    <svg className="btg-sp" viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label="백테스트 잔고 그래프">
      <defs>
        <linearGradient id="btgsp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={col} stopOpacity=".22" />
          <stop offset="1" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={p} x2={W - p} y1={Y(1).toFixed(1)} y2={Y(1).toFixed(1)} stroke="rgba(255,255,255,.16)" />
      <path d={g.b} fill="none" stroke="rgba(255,255,255,.26)" strokeWidth="1.1" strokeDasharray="2 4" />
      <path d={g.d + ' L' + X(R.N - 1).toFixed(1) + ' ' + H + ' L' + X(0).toFixed(1) + ' ' + H + ' Z'} fill="url(#btgsp)" />
      <path d={g.d} fill="none" stroke={col} strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx={X(R.N - 1).toFixed(1)} cy={Y(g.vs[R.N - 1]).toFixed(1)} r="3.2" fill={col} />
    </svg>
  );
}
/** btGoMe() */
function GoMe({ s, R }: { s: Strat; R: BtR }) {
  const ai = btAi(s);
  const diff = Math.round(R.final) - Math.round(R.benchFinal);
  const per = btPerL(BT.per);
  const back = () => btGoTo('');
  return (
    <aside className="btg-me">
      <small className="lb">실행할 전략</small>
      <div className="hd">
        <MkGlyph s={s} z={34} />
        <div>
          <b>{tx(mkHook(s))}</b>
          <span>{tx(MK_KIND[s.kind] + ', ' + mkScope(s))}</span>
        </div>
        <button type="button" className="mret" onClick={back}>
          <i className={'num' + mkSign(R.ret)}>{mkPct0(R.ret, 1)}</i>
          <em>{tx(per + ' 결과 보기')}</em>
        </button>
      </div>
      <div className="fig">
        <div>
          <small>{tx(per + ' 백테스트')}</small>
          <b className={'num' + mkSign(R.ret)}>{mkPct0(R.ret, 1)}</b>
        </div>
        <div className="r">
          <small>{btUsd(BT.amt)}가</small>
          <b className="num">{btUsd(R.final)}</b>
        </div>
      </div>
      <Spark R={R} />
      <dl>
        <div>
          <dt>{tx('그냥 들고 있었을 때보다')}</dt>
          <dd className={'num ' + (diff >= 0 ? 'mk-up' : 'mk-dn')}>{btUsdS(diff)}</dd>
        </div>
        <div>
          <dt>{tx('가장 크게 내려간 폭')}</dt>
          <dd className="num">{R.mdd.toFixed(1)}%</dd>
        </div>
        {ai ? (
          <div>
            <dt>{tx(btOppL(s) + ' ' + R.nOpp + '번 중')}</dt>
            <dd className="num">{tx(btSkipL(s) + ' ' + R.nSkip + '번')}</dd>
          </div>
        ) : (
          <div>
            <dt>{tx('이긴 거래')}</dt>
            <dd className="num">{tx(btWinTxt(R))}</dd>
          </div>
        )}
      </dl>
      <button type="button" className="lk" onClick={back}>
        백테스트 결과 다시 보기
      </button>
    </aside>
  );
}

/** acLogo(id,z) */
const AcLogo = ({ id, z }: { id: string; z: number }) =>
  id === 'gate' ? (
    <i className="acx-mono" style={{ width: z, height: z, fontSize: Math.round(z * 0.5) }} aria-hidden="true">
      G
    </i>
  ) : (
    <img src={'assets/logos/app-' + id + '.png'} alt="" width={z} height={z} loading="lazy" />
  );
const budgetOf = () => {
  const bi = ((tfS().intake || {}).budget || {}).i;
  return TF_BUDGET[bi != null ? bi : 1];
};

/** tfLater(): 나중에 시작. 연결만 해 두고 대화로 돌아간다 */
function tfLater() {
  const t = tfS();
  t.conn = true;
  tfSave();
  backToChat();
}
/**
 * tfStartStrategy(): 전략 시작. 퍼널 상태에 실행 중인 전략을 올리고 AI 트레이딩 화면으로 간다.
 * 원장과 알림에 올리는 일(tfNFOnStart)과 AI 트레이딩 화면은 그 화면을 맡은 조각의 것이다.
 */
function tfStartStrategy(env: 'live' | 'paper') {
  const t = tfS();
  const hasUser = !!getState().user;
  if (btMineStale(t, hasUser)) {
    toast('조건이 바뀌어서 다시 돌려 보겠습니다');
    nav('#/share/bt/mine');
    return;
  }
  if (!(t.cur && t.score >= TFC_SCORE.pass)) {
    toast('현재 설정의 검증을 먼저 통과해야 합니다');
    nav('#/strategy/backtest');
    return;
  }
  tfTrack('strategy_start', { score: t.score, clone: !!t.cloneFrom });
  /* 가상으로 시작하는지는 원본과 같은 전역(TF_NF_ENV)에 적어 둔다. 원장에 올리는 쪽(tfNFOnStart)이 읽는다 */
  (window as unknown as { TF_NF_ENV?: string | null }).TF_NF_ENV = env === 'paper' ? 'paper' : null;
  t.conn = true;
  t.stage = 'live';
  const asset = (t.intake.asset || {}).label || '자산';
  const srcNow = t.cloneFrom || null;
  const cur = t.cur;
  if (!t.strat.some((x) => String(x.name).indexOf(asset) === 0 && (x.at as number) > Date.now() - 6e5 && (x.src === undefined || x.src === srcNow))) {
    t.strat.unshift({ name: asset + ' 위임 전략', score: t.score, ret: cur.ret, mdd: cur.mdd, n: cur.n, winRate: cur.winRate || 0, p: cur.p, src: srcNow, fid: t.followId != null ? t.followId : null, status: 'live', at: Date.now(), asset, ex: t.api ? t.api.ex : null, tv: (t.intake.assetInfo && t.intake.assetInfo.tv) || null, cap: budgetOf() });
    const tr = (cur.trades || []).slice(-4);
    t.fills = tr.map((x, i) => ({ side: i % 2 === 0 ? 'b' : 's', label: asset, pnl: x.pnl, kind: x.kind, sim: true, at: Date.now() - (tr.length - i) * 36e5 }));
  }
  tfSave();
  toast('전략이 시작됐습니다');
  nav('#/trade');
}
/** btMineStart(m) */
function btMineStart(m: 'live' | 'paper' | 'later') {
  const t = tfS();
  const hasUser = !!getState().user;
  if (!t.cur && BT.s && BT.R) btMineDone(t, BT.s, BT.R);
  if (btMineStale(t, hasUser)) {
    toast('조건이 바뀌어서 다시 돌려 보겠습니다');
    btGoTo('');
    return;
  }
  t.stage = 'done';
  if (t.ob) t.ob.st = 'completed';
  tfSave();
  if (m === 'later') tfLater();
  else tfStartStrategy(m);
}

/** btGoPage(): 연결이 끝난 내 전략의 시작 화면 (원본 pxHead + pxBStart + pxHelp) */
export function GoPage() {
  const s = useBt((b) => b.s) as Strat;
  const R = useBt((b) => b.R);
  const a = acS();
  const ex = a.ex && acConnOk(a.ex) ? a.ex : null;
  const mine = !!s.mine;
  /* 거래소를 고르고 잇는 단계가 남았으면 원본의 같은 주소를 연다 */
  const here = mine && !!ex;
  useLayoutEffect(() => {
    if (!here) window.location.replace(LEGACY_URL + window.location.hash);
  }, [here]);
  if (!here || !R || !ex) return null;
  const c = a.conn[ex] || {};
  const uid = c.uid ? String(c.uid) : '';
  return (
    <div className="bt btg" id="bt-root" data-phase="go">
      <div className="tfw-hd bt-hd">
        <button className="bk" onClick={() => btGoTo('')} aria-label="결과로">
          <Back />
        </button>
        <span className="ti">전략 실행 준비</span>
      </div>
      <div className="btg-grid">
        <GoMe s={s} R={R} />
        <div className="btg-flow" id="btg-flow">
          <div id="ac-head">
            <header className="pl-cohead px-head">
              <button type="button" className="pl-back" aria-label="뒤로" onClick={() => btGoTo('')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
              <h1>전략 시작</h1>
            </header>
            <p className="px-lead">{tx(mkHook(s) + ' 전략을 ' + acName(a.ex || acConnList()[0]) + ' 계정에서 실행합니다.')}</p>
          </div>
          <div className="acx-flow" id="ac-flow">
            <div className="px-card px-rows">
              <div className="r">
                <span>실행 계정</span>
                <b>
                  <AcLogo id={ex} z={20} />
                  {acName(ex) + (uid ? ' ' : '')}
                  {uid && <i className="num">{uid.slice(0, 2) + '••••' + uid.slice(-2)}</i>}
                </b>
              </div>
              <div className="r">
                <span>사용할 금액</span>
                <b className="num">{tfWon(budgetOf())}</b>
              </div>
              <div className="r">
                <span>TETH 이용료</span>
                <b>{c.via === 'paid' ? '구독, 월 ' + acUsd(AC_CFG.price) : '없음'}</b>
              </div>
            </div>
            <button type="button" className="pl-cta pl-cta-w px-cta" onClick={() => btMineStart('live')}>
              전략 시작하기
            </button>
            <p className="px-links">
              <button type="button" className="pl-link" onClick={() => btMineStart('paper')}>
                가상으로 먼저 시작
              </button>
              <button type="button" className="pl-link" onClick={() => btMineStart('later')}>
                나중에 시작
              </button>
            </p>
            <p className="px-help">
              <span>막히면 상담원이 24시간 답합니다.</span>
              <button type="button" className="pl-link" onClick={() => (document.getElementById('teth-help') as HTMLElement | null)?.click()}>
                상담원에게 묻기
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 지금 주소가 전략 만들기 퍼널인가 */
export const isStrategyHash = (h: string) => h.indexOf('#/strategy/') === 0;
/** tfRoute 의 #/strategy/* 가지와 tfDoneView(): 준비 완료 화면 */
export function StrategyScreen({ hash }: { hash: string }) {
  const hasUser = !!getState().user;
  useBodyClass('tf-route', true); /* 고객지원 단추를 아래 단추 위로 */
  useMemo(tfRefresh, [hash]);
  const t = tfS();
  const ok = hasUser && !!t.intake && !!t.intake.asset;
  /* 갈 곳: 예전 검증, 리포트, 연결 화면은 백테스트 화면(내 전략)과 실행 준비로 옮겼다 */
  let to: string | null = null;
  let say: string | null = null;
  if (!ok) to = '';
  else if (hash !== '#/strategy/done') to = '#/share/bt/mine' + (hash === '#/strategy/connect' && t.cur ? '/go' : '');
  else if (btMineStale(t, hasUser)) {
    say = '조건이 바뀌어서 다시 돌려 보겠습니다';
    to = '#/share/bt/mine';
  } else if (!t.api) to = '#/share/bt/mine' + (t.cur ? '/go' : '');
  else if (!(t.cur && t.score >= TFC_SCORE.pass)) {
    say = '현재 설정의 검증을 먼저 통과해야 합니다';
    to = '#/share/bt/mine';
  }
  useLayoutEffect(() => {
    if (to == null) {
      t.stage = 'done';
      t.ob.st = 'completed';
      tfSave();
      return;
    }
    if (say) toast(say);
    try {
      history.replaceState(null, '', to || window.location.pathname + window.location.search);
    } catch {
      /* 무시 */
    }
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, to]);
  if (to != null || !t.api) return null;
  const asset = (t.intake.asset || {}).label || '자산';
  /* tfExOf(ex).name: 모르는 거래소면 원본처럼 첫 거래소 이름 */
  const exName = AC_CFG.order.indexOf(t.api.ex) >= 0 ? acName(t.api.ex) : 'Binance';
  return (
    <div className="tfw">
      <div className="tf-donec">
        <div className="ck">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
        </div>
        <h3>준비가 끝났습니다</h3>
        <div className="pd">{asset} 전략이 TETH에 연결됐습니다.</div>
        <div className="rows">
          <div className="r">
            <span className="k">투자금</span>
            <span className="v">{tfWon(budgetOf())}</span>
          </div>
          <div className="r">
            <span className="k">거래소</span>
            <span className="v">
              {exName} (API •••• {t.api.last4})
            </span>
          </div>
        </div>
        <button className="tf-btn p" style={{ height: 50 }} onClick={() => tfStartStrategy('live')}>
          전략 시작
        </button>
        <button className="tf-btn s" onClick={() => tfStartStrategy('paper')}>
          가상으로 먼저 시작
        </button>
        <button className="tf-btn ghost" onClick={tfLater}>
          나중에 시작
        </button>
      </div>
    </div>
  );
}
