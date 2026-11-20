// 터미널이 띄우는 겹침 화면: 대화상자(tfSS3Dlg), 모바일 드로어(tfDrawer), 카드 메뉴(tfTmMenu).
// 원본은 body 끝에 마디를 붙였다. 여기서도 body 로 내보내 같은 자리에 둔다.
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Dlg = { title: string; body: ReactNode; wide?: boolean; trig: Element | null; seq: number };
type Drawer = { title: string; body: ReactNode; trig: Element | null; seq: number };
type Menu = { body: ReactNode; x: number; y: number; seq: number };

let dlg: Dlg | null = null;
let drawer: Drawer | null = null;
let menu: Menu | null = null;
let seq = 0;
let ver = 0;
const subs = new Set<() => void>();
const emit = () => {
  ver++;
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
const gScroll = () => document.getElementById('g-scroll');

/** tfSS3Dlg(title,html,wide) */
export function tfSS3Dlg(title: string, body: ReactNode, wide?: boolean) {
  dlg = { title, body, wide, trig: document.activeElement, seq: ++seq };
  emit();
}
/** tfSS3DlgClose(silent) */
export function tfSS3DlgClose(silent?: boolean) {
  const d = dlg;
  if (!d) return;
  dlg = null;
  emit();
  const gs = gScroll();
  if (gs) gs.style.overflow = '';
  if (!silent && d.trig && (d.trig as HTMLElement).focus) {
    try {
      (d.trig as HTMLElement).focus();
    } catch {
      /* 무시 */
    }
  }
}
/** tfDrawer(title,html) */
export function tfDrawer(title: string, body: ReactNode) {
  drawer = { title, body, trig: document.activeElement, seq: ++seq };
  emit();
}
/** tfDrawerClose() */
export function tfDrawerClose() {
  const d = drawer;
  if (!d) return;
  drawer = null;
  emit();
  const gs = gScroll();
  if (gs) gs.style.overflow = '';
  if (d.trig && (d.trig as HTMLElement).focus) {
    try {
      (d.trig as HTMLElement).focus();
    } catch {
      /* 무시 */
    }
  }
}
/** tfTmMenu(ev,key) 의 자리 잡기: 누른 단추 아래 */
export function tfTmMenuOpen(target: Element, body: ReactNode) {
  const r = target.getBoundingClientRect();
  menu = { body, x: r.left, y: r.bottom, seq: ++seq };
  emit();
}
/** tfTmMenuOff() */
export function tfTmMenuOff() {
  if (!menu) return;
  menu = null;
  emit();
}

function DlgView({ d }: { d: Dlg }) {
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const gs = gScroll();
    if (gs) gs.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tfSS3DlgClose();
    };
    document.addEventListener('keydown', esc);
    const dx = wrap.current?.querySelector<HTMLElement>('.dx');
    if (dx) dx.focus();
    return () => document.removeEventListener('keydown', esc);
  }, [d.seq]);
  return (
    <div
      className="ss3-dlgw"
      id="ss3-dlgw"
      ref={wrap}
      onClick={(e) => {
        if (e.target === wrap.current) tfSS3DlgClose();
      }}
    >
      <div className={'ss3-dlg' + (d.wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-labelledby="ss3-dlg-t">
        <div className="din">
          <div className="dh2">
            <b id="ss3-dlg-t">{d.title}</b>
            <button type="button" className="dx" aria-label="닫기" onClick={() => tfSS3DlgClose()}>
              ✕
            </button>
          </div>
          {d.body}
        </div>
      </div>
    </div>
  );
}

function DrawerView({ d }: { d: Drawer }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const gs = gScroll();
    if (gs) gs.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tfDrawerClose();
    };
    document.addEventListener('keydown', esc);
    const xb = box.current?.querySelector<HTMLElement>('.x');
    if (xb) xb.focus();
    const raf = requestAnimationFrame(() => box.current?.classList.add('on'));
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', esc);
    };
  }, [d.seq]);
  return (
    <>
      <div id="tf-scrim" onClick={tfDrawerClose} />
      <div className="tf-drawer" id="tf-drawer" role="dialog" aria-modal="true" aria-labelledby="tf-drawer-t" ref={box}>
        <div className="dh">
          <span className="t" id="tf-drawer-t">
            {d.title}
          </span>
          <span
            className="x"
            role="button"
            tabIndex={0}
            aria-label="닫기"
            onClick={tfDrawerClose}
            onKeyDown={(e) => {
              if (e.key === 'Enter') tfDrawerClose();
            }}
          >
            ✕
          </span>
        </div>
        {d.body}
      </div>
    </>
  );
}

function MenuView({ m }: { m: Menu }) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const mn = box.current;
    if (!mn) return;
    mn.style.top = Math.min(window.innerHeight - mn.offsetHeight - 10, m.y + 4) + 'px';
    mn.style.left = Math.max(10, Math.min(window.innerWidth - mn.offsetWidth - 10, m.x - 140)) + 'px';
  }, [m.seq, m.x, m.y]);
  useEffect(() => {
    const t = setTimeout(() => document.addEventListener('click', tfTmMenuOff), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', tfTmMenuOff);
    };
  }, [m.seq]);
  return (
    <div className="tft-menu" id="tft-menu" ref={box}>
      {m.body}
    </div>
  );
}

/** 겹침 화면을 body 에 그린다. 터미널이 떠 있는 동안만 둔다 */
export function TermOverlays() {
  useSyncExternalStore(subscribe, () => ver);
  /* 화면을 떠나면 열려 있던 것을 닫는다 */
  useEffect(
    () => () => {
      tfSS3DlgClose(true);
      tfDrawerClose();
      tfTmMenuOff();
    },
    [],
  );
  return createPortal(
    <>
      {dlg && <DlgView key={dlg.seq} d={dlg} />}
      {drawer && <DrawerView key={drawer.seq} d={drawer} />}
      {menu && <MenuView key={menu.seq} m={menu} />}
    </>,
    document.body,
  );
}
