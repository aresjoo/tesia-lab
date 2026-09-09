import { useEffect, type RefObject } from 'react'
import { clientCopy, type ClientLanguage } from './client-preferences'

/** Source phRotStart timing; local DOM property updates do not rerender the app. */
export function useClientPlaceholder(inputRef: RefObject<HTMLTextAreaElement | null>, language: ClientLanguage, occupied: boolean, fullscreen: boolean) {
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const narrow = matchMedia('(max-width: 860px)')
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const list = clientCopy.PH_ROT.list[language]
    const prefix = () => (narrow.matches ? clientCopy.PH_ROT.prefixM : clientCopy.PH_ROT.prefix)[language]
    let index = Math.floor(Math.random() * list.length), position = 0, hold = 0
    let mode: 'type' | 'hold' | 'delete' = 'type'
    let timer: ReturnType<typeof setInterval> | undefined
    const paint = () => { input.placeholder = prefix() + list[index].slice(0, position) }
    const start = () => {
      clearInterval(timer)
      if (reduced.matches || document.documentElement.classList.contains('client-motion-paused')) {
        input.placeholder = prefix() + list[0]
        return
      }
      paint()
      if (occupied || document.hidden) return
      timer = setInterval(() => {
        if (mode === 'type') {
          position++
          if (position >= list[index].length) { mode = 'hold'; hold = 0 }
        } else if (mode === 'hold') {
          if (++hold >= 24) mode = 'delete'
        } else {
          position = Math.max(0, position - 2)
          if (!position) { index = (index + 1) % list.length; mode = 'type' }
        }
        paint()
      }, 70)
    }
    const observer = new MutationObserver(start)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    start()
    narrow.addEventListener('change', start)
    reduced.addEventListener('change', start)
    document.addEventListener('visibilitychange', start)
    return () => {
      clearInterval(timer); observer.disconnect()
      narrow.removeEventListener('change', start); reduced.removeEventListener('change', start)
      document.removeEventListener('visibilitychange', start)
    }
  }, [inputRef, language, occupied, fullscreen])
}
