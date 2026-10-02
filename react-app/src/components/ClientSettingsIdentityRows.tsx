import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import copy from '../client-settings-copy.json'
import { nativeAccountText } from '../internal-poc/native-account-presentation-copy'

/** UI inputs only. These callbacks do not define a wire contract or grant
 * identity authority. The host owns authentication and confirmed profile data. */
export type ClientSettingsIdentityActions = Partial<Record<'name' | 'handle', (value: string, signal: AbortSignal) => Promise<void>>>
type Field = 'name' | 'handle'
type ErrorKey = 'nameInvalid' | 'nameTooLong' | 'handleInvalid' | 'handleReserved' | 'saveFailed'

export function ClientSettingsIdentityRows({ profile, actions }: {
  profile?: { name: string; handle?: string }
  actions?: ClientSettingsIdentityActions
}) {
  const { language } = useClientPreferences()
  const s = (key: keyof typeof copy) => copy[key][language]
  const id = useId()
  const [editing, setEditing] = useState<Field | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<ErrorKey | null>(null)
  const [pending, setPending] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const triggers = useRef<Partial<Record<Field, HTMLButtonElement | null>>>({})
  const restore = useRef<Field | null>(null)
  const request = useRef<AbortController | null>(null)
  const currentActions = useRef(actions)
  const available = editing !== null && !!actions?.[editing]

  useLayoutEffect(() => { currentActions.current = actions }, [actions])
  useLayoutEffect(() => () => { request.current?.abort(); request.current = null }, [])
  useLayoutEffect(() => {
    if (editing) { input.current?.focus(); input.current?.select() }
    else if (restore.current) { triggers.current[restore.current]?.focus(); restore.current = null }
  }, [editing])
  useLayoutEffect(() => {
    if (!available && request.current) {
      request.current.abort(); request.current = null; setPending(false); setError(null)
    }
  }, [available])

  const open = (field: Field) => {
    if (request.current) return
    setDraft(profile?.[field] ?? ''); setError(null); setAccepted(false); setEditing(field)
  }
  const close = () => {
    if (request.current) return
    restore.current = editing; setEditing(null); setDraft(''); setError(null)
  }
  const submit = async () => {
    if (!editing || request.current) return
    const action = currentActions.current?.[editing]
    if (!action) return
    const value = editing === 'handle' ? draft.trim().toLowerCase() : draft.trim()
    const invalid: ErrorKey | null = editing === 'name'
      ? value.length < 2 ? 'nameInvalid' : value.length > 30 ? 'nameTooLong' : null
      : !/^[a-z0-9_]{3,20}$/.test(value) ? 'handleInvalid' : /^(teth|admin|support)$/.test(value) ? 'handleReserved' : null
    if (invalid) { setError(invalid); input.current?.focus(); return }
    const controller = new AbortController()
    request.current = controller; setPending(true); setError(null); setAccepted(false)
    try {
      await action(value, controller.signal)
      if (request.current !== controller || controller.signal.aborted || !currentActions.current?.[editing]) return
      // Only the supplied profile can change the visible identity, not this draft.
      if (form.current?.contains(document.activeElement)) restore.current = editing
      setEditing(null); setDraft(''); setAccepted(true)
    } catch {
      if (request.current === controller && !controller.signal.aborted && currentActions.current?.[editing]) setError('saveFailed')
    } finally {
      if (request.current === controller) { request.current = null; setPending(false) }
    }
  }

  return <>
    {(['name', 'handle'] as const).map(field => editing === field ? <form key={field} ref={form} className="stg-r ed stg-identity" data-identity-field={field} aria-label={s(field)} aria-busy={pending} noValidate onSubmit={event => { event.preventDefault(); void submit() }} onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.keyCode === 229) { if (event.key === 'Enter') event.preventDefault(); return }
      if (event.key === 'Escape') { event.stopPropagation(); close() }
    }}>
      <div className="k"><b><label htmlFor={`${id}-${field}`}>{s(field)}</label></b></div>
      <div className="v">
        <div className="stg-input-wrap">{field === 'handle' && <span className="stg-at" aria-hidden="true">@</span>}<input ref={input} id={`${id}-${field}`} className="stg-in" value={draft} maxLength={field === 'name' ? 30 : 20} autoComplete={field === 'name' ? 'name' : 'username'} autoCapitalize={field === 'handle' ? 'none' : 'words'} spellCheck={false} readOnly={pending} aria-invalid={error && error !== 'saveFailed' ? true : undefined} aria-describedby={[field === 'handle' ? `${id}-hint` : '', !available ? `${id}-unavailable` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined} onChange={event => { setDraft(event.target.value); setError(null) }} /></div>
        {field === 'handle' && <small id={`${id}-hint`} className="stg-edit-hint">{s('handleHint')}</small>}
        {!available && <small id={`${id}-unavailable`} className="stg-edit-hint">{s('actionUnavailable')}</small>}
        {error && <small id={`${id}-error`} className="er" role="alert">{s(error)}</small>}
        {pending && <small className="stg-edit-hint" role="status">{s('saving')}</small>}
      </div>
      <div className="a"><button type="button" className="stg-b" disabled={pending} onClick={close}>{s('cancel')}</button><button type="submit" className="stg-b p" disabled={pending || !available}>{s('save')}</button></div>
    </form> : <div key={field} className="stg-r" data-identity-field={field}>
      <div className="k"><b>{s(field)}</b>{field === 'handle' && <span>{s('handleHint')}</span>}</div>
      <div className={`v${field === 'handle' ? ' num' : ''}`}>{profile?.[field] ? `${field === 'handle' ? '@' : ''}${profile[field]}` : '—'}</div>
      <div className="a"><button ref={node => { triggers.current[field] = node }} type="button" className="stg-b" disabled={pending} onClick={() => open(field)}>{s('change')}</button></div>
    </div>)}
    {accepted && <p className="stg-storage" role="status">{nativeAccountText(language, 'accepted')}</p>}
  </>
}
