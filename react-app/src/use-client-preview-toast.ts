import { useEffect, useRef, useState } from 'react'

/** Source 9fb index.html:8905–8916. Presentation only, never a delivery ACK. */
export function useClientPreviewToast() {
  const [toast, setToast] = useState({ text: '', visible: false })
  const active = useRef({ text: '', visible: false })
  const queue = useRef<string[]>([])
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const scheduled = timers.current
    return () => {
      scheduled.forEach(clearTimeout)
      scheduled.clear()
      queue.current = []
      active.current.visible = false
      hideTimer.current = null
    }
  }, [])

  function schedule(callback: () => void, delay: number) {
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      callback()
    }, delay)
    timers.current.add(timer)
    return timer
  }

  function showToast(text: string) {
    if (active.current.visible) {
      if (queue.current.length < 3 && active.current.text !== text) queue.current.push(text)
      return
    }
    if (hideTimer.current !== null) {
      clearTimeout(hideTimer.current)
      timers.current.delete(hideTimer.current)
    }
    active.current = { text, visible: true }
    setToast({ text, visible: true })
    hideTimer.current = schedule(() => {
      hideTimer.current = null
      active.current.visible = false
      setToast({ text, visible: false })
      const next = queue.current.shift()
      if (next) schedule(() => showToast(next), 240)
    }, 2200)
  }

  return { toast, showToast }
}
