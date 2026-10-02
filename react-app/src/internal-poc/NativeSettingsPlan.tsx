import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { NativeAccountPresentation } from './native-account-presentation'
import { accountLocationAvailable } from './native-account-presentation'
import { readClientAccountLocation, type ClientAccountLocation } from '../client-account-navigation'
import { useClientPreferences } from '../client-preferences'
import { nativeAccountText } from './native-account-presentation-copy'
import type { AccountPlanPresentation, AccountViewAction, AccountViewRow } from '../client-account-presentation'
import { ClientAccountIcon } from '../components/ClientAccountIcon'
import { ClientSettingsNotifications } from '../components/ClientSettingsNotifications'
import { readClientNotificationPreferences } from '../client-settings-notifications-presentation'

function Badge({ text, tone }: { text?: string; tone?: string }) {
  return text ? <span className="stg-badge" data-tone={tone}>{text}</span> : null
}

/** Preserves existing supplied plan facts and callbacks in the new settings
 * rows. The host has already checked scope; key by owner+dataset identity.
 * This is not the new invoice/card/2FA transport contract. */
export function NativeSettingsPlan({ data, tab, onNavigate, onTrading }: {
  data: NativeAccountPresentation
  tab: 'billing' | 'notify'
  onNavigate: (location: ClientAccountLocation) => void
  onTrading?: () => void
}) {
  const { language } = useClientPreferences()
  const hintPrefix = useId()
  const [pending, setPending] = useState<string | null>(null)
  const [message, setMessage] = useState<'failed' | 'accepted' | null>(null)
  const live = useRef(false), busy = useRef(false), current = useRef(data)
  useLayoutEffect(() => { current.current = data }, [data])
  useLayoutEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const run = async (id: string, action: (() => Promise<void>) | undefined) => {
    if (!action || busy.current || !live.current) return
    busy.current = true; setPending(id); setMessage(null)
    const request = data
    try { await action(); if (live.current && current.current === request) setMessage('accepted') }
    catch { if (live.current && current.current === request) setMessage('failed') }
    finally { busy.current = false; if (live.current) setPending(null) }
  }
  const routeAvailable = (route: string) => {
    const target = readClientAccountLocation(route)
    return route === '#/trade' ? !!onTrading : !!target && accountLocationAvailable(data, target)
  }
  const navigate = (route: string) => {
    if (!live.current || current.current !== data || busy.current || !routeAvailable(route)) return
    if (route === '#/trade') { onTrading?.(); return }
    const target = readClientAccountLocation(route)
    if (target) onNavigate(target)
  }
  const action = (item: AccountViewAction) => {
    const available = item.route ? routeAvailable(item.route) : !!data.actions?.onPlanAction
    return <button key={item.id} type="button" className={`stg-b${item.tone === 'pri' ? ' p' : item.tone === 'dng' ? ' dg' : ''}`} disabled={!available || pending !== null} onClick={() => {
      if (item.route) navigate(item.route)
      else void run(item.id, data.actions?.onPlanAction ? () => data.actions!.onPlanAction!(item.id) : undefined)
    }}>{item.label}</button>
  }
  const detail = (row: AccountViewRow) => {
    const content = <><span className="stg-row-label">{row.icon && <ClientAccountIcon name={row.icon} />}<span className="k"><b>{row.label}</b>{row.description && <span>{row.description}</span>}</span></span><span className="v" data-tone={row.tone}>{row.value}</span>{row.route && <svg className="stg-detail-arrow" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m9 18 6-6-6-6" /></svg>}</>
    return row.route ? <button key={row.id} type="button" className="stg-r stg-detail-link" disabled={!routeAvailable(row.route) || pending !== null} onClick={() => navigate(row.route!)}>{content}</button> : <div key={row.id} className="stg-r">{content}</div>
  }
  const plan = data.plan
  const supplied = plan?.presentation
  const groups: AccountPlanPresentation['preferences'] = supplied ? supplied.preferences : plan?.preferences ? [{ id: 'supplied', title: plan.title, rows: plan.preferences }] : null
  const notifications = readClientNotificationPreferences(groups)
  const notificationGroups = notifications.legacyGroups
  const sections = plan?.sections[tab === 'billing' ? 'plan' : 'alerts']
  const missing = <p className="stg-empty">{nativeAccountText(language, 'unavailable')}</p>
  const gauge = supplied?.status?.gauge
  return <div className="native-settings-plan" aria-busy={pending !== null}>
    <p className="stg-source" data-plan-source><ClientAccountIcon name="doc" /><span>{supplied?.sourceLabel ?? plan?.sourceLabel ?? data.sourceLabel}</span></p>
    {tab === 'notify' && <ClientSettingsNotifications groups={groups} scopeId={data.identity} onRequest={data.actions?.onPreference} />}
    {tab === 'billing' ? supplied?.status ? <section className="stg-sec"><header><h2>{supplied.status.hero.title}</h2><Badge text={supplied.status.hero.badge} tone={supplied.status.badgeTone} /></header><div className="stg-card">
      <div className="stg-r"><div className="k"><b>{supplied.status.hero.label}</b>{supplied.status.hero.description && <span>{supplied.status.hero.description}</span>}</div><div className="v" data-tone={supplied.status.hero.tone}>{supplied.status.hero.value} {supplied.status.hero.unit}</div></div>
      {gauge && <div className="stg-supplied-gauge" data-style={gauge.style}><span>{gauge.left}</span><span>{gauge.right}</span>{Number.isFinite(gauge.percent) && gauge.percent >= 0 && gauge.percent <= 100 ? <progress aria-label={supplied.status.hero.label} max={100} value={gauge.percent} /> : <span>{nativeAccountText(language, 'unavailable')}</span>}</div>}
      {supplied.status.details === null ? missing : supplied.status.details.map(detail)}
      {supplied.status.actions.length > 0 && <div className="stg-storage">{supplied.status.actions.map(action)}</div>}
      {supplied.status.footer && <p className="stg-empty">{supplied.status.footer}</p>}
    </div></section> : missing : groups ? notificationGroups.length ? notificationGroups.map((group, groupIndex) => <section key={group.id} className="stg-sec"><header><h2>{group.title}</h2><Badge text={group.badge} /></header><div className="stg-card">
      {group.rows.length === 0 && <p className="stg-empty">{nativeAccountText(language, 'empty')}</p>}
      {group.rows.map((row, rowIndex) => {
        const hint = `${hintPrefix}-${groupIndex}-${rowIndex}`
        return <div className="stg-r stg-preference" key={row.id}><div className="stg-row-label">{row.icon && <ClientAccountIcon name={row.icon} />}<div className="k"><b>{row.label}</b>{row.description && <span id={hint}>{row.description}</span>}</div></div><div className="a">
          <Badge text={row.badge} />
          {row.checked === null ? <span className="stg-unknown">{nativeAccountText(language, 'unavailable')}</span> : <button type="button" className="stg-supplied-switch" data-tone={row.switchTone} role="switch" aria-label={row.label} aria-describedby={row.description ? hint : undefined} aria-checked={row.checked} disabled={row.disabled || !data.actions?.onPreference || pending !== null} onClick={() => { if (!row.disabled) void run(row.id, data.actions?.onPreference ? () => data.actions!.onPreference!(row.id, !row.checked) : undefined) }}><i /></button>}
        </div></div>
      })}
      {group.footer && <p className="stg-empty">{group.footer}</p>}
    </div></section>) : notifications.observed ? null : <p className="stg-empty">{nativeAccountText(language, 'empty')}</p> : missing}
    {sections?.map(section => <section className="stg-sec" key={section.id}><header><h2>{section.title}</h2></header><div className="stg-card">
      {section.text && <p className="stg-empty">{section.text}</p>}
      {section.fields?.map((field, index) => <div key={index} className="stg-r"><div className="k"><b>{field.label}</b></div><div className="v" data-tone={field.tone === 'up' ? 'gain' : field.tone === 'dn' ? 'loss' : undefined}>{field.value}</div></div>)}
    </div></section>)}
    <div className="stg-supplied-links">{plan?.links?.map((link, index) => <button type="button" key={index} className="stg-b" disabled={pending !== null || !accountLocationAvailable(data, link.target)} onClick={() => { if (live.current && current.current === data && !busy.current && accountLocationAvailable(data, link.target)) onNavigate(link.target) }}>{link.label}</button>)}</div>
    {pending !== null && <p className="stg-storage" role="status">{nativeAccountText(language, 'pending')}</p>}
    {message && <p className="stg-storage" role={message === 'failed' ? 'alert' : 'status'}>{nativeAccountText(language, message)}</p>}
  </div>
}
