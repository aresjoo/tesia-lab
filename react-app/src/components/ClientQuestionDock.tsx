import { useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { ClientQuestionDockContext } from '../client-question-dock'

export function ClientQuestionDockProvider({ activeKey, children }: { activeKey: string | null; children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    if (!target || !activeKey) return
    const measure = () => {
      if (!target.offsetWidth) return
      const scale = target.getBoundingClientRect().width / target.offsetWidth
      if (!Number.isFinite(scale) || scale <= 0) return
      const height = `${Math.min(580, (window.visualViewport?.height ?? window.innerHeight) / scale * .62)}px`
      if (target.style.getPropertyValue('--question-max-height') !== height) {
        target.style.setProperty('--question-max-height', height)
        const focused = document.activeElement
        if (focused instanceof HTMLElement && target.contains(focused)) focused.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    }
    const observer = new ResizeObserver(measure)
    observer.observe(target)
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    measure()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
      target.style.removeProperty('--question-max-height')
    }
  }, [activeKey, target])
  const value = useMemo(() => ({ activeKey, target, setTarget }), [activeKey, target])
  return <ClientQuestionDockContext.Provider value={value}>{children}</ClientQuestionDockContext.Provider>
}

export function ClientQuestionDockTarget() {
  const register = useContext(ClientQuestionDockContext)?.setTarget
  const attach = useCallback((node: HTMLDivElement | null) => register?.(node), [register])
  return register ? <div ref={attach} className="client-question-dock" /> : null
}
