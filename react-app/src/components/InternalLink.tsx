import type { ComponentProps } from 'react'
import { navigateInternal, useSiteHrefMapper } from '../site-navigation'

export function InternalLink({ onClick, href, ...props }: ComponentProps<'a'>) {
  const mapHref = useSiteHrefMapper()
  return <a {...props} href={href && mapHref ? mapHref(href) : href} onClick={(event) => { onClick?.(event); navigateInternal(event) }} />
}
