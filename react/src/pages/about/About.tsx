// 소개 페이지 (원본 about/index.html). 내용 표는 core/pages/about.ts 에 있다.
import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { PAGES } from '../../core/config';
import { ABOUT_CHECKS, ABOUT_EXCHANGES, ABOUT_FAQ, ABOUT_FINAL, ABOUT_HERO, ABOUT_PLANS, ABOUT_PRICE_UNIT, ABOUT_STEPS, exchangeLogo, type AboutItem, type AboutPlan, type AboutStep } from '../../core/pages/about';
import { ABOUT_PI } from '../../core/pages/pi.data';
import { Footer } from '../../shell/Footer';
import { HelpWidget } from '../../shell/Overlays';
import { PageIco } from '../shared/PageIcons';
import { usePageLang } from '../shared/page';

/**
 * 원본의 reveal: 화면에 들어오면 .rv 에 'in' 을 붙인다(IntersectionObserver, threshold .1, 한 번만).
 * 지금 CSS 는 .ab .rv 를 늘 보이게 두어서 눈에 보이는 차이는 없고 class 만 원본과 같게 붙는다.
 */
function Rv({ as: Tag = 'div', className, children }: { as?: ElementType; className: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={className + ' rv' + (seen ? ' in' : '')}>
      {children}
    </Tag>
  );
}

/** 원본 logos: 연결 가능한 거래소 로고 줄 */
function Logos() {
  return (
    <span className="pl-logos">
      {ABOUT_EXCHANGES.map((e) => (
        <img key={e[0]} src={exchangeLogo(e)} alt="" width={16} height={16} />
      ))}
    </span>
  );
}

