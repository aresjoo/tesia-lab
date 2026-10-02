import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUp, Maximize2, Minimize2, Plus } from 'lucide-react'
import { useClientPreferences, type ClientLanguage } from '../client-preferences'
import { useClientPlaceholder } from '../use-client-placeholder'
import { getSitePage, useSiteHrefMapper } from '../site-navigation'
import { getServiceSiteLocation } from '../internal-poc/service-site-navigation'

type Props = {
  value: string
  disabled: boolean
  maxLength?: number
  inputRef: RefObject<HTMLTextAreaElement | null>
  onChange: (value: string) => void
  onSend: () => void
  onLogin: () => void
  onHeightChange: (height: number) => void
  contextChips?: ReactNode
  contextPrompt?: string
  canSend?: boolean
  /** Parent-observed presentation state, never an authentication receipt. */
  signedIn?: boolean
}

type EditorSelection = { start: number; end: number; direction: 'forward' | 'backward' | 'none' }
// Source gPlusFill's signed-in fallback text; these two keys are absent from
// the extracted reference catalogue. Do not infer feature availability here.
const signedInPlusCopy = {
  ko: ['곧 제공됩니다.', '확인'], en: ['Coming soon.', 'OK'], ja: ['近日公開予定です。', '確認'],
  'zh-CN': ['即将推出。', '确认'], 'zh-TW': ['即將推出。', '確認'], es: ['Próximamente.', 'Aceptar'], fr: ['Bientôt disponible.', 'OK'],
} as const satisfies Record<ClientLanguage, readonly [string, string]>

function focusEditor(input: HTMLTextAreaElement, selection: EditorSelection | null, fallback: HTMLElement | null) {
  if (input.disabled) { fallback?.focus({ preventScroll: true }); return }
  input.focus({ preventScroll: true })
  if (selection) input.setSelectionRange(selection.start, selection.end, selection.direction)
}

