import { useId } from 'react'
import '../client-animated-logo.css'

/** Original taiLogoDraw: reveal the existing asset, never redraw the brand.
 * CSS decoration only; callers own the observed loading/running lifetime.
 */
export function ClientAnimatedLogo({ width = 22, className = '' }: { width?: 22 | 24; className?: string }) {
  const maskId = useId()
  return <svg className={`client-animated-logo ${className}`.trim()} viewBox="0 0 52 32" width={width} height={Math.round(width * 32 / 52)} aria-hidden="true" focusable="false">
    <defs><mask id={maskId}>
      <path className="client-animated-logo-path" d="M26 16 C26 4.5 3 4.5 3 16 C3 27.5 26 27.5 26 16 C26 4.5 49 4.5 49 16 C49 27.5 26 27.5 26 16" stroke="#fff" strokeWidth="13" fill="none" strokeLinecap="round" />
    </mask></defs>
    <image href="/teth-logo-f260167.png" x="0" y="0" width="52" height="32" preserveAspectRatio="xMidYMid meet" mask={`url(#${maskId})`} />
  </svg>
}
