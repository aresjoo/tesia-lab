import { useState, type ReactNode } from 'react'

// Final source tbIcon/tbExbFix identities. Never derive a URL from display names.
const icons: Readonly<Record<string, string>> = {
  binance: '/client-broker-assets/app-binance.png',
  bitget: '/client-broker-assets/app-bitget.png',
  okx: '/client-broker-assets/app-okx.png',
  woox: '/client-broker-assets/app-woox.png',
  woo: '/client-broker-assets/app-woox.png',
  bybit: '/client-broker-assets/app-bybit.png',
  upbit: '/client-broker-assets/app-upbit.png',
  mexc: '/client-broker-assets/app-mexc.png',
  gate: '/client-broker-assets/app-gate.jpg',
  coinbase: '/client-broker-assets/app-coinbase.png',
  etoro: '/client-broker-assets/app-etoro.png',
  etrade: '/client-broker-assets/app-etrade.png',
  fidelity: '/client-broker-assets/app-fidelity.png',
  ibkr: '/client-broker-assets/app-ibkr.png',
  ig: '/client-broker-assets/app-ig.png',
  kis: '/client-broker-assets/app-kis.png',
  kiwoom: '/client-broker-assets/app-kiwoom.png',
  moomoo: '/client-broker-assets/app-moomoo.png',
  robinhood: '/client-broker-assets/app-robinhood.png',
  saxo: '/client-broker-assets/app-saxo.png',
  schwab: '/client-broker-assets/app-schwab.png',
  tiger: '/client-broker-assets/app-tiger.png',
  webull: '/client-broker-assets/app-webull.png',
}

type Props = { id: string; size?: number; className?: string; fallback?: ReactNode }

function VenueImage({ src, size, className, fallback }: Required<Pick<Props, 'size' | 'className'>> & { src: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false)
  return failed ? <>{fallback}</> : <img className={className} src={src} alt="" width={size} height={size}
    style={{ width: size, height: size, borderRadius: 4, objectFit: 'cover', flexShrink: 0, verticalAlign: 'middle' }}
    onError={() => setFailed(true)} />
}

/** Decorative identity only; no connection or execution status is implied. */
export function ClientTerminalVenueIcon({ id, size = 16, className = 'csj-icon', fallback = null }: Props) {
  const src = Object.hasOwn(icons, id) ? icons[id] : undefined
  // Identity-scoped state prevents a failed/late old image from poisoning a new venue.
  return src ? <VenueImage key={`${id}:${src}`} src={src} size={size} className={className} fallback={fallback} /> : <>{fallback}</>
}
