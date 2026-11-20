// 설정 화면이 같이 쓰는 조각: 줄, 단추, 섹션, 아이콘.
import type { ReactNode } from 'react';
import type { StTab } from '../../../core/account/settings';

/** stRow(k, v, act, sub) */
export function StRow({ k, v, act, sub }: { k: ReactNode; v?: ReactNode; act?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stg-r">
      <div className="k">
        <b>{k}</b>
        {sub ? <span>{sub}</span> : null}
      </div>
      <div className="v">{v || null}</div>
      {act ? <div className="a">{act}</div> : null}
    </div>
  );
}
/** stBtn(l, fn, cls) */
export function StBtn({ l, fn, cls }: { l: string; fn: () => void; cls?: string }) {
  return (
    <button type="button" className={'stg-b' + (cls ? ' ' + cls : '')} onClick={fn}>
      {l}
    </button>
  );
}
/** stSec(t, rows, act) */
export function StSec({ t, act, children }: { t?: string; act?: ReactNode; children: ReactNode }) {
  return (
    <section className="stg-sec">
      {t ? (
        <header>
          <h2>{t}</h2>
          {act || null}
        </header>
      ) : null}
      <div className="stg-card">{children}</div>
    </section>
  );
}
export const Num = ({ children }: { children: ReactNode }) => <span className="num">{children}</span>;

/** stIc(p) */
export const StIc = ({ children }: { children: ReactNode }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.700" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
/** ST_TABS 의 아이콘 */
export function TabIc({ k }: { k: StTab }) {
  return (
    <StIc>
      {k === 'general' && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.400 15a1.700 1.700 0 0 0 .340 1.870l.060.060a2 2 0 1 1-2.830 2.830l-.060-.060a1.700 1.700 0 0 0-1.870-.340 1.700 1.700 0 0 0-1.040 1.560V21a2 2 0 1 1-4 0v-.090a1.700 1.700 0 0 0-1.110-1.560 1.700 1.700 0 0 0-1.870.340l-.060.060a2 2 0 1 1-2.830-2.830l.060-.060a1.700 1.700 0 0 0 .340-1.870 1.700 1.700 0 0 0-1.560-1.040H3a2 2 0 1 1 0-4h.090a1.700 1.700 0 0 0 1.560-1.110 1.700 1.700 0 0 0-.340-1.870l-.060-.060a2 2 0 1 1 2.830-2.830l.060.060a1.700 1.700 0 0 0 1.870.340h.080a1.700 1.700 0 0 0 1.040-1.560V3a2 2 0 1 1 4 0v.090a1.700 1.700 0 0 0 1.040 1.560 1.700 1.700 0 0 0 1.870-.340l.060-.060a2 2 0 1 1 2.830 2.830l-.060.060a1.700 1.700 0 0 0-.340 1.870v.080a1.700 1.700 0 0 0 1.560 1.040H21a2 2 0 1 1 0 4h-.090a1.700 1.700 0 0 0-1.560 1.040z" />
        </>
      )}
      {k === 'account' && (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.400 3.600-7 8-7s8 2.600 8 7" />
        </>
      )}
      {k === 'notify' && (
        <>
          <path d="M6 9a6 6 0 1 1 12 0c0 6 2.500 7.500 2.500 7.500h-17S6 15 6 9z" />
          <path d="M10 20.500a2.200 2.200 0 0 0 4 0" />
        </>
      )}
      {k === 'billing' && (
        <>
          <rect x="3" y="5.500" width="18" height="13" rx="2.500" />
          <path d="M3 10h18M7 15h3" />
        </>
      )}
      {k === 'usage' && (
        <>
          <path d="M4 19h16" />
          <path d="M7 16V9" />
          <path d="M12 16V5" />
          <path d="M17 16v-4" />
        </>
      )}
      {k === 'security' && (
        <>
          <path d="M12 3l7.500 3v5.500c0 4.700-3.200 8.300-7.500 9.500-4.300-1.200-7.500-4.800-7.500-9.500V6z" />
          <path d="M9 12l2.200 2.200L15.200 10" />
        </>
      )}
    </StIc>
  );
}
/** ST_TG: 메뉴 접기 아이콘 */
export const StTg = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M9 4v16" />
  </svg>
);
/** SK_CHEV: 뒤로 */
export const SkChev = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
/** SK_NEXT: 다음 */
export const SkNext = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);
