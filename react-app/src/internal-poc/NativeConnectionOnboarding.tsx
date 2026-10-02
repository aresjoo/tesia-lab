import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useClientPreferences } from '../client-preferences'
import { connectionCopy, type ConnectionCopyKey } from './native-connection-copy'
import { connectionPresentationBound, connectionSafeUrl, type ConnectionAction, type ConnectionGuide, type ConnectionRow, type NativeConnectionPresentation } from './native-connection-presentation'
import '../client-delegation.css'

export type NativeConnectionOnboardingProps = { accountScope?: string | null; presentation?: NativeConnectionPresentation; onReturn: () => void }
export function NativeConnectionOnboarding(props: NativeConnectionOnboardingProps) {
  const value = connectionPresentationBound(props.presentation, props.accountScope) ? props.presentation : undefined
  const exchange = value && 'exchangeId' in value.state ? value.state.exchangeId : null
  return <ConnectionScope key={JSON.stringify([props.accountScope, value?.identity, value?.state.kind, value?.state.id, exchange])} {...props} presentation={value} />
}
function Rows({ rows }: { rows: readonly ConnectionRow[] }) {
  return <div className="tfw-sec">{rows.map(row => <div className="r" key={row.id}><span className="k">{row.label}</span><span className="v" style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{row.value}</span></div>)}</div>
}
function ConnectionScope({ presentation: value, onReturn }: NativeConnectionOnboardingProps) {
  const { language } = useClientPreferences(), id = useId()
  const t = (key: ConnectionCopyKey) => connectionCopy(language, key)
  const stage = value?.state
  const [pendingId, setPendingId] = useState<string | null>(null), [notice, setNotice] = useState<'failed' | 'accepted' | 'uidInvalid' | 'apiInvalid' | null>(null)
  const pending = pendingId !== null
  const [uid, setUid] = useState(''), [guide, setGuide] = useState<ConnectionGuide | null>(null)
  const alive = useRef(false), lock = useRef(false), heading = useRef<HTMLHeadingElement>(null)
  const keyInput = useRef<HTMLInputElement>(null), secretInput = useRef<HTMLInputElement>(null), passInput = useRef<HTMLInputElement>(null)
  const guideDialog = useRef<HTMLDialogElement>(null), guideTrigger = useRef<HTMLElement | null>(null)
  const ready = value?.status === 'ready'
  const credentialEditable = ready && stage?.kind === 'api' && Boolean(stage.onConnect)
  useLayoutEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  useLayoutEffect(() => {
    // A keyed stage replaces its former trigger. Restore that lost focus, but
    // never interrupt a visible outside control, hidden journey or modal.
    const target = heading.current
    const visible = (node: Element | null) => Boolean(node?.isConnected && node.getClientRects().length && !node.closest('[hidden],[inert]') && getComputedStyle(node).visibility !== 'hidden')
    if (!target || !visible(target) || document.hidden || document.querySelector('dialog:modal') || [...document.querySelectorAll('[aria-modal="true"]')].some(visible)) return
    const active = document.activeElement
    if (active === document.body || active === document.documentElement || !visible(active)) target.focus({ preventScroll: true })
  }, [])
  useLayoutEffect(() => {
    const inputs = [keyInput.current, secretInput.current, passInput.current]
    return () => { inputs.forEach(input => { if (input) input.value = '' }) }
  }, [credentialEditable])
  useLayoutEffect(() => {
    const dialog = guideDialog.current
    if (!dialog) return
    if (guide && !dialog.open) dialog.showModal()
    if (!guide && dialog.open) dialog.close()
  }, [guide])
  const closeGuide = () => {
    setGuide(null)
    const trigger = guideTrigger.current
    queueMicrotask(() => { if (alive.current && trigger?.isConnected && trigger.getClientRects().length && !trigger.closest('[hidden],[inert]')) trigger.focus({ preventScroll: true }) })
  }
  const run = async (actionId: string, action?: ConnectionAction, clearSecrets = false) => {
    if (!ready || !action || lock.current || !alive.current) return
    lock.current = true; setPendingId(actionId); setNotice(null)
    try {
      await action()
      if (alive.current) {
        if (clearSecrets) [keyInput.current, secretInput.current, passInput.current].forEach(input => { if (input) input.value = '' })
        setNotice('accepted')
      }
    } catch { if (alive.current) setNotice('failed') }
    finally { lock.current = false; if (alive.current) setPendingId(null) }
  }
  const button = (actionId: string, label: string, action?: ConnectionAction, primary = false) => <button type="button" className={`tf-btn ${primary ? 'p' : 'ghost'}`} aria-busy={pendingId === actionId} disabled={!ready || !action || pending} onClick={() => void run(actionId, action)}>{pendingId === actionId ? t('pending') : label}</button>
  const guideButton = (item: ConnectionGuide | undefined, label: string) => item ? <button className="tf-link" type="button" onClick={event => { guideTrigger.current = event.currentTarget; setGuide(item) }}>{label}</button> : null
  const defaultTitle: Record<NonNullable<typeof stage>['kind'], ConnectionCopyKey> = { method: 'methodTitle', plan: 'planTitle', payment: 'payment', 'payment-confirm': 'paymentConfirm', exchange: 'exchangeTitle', partner: 'signup', uid: 'uid', api: 'api', complete: 'complete' }
  const step = !stage || ['method', 'plan', 'payment', 'payment-confirm'].includes(stage.kind) ? 0 : ['exchange', 'partner', 'uid'].includes(stage.kind) ? 1 : stage.kind === 'api' ? 2 : 3
  const title = stage?.title ?? (stage && 'exchangeName' in stage ? `${stage.exchangeName} ${t(defaultTitle[stage.kind])}` : t(stage ? defaultTitle[stage.kind] : 'title'))
  let body: ReactNode = null
  if (stage) switch (stage.kind) {
    case 'method':
      body = stage.choices === null ? <p role="status">{t('unavailable')}</p> : !stage.choices.length ? <p>{t('empty')}</p> : <div className="tf-opts">{stage.choices.map(choice => <section className={`tf-optc${choice.badge ? ' rec' : ''}`} key={choice.id}>
        <div className="top" style={{ flexWrap: 'wrap', gap: 8 }}><span className="nm">{choice.title}</span>{choice.badge && <span className="tag">{choice.badge}</span>}{choice.price && <span className="pr">{choice.price}</span>}</div>{choice.description && <p className="ds">{choice.description}</p>}{button(`choice:${choice.id}`, choice.actionLabel ?? t('choose'), stage.onChoose ? () => stage.onChoose!(choice.id) : undefined, Boolean(choice.badge))}
      </section>)}</div>
      break
    case 'plan':
      body = <div className="tf-payp"><div className="tf-cycrow" role="group" aria-label={t('planTitle')}>{stage.choices === null ? <p>{t('unavailable')}</p> : !stage.choices.length ? <p>{t('empty')}</p> : stage.choices.map(choice => <button type="button" className={`tf-cyc2${stage.selectedId === choice.id ? ' on' : ''}`} style={{ flexWrap: 'wrap' }} aria-pressed={stage.selectedId === choice.id} aria-busy={pendingId === `choice:${choice.id}`} disabled={!ready || !stage.onChoose || pending} key={choice.id} onClick={() => void run(`choice:${choice.id}`, stage.onChoose ? () => stage.onChoose!(choice.id) : undefined)}><span className="rd" /><span><span className="t">{pendingId === `choice:${choice.id}` ? t('pending') : choice.title}</span>{choice.description && <span className="d">{choice.description}</span>}</span>{choice.price && <span className="pr">{choice.price}{choice.badge && <small>{choice.badge}</small>}</span>}</button>)}</div>{button('continue', t('continue'), stage.onContinue, true)}</div>
      break
    case 'payment':
      body = <div className="tf-payp"><Rows rows={stage.rows} /><p className="tf-ez">{t('hosted')}</p>{stage.disclosure && <p className="tf-risk">{stage.disclosure}</p>}{button('checkout', t('checkout'), stage.onCheckout, true)}</div>
      break
    case 'payment-confirm':
      body = <div className="tf-payp"><Rows rows={stage.rows} />{button('confirm', stage.confirmLabel ?? t('paymentConfirm'), stage.onConfirm, true)}</div>
      break
    case 'exchange':
      body = stage.exchanges === null ? <p>{t('unavailable')}</p> : !stage.exchanges.length ? <p>{t('empty')}</p> : <div className="tf-exs">{stage.exchanges.map(exchange => <button type="button" className="tf-ex" key={exchange.id} aria-busy={pendingId === `exchange:${exchange.id}`} disabled={!ready || !stage.onChoose || pending} onClick={() => void run(`exchange:${exchange.id}`, stage.onChoose ? () => stage.onChoose!(exchange.id) : undefined)}>{exchange.badge && <span className="rb">{exchange.badge}</span>}<span className="lg">{pendingId === `exchange:${exchange.id}` ? t('pending') : exchange.title}</span>{exchange.description && <span style={{ display: 'block', marginTop: 8 }}>{exchange.description}</span>}</button>)}</div>
      break
    case 'partner': {
      const url = connectionSafeUrl(stage.registrationUrl)
      body = <><div className="tf-wait">{t('returnAfter')}<div className="tf-mini3"><span className="s on">① {t('signup')}</span><span className="s">② UID</span><span className="s">③ {t('exchange')}</span></div></div>{url && <a className="tf-btn s" href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>{t('signupLink')}</a>}{button('joined', t('joined'), stage.onJoined, true)}{guideButton(stage.guide, t('guide'))}</>
      break
    }
    case 'uid':
      body = <><div className="tf-mini3"><span className="s ok">① {t('signup')}</span><span className="s on">② UID</span><span className="s">③ {t('exchange')}</span></div>{stage.onVerify && ready ? <form className="tf-uid-form" noValidate onSubmit={event => { event.preventDefault(); if (lock.current) return; if (!/^\d{5,12}$/.test(uid.trim())) { setNotice('uidInvalid'); return }; void run('uid', () => stage.onVerify!(uid.trim())) }}>
        <div className={`tf-fld${notice === 'uidInvalid' ? ' bad' : ''}`}><label htmlFor={`${id}-uid`}>{stage.exchangeName} UID</label><input id={`${id}-uid`} style={{ boxSizing: 'border-box', maxWidth: '100%' }} aria-invalid={notice === 'uidInvalid'} aria-describedby={notice ? `${id}-notice` : undefined} inputMode="numeric" autoComplete="off" maxLength={12} value={uid} readOnly={pending} onChange={event => { setUid(event.target.value); setNotice(null) }} onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.repeat)) event.preventDefault() }} /></div>
        {guideButton(stage.guide, t('uidGuide'))}<button type="submit" className="tf-btn p tf-space" aria-busy={pendingId === 'uid'} disabled={pending || !uid.trim()}>{t(pendingId === 'uid' ? 'pending' : 'verifyUid')}</button>
      </form> : <><p>{t('unavailable')}</p>{guideButton(stage.guide, t('uidGuide'))}</>}</>
      break
    case 'api':
      body = <>{stage.disclosure && <p className="tf-ez">{stage.disclosure}</p>}<div className="tf-perm" style={{ flexWrap: 'wrap' }}>{stage.permissions.map(permission => <span key={permission.id} className={permission.requested === null ? undefined : permission.requested ? 'yes' : 'no'}>{permission.requested === null ? '—' : permission.requested ? '✓' : '✕'} {permission.label} <small>{permission.requested === null ? '' : t(permission.requested ? 'requested' : 'notRequested')}</small></span>)}</div>
        {stage.onConnect && ready ? <form className="tf-api-form" noValidate onSubmit={event => {
          event.preventDefault(); if (lock.current) return
          const apiKey = keyInput.current?.value.trim() ?? '', secretKey = secretInput.current?.value.trim() ?? '', passphrase = passInput.current?.value.trim() ?? ''
          if (apiKey.length < 10 || secretKey.length < 10 || stage.requiresPassphrase && !passphrase) { setNotice('apiInvalid'); return }
          void run('api', () => stage.onConnect!({ apiKey, secretKey, ...(stage.requiresPassphrase ? { passphrase } : {}) }), true)
        }} onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.repeat)) event.preventDefault() }}>
          {([{ name: 'API Key', ref: keyInput, key: 'api' }, { name: 'Secret Key', ref: secretInput, key: 'secret' }, ...(stage.requiresPassphrase ? [{ name: 'Passphrase', ref: passInput, key: 'pass' }] : [])]).map(field => <div className="tf-fld" key={field.key}><label htmlFor={`${id}-${field.key}`}>{field.name}</label><input id={`${id}-${field.key}`} ref={field.ref} style={{ boxSizing: 'border-box', maxWidth: '100%' }} type="password" autoComplete="off" spellCheck={false} maxLength={512} readOnly={pending} aria-invalid={notice === 'apiInvalid'} aria-describedby={notice ? `${id}-notice` : undefined} onInput={() => setNotice(null)} /></div>)}
          {guideButton(stage.guide, t('apiGuide'))}<button type="submit" className="tf-btn p tf-space" aria-busy={pendingId === 'api'} disabled={pending}>{t(pendingId === 'api' ? 'pending' : 'connect')}</button>
        </form> : <><p>{t('unavailable')}</p>{guideButton(stage.guide, t('apiGuide'))}</>}
      </>
      break
    case 'complete':
      body = <div className="tf-donec" style={{ margin: 0, maxWidth: 'none' }}>{ready && <span className="ck"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg></span>}<div className="rows"><Rows rows={stage.rows} /></div>{stage.actions.map(action => <div key={action.id}>{button(`complete:${action.id}`, action.label, action.onRun, action.primary)}</div>)}</div>
      break
  }
  return <section className="client-delegation native-connection-onboarding" lang={language} data-stage={stage?.kind ?? 'unavailable'} data-connection-identity={value?.identity} style={{ minHeight: 0, height: '100%' }}>
    <div className="tfw tf-connect-page" style={{ maxWidth: 640, boxSizing: 'border-box' }}><header className="tfw-hd"><button type="button" className="bk" aria-label={t('back')} onClick={onReturn}>←</button><h2 className="ti">{t('title')}</h2></header>
      <nav className="tf-prog" aria-label={t('title')} style={{ flexWrap: 'wrap' }}>{(['method', 'exchange', 'verify', 'start'] as const).map((label, index) => <span className={`p ${index < step ? 'ok' : index === step ? 'on' : ''}`} key={label} aria-current={index === step ? 'step' : undefined}><span className="n">{index < step ? '✓' : index + 1}</span>{t(label)}{index < 3 && <span className="ln" />}</span>)}</nav>
      <h3 ref={heading} className="tf-connect-title" tabIndex={-1}>{title}</h3>{stage?.description && <p className="tf-ez">{stage.description}</p>}
      {body}{stage?.onBack && button('back', t('back'), stage.onBack)}
      {(!value || value.status !== 'ready') && <p className="tf-risk" role="status">{t(value?.status === 'loading' ? 'pending' : value?.status === 'error' ? 'failed' : 'unavailable')}</p>}
      {notice && <p id={`${id}-notice`} className={notice === 'accepted' ? 'tf-risk' : 'tf-errb'} role={notice === 'accepted' ? 'status' : 'alert'}>{t(notice)}</p>}
      {value?.sourceLabel && <p className="tf-risk">{value.sourceLabel}</p>}
    </div>
    <dialog ref={guideDialog} className="tf-drawer" aria-labelledby={`${id}-guide`} onCancel={event => { event.preventDefault(); closeGuide() }} onClose={() => { if (guide) closeGuide() }}>
      <div className="dh"><h3 className="t" id={`${id}-guide`}>{guide?.title ?? t('guide')}</h3><button type="button" className="x" aria-label={t('close')} onClick={closeGuide}>×</button></div>
      <ol className="tf-guide" style={{ padding: 0, listStyle: 'none' }}>{guide?.steps.map((step, index) => <li className="g" key={index}>{step}</li>)}</ol>{guide?.note && <p className="tf-trust">{guide.note}</p>}{connectionSafeUrl(guide?.url) && <a href={connectionSafeUrl(guide?.url)!} target="_blank" rel="noopener noreferrer">{t('official')}</a>}
    </dialog>
  </section>
}
