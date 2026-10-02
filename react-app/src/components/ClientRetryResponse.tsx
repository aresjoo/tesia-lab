import { useLayoutEffect, useRef, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { marketBindingKey, type MarketResponseBinding } from '../client-market-response-presentation'
import type { RetryResponseAction } from '../client-response-retry'
import { responseRetryText } from '../client-response-retry-copy'
import { followupText } from '../client-followup-copy'
import '../client-response-retry.css'

type Props = {
  binding: MarketResponseBinding
  question: string
  kind: 'stopped' | 'failed'
  busy?: boolean
  onRetry?: RetryResponseAction
}

/** Preserve the original retry surface without inventing an AI response.
 * The host decides when a failed/empty stopped response is eligible. */
export function ClientRetryResponse(props: Props) {
  const binding = marketBindingKey(props.binding)
  if (!binding || !props.question.trim()) return null
  // Locale and ordinary callback-wrapper allocations do not restart a request.
  return <RetryResponse key={JSON.stringify([binding, props.question, props.kind])} {...props}/>
}

function RetryResponse({ binding, question, kind, busy, onRetry }: Props) {
  const { language } = useClientPreferences()
  const [pending, setPending] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [notice, setNotice] = useState<'failed' | 'unavailable' | null>(null)
  const flight = useRef<AbortController | null>(null)
  const consumed = useRef(false)
  const hasPort = typeof onRetry === 'function'

  useLayoutEffect(() => () => {
    flight.current?.abort()
    flight.current = null
  }, [])
  useLayoutEffect(() => {
    // A disconnected port invalidates its pending ACK before the next paint.
    if (!hasPort && flight.current) {
      flight.current.abort()
      flight.current = null
      setPending(false)
      setNotice('unavailable')
    }
  }, [hasPort])

  async function retry() {
    if (flight.current || consumed.current || busy || !onRetry) return
    const controller = new AbortController()
    flight.current = controller
    setPending(true)
    setNotice(null)
    try {
      const result = await onRetry({ binding: { ...binding }, question }, controller.signal)
      if (controller.signal.aborted || flight.current !== controller) return
      if (result === true) { consumed.current = true; setAccepted(true) }
      else setNotice('failed')
    } catch {
      if (!controller.signal.aborted && flight.current === controller) setNotice('failed')
    } finally {
      if (!controller.signal.aborted && flight.current === controller) {
        flight.current = null
        setPending(false)
      }
    }
  }

  if (accepted) return null
  const status = pending ? 'pending' : !hasPort ? 'unavailable' : notice
  const disabled = pending || Boolean(busy) || !hasPort
  const message = <p className="response-retry-notice" role="status" aria-live="polite">{status ? followupText(language, status) : ''}</p>
  return kind === 'stopped'
    ? <div className="g-nextcol client-response-retry" aria-busy={pending}>
      <button className="g-nextq" type="button" disabled={disabled} onClick={() => void retry()}>
        <span>{responseRetryText(language, 'regenerate')}</span><span className="ar" aria-hidden="true">→</span>
      </button>
      {message}
    </div>
    : <div className="g-errcard client-response-retry" aria-busy={pending}>
      <b>{responseRetryText(language, 'title')}</b>
      <div className="d">{responseRetryText(language, 'detail')}</div>
      <button className="rt" type="button" disabled={disabled} onClick={() => void retry()}>{responseRetryText(language, 'retry')}</button>
      {message}
    </div>
}
