import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { clientLanguages, setClientPreference, useClientPreferences } from '../client-preferences'
import { activeClientSurfaceSelector, useClientSurfacePresence } from '../use-client-surface-presence'
import '../client-preferences.css'

// Accessibility states absent from the source dictionary; reviewed separately by agy.
const emptyCopy = { ko: '검색 결과가 없습니다.', en: 'No results.', ja: '検索結果がありません', 'zh-CN': '无搜索结果', 'zh-TW': '查無搜尋結果', es: 'Sin resultados', fr: 'Aucun résultat' }
const storageCopy = { ko: '이 브라우저에 설정을 저장하지 못했습니다. 현재 화면에는 적용됩니다.', en: 'Settings could not be saved in this browser. Applied to this session only.', ja: 'このブラウザーに設定を保存できませんでした。現在の画面には適用されます。', 'zh-CN': '无法在此浏览器中保存设置。已应用于当前页面。', 'zh-TW': '無法在此瀏覽器中儲存設定。已套用至目前頁面。', es: 'No se pudo guardar la configuración en este navegador. Se aplica a esta sesión.', fr: 'Impossible d’enregistrer les paramètres dans ce navigateur. Ils s’appliquent à cette session.' }
export function ClientLocalePanel({ onClose, open = true, manageBackground = true, returnFocus }: { onClose: () => void; open?: boolean; manageBackground?: boolean; returnFocus?: RefObject<HTMLElement | null> }) {
  const { language, t, storageError } = useClientPreferences()
  const [query, setQuery] = useState('')
  const panel = useRef<HTMLElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const origin = useRef<HTMLElement | null>(null)
  const focusLifetime = useRef({ generation: 0 })
  const presence = useClientSurfacePresence(open)
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) setQuery('')
  }
  useEffect(() => {
    if (!open) return
    const viewport = window.visualViewport
    if (!viewport) return
    let frame = 0
    const resize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        panel.current?.style.setProperty('--locale-viewport', `${viewport.height}px`)
        panel.current?.style.setProperty('--locale-bottom', `${Math.max(0, innerHeight - viewport.height - viewport.offsetTop)}px`)
      })
    }
    resize()
    viewport.addEventListener('resize', resize); viewport.addEventListener('scroll', resize)
    return () => { cancelAnimationFrame(frame); viewport.removeEventListener('resize', resize); viewport.removeEventListener('scroll', resize) }
  }, [open])
  useEffect(() => {
    if (!open) { origin.current = null; return }
    const lifetime = focusLifetime.current
    const generation = ++lifetime.generation
    if (!origin.current && document.activeElement instanceof HTMLElement) origin.current = document.activeElement
    const trigger = origin.current
    const logicalTarget = returnFocus?.current ?? null
    const ownsReturnTarget = () => !returnFocus || returnFocus.current === logicalTarget
    const surface = panel.current
    const bodyStyle = document.body.style
    const previousOverflow = bodyStyle.getPropertyValue('overflow')
    const previousPriority = bodyStyle.getPropertyPriority('overflow')
    const siblings = manageBackground ? Array.from(document.body.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node !== layer.current) : []
    const previous = siblings.map(node => [node, node.inert] as const)
    siblings.forEach(node => { node.inert = true })
    if (manageBackground) bodyStyle.setProperty('overflow', 'hidden')
    panel.current?.focus()
    return () => {
      if (manageBackground) {
        if (previousOverflow) bodyStyle.setProperty('overflow', previousOverflow, previousPriority)
        else bodyStyle.removeProperty('overflow')
      }
      previous.forEach(([node, inert]) => { node.inert = inert })
      queueMicrotask(() => {
        if (lifetime.generation !== generation || !ownsReturnTarget() || document.querySelector(activeClientSurfaceSelector)) return
        const current = document.activeElement
        if (current instanceof HTMLElement && current !== document.body && current !== trigger && !surface?.contains(current) && current.getClientRects().length && !current.closest('[inert],[hidden]')) return
        const visible = (node: HTMLElement | null) => node !== document.body && node !== document.documentElement && node?.isConnected && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden' && !node.closest('[inert],[hidden]')
        const fallback = document.querySelector<HTMLElement>(matchMedia('(max-width: 860px)').matches ? '.client-hamburger' : '.client-sidebar-bottom button')
        const target = visible(logicalTarget) ? logicalTarget : visible(trigger) ? trigger : visible(fallback) ? fallback : null
        target?.focus({ preventScroll: true })
      })
    }
  }, [open, manageBackground, returnFocus])
  const choose = (value: string) => {
    // A failed browser write must not be reported as persisted. Keep the panel open.
    if (open && setClientPreference('language', value)) onClose()
  }
  const filtered = clientLanguages.filter(item => `${item.n} ${item.c}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const title = t('glc.lang')
  if (!presence.present) return null
  return createPortal(<div ref={layer} className="client-preferences-layer" data-surface-active={open} data-surface-closing={presence.closing} inert={!open} aria-hidden={!open || undefined} onClickCapture={event => { if (!open) { event.preventDefault(); event.stopPropagation() } }} onPointerDown={event => { if (open && event.target === event.currentTarget) onClose() }}>
    <section ref={panel} tabIndex={-1} className="client-locale-panel" role="dialog" aria-modal="true" aria-label={title}
      onAnimationEnd={presence.onAnimationEnd}
      onKeyDown={event => {
        if (!open) return
        if (event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return
        if (event.key === 'Escape') { event.stopPropagation(); onClose() }
        if (event.key !== 'Tab') return
        const targets = Array.from(panel.current?.querySelectorAll<HTMLElement>('button, input, a[href]') ?? []).filter(node => node.getClientRects().length && !node.closest('[hidden]'))
        const first = targets[0], last = targets.at(-1)
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first?.focus() }
      }}>
      <button type="button" className="locale-grab" aria-label={t('common.close')} onClick={onClose} />
      <button type="button" className="locale-close" aria-label={t('common.close')} onClick={onClose}>×</button>
      <div className="locale-info"><span aria-hidden="true">i</span>{t('glc.info')}</div>
      <div id="locale-language" role="region" aria-label={title} className="locale-column">
          <h4>{title}<button type="button" className="locale-info-button" aria-label={t('glc.info')} aria-describedby="locale-language-tip">i</button><span id="locale-language-tip" className="locale-tooltip" role="tooltip">{t('glc.info')}</span></h4>
          <label className="locale-search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
            <input type="search" aria-label={`${title} ${t('glc.search')}`} placeholder={t('glc.search')} value={query} onChange={event => setQuery(event.target.value)} />
          </label>
          <ul aria-label={title}>{filtered.map(item => <li key={item.c}><button type="button" aria-pressed={language === item.c} onClick={() => choose(item.c)}><span>{item.n}</span><span className="locale-check" aria-hidden="true">✓</span></button></li>)}</ul>
          {!filtered.length && <p className="locale-empty" role="status">{emptyCopy[language]}</p>}
      </div>
      {storageError && <p className="locale-storage-error" role="status">{storageCopy[language]}</p>}
    </section>
  </div>, document.body)
}
