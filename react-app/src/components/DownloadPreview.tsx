import { useEffect, useId, useRef, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { downloadText } from '../client-download-copy'
import { CLIENT_DOWNLOAD_ASSETS, clientPublicScreenshot } from '../client-public-assets'

const screens = ['chat', 'report', 'live'] as const

/** Original KO artwork; foreign source-artwork illustrations, not a live app. */
export function DownloadPreview() {
  const { language } = useClientPreferences()
  const id = useId(), root = useRef<HTMLElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const [index, setIndex] = useState(0), [manual, setManual] = useState(false)
  const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false)
  const [inView, setInView] = useState(false), [visible, setVisible] = useState(() => !document.hidden)
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const motion = () => setReduced(query.matches), visibility = () => setVisible(!document.hidden)
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= .2), { threshold: .2 })
    if (root.current) observer.observe(root.current)
    query.addEventListener('change', motion)
    document.addEventListener('visibilitychange', visibility)
    return () => { observer.disconnect(); query.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  useEffect(() => {
    if (manual || hovered || focused || reduced || !visible || !inView) return
    const timer = window.setInterval(() => setIndex(value => (value + 1) % screens.length), 6000)
    return () => clearInterval(timer)
  }, [manual, hovered, focused, reduced, visible, inView])
  const select = (next: number, focus = false) => {
    const selected = (next + screens.length) % screens.length
    setManual(true); setIndex(selected)
    if (focus) tabs.current[selected]?.focus({ preventScroll: true })
  }
  return <section ref={root} className="visual phone-preview" aria-label={downloadText(language, 'preview')}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <button className="download-stop" type="button" aria-pressed={manual} onClick={() => setManual(true)}>{downloadText(language, 'stop')}</button>
    <div className="download-tabs" role="tablist" aria-label={downloadText(language, 'preview')}>
      {screens.map((screen, i) => <button key={screen} ref={node => { tabs.current[i] = node }} id={`${id}-tab-${screen}`} type="button" role="tab"
        aria-controls={`${id}-panel-${screen}`} aria-selected={index === i} tabIndex={index === i ? 0 : -1} onClick={() => select(i)}
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          select(event.key === 'Home' ? 0 : event.key === 'End' ? 2 : i + (event.key === 'ArrowRight' ? 1 : -1), true)
        }}>{downloadText(language, screen)}</button>)}
    </div>
    <div className="stage" onPointerDown={event => {
      if (event.pointerType === 'touch') {
        pointer.current = { x: event.clientX, y: event.clientY }
        if (event.isTrusted) event.currentTarget.setPointerCapture(event.pointerId)
      }
    }} onPointerCancel={() => { pointer.current = null }} onPointerUp={event => {
      const start = pointer.current; pointer.current = null
      if (!start) return
      const dx = event.clientX - start.x, dy = event.clientY - start.y
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) select(index + (dx < 0 ? 1 : -1), Boolean(root.current?.contains(document.activeElement)))
    }}>
      {screens.map((screen, i) => <div key={screen} className={`slide${index === i ? ' on' : ''}`} data-screen={screen} role="tabpanel"
        id={`${id}-panel-${screen}`} aria-labelledby={`${id}-tab-${screen}`} aria-hidden={index !== i} inert={index !== i}>
        <div className="dev"><div className="scr"><img src={clientPublicScreenshot(CLIENT_DOWNLOAD_ASSETS[i], language)} width="780" height="1688" loading={i === 0 ? 'eager' : 'lazy'} alt={downloadText(language, `${screen}Alt`)} /></div></div>
        <p>{downloadText(language, `${screen}Caption`)}</p>
      </div>)}
    </div>
  </section>
}
