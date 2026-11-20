// 앱 셸 (원본 <div id="g-root">). 화면은 해시 경로로 고르고, 아직 옮기지 않은 경로는 원본을 연다.
import { useEffect } from 'react';
import { AccountOverlays } from './screens/account/Overlays';
import { accountGuard, accountScreen } from './screens/account/routes';
import { Home } from './screens/home/Home';
import { AuthModal } from './shell/AuthModal';
import { Footer } from './shell/Footer';
import { AppBanner, FeedbackPanel, GlcPanel, HelpWidget, SetMenu, Toast, TopBar } from './shell/Overlays';
import { Sidebar } from './shell/Sidebar';
import { useBodyClass, useWinWidth } from './state/hooks';
import { useHash } from './state/route';
import { setState, sideToggle, useApp } from './state/store';

/** GFT_MODES: 푸터가 붙는 화면. 채팅, 터미널, 설정은 뺀다 */
const GFT_MODES: Record<string, 1> = { home: 1, tfintro: 1, tfinactive: 1, tfss3: 1, tfss3d: 1, tfbrokers: 1, tfbroker: 1, tfcpx: 1, nfplan: 1, nfbot: 1, nfins: 1, nfreview: 1, nfperiodic: 1 };

export function App() {
  const hash = useHash(); /* 경로가 바뀌면 다시 그린다 */
  const user = useApp((s) => s.user);
  /* 화면 고르기: 조각마다 자기 경로를 본다. 아무도 맡지 않으면 홈이다. */
  const scr = accountScreen(hash, user);
  const mode = scr ? scr.mode : 'home';
  const title = scr ? scr.title : '';
  const chead = useApp((s) => s.chead);
  useEffect(() => {
    accountGuard(hash, user);
  }, [hash, user]);
  useEffect(() => {
    setState({ mode, chead: title });
  }, [mode, title]);
  /* gContent(): 다른 화면으로 넘어가면 맨 위에서 시작한다 */
  useEffect(() => {
    const sc = document.getElementById('g-scroll');
    if (sc) sc.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [mode]);
  const lang = useApp((s) => s.lang);
  const banner = useApp((s) => s.banner);
  const sideMobileOpen = useApp((s) => s.sideMobileOpen);
  const scrim = useApp((s) => s.setMenu.open || s.glcOpen);
  const w = useWinWidth();
  /* 끝이 있는 열람 화면(홈 포함)의 푸터: PC 는 사이드바 아래 전체 폭, 모바일은 본문 끝 (원본 gftPlace, GFT_MODES) */
  const footerOn = !!GFT_MODES[mode];
  const footerDoc = footerOn && w > 860;
  const lime = mode === 'home'; /* 메인 홈만 라임, 나머지는 검정 */

  useBodyClass('g-dark', true);
  useBodyClass('has-banner', banner && mode === 'home'); /* 앱 배너는 메인(홈)에서만 */
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
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setState({ setMenu: { open: false }, fbOpen: false });
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
            {mode !== 'home' && (
              <div className="g-chead" id="g-chead">
                <span id="g-chead-title">
                  <span id="g-title-txt">{chead || title}</span>
                </span>
                <span className="sub" id="g-chead-sub" />
                <span className="g-tabs" id="g-tabs" />
                <span style={{ flex: 1 }} />
              </div>
            )}
            <div className="g-scroll" id="g-scroll">
              <div id="g-content">
                {scr ? scr.node : <Home />}
                {footerOn && !footerDoc && <Footer lime={lime} />}
              </div>
            </div>
          </main>
        </div>
        <div id="gft-slot" hidden={!footerDoc}>
          {footerDoc && <Footer lime={lime} />}
        </div>
        <div id="g-scrim" className={sideMobileOpen ? 'on' : ''} onClick={sideToggle} />
        <div id="gm-scrim" className={scrim ? 'on' : ''} onClick={() => setState({ setMenu: { open: false }, glcOpen: false })} />
        <SetMenu />
        <FeedbackPanel />
      </div>
      <Toast />
      <AuthModal />
      <AccountOverlays />
      <HelpWidget />
    </>
  );
}
