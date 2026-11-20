// 앱 셸 (원본 <div id="g-root">). 화면은 해시 경로로 고르고, 아직 옮기지 않은 경로는 원본을 연다.
import { useEffect } from 'react';
import { Chead } from './screens/conv/Chead';
import { Composer } from './screens/conv/Composer';
import { Activity, Conv, History } from './screens/conv/Conv';
import { Home } from './screens/home/Home';
import { AuthModal } from './shell/AuthModal';
import { Footer } from './shell/Footer';
import { AppBanner, FeedbackPanel, GlcPanel, HelpWidget, SetMenu, Toast, TopBar } from './shell/Overlays';
import { Sidebar } from './shell/Sidebar';
import { G, useConv } from './state/conv';
import { useBodyClass, useWinWidth } from './state/hooks';
import { useHash } from './state/route';
import { setState, sideToggle, useApp } from './state/store';
import { taiBoot } from './state/tai';

export function App() {
  useHash(); /* 경로가 바뀌면 다시 그린다. */
  useConv(); /* 대화를 열거나 닫으면 다시 그린다 */
  const mode = G.mode; /* home, conv(대화), activity(연구 과정), history(연구 기록) */
  const home = mode === 'home';
  const lang = useApp((s) => s.lang);
  const banner = useApp((s) => s.banner);
  const sideMobileOpen = useApp((s) => s.sideMobileOpen);
  const scrim = useApp((s) => s.setMenu.open || s.glcOpen);
  const w = useWinWidth();
  /* 끝이 있는 열람 화면(홈 포함)의 푸터: PC 는 사이드바 아래 전체 폭, 모바일은 본문 끝 (원본 gftPlace) */
  const footerDoc = home && w > 860;

  useBodyClass('g-dark', true);
  useBodyClass('has-banner', banner && home); /* 앱 배너는 홈에서만 */
  useBodyClass('gft-doc', footerDoc, true);
  useBodyClass('nochead', !(G.cur && !home)); /* 머리줄은 대화가 열려 있을 때만 */
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
            <Chead />
            <div className="g-scroll" id="g-scroll">
              <div id="g-content">
                {home ? (
                  <>
                    <Home />
                    {!footerDoc && <Footer lime />}
                  </>
                ) : mode === 'conv' ? (
                  <Conv key={G.cur ? G.cur.id : ''} />
                ) : mode === 'activity' ? (
                  <Activity />
                ) : (
                  <History />
                )}
              </div>
            </div>
            <Composer />
          </main>
        </div>
        <div id="gft-slot" hidden={!footerDoc}>
          {footerDoc && <Footer lime />}
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