/** Owns input sizing and transient UI; conversation state stays with the app. */
export function ClientComposer({ value, disabled, maxLength, inputRef, onChange, onSend, onLogin, onHeightChange, contextChips, contextPrompt, canSend = Boolean(value.trim()), signedIn = false }: Props) {
  const mapSiteHref = useSiteHrefMapper()
  const [multiline, setMultiline] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [plusOpen, setPlusOpen] = useState(false)
  const pillRef = useRef<HTMLElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const plusRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const plusId = useId()
  const plusTimers = useRef<{ open?: number; close?: number }>({})
  const expandRef = useRef<HTMLButtonElement>(null)
  const selectionRef = useRef<EditorSelection | null>(null)
  const { language, t } = useClientPreferences()
  useClientPlaceholder(inputRef, language, Boolean(value), fullscreen, contextPrompt)

  const clearPlusTimers = useCallback(() => {
    window.clearTimeout(plusTimers.current.open); window.clearTimeout(plusTimers.current.close)
    plusTimers.current = {}
  }, [])
  const closePlus = useCallback((restoreFocus = false) => {
    clearPlusTimers(); setPlusOpen(false)
    if (restoreFocus) plusRef.current?.focus({ preventScroll: true })
  }, [clearPlusTimers])
  const hoverPlus = () => {
    clearPlusTimers()
    plusTimers.current.open = window.setTimeout(() => {
      plusTimers.current.open = undefined
      const button = plusRef.current
      if (button?.getClientRects().length && !button.closest('[hidden],[inert]')) setPlusOpen(true)
    }, 500)
  }
  const leavePlus = () => {
    clearPlusTimers()
    plusTimers.current.close = window.setTimeout(() => {
      plusTimers.current.close = undefined
      // Hover dismissal must not remove the control currently being used by
      // keyboard. Escape, confirmation and outside click remain available.
      if (!popoverRef.current?.contains(document.activeElement)) setPlusOpen(false)
    }, 250)
  }
  useEffect(() => () => clearPlusTimers(), [clearPlusTimers])

  useEffect(() => {
    const pill = pillRef.current
    if (!pill || fullscreen) return
    const observer = new ResizeObserver(() => onHeightChange(pill.getBoundingClientRect().height))
    observer.observe(pill)
    return () => observer.disconnect()
  }, [fullscreen, onHeightChange])

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    let frame = 0
    let disposed = false
    const size = () => {
      if (disposed) return
      if (!fullscreen) {
        const pill = pillRef.current
        // Match the source: decide against the narrower single-line layout.
        // Measuring only the expanded width can oscillate at a wrap boundary;
        // latching the old state instead prevents short drafts from collapsing.
        pill?.classList.remove('is-multiline')
        input.style.height = '21px'
        input.style.overflowY = 'hidden'
        const nextMultiline = value.length > 0 && input.scrollHeight > 22
        pill?.classList.toggle('is-multiline', nextMultiline)
        const height = input.scrollHeight
        input.style.height = `${Math.min(Math.max(21, height), 147)}px`
        input.style.overflowY = height > 147 ? 'auto' : 'hidden'
        setMultiline(nextMultiline)
      } else {
        input.style.removeProperty('height')
        input.style.overflowY = 'auto'
      }
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(size) }
    let lastWidth = 0
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width !== lastWidth) { lastWidth = entry.contentRect.width; schedule() }
    })
    observer.observe(input)
    schedule()
    void document.fonts.ready.then(schedule)
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect() }
  }, [value, fullscreen, multiline, inputRef])

  useEffect(() => {
    if (!fullscreen) return
    const dialog = dialogRef.current
    dialog?.showModal()
    if (inputRef.current) focusEditor(inputRef.current, selectionRef.current, expandRef.current)
    return () => dialog?.close()
  }, [fullscreen, inputRef])

  useEffect(() => {
    // SiteRouter preserves the app beneath public pages. Its native top-layer
    // dialog must not outlive the visible composer, even when the app stays mounted.
    const closeOnNavigation = () => {
      const servicePage = mapSiteHref && getServiceSiteLocation(window.location.pathname + window.location.search + window.location.hash)
      if (!getSitePage() && !servicePage) return
      dialogRef.current?.close()
      setFullscreen(false)
      closePlus()
    }
    window.addEventListener('popstate', closeOnNavigation)
    window.addEventListener('teth:navigate', closeOnNavigation)
    window.addEventListener('hashchange', closeOnNavigation)
    return () => {
      window.removeEventListener('popstate', closeOnNavigation)
      window.removeEventListener('teth:navigate', closeOnNavigation)
      window.removeEventListener('hashchange', closeOnNavigation)
    }
  }, [mapSiteHref, closePlus])

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!pillRef.current?.contains(event.target as Node)) closePlus()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return
      if (event.key === 'Escape') {
        if (!plusOpen) { clearPlusTimers(); return }
        event.preventDefault(); event.stopPropagation()
        closePlus(true)
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true) }
  }, [plusOpen, closePlus, clearPlusTimers])

  const rememberSelection = () => {
    const input = inputRef.current
    if (input) selectionRef.current = { start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection }
  }
  const collapse = () => {
    closePlus()
    rememberSelection()
    dialogRef.current?.close()
    setFullscreen(false)
    requestAnimationFrame(() => {
      const input = inputRef.current
      if (!getSitePage() && input?.getClientRects().length && !input.closest('[inert]')) {
        const fallback = expandRef.current?.getClientRects().length ? expandRef.current : plusRef.current
        focusEditor(input, selectionRef.current, fallback)
      }
    })
  }
  const handOff = (action: () => void) => {
    // Close synchronously before auth takes focus; z-index cannot cover a
    // native modal. Do not restore focus to the composer during this handoff.
    dialogRef.current?.close()
    setFullscreen(false)
    closePlus()
    action()
  }
  const composer = (
    <section ref={pillRef} className={`client-home-pill ${multiline ? 'is-multiline' : ''} ${fullscreen ? 'is-fullscreen' : ''} ${contextPrompt ? 'has-template' : ''}`} aria-label="TETH AI에게 아이디어 말하기">
      {contextChips}
      <button ref={plusRef} className="client-home-plus" type="button" aria-label={t('plus.t')} aria-expanded={plusOpen} aria-controls={plusOpen ? plusId : undefined}
        onPointerEnter={event => { if (event.pointerType === 'mouse') hoverPlus() }}
        onPointerLeave={event => { if (event.pointerType === 'mouse') leavePlus() }}
        onClick={() => { clearPlusTimers(); setPlusOpen((open) => !open) }}><Plus size={20} strokeWidth={1.5} /></button>
      <textarea
        id="strategy-idea" ref={inputRef} aria-label={language === 'ko' ? '시장이나 전략에 대해 물어보세요' : t('home.idea')}
        value={value} disabled={disabled} maxLength={maxLength} onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // Native dialog cancel follows keydown and carries no IME metadata.
          // Keep composition Escape from also dismissing/remounting the editor.
          if (event.key === 'Escape' && (event.nativeEvent.isComposing || event.keyCode === 229)) { event.preventDefault(); event.stopPropagation(); return }
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); if (canSend && !disabled) handOff(onSend) }
        }}
        rows={1}
      />
      <button ref={expandRef} className="client-expand" type="button" aria-label={fullscreen ? (language === 'ko' ? '입력창 축소' : t('comp.exit')) : t('comp.full')} onClick={() => { closePlus(); if (fullscreen) collapse(); else { rememberSelection(); setFullscreen(true) } }}>
        {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
      <span className="client-pill-spacer" />
      {canSend && <button className="client-home-send" type="button" disabled={disabled} aria-label={language === 'ko' ? '대화 시작' : t('home.send')} onClick={() => handOff(onSend)}><ArrowUp size={20} /></button>}
      {plusOpen && <div ref={popoverRef} id={plusId} className="client-plus-popover" role="region" aria-labelledby={`${plusId}-title`}
        onPointerEnter={event => { if (event.pointerType === 'mouse') clearPlusTimers() }}
        onPointerLeave={event => { if (event.pointerType === 'mouse') leavePlus() }}
        onFocusCapture={clearPlusTimers}>
        <strong id={`${plusId}-title`}>{t('plus.t')}</strong>
        <p>{signedIn ? signedInPlusCopy[language][0] : t('plus.b')}</p>
        <div>{signedIn ? <button type="button" onClick={() => closePlus(true)}>{signedInPlusCopy[language][1]}</button>
          : <button type="button" onClick={() => handOff(onLogin)}>{t('nav.login')}</button>}</div>
      </div>}
    </section>
  )
  return fullscreen ? createPortal(
    <dialog ref={dialogRef} className="client-composer-dialog" aria-label="전체 화면 입력" onCancel={(event) => { event.preventDefault(); collapse() }}>
      {composer}
    </dialog>, document.body,
  ) : composer
}
