import { useCallback, useEffect, useRef, useState } from 'react';
import { translate } from '../core/i18n';
import { useApp } from './store';

/** 지금 언어의 L(k) */
export function useL() {
  const lang = useApp((s) => s.lang);
  return useCallback((k: string) => translate(lang, k), [lang]);
}

/**
 * 원본의 열림 닫힘 연출: 열리면 'on', 닫힐 때 'pop-closing' 을 잠깐 붙였다가 뗀다.
 * (glcClose, gSetMenuClose, gPlusClose 가 같은 틀: animationend 또는 260ms)
 */
export function usePop(open: boolean, ms = 260) {
  const [phase, setPhase] = useState<'off' | 'on' | 'closing'>(open ? 'on' : 'off');
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(t.current);
    if (open) setPhase('on');
    else
      setPhase((p) => {
        if (p === 'off') return p;
        t.current = setTimeout(() => setPhase('off'), ms);
        return 'closing';
      });
    return () => clearTimeout(t.current);
  }, [open, ms]);
  return { shown: phase !== 'off', closing: phase === 'closing', cls: phase === 'off' ? '' : phase === 'on' ? ' on' : ' on pop-closing' };
}

/** 열려 있는 동안 바깥을 누르면 닫는다 (원본의 document click 리스너) */
export function useOutside(open: boolean, inside: (t: Node) => boolean, close: () => void) {
  const fn = useRef({ inside, close });
  fn.current = { inside, close };
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!fn.current.inside(e.target as Node)) fn.current.close();
    };
    const id = setTimeout(() => document.addEventListener('click', h), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', h);
    };
  }, [open]);
}

/** body 에 class 를 붙였다 뗀다 (원본 CSS 가 body class 로 화면 상태를 가른다) */
export function useBodyClass(name: string, on: boolean, alsoHtml = false) {
  useEffect(() => {
    document.body.classList.toggle(name, on);
    if (alsoHtml) document.documentElement.classList.toggle(name, on);
    return () => {
      document.body.classList.remove(name);
      if (alsoHtml) document.documentElement.classList.remove(name);
    };
  }, [name, on, alsoHtml]);
}

export function useWinWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}
