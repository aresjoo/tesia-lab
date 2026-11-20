// 거래소 연결 화면들이 같이 쓰는 조각: 로고, 아이콘, 도움말 줄.
import { acExs } from '../../../core/account/ac';
import { tfTxHelp } from '../util';

/** acLogo(id, z): 거래소 앱 아이콘 (Gate 만 jpg) */
export function AcLogo({ id, z = 28 }: { id: string | null | undefined; z?: number }) {
  return <img src={'assets/logos/app-' + id + (id === 'gate' ? '.jpg' : '.png')} alt="" width={z} height={z} loading="lazy" />;
}
/** AC_CK: 체크 */
export const AcCk = ({ z = 14 }: { z?: number }) => (
  <svg width={z} height={z} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.500l4.500 4.500L19 7.500" />
  </svg>
);
/** AC_OUT: 새 창 화살표 */
export const AcOut = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);
/** PX_CHEV: 뒤로 */
export const PxChev = ({ hidden = true }: { hidden?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={hidden ? 'true' : undefined}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

/** PL_IC + plI(k) */
export type PlIcon = 'bolt' | 'grid' | 'coin' | 'card' | 'lock' | 'head' | 'swap' | 'cal' | 'trophy';
export function PlI({ k }: { k: PlIcon }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {k === 'bolt' && <path d="M13 2L4 14h6l-1 8 9-12h-6z" />}
      {k === 'grid' && (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
      )}
      {k === 'coin' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M9.5 9.5h4a1.75 1.75 0 0 1 0 3.5h-3a1.75 1.75 0 0 0 0 3.5h4" />
        </>
      )}
      {k === 'card' && (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="M3 10h18" />
        </>
      )}
      {k === 'lock' && (
        <>
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </>
      )}
      {k === 'head' && (
        <>
          <path d="M4.5 13a7.5 7.5 0 0 1 15 0" />
          <rect x="3" y="12.5" width="4" height="6.5" rx="1.5" />
          <rect x="17" y="12.5" width="4" height="6.5" rx="1.5" />
          <path d="M19 19v1a2 2 0 0 1-2 2h-3" />
        </>
      )}
      {k === 'swap' && <path d="M7 7h11M15 4l3 3-3 3M17 17H6M9 14l-3 3 3 3" />}
      {k === 'cal' && (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </>
      )}
      {k === 'trophy' && <path d="M8 4h8v5a4 4 0 0 1-8 0zM6 6H4a2 2 0 0 0 2 4M18 6h2a2 2 0 0 1-2 4M12 13v4M8 21h8M10 17h4" />}
    </svg>
  );
}
/** plLogos(z) */
export const PlLogos = ({ z = 18 }: { z?: number }) => (
  <span className="pl-logos">
    {acExs().map((b) => (
      <AcLogo key={b.id} id={b.id} z={z} />
    ))}
  </span>
);
/** acHelp() */
export const AcHelp = () => (
  <p className="acx-help">
    <span>막히는 곳이 있으면 상담원이 도와드립니다. 24시간 응답합니다.</span>
    <button type="button" onClick={tfTxHelp}>
      상담원에게 묻기
    </button>
  </p>
);
/** pxHelp() */
export const PxHelp = () => (
  <p className="px-help">
    <span>막히면 상담원이 24시간 답합니다.</span>
    <button type="button" className="pl-link" onClick={tfTxHelp}>
      상담원에게 묻기
    </button>
  </p>
);
/** 계정 번호 가리기: 앞 두 자리와 뒤 두 자리만 */
export const maskId = (id: unknown) => String(id).slice(0, 2) + '••••' + String(id).slice(-2);
