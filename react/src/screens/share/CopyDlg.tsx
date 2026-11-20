// 가운데 뜨는 대화상자 (원본 tfSS3Dlg, tfSS3DlgClose, tfSS3DlgEsc). 복사한 전략 상세의 조정, 설정, 중단, 정리 창이 쓴다.
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function SS3Dlg({ title, wide, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: ReactNode }) {
  const dx = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const trig = document.activeElement as HTMLElement | null; /* TF_SS3_TRIG: 닫으면 연 단추로 초점을 돌린다 */
    const gs = document.getElementById('g-scroll');
    if (gs) gs.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    document.addEventListener('keydown', esc);
    dx.current?.focus();
    return () => {
      document.removeEventListener('keydown', esc);
      if (gs && !document.getElementById('mk-follow')) gs.style.overflow = '';
      if (trig && trig.focus && document.body.contains(trig)) {
        try {
          trig.focus();
        } catch {
          /* 무시 */
        }
      }
    };
  }, []);
  return createPortal(
    <div
      className="ss3-dlgw"
      id="ss3-dlgw"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={'ss3-dlg' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-labelledby="ss3-dlg-t">
        <div className="din">
          <div className="dh2">
            <b id="ss3-dlg-t">{title}</b>
            <button type="button" className="dx" aria-label="닫기" ref={dx} onClick={onClose}>
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
