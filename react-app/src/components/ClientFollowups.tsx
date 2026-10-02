import { useEffect, useRef, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { marketBindingKey } from '../client-market-response-presentation'
import type { FollowupAction, FollowupActions, FollowupPresentation, FollowupSelection } from '../client-followup-presentation'
import { followupText } from '../client-followup-copy'
import '../client-followups.css'

type Props = { presentation: FollowupPresentation; actions?: FollowupActions; questionLabels?: Readonly<Record<string, string>> }
const types = new Set(['alert', 'backtest', 'delegate_trade', 'auto_trade'])

/** Source TAI_ACT_IC, preserved paths rather than a new icon vocabulary. */
function ActionIcon({ type }: { type: FollowupAction['type'] }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'alert' ? <><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></>
      : type === 'backtest' ? <path d="M3 20h18M6 16l4-6 3 3 5-8"/>
        : type === 'delegate_trade' ? <><path d="M4 12h10M10 6l6 6-6 6"/><path d="M20 5v14"/></>
          : <path d="M13 2 4 14h6l-1 8 9-12h-6z"/>}
  </svg>
}

export function ClientFollowups({ presentation, actions, questionLabels }: Props) {
  const binding = marketBindingKey(presentation.binding)
  const primary = presentation.actions.filter(item => item.id && item.label.trim() && types.has(item.type)).slice(0, 2)
  const questions = presentation.questions.filter(item => item.id && item.label.trim() && item.text.trim()).slice(0, 3)
  if (!binding || (!primary.length && !questions.length) || new Set(primary.map(item => item.id)).size !== primary.length || new Set(questions.map(item => item.id)).size !== questions.length) return null
  // A changed payload cannot reuse pending acceptance from the previous list.
  const identity = JSON.stringify([binding, primary.map(({ id, type, label }) => [id, type, label]), questions])
  return <Followups key={identity} presentation={{ ...presentation, actions: primary, questions }} actions={actions} questionLabels={questionLabels}/>
}

function Followups({ presentation, actions, questionLabels }: Props) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof followupText>[1]) => followupText(language, key)
  const [notice, setNotice] = useState<Parameters<typeof followupText>[1] | null>(null)
  const [pending, setPending] = useState(false)
  const [closed, setClosed] = useState(false)
  const [saved, setSaved] = useState<readonly string[]>([])
  const flight = useRef<AbortController | null>(null)
  const hasPort = Boolean(actions?.activate)
  useEffect(() => () => { flight.current?.abort(); flight.current = null }, [])
  useEffect(() => {
    if (!hasPort && flight.current) {
      flight.current.abort(); flight.current = null; setPending(false); setNotice('unavailable')
    }
  }, [hasPort])
  async function activate(selection: FollowupSelection) {
    if (flight.current || closed) return
    if (actions?.busy) { setNotice('busy'); return }
    if (!actions?.activate) { setNotice('unavailable'); return }
    const controller = new AbortController()
    flight.current = controller; setPending(true); setNotice(null)
    try {
      const accepted = await actions.activate(structuredClone(selection), controller.signal)
      if (controller.signal.aborted) return
      if (accepted !== true) { setNotice('failed'); return }
      if (selection.kind === 'action' && selection.item.type === 'alert') setSaved(current => [...current, selection.item.id])
      else setClosed(true)
    } catch { if (!controller.signal.aborted) setNotice('failed') }
    finally { if (!controller.signal.aborted) { flight.current = null; setPending(false) } }
  }
  if (closed) return null
  return <section className="g-nextcol client-followups" aria-label={t('title')} aria-busy={pending} data-restored={presentation.restored || undefined}>
    {presentation.actions.map(item => {
      const stored = item.type === 'alert' && (item.saved || saved.includes(item.id))
      return <button key={item.id} type="button" className="g-acbtn" disabled={pending || actions?.busy || stored} onClick={() => void activate({ binding: presentation.binding, kind: 'action', item })}>
        <span className="lf"><ActionIcon type={item.type}/><span className="tx">{stored ? t('saved') : item.label}</span></span>
        <span className="rt">{presentation.showFreeBadge && <span className="bdg">{t('free')}</span>}<span className="ar" aria-hidden="true">→</span></span>
      </button>
    })}
    {presentation.questions.map(item => <button key={item.id} className="g-nextq" type="button" disabled={pending || actions?.busy} onClick={() => void activate({ binding: presentation.binding, kind: 'question', item })}><span>{questionLabels?.[item.id] ?? item.label}</span><span className="ar" aria-hidden="true">→</span></button>)}
    {presentation.actions.length > 0 && <p className="g-actnote">{t('note')}</p>}
    <p className="followup-notice" role="status" aria-live="polite">{pending ? t('pending') : notice ? t(notice) : ''}</p>
  </section>
}
