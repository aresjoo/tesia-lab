// 앱 셸 (원본 <div id="g-root">). 화면은 해시 경로로 고르고, 아직 옮기지 않은 경로는 원본을 연다.
import { useEffect } from 'react';
import { BtScreen, isBtHash } from './screens/bt/BtScreen';
import { StrategyScreen, isStrategyHash } from './screens/bt/GoScreen';
import { tfIntentRun } from './screens/bt/tfState';
import { Home, homeMarkEntered } from './screens/home/Home';
import { Chead } from './screens/insight/NFView';
import { useNFRoute } from './screens/insight/route';
import { AuthModal } from './shell/AuthModal';
import { Footer } from './shell/Footer';
import { AppBanner, FeedbackPanel, GlcPanel, HelpWidget, SetMenu, Toast, TopBar } from './shell/Overlays';
import { Sidebar } from './shell/Sidebar';
import { useBodyClass, useWinWidth } from './state/hooks';
import { useHash } from './state/route';
import { setState, sideToggle, useApp } from './state/store';

/** GFT_MODES: 푸터가 붙는 화면. 대화, 백테스트, 터미널, 설정은 뺀다 (메인 홈만 라임, 나머지는 검정) */
const GFT_MODES: Record<string, 1> = { home: 1, tfintro: 1, tfinactive: 1, tfss3: 1, tfss3d: 1, tfbrokers: 1, tfbroker: 1, tfcpx: 1, nfplan: 1, nfbot: 1, nfins: 1, nfreview: 1, nfperiodic: 1 };

export function App() {
  const hash = useHash(); /* 경로가 바뀌면 다시 그린다 */
  /* 화면 고르기: 조각마다 자기 경로를 본다. 아무도 맡지 않으면 홈이다 (원본 tfRoute, G.mode) */
  /* 백테스트 여정과 전략 만들기 퍼널 */
  const bt = isBtHash(hash) || isStrategyHash(hash);
  /* 인사이트, 거래복기, 정기 보고 (원본 tfNFRoute) */
  const nf = useNFRoute(bt ? '' : hash);
  const mode = bt ? (isBtHash(hash) ? 'tfbt' : 'tfdone') : nf ? nf.mode : 'home';
  const home = mode === 'home';
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
  useBodyClass('nochead', true); /* 대화 머리줄이 없는 화면 (홈 포함) */
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
    setState({ mode }); /* 원본 G.mode: 사이드바의 현재 위치 표시가 읽는다 */
    if (mode !== 'home') homeMarkEntered(); /* 홈의 등장 연출은 맨 처음 화면이 홈일 때만 */
  }, [mode]);
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
            {nf && <Chead title={nf.title} />}
            <div className="g-scroll" id="g-scroll">
              <div id="g-content">
                {bt ? isBtHash(hash) ? <BtScreen hash={hash} /> : <StrategyScreen hash={hash} /> : nf ? nf.el : <Home />}
                {footerOn && !footerDoc && <Footer lime={home} />}
              </div>
            </div>
          </main>
        </div>
        <div id="gft-slot" hidden={!footerDoc}>
          {footerDoc && <Footer lime={home} />}
        </div>
        <div id="g-scrim" className={sideMobileOpen ? 'on' : ''} onClick={sideToggle} />
        <div id="gm-scrim" className={scrim ? 'on' : ''} onClick={() => setState({ setMenu: { open: false }, glcOpen: false })} />
        <SetMenu />
        <FeedbackPanel />
      </div>
      <Toast />
      <AuthModal />
      <HelpWidget />
    </>
  );
}