/** 원본 li(k,t) */
function Items({ items }: { items: AboutItem[] }) {
  return (
    <ul className="pl-items">
      {items.map((it) => (
        <li key={it.t}>
          <PageIco k={it.ic} />
          {it.logos ? (
            <span>
              {it.t + ' '}
              <Logos />
            </span>
          ) : (
            <span>{it.t}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function StepCard({ s }: { s: AboutStep }) {
  return (
    <Rv as="article" className="ab-card">
      <div className="ab-tx">
        <span className="pl-lb">{s.lb}</span>
        <h2 className="ab-h">{s.h}</h2>
        <p className="ab-d">{s.d}</p>
        <Items items={s.items} />
        <a className="ab-link" href={PAGES.app}>
          {s.link}
        </a>
      </div>
      <div className={'ab-shot' + (s.shot.tall ? ' ab-tall' : '')}>
        <img src={s.shot.src} width={s.shot.w} height={s.shot.h} loading="lazy" alt={s.shot.alt} />
      </div>
    </Rv>
  );
}

/** 요금 카드: 앱의 플랜 화면과 같은 내용과 모양 (TETH 초대 계정, TETH 구독) */
function PlanCard({ p }: { p: AboutPlan }) {
  return (
    <article className={'pl-card' + (p.hi ? ' pl-hi' : '')}>
      <div className="pl-top">
        <span className="pl-lb">{p.lb}</span>
      </div>
      <h3 className="pl-h">{p.h}</h3>
      <p className="pl-d">{p.d}</p>
      <div className="pl-price">
        <i>$</i>
        <span className={p.hi ? 'pl-grad' : undefined}>{p.price}</span>
        <small>{ABOUT_PRICE_UNIT}</small>
      </div>
      <a className={'pl-cta' + (p.hi ? ' pl-cta-hi' : '')} href={PAGES.app}>
        {p.cta}
      </a>
      <div className="pl-sub">{p.sub}</div>
      <Items items={p.items} />
      <p className="pl-foot">{p.foot}</p>
    </article>
  );
}

export function About() {
  const { t } = usePageLang(ABOUT_PI);
  /*
   * 원본에는 스크롤하면 머리줄에 'lite' 를 붙이는 줄이 있지만, 기준으로 삼는 .hero 가 지금 문서에 없어
   * (구성이 .ab-hero 로 바뀜) 그 줄은 늘 오류로 끝나고 머리줄은 투명한 채로 남는다. 그래서 옮기지 않았다.
   * 별 배경 캔버스(#stars)도 원본에서 hidden 이라 자리만 둔다.
   */
  return (
    <>
      <header className="hd" id="hd">
        <a className="brand" href={PAGES.app} style={{ color: '#00f0ff' }}>
          <img src="assets/logo.png?v=3" alt="" style={{ width: 22, height: 'auto', display: 'block' }} />
          TETH
        </a>
        <nav>
          <a href={PAGES.about} data-i="navAbout">
            {t('navAbout', 'TETH 정보')}
          </a>
          <a href={PAGES.download} target="_blank" rel="noopener noreferrer" data-i="navDl">
            {t('navDl', '앱 다운로드')}
          </a>
        </nav>
        <span className="sp" />
        <a className="cta" href={PAGES.app} data-i="cta">
          {t('cta', '시작하기')}
        </a>
      </header>

      <canvas id="stars" hidden />
      <main className="ab">
        <section className="ab-hero">
          <span className="pl-lb">{ABOUT_HERO.lb}</span>
          <h1 className="ab-h1">{ABOUT_HERO.h1}</h1>
          <p className="ab-d">{ABOUT_HERO.d}</p>
          <div className="ab-acts">
            <a className="ab-cta" href={PAGES.app}>
              {ABOUT_HERO.cta}
            </a>
            <a className="ab-link" href="#pricing">
              {ABOUT_HERO.link}
            </a>
          </div>
          <p className="ab-free">{ABOUT_HERO.free}</p>
          <div className="ab-heroshot">
            <img src={ABOUT_HERO.shot.src} width={ABOUT_HERO.shot.w} height={ABOUT_HERO.shot.h} alt={ABOUT_HERO.shot.alt} />
          </div>
        </section>
        <section className="ab-sec">
          <h2 className="ab-sh">이렇게 씁니다</h2>
          <p className="ab-ss">대화에서 시작해 실행까지 한 곳에서 이어집니다.</p>
          <div className="ab-steps">
            {ABOUT_STEPS.map((s) => (
              <StepCard key={s.lb} s={s} />
            ))}
          </div>
        </section>
        <section className="ab-sec" id="pricing">
          <h2 className="ab-sh">이용 방법을 선택합니다</h2>
          <p className="ab-ss">거래소 계정에 맞는 방법을 고릅니다.</p>
          <div className="plans pl-grid" id="plans">
            {ABOUT_PLANS.map((p) => (
              <PlanCard key={p.lb} p={p} />
            ))}
          </div>
        </section>
        <section className="ab-sec">
          <h2 className="ab-sh">이용 전에 확인합니다</h2>
          <Rv className="ab-list">
            {ABOUT_CHECKS.map((c) => (
              <div className="ab-row" key={c.b}>
                <PageIco k={c.ic} />
                <div>
                  <b>{c.b}</b>
                  <span>{c.s}</span>
                </div>
              </div>
            ))}
          </Rv>
        </section>
        <section className="ab-sec">
          <h2 className="ab-sh">자주 묻는 질문</h2>
          <Rv className="ab-list ab-faq">
            {ABOUT_FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>
                  {f.a.map((part, i) =>
                    typeof part === 'string' ? (
                      part
                    ) : (
                      <a key={i} href={PAGES.download}>
                        {part.download}
                      </a>
                    ),
                  )}
                </p>
              </details>
            ))}
          </Rv>
        </section>
        <section className="ab-sec">
          <Rv as="article" className="pl-card pl-hi ab-final">
            <span className="pl-lb">{ABOUT_FINAL.lb}</span>
            <h2 className="pl-h">{ABOUT_FINAL.h}</h2>
            <p className="pl-d">{ABOUT_FINAL.d}</p>
            <a className="pl-cta pl-cta-hi" href={PAGES.app}>
              {ABOUT_FINAL.cta}
            </a>
            <p className="ab-free">{ABOUT_FINAL.free}</p>
          </Rv>
          <p className="ab-help">
            {ABOUT_FINAL.help + ' '}
            <a className="ab-link" href={PAGES.app}>
              {ABOUT_FINAL.helpLink}
            </a>
          </p>
        </section>
      </main>
      <Footer standalone />
      <HelpWidget />
    </>
  );
}
