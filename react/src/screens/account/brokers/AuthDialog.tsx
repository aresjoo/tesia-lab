// 연결 승인 창 (원본 acAuthOpen): 거래소의 승인 화면 흉내. 출금 줄은 보이지 않는다. body 바로 아래(#ac-auth)에 뜬다.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { acEx, acS } from '../../../core/account/ac';
import { useTf } from '../util';
import { acAuthNo, acAuthYes, UI } from './flow';
import { AcLogo } from './parts';

export function AcAuthDialog() {
  useTf();
  const open = UI.auth;
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open)
      try {
        ok.current?.focus();
      } catch {
        /* 무시 */
      }
  }, [open]);
  if (!open) return null;
  const b = acEx(acS().ex);
  if (!b) return null;
  const busy = UI.busy === 'auth';
  return createPortal(
    <div id="ac-auth" className="acx-auth" role="dialog" aria-modal="true" aria-label={b.name + ' 연결 승인'}>
      <div className="acx-aw">
        <button type="button" className="x" aria-label="닫기" onClick={acAuthNo}>
          ✕
        </button>
        <div className="acx-ac">
          <div className="pr">
            <img src="assets/favicon.png" alt="" width={44} height={44} onError={(e) => e.currentTarget.remove()} />
            <i aria-hidden="true" />
            <AcLogo id={b.id} z={44} />
          </div>
          <h3>{b.name + ' 계정을 TETH에 연결합니다'}</h3>
          <p>아래 권한만 연결됩니다</p>
          <ul>
            <li>잔고와 주문 내역 조회</li>
            <li>현물과 선물 주문</li>
          </ul>
          <div className="bts">
            <button type="button" className="no" onClick={acAuthNo}>
              취소
            </button>
            <button type="button" className="ok" id="ac-auth-ok" ref={ok} onClick={acAuthYes} disabled={busy}>
              {busy ? (
                <>
                  <i className="acx-sp" />
                  승인 중
                </>
              ) : (
                '승인'
              )}
            </button>
          </div>
          <small>{'승인은 ' + b.name + '의 보안 설정에서 언제든 끊을 수 있습니다.'}</small>
        </div>
      </div>
    </div>,
    document.body,
  );
}
