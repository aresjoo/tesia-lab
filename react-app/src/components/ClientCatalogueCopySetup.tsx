import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { type CatalogueStrategy } from '../client-catalogue'
import { sourceCatalogueIdentity } from '../client-catalogue-detail-locale'
import { catalogueCopyDecimal, catalogueCopyLosses, catalogueCopyMinimum, catalogueCopySettings, type CatalogueCopySetup } from '../client-catalogue-copy-setup'
import { useClientPreferences } from '../client-preferences'
import { ClientStrategyGlyph } from './ClientStrategyGlyph'
import copy from '../client-catalogue-copy-setup-copy.json'
import '../client-catalogue-copy-setup.css'

function revealControl(dialog: HTMLDialogElement, control: HTMLElement) {
  const port = dialog.querySelector<HTMLElement>(dialog.classList.contains('is-content-scroll') ? 'form' : '.ccs-body')
  if (!port || !port.contains(control)) return
  const field = control.getBoundingClientRect(), bounds = port.getBoundingClientRect()
  const bottom = Math.min(bounds.bottom, dialog.getBoundingClientRect().bottom)
  if (field.bottom > bottom - 8) port.scrollTop += field.bottom - bottom + 8
  else if (field.top < bounds.top + 8) port.scrollTop -= bounds.top - field.top + 8
}

/** skcSheet, original final 412fd60. Owner/revision keyed by the host.
 * The supplied callback owns persistence/approval. No synthetic connection,
 * order, budget transfer, elapsed-time success or local entitlement is created.
 */
