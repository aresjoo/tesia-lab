import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Check, Copy, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { useConversationCopy } from '../client-conversation-copy'
import { useClientPreferences } from '../client-preferences'
import { answerFeedbackReasons, answerFeedbackText, type AnswerFeedbackKey } from '../client-answer-feedback-copy'
import { feedbackText } from '../client-feedback-copy'
import '../client-answer-actions.css'

/** Source taiActs/taiFeedback presentation. Votes are local selection only.
 * No feedback producer is connected: never claim a submitted receipt or write
 * an opinion into strategy messages, storage, or an invented API endpoint. */
export function ClientAnswerActions({ text, contentIdentity }: { text: string; contentIdentity?: string }) {
  const { c, language } = useConversationCopy()
  const { t } = useClientPreferences()
  const f = (key: AnswerFeedbackKey) => answerFeedbackText(language, key)
  const id = useId()
  // Native observations may translate their app-owned text without becoming
  // another answer. A stable observed identity preserves an unfinished opinion.
  const identity = contentIdentity ?? text
  const [content, setContent] = useState(identity)
  const [vote, setVote] = useState<'up' | 'down' | null>(null)
  const [card, setCard] = useState<'closed' | 'reasons' | 'other'>('closed')
  const [reason, setReason] = useState<AnswerFeedbackKey | null>(null)
  const [other, setOther] = useState('')
  const [notice, setNotice] = useState<'required' | 'unavailable' | null>(null)
  const [copyStatus, setCopyStatus] = useState<'copied' | 'failed' | null>(null)
  const [copiedContent, setCopiedContent] = useState(text)
  if (copiedContent !== text) { setCopiedContent(text); setCopyStatus(null) }
  if (content !== identity) {
    setContent(identity); setVote(null); setCard('closed'); setReason(null); setOther(''); setNotice(null); setCopyStatus(null)
  }
  const down = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const unavailableNotice = useRef<HTMLParagraphElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const life = useRef({ generation: 0, attempt: 0 })
  useEffect(() => {
    const current = life.current; current.generation++
    return () => { current.generation++; if (timer.current) clearTimeout(timer.current); timer.current = null }
  }, [text, identity])
  useLayoutEffect(() => {
    // Only an explicit open/mode switch reveals the card. Locale changes and
    // ordinary answer updates must not hijack the reader's scroll position.
    if (card === 'closed') return
    panel.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    if (card === 'other') input.current?.focus()
    else panel.current?.querySelector<HTMLButtonElement>('.fbp button')?.focus()
  }, [card])
  const close = () => { setCard('closed'); down.current?.focus() }
  const copy = async () => {
    if (!text) return
    const current = life.current, generation = current.generation, attempt = ++current.attempt
    if (timer.current) clearTimeout(timer.current)
    setCopyStatus(null)
    try {
      await navigator.clipboard.writeText(text)
      if (current.generation !== generation || current.attempt !== attempt) return
      setCopyStatus('copied')
      timer.current = setTimeout(() => { setCopyStatus(null); timer.current = null }, 1500)
    } catch {
      if (current.generation === generation && current.attempt === attempt) setCopyStatus('failed')
    }
  }
  return <div className="client-answer-block">
    <div className="client-answer-actions g-acts">
      <button type="button" aria-label={c('goodAnswer')} aria-pressed={vote === 'up'} onClick={() => { setVote(vote === 'up' ? null : 'up'); setCard('closed') }}><ThumbsUp size={15} aria-hidden="true" /></button>
      <button ref={down} type="button" aria-label={c('poorAnswer')} aria-pressed={vote === 'down'} aria-expanded={card !== 'closed'} aria-controls={card !== 'closed' ? id : undefined} onClick={() => { setVote(card === 'closed' ? 'down' : null); setNotice(null); setCard(card === 'closed' ? 'reasons' : 'closed') }}><ThumbsDown size={15} aria-hidden="true" /></button>
      <button type="button" disabled={!text} aria-label={c(copyStatus === 'copied' ? 'copiedAnswer' : 'copyAnswer')} onClick={() => { void copy() }}>{copyStatus === 'copied' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}</button>
      <span className={copyStatus === 'failed' ? 'answer-copy-error' : 'answer-copy-status'} role="status">{copyStatus === 'failed' ? c('copyError') : copyStatus === 'copied' ? c('copiedAnswer') : ''}</span>
    </div>
    {vote && card === 'closed' && <p className="answer-vote-status" role="status">{feedbackText(language, 'unavailable')}</p>}
    {card !== 'closed' && <section ref={panel} id={id} className="g-askcard client-answer-feedback" aria-labelledby={`${id}-title`} onKeyDown={event => {
      if (event.key === 'Escape' && !event.defaultPrevented && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); event.stopPropagation(); close() }
    }}>
      <div className="hd"><h3 className="t" id={`${id}-title`}>{f('title')}</h3><button className="x" type="button" aria-label={t('common.close')} onClick={close}><X size={17} aria-hidden="true" /></button></div>
      <p className="answer-feedback-help">{f('help')}</p>
      {card === 'reasons' ? <div className="fbp">{answerFeedbackReasons.map(key => <button type="button" className="pill" key={key} aria-pressed={reason === key} onClick={() => { setReason(key); setNotice('unavailable') }}>{f(key)}</button>)}
        <button type="button" className="pill" onClick={() => { setReason('other'); setNotice(null); setCard('other') }}>{f('other')}</button>
      </div> : <form className="fbp other" onSubmit={event => { event.preventDefault(); if (!other.trim()) { setNotice('required'); input.current?.focus() } else { setNotice('unavailable'); unavailableNotice.current?.focus() } }}>
        <textarea ref={input} className="fbt" rows={3} maxLength={10000} aria-label={f('placeholder')} placeholder={f('placeholder')} value={other} onChange={event => { setOther(event.target.value); setNotice(null) }} aria-invalid={notice === 'required'} aria-describedby={notice ? `${id}-notice` : undefined} />
        <button className="pill" type="submit">{f('submit')}</button>
      </form>}
      {notice === 'required' && <p id={`${id}-notice`} className="answer-feedback-notice" role="alert">{t('fb.req')}</p>}
      <p ref={unavailableNotice} tabIndex={-1} id={notice === 'unavailable' ? `${id}-notice` : undefined} className="answer-feedback-notice" role="status">{feedbackText(language, 'unavailable')}</p>
    </section>}
  </div>
}
