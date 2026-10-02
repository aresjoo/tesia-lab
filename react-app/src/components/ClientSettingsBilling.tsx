import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useClientPreferences } from '../client-preferences'
import copy from '../client-settings-copy.json'
import { billingText } from '../client-settings-billing-copy'
import { securityText } from '../client-settings-security-copy'
import type { ClientBillingActions, ClientBillingInformation, ClientBillingInvoice, ClientBillingMethod, ClientBillingPresentation, ClientSubscriptionConfirmation } from '../client-settings-billing-presentation'
import { nativeAccountText } from '../internal-poc/native-account-presentation-copy'
import { ClientSettingsModal } from './ClientSettingsModal'

function useRequest(available: boolean) {
  const request = useRef<AbortController | null>(null), enabled = useRef(available)
  const [pending, setPending] = useState(false), [failed, setFailed] = useState(false)
  const [wasAvailable, setWasAvailable] = useState(available)
  if (wasAvailable !== available) { setWasAvailable(available); if (!available) { setPending(false); setFailed(false) } }
  useLayoutEffect(() => {
    enabled.current = available
    if (!available) { request.current?.abort(); request.current = null }
  }, [available])
  useLayoutEffect(() => () => { request.current?.abort(); request.current = null }, [])
  const run = async (operation: (signal: AbortSignal) => Promise<void>, accepted: () => void) => {
    if (!enabled.current || request.current) return
    const active = document.activeElement
    if (active instanceof HTMLButtonElement) active.closest('form,dialog')?.querySelector<HTMLButtonElement>('button[type=button]:not(:disabled)')?.focus()
    const controller = new AbortController()
    request.current = controller; setPending(true); setFailed(false)
    try {
      await operation(controller.signal)
      if (request.current === controller && !controller.signal.aborted && enabled.current) accepted()
    } catch {
      if (request.current === controller && !controller.signal.aborted && enabled.current) setFailed(true)
    } finally {
      if (request.current === controller) { request.current = null; setPending(false) }
    }
  }
  return { pending, failed, run }
}
function Section({ title, action, children, className = '' }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`stg-sec ${className}`}><header><h2>{title}</h2>{action}</header><div className="stg-card">{children}</div></section>
}
const masked = (last4: string) => `•••• ${/^\d{4}$/.test(last4) ? last4 : '—'}`

