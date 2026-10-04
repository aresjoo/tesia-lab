import { getSitePage } from '../site-navigation'

/** Preserve the original document URLs; accept previously issued fragment
 * links as bookmarks. Presentation navigation never changes API authority. */
export function getServiceSiteLocation(location: string): string | null {
  const path = location.split(/[?#]/)[0]
  if (getSitePage(path)) return location
  const match = /^\/(?:internal-poc\.html|auth\/complete)?#\/site\/(about|download|policies)(?:\/([A-Za-z0-9_-]+))?$/.exec(location)
  return match ? `/${match[1]}/${match[2] ? `#${match[2]}` : ''}` : null
}

// A non-null mapper marks the service routing lifecycle while retaining source
// document URLs. InternalLink already owns same-origin navigation validation.
export const toServiceSiteHref = (href: string): string => href
