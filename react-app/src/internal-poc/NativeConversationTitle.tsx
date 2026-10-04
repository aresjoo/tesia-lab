import { useId, useLayoutEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useConversationCopy } from '../client-conversation-copy'
import './native-conversation-title.css'

/** Source inline title editor with controller-confirmed metadata persistence.
 * The parent keys this surface by owner/conversation, never by locale/title.
 */
export function NativeConversationTitle({ title, onSave }: { title: string; onSave?: (value: string) => void | Promise<void> }) {
  const { c } = useConversationCopy()
  const errorId = useId()
  const [editing, setEditing] = useState(false), [value, setValue] = useState(title)
  const [pending, setPending] = useState(false), [failed, setFailed] = useState(false)
  const [failureSequence, setFailureSequence] = useState(0)
  const alive = useRef(false), locked = useRef(false), edited = useRef(false), returnFocus = useRef(false)
  const input = useRef<HTMLInputElement>(null), trigger = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useLayoutEffect(() => {
    if (editing) { input.current?.focus(); input.current?.select() }
    else if (returnFocus.current) { trigger.current?.focus({ preventScroll: true }); returnFocus.current = false }
  }, [editing])
  useLayoutEffect(() => {
    if (!editing || pending || !failed || !returnFocus.current) return
    // Restore only after React commits disabled=false, not in an animation
    // frame that may run before that commit. Preserve a user's newer focus.
    if (document.activeElement === document.body || document.activeElement === input.current) input.current?.focus({ preventScroll: true })
    returnFocus.current = false
  }, [editing, pending, failed, failureSequence])
  const save = async () => {
    if (locked.current) return
    const next = value.trim()
    if (!edited.current || !next || next === title) { setEditing(false); setFailed(false); return }
    // A temporarily withdrawn action must not discard an already typed name.
    if (!onSave) { setFailed(true); setFailureSequence(sequence => sequence + 1); return }
    locked.current = true; setPending(true); setFailed(false)
    try {
      await onSave(next)
      if (!alive.current) return
      returnFocus.current = returnFocus.current && (document.activeElement === document.body || document.activeElement === input.current)
      edited.current = false; setEditing(false)
    } catch {
      if (!alive.current) return
      setFailed(true)
      setFailureSequence(sequence => sequence + 1)
    } finally { locked.current = false; if (alive.current) setPending(false) }
  }
  return <>{editing ? <input ref={input} className="g-title-input" aria-label={c('editTitle')} maxLength={120}
    value={value} disabled={pending} aria-busy={pending} aria-invalid={failed || undefined} aria-describedby={failed ? errorId : undefined}
    onChange={event => { edited.current = true; setValue(event.target.value); setFailed(false) }}
    onBlur={() => { void save() }} onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.keyCode === 229 || event.repeat || locked.current) return
      if (event.key === 'Enter') { event.preventDefault(); returnFocus.current = true; event.currentTarget.blur() }
      if (event.key === 'Escape') { event.preventDefault(); edited.current = false; returnFocus.current = true; setFailed(false); setEditing(false) }
    }} /> : <h1 aria-label={c('title')}><button ref={trigger} className="g-title" type="button" title={title}
      aria-label={c('editTitle')} disabled={!onSave} onClick={() => { edited.current = false; returnFocus.current = false; setValue(title); setFailed(false); setEditing(true) }}>
      <span>{title}</span><Pencil size={12} /></button></h1>}
    {failed && <span id={errorId} className="native-title-error" role="alert">{c('retry')}</span>}
  </>
}
