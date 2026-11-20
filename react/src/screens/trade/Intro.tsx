// AI 트레이딩 소개 화면 (G.mode 'tfintro'). 손님과, 실행 환경이 아직 없는 회원이 같은 화면을 본다.
// 원본 tfIntroView(force) 에 뒤쪽 스크립트의 문구 덮어쓰기(tfIntroView 감싸기, skIntroCopy)까지 적용한 최종 모습이다.
import { useEffect, useRef, type ReactNode } from 'react';
import { nav } from '../../state/route';
import { authOpen, useApp } from '../../state/store';
import { acReady } from '../../core/account/ac';
import { acStart } from './bridge';
import { useTf } from './store';

/** TXH_FADE_OUT: 클립 끝에서만 짧게 끄고 원본대로 검정에서 다시 켜진다 */
const TXH_FADE_OUT = 0.35;
/** window.TF_TIN_MEM: 곧바로 다시 그려질 때 처음부터 다시 재생하지 않게 */
let TIN_MEM: { t: number; done: boolean; at: number } | null = null;

/**
 * tfIntroFx(): 타일 바닥 영상. 포스터 먼저, 바닥이 보일 때 영상을 늦게 만들고,
 * 화면 밖이나 탭 숨김이면 멈추고, 동작 줄이기면 포스터만 둔다. 한 번 재생하고 마지막 프레임(포스터)에 선다.
 */
function useIntroFx(floorRef: React.RefObject<HTMLDivElement | null>, heroRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const floor = floorRef.current;
    if (!floor) return;
    const fx: { v: HTMLVideoElement | null; seen: boolean; done: boolean } = { v: null, seen: false, done: false };
    let alive = true;
    /* 모바일 첫 화면: 히어로 최소 높이 = .g-scroll 높이 (배너, 상단 바를 뺀 실제 보이는 높이) */
    const fit = () => {
      const h = heroRef.current;
      const sc = document.getElementById('g-scroll');
      if (!h) return;
      if (sc && window.innerWidth <= 860) h.style.setProperty('--txh-vh', sc.clientHeight + 'px');
      else h.style.removeProperty('--txh-vh');
    };
    fit();
    window.addEventListener('resize', fit);
    let ro: ResizeObserver | null = null;
    try {
      const sc = document.getElementById('g-scroll');
      if (window.ResizeObserver && sc) {
        ro = new ResizeObserver(fit);
        ro.observe(sc);
      }
    } catch {
      /* 무시 */
    }
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      /* 무시 */
    }
    const rm = () => !!(mq && mq.matches);
    const sync = () => {
      const v = fx.v;
      if (!v) return;
      if (fx.done) {
        v.pause();
        return;
      }
      if (fx.seen && !document.hidden && !rm()) {
        const p = v.play();
        if (p && p.catch) p.catch(() => {});
      } else v.pause();
    };
    const frame = (t: number) => {
      const v = fx.v;
      if (!v) return;
      const d = isFinite(v.duration) && v.duration > 0 ? v.duration : 6.67;
      if (t > d - TXH_FADE_OUT || rm()) v.classList.remove('on');
      else v.classList.add('on');
    };
    const mount = () => {
      if (fx.v || !fx.seen || document.hidden || rm() || !alive) return;
      const v = document.createElement('video');
      v.muted = true;
      v.defaultMuted = true;
      v.loop = false;
      v.autoplay = true;
      v.playsInline = true;
      v.preload = 'metadata';
      v.tabIndex = -1;
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');
      v.setAttribute('disablepictureinpicture', '');
      v.setAttribute('aria-hidden', 'true');
      v.poster = 'assets/hero-tiles-end.jpg';
      v.addEventListener('loadedmetadata', () => frame(v.currentTime));
      v.addEventListener('timeupdate', () => frame(v.currentTime));
      v.addEventListener('error', () => {
        v.classList.remove('on');
        floor.classList.remove('playing');
      });
      v.addEventListener('playing', () => {
        if (!rm()) floor.classList.add('playing');
      });
      v.addEventListener('pause', () => floor.classList.remove('playing'));
      v.addEventListener('ended', () => {
        fx.done = true;
        v.classList.remove('on');
        floor.classList.remove('playing');
      });
      if (typeof v.requestVideoFrameCallback === 'function') {
        const cb: VideoFrameRequestCallback = (_now, md) => {
          if (fx.v !== v) return;
          frame(md.mediaTime);
          v.requestVideoFrameCallback(cb);
        };
        v.requestVideoFrameCallback(cb);
      }
      v.src = 'assets/halo.mp4';
      const mem = TIN_MEM;
      if (mem && Date.now() - mem.at < 20000) {
        if (mem.done) fx.done = true;
        else if (mem.t > 0)
          v.addEventListener(
            'loadedmetadata',
            () => {
              try {
                v.currentTime = mem.t;
              } catch {
                /* 무시 */
              }
            },
            { once: true },
          );
      }
      floor.appendChild(v);
      fx.v = v;
      sync();
    };
    let vob: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      vob = new IntersectionObserver(
        (es) => {
          fx.seen = es[es.length - 1].isIntersecting;
          mount();
          sync();
        },
        { root: document.body.classList.contains('gft-doc') ? null : document.getElementById('g-scroll') || null, threshold: 0 },
      );
      vob.observe(floor);
    } else {
      fx.seen = true;
      mount();
    }
    const vis = () => {
      mount();
      sync();
    };
    document.addEventListener('visibilitychange', vis);
    const mqh = () => {
      if (fx.v && rm()) fx.v.classList.remove('on');
      mount();
      sync();
    };
    try {
      if (mq) mq.addEventListener('change', mqh);
    } catch {
      /* 무시 */
    }
    /** tfIntroDestroy() */
    return () => {
      alive = false;
      window.removeEventListener('resize', fit);
      if (ro) ro.disconnect();
      if (vob) vob.disconnect();
      document.removeEventListener('visibilitychange', vis);
      try {
        if (mq) mq.removeEventListener('change', mqh);
      } catch {
        /* 무시 */
      }
      const v = fx.v;
      if (v) {
        TIN_MEM = { t: v.currentTime || 0, done: !!fx.done, at: Date.now() };
        try {
          v.pause();
          v.removeAttribute('src');
          v.load();
        } catch {
          /* 무시 */
        }
        v.remove();
      }
    };
  }, [floorRef, heroRef]);
}

