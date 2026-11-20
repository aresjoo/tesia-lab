// nfx 공용 부품: 아이콘(NFX_IC), 행(tfNFRow), 토글. 이용 현황과 알림 설정이 쓴다.
import type { KeyboardEvent, ReactNode } from 'react';

const A = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const svg = (z: number, sw: number, kids: ReactNode, cls?: string) => (
  <svg className={cls} width={z} height={z} viewBox="0 0 24 24" {...A} strokeWidth={sw}>
    {kids}
  </svg>
);

export type NfxIcon = 'link' | 'trend' | 'card' | 'chip' | 'won' | 'bell' | 'warn' | 'doc' | 'star' | 'chat' | 'send' | 'mail' | 'info' | 'zap' | 'chev' | 'empty' | 'lock';

/** NFX_IC[k] */
export function NfxIc({ k }: { k: NfxIcon }) {
  switch (k) {
    case 'link':
      return svg(
        18,
        2,
        <>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </>,
      );
    case 'trend':
      return svg(
        18,
        2,
        <>
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </>,
      );
    case 'card':
      return svg(
        18,
        2,
        <>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </>,
      );
    case 'chip':
      return svg(
        18,
        2,
        <>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <line x1="9" y1="1" x2="9" y2="4" />
          <line x1="15" y1="1" x2="15" y2="4" />
          <line x1="9" y1="20" x2="9" y2="23" />
          <line x1="15" y1="20" x2="15" y2="23" />
          <line x1="20" y1="9" x2="23" y2="9" />
          <line x1="20" y1="14" x2="23" y2="14" />
          <line x1="1" y1="9" x2="4" y2="9" />
          <line x1="1" y1="14" x2="4" y2="14" />
        </>,
      );
    case 'won':
      return svg(
        17,
        2,
        <>
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </>,
      );
    case 'bell':
      return svg(
        18,
        2,
        <>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </>,
      );
    case 'warn':
      return svg(
        18,
        2,
        <>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </>,
      );
    case 'doc':
      return svg(
        18,
        2,
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </>,
      );
    case 'star':
      return svg(18, 2, <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />);
    case 'chat':
      return svg(18, 2, <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />);
    case 'send':
      return svg(
        18,
        2,
        <>
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </>,
      );
    case 'mail':
      return svg(
        18,
        2,
        <>
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </>,
      );
    case 'info':
      return svg(
        14,
        2,
        <>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </>,
      );
    case 'zap':
      return svg(15, 2, <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />);
    case 'chev':
      return svg(14, 2.5, <polyline points="9 18 15 12 9 6" />, 'nfx-arrow');
    case 'empty':
      return svg(
        24,
        1.8,
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </>,
      );
    case 'lock':
      return svg(
        22,
        1.8,
        <>
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </>,
      );
  }
}

/** tfNFRow(o): {ic,icc,lb,ds,val,arrow,click,stag} */
export function NfRow({ ic, icc, lb, ds, val, arrow, click, stag }: { ic: NfxIcon; icc?: string; lb: ReactNode; ds?: ReactNode; val?: ReactNode; arrow?: boolean; click?: () => void; stag?: number }) {
  const link = click
    ? {
        onClick: click,
        role: 'link',
        tabIndex: 0,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Enter') click();
        },
      }
    : {};
  return (
    <div className={'nfx-row' + (click ? ' lk' : '') + (stag ? ' nfx-stag s' + stag : '')} {...link}>
      <div className="nfx-rl">
        <div className={'nfx-ric' + (icc ? ' ' + icc : '')}>
          <NfxIc k={ic} />
        </div>
        <div className="nfx-rtx">
          <span className="nfx-rlb">{lb}</span>
          {ds ? <span className="nfx-rds">{ds}</span> : null}
        </div>
      </div>
      <div className="nfx-rr">
        {val}
        {arrow ? <NfxIc k="chev" /> : null}
      </div>
    </div>
  );
}

/** tfPlanView 안의 sw(k,on,dis,grn): 켜고 끄는 스위치. change 가 없으면 고정(끌 수 없는 기본 채널) */
export function NfSwitch({ on, grn, change }: { on: boolean; grn?: boolean; change?: (v: boolean) => void }) {
  return (
    <label className="nfx-sw">
      {change ? <input type="checkbox" checked={on} onChange={(e) => change(e.target.checked)} /> : <input type="checkbox" checked={on} readOnly disabled />}
      <span className={'nfx-slider' + (grn ? ' grn' : '')} />
    </label>
  );
}
