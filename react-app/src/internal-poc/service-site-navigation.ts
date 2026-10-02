import { getSitePage } from '../site-navigation'

/** The approved server serves these HTML aliases, not /about or /download.
 * Keep the original page/anchor semantics in a strictly parsed fragment.
 * A presentation route never chooses a different API adapter or session.
 */
export function getServiceSiteLocation(location: string): string | null {
  const match = /^\/(?:internal-poc\.html|auth\/complete)?#\/site\/(about|download|policies)(?:\/([A-Za-z0-9_-]+))?$/.exec(location)
  return match ? `/${match[1]}/${match[2] ? `#${match[2]}` : ''}` : null
}

export function toServiceSiteHref(href: string): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href
  const url = new URL(href, 'https://teth.invalid')
  if (url.search) return href
  const page = getSitePage(url.pathname)
  const anchor = url.hash.slice(1)
  if (!page || (anchor && !/^[A-Za-z0-9_-]+$/.test(anchor))) return href
  return `/#/site/${page}${anchor ? `/${anchor}` : ''}`
}
