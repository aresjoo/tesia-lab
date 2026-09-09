import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { clientCurrencies, clientLanguages, setClientPreference, useClientPreferences } from '../client-preferences'
import '../client-preferences.css'

// Accessibility states absent from the source dictionary; reviewed separately by agy.
const emptyCopy = { ko: '검색 결과가 없습니다.', en: 'No results.', ja: '検索結果がありません', 'zh-CN': '无搜索结果', 'zh-TW': '查無搜尋結果', es: 'Sin resultados', fr: 'Aucun résultat' }
const storageCopy = { ko: '이 브라우저에 설정을 저장하지 못했습니다. 현재 화면에는 적용됩니다.', en: 'Settings could not be saved in this browser. Applied to this session only.', ja: 'このブラウザーに設定を保存できませんでした。現在の画面には適用されます。', 'zh-CN': '无法在此浏览器中保存设置。已应用于当前页面。', 'zh-TW': '無法在此瀏覽器中儲存設定。已套用至目前頁面。', es: 'No se pudo guardar la configuración en este navegador. Se aplica a esta sesión.', fr: 'Impossible d’enregistrer les paramètres dans ce navigateur. Ils s’appliquent à cette session.' }
export function ClientLocalePanel({ onClose }: { onClose: () => void }) {
  const { language, currency, t, storageError } = useClientPreferences()
  const [tab, setTab] = useState<'language' | 'currency'>('language')
  const [queries, setQueries] = useState({ language: '', currency: '' })
  const panel = useRef<HTMLElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 860px)').matches)
  useEffect(() => {
    const breakpoint = matchMedia('(max-width: 860px)')
    const resize = () => setMobile(breakpoint.matches)
    breakpoint.addEventListener('change', resize)
    return () => breakpoint.removeEventListener('change', resize)
  }, [])
  useEffect(() => {
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
  }, [])
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    const siblings = Array.from(document.body.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node !== layer.current)
    const previous = siblings.map(node => [node, node.inert] as const)
    siblings.forEach(node => { node.inert = true })
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      previous.forEach(([node, inert]) => { node.inert = inert })
      if (trigger?.isConnected && trigger.getClientRects().length && getComputedStyle(trigger).visibility !== 'hidden' && !trigger.closest('[inert]')) trigger.focus()
      else document.querySelector<HTMLButtonElement>(matchMedia('(max-width: 860px)').matches ? '.client-hamburger' : '.client-sidebar-bottom button')?.focus()
    }
  }, [])
  const choose = (key: 'language' | 'currency', value: string) => {
    // A failed browser write must not be reported as persisted. Keep the panel open.
    if (setClientPreference(key, value)) onClose()
  }
  return createPortal(<div ref={layer} className="client-preferences-layer" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={panel} tabIndex={-1} className="client-locale-panel" role="dialog" aria-modal="true" aria-label={t('menu.glc')}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Escape') { event.stopPropagation(); onClose() }
        if (event.key !== 'Tab') return
        const targets = Array.from(panel.current?.querySelectorAll<HTMLElement>('button, input, a[href]') ?? []).filter(node => node.getClientRects().length && !node.closest('[hidden]'))
        const first = targets[0], last = targets.at(-1)
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first?.focus() }
      }}>
      <div className="locale-grab" aria-hidden="true" />
      <button type="button" className="locale-close" aria-label={t('common.close')} onClick={onClose}>×</button>
      <div className="locale-tabs" role="tablist" aria-label={t('menu.glc')}>
        {(['language', 'currency'] as const).map(key => <button key={key} type="button" role="tab" id={`locale-tab-${key}`} aria-controls={`locale-${key}`} aria-selected={tab === key} tabIndex={tab === key ? 0 : -1}
          onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'language' : event.key === 'End' ? 'currency' : key === 'language' ? 'currency' : 'language'; setTab(next); document.getElementById(`locale-tab-${next}`)?.focus() } }}
          onClick={() => setTab(key)}>{t(key === 'language' ? 'glc.lang' : 'glc.curTab')}</button>)}
      </div>
      <div className="locale-info"><span aria-hidden="true">i</span>{t('glc.info')}</div>
      {(['language', 'currency'] as const).map(key => {
        const options = key === 'language' ? clientLanguages.map(item => ({ code: item.c, label: item.n })) : clientCurrencies.map(item => ({ code: item.c, label: item.c }))
        const filtered = options.filter(item => `${item.label} ${item.code}`.toLocaleLowerCase().includes(queries[key].trim().toLocaleLowerCase()))
        const selected = key === 'language' ? language : currency
        const title = t(key === 'language' ? 'glc.lang' : 'glc.cur')
        return <div onFocusCapture={() => setTab(key)} key={key} id={`locale-${key}`} role={mobile ? 'tabpanel' : 'region'} aria-labelledby={mobile ? `locale-tab-${key}` : undefined} aria-label={mobile ? undefined : title} className={`locale-column ${tab === key ? 'is-active' : ''}`}>
          <h4>{title}{key === 'language' && <><button type="button" className="locale-info-button" aria-label={t('glc.info')} aria-describedby="locale-language-tip">i</button><span id="locale-language-tip" className="locale-tooltip" role="tooltip">{t('glc.info')}</span></>}</h4>
          <label className="locale-search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
            <input type="search" aria-label={`${title} ${t('glc.search')}`} placeholder={t('glc.search')} value={queries[key]} onChange={event => setQueries(previous => ({ ...previous, [key]: event.target.value }))} />
          </label>
          <ul aria-label={title}>{filtered.map(item => <li key={item.code}><button type="button" aria-pressed={selected === item.code} onClick={() => choose(key, item.code)}><span>{item.label}</span><span className="locale-check" aria-hidden="true">✓</span></button></li>)}</ul>
          {!filtered.length && <p className="locale-empty" role="status">{emptyCopy[language]}</p>}
        </div>
      })}
      {storageError && <p className="locale-storage-error" role="status">{storageCopy[language]}</p>}
    </section>
  </div>, document.body)
}
