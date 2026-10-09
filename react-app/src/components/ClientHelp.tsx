// Exact help-widget.js headset artwork and configured Zendesk branch from tesia-lab 9fbff821.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { X } from 'lucide-react'
import { useClientPreferences } from '../client-preferences'
import { readClientHelpConfig, ZENDESK_SNIPPET_ID, zendeskSnippetUrl } from '../client-help-config'
import { InternalLink } from './InternalLink'
import publicCopy from '../client-public-copy.json'
import { activeClientSurfaceSelector, useClientSurfacePresence } from '../use-client-surface-presence'
import '../client-help.css'

function PublicCopy({ page, copyKey }: { page: 'about' | 'download'; copyKey: string }) {
  const { language } = useClientPreferences()
  const dictionary = publicCopy[page] as Record<string, string[]>
  return <>{dictionary[copyKey]?.[Math.max(0, ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'].indexOf(language))] ?? ''}</>
}

type ZendeskApi = (product: 'webWidget', action: 'open' | 'hide' | 'show') => void
type ZendeskLifetime = { mounted: boolean; request: number; cleanup: null | (() => void) }
type ZendeskScriptState = 'loading' | 'loaded' | 'failed'
let zendeskRequestSequence = 0
let activeZendeskRequest = 0
let activeZendeskRetire: null | (() => void) = null
let zendeskHiddenAfterCanceledLoad = false

function zendeskApi(): ZendeskApi | null {
  const candidate = Reflect.get(window, 'zE')
  return typeof candidate === 'function' ? candidate as ZendeskApi : null
}

function cancelZendeskLifetime(lifetime: ZendeskLifetime) {
  lifetime.cleanup?.(); lifetime.cleanup = null
  if (lifetime.request !== 0 && activeZendeskRequest === lifetime.request) {
    activeZendeskRequest = 0
    activeZendeskRetire = null
  }
  lifetime.request = 0
}

function zendeskScriptState(script: HTMLScriptElement): ZendeskScriptState | null {
  const value = script.dataset.tethZendeskState
  return value === 'loading' || value === 'loaded' || value === 'failed' ? value : null
}

function ownZendeskScript(script: HTMLScriptElement) {
  script.dataset.tethZendesk = 'owned'
  script.dataset.tethZendeskState = 'loading'
  script.addEventListener('load', () => {
    const api = zendeskApi()
    if (api === null) {
      script.dataset.tethZendeskState = 'failed'
      script.remove()
      return
    }
    script.dataset.tethZendeskState = 'loaded'
    if (activeZendeskRequest === 0) {
      // Zendesk documents hide/show for custom launchers. This suppresses the
      // vendor launcher if the initiating TETH surface retired during load.
      api('webWidget', 'hide')
      zendeskHiddenAfterCanceledLoad = true
    }
  }, { once: true })
  script.addEventListener('error', () => {
    script.dataset.tethZendeskState = 'failed'
    script.remove()
  }, { once: true })
}

export function SiteHelp({ initialOpen = false, open: suppliedOpen, returnFocus, onClose }: { initialOpen?: boolean; open?: boolean; returnFocus?: RefObject<HTMLElement | null>; onClose?: () => void } = {}) {
  const { t, language } = useClientPreferences()
  const gradientId = useId()
  const popupId = useId()
  const { zendeskWidgetIdentifier } = readClientHelpConfig()
  const [localOpen, setLocalOpen] = useState(initialOpen)
  const open = suppliedOpen ?? localOpen
  const [configuredFallbackState, setConfiguredFallbackState] = useState({ open, enabled: false })
  if (configuredFallbackState.open !== open) setConfiguredFallbackState({ open, enabled: false })
  const configuredFallback = configuredFallbackState.open === open && configuredFallbackState.enabled
  const surfaceOpen = open && (!initialOpen || zendeskWidgetIdentifier === null || configuredFallback)
  const presence = useClientSurfacePresence(surfaceOpen, { exitAnimationName: 'client-help-out' })
  const ref = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const keyboardOpen = useRef(false)
  const modalOrigin = useRef<HTMLElement | null>(null)
  const focusLifetime = useRef({ generation: 0 })
  const zendeskLifetime = useRef<ZendeskLifetime>({ mounted: false, request: 0, cleanup: null })
  const latestOnClose = useRef(onClose)
  const logicalOpen = useRef(surfaceOpen)
  useLayoutEffect(() => { logicalOpen.current = surfaceOpen }, [surfaceOpen])
  useLayoutEffect(() => { latestOnClose.current = onClose }, [onClose])
  const cancelZendesk = useCallback(() => cancelZendeskLifetime(zendeskLifetime.current), [])
  const openZendesk = useCallback((opened?: () => void, unavailable?: () => void, retired?: () => void) => {
    if (zendeskWidgetIdentifier === null) return false
    cancelZendesk()
    activeZendeskRetire?.()
    const lifetime = zendeskLifetime.current
    const request = ++zendeskRequestSequence
    lifetime.request = request; activeZendeskRequest = request
    const current = () => lifetime.mounted && lifetime.request === request && activeZendeskRequest === request
    const retire = () => {
      if (lifetime.request !== request) return
      lifetime.cleanup?.(); lifetime.cleanup = null
      lifetime.request = 0
      if (activeZendeskRequest === request) {
        activeZendeskRequest = 0
        activeZendeskRetire = null
      }
      retired?.()
    }
    activeZendeskRetire = retire
    const finish = () => {
      if (!current()) return
      const api = zendeskApi()
      if (api === null) return
      lifetime.cleanup?.(); lifetime.cleanup = null
      lifetime.request = 0; activeZendeskRequest = 0; activeZendeskRetire = null
      if (zendeskHiddenAfterCanceledLoad) {
        api('webWidget', 'show')
        zendeskHiddenAfterCanceledLoad = false
      }
      api('webWidget', 'open')
      opened?.()
    }
    const fail = () => {
      if (!current()) return
      lifetime.cleanup?.(); lifetime.cleanup = null
      lifetime.request = 0; activeZendeskRequest = 0; activeZendeskRetire = null
      unavailable?.()
    }
    if (zendeskApi() !== null) { finish(); return true }
    const source = zendeskSnippetUrl(zendeskWidgetIdentifier)
    const found = document.getElementById(ZENDESK_SNIPPET_ID)
    if (found !== null && (!(found instanceof HTMLScriptElement) || found.getAttribute('src') !== source)) {
      lifetime.request = 0; activeZendeskRequest = 0; activeZendeskRetire = null
      return false
    }
    if (found instanceof HTMLScriptElement) {
      const state = zendeskScriptState(found)
      if (found.dataset.tethZendesk !== 'owned' || state === 'loaded' || state === 'failed') {
        lifetime.request = 0; activeZendeskRequest = 0; activeZendeskRetire = null
        return false
      }
    }
    const script = (found as HTMLScriptElement | null) ?? document.createElement('script')
    if (found === null) {
      script.id = ZENDESK_SNIPPET_ID
      ownZendeskScript(script)
      script.src = source
    }
    const load = () => {
      if (zendeskApi() === null) {
        if (script.dataset.tethZendesk === 'owned') script.remove()
        fail()
        return
      }
      finish()
    }
    const error = () => {
      if (script.dataset.tethZendesk === 'owned') script.remove()
      fail()
    }
    script.addEventListener('load', load, { once: true })
    script.addEventListener('error', error, { once: true })
    lifetime.cleanup = () => {
      script.removeEventListener('load', load)
      script.removeEventListener('error', error)
    }
    if (found === null) {
      document.body.appendChild(script)
    }
    return true
  }, [cancelZendesk, zendeskWidgetIdentifier])
  const close = (restoreTrigger = false) => {
    if (!logicalOpen.current) return
    cancelZendesk()
    setConfiguredFallbackState({ open, enabled: false }); setLocalOpen(false); onClose?.()
    if (restoreTrigger && !initialOpen) trigger.current?.focus()
  }
  useLayoutEffect(() => {
    const lifetime = zendeskLifetime.current
    lifetime.mounted = true
    return () => { lifetime.mounted = false; cancelZendeskLifetime(lifetime) }
  }, [])
  useEffect(() => {
    if (!initialOpen || !open || zendeskWidgetIdentifier === null) return
    const complete = () => { setLocalOpen(false); latestOnClose.current?.() }
    if (!openZendesk(
      complete,
      () => setConfiguredFallbackState({ open, enabled: true }),
      complete,
    )) setConfiguredFallbackState({ open, enabled: true })
    return cancelZendesk
  }, [cancelZendesk, initialOpen, open, openZendesk, zendeskWidgetIdentifier])
  useLayoutEffect(() => {
    if (initialOpen) return
    const element = ref.current, app = element?.closest<HTMLElement>('.client-source-app')
    return () => {
      // Capture focus before React removes the floating panel. A received
      // service state may replace the home without a user clicking elsewhere.
      if (!element?.contains(document.activeElement)) return
      queueMicrotask(() => {
        if (element.isConnected || !app?.isConnected || document.activeElement !== document.body) return
        if (document.querySelector(`${activeClientSurfaceSelector},.client-load-layer,dialog:modal`)) return
        const main = app.querySelector<HTMLElement>('.client-source-main')
        if (main?.getClientRects().length && !main.closest('[inert],[hidden]') && getComputedStyle(main).visibility !== 'hidden') main.focus({ preventScroll: true })
      })
    }
  }, [initialOpen])
  useEffect(() => {
    // The popup precedes its trigger in DOM order. Keyboard activation must
    // enter its contents; pointer activation keeps the source click behavior.
    if (surfaceOpen && !initialOpen && keyboardOpen.current) ref.current?.querySelector<HTMLButtonElement>('.help-close')?.focus()
    keyboardOpen.current = false
  }, [surfaceOpen, initialOpen])
  useLayoutEffect(() => {
    if (!initialOpen || !surfaceOpen) { modalOrigin.current = null; return }
    const lifetime = focusLifetime.current
    const generation = ++lifetime.generation
    // Keep the entry point through StrictMode's effect replay. The source
    // settings item can disappear before this optional chunk has mounted.
    if (!modalOrigin.current && document.activeElement instanceof HTMLElement) modalOrigin.current = document.activeElement
    const previous = modalOrigin.current
    const logicalTarget = returnFocus?.current ?? null
    // This is a live host-owned intent, not a DOM cleanup ref. A different
    // account or entry point invalidates the retiring surface's restoration.
    const ownsReturnTarget = () => !returnFocus || returnFocus.current === logicalTarget
    const surface = ref.current
    ref.current?.querySelector<HTMLButtonElement>('.help-close')?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.defaultPrevented || event.isComposing || event.keyCode === 229) return
      if (!ref.current?.getClientRects().length || ref.current.closest('[inert],[hidden]') || document.querySelector('dialog:modal')) return
      const elements = [...(ref.current?.querySelectorAll<HTMLElement>('.site-help-pop button, .site-help-pop a[href]') ?? [])]
      const first = elements[0], last = elements.at(-1)
      if (event.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => {
      document.removeEventListener('keydown', keyboard)
      queueMicrotask(() => {
        // Never steal focus from a replacement overlay or an information page.
        // The host restores its inert state before this microtask runs.
        if (lifetime.generation !== generation || !ownsReturnTarget() || document.querySelector(`${activeClientSurfaceSelector},.client-load-layer,dialog:modal`)) return
        const visible = (element: HTMLElement | null) => element !== document.body && element !== document.documentElement && element?.isConnected && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[inert],[hidden]')
        const current = document.activeElement
        if (current instanceof HTMLElement && current !== previous && !surface?.contains(current) && visible(current)) return
        const fallback = [...document.querySelectorAll<HTMLElement>(matchMedia('(max-width:860px)').matches ? '.client-hamburger' : '.client-sidebar-bottom [data-sidebar-action="profile-settings"], .client-sidebar-bottom [data-sidebar-action="settings"], .client-rail-logo-row button')].find(visible) ?? null
        if (visible(logicalTarget)) logicalTarget?.focus({ preventScroll: true })
        else if (visible(previous)) previous?.focus({ preventScroll: true })
        else if (visible(fallback)) fallback?.focus({ preventScroll: true })
      })
    }
  }, [initialOpen, surfaceOpen, returnFocus])
  useEffect(() => {
    if (!surfaceOpen) return
    const interactive = () => {
      const element = ref.current
      return Boolean(element && !element.closest('[inert],[hidden]') && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && !document.querySelector('dialog:modal'))
    }
    const pointer = (event: PointerEvent) => { if (interactive() && !ref.current?.contains(event.target as Node)) { cancelZendesk(); setConfiguredFallbackState({ open, enabled: false }); setLocalOpen(false); onClose?.() } }
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || event.keyCode === 229) return
      if (!interactive()) return
      event.preventDefault()
      cancelZendesk(); setConfiguredFallbackState({ open, enabled: false }); setLocalOpen(false); onClose?.(); if (!initialOpen) trigger.current?.focus()
    }
    document.addEventListener('pointerdown', pointer); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', key) }
  }, [surfaceOpen, onClose, initialOpen, cancelZendesk, open])
  if (initialOpen && !presence.present) return null
  return <div className={`site-help${initialOpen ? ' client-modal-help' : ''}`} ref={ref} data-surface-active={initialOpen ? surfaceOpen : undefined} inert={initialOpen && !surfaceOpen} aria-hidden={initialOpen && !surfaceOpen || undefined}>
    {presence.present && <section className="site-help-pop" id={popupId} data-surface-active={surfaceOpen} data-surface-closing={presence.closing} inert={!surfaceOpen} aria-hidden={!surfaceOpen || undefined} onClickCapture={event => { if (!surfaceOpen) { event.preventDefault(); event.stopPropagation() } }}
      onKeyDown={event => {
        // The viewport-anchored source popup may cover the lifted home FAB.
        // Leaving either keyboard boundary dismisses it before restoring the
        // FAB. The next Tab leaves normally; this is not a nonmodal focus trap.
        // Pointer-open behavior and modal focus trapping are unchanged.
        if (!surfaceOpen || initialOpen || event.key !== 'Tab' || event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229) return
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button,a[href]')]
        const boundary = event.shiftKey ? controls[0] : controls.at(-1)
        if (document.activeElement === boundary) { event.preventDefault(); close(true) }
      }} onAnimationEnd={presence.onAnimationEnd} role={initialOpen ? 'dialog' : undefined} aria-modal={initialOpen && surfaceOpen || undefined} aria-label={t('help.title')}>
      <button type="button" className="help-close" aria-label={language === 'ko' ? '도움말 닫기' : t('common.close')} onClick={() => close(true)}>
<X size={18} />
</button>
      <h2><i aria-hidden="true" />{t('help.title')}</h2>
<p>{t('help.body')}</p><p>{t('help.sub')}</p>
      <InternalLink href="/about/#faq" onClick={() => close()}><PublicCopy page="about" copyKey="fh2" /> →</InternalLink>
      <InternalLink href="/policies/#overview" onClick={() => close()}><PublicCopy page="download" copyKey="pol" /> →</InternalLink>
    </section>}
    <button ref={trigger} className="site-help-trigger" type="button" aria-label={language === 'ko' ? 'TETH 도움말' : t('help.title')} aria-expanded={surfaceOpen} aria-controls={surfaceOpen ? popupId : undefined} onClick={event => { keyboardOpen.current = !surfaceOpen && event.detail === 0; if (surfaceOpen) close(); else if (zendeskWidgetIdentifier !== null) { const fallback = () => { if (!initialOpen || suppliedOpen === undefined) setLocalOpen(true) }; if (!openZendesk(undefined, fallback)) fallback() } else if (!initialOpen || suppliedOpen === undefined) setLocalOpen(true) }}>
<svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF5145" /><stop offset=".38" stopColor="#FFB60A" /><stop offset=".66" stopColor="#2BAE66" /><stop offset="1" stopColor="#3B82F6" /></linearGradient></defs>
        <path d="M6.2 15.5a9.8 9.8 0 0 1 19.6 0" stroke="#e6e7ea" strokeWidth="2" strokeLinecap="round" />
        <rect x="3.6" y="14.6" width="5" height="8.4" rx="2.5" fill="#e6e7ea" />
        <rect x="23.4" y="14.6" width="5" height="8.4" rx="2.5" fill="#e6e7ea" />
        <path d="M25.9 23v.9a3.6 3.6 0 0 1-3.6 3.6h-3.4" stroke="#e6e7ea" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="18" cy="27.5" r="1.6" fill="#e6e7ea" />
        <path d="M15.63 11.6c.42 2.6 1.82 4 4.42 4.42.28.05.28.57 0 .62-2.6.42-4 1.82-4.42 4.42-.05.28-.57.28-.62 0-.42-2.6-1.82-4-4.42-4.42-.28-.05-.28-.57 0-.62 2.6-.42 4-1.82 4.42-4.42.05-.28.57-.28.62 0z" fill={`url(#${gradientId})`} />
      </svg>
      <span className="help-status-dot" aria-hidden="true" /><span className="help-tooltip" aria-hidden="true">{t('help.title')}</span>
</button>
  </div>
}