function InformationForm({ information, onSave, onClose, onAccepted }: {
  information: ClientBillingInformation | null; onSave?: ClientBillingActions['updateInformation']
  onClose: () => void; onAccepted: () => void
}) {
  const { language } = useClientPreferences(), id = useId()
  const t = (key: Parameters<typeof billingText>[1]) => billingText(language, key)
  const [draft, setDraft] = useState(information ?? { email: '', name: '', address: '' })
  const [error, setError] = useState<'emailInvalid' | 'nameRequired' | null>(null)
  const available = !!onSave, { run, pending, failed } = useRequest(available)
  const form = useRef<HTMLFormElement>(null)
  useLayoutEffect(() => {
    if (available) form.current?.querySelector<HTMLInputElement>('input')?.focus()
    else form.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [available])
  return <form ref={form} className="stg-billing-form" noValidate onSubmit={event => {
    event.preventDefault()
    if (!onSave || pending) return
    const information = { email: draft.email.trim(), name: draft.name.trim(), address: draft.address.trim() }
    const invalid = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(information.email) ? 'emailInvalid' : !information.name ? 'nameRequired' : null
    setError(invalid)
    if (invalid) { form.current?.querySelector<HTMLInputElement>(`input[name=${invalid === 'emailInvalid' ? 'email' : 'name'}]`)?.focus(); return }
    void run(signal => onSave(information, signal), onAccepted)
  }} onKeyDown={event => {
    if ((event.key === 'Enter' || event.key === 'Escape') && (event.nativeEvent.isComposing || event.keyCode === 229)) { event.preventDefault(); event.stopPropagation(); return }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
  }}>
    {(['email', 'name', 'address'] as const).map(field => <label key={field} htmlFor={`${id}-${field}`}><span>{field === 'name' ? copy.name[language] : t(field)}</span><input className="stg-in" id={`${id}-${field}`} data-settings-autofocus={field === 'email' ? true : undefined} name={field} type={field === 'email' ? 'email' : 'text'} autoComplete="off" disabled={!available} readOnly={pending} value={draft[field]} placeholder={field === 'address' ? t('addressHint') : undefined} aria-invalid={(error === 'emailInvalid' && field === 'email' || error === 'nameRequired' && field === 'name') || undefined} aria-describedby={!available ? `${id}-unavailable` : error ? `${id}-error` : undefined} onChange={event => { setDraft({ ...draft, [field]: event.target.value }); setError(null) }} /></label>)}
    {!available && <p id={`${id}-unavailable`} className="stg-edit-hint">{copy.actionUnavailable[language]}</p>}
    {error && <p id={`${id}-error`} className="er" role="alert">{t(error)}</p>}
    {failed && <p className="er" role="alert">{securityText(language, 'failed')}</p>}
    {pending && <p className="stg-edit-hint" role="status">{nativeAccountText(language, 'pending')}</p>}
    <div className="stg-billing-actions"><button type="button" className="stg-b" onClick={onClose}>{copy.cancel[language]}</button><button type="submit" className="stg-b p" disabled={!available || pending}>{copy.save[language]}</button></div>
  </form>
}

function Receipt({ invoice, trigger, onClose }: { invoice: ClientBillingInvoice; trigger: HTMLButtonElement; onClose: () => void }) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof billingText>[1]) => billingText(language, key)
  const fields = [[t('content'), invoice.label], [t('date'), invoice.dateLabel], [t('amount'), invoice.amountLabel], [t('method'), invoice.paymentMethodLabel ?? '—'], [copy.status[language], invoice.statusLabel], [t('number'), invoice.id], ...(invoice.recipient ? [[t('recipient'), invoice.recipient]] : [])]
  return <ClientSettingsModal title={t(invoice.kind === 'paid' ? 'receipt' : invoice.kind === 'failed' ? 'failedReceipt' : 'refundedReceipt')} trigger={trigger} onClose={onClose}>
    <dl className="stg-receipt">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="bts"><button type="button" className="ok" onClick={onClose}>{t('close')}</button></div>
  </ClientSettingsModal>
}
type CardOperation = 'add' | 'default' | 'remove'
function PaymentAction({ kind, method, actions, trigger, onClose, onAccepted }: {
  kind: CardOperation; method?: ClientBillingMethod; actions?: ClientBillingActions; trigger: HTMLButtonElement
  onClose: () => void; onAccepted: () => void
}) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof billingText>[1]) => billingText(language, key)
  const operation = kind === 'add' ? actions?.addMethod : kind === 'default' && method && !method.isDefault && actions?.makeDefault ? (signal: AbortSignal) => actions.makeDefault!(method.id, signal) : kind === 'remove' && method?.removable && actions?.removeMethod ? (signal: AbortSignal) => actions.removeMethod!(method.id, signal) : undefined
  const { pending, failed, run } = useRequest(!!operation)
  return <ClientSettingsModal title={t(kind === 'add' ? 'addTitle' : kind === 'default' ? 'defaultTitle' : 'removeTitle')} description={kind === 'add' ? t('providerHint') : securityText(language, 'requestHint')} trigger={trigger} onClose={onClose}>
    {method && <p><b>{method.brand} {masked(method.last4)}</b></p>}
    {!operation && <p className="hint">{copy.actionUnavailable[language]}</p>}
    {pending && <p className="hint" role="status">{nativeAccountText(language, 'pending')}</p>}
    {failed && <p className="er" role="alert">{securityText(language, 'failed')}</p>}
    <div className="bts"><button type="button" onClick={onClose}>{copy.cancel[language]}</button><button type="button" className={`ok${kind === 'remove' ? ' dg' : ''}`} disabled={!operation || pending} onClick={() => { if (operation) void run(operation, onAccepted) }}>{t(kind === 'add' ? 'add' : kind === 'default' ? 'makeDefault' : 'remove')}</button></div>
  </ClientSettingsModal>
}

