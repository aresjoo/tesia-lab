import { useLayoutEffect, useState } from 'react'
import { useSiteLocation } from './site-navigation'

/** A retained settings detail is not permission to retain its modal on another
 * route. Closing unmounts the existing request owner and aborts its observation;
 * it does not reverse or invent the outcome of a server-side operation. */
export function useSettingsDialogRoute(onClose: () => void) {
  const href = useSiteLocation(true)
  const [openedAt] = useState(href)
  useLayoutEffect(() => {
    if (href !== openedAt) onClose()
  }, [href, openedAt, onClose])
}
