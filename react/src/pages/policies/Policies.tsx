// 개인정보 보호와 약관 페이지 (원본 policies/index.html). 해시 경로와 목차 규칙은 core/pages/policies.ts 에 있다.
// 원본처럼 한국어 한 가지다(문구 표가 없다).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { PAGES } from '../../core/config';
import { isPolicyDoc, POLICY_TABS, POLICY_TOC, POLICY_VIEWS, policyView, tocCurrent, tocScrollTop, type PolicyDoc } from '../../core/pages/policies';
import { Footer } from '../../shell/Footer';
import { HelpWidget } from '../../shell/Overlays';
import { useHash } from '../../state/route';
import { SubHelp } from '../shared/page';
import { Faq } from './views/Faq';
import { Overview } from './views/Overview';
import { Privacy } from './views/Privacy';
import { Technologies } from './views/Technologies';
import { Terms } from './views/Terms';

/** 목차와 본문 속 a[data-t]: 그 절로 굴린다 (움직임 줄이기 설정이면 바로) */
function goSection(e: MouseEvent, t: string) {
  e.preventDefault();
  const el = document.getElementById(t);
  if (!el) return;
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  window.scrollTo({ top: tocScrollTop(el.getBoundingClientRect().top, window.scrollY), behavior });
}

export function Policies() {
  const hash = useHash();
  const view = policyView(hash);
  /* 문서별 지금 절(목차에서 켜진 줄). 처음에는 첫 절이다. */
  const [cur, setCur] = useState<Record<PolicyDoc, number>>({ privacy: 0, terms: 0, technologies: 0 });
  const tabs = useRef<HTMLElement>(null);

  /** tocSpy(): 켜진 문서의 목차에서 지금 절을 고른다 */
  const spy = useCallback(() => {
    const v = policyView(window.location.hash);
    if (!isPolicyDoc(v)) return;
    const i = tocCurrent(POLICY_TOC[v].map((x) => document.getElementById(x.t)?.getBoundingClientRect().top ?? null));
    setCur((c) => (c[v] === i ? c : { ...c, [v]: i }));
  }, []);

  /* route(): 켜진 탭이 보이게 탭 줄을 굴리고 문서를 맨 위로 올린 뒤, 목차를 다시 고른다 */
  useLayoutEffect(() => {
    const tb = tabs.current;
    const on = tb?.querySelector<HTMLElement>('a.on');
    if (tb && on) tb.scrollLeft = Math.max(0, on.offsetLeft - tb.offsetLeft - 16);
    window.scrollTo(0, 0);
    spy();
  }, [hash, spy]);
  useEffect(() => {
    window.addEventListener('scroll', spy, { passive: true });
    return () => window.removeEventListener('scroll', spy);
  }, [spy]);

  const toc = (doc: PolicyDoc) => (
    <nav className="toc" data-toc="">
      {POLICY_TOC[doc].map((x, i) => (
        <a key={x.t} href={'#' + doc} data-t={x.t} className={i === cur[doc] ? 'on' : undefined} onClick={(e) => goSection(e, x.t)}>
          {x.label}
        </a>
      ))}
    </nav>
  );
  const on = (v: (typeof POLICY_VIEWS)[number]) => 'view' + (v === view ? ' on' : '');

  return (
    <>
      <header className="hd">
        <a className="brand" href={PAGES.app} style={{ color: '#00f0ff' }}>
          <img src="assets/logo.png?v=3" alt="" style={{ width: 22, height: 'auto' }} />
          TETH
        </a>
        <nav>
          <a href={PAGES.about}>TETH 정보</a>
          <a href={PAGES.download}>앱 다운로드</a>
        </nav>
        <span className="sp" />
        <a className="cta" href={PAGES.app}>
          시작하기
        </a>
      </header>

      <main>
        <div className="pg-top">
          <span className="pg-lb">TETH</span>
          <h1 className="pg-h1">개인정보 보호와 약관</h1>
          <nav className="tabs" id="tabs" ref={tabs}>
            {POLICY_TABS.map((t) => (
              <a key={t.v} href={'#' + t.v} data-v={t.v} className={t.v === view ? 'on' : undefined}>
                {t.label}
              </a>
            ))}
          </nav>
        </div>

        <section className={on('overview')} id="v-overview">
          <Overview />
        </section>
        <section className={on('privacy')} id="v-privacy">
          <Privacy toc={toc('privacy')} />
        </section>
        <section className={on('terms')} id="v-terms">
          <Terms toc={toc('terms')} go={goSection} />
        </section>
        <section className={on('technologies')} id="v-technologies">
          <Technologies toc={toc('technologies')} />
        </section>
        <section className={on('faq')} id="v-faq">
          <Faq />
        </section>
      </main>

      <SubHelp />
      <Footer standalone />
      <HelpWidget />
    </>
  );
}
