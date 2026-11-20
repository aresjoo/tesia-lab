// 앱 셸 (원본 <div id="g-root">). 화면은 해시 경로로 고르고, 아직 옮기지 않은 경로는 원본을 연다.
import { useEffect, useLayoutEffect } from 'react';
import { Home } from './screens/home/Home';
import { CopyDetail } from './screens/share/CopyDetail';
import { Detail } from './screens/share/Detail';
import { FollowSheet } from './screens/share/FollowSheet';
import { Hub } from './screens/share/Hub';
import { tfSSFind } from './core/engine/catalog';
import { AuthModal } from './shell/AuthModal';
import { Footer } from './shell/Footer';
import { AppBanner, FeedbackPanel, GlcPanel, HelpWidget, SetMenu, Toast, TopBar } from './shell/Overlays';
import { Sidebar } from './shell/Sidebar';
import { useBodyClass, useWinWidth } from './state/hooks';
import { parseHash, useHash } from './state/route';
import { setState, sideToggle, useApp } from './state/store';

/** gChead(mkHook(s)): 머리줄 제목은 전략 이름 */
function detailTitle(ne: string): string {
  try {
    return tfSSFind(decodeURIComponent(ne))?.name || '전략 복사';
  } catch {
    return '전략 복사';
  }
}

export function App() {
  /* 해시 경로로 화면을 고른다 (원본 tfRoute). 옮긴 화면: 홈, 전략 복사(목록, 상세, 복사한 전략 상세) */
  const scr = parseHash(useHash());
  const isHome = scr.k === 'home';
  /* 화면이 바뀌면 맨 위로. 같은 상세 안의 기간, 탭 전환은 그대로 둔다 */
  const scrKey = scr.k === 'detail' ? 'd:' + scr.ne : scr.k === 'copy' ? 'c:' + scr.cid : scr.k;
  const lang = useApp((s) => s.lang);
  const banner = useApp((s) => s.banner);
  const sideMobileOpen = useApp((s) => s.sideMobileOpen);
  const scrim = useApp((s) => s.setMenu.open || s.glcOpen);
  const w = useWinWidth();
  /* 끝이 있는 열람 화면(홈 포함)의 푸터: PC 는 사이드바 아래 전체 폭, 모바일은 본문 끝 (원본 gftPlace) */
  const footerDoc = w > 860;

  useBodyClass('g-dark', true);
  useBodyClass('has-banner', banner && isHome); /* 앱 배너는 홈에서만 */
  useBodyClass('gft-doc', footerDoc, true);
  useBodyClass('nochead', true); /* 대화 머리줄이 없는 화면 (홈 포함) */
  useLayoutEffect(() => {
    const s = document.getElementById('g-scroll');
    if (s) s.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [scrKey]);
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
            {/* 대화 머리줄 자리. 홈에서는 숨긴다(gHome). 그 밖에는 데스크톱에서 숨고(nochead), 모바일에서는 메뉴 단추 높이만큼 자리를 지킨다 */}
            <div className="g-chead" id="g-chead" hidden={isHome}>
              <span id="g-chead-title">
                <span id="g-title-txt">{scr.k === 'detail' ? detailTitle(scr.ne) : scr.k === 'share' ? '전략 복사' : ''}</span>
              </span>
              <span className="sub" id="g-chead-sub" />
              <span className="g-tabs" id="g-tabs" />
              <span style={{ flex: 1 }} />
            </div>
            <div className="g-scroll" id="g-scroll">
              <div id="g-content">
                {scr.k === 'home' ? <Home /> : scr.k === 'share' ? <Hub /> : scr.k === 'detail' ? <Detail key={scr.ne} ne={scr.ne} pd={scr.pd} tab={scr.tab} setup={!!scr.setup} /> : <CopyDetail key={scr.cid} cid={scr.cid} tab={scr.tab} />}
                {!footerDoc && <Footer lime={isHome} />}
              </div>
            </div>
          </main>
        </div>
        <div id="gft-slot" hidden={!footerDoc}>
          {footerDoc && <Footer lime={isHome} />}
        </div>
        <div id="g-scrim" className={sideMobileOpen ? 'on' : ''} onClick={sideToggle} />
        <div id="gm-scrim" className={scrim ? 'on' : ''} onClick={() => setState({ setMenu: { open: false }, glcOpen: false })} />
        <SetMenu />
        <FeedbackPanel />
      </div>
      <Toast />
      <AuthModal />
      <FollowSheet />
      <HelpWidget />
    </>
  );
}
