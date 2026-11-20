// 앱 셸 (원본 <div id="g-root">). 화면은 해시 경로로 고르고, 아직 옮기지 않은 경로는 원본을 연다.
import { useEffect, useRef } from 'react';
import { AccountOverlays } from './screens/account/Overlays';
import { accountGuard, accountScreen } from './screens/account/routes';
import { BtScreen, isBtHash } from './screens/bt/BtScreen';
import { StrategyScreen, isStrategyHash } from './screens/bt/GoScreen';
import { tfIntentRun } from './screens/bt/tfState';
import { Chead } from './screens/conv/Chead';
import { Composer } from './screens/conv/Composer';
import { Activity, Conv, History } from './screens/conv/Conv';
import { Home, homeMarkEntered } from './screens/home/Home';
import { Chead as NFChead } from './screens/insight/NFView';
import { useNFRoute } from './screens/insight/route';
import { NfUtil } from './screens/trade/NfUtil';
import { TradeScreen, tradeTitle, useTradePick } from './screens/trade/route';
import { routedEnter, routedLeave } from './state/back';
import { AuthModal } from './shell/AuthModal';
import { Footer } from './shell/Footer';
import { AppBanner, FeedbackPanel, GlcPanel, HelpWidget, SetMenu, Toast, TopBar } from './shell/Overlays';
import { Sidebar } from './shell/Sidebar';
import { G, useConv } from './state/conv';
import { useBodyClass, useWinWidth } from './state/hooks';
import { useHash } from './state/route';
import { setState, sideMobClose, sideToggle, useApp } from './state/store';
import { taiBoot } from './state/tai';

/** GFT_MODES: 푸터가 붙는 화면. 대화, 백테스트, 터미널, 설정은 뺀다 (메인 홈만 라임, 나머지는 검정) */
const GFT_MODES: Record<string, 1> = { home: 1, tfintro: 1, tfinactive: 1, tfss3: 1, tfss3d: 1, tfbrokers: 1, tfbroker: 1, tfcpx: 1, nfplan: 1, nfbot: 1, nfins: 1, nfreview: 1, nfperiodic: 1 };

