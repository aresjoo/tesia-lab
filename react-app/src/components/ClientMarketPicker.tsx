import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useClientPreferences } from '../client-preferences'
import { clientCoinIcon } from '../client-coin-icon'
import { filterMarketPickerRows, marketCategories, marketPickerIcon, marketPickerSortLabel, marketPickerText, validMarketPickerRows, type MarketCategory, type MarketPickerPresentation, type MarketSort } from '../client-market-picker'
import '../client-market-picker.css'

function PickerDialog({ presentation, trigger, onClose }: { presentation: MarketPickerPresentation; trigger: HTMLButtonElement; onClose: () => void }) {
  const { language } = useClientPreferences(), id = useId()
  const dialog = useRef<HTMLDialogElement>(null), search = useRef<HTMLInputElement>(null), list = useRef<HTMLUListElement>(null), backdrop = useRef(false)
  const removedFavorite = useRef<{ button: HTMLButtonElement; index: number } | null>(null)
  const favoritesFilter = useRef<HTMLButtonElement>(null)
  const [query, setQuery] = useState(''), [category, setCategory] = useState<MarketCategory>('all'), [favoriteOnly, setFavoriteOnly] = useState(false)
  const [sort, setSort] = useState<MarketSort>('volume'), [descending, setDescending] = useState(true)
  const text = (key: Parameters<typeof marketPickerText>[1]) => marketPickerText(language, key)
  const resource = presentation.rows
  const valid = useMemo(() => resource.state === 'ready' && validMarketPickerRows(resource.value), [resource])
  const rows = useMemo(() => resource.state === 'ready' && valid ? filterMarketPickerRows(resource.value, query, category, presentation.favorites, favoriteOnly, sort, descending) : [], [resource, valid, query, category, presentation.favorites, favoriteOnly, sort, descending])
  const favorites = useMemo(() => new Set(presentation.favorites), [presentation.favorites])
  const price = new Intl.NumberFormat(language, { maximumSignificantDigits: 12 }), change = new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' })
  const volume = new Intl.NumberFormat(language, { notation: 'compact', maximumFractionDigits: 2 })
  useLayoutEffect(() => {
    const element = dialog.current!, origin = location.href
    const overflow = document.body.style.getPropertyValue('overflow'), priority = document.body.style.getPropertyPriority('overflow')
    element.showModal(); document.body.style.overflow = 'hidden'
    const viewport = window.visualViewport
    let revealFrame = 0
    const cancelReveal = () => { cancelAnimationFrame(revealFrame); revealFrame = 0 }
    const place = () => {
      element.style.setProperty('--picker-height', `${viewport?.height ?? innerHeight}px`)
      element.style.setProperty('--picker-top', `${viewport?.offsetTop ?? 0}px`)
    }
    const resize = () => {
      place(); cancelReveal()
      const active = document.activeElement
      if (!(active instanceof HTMLElement) || active.closest('dialog') !== element) return
      // A short viewport moves scrolling from the list to the sheet. Reveal the
      // same focused control after layout, without taking a newer user's focus.
      revealFrame = requestAnimationFrame(() => {
        revealFrame = 0
        if (element.isConnected && element.open && element.matches(':modal') && document.activeElement === active && active.closest('dialog') === element && active.getClientRects().length) {
          active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
        }
      })
    }
    place(); window.addEventListener('resize', resize); viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', place)
    element.addEventListener('pointerdown', cancelReveal); element.addEventListener('wheel', cancelReveal, { passive: true })
    // Keep the mobile sheet readable before the user deliberately opens the keyboard.
    if (matchMedia('(min-width:961px)').matches) search.current?.focus()
    return () => {
      cancelReveal()
      window.removeEventListener('resize', resize); viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', place)
      element.removeEventListener('pointerdown', cancelReveal); element.removeEventListener('wheel', cancelReveal)
      element.close()
      if (document.body.style.overflow === 'hidden') {
        if (overflow) document.body.style.setProperty('overflow', overflow, priority)
        else document.body.style.removeProperty('overflow')
      }
      queueMicrotask(() => {
        if (location.href === origin && !document.querySelector('dialog:modal') && trigger.isConnected && trigger.getClientRects().length && !trigger.closest('[hidden],[inert]')) trigger.focus({ preventScroll: true })
      })
    }
  }, [trigger])
  useLayoutEffect(() => { if (list.current) list.current.scrollTop = 0 }, [query, category, favoriteOnly, sort, descending])
  useLayoutEffect(() => {
    const pending = removedFavorite.current
    if (!pending || pending.button.isConnected) return
    removedFavorite.current = null
    // The row disappeared after its owner's update. Restore only lost focus,
    // never steal focus from a newer user action or a newly opened modal.
    if (document.activeElement !== document.body && document.activeElement !== dialog.current) return
    const candidates = list.current?.querySelectorAll<HTMLButtonElement>('.cmp-star')
    const target = candidates?.length ? candidates[Math.min(pending.index, candidates.length - 1)] : favoritesFilter.current
    target?.focus({ preventScroll: true })
  }, [rows])
  const outside = (element: HTMLDialogElement, x: number, y: number) => { const box = element.getBoundingClientRect(); return x < box.left || x > box.right || y < box.top || y > box.bottom }
  return createPortal(<dialog className="cmp-dialog" ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }}
    onKeyDown={event => {
      event.stopPropagation()
      if ((event.key === 'Enter' || event.key === 'Escape') && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
      if (event.key === 'Escape' && !event.nativeEvent.isComposing && event.keyCode !== 229) {
        event.preventDefault(); onClose(); return
      }
      if (event.repeat && (event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLButtonElement) event.preventDefault()
      if (event.key === 'Tab') {
        // Only inspect the two boundary targets, not every cell in a large catalogue.
        const first = event.currentTarget.querySelector<HTMLButtonElement>('.cmp-close')
        const last = list.current?.querySelector<HTMLButtonElement>('.cmp-row:last-child .cmp-select')
          ?? [...event.currentTarget.querySelectorAll<HTMLButtonElement>('.cmp-columns button')].reverse().find(node => node.getClientRects().length)
        if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus() }
      }
      if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.nativeEvent.isComposing && event.keyCode !== 229 && event.target instanceof HTMLButtonElement) {
        const row = event.target.closest('.cmp-row')
        if (row && ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
          const next = event.key === 'Home' ? row.parentElement?.firstElementChild : event.key === 'End' ? row.parentElement?.lastElementChild : event.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling
          const target = next?.querySelector<HTMLButtonElement>(event.target.classList.contains('cmp-star') ? '.cmp-star' : '.cmp-select')
          event.preventDefault(); target?.focus()
        }
        const categories = event.target.closest('.cmp-categories')
        if (categories && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
          const buttons = [...categories.querySelectorAll<HTMLButtonElement>('button')], index = buttons.indexOf(event.target)
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length
          event.preventDefault(); buttons[next]?.focus()
        }
      }
    }}
    onPointerDown={event => { backdrop.current = event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY) }}
    onPointerCancel={() => { backdrop.current = false }}
    onClick={event => { const down = backdrop.current; backdrop.current = false; if (down && event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY)) onClose() }}>
    <header className="cmp-heading"><div><h2 id={`${id}-title`}>{text('title')}</h2><p id={`${id}-description`}>{text('description')}</p></div>
      <button type="button" className="cmp-close" aria-label={text('close')} onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
    </header>
    <label className="cmp-search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg><input ref={search} type="search" aria-label={text('search')} placeholder={text('search')} value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" spellCheck={false} /></label>
    <div className="cmp-tabs"><div className="cmp-segment" role="group" aria-label={text('symbol')}>
      <button type="button" aria-pressed={!favoriteOnly} onClick={() => setFavoriteOnly(false)}>{text('perpetual')}</button><button ref={favoritesFilter} type="button" aria-pressed={favoriteOnly} onClick={() => setFavoriteOnly(true)}>{text('favorites')}</button>
    </div><div className="cmp-segment cmp-categories" role="group" aria-label={text('categories')}>{marketCategories.map(value => <button type="button" key={value} aria-pressed={category === value} onClick={() => setCategory(value)} onFocus={event => event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })}>{text(value)}</button>)}</div></div>
    <div className="cmp-columns">{(['symbol', 'price', 'change', 'volume'] as const).map(value => <button type="button" key={value} className={`cmp-${value}`} aria-pressed={sort === value} aria-label={`${text(value)}${sort === value ? `: ${marketPickerSortLabel(language, descending)}` : ''}`} onClick={() => { setSort(value); setDescending(sort === value ? !descending : value !== 'symbol') }}>{text(value)}{sort === value && <span aria-hidden="true">{descending ? ' ↓' : ' ↑'}</span>}</button>)}</div>
    <ul className="cmp-rows" ref={list} aria-label={text('title')} aria-busy={resource.state === 'loading'}>
      {rows.map((row, index) => <li key={row.id} className="cmp-row" data-selected={row.id === presentation.selectedId}>
        <button type="button" className="cmp-star" aria-label={`${row.symbol} ${text('favorites')}`} aria-pressed={favorites.has(row.id)} onClick={event => { removedFavorite.current = favoriteOnly && favorites.has(row.id) ? { button: event.currentTarget, index } : null; presentation.onFavorite(row.id, !favorites.has(row.id)) }}>{favorites.has(row.id) ? '★' : '☆'}</button>
        <button type="button" className="cmp-select" aria-pressed={row.id === presentation.selectedId} onClick={() => { presentation.onSelect(row.id); onClose() }}>
          <span className="cmp-symbol"><span className="cmp-icon" aria-hidden="true">{row.symbol.charAt(0)}{marketPickerIcon(row.icon ?? clientCoinIcon(row.symbol) ?? undefined) && <img key={row.icon} src={marketPickerIcon(row.icon ?? clientCoinIcon(row.symbol) ?? undefined)} alt="" width="20" height="20" loading="lazy" onError={event => { event.currentTarget.hidden = true }} />}</span><span><b>{row.symbol}</b>{row.name && <small>{row.name}</small>}</span></span>
          <span className="cmp-number" title={row.price === null ? undefined : price.format(row.price)} aria-label={`${text('price')}: ${row.price === null ? '—' : price.format(row.price)}`}>{row.price === null ? '—' : price.format(row.price)}</span><span className={`cmp-number ${row.change === null || row.change === 0 ? '' : row.change > 0 ? 'up' : 'down'}`} title={row.change === null ? undefined : `${change.format(row.change)}%`} aria-label={`${text('change')}: ${row.change === null ? '—' : `${change.format(row.change)}%`}`}>{row.change === null ? '—' : `${change.format(row.change)}%`}</span><span className="cmp-number cmp-volume" title={row.volume === null ? undefined : price.format(row.volume)} aria-label={`${text('volume')}: ${row.volume === null ? '—' : price.format(row.volume)}`}>{row.volume === null ? '—' : volume.format(row.volume)}</span>
        </button>
      </li>)}
      {!rows.length && <li className="cmp-state" role="status">{text(resource.state !== 'ready' ? resource.state : !valid ? 'error' : favoriteOnly && !presentation.favorites.length ? 'emptyFavorites' : 'empty')}</li>}
    </ul>
    {resource.state === 'ready' && valid && <p className="cmp-source">{resource.source} · {resource.observedAt}</p>}
  </dialog>, document.body)
}

export function ClientMarketPicker({ presentation, children, symbol }: { presentation: MarketPickerPresentation; children: ReactNode; symbol?: string }) {
  const { language } = useClientPreferences(), [trigger, setTrigger] = useState<HTMLButtonElement | null>(null)
  return <><button type="button" className="ctm-symbol cmp-trigger" aria-label={`${marketPickerText(language, 'title')}${symbol ? `: ${symbol}` : ''}`} aria-haspopup="dialog" aria-expanded={!!trigger} onClick={event => setTrigger(event.currentTarget)}>{children}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
    {trigger && <PickerDialog presentation={presentation} trigger={trigger} onClose={() => setTrigger(null)} />}</>
}