export function ClientCatalogueCopySetup({ strategy, setup, onClose, trigger, sourcePreview = false }: {
  strategy: Readonly<CatalogueStrategy>; setup: CatalogueCopySetup; onClose: () => void; trigger?: HTMLElement; sourcePreview?: boolean
}) {
  const { language } = useClientPreferences(), text = copy[language], id = useId(), dialog = useRef<HTMLDialogElement>(null)
  const [amount, setAmount] = useState(''), [loss, setLoss] = useState<number>(-20), [existing, setExisting] = useState('skip'), [cap, setCap] = useState('95')
  const [advanced, setAdvanced] = useState(false), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false)
  const request = useRef<AbortController | null>(null), live = useRef(false)
  const submit = useRef<HTMLButtonElement>(null), dismissed = useRef(false)
  const minimum = catalogueCopyMinimum(strategy), raw = catalogueCopyDecimal(amount), rawCap = catalogueCopyDecimal(cap)
  const valid = catalogueCopySettings(strategy, setup.available, amount, loss, existing, cap)
  const money = (value: number) => new Intl.NumberFormat(language, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 2 }).format(value)
  const format = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (original, key: string) => String(values[key] ?? original))
  const budgetError = !amount ? '' : !Number.isFinite(raw) || raw < minimum ? format(text.minimum, { amount: money(minimum) }) : raw > setup.available ? text.exceeds : ''
  const capError = !Number.isInteger(rawCap) || rawCap < 5 || rawCap > 95
  const identity = sourceCatalogueIdentity(strategy, language, sourcePreview)
  useEffect(() => {
    live.current = true
    const el = dialog.current!, origin = trigger ?? document.activeElement
    const scroll = document.querySelector<HTMLElement>('.client-source-app.has-site-footer') ?? document.getElementById('research-main')
    const old = scroll?.style.overflow
    el.showModal(); if (scroll) scroll.style.overflow = 'hidden'
    const footer = el.querySelector<HTMLElement>('footer')!
    let frame = 0
    const measure = () => {
      const fallback = footer.scrollHeight + 96 > el.clientHeight
      if (el.classList.contains('is-content-scroll') === fallback) return
      el.classList.toggle('is-content-scroll', fallback)
      if (document.activeElement instanceof HTMLElement && el.contains(document.activeElement)) revealControl(el, document.activeElement)
    }
    measure()
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) })
    observer.observe(el); observer.observe(footer)
    if (window.innerWidth > 760) {
      const first = el.querySelector<HTMLInputElement>('input')
      first?.focus({ preventScroll: true })
      // Reveal the focused field inside this sheet only. The background page
      // and its return target must not scroll when a short viewport opens it.
      if (first) revealControl(el, first)
    }
    else el.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    return () => {
      live.current = false; request.current?.abort(); request.current = null; el.close()
      observer.disconnect(); cancelAnimationFrame(frame)
      if (scroll) scroll.style.overflow = old ?? ''
      if (origin instanceof HTMLElement && origin.isConnected && !origin.closest('[hidden],[inert]')) origin.focus({ preventScroll: true })
    }
  }, [trigger])
  const dismiss = () => { dismissed.current = true; request.current?.abort(); onClose() }
  const confirm = async () => {
    if (!valid || request.current || dismissed.current) return
    // Native disabled fields lose keyboard focus. Keep the pending action
    // focusable and move input-origin submissions there before freezing fields.
    submit.current?.focus({ preventScroll: true })
    if (dialog.current && submit.current) revealControl(dialog.current, submit.current)
    const controller = new AbortController(); request.current = controller; setBusy(true); setFailed(false)
    try {
      await setup.onConfirm(Object.freeze({ ...valid }), controller.signal)
      if (live.current && !controller.signal.aborted) dismiss()
    } catch {
      if (live.current && !controller.signal.aborted) setFailed(true)
    } finally {
      if (live.current && request.current === controller) { request.current = null; setBusy(false) }
    }
  }
  const choose = <T extends number | string,>(event: KeyboardEvent<HTMLButtonElement>, index: number, values: readonly T[], update: (value: T) => void) => {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1 : ['ArrowRight', 'ArrowDown'].includes(event.key) ? (index + 1) % values.length : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? (index + values.length - 1) % values.length : null
    if (next === null) return
    event.preventDefault(); update(values[next]); event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
  }
  return <dialog ref={dialog} className="catalogue-copy-sheet" aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); event.stopPropagation(); dismiss() }} onKeyDown={event => {
    if (['Enter', 'Escape'].includes(event.key) && (event.nativeEvent.isComposing || event.keyCode === 229)) { event.preventDefault(); event.stopPropagation() }
  }} onClick={event => {
    if (event.target !== event.currentTarget) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismiss()
  }}>
    <form onSubmit={event => { event.preventDefault(); void confirm() }}>
      <div className="ccs-body">
        <header><h2 id={`${id}-title`} tabIndex={-1}>{text.title}</h2><button type="button" aria-label={text.close} className="ccs-close" onClick={dismiss}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg></button></header>
        <div className="ccs-strategy"><div className="ccs-identity"><ClientStrategyGlyph kind={identity.kind} evidence={identity.glyph} size={32}/><div><b lang={/[가-힣]/.test(identity.title) ? 'ko' : language}>{identity.title}</b><span>@{strategy.by}, {identity.asset}{strategy.fut ? ' ' + text.futures : ''}</span></div></div>
          {strategy.fut && strategy.lev > 1 && <p>{format(text.leverage, { leverage: strategy.lev })}</p>}
        </div>
        <fieldset disabled={busy} className="ccs-fields">
          <div className="ccs-field"><label htmlFor={`${id}-amount`}>{text.budget}</label><div className="ccs-input"><span aria-hidden="true">$</span><input id={`${id}-amount`} type="text" inputMode="decimal" autoComplete="off" value={amount} placeholder={String(minimum)} aria-invalid={Boolean(budgetError)} aria-describedby={`${id}-hint ${id}-error`} onChange={event => { setAmount(event.target.value); setFailed(false) }}/><button type="button" onClick={() => setAmount(String(Math.floor(setup.available)))}>{text.max}</button></div>
            <p className="ccs-hint" id={`${id}-hint`}>{format(text.available, { amount: money(setup.available), min: money(minimum) })}</p><p className="ccs-error" id={`${id}-error`} role="alert">{budgetError}</p></div>
          <div className="ccs-field"><span id={`${id}-loss`}>{text.loss}</span><div className="ccs-pills" role="radiogroup" aria-labelledby={`${id}-loss`}>{catalogueCopyLosses.map((value, index) => <button type="button" role="radio" key={value} aria-checked={loss === value} tabIndex={loss === value ? 0 : -1} onClick={() => setLoss(value)} onKeyDown={event => choose(event, index, catalogueCopyLosses, setLoss)}>{Math.abs(value)}%</button>)}</div><p className="ccs-hint">{format(text.lossHint, { loss: Math.abs(loss) })}</p></div>
          <dl className="ccs-summary">{[[text.budget, Number.isFinite(raw) && raw > 0 ? money(raw) : text.empty], [text.loss, `${Number.isFinite(raw) && raw > 0 ? money(raw * Math.abs(loss) / 100) + ' ' : ''}(${Math.abs(loss)}%)`], [text.timing, existing === 'skip' ? text.next : text.current], [text.cap, capError ? '—' : `${rawCap}%`]].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
          <button className="ccs-more" type="button" aria-expanded={advanced} aria-controls={`${id}-advanced`} onClick={() => setAdvanced(value => !value)}>{advanced ? text.less : text.details}</button>
          <div id={`${id}-advanced`} hidden={!advanced}>
            <div className="ccs-field"><span id={`${id}-timing`}>{text.timing}</span><div className="ccs-pills two" role="radiogroup" aria-labelledby={`${id}-timing`}>{['skip', 'copy'].map((value, index) => <button type="button" role="radio" key={value} aria-checked={existing === value} tabIndex={existing === value ? 0 : -1} onClick={() => setExisting(value)} onKeyDown={event => choose(event, index, ['skip', 'copy'], setExisting)}>{value === 'skip' ? text.next : text.current}</button>)}</div><p className="ccs-hint">{existing === 'skip' ? text.nextHint : text.currentHint}</p></div>
            <div className="ccs-field"><div className="ccs-cap"><label htmlFor={`${id}-cap`}>{text.cap}</label><div className="ccs-input"><input id={`${id}-cap`} type="text" inputMode="numeric" value={cap} onChange={event => setCap(event.target.value)} aria-invalid={capError} aria-describedby={`${id}-cap-error`}/><span>%</span></div></div><p className="ccs-hint">{text.capHint}</p><p className="ccs-error" id={`${id}-cap-error`} role="alert">{capError ? text.invalidCap : ''}</p></div>
          </div>
        </fieldset>
      </div>
      <footer>{failed && <p role="alert" className="ccs-error">{text.failed}</p>}<button ref={submit} className="ccs-submit" type="submit" disabled={!valid} aria-disabled={busy || undefined} aria-busy={busy}>{busy ? text.starting : text.start}</button><p>{text.foot}</p></footer>
    </form>
  </dialog>
}