const Ic = ({ children }: { children: ReactNode }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const AiRow = ({ k, n, r }: { k: string; n: string; r: string }) => (
  <li>
    <img src={`assets/ai/${k}.png`} alt="" width={40} height={40} loading="lazy" decoding="async" />
    <b>{n}</b>
    <span>{r}</span>
  </li>
);
const AiCol = ({ id, t, children }: { id: string; t: string; children: ReactNode }) => (
  <div className="txh-ai-col">
    <h3 id={id}>{t}</h3>
    <ul aria-labelledby={id}>{children}</ul>
  </div>
);
const Stat = ({ l, v, c }: { l: string; v: string; c?: string }) => (
  <div className="txh-stat">
    <dt>{l}</dt>
    <dd className={c}>{v}</dd>
  </div>
);
/** 지금 TETH가 하는 일: 전략 카드 (아바타와 도킹 거래소 로고, 숫자 띠, 판단 문단) */
const NowCard = ({ av, ex, n, xn, stats, body }: { av: ReactNode; ex: string; n: string; xn: string; stats: ReactNode; body: string }) => (
  <article className="txh-card">
    <header className="txh-by">
      <span className="txh-av">
        {av}
        <img className="txh-ex" src={`assets/logos/${ex}.png`} alt="" width={20} height={20} />
      </span>
      <span className="txh-who">
        <span className="txh-name">{n}</span>
        <span className="txh-xch">{xn}</span>
      </span>
    </header>
    <dl className="txh-stats">{stats}</dl>
    <p className="txh-body">{body}</p>
  </article>
);
const Step = ({ t, p }: { t: string; p: string }) => (
  <div className="txh-step">
    <b>{t}</b>
    <p>{p}</p>
  </div>
);
const Safe = ({ svg, t, p }: { svg: ReactNode; t: string; p: string }) => (
  <li>
    <Ic>{svg}</Ic>
    <b>{t}</b>
    <span>{p}</span>
  </li>
);

/** tfIntroView(force) */
export function Intro() {
  const user = useApp((s) => s.user);
  useTf(); /* 실행 환경이 바뀌면 다시 그린다 */
  const floorRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  useIntroFx(floorRef, heroRef);

  /* 실행 환경이 갖춰진 회원만 "돌아가기" */
  const rdy = !!(user && acReady());
  const cta = rdy ? () => nav('#/trade') : user ? () => acStart({ after: { kind: 'terminal' } }) : () => authOpen('signup');
  const ctaLbl = rdy ? 'AI 트레이딩으로 돌아가기' : '시작하기';

  return (
    <div className="txh tx-guest">
      <section className={'txh-hero' + (rdy ? ' has-back' : '')} aria-labelledby="txh-h" ref={heroRef}>
        {rdy && (
          <button type="button" className="txh-back" onClick={() => nav('#/trade')}>
            ← AI 트레이딩으로 돌아가기
          </button>
        )}
        <div className="txh-copy">
          <p className="txh-eyebrow">AI 트레이딩</p>
          <h1 id="txh-h">
            AI가 스스로
            <br className="txh-m" /> 판단해 거래합니다
          </h1>
          <p className="txh-sub">거래소 계정을 한 번 승인으로 연결하면 전략이 그 계정에서 직접 주문합니다.</p>
          <button type="button" className="txh-cta" onClick={cta}>
            {ctaLbl}
          </button>
          <div className="txh-more-row">
            <span className="txh-note">영원히 무료, 카드 등록 필요없음</span>
          </div>
        </div>
        <div className="txh-floor" aria-hidden="true" ref={floorRef}>
          <img src="assets/hero-tiles-end.jpg" alt="" width={1440} height={480} decoding="async" />
        </div>
      </section>
      <div className="txh-wrap">
        <section className="txh-sec first" id="txh-ai" aria-labelledby="txh-ai-h">
          <h2 id="txh-ai-h">TETH가 쓰는 AI</h2>
          <p className="txh-lead">뉴스 확인, 시장 분석, 판단 정리마다 맞는 AI를 씁니다.</p>
          <div className="txh-ai-cols">
            <AiCol id="txh-ai-news" t="뉴스 확인">
              <AiRow k="gemini" n="Gemini" r="구글 검색으로 최신 정보를 확인합니다" />
              <AiRow k="grok" n="Grok" r="X에서 지금 여론을 확인합니다" />
              <AiRow k="perplexity" n="Perplexity" r="뉴스와 공시의 출처를 찾습니다" />
            </AiCol>
            <AiCol id="txh-ai-mkt" t="시장 분석">
              <AiRow k="deepseek" n="DeepSeek" r="시장을 분석합니다" />
              <AiRow k="qwen" n="Qwen" r="여러 종목을 한 번에 비교합니다" />
              <AiRow k="kimi" n="Kimi" r="긴 보고서와 자료를 읽습니다" />
            </AiCol>
            <AiCol id="txh-ai-dec" t="판단 정리">
              <AiRow k="chatgpt" n="ChatGPT" r="상황을 정리해 판단합니다" />
              <AiRow k="claude" n="Claude" r="판단한 이유를 문장으로 씁니다" />
              <AiRow k="mistral" n="Le Chat (Mistral)" r="보조 판단을 냅니다" />
            </AiCol>
          </div>
        </section>
        <section className="txh-sec" id="txh-now" aria-labelledby="txh-now-h">
          <h2 id="txh-now-h">지금 TETH가 하는 일</h2>
          <p className="txh-lead">거래할 때도, 기다릴 때도 이유를 적어 둡니다.</p>
          <div className="txh-now">
            <NowCard
              av={<img className="txh-face" src="assets/buffett.jpg" alt="" width={56} height={56} />}
              ex="app-binance"
              n="워렌 버핏 AI 버전 13"
              xn="Binance"
              stats={
                <>
                  <Stat l="현재 잔고" v="$12,480" />
                  <Stat l="수익률" v="+8.2%" c="up" />
                  <Stat l="손익" v="+$946" c="up" />
                </>
              }
              body="AI 관련 기업의 강세를 예상해 기존 롱 포지션을 유지합니다. 주말 유동성과 거시 경제 일정을 고려해 새 거래와 헤지는 더하지 않습니다. NVDA 지지선과 MSFT 상승 추세를 보다가, 추세가 꺾이면 조정합니다."
            />
            <NowCard
              av={
                <svg className="txh-face" viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">
                  <circle cx="28" cy="28" r="28" fill="#1d2024" />
                  <path d="M11 31A17 17 0 0 1 45 31" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="3.2" />
                  <path d="M11 31A17 17 0 0 1 18.01 17.25" fill="none" stroke="#7c9cff" strokeWidth="3.2" />
                  <line x1="28" y1="31" x2="19.72" y2="20.98" stroke="#e3e3e3" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="28" cy="31" r="2.4" fill="#e3e3e3" />
                  <text x="28" y="44" textAnchor="middle" fontFamily={'Geist,"Noto Sans KR",sans-serif'} fontSize="10.5" fontWeight="700" fill="#e3e3e3">
                    28
                  </text>
                </svg>
              }
              ex="app-bitget"
              n="RSI 반등 규칙 버전 2"
              xn="Bitget"
              stats={
                <>
                  <Stat l="현재 잔고" v="$1,000" />
                  <Stat l="수익률" v="+3.1%" c="up" />
                  <Stat l="손익" v="+$31" c="up" />
                </>
              }
              body="비트코인이 내려 RSI가 28입니다. 반등할 수 있지만, 규칙상 30을 다시 넘을 때만 삽니다. 그래서 지금은 기다립니다. 산 뒤 5% 내리면 팔고, 12% 오르면 절반을 정리합니다."
            />
          </div>
        </section>
        <section className="txh-sec" id="txh-how" aria-labelledby="txh-w-h">
          <h2 id="txh-w-h">시작 방법</h2>
          <p className="txh-lead">대화로 전략을 정하고, 과거 시장에서 확인한 뒤 거래를 시작합니다.</p>
          <div className="txh-steps">
            <Step t="대화로 정하기" p="무엇을, 얼마로, 언제 멈출지 말로 정합니다." />
            <Step t="과거 시장에서 확인" p="지난 시장에서 돌려 보고 결과와 기준을 확인합니다." />
            <Step t="거래소 연결" p="거래소 계정을 연결하면 정한 예산으로 거래를 시작합니다." />
          </div>
        </section>
        <section className="txh-sec" aria-labelledby="txh-g-h">
          <div className="txh-safe">
            <div>
              <h2 id="txh-g-h">실행 설정</h2>
              <p className="txh-lead">전략마다 예산과 멈추는 조건을 정합니다.</p>
              <button type="button" className="txh-cta" onClick={cta}>
                {ctaLbl}
              </button>
              <div className="txh-more-row">
                <span className="txh-note">영원히 무료, 카드 등록 필요없음</span>
              </div>
            </div>
            <ul>
              <Safe
                svg={
                  <>
                    <rect x="4" y="10" width="16" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </>
                }
                t="연결 권한"
                p="잔고 조회와 주문만 승인합니다."
              />
              <Safe
                svg={
                  <>
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 3.5V12l6 4" />
                  </>
                }
                t="전략 예산"
                p="전략마다 쓸 금액을 따로 정합니다."
              />
              <Safe
                svg={
                  <>
                    <path d="M4 6h16" />
                    <path d="M4 18h16" />
                    <path d="M8 12h8" />
                  </>
                }
                t="손실 한도"
                p="정한 손실에 닿으면 새 주문을 멈춥니다."
              />
              <Safe
                svg={
                  <>
                    <circle cx="12" cy="12" r="8.5" />
                    <rect x="9" y="9" width="6" height="6" rx="1" />
                  </>
                }
                t="거래 중지"
                p="언제든 전략을 끄고 포지션을 정리합니다."
              />
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
