import type { ReactNode } from 'react'

/** Source nfz three-zone gallery, shared by populated and unavailable feeds. */
export function ClientInsightGallery({ secondary, featured, rail, curator, heading, children }: {
  secondary: ReactNode; featured: ReactNode; rail: ReactNode; curator?: ReactNode; heading: ReactNode; children?: ReactNode
}) {
  return <>
    <div className="nfz-top3"><div className="c1">{secondary}</div><div className="c2">{featured}</div><div className="c3">{rail}</div></div>
    {curator}
    {heading}
    <div className="nfz-grid3">{children}</div>
  </>
}
