import { useContext, useId, useLayoutEffect, useRef, useState } from 'react'
import { useConversationCopy } from '../client-conversation-copy'
import { useClientPreferences } from '../client-preferences'
import { marketQuestionText } from '../client-market-question-copy'
import { ClientQuestionDockContext } from '../client-question-dock'
import { ClientPersistentRegion } from './ClientPersistentRegion'
import '../client-market-question.css'
import '../client-clarification-card.css'

/** Source gcl presentation only. Choices, progress and permission to skip must
 * be supplied by the caller; this component never invents strategy values. */
export type ClientClarification = {
  title: string
  sub?: string
  freeHint?: string
  progress?: readonly [number, number]
  options: readonly { label: string; description?: string; value: string }[]
}

export function ClientClarificationCard({ question, dockKey, composer, disabled = false, onAnswer, onSkip }: {
  question: ClientClarification
  dockKey: string
  composer: { value: string; onChange: (value: string) => void; onSubmit: () => void }
  disabled?: boolean
  onAnswer: (value: string, label: string) => void
  onSkip?: () => void
}) {
  const id = useId()
  const { c } = useConversationCopy()
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof marketQuestionText>[1]) => marketQuestionText(language, key)
  const dock = useContext(ClientQuestionDockContext)
  const active = !dock || dock.activeKey === dockKey
  const [closed, setClosed] = useState(false), [direct, setDirect] = useState(false)
  const input = useRef<HTMLInputElement>(null), restoreFocus = useRef(false)
  useLayoutEffect(() => {
    if (!active) return
    if (closed && restoreFocus.current) {
      restoreFocus.current = false
      const target = dock?.target?.parentElement?.querySelector<HTMLTextAreaElement>('.g-composer textarea')
      if (target?.getClientRects().length && !target.closest('[hidden],[inert]')) target.focus({ preventScroll: true })
    } else if (direct && !closed) input.current?.focus({ preventScroll: true })
  }, [active, closed, direct, dock?.target])
  // The existing controlled draft owns direct input. No local "accepted"
  // flag is inferred from Promise<void>; the next server snapshot owns it.
  if (closed) return null
  const panel = <section className="gclw gcl g-askcard ska client-market-question" aria-labelledby={`${id}-title`}>
      <div className="hd">
        <h3 className="t" id={`${id}-title`}>{question.title}</h3>
        <div className="ask-controls">
          {question.progress && <span className="pg num">{marketQuestionText(language, 'page', { current: question.progress[0], total: question.progress[1] })}</span>}
          <button type="button" className="x" aria-label={t('close')} onClick={() => { restoreFocus.current = true; setClosed(true) }}>×</button>
        </div>
      </div>
      {question.sub && <p className="client-clarification-sub">{question.sub}</p>}
      <div className="ops gcl-options">{question.options.map((option, index) => <button type="button" className="op" key={`${index}:${option.value}`} disabled={disabled || !active}
        aria-labelledby={`${id}-option-${index}`} aria-describedby={option.description ? `${id}-description-${index}` : undefined}
        onKeyDown={event => { if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault() }}
        onClick={() => onAnswer(option.value, option.label)}>
        <b id={`${id}-option-${index}`}>{option.label}</b>
        {option.description && <span id={`${id}-description-${index}`}>{option.description}</span>}
      </button>)}
        {direct ? <div className="op free"><input ref={input} type="text" aria-label={t('direct')} placeholder={question.freeHint || t('freePlaceholder')} maxLength={1000}
          value={composer.value} disabled={disabled || !active} onChange={event => composer.onChange(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); if (!event.repeat && composer.value.trim()) composer.onSubmit() } }} />
          <button type="button" className="send" disabled={disabled || !active || !composer.value.trim()} onClick={composer.onSubmit}>{t('confirm')}</button></div>
          : <button type="button" className="op direct-trigger" disabled={disabled || !active} onClick={() => setDirect(true)}><b>{t('direct')}</b></button>}
      </div>
      {onSkip && <div className="ft"><button type="button" className="skipb" disabled={disabled || !active} onClick={onSkip}>{c('clarificationSkip')}</button></div>}
    </section>
  if (!dock) return panel
  return <><p className="ska-note">{t(active ? 'singleDockNote' : 'previousNote')}</p>{active && dock.target && <ClientPersistentRegion target={dock.target} className="client-question-panel" contents>{panel}</ClientPersistentRegion>}</>
}
