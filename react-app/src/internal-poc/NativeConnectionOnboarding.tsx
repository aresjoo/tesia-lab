import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useClientPreferences } from '../client-preferences'
import { useConnectionLocaleText } from '../client-connection-locale-copy'
import { planExchanges, type PlanExchange } from '../client-connection-plan'
import { exchangeText } from '../exchange-connect/copy'
import { connectionCopy, type ConnectionCopyKey } from './native-connection-copy'
import { connectionPresentationBound, connectionSafeUrl, type ConnectionAction, type ConnectionGuide, type ConnectionList, type ConnectionRow, type ConnectionVerification, type NativeConnectionPresentation } from './native-connection-presentation'
import '../client-delegation.css'
import '../exchange-connect/source-parity.css'

export type NativeConnectionOnboardingProps = { accountScope?: string | null; presentation?: NativeConnectionPresentation; onReturn: () => void }
export function NativeConnectionOnboarding(props: NativeConnectionOnboardingProps) {
  const value = connectionPresentationBound(props.presentation, props.accountScope) ? props.presentation : undefined
  const exchange = value && 'exchangeId' in value.state ? value.state.exchangeId : null
  return <ConnectionScope key={JSON.stringify([props.accountScope, value?.identity, value?.state.kind, value?.state.id, exchange])} {...props} presentation={value} />
}
function Rows({ rows }: { rows: readonly ConnectionRow[] }) {
  return <div className="tfw-sec">{rows.map(row => <div className="r" key={row.id}><span className="k">{row.label}</span><span className="v" style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{row.value}</span></div>)}</div>
}
function SourceLogo({ exchange, size = 30 }: { exchange: PlanExchange; size?: number }) {
  const [failed, setFailed] = useState(false)
  const label = planExchanges.find(([id]) => id === exchange)![1]
  return failed ? <span className="nsp-logo-fallback" style={{ width: size, height: size }} aria-hidden="true">{label.slice(0, 2)}</span>
    : <img src={`/client-broker-assets/app-${exchange}.${exchange === 'gate' ? 'jpg' : 'png'}`} width={size} height={size} alt="" onError={() => setFailed(true)} />
}
const verificationStatuses = new Set(['waiting', 'checking', 'verified'])
const accountAccesses = new Set(['invitation', 'subscription', 'subscription-ended'])
function safeMaskedAccountLabel(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string' && value.length <= 64 && ![...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) && /[•*]/.test(value)
}
function safeVerification(value: ConnectionVerification | undefined): value is ConnectionVerification {
  if (!value || typeof value.exchangeId !== 'string' || !verificationStatuses.has(value.account) || !verificationStatuses.has(value.invitation) || !safeMaskedAccountLabel(value.maskedAccountLabel)) return false
  return value.account === 'verified' || value.invitation === 'waiting'
}
function safeConnectionList(value: ConnectionList | undefined): value is ConnectionList {
  if (!value || !Array.isArray(value.accounts) || !value.accounts.length || value.onOpenTerminal !== undefined && typeof value.onOpenTerminal !== 'function' || value.onAddExchange !== undefined && typeof value.onAddExchange !== 'function') return false
  const ids = new Set<string>()
  return value.accounts.every(account => {
    if (!account || typeof account.id !== 'string' || !account.id.trim() || typeof account.exchangeId !== 'string' || ids.has(account.id) || account.onDisconnect !== undefined && typeof account.onDisconnect !== 'function' || account.access !== undefined && !accountAccesses.has(account.access) || !safeMaskedAccountLabel(account.maskedAccountLabel)) return false
    ids.add(account.id)
    return true
  })
}
function ConnectionScope({ presentation: value, onReturn }: NativeConnectionOnboardingProps) {
  const { language } = useClientPreferences(), id = useId()
  const c = useConnectionLocaleText()
  const t = (key: ConnectionCopyKey) => connectionCopy(language, key)
  const stage = value?.state
  const exchangeStageBinding = value && stage ? `${value.identity}\u0000${stage.id}` : ''
  const [exchangePreflight, setExchangePreflight] = useState<{ binding: string; provider: PlanExchange } | null>(null)
  const selectedProvider = exchangePreflight?.binding === exchangeStageBinding ? exchangePreflight.provider : null
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
  }, [stage?.id, selectedProvider])
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
  if (value?.identity.startsWith('exchange:') && stage?.kind === 'exchange') {
    const choices = stage.exchanges ?? []
    const pendingStage = choices.length > 0 && choices.every(choice => choice.id === 'refresh' || choice.id === 'cancel')
    const verificationExchange = safeVerification(stage.verification) && planExchanges.find(([exchange]) => exchange === stage.verification?.exchangeId)
    if (pendingStage && safeVerification(stage.verification) && verificationExchange) {
      const verification = stage.verification, exchange = verificationExchange[0], exchangeName = verificationExchange[1]
      const steps = [
        { id: 'account', label: c('계정 확인'), description: c('승인한 계정을 읽는 중'), status: verification.account },
        { id: 'invitation', label: c('초대 계정 확인'), description: c('TETH 초대로 만든 계정인지'), status: verification.invitation },
      ] as const
      return <section className="native-connection-onboarding native-exchange-source-parity" lang={language} data-stage="exchange-verification" data-connection-identity={value.identity}>
        <div className="nsp-page"><header className="nsp-head"><button type="button" className="nsp-back" aria-label={t('back')} onClick={onReturn}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button><h1 ref={heading} tabIndex={-1}>{c('{0} 연결 확인 중', exchangeName)}</h1></header>
          <p className="nsp-lead" aria-hidden="true">{c('승인한 계정을 확인하고 있습니다.')}</p>
          <div className="nsp-card nsp-verification-card" role="status"><p className="nsp-verification-account"><SourceLogo exchange={exchange} size={22} /><b>{exchangeName}</b>{verification.maskedAccountLabel && <span className="nsp-number">{verification.maskedAccountLabel}</span>}</p><ul className="nsp-verification-steps">{steps.map(step => <li className={step.status} key={step.id}><span className="nsp-step-icon" aria-hidden="true">{step.status === 'checking' ? <i /> : step.status === 'verified' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : null}</span><b>{step.label}</b><span>{step.status === 'verified' ? c('확인했습니다') : step.description}</span></li>)}</ul></div>
          <div className="nsp-actions">{choices.map((choice, index) => <button type="button" className={index === 0 ? 'nsp-primary' : 'nsp-link'} key={choice.id} aria-busy={pendingId === `exchange:${choice.id}`} disabled={!ready || !stage.onChoose || pending} onClick={() => void run(`exchange:${choice.id}`, stage.onChoose ? () => stage.onChoose!(choice.id) : undefined)}>{pendingId === `exchange:${choice.id}` ? t('pending') : choice.title}</button>)}</div>
          {notice && <p id={`${id}-notice`} className="nsp-feedback" role={notice === 'accepted' ? 'status' : 'alert'}>{t(notice)}</p>}
        </div>
      </section>
    }
    if (pendingStage) return <section className="native-connection-onboarding native-exchange-source-parity" lang={language} data-stage="exchange-pending" data-connection-identity={value.identity}>
      <div className="nsp-page"><header className="nsp-head"><button type="button" className="nsp-back" aria-label={t('back')} onClick={onReturn}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button><h1 ref={heading} tabIndex={-1}>{c('{0} 연결 확인 중', stage.title ?? c('거래소'))}</h1></header>
        <p className="nsp-lead" aria-hidden="true">{stage.description}</p><div className="nsp-card nsp-pending-card" role="status"><i className="nsp-spinner" aria-hidden="true" /><span>{stage.description}</span></div>
        <div className="nsp-actions">{choices.map((choice, index) => <button type="button" className={index === 0 ? 'nsp-primary' : 'nsp-link'} key={choice.id} aria-busy={pendingId === `exchange:${choice.id}`} disabled={!ready || !stage.onChoose || pending} onClick={() => void run(`exchange:${choice.id}`, stage.onChoose ? () => stage.onChoose!(choice.id) : undefined)}>{pendingId === `exchange:${choice.id}` ? t('pending') : choice.title}</button>)}</div>
        {notice && <p id={`${id}-notice`} className="nsp-feedback" role={notice === 'accepted' ? 'status' : 'alert'}>{t(notice)}</p>}
      </div>
    </section>
    const available = new Map(choices.map(choice => [choice.id, choice]))
    const selectedChoice = selectedProvider ? available.get(selectedProvider) : undefined
    if (selectedProvider && selectedChoice && stage.onChoose) {
      const providerName = planExchanges.find(([exchange]) => exchange === selectedProvider)![1]
      return <section className="native-connection-onboarding native-exchange-source-parity" lang={language} data-stage="exchange-preflight" data-connection-identity={value.identity}>
        <div className="nsp-page"><header className="nsp-head"><button type="button" className="nsp-back" aria-label={t('back')} onClick={() => setExchangePreflight(null)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button><h1 ref={heading} tabIndex={-1}>{c('{0} 연결', providerName)}</h1></header>
          <p className="nsp-lead">{c('{0} 화면이 열리면 아래 두 권한을 허용합니다.', providerName)}</p>
          <div className="nsp-card"><ul className="nsp-permissions"><li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg><span><b>{c('잔고 조회')}</b>{c('전략에 쓸 잔고를 봅니다')}</span></li><li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg><span><b>{c('주문')}</b>{c('전략 조건에 맞을 때 주문을 냅니다')}</span></li></ul></div>
          <button type="button" className="nsp-primary nsp-authorize" aria-busy={pendingId === `exchange:${selectedProvider}`} disabled={!ready || pending} onClick={() => void run(`exchange:${selectedProvider}`, () => stage.onChoose!(selectedProvider))}><SourceLogo exchange={selectedProvider} size={20} />{pendingId === `exchange:${selectedProvider}` ? t('pending') : c('{0}에서 승인하기', providerName)}</button>
          {notice && <p id={`${id}-notice`} className="nsp-feedback" role={notice === 'accepted' ? 'status' : 'alert'}>{t(notice)}</p>}
        </div>
      </section>
    }
    const nonDefaultNotice = stage.description && stage.description !== exchangeText(language, 'intro') ? stage.description : ''
    const catalogFeedback = value.status === 'loading' ? t('pending') : value.status === 'unavailable' ? t('unavailable') : ''
    return <section className="native-connection-onboarding native-exchange-source-parity" lang={language} data-stage="exchange-selection" data-connection-identity={value.identity}>
      <div className="nsp-page"><header className="nsp-head"><button type="button" className="nsp-back" aria-label={t('back')} onClick={onReturn}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button><h1 ref={heading} tabIndex={-1}>{c('거래소 선택')}</h1></header>
        <p className="nsp-lead">{c('전략을 실행할 거래소를 선택합니다.')}</p>
        <div className="nsp-exchanges" role="group" aria-label={c('거래소')}>{planExchanges.map(([exchange, label]) => {
          const choice = available.get(exchange), enabled = ready && Boolean(choice && stage.onChoose)
          return <button type="button" key={exchange} data-provider-status={enabled ? 'available' : 'unsupported'} aria-label={enabled ? label : `${label} — ${t('unavailable')}`} disabled={!enabled || pending} onClick={() => { if (enabled && !pending) setExchangePreflight({ binding: exchangeStageBinding, provider: exchange }) }}><SourceLogo exchange={exchange} /><b>{label}</b></button>
        })}</div>
        {catalogFeedback && <p className="nsp-feedback" role="status">{catalogFeedback}</p>}{nonDefaultNotice && <p className="nsp-feedback" role="alert">{nonDefaultNotice}</p>}{notice && <p id={`${id}-notice`} className="nsp-feedback" role={notice === 'accepted' ? 'status' : 'alert'}>{t(notice)}</p>}
      </div>
    </section>
  }
  if (value?.identity.startsWith('exchange:') && stage?.kind === 'complete') {
    const connectionList = safeConnectionList(stage.connectionList) ? stage.connectionList : undefined
    const explicitAccounts = connectionList?.accounts.map(account => ({ account, exchange: planExchanges.find(([exchange]) => exchange === account.exchangeId)?.[0] }))
    if (connectionList && explicitAccounts?.every(account => account.exchange)) {
      const accessLabel = (access: 'invitation' | 'subscription' | 'subscription-ended') => access === 'invitation' ? c('TETH 초대 계정') : access === 'subscription' ? c('구독') : c('구독이 끝나 새 주문이 멈췄습니다')
      return <section className="native-connection-onboarding native-exchange-source-parity" lang={language} data-stage="exchange-connection-list" data-connection-identity={value.identity}>
        <div className="nsp-page"><header className="nsp-head"><button type="button" className="nsp-back" aria-label={t('back')} onClick={onReturn}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button><h1 ref={heading} tabIndex={-1}>{c('거래소 연결')}</h1></header>
          <div className="nsp-card nsp-list">{explicitAccounts.map(({ account, exchange }) => <div className="nsp-account" key={account.id}><SourceLogo exchange={exchange!} size={22} /><b>{planExchanges.find(([id]) => id === exchange)![1]}</b>{account.maskedAccountLabel && <span className="nsp-number">{account.maskedAccountLabel}</span>}{account.access && <em className="nsp-plan">{accessLabel(account.access)}</em>}<button type="button" className="nsp-link" aria-busy={pendingId === `connection-list:disconnect:${account.id}`} disabled={!ready || !account.onDisconnect || pending} onClick={() => void run(`connection-list:disconnect:${account.id}`, account.onDisconnect)}>{c('연결 끊기')}</button></div>)}</div>
          <button type="button" className="nsp-primary" aria-busy={pendingId === 'connection-list:terminal'} disabled={!ready || !connectionList.onOpenTerminal || pending} onClick={() => void run('connection-list:terminal', connectionList.onOpenTerminal)}>{pendingId === 'connection-list:terminal' ? t('pending') : c('터미널 열기')}</button>
          <p className="nsp-list-links"><button type="button" className="nsp-link" aria-busy={pendingId === 'connection-list:add'} disabled={!ready || !connectionList.onAddExchange || pending} onClick={() => void run('connection-list:add', connectionList.onAddExchange)}>{pendingId === 'connection-list:add' ? t('pending') : c('거래소 더 연결하기')}</button></p>
          {stage.description && <p className="nsp-feedback" role="status">{stage.description}</p>}
          {notice && <p id={`${id}-notice`} className="nsp-feedback" role={notice === 'accepted' ? 'status' : 'alert'}>{t(notice)}</p>}
        </div>
      </section>
    }
    const grouped = new Map<string, Record<string, string>>()
    stage.rows.forEach(row => { const split = row.id.lastIndexOf(':'); if (split < 1) return; const owner = row.id.slice(0, split), field = row.id.slice(split + 1); grouped.set(owner, { ...(grouped.get(owner) ?? {}), [field]: row.value }) })
    const sourceAccounts = [...grouped].map(([connectionId, fields]) => ({ connectionId, fields, exchange: planExchanges.find(([, label]) => label === fields.exchange)?.[0] }))
    if (sourceAccounts.length && sourceAccounts.every(account => account.exchange)) {
      const add = stage.actions.find(action => action.id === 'add')
      return <section className="native-connection-onboarding native-exchange-source-parity" lang={language} data-stage="exchange-complete" data-connection-identity={value.identity}>
        <div className="nsp-page"><header className="nsp-head"><button type="button" className="nsp-back" aria-label={t('back')} onClick={onReturn}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button><h1 ref={heading} tabIndex={-1}>{c('거래소 연결')}</h1></header>
          <div className="nsp-card nsp-list">{sourceAccounts.map(account => { const exchange = account.exchange!, action = stage.actions.find(item => item.id === account.connectionId); return <div className="nsp-account" key={account.connectionId}><SourceLogo exchange={exchange} size={22} /><b>{account.fields.exchange}</b>{account.fields.account && <span className="nsp-number">{account.fields.account}</span>}<span className="nsp-access"><em>{account.fields.permissions}</em>{account.fields.withdrawal && <small>{account.fields.withdrawal}</small>}</span>{action && <button type="button" className="nsp-link" aria-busy={pendingId === `complete:${action.id}`} disabled={!ready || pending} onClick={() => void run(`complete:${action.id}`, action.onRun)}>{action.label}</button>}</div> })}</div>
          {add && <button type="button" className="nsp-primary" aria-busy={pendingId === 'complete:add'} disabled={!ready || pending} onClick={() => void run('complete:add', add.onRun)}>{pendingId === 'complete:add' ? t('pending') : add.label}</button>}
          {stage.description && <p className="nsp-feedback" role="status">{stage.description}</p>}{notice && <p id={`${id}-notice`} className="nsp-feedback" role={notice === 'accepted' ? 'status' : 'alert'}>{t(notice)}</p>}
        </div>
      </section>
    }
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
