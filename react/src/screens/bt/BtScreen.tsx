// 백테스트 화면 (원본 btRoute, btView, btPage, btHeadHtml, btLegend, fuLegend).
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { btAi, btSkipL, isFut, tfSSFind } from '../../core/bt/compute';
import { MK_KIND, mkHook, mkInstList, mkOne, mkScope, type Strat } from '../../core/bt/engine';
import { useBodyClass } from '../../state/hooks';
import { goHome, nav } from '../../state/route';
import { authOpen, getState, toast, useApp } from '../../state/store';
import { Chart } from './Chart';
import { Evidence } from './Evidence';
import { GoPage } from './GoScreen';
import { Mcta, Panel, Rail } from './Rail';
import { BT, backToChat, btBack, btEnsureR, btEnter, btMounted, btRedraw, btSub, btView, useBt } from './bt';
import { Back, MkGlyph, mkGlossClose, tx } from './parts';
import { tfIntentSet, tfRefresh, tfS } from './tfState';

/** btHeadHtml() */
function Head({ s }: { s: Strat }) {
  return (
    <div className="bt-id">
      <MkGlyph s={s} z={40} />
      <div className="bt-id-t">
        <h2>{tx(mkHook(s))}</h2>
        <p>{tx(mkOne(s))}</p>
        <div className="bt-id-m">
          <b>{tx(MK_KIND[s.kind], true)}</b>
          <span>{tx(mkScope(s), true)}</span>
          <span>{tx(mkInstList(s).join(', '), true)}</span>
        </div>
      </div>
    </div>
  );
}
const Tri = ({ d, fill, stroke }: { d: string; fill: string; stroke?: string }) => (
  <svg width="11" height="10" viewBox="0 0 11 10" aria-hidden="true">
    <path d={d} fill={fill} stroke={stroke} strokeWidth={stroke ? '1.4' : undefined} strokeLinejoin={stroke ? 'round' : undefined} />
  </svg>
);
/** btLegend(), 선물이면 fuLegend() */
function Legend({ s }: { s: Strat }) {
  const legAmt = useBt((b) => b.legAmt);
  const bench = useBt((b) => b.legBench);
  const fut = isFut(s);
  const UP = 'M5.5 1l4.5 8h-9z';
  const DN = 'M5.5 9l4.5 -8h-9z';
  return (
    <div className="bt-leg">
      <span className="a">이 전략</span>
      <span className="skb-lg-base">{'시작 금액 $' + Math.round(legAmt).toLocaleString()}</span>
      <span className="b">
        {tx('그냥 들고 있었다면 ', true)}
        <i className="num">{bench}</i>
      </span>
      <span className="m">
        <Tri d={UP} fill="#2fb98a" />
        {fut ? '롱 진입' : '매수'}
      </span>
      {fut && (
        <span className="m">
          <Tri d={DN} fill="#b08cf5" />숏 진입
        </span>
      )}
      <span className="m">
        <Tri d={DN} fill="none" stroke="#cfd3d8" />
        {fut ? '청산' : '매도'}
      </span>
      {btAi(s) && (
        <span className="m">
          <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
            <rect x="2.4" y="2.4" width="6.2" height="6.2" transform="rotate(45 5.5 5.5)" fill="none" stroke="#f0b840" strokeWidth="1.5" />
          </svg>
          {tx(btSkipL(s), true)}
        </span>
      )}
    </div>
  );
}

/** btPage() */
function Page() {
  const s = useBt((b) => b.s) as Strat;
  const phase = useBt((b) => b.phase);
  const cur = useBt((b) => b.cur);
  const per = useBt((b) => b.per);
  const amt = useBt((b) => b.amt);
  const cap = useBt((b) => b.cap);
  return (
    <div className={'bt' + (cur ? ' cur' : '')} id="bt-root" data-phase={phase} data-kind={s.kind}>
      <div className="tfw-hd bt-hd">
        <button className="bk" onClick={btBack} aria-label="뒤로">
          <Back />
        </button>
        <span className="ti">백테스트</span>
        <span className="sb" id="bt-sub">
          {tx(btSub(per, amt))}
        </span>
      </div>
      <Head s={s} />
      <div className="bt-grid">
        <div className="bt-main">
          <div className="bt-cap">
            <div className="bt-cap-l">
              <small id="bt-cap-k">{tx(cap.k)}</small>
              <b className="num" id="bt-cap-v">
                {cap.v}
              </b>
              <i className={'num' + (cap.sg || '')} id="bt-cap-p">
                {cap.p}
              </i>
            </div>
            <Legend s={s} />
          </div>
          <Chart />
          <Panel />
          <Evidence />
        </div>
        <Rail />
      </div>
      <Mcta />
    </div>
  );
}

