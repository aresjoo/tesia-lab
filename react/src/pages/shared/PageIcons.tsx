// 독립 페이지의 20px 선 아이콘. 원본 소개 페이지의 IC 표와, 원본 HTML 에 그대로 적혀 있던 같은 모양의 svg 를 한 표로 모았다.
import type { ReactNode } from 'react';
import type { PageIcon } from '../../core/pages/icon';

const IC: Record<PageIcon, ReactNode> = {
  bolt: <path d="M13 2L4 14h6l-1 8 9-12h-6z" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5h4a1.75 1.75 0 0 1 0 3.5h-3a1.75 1.75 0 0 0 0 3.5h4" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 10h18" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  head: (
    <>
      <path d="M4.5 13a7.5 7.5 0 0 1 15 0" />
      <rect x="3" y="12.5" width="4" height="6.5" rx="1.5" />
      <rect x="17" y="12.5" width="4" height="6.5" rx="1.5" />
      <path d="M19 19v1a2 2 0 0 1-2 2h-3" />
    </>
  ),
  swap: <path d="M7 7h11M15 4l3 3-3 3M17 17H6M9 14l-3 3 3 3" />,
  cal: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0zM6 6H4a2 2 0 0 0 2 4M18 6h2a2 2 0 0 1-2 4M12 13v4M8 21h8M10 17h4" />,
  chat: <path d="M4 5h16v11H8l-4 4z" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  chart: <path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6" />,
  doc: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 13h6M10 17h6" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  bulb: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.4 1 2.5h6c0-1.1.3-1.9 1-2.5A6 6 0 0 0 12 3z" />,
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2.5" />
      <path d="M3 10h18M16 15h2" />
    </>
  ),
  unlink: <path d="M9 15l6-6M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1" />,
  ban: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </>
  ),
};

/** 원본 I(k) */
export function PageIco({ k }: { k: PageIcon }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {IC[k]}
    </svg>
  );
}
