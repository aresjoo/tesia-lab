// 이 조각이 body 아래에 띄우는 창들: 확인 창(#ac-cf), 거래소 승인 창(#ac-auth), 본인 확인 관문(#ac-cf.px-cf).
import { useEffect } from 'react';
import { AcAuthDialog } from './brokers/AuthDialog';
import { acAuthNo, UI } from './brokers/flow';
import { AcKycGate, acKycGateClose, acKycGateOpen } from './brokers/kyc';
import { AcConfirmHost, acConfirmClose, acConfirmOpen } from './confirm';

export function AccountOverlays() {
  /* 원본 document keydown: Esc 는 확인 창을 먼저, 없으면 승인 창을 닫는다 */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (acKycGateOpen()) acKycGateClose();
      else if (acConfirmOpen()) acConfirmClose();
      else if (UI.auth) acAuthNo();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);
  return (
    <>
      <AcAuthDialog />
      <AcConfirmHost />
      <AcKycGate />
    </>
  );
}
