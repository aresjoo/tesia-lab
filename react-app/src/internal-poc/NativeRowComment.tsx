import { useId, useLayoutEffect, useRef } from 'react'
import { useClientPreferences } from '../client-preferences'
import type { RowEdit } from './native-row-edits'
import { nativeRowText } from './native-row-copy'

export type NativeRowEditor = {
  rows: Readonly<Record<string, RowEdit>>; disabled: boolean
  onOpen: (key: string, open: boolean) => void
  onChange: (key: string, text: string) => void
  onSubmit: (key: string, label: string) => void
}

/** Original gRowComment affordance, without its optimistic percentage parser. */
export function NativeRowComment({ rowKey, label, editor }: { rowKey: string; label: string; editor: NativeRowEditor }) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof nativeRowText>[1]) => nativeRowText(language, key)
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), composing = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const row = editor.rows[rowKey]
  useLayoutEffect(() => {
    // Only reveal the field the user is already editing. Locale changes may
    // wrap rows above it; never steal focus from the composer or another row.
    if (row?.open && input.current === document.activeElement) input.current?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [row?.open, language])
  const close = () => { editor.onOpen(rowKey, false); trigger.current?.focus({ preventScroll: true }) }
  return <div className="native-row-comment" data-row-key={rowKey}>
    <button ref={trigger} className="native-row-trigger" type="button" aria-label={`${label} ${t('edit')}`} aria-expanded={row?.open ?? false}
      aria-controls={row?.open ? id : undefined} aria-disabled={editor.disabled && !row?.open} onClick={() => { if (row?.open) close(); else if (!editor.disabled) editor.onOpen(rowKey, true) }}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z" /></svg>
    </button>
    {row?.open && <form id={id} className="native-row-form" onSubmit={event => {
      event.preventDefault()
      if (!composing.current && !editor.disabled && row.text.trim()) editor.onSubmit(rowKey, label)
    }}>
      <input ref={input} autoFocus aria-label={`${label} ${t('comment')}`} placeholder={t('placeholder')} value={row.text} readOnly={editor.disabled}
        aria-invalid={row.status === 'tooLong' || row.status === 'stale' || undefined}
        aria-describedby={row.status ? `${id}-status` : undefined}
        onChange={event => editor.onChange(rowKey, event.target.value)}
        onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing || composing.current || event.nativeEvent.keyCode === 229) { if (event.key === 'Enter') event.preventDefault(); return }
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
        }} />
      <button className="native-row-apply" type="submit" disabled={editor.disabled || !row.text.trim()}>{t('apply')}</button>
      <button className="native-row-cancel" type="button" onClick={close}>{t('cancel')}</button>
      <p id={`${id}-status`} className="native-row-status" role="status">{row.status && t(row.status)}{row.detail && <span>{row.detail}</span>}</p>
    </form>}
  </div>
}