export function App() {
  const hash = useHash(); /* 경로가 바뀌면 다시 그린다 */
  useConv(); /* 대화를 열거나 닫으면 다시 그린다 */
  const user = useApp((s) => s.user);
  /* 화면 고르기 (원본 tfRoute, G.mode): 해시 화면이면 그 조각이 그리고, 아니면 대화 쪽 상태(G.mode: home, conv, activity, history)를 따른다 */
  /* 백테스트 여정과 전략 만들기 퍼널 */
  const bt = isBtHash(hash) || isStrategyHash(hash);
  /* 거래소 연결, 설정, 이용 현황 */
  const acct = bt ? null : accountScreen(hash, user);
  /* AI 트레이딩: 손님 소개, 비활성, 터미널, 봇 상세. gate 는 회원 전용 주소에 들어온 손님(로그인 창을 띄우고 홈으로) */
  const trade = useTradePick(bt || acct ? '' : hash);
  const tradeOn = !!trade && trade.mode !== 'gate';
  /* 인사이트, 거래복기, 정기 보고 (원본 tfNFRoute) */
  const nf = useNFRoute(bt || acct || trade ? '' : hash);
  const routed = bt || !!acct || !!trade || !!nf;
  const mode: string = bt ? (isBtHash(hash) ? 'tfbt' : 'tfdone') : acct ? acct.mode : trade ? (tradeOn ? trade.mode : 'home') : nf ? nf.mode : G.mode;
  const home = mode === 'home';
  const title = acct ? acct.title : tradeOn ? tradeTitle(trade) : nf ? nf.title : '';
  const chead = useApp((s) => s.chead);
  useEffect(() => {
    accountGuard(hash, user);
  }, [hash, user]);
  /* gContent(): 다른 화면으로 넘어가면 맨 위에서 시작한다 */
  useEffect(() => {
    if (!acct && !trade) return;
    const sc = document.getElementById('g-scroll');
    if (sc) sc.scrollTop = 0;
    window.scrollTo(0, 0);
    if (trade) sideMobClose(); /* 드로어에서 AI 트레이딩 화면을 골랐으면 드로어는 닫는다 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  const lang = useApp((s) => s.lang);
  const banner = useApp((s) => s.banner);
  const sideMobileOpen = useApp((s) => s.sideMobileOpen);
  const scrim = useApp((s) => s.setMenu.open || s.glcOpen);
  const w = useWinWidth();
  /* 끝이 있는 열람 화면(홈 포함)의 푸터: PC 는 사이드바 아래 전체 폭, 모바일은 본문 끝 (원본 gftPlace) */
  const footerOn = !!GFT_MODES[mode];
  const footerDoc = footerOn && w > 860;

  useBodyClass('g-dark', true);
  useBodyClass('has-banner', banner && home); /* 앱 배너는 홈에서만 */
  useBodyClass('gft-doc', footerDoc, true);
  useBodyClass('nochead', routed || !(G.cur && !home)); /* 머리줄은 대화가 열려 있을 때만 */
  /* 해시 화면에 들어오면 보던 대화를 닫고, 뒤로가기로 나오면 그 대화로 돌아간다 */
  const wasRouted = useRef(false);
  useEffect(() => {
    if (routed) routedEnter();
    else if (wasRouted.current) routedLeave();
    wasRouted.current = routed;
  }, [routed, hash]);
  useEffect(() => {
    taiBoot(); /* AI 프록시 주소를 정하고, 새로고침이면 보던 대화의 끝으로 내려간다 */
  }, []);
  /* 모바일: 아래로 내리면 메뉴 단추를 숨기고, 올리면 다시 보인다 */
  useEffect(() => {
    const s = document.getElementById('g-scroll');
    if (!s) return;
    let lastY = s.scrollTop;
    const h = () => {
      if (window.innerWidth > 860) return;
      const y = s.scrollTop;
      if (y > 60 && y > lastY + 4) document.body.classList.add('ham-hide');
      else if (y < lastY - 4 || y <= 60) document.body.classList.remove('ham-hide');
      lastY = y;
    };
    s.addEventListener('scroll', h, { passive: true });
    return () => s.removeEventListener('scroll', h);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  /* 인증이 끝나면 하려던 일(백테스트 열기)로 돌아간다 (원본 tfIntentRun) */
  const authed = useApp((s) => !!s.user);
  useEffect(() => {
    if (authed) tfIntentRun();
  }, [authed]);
  useEffect(() => {
    setState({ mode, chead: title }); /* 원본 G.mode: 사이드바의 현재 위치 표시가 읽는다 */
    if (mode !== 'home') homeMarkEntered(); /* 홈의 등장 연출은 맨 처음 화면이 홈일 때만 */
  }, [mode, title]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      /* 원본은 Esc 로 열린 모달(.modal-bg.open)을 모두 닫는다: 인증 창도 닫힌다 */
      if (e.key === 'Escape') setState((s) => ({ setMenu: { open: false }, fbOpen: false, auth: s.auth.open ? { ...s.auth, open: false } : s.auth }));
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  return (
    <>
      <div id="g-root">
        <AppBanner />
        <TopBar />
        <GlcPanel />
        <div className="g-body">
          <Sidebar />
          <main className="g-center">
            {acct || tradeOn || nf ? <NFChead title={(acct && chead) || title} /> : !routed && <Chead />}
            <div className="g-scroll" id="g-scroll">
              <div id="g-content">
                {bt ? (
                  isBtHash(hash) ? (
                    <BtScreen hash={hash} />
                  ) : (
                    <StrategyScreen hash={hash} />
                  )
                ) : acct ? (
                  acct.node
                ) : trade ? (
                  <TradeScreen pick={trade} />
                ) : nf ? (
                  nf.el
                ) : mode === 'conv' ? (
                  <Conv key={G.cur ? G.cur.id : ''} />
                ) : mode === 'activity' ? (
                  <Activity />
                ) : mode === 'history' ? (
                  <History />
                ) : (
                  <Home />
                )}
                {footerOn && !footerDoc && <Footer lime={home} />}
              </div>
            </div>
            {!routed && <Composer />}
          </main>
        </div>
        <div id="gft-slot" hidden={!footerDoc}>
          {footerDoc && <Footer lime={home} />}
        </div>
        <div id="g-scrim" className={sideMobileOpen ? 'on' : ''} onClick={sideToggle} />
        <div id="gm-scrim" className={scrim ? 'on' : ''} onClick={() => setState({ setMenu: { open: false }, glcOpen: false })} />
        <SetMenu />
        <FeedbackPanel />
        <NfUtil />
      </div>
      <Toast />
      <AuthModal />
      <AccountOverlays />
      <HelpWidget />
    </>
  );
}
