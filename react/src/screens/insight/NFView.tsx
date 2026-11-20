// 인사이트, 거래복기, 정기 보고가 같이 쓰는 틀 (원본 tfNFView, gChead, gContent, tfSS3Dlg, NFX_IC, tfNFRow).
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { sideMobClose } from '../../state/store';

/** tfTrack(name,props): 수집을 붙이기 전까지는 줄만 세운다 */
type Ev = { n: string; p: Record<string, unknown>; t: number };
const TF_EVQ: Ev[] = [];
export function tfTrack(name: string, props?: Record<string, unknown>) {
  TF_EVQ.push({ n: name, p: props || {}, t: Date.now() });
  if (TF_EVQ.length > 200) TF_EVQ.shift();
}

/** gChead(title,'',null): 화면 머리줄. PC 에서는 CSS 가 숨기고(body.nochead) 모바일에서는 자리만 차지한다 */
export function Chead({ title }: { title: string }) {
  return (
    <div className="g-chead" id="g-chead">
      <span id="g-chead-title">
        <span id="g-title-txt">{title}</span>
      </span>
      <span className="sub" id="g-chead-sub" />
      <span className="g-tabs" id="g-tabs" />
      <span style={{ flex: 1 }} />
      <span id="g-chead-status" className="g-tag" hidden />
      <button className="g-iconbtn" id="g-chead-dots" aria-label="메뉴" aria-haspopup="true" hidden>
        ⋮
      </button>
    </div>
  );
}

/** gContent(html) 의 뒤처리: 화면을 새로 그리면 맨 위로 올리고 모바일 드로어를 닫는다 */
export function scrollTopNow() {
  const s = document.getElementById('g-scroll');
  if (s) s.scrollTop = 0;
  try {
    window.scrollTo(0, 0);
  } catch {
    /* 무시 */
  }
}
/** 주소가 바뀌어 화면을 새로 그릴 때마다(같은 주소를 다시 눌러도) 맨 위로 */
export function useViewEnter(key: string) {
  useLayoutEffect(() => {
    scrollTopNow();
    sideMobClose();
  }, [key]);
  useEffect(() => {
    const h = () => {
      scrollTopNow();
      sideMobClose();
    };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
}

/** tfSS3Dlg(title,html,wide): 대화상자. Esc, 바깥 누르기, ✕ 로 닫고 닫으면 연 단추로 초점을 돌린다. sheet 는 모바일 바닥 시트 */
export function Ss3Dlg({ title, wide, sheet, onClose, children }: { title: string; wide?: boolean; sheet?: boolean; onClose: () => void; children: ReactNode }) {
  const dx = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const trig = document.activeElement as HTMLElement | null;
    const gs = document.getElementById('g-scroll');
    if (gs) gs.style.overflow = 'hidden';
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    document.addEventListener('keydown', esc);
    dx.current?.focus();
    return () => {
      if (gs) gs.style.overflow = '';
      document.removeEventListener('keydown', esc);
      try {
        trig?.focus?.();
      } catch {
        /* 무시 */
      }
    };
  }, []);
  return createPortal(
    <div
      className={'ss3-dlgw' + (sheet ? ' sheet' : '')}
      id="ss3-dlgw"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={'ss3-dlg' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-labelledby="ss3-dlg-t">
        <div className="din">
          <div className="dh2">
            <b id="ss3-dlg-t">{title}</b>
            <button type="button" className="dx" ref={dx} aria-label="닫기" onClick={onClose}>
              ✕
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── NFX_IC: 공용 아이콘 (원본 마크업 그대로) ── */
const ic = (size: number, children: ReactNode, sw = 2, cls?: string) => (
  <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
export const NFX_IC = {
  trend: () =>
    ic(
      18,
      <>
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </>,
    ),
  warn: () =>
    ic(
      18,
      <>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </>,
    ),
  doc: () =>
    ic(
      18,
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </>,
    ),
  star: () => ic(18, <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />),
  zap: () => ic(15, <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />),
  chev: () => ic(14, <polyline points="9 18 15 12 9 6" />, 2.5, 'nfx-arrow'),
  empty: () =>
    ic(
      24,
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </>,
      1.8,
    ),
};
export type NfxIc = keyof typeof NFX_IC;

/** tfNFRow(o): 한 줄. click 이 있으면 눌러서 가는 줄이다 */
export function NFRow(o: { ic: NfxIc; icc?: string; lb: ReactNode; ds?: ReactNode; val?: ReactNode; arrow?: boolean; click?: () => void; stag?: number }) {
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Enter') o.click?.();
  };
  return (
    <div className={'nfx-row' + (o.click ? ' lk' : '') + (o.stag ? ' nfx-stag s' + o.stag : '')} onClick={o.click} role={o.click ? 'link' : undefined} tabIndex={o.click ? 0 : undefined} onKeyDown={o.click ? key : undefined}>
      <div className="nfx-rl">
        <div className={'nfx-ric' + (o.icc ? ' ' + o.icc : '')}>{NFX_IC[o.ic]()}</div>
        <div className="nfx-rtx">
          <span className="nfx-rlb">{o.lb}</span>
          {o.ds ? <span className="nfx-rds">{o.ds}</span> : null}
        </div>
      </div>
      <div className="nfx-rr">
        {o.val}
        {o.arrow ? NFX_IC.chev() : null}
      </div>
    </div>
  );
}
