import type { ComponentProps } from 'react'
import { navigateInternal } from '../site-navigation'

export function InternalLink({ onClick, ...props }: ComponentProps<'a'>) {
  return <a {...props} onClick={(event) => { onClick?.(event); navigateInternal(event) }} />
}