type SubscriptionOperation = 'cancel' | 'resume' | 'add-method'
function SubscriptionAction({ kind, confirmation, actions, trigger, onClose, onAccepted }: {
  kind: SubscriptionOperation; confirmation: ClientSubscriptionConfirmation; actions?: ClientBillingActions
  trigger: HTMLButtonElement; onClose: () => void; onAccepted: () => void
}) {
  const { language } = useClientPreferences(), id = useId()
  const operation = kind === 'add-method' ? actions?.addMethod : actions?.subscription ? (signal: AbortSignal) => actions.subscription!(kind, signal) : undefined
  const { pending, failed, run } = useRequest(!!operation)
  return <ClientSettingsModal title={confirmation.title} description={confirmation.description} trigger={trigger} onClose={onClose}>
    {confirmation.consequences.length > 0 && <ul className="stg-subscription-consequences">{confirmation.consequences.map((text, i) => <li key={i}>{text}</li>)}</ul>}
    {!operation && <p id={`${id}-unavailable`} className="hint">{copy.actionUnavailable[language]}</p>}
    {pending && <p className="hint" role="status">{nativeAccountText(language, 'pending')}</p>}
    {failed && <p className="er" role="alert">{securityText(language, 'failed')}</p>}
    <div className="bts"><button type="button" onClick={onClose}>{copy.cancel[language]}</button><button type="button" className={`ok${kind === 'cancel' ? ' dg' : ''}`} disabled={!operation || pending} aria-describedby={!operation ? `${id}-unavailable` : undefined} onClick={() => { if (operation) void run(operation, onAccepted) }}>{confirmation.confirmLabel}</button></div>
  </ClientSettingsModal>
}

type Props = { data?: ClientBillingPresentation; actions?: ClientBillingActions; onConnect?: () => void }
/** Host keys the page by owner/dataset. Any billing snapshot replacement clears
 * open receipt/editor/action context; it cannot mutate historical facts locally. */
