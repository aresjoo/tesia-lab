// 앱 셸 (원본 <div id="g-root">). 화면은 해시 경로로 고르고, 아직 옮기지 않은 경로는 원본을 연다.
import { useEffect } from 'react';
import { Home } from './screens/home/Home';
import { NfUtil } from './screens/trade/NfUtil';
import { TradeScreen, useTradePick, tradeTitle } from './screens/trade/route';
import { AuthModal } from './shell/AuthModal';
import { Footer } from './shell/Footer';
import { AppBanner, FeedbackPanel, GlcPanel, HelpWidget, SetMenu, Toast, TopBar } from './shell/Overlays';
import { Sidebar } from './shell/Sidebar';
import { useBodyClass, useWinWidth } from './state/hooks';
import { useHash } from './state/route';
import { setState, sideMobClose, sideToggle, useApp } from './state/store';

export function App() {
  const hash = useHash(); /* 경로가 바뀌면 다시 그린다 */
  /* 화면 고르기 (원본 tfRoute). AI 트레이딩 경로면 그 화면, 아니면 홈 */
  const trade = useTradePick(hash);
  /** 원본 G.mode */
  const mode = trade && trade.mode !== 'gate' ? trade.mode : 'home';
  const home = mode === 'home';
  const lang = useApp((s) => s.lang);
  const banner = useApp((s) => s.banner);
  const sideMobileOpen = useApp((s) => s.sideMobileOpen);
  const scrim = useApp((s) => s.setMenu.open || s.glcOpen);
  const w = useWinWidth();
  /* 끝이 있는 열람 화면(홈 포함)의 푸터: PC 는 사이드바 아래 전체 폭, 모바일은 본문 끝 (원본 gftPlace) */
  /* GFT_MODES: 끝이 있는 열람 화면에만 푸터를 붙인다. 터미널(tfdash)은 뺀다 */
  const wantFooter = mode !== 'tfdash';
  const footerDoc = wantFooter && w > 860;

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
  /* 화면이 바뀌면 맨 위에서 시작하고(원본 gContent), 사이드바가 지금 위치를 표시하게 알린다(gSideCur) */
  useEffect(() => {
    setState({ mode });
    const s = document.getElementById('g-scroll');
    if (s) s.scrollTop = 0;
    window.scrollTo(0, 0);
    sideMobClose(); /* 드로어에서 화면을 골랐으면 드로어는 닫는다 */
  }, [mode]);
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
            {!home && (
              /* 원본 gChead(title): 대화가 아닌 화면에서는 PC 에서 숨고(body.nochead) 모바일에서는 빈 줄로 남는다 */
              <div className="g-chead" id="g-chead">
                <span id="g-chead-title">
                  <span id="g-title-txt">{tradeTitle(trade)}</span>
                </span>
                <span className="sub" id="g-chead-sub" />
                <span className="g-tabs" id="g-tabs" />
                <span style={{ flex: 1 }} />
                <span id="g-chead-status" className="g-tag" hidden />
                <button className="g-iconbtn" id="g-chead-dots" aria-label="메뉴" aria-haspopup="true" hidden>
                  ⋮
                </button>
              </div>
            )}
            <div className="g-scroll" id="g-scroll">
              <div id="g-content">
                {trade ? <TradeScreen pick={trade} /> : <Home />}
                {wantFooter && !footerDoc && <Footer lime={home} />}
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
        <NfUtil />
      </div>
      <Toast />
      <AuthModal />
      <HelpWidget />
    </>
  );
}
