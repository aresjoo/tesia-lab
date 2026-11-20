// 앱 셸 (원본 <div id="g-root">). 화면은 해시 경로로 고르고, 아직 옮기지 않은 경로는 원본을 연다.
import { useEffect } from 'react';
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

export function App() {
  const hash = useHash(); /* 경로가 바뀌면 다시 그린다 */
  /* 화면 고르기: 인사이트, 거래복기, 정기 보고(원본 tfNFRoute). 나머지 주소는 홈 */
  const nf = useNFRoute(hash);
  const mode = nf ? nf.mode : 'home';
  const lang = useApp((s) => s.lang);
  const banner = useApp((s) => s.banner);
  const sideMobileOpen = useApp((s) => s.sideMobileOpen);
  const scrim = useApp((s) => s.setMenu.open || s.glcOpen);
  const w = useWinWidth();
  /* 끝이 있는 열람 화면(홈 포함)의 푸터: PC 는 사이드바 아래 전체 폭, 모바일은 본문 끝 (원본 gftPlace) */
  const footerDoc = w > 860;

  useBodyClass('g-dark', true);
  useBodyClass('has-banner', banner && mode === 'home'); /* 앱 배너는 홈에서만 */
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
                {nf ? nf.el : <Home />}
                {!footerDoc && <Footer lime={!nf} />}
              </div>
            </div>
          </main>
        </div>
        <div id="gft-slot" hidden={!footerDoc}>
          {footerDoc && <Footer lime={!nf} />}
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
