// 터미널 여러 곳이 같이 쓰는 작은 부품과 표.
import { useRef, type ReactNode } from 'react';
import { TF_EX_NAME } from '../../../core/account/derive';
import { TF_KIND_LABEL } from '../../../core/trade/term';

/** TF_BROKERS 가운데 터미널이 읽는 칸 (id, 이름, 배지 색, 파트너 여부). 순서는 원본 그대로 */
export const TF_BROKERS: { id: string; name: string; col: string; fg: string; conn?: boolean }[] = [
  { id: 'binance', name: 'Binance', col: '#F3BA2F', fg: '#181818', conn: true },
  { id: 'okx', name: 'OKX', col: '#0a0a0c', fg: '#fff', conn: true },
  { id: 'bybit', name: 'Bybit', col: '#15192a', fg: '#f7a600', conn: true },
  { id: 'bitget', name: 'Bitget', col: '#00F0FF', fg: '#00251f', conn: true },
  { id: 'mexc', name: 'MEXC', col: '#00b897', fg: '#04150f', conn: true },
  { id: 'woox', name: 'WOO X', col: '#0a0a0a', fg: '#fff', conn: true },
  { id: 'upbit', name: '업비트', col: '#093687', fg: '#fff' },
  { id: 'coinbase', name: 'Coinbase', col: '#0052FF', fg: '#fff' },
  { id: 'kis', name: '한국투자증권', col: '#5F4B3C', fg: '#fff' },
  { id: 'robinhood', name: 'Robinhood', col: '#00C805', fg: '#fff' },
  { id: 'ibkr', name: 'Interactive Brokers', col: '#D81222', fg: '#fff' },
  { id: 'schwab', name: 'Charles Schwab', col: '#00A0DF', fg: '#fff' },
  { id: 'fidelity', name: 'Fidelity', col: '#64A70B', fg: '#fff' },
  { id: 'etrade', name: 'E*TRADE', col: '#6633CC', fg: '#fff' },
  { id: 'webull', name: 'Webull', col: '#007CFF', fg: '#fff' },
  { id: 'etoro', name: 'eToro', col: '#13C636', fg: '#fff' },
  { id: 'saxo', name: 'Saxo Bank', col: '#14143C', fg: '#fff' },
  { id: 'ig', name: 'IG', col: '#E40613', fg: '#fff' },
  { id: 'moomoo', name: 'moomoo', col: '#FF6900', fg: '#fff' },
  { id: 'tiger', name: 'Tiger Brokers', col: '#FF7300', fg: '#fff' },
];

/** tfExOf2(ex): 거래소 이름과 배지 색. 표에 없으면 원본처럼 첫 거래소 이름에 회색 배지 */
export function tfExOf2(ex: string | null | undefined): { id: string | null; name: string; col: string; fg: string; conn?: boolean; known: boolean } {
  const b = TF_BROKERS.find((x) => x.id === ex);
  if (b) return { ...b, known: true };
  return { id: ex || null, name: (ex && TF_EX_NAME[ex]) || 'Binance', col: '#3a4254', fg: '#dbdbdb', known: false };
}

/** tbIcon(id,z): 거래소 앱 아이콘 */
export function TbIcon({ id, z = 16 }: { id: string | null | undefined; z?: number }) {
  if (!id) return null;
  return <img className="tb-ic" src={'assets/logos/app-' + id + (id === 'gate' ? '.jpg' : '.png')} alt="" width={z} height={z} />;
}
/** 거래소 배지. 원본은 두 글자 배지(span.exb)를 그린 뒤 tbExbFix 가 앱 아이콘으로 바꾼다. 표에 없는 거래소만 글자 배지로 남는다 */
export function ExBadge({ ex, sm }: { ex: string | null | undefined; sm?: boolean }) {
  const e = tfExOf2(ex);
  if (e.known) return <TbIcon id={e.id} z={sm ? 14 : 16} />;
  return (
    <span className={'exb' + (sm ? ' sm' : '')} style={{ background: e.col, color: e.fg || '#0f1012' }}>
      {e.name.slice(0, 2).toUpperCase()}
    </span>
  );
}
/** tfKindBadge(kind) */
export function KindBadge({ kind }: { kind?: string }) {
  const k = TF_KIND_LABEL[kind || ''] || '규칙';
  return (
    <>
      <span className={'tf-kind tf-kind-' + (kind || 'rule')}>{k}</span>
      {kind === 'hybrid' && <span className="tf-kind tf-kind-sub">AI 검토 켜짐</span>}
    </>
  );
}
/** MKT_CHEV */
export const MktChev = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
/** NFX_IC.bell */
export const BellIco = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
export const Flex1 = () => <span style={{ flex: 1 }} />;
export type Kids = { children?: ReactNode };

/** tbThought(t): 두 문장 + 더 보기 */
export function Thought({ t, B }: { t: string; B: (t: string) => string }) {
  const more = useRef<HTMLSpanElement>(null);
  if (!t) return null;
  const a = String(t).split(/(?<=\.)\s+/);
  const head = a.length <= 2 ? t : a.slice(0, 2).join(' ');
  const rest = a.length <= 2 ? '' : a.slice(2).join(' ');
  return (
    <div className="tb-th">
      <p className="tb-thl">{B('TETH의 생각')}</p>
      <p className="tb-tht">
        {B(head)}
        {rest && (
          <>
            <span className="tb-more" hidden ref={more}>
              {B(' ' + rest)}
            </span>{' '}
            <button
              type="button"
              className="pl-link tb-mb"
              onClick={(e) => {
                const m = more.current;
                if (!m) return;
                m.hidden = !m.hidden;
                e.currentTarget.textContent = m.hidden ? '더 보기' : '접기';
              }}
            >
              더 보기
            </button>
          </>
        )}
      </p>
    </div>
  );
}