/** 고객지원 단추가 아래쪽 단추와 글을 덮지 않게 비켜 세운다 (원본 btFabDodge, btFabTick) */
function btFabDodge() {
  const h = document.getElementById('teth-help');
  if (!h) return;
  const bt = document.querySelector('#g-content .bt');
  if (!bt) {
    if (h.style.bottom) h.style.bottom = '';
    if (h.style.visibility) h.style.visibility = '';
    return;
  }
  if (!h.offsetWidth) return;
  h.style.visibility = '';
  const tg = bt.querySelectorAll('.bt-cta, .bt-sec, .btg-out, #bt-rail p, #bt-rail b, #bt-rail dd, #bt-rail .num, .btg-flow p, .btg-flow .sm, .btg-flow .ed, .btg-flow input, .btg-flow li');
  const tries = ['', 20, 150, 230, 310, 400, 500];
  for (let i = 0; i < tries.length; i++) {
    h.style.bottom = tries[i] === '' ? '' : tries[i] + 'px';
    const f = h.getBoundingClientRect();
    let hit = false;
    for (let k = 0; k < tg.length && !hit; k++) {
      const r = tg[k].getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > window.innerHeight) continue;
      hit = r.left < f.right + 8 && r.right > f.left - 8 && r.top < f.bottom + 8 && r.bottom > f.top - 8;
    }
    if (!hit) return;
  }
  h.style.bottom = '';
  h.style.visibility = 'hidden'; /* 비켜 설 자리가 없으면 내용을 덮지 않고 물러난다 */
}
let fabT = 0;
function btFabTick() {
  if (fabT) return;
  fabT = requestAnimationFrame(() => {
    fabT = 0;
    try {
      btFabDodge();
    } catch {
      /* 무시 */
    }
  });
}

const RE = /^#\/share\/bt\/([^/]+)(?:\/(go))?$/;
/** 이 화면이 맡는 주소인가 */
export const isBtHash = (h: string) => h.indexOf('#/share/bt/') === 0;

/** btRoute(h): 주소에서 전략을 찾아 준비나 결과, 실행 준비 화면을 연다 */
export function BtScreen({ hash }: { hash: string }) {
  const user = useApp((s) => s.user);
  const id = useBt((b) => b.id);
  const reroute = useBt((b) => b.route);
  /* 주소가 바뀌어 들어올 때 저장소의 퍼널 상태를 다시 맞춘다 */
  useMemo(tfRefresh, [hash, reroute]);
  const m = hash.match(RE);
  const go = !!(m && m[2]);
  /* 지금 주소의 전략이 화면에 올라와 있는가 */
  let s: Strat | null = null;
  if (m && user) {
    try {
      s = tfSSFind(decodeURIComponent(m[1]), tfS(), true);
    } catch {
      s = null;
    }
  }
  const ready = !!s && !!s.cfg && id === s.id && !!BT.s;

  useBodyClass('tf-route', true);
  useBodyClass('pl-page', ready && go);
  useBodyClass('pl-dark', ready && go);
  useBodyClass('px-go', ready && go);
  useLayoutEffect(() => {
    btMounted(true);
    return () => {
      btMounted(false);
      mkGlossClose();
      const h = document.getElementById('teth-help');
      if (h) {
        h.style.bottom = '';
        h.style.visibility = '';
      }
    };
  }, []);
  useLayoutEffect(() => {
    if (!m) {
      /* 주소가 맞지 않으면 전략 찾기로 (원본 tfShareHub('find')). 전략 찾기는 전략 복사 조각의 화면이다 */
      goHome();
      return;
    }
    if (!user) {
      /* 비회원: 내 전략이면 홈으로, 아니면 그 전략의 상세로 보내고 인증이 끝나면 이 백테스트로 돌아온다 */
      if (m[1] === 'mine') {
        try {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch {
          /* 무시 */
        }
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        return;
      }
      const gid = m[1];
      tfIntentSet({ kind: 'bt', id: gid });
      nav('#/share/s/' + gid);
      setTimeout(() => {
        if (!getState().user) authOpen('signup');
      }, 400);
      return;
    }
    if (!s && m[1] === 'mine') {
      toast('이 자산은 아직 백테스트할 가격 자료가 없습니다');
      backToChat();
      return;
    }
    if (!s || !s.cfg) {
      goHome();
      return;
    }
    btEnter(s, tfS());
    const sc = document.getElementById('g-scroll');
    if (sc) sc.scrollTop = 0;
    if (go) btEnsureR();
    else btView();
    // 주소나 로그인 상태가 바뀔 때만 다시 들어간다 (원본은 hashchange 마다 btRoute 를 부른다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, !!user, reroute]);
  /* 창 크기가 바뀌면 그래프를 다시 재고, 고객지원 단추를 비켜 세운다 */
  useEffect(() => {
    let rs = 0;
    const onRs = () => {
      clearTimeout(rs);
      rs = window.setTimeout(btRedraw, 160);
      btFabTick();
    };
    window.addEventListener('resize', onRs);
    document.addEventListener('scroll', btFabTick, true);
    const t = setTimeout(btFabTick, 500);
    return () => {
      clearTimeout(rs);
      clearTimeout(t);
      window.removeEventListener('resize', onRs);
      document.removeEventListener('scroll', btFabTick, true);
    };
  }, [hash]);

  if (!ready) return null;
  return go ? <GoPage /> : <Page />;
}
