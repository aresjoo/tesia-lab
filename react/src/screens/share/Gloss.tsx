// 용어 풀이 (원본 mkGloss, mkGlossOpen, mkGlossClose): 글 속 용어 단추를 누르면 그 자리에 한 줄 풀이가 뜬다.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { mkPolite } from '../../core/engine/chat';
import { MK_GLOSS } from '../../core/share.data';

/** MK_GLOSS_K: 긴 용어부터 찾는다 */
export const MK_GLOSS_K: string[] = Object.keys(MK_GLOSS).sort((a, b) => b.length - a.length);

/** 글 조각: 글자 또는 용어 */
export type GlossPart = { g: false; v: string } | { g: true; v: string };
/** mkGloss(html,body): 글에서 용어마다 처음 나오는 한 곳만 용어 단추로 바꾼다. body 면 매수, 매도는 건너뛴다 */
export function mkGloss(text: string, body?: boolean): GlossPart[] {
  const hold: string[] = [];
  let out = text;
  MK_GLOSS_K.forEach((k) => {
    if (body && (k === '매수' || k === '매도')) return;
    const i = out.indexOf(k);
    if (i < 0) return;
    hold.push(k);
    out = out.slice(0, i) + '\u0001' + (hold.length - 1) + '\u0002' + out.slice(i + k.length);
  });
  const parts: GlossPart[] = [];
  out.split(/(\u0001\d+\u0002)/).forEach((x) => {
    if (!x) return;
    const m = /^\u0001(\d+)\u0002$/.exec(x);
    parts.push(m ? { g: true, v: hold[+m[1]] } : { g: false, v: x });
  });
  return parts;
}

/** 풀이 글: 설명 말투를 「입니다」로 맞춘다 */
export function glossText(k: string): string {
  return mkPolite(MK_GLOSS[k] || '')
    .split(/(?<=[.])s+/)
    .map((x) => (/니다[.]$/.test(x) ? x : x.replace(/[.]$/, '입니다.')))
    .join(' ');
}

/* 풀이는 한 번에 하나만 뜬다. 지금 떠 있는 것을 닫는 함수 */
let closeCur: (() => void) | null = null;
/** mkGlossClose() */
export function mkGlossClose() {
  closeCur?.();
}

function GlossPop({ k, btn, close }: { k: string; btn: HTMLButtonElement | null; close: (refocus?: boolean) => void }) {
  const pop = useRef<HTMLDivElement>(null);
  /* 단추 바로 아래, 자리가 모자라면 위에 */
  useLayoutEffect(() => {
    const p = pop.current;
    if (!p || !btn) return;
    const r = btn.getBoundingClientRect();
    const w = p.offsetWidth;
    const h = p.offsetHeight;
    const x = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2));
    let y = r.bottom + 8;
    if (y + h > window.innerHeight - 12) y = Math.max(12, r.top - h - 8);
    p.style.left = x + 'px';
    p.style.top = y + 'px';
  }, [btn]);
  useEffect(() => {
    /** mkGlossDoc(e) */
    const doc = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (pop.current && t && pop.current.contains(t)) return;
      if (t && t.closest && t.closest('.mkg')) return;
      close();
    };
    /** mkGlossKey(e) */
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    const shut = () => close();
    const sc = document.getElementById('g-scroll');
    document.addEventListener('click', doc, true);
    document.addEventListener('keydown', key);
    sc?.addEventListener('scroll', shut);
    window.addEventListener('resize', shut);
    return () => {
      document.removeEventListener('click', doc, true);
      document.removeEventListener('keydown', key);
      sc?.removeEventListener('scroll', shut);
      window.removeEventListener('resize', shut);
    };
  }, [close]);
  return createPortal(
    <div id="mkg-pop" className="mkg-pop" role="dialog" aria-label={k + ' 뜻'} ref={pop}>
      <b>{k}</b>
      <p>{glossText(k)}</p>
    </div>,
    document.body,
  );
}

/** 용어 단추 (button.mkg). k 는 용어, 보이는 글자는 children(없으면 k) */
export function GlossBtn({ k, children }: { k: string; children?: ReactNode }) {
  /* 한 번도 안 열었으면 aria-expanded 가 없다. 닫은 뒤에는 false */
  const [st, setSt] = useState<'no' | 'open' | 'shut'>('no');
  const ref = useRef<HTMLButtonElement>(null);
  const mine = useRef<((refocus?: boolean) => void) | null>(null);
  if (!mine.current)
    mine.current = (refocus?: boolean) => {
      setSt('shut');
      if (closeCur === mine.current) closeCur = null;
      if (refocus)
        try {
          ref.current?.focus();
        } catch {
          /* 초점을 못 옮겨도 닫기는 끝났다 */
        }
    };
  useEffect(
    () => () => {
      if (closeCur === mine.current) closeCur = null;
    },
    [],
  );
  return (
    <>
      {/* mkGlossOpen(b,ev) */}
      <button
        type="button"
        className="mkg"
        data-g={k}
        aria-haspopup="dialog"
        aria-expanded={st === 'no' ? undefined : st === 'open'}
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          const was = st === 'open';
          mkGlossClose();
          if (was) return;
          setSt('open');
          closeCur = mine.current;
        }}
      >
        {children == null ? k : children}
      </button>
      {st === 'open' ? <GlossPop k={k} btn={ref.current} close={mine.current} /> : null}
    </>
  );
}
