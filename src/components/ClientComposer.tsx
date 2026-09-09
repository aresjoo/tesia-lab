import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUp, Maximize2, Minimize2, Plus } from 'lucide-react'
import { useClientPreferences } from '../client-preferences'
import { useClientPlaceholder } from '../use-client-placeholder'
import { getSitePage } from '../site-navigation'

type Props = {
  value: string
  disabled: boolean
  maxLength?: number
  inputRef: RefObject<HTMLTextAreaElement | null>
  onChange: (value: string) => void
  onSend: () => void
  onLogin: () => void
  onHeightChange: (height: number) => void
}

/** Owns input sizing and transient UI; conversation state stays with the app. */
export function ClientComposer({ value, disabled, maxLength, inputRef, onChange, onSend, onLogin, onHeightChange }: Props) {
  const [multiline, setMultiline] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [plusOpen, setPlusOpen] = useState(false)
  const pillRef = useRef<HTMLElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const plusRef = useRef<HTMLButtonElement>(null)
  const { language, t } = useClientPreferences()
  useClientPlaceholder(inputRef, language, Boolean(value), fullscreen)

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
        input.style.height = '21px'
        input.style.overflowY = 'hidden'
        const height = input.scrollHeight
        input.style.height = `${Math.min(Math.max(21, height), 147)}px`
        input.style.overflowY = height > 147 ? 'auto' : 'hidden'
        setMultiline((previous) => value.length > 0 && (height > 22 || previous))
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
    inputRef.current?.focus()
    return () => dialog?.close()
  }, [fullscreen, inputRef])

  useEffect(() => {
    // SiteRouter preserves the app beneath public pages. Its native top-layer
    // dialog must not outlive the visible composer, even when the app stays mounted.
    const closeOnNavigation = () => {
      if (!getSitePage()) return
      dialogRef.current?.close()
      setFullscreen(false)
      setPlusOpen(false)
    }
    window.addEventListener('popstate', closeOnNavigation)
    window.addEventListener('teth:navigate', closeOnNavigation)
    return () => {
      window.removeEventListener('popstate', closeOnNavigation)
      window.removeEventListener('teth:navigate', closeOnNavigation)
    }
  }, [])

  useEffect(() => {
    if (!plusOpen) return
    const outside = (event: PointerEvent) => {
      if (!pillRef.current?.contains(event.target as Node)) setPlusOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setPlusOpen(false); plusRef.current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true) }
  }, [plusOpen])

  const collapse = () => {
    dialogRef.current?.close()
    setFullscreen(false)
    requestAnimationFrame(() => {
      const input = inputRef.current
      if (!getSitePage() && input?.getClientRects().length && !input.closest('[inert]')) input.focus()
    })
  }
  const handOff = (action: () => void) => {
    // Close synchronously before auth takes focus; z-index cannot cover a
    // native modal. Do not restore focus to the composer during this handoff.
    dialogRef.current?.close()
    setFullscreen(false)
    setPlusOpen(false)
    action()
  }
  const composer = (
    <section ref={pillRef} className={`client-home-pill ${multiline ? 'is-multiline' : ''} ${fullscreen ? 'is-fullscreen' : ''}`} aria-label="TETH AI에게 아이디어 말하기">
      <button ref={plusRef} className="client-home-plus" type="button" aria-label={t('plus.t')} aria-expanded={plusOpen} onClick={() => setPlusOpen((open) => !open)}><Plus size={20} strokeWidth={1.5} /></button>
      <textarea
        id="strategy-idea" ref={inputRef} aria-label={language === 'ko' ? '시장이나 전략에 대해 물어보세요' : t('home.idea')}
        value={value} disabled={disabled} maxLength={maxLength} onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (value.trim() && !disabled) handOff(onSend) }
        }}
        rows={1}
      />
      <button className="client-expand" type="button" aria-label={fullscreen ? (language === 'ko' ? '입력창 축소' : t('comp.exit')) : t('comp.full')} onClick={() => { setPlusOpen(false); if (fullscreen) collapse(); else setFullscreen(true) }}>
        {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
      <span className="client-pill-spacer" />
      {value.trim() && <button className="client-home-send" type="button" disabled={disabled} aria-label={language === 'ko' ? '대화 시작' : t('home.send')} onClick={() => handOff(onSend)}><ArrowUp size={20} /></button>}
      {plusOpen && <div className="client-plus-popover">
        <strong>{t('plus.t')}</strong>
        <p>{t('plus.b')}</p>
        <div><button type="button" onClick={() => handOff(onLogin)}>{t('nav.login')}</button></div>
      </div>}
    </section>
  )
  return fullscreen ? createPortal(
    <dialog ref={dialogRef} className="client-composer-dialog" aria-label="전체 화면 입력" onCancel={(event) => { event.preventDefault(); collapse() }}>
      {composer}
    </dialog>, document.body,
  ) : composer
}
