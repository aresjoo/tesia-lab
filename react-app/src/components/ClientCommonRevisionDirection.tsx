import { useEffect, useMemo, useRef, useState } from 'react'
import { commonRevisionDirectionQuestion, type CommonRevisionDirection } from '../client-common-revision-direction'
import { useClientPreferences } from '../client-preferences'
import { marketQuestionText } from '../client-market-question-copy'
import { ClientClarificationCard } from './ClientClarificationCard'

type DirectionProps = {
  direction: CommonRevisionDirection
  active: boolean
  onAnswer: (text: string) => boolean | null | Promise<boolean | null>
}
export function ClientCommonRevisionDirection(props: DirectionProps) {
  return <DirectionPanel key={JSON.stringify(props.direction)} {...props} />
}
function DirectionPanel({ direction, active, onAnswer }: DirectionProps) {
  const { language } = useClientPreferences()
  const question = useMemo(() => commonRevisionDirectionQuestion(direction, language), [direction, language])
  const [draft, setDraft] = useState(''), [sending, setSending] = useState(false), [error, setError] = useState(false)
  const mounted = useRef(true), inFlight = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const submit = async (text: string) => {
    if (!active || inFlight.current || !text.trim()) return
    inFlight.current = true; setSending(true); setError(false)
    try {
      const accepted = await onAnswer(text)
      if (mounted.current) {
        if (accepted !== true) setError(true)
        else setDraft('')
      }
    } catch { if (mounted.current) setError(true) }
    finally { if (mounted.current) { inFlight.current = false; setSending(false) } }
  }
  return <div data-testid="common-revision-direction" data-owner={direction.owner === null ? 'anonymous' : 'account'}>
    <ClientClarificationCard question={{ title: question.title, options: question.options,
      sub: '방향 선택은 비교할 값을 정하는 Mock 예시입니다.' }}
      dockKey={`common-revision-direction:${direction.base.turnId}:${direction.base.startedAt}`}
      disabled={!active || sending} composer={{ value: draft, onChange: setDraft, onSubmit: () => { void submit(draft) } }}
      onAnswer={text => { void submit(text) }} />
    <button className="rv-secondary" type="button" disabled={!active || sending} onClick={() => { void submit('Mock 예시로 비교하기') }}>Mock 예시로 비교하기</button>
    {sending && <p role="status">{marketQuestionText(language, 'pending')}</p>}
    {error && <p className="rv-note" role="alert">{marketQuestionText(language, 'failed')}</p>}
  </div>
}
