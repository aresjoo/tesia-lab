import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { readSourceIntake, sourceIntakeCounts, sourceIntakeDefaults, sourceIntakeKeys, sourceIntakePreview, type SourceIntake, type SourceIntakeKey } from '../client-source-intake'
import { sourceIntakeOption, sourceIntakeQuestion, sourceIntakeRows, sourceIntakeText, type SourceIntakeCopyKey } from '../client-source-intake-copy'
import '../client-source-intake.css'

/** Original tfq + compact answered rows. Local choices, not an AI execution trace. */
export default function ClientSourceIntake({ turnId, value, active, onPick, onRestart }: {
  turnId: string; value: SourceIntake; active: boolean
  onPick: (key: SourceIntakeKey, index: number, recommended: boolean) => boolean
  onRestart: () => void
}) {
  const { language } = useClientPreferences()
  const id = useId(), question = useRef<HTMLHeadingElement>(null)
  const root = useRef<HTMLElement>(null)
  const focusNext = useRef(false)
  const [failed, setFailed] = useState(false)
  const intake = readSourceIntake(value), count = intake?.answers.length ?? 0
  const t = (key: SourceIntakeCopyKey) => sourceIntakeText(language, key)
  useLayoutEffect(() => {
    if (!focusNext.current) return
    focusNext.current = false
    const target = question.current ?? root.current?.nextElementSibling?.querySelector<HTMLElement>('h3')
    target?.focus({ preventScroll: true })
    // The conversation owns the reveal and marks its own scroll event. A
    // second scrollIntoView here can move the outer page and reattach following.
  }, [count])
  if (!intake) return null
  const key = sourceIntakeKeys[count]
  const choose = (index: number, recommended = false) => {
    if (!active || !key) return
    try {
      const accepted = onPick(key, index, recommended)
      setFailed(!accepted)
      focusNext.current = accepted
    } catch { setFailed(true) }
  }
  return <section ref={root} className="client-source-intake" data-testid="source-intake" data-turn-id={turnId} data-answer-count={count} aria-label={t('summary')}>
    <p className="intake-hello">{t('hello')}</p>
    <p className="intake-preview">{t('preview')}</p>
    <ol className="intake-done">{intake.answers.map(answer => <li key={answer.key}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 12.2l2.4 2.4 4.6-5" /></svg>
      <span>{t(sourceIntakeQuestion(answer.key))}</span><strong>{t(sourceIntakeOption(answer.key, answer.index))}{answer.recommended && <small> ({t('recommended')})</small>}</strong>
    </li>)}</ol>
    {key ? <div className="intake-question" role="group" aria-labelledby={id} aria-describedby={`${id}-hint`}>
      <div className="intake-title"><h3 id={id} ref={question} tabIndex={-1}>{t(sourceIntakeQuestion(key))}</h3><span aria-hidden="true">{count + 1}/5</span></div>
      <p id={`${id}-hint`}>{t(`${key}Hint` as SourceIntakeCopyKey)}</p>
      <div className="intake-options">{Array.from({ length: sourceIntakeCounts[count] }, (_, index) => <button key={`${key}-${index}`} type="button" disabled={!active} title={t(`${key}${index}Hint` as SourceIntakeCopyKey)} onClick={() => choose(index)}>{t(sourceIntakeOption(key, index))}</button>)}
        <button className="is-recommended" type="button" disabled={!active} onClick={() => choose(sourceIntakeDefaults[count], true)}>{t('recommend')}</button>
      </div>
    </div> : !sourceIntakePreview(intake) ? <div className="intake-unavailable">
      <h3 ref={question} tabIndex={-1}>{t('summary')}</h3>
      <dl>{sourceIntakeRows(intake, language).map(([label, answer]) => <div key={label}><dt>{label}</dt><dd>{answer}</dd></div>)}</dl>
      <p>{t('unavailable')}</p><button type="button" disabled={!active} onClick={onRestart}>{t('revise')}</button>
    </div> : null}
    {failed && <p className="intake-error" role="status">{t('failed')}</p>}
  </section>
}
