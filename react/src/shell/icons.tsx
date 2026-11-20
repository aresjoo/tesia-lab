// 원본 마크업의 SVG 를 그대로 옮긴 아이콘. 선 굵기와 크기는 쓰는 곳마다 달라 인자로 받는다.
import type { ReactNode, SVGProps } from 'react';

type P = { size?: number; sw?: number; join?: boolean; children: ReactNode } & SVGProps<SVGSVGElement>;
export function Ico({ size = 18, sw = 1.6, join = true, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin={join ? 'round' : undefined} {...rest}>
      {children}
    </svg>
  );
}

export const GearPath = (
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3H9.8L9.4 5.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" />
  </>
);
export const InfoPath = (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 7.5v.5" />
  </>
);
export const SearchIco = ({ size = 14 }: { size?: number }) => (
  <Ico size={size} sw={2} join={false}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Ico>
);
