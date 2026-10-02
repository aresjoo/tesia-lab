import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import copy from '../client-settings-copy.json'
import { nativeAccountText } from '../internal-poc/native-account-presentation-copy'
import { securityText } from '../client-settings-security-copy'
import { notificationMandatoryText } from '../client-settings-notifications-copy'
import { readClientNotificationPreferences, type ClientNotificationGroups, type ClientNotificationRequest, type ClientNotificationRow } from '../client-settings-notifications-presentation'
type Props = { groups?: ClientNotificationGroups; scopeId?: string | null; onRequest?: ClientNotificationRequest }
export function ClientSettingsNotifications(props: Props) {
  return <NotificationContent key={JSON.stringify([props.scopeId ?? null, props.groups ?? null])} {...props}/>
}
function NotificationContent({ groups, onRequest }: Props) {
  const { language } = useClientPreferences(), hint = useId()
  const s = (key: keyof typeof copy) => copy[key][language]
  const presentation = readClientNotificationPreferences(groups)
  const currentPort = useRef(onRequest), request = useRef<AbortController | null>(null)
  const [pending, setPending] = useState(false), [message, setMessage] = useState<'accepted' | 'failed' | null>(null)
  useLayoutEffect(() => {
    if (currentPort.current !== onRequest) { request.current?.abort(); request.current = null; setPending(false); setMessage(null) }
    currentPort.current = onRequest
    return () => { request.current?.abort(); request.current = null }
  }, [onRequest])
  const run = async (row: ClientNotificationRow) => {
    if (request.current || !onRequest || row.checked === null || row.disabled) return
    const controller = new AbortController(), port = onRequest
    request.current = controller; setPending(true); setMessage(null)
    try {
      await port(row.id, !row.checked, controller.signal)
      if (request.current === controller && !controller.signal.aborted && currentPort.current === port) setMessage('accepted')
    } catch {
      if (request.current === controller && !controller.signal.aborted && currentPort.current === port) setMessage('failed')
    } finally {
      if (request.current === controller) { request.current = null; setPending(false) }
    }
  }
  const labels = { fill: ['fill','fillHint'], state: ['strategyState','stateHint'], risk: ['risk','riskHint'], copy: ['copy','copyHint'], bill: ['bill','billHint'], news: ['news','newsHint'] } as const
  return <section className="stg-sec client-settings-notifications" aria-busy={pending} data-source-notification-valid={!presentation.invalid}>
    <div className="stg-card">{presentation.topics.map(({ topic, push, email }) => {
      const [label, description] = labels[topic], hintId = `${hint}-${topic}`
      return <div key={topic} className="stg-r" data-notification-topic={topic}><div className="k"><b>{s(label)}</b><span id={hintId}>{s(description)}</span></div><div className="a"><div className="stg-seg multi" role="group" aria-label={s(label)}>
        {(['push','email'] as const).map(channel => {
          const row = channel === 'push' ? push : email, known = row?.checked === true || row?.checked === false
          const locked = topic === 'bill' && channel === 'email' && row !== null
          const disabled = !known || !onRequest || !!row?.disabled || locked || pending
          const reason = locked ? notificationMandatoryText(language) : !known || !onRequest || row?.disabled ? s('actionUnavailable') : undefined
          return <button key={channel} type="button" data-notification-channel={channel} aria-pressed={known ? row!.checked! : undefined} aria-describedby={hintId} disabled={disabled} title={reason} onClick={() => { if (!disabled && row) void run(row) }}>{s(channel)}{!known && <span aria-label={s('actionUnavailable')}> —</span>}</button>
        })}
      </div></div></div>
    })}</div>
    {(!presentation.observed || presentation.invalid) && <p className="stg-empty">{s('actionUnavailable')}</p>}
    {message && <p className={message === 'failed' ? 'stg-warn' : 'stg-source'} role={message === 'failed' ? 'alert' : 'status'}>{message === 'accepted' ? nativeAccountText(language, 'accepted') : securityText(language, 'failed')}</p>}
  </section>
}
