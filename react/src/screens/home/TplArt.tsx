// 홈 템플릿 카드의 그림 (원본 tfTplArt). 다섯 가지 행동 카드는 같은 문법의 선 그림이다.
import { useId } from 'react';
import type { TplAct, TplAsset } from '../../core/templates.data';

const AC = '#00f0ff';
const LN = 'rgba(255,255,255,.72)';
const LN2 = 'rgba(255,255,255,.28)';
const SUB = 'rgba(255,255,255,.14)';

export function TplArt({ id, w = 220, h = 124 }: { id: string; w?: number; h?: number }) {
  const u = 'tfa' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg viewBox="0 0 220 124" width={w} height={h} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={u} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a1c21" />
          <stop offset="1" stopColor="#141519" />
        </linearGradient>
      </defs>
      <rect width="220" height="124" fill={`url(#${u})`} />
      <path d="M18 84H202" stroke={SUB} strokeWidth="1" />
      {id === 'auto' && (
        <>
          <path d="M30 72C58 66 74 44 98 46C122 48 138 66 166 58" fill="none" stroke={LN} strokeWidth="2" strokeLinecap="round" />
          <path d="M166 58H190" stroke={AC} strokeWidth="2" strokeLinecap="round" strokeDasharray="1 6" />
          <circle cx="166" cy="58" r="10" fill="none" stroke={AC} strokeWidth="2" />
          <circle cx="166" cy="58" r="3.5" fill={AC} />
        </>
      )}
      {id === 'ind' && (
        <>
          <path d="M32 56C58 40 88 62 116 48C142 36 162 50 188 42" fill="none" stroke={LN} strokeWidth="2" strokeLinecap="round" />
          <path d="M32 70H188" stroke={LN2} strokeWidth="1.5" strokeDasharray="3 5" />
          <path d="M32 30H188" stroke={LN2} strokeWidth="1.5" strokeDasharray="3 5" />
          <circle cx="116" cy="48" r="3.5" fill={AC} />
          <circle cx="116" cy="48" r="8" fill="none" stroke={AC} strokeWidth="1.5" opacity=".45" />
        </>
      )}
      {id === 'rank' && (
        <>
          <path d="M66 34H176" stroke={AC} strokeWidth="7" strokeLinecap="round" />
          <path d="M66 52H148" stroke={LN2} strokeWidth="7" strokeLinecap="round" />
          <path d="M66 70H120" stroke={LN2} strokeWidth="7" strokeLinecap="round" />
          <text x="46" y="38" fontFamily="inherit" fontSize="11" fontWeight="600" fill={LN}>
            1
          </text>
          <text x="46" y="56" fontFamily="inherit" fontSize="11" fontWeight="600" fill={LN2}>
            2
          </text>
          <text x="46" y="74" fontFamily="inherit" fontSize="11" fontWeight="600" fill={LN2}>
            3
          </text>
        </>
      )}
      {id === 'anal' && (
        <g strokeLinecap="round">
          <path d="M76 30V78" stroke={LN2} strokeWidth="1.5" />
          <rect x="70" y="42" width="12" height="22" rx="2" fill="none" stroke={LN} strokeWidth="1.5" />
          <path d="M104 26V82" stroke={LN2} strokeWidth="1.5" />
          <rect x="98" y="36" width="12" height="30" rx="2" fill="none" stroke={LN} strokeWidth="1.5" />
          <path d="M132 34V74" stroke={AC} strokeWidth="1.5" />
          <rect x="126" y="44" width="12" height="20" rx="2" fill={AC} fillOpacity=".2" stroke={AC} strokeWidth="1.5" />
          <path d="M160 30V70" stroke={LN2} strokeWidth="1.5" />
          <rect x="154" y="38" width="12" height="22" rx="2" fill="none" stroke={LN} strokeWidth="1.5" />
        </g>
      )}
      {id === 'port' && (
        <>
          <circle cx="110" cy="52" r="26" fill="none" stroke={LN2} strokeWidth="7" />
          <path d="M110 26a26 26 0 0 1 24.6 17.7" fill="none" stroke={AC} strokeWidth="7" strokeLinecap="round" />
          <circle cx="110" cy="52" r="14" fill="none" stroke={SUB} strokeWidth="1" />
        </>
      )}
    </svg>
  );
}

/** tfTplThumb: 종목 카드는 로고, 행동 카드는 선 그림 */
export function TplThumb({ t, w, h }: { t: TplAct | TplAsset; w?: number; h?: number }) {
  if ('img' in t)
    return (
      <span className="timg" style={{ background: t.bg }}>
        <img className={t.inv ? 'inv' : undefined} src={t.img} alt={t.lb} />
      </span>
    );
  return <TplArt id={t.id} w={w} h={h} />;
}
