// 앱 다운로드 페이지 (원본 download/index.html). 내용 표와 규칙은 core/pages/download.ts 에 있다.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { PAGES } from '../../core/config';
import { DL_AUTO_MS, DL_QR_TODO, DL_SLIDES, DL_STORE_MO, DL_STORE_PC, DL_STORES, qrSrc, wrapSlide, type DlStore } from '../../core/pages/download';
import { DOWNLOAD_PI } from '../../core/pages/pi.data';
import { Footer } from '../../shell/Footer';
import { HelpWidget } from '../../shell/Overlays';
import { SubHelp, usePageLang } from '../shared/page';

const STORE_ICON: Record<DlStore['id'], ReactNode> = {
  android: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#34A853" d="M3.6 2.2 13.7 12 3.6 21.8c-.4-.2-.6-.6-.6-1.2V3.4c0-.6.2-1 .6-1.2z" />
      <path fill="#FBBC05" d="m13.7 12 3.2 3.1-3.9 2.2-6.5 3.7c-.3.2-.6.2-.9.1z" />
      <path fill="#EA4335" d="M13.7 12 5.6 2.9c.3-.1.6-.1.9.1l6.5 3.7 3.9 2.2z" />
      <path fill="#4285F4" d="m16.9 8.9 3.4 1.9c.9.5.9 1.9 0 2.4l-3.4 1.9L13.7 12z" />
    </svg>
  ),
  ios: (
    <svg viewBox="0 0 24 24" fill="#ececec" aria-hidden="true">
      <path d="M17.05 12.54c-.03-2.72 2.22-4.02 2.32-4.09-1.27-1.85-3.24-2.1-3.93-2.13-1.67-.17-3.26.98-4.1.98-.85 0-2.16-.96-3.55-.93-1.82.03-3.5 1.06-4.44 2.69-1.9 3.29-.49 8.16 1.36 10.83.9 1.3 1.98 2.77 3.39 2.72 1.36-.05 1.87-.88 3.52-.88 1.64 0 2.11.88 3.55.85 1.47-.02 2.4-1.33 3.29-2.64 1.04-1.52 1.47-2.99 1.49-3.06-.03-.02-2.86-1.1-2.9-4.34zM14.34 4.56c.75-.91 1.25-2.17 1.11-3.43-1.08.04-2.38.72-3.15 1.63-.69.8-1.3 2.09-1.14 3.32 1.2.09 2.43-.61 3.18-1.52z" />
    </svg>
  ),
};

/** 스토어 한 줄. 주소가 있으면 QR 그림과 「링크로 열기」, 없으면 준비 중 글 (원본의 QR 만들기) */
function Store({ s, linkOpen }: { s: DlStore; linkOpen: string }) {
  return (
    <div className="store" id={'store-' + s.id}>
      {STORE_ICON[s.id]}
      <div>
        <b>{s.name}</b>
        <span className="pc">{DL_STORE_PC}</span>
        <span className="mo">{DL_STORE_MO}</span>
      </div>
      {s.url ? (
        <>
          <div className="qr" data-store={s.id}>
            <img alt="QR" src={qrSrc(s.url)} />
          </div>
          <a className="link" href={s.url} target="_blank" rel="noopener noreferrer">
            {linkOpen}
          </a>
        </>
      ) : (
        <div className="qr todo" data-store={s.id}>
          {DL_QR_TODO}
        </div>
      )}
    </div>
  );
}

export function Download() {
  const { idx, t } = usePageLang(DOWNLOAD_PI);
  /* 대화, 검증, 실행 탭: 6초마다 넘기고, 누르면 자동 넘김을 멈춘다 (원본 show(i)) */
  const [cur, setCur] = useState(0);
  const auto = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) auto.current = setInterval(() => setCur((c) => wrapSlide(c + 1, DL_SLIDES.length)), DL_AUTO_MS);
    return () => clearInterval(auto.current);
  }, []);
  const pick = (k: number) => {
    clearInterval(auto.current);
    setCur(wrapSlide(k, DL_SLIDES.length));
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = wrapSlide(cur + (e.key === 'ArrowRight' ? 1 : -1), DL_SLIDES.length);
    pick(next);
    tabs.current[next]?.focus();
  };

  return (
    <>
      <header className="hd">
        <a className="brand" href={PAGES.app} style={{ color: '#00f0ff' }}>
          <img src="assets/logo.png?v=3" alt="" style={{ width: 22, height: 'auto' }} />
          TETH
        </a>
        <nav>
          <a href={PAGES.about} data-i="navAbout">
            {t('navAbout', 'TETH 정보')}
          </a>
          <a href={PAGES.download} aria-current="page" data-i="navDl">
            {t('navDl', '앱 다운로드')}
          </a>
        </nav>
        <span className="sp" />
        <a className="cta" href={PAGES.app} data-i="login">
          {t('login', '시작하기')}
        </a>
      </header>

      <main className="dl">
        <div className="txt">
          <span className="pl-lb">TETH 앱</span>
          <h1 className="dl-h1">주머니 속 AI 트레이더</h1>
          <p className="dl-d">전략을 만들고, 검증하고, 실행 중인 판단까지 휴대전화 하나로 봅니다.</p>
          <div className="dl-stores">
            {DL_STORES.map((s) => (
              <Store key={s.id} s={s} linkOpen={DOWNLOAD_PI.linkOpen[idx]} />
            ))}
          </div>
          <div className="dl-acts">
            <a className="dl-cta" href={PAGES.app}>
              웹에서 바로 시작하기
            </a>
            <span className="dl-free">영원히 무료, 카드 등록 없음</span>
          </div>
        </div>
        <div className="visual">
          <div className="tabs" role="tablist" id="tabs">
            {DL_SLIDES.map((s, k) => (
              <button
                key={s.tab}
                role="tab"
                aria-selected={k === cur ? 'true' : 'false'}
                tabIndex={k === cur ? 0 : -1}
                ref={(el) => {
                  tabs.current[k] = el;
                }}
                onClick={() => pick(k)}
                onKeyDown={onKey}
              >
                {s.tab}
              </button>
            ))}
          </div>
          <div className="stage" id="stage">
            {DL_SLIDES.map((s, k) => (
              <div className={'slide' + (k === cur ? ' on' : '')} role="tabpanel" key={s.tab}>
                <div className="dev">
                  <div className="scr">
                    <img src={s.img} width={780} height={1688} loading={k ? 'lazy' : undefined} alt={s.alt} />
                  </div>
                </div>
                <p>{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <SubHelp />
      <Footer standalone />
      <HelpWidget />
    </>
  );
}