export function ClientSettingsBilling({ data, actions, onConnect }: Props) {
  return <BillingContent key={JSON.stringify(data ?? null)} data={data} actions={actions} onConnect={onConnect} />
}
function BillingContent({ data, actions, onConnect }: Props) {
  const { language } = useClientPreferences(), id = useId()
  const t = (key: Parameters<typeof billingText>[1]) => billingText(language, key)
  const [all, setAll] = useState(false), [accepted, setAccepted] = useState(false)
  const [editor, setEditor] = useState<HTMLButtonElement | null>(null)
  const [manager, setManager] = useState<{ kind: 'methods' | 'subscription'; trigger: HTMLButtonElement } | null>(null)
  const [receipt, setReceipt] = useState<{ invoice: ClientBillingInvoice; trigger: HTMLButtonElement } | null>(null)
  const [payment, setPayment] = useState<{ kind: CardOperation; method?: ClientBillingMethod; trigger: HTMLButtonElement } | null>(null)
  const [subscriptionAction, setSubscriptionAction] = useState<{ kind: SubscriptionOperation; confirmation: ClientSubscriptionConfirmation; trigger: HTMLButtonElement } | null>(null)
  const missing = <p className="stg-empty">{copy.unavailable[language]}</p>
  const invoices = data?.invoices, methods = data?.methods, subscription = data?.subscription
  const primary = methods?.find(method => method.isDefault) ?? methods?.[0]
  const hidePaymentDetails = subscription?.state === 'invited' && invoices?.length === 0 && methods?.length === 0
  const openSubscription = (kind: SubscriptionOperation, confirmation: ClientSubscriptionConfirmation, trigger: HTMLButtonElement) => {
    setManager(null); setAccepted(false); setSubscriptionAction({ kind, confirmation, trigger })
  }
  const openPayment = (kind: CardOperation, trigger: HTMLButtonElement, method?: ClientBillingMethod) => {
    setManager(null); setAccepted(false); setPayment({ kind, trigger, method })
  }
  const paymentDone = () => {
    // Only an accepted default request returns to the methods list. Its data
    // still comes from the host; no local default/removal/success is inferred.
    if (payment?.kind === 'default') setManager({ kind: 'methods', trigger: payment.trigger })
    setPayment(null); setAccepted(true)
  }
  const methodSummary = primary ? <>{primary.brand} <span className="num">{masked(primary.last4)}</span></> : methods ? t('noMethods') : copy.unavailable[language]
  return <div className="stg-billing">
    {data?.sourceLabel && <p className="stg-source">{data.sourceLabel}</p>}
    {accepted && <p className="stg-storage" role="status">{nativeAccountText(language, 'accepted')}</p>}
    {subscription?.warning && <p className="stg-subscription-warning" role="alert">{subscription.warning}</p>}
    <Section title={t('planSection')} className="stg-billing-summary">
      {subscription ? <div className="stg-r stg-subscription-row stg-subscription-overview" data-actions={subscription.state !== 'invited'}>
        <div className="k"><b>{t(subscription.state === 'active' || subscription.state === 'ending' ? 'subscription' : subscription.state)}</b><span>{subscription.description}</span>
          {subscription.state === 'ending' && !subscription.resumption && <span id={`${id}-resume-unavailable`}>{copy.actionUnavailable[language]}</span>}
          {(subscription.state === 'expired' || subscription.state === 'none') && !onConnect && <span id={`${id}-connect-unavailable`}>{copy.actionUnavailable[language]}</span>}
        </div>
        <div className="v num">{'amountLabel' in subscription ? subscription.amountLabel : subscription.state === 'invited' ? subscription.feeLabel : null}</div>
        <div className="a">
          {subscription.state === 'active' && <button type="button" className="stg-b" onClick={event => { setAccepted(false); setManager({ kind: 'subscription', trigger: event.currentTarget }) }}>{t('manageSubscription')}</button>}
          {subscription.state === 'ending' && <button type="button" className="stg-b p" disabled={!subscription.resumption} aria-describedby={!subscription.resumption ? `${id}-resume-unavailable` : undefined} onClick={event => { if (subscription.resumption) openSubscription(subscription.resumption.kind, subscription.resumption.confirmation, event.currentTarget) }}>{t('resume')}</button>}
          {(subscription.state === 'expired' || subscription.state === 'none') && <button type="button" className="stg-b p" disabled={!onConnect} aria-describedby={!onConnect ? `${id}-connect-unavailable` : undefined} onClick={onConnect}>{t(subscription.state === 'expired' ? 'subscribe' : 'connect')}</button>}
        </div>
      </div> : missing}
      {!hidePaymentDetails && <>
        <div className="stg-r stg-billing-summary-row" data-billing-methods><div className="k"><b>{t('method')}</b><span>{methodSummary}</span></div><div className="a"><button type="button" className="stg-b" onClick={event => {
          setAccepted(false)
          if (methods?.length === 0) openPayment('add', event.currentTarget)
          else setManager({ kind: 'methods', trigger: event.currentTarget })
        }}>{methods?.length === 0 ? t('addShort') : t('manage')}</button></div></div>
        <div className="stg-r stg-billing-summary-row" data-billing-information><div className="k"><b>{t('information')}</b><span>{data?.information?.email || copy.unavailable[language]}</span></div><div className="a"><button type="button" className="stg-b" onClick={event => { setAccepted(false); setEditor(event.currentTarget) }}>{t('change')}</button></div></div>
      </>}
    </Section>
    <Section title={copy.billingHistory[language]} action={invoices && invoices.length > 3 && <button type="button" className="stg-lk" aria-expanded={all} aria-controls={`${id}-invoices`} onClick={() => setAll(!all)}>{t(all ? 'less' : 'all')}</button>}>
      <div id={`${id}-invoices`}>{!invoices ? missing : invoices.length === 0 ? <p className="stg-empty">{t(subscription?.state === 'invited' ? 'noInvitedInvoices' : 'noInvoices')}</p> : invoices.slice(0, all ? invoices.length : 3).map(invoice => <button type="button" className="stg-invoice" key={invoice.id} onClick={event => setReceipt({ invoice, trigger: event.currentTarget })}>
        <span className="k"><b className="num date">{invoice.dateLabel}</b><span className="stg-invoice-status" data-kind={invoice.kind}>{invoice.statusLabel}</span></span><span className="num amount">{invoice.amountLabel}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </button>)}</div>
    </Section>
    {editor && <ClientSettingsModal title={t('information')} trigger={editor} onClose={() => setEditor(null)}>
      <InformationForm information={data?.information ?? null} onSave={actions?.updateInformation} onClose={() => setEditor(null)} onAccepted={() => { setEditor(null); setAccepted(true) }} />
    </ClientSettingsModal>}
    {manager && <ClientSettingsModal title={t(manager.kind === 'methods' ? 'method' : 'subscription')} closeLabel={t('close')} trigger={manager.trigger} onClose={() => setManager(null)}>
      <div className="stg-management">
        {manager.kind === 'methods' ? <>
          <div className="stg-card">{!methods ? missing : methods.length === 0 ? <p className="stg-empty">{t('noMethods')}</p> : methods.map((method, index) => <div className="stg-r stg-payment-method" key={method.id} data-method={method.id}>
            <div className="k"><b>{method.brand} <span className="num">{masked(method.last4)}</span></b><span>{method.isDefault ? t('default') + ', ' : ''}{method.expiryLabel}</span>{method.removalHint && <span id={`${id}-method-${index}`}>{method.removalHint}</span>}</div>
            <div className="a">{!method.isDefault && <button type="button" className="stg-b" disabled={!actions?.makeDefault} onClick={() => openPayment('default', manager.trigger, method)}>{t('makeDefault')}</button>}<button type="button" className="stg-b" disabled={!method.removable || !actions?.removeMethod} aria-describedby={method.removalHint ? `${id}-method-${index}` : undefined} onClick={() => openPayment('remove', manager.trigger, method)}>{t('remove')}</button></div>
          </div>)}</div>
          {methods && methods.length > 0 && (!actions?.makeDefault || !actions?.removeMethod) && <p className="hint">{copy.actionUnavailable[language]}</p>}
          <div className="bts"><button type="button" className="ok" onClick={() => openPayment('add', manager.trigger)}>{t('addTitle')}</button></div>
        </> : subscription?.state === 'active' && <>
          <div className="stg-card">
            <div className="stg-r"><div className="k"><b>{t('fee')}</b></div><div className="v num">{subscription.amountLabel}</div></div>
            <div className="stg-r"><div className="k"><span>{subscription.description}</span></div></div>
            <div className="stg-r"><div className="k"><b>{t('method')}</b><span>{methodSummary}</span></div></div>
          </div>
          <p id={`${id}-cancel-hint`} className="hint">{subscription.cancellation?.summary ?? copy.actionUnavailable[language]}</p>
          <div className="bts"><button type="button" className="dg" disabled={!subscription.cancellation} aria-describedby={`${id}-cancel-hint`} onClick={() => { if (subscription.cancellation) openSubscription('cancel', subscription.cancellation.confirmation, manager.trigger) }}>{t('cancel')}</button></div>
        </>}
      </div>
    </ClientSettingsModal>}
    {subscriptionAction && <SubscriptionAction {...subscriptionAction} actions={actions} onClose={() => setSubscriptionAction(null)} onAccepted={() => { setSubscriptionAction(null); setAccepted(true) }} />}
    {receipt && <Receipt {...receipt} onClose={() => setReceipt(null)} />}
    {payment && <PaymentAction {...payment} actions={actions} onClose={() => setPayment(null)} onAccepted={paymentDone} />}
  </div>
}
