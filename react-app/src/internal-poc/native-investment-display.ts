import type { ClientResponseBlock } from '../components/ClientResponseSequence'
import { marketBindingKey } from '../client-market-response-presentation'
import type { MarketQuestionAnswer, MarketQuestionPresentation } from '../client-market-question-presentation'
import { readInvestmentDisplay, validInvestmentDisplay } from './investment-ui-contract.mjs'

export type NativeInvestmentDisplayState = 'STREAMING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'AMBIGUOUS'

export type NativeInvestmentDisplayProjection = Readonly<{
  text: string
  blocks: readonly ClientResponseBlock[]
  titleSuggestion: Readonly<{ messageId: string; value: string }> | null
  valid: boolean
}>

type Display = Readonly<{ name: 'CHART' | 'ASK' | 'NEXT' | 'TITLE'; value: unknown }>
type AskValue = { steps: [{ title: string; multi: false; options: { t: string; d: string }[] }] }

const DISPLAY_NAMES = ['CHART', 'ASK', 'NEXT', 'TITLE'] as const
const ASK_SKIP_TEXT = '지금은 이 질문을 건너뛰겠습니다. 확인된 정보로 설명 가능한 부분만 이어서 알려주세요. 미확인 조건을 임의로 정하거나 실행하지 마세요.'

function partialDisplaySuffix(text: string) {
  const start = text.lastIndexOf('[')
  if (start < 0) return -1
  const suffix = text.slice(start).toUpperCase()
  return DISPLAY_NAMES.some(name => (`[${name}`).startsWith(suffix))
    || /^\[(?:CHART|ASK|NEXT|TITLE)\s*$/i.test(suffix) ? start : -1
}

function scan(text: string, allowTitle: boolean) {
  const displays: Display[] = []
  let at = 0, body = '', complete = true, valid = true
  while (at < text.length) {
    const rest = text.slice(at)
    const display = readInvestmentDisplay(rest)
    if (!display) {
      const partial = partialDisplaySuffix(rest)
      if (partial >= 0) {
        body += rest.slice(0, partial)
        complete = false
      } else body += rest
      break
    }
    body += rest.slice(0, display.start)
    if ('invalid' in display || 'incomplete' in display) {
      complete = false
      valid = !('invalid' in display)
      break
    }
    const name = display.name.toUpperCase()
    if (!DISPLAY_NAMES.includes(name as typeof DISPLAY_NAMES[number])
      || !validInvestmentDisplay(name, display.value, { allowTitle })) valid = false
    else displays.push({ name: name as Display['name'], value: display.value })
    at += display.end
  }
  const names = displays.map(display => display.name)
  if (new Set(names).size !== names.length || names.includes('ASK') && names.includes('NEXT')) valid = false
  return { text: body.trim(), displays, complete, valid }
}

function textBlock(messageId: string, text: string, state: NativeInvestmentDisplayState): ClientResponseBlock[] {
  if (!text) return []
  return [{ id: `${messageId}_text`, kind: 'text', text, status: state === 'STREAMING' ? 'streaming' : state === 'COMPLETED' ? 'done' : 'interrupted' }]
}

export function projectNativeInvestmentDisplay({ text, state, scopeId, messageId, allowTitle }: Readonly<{
  text: string
  state: NativeInvestmentDisplayState
  scopeId: string
  messageId: string
  allowTitle: boolean
}>): NativeInvestmentDisplayProjection {
  const parsed = scan(text, allowTitle)
  const blocks = textBlock(messageId, parsed.text, state)
  if (state !== 'COMPLETED' || !parsed.complete || !parsed.valid) {
    return { text: parsed.text, blocks: state === 'COMPLETED'
      ? textBlock(messageId, parsed.text, 'FAILED') : blocks, titleSuggestion: null, valid: state !== 'COMPLETED' || parsed.complete && parsed.valid }
  }

  const ask = parsed.displays.find(display => display.name === 'ASK')
  const next = parsed.displays.find(display => display.name === 'NEXT')
  const title = parsed.displays.find(display => display.name === 'TITLE')
  if (ask) {
    const value = ask.value as AskValue
    const observationId = `${messageId}:display:ASK:0`
    blocks.push({
      id: observationId,
      kind: 'market-question',
      presentation: {
        binding: { scopeId, messageId, observationId },
        steps: value.steps.map((step, stepIndex) => ({
          id: `${observationId}:step:${stepIndex}`,
          title: step.title,
          multi: false,
          options: step.options.map((option, optionIndex) => ({
            id: `${observationId}:option:${optionIndex}`,
            label: option.t,
            description: option.d,
          })),
        })),
      },
    })
  } else if (next) {
    const observationId = `${messageId}:display:NEXT:0`
    blocks.push({
      id: observationId,
      kind: 'followups',
      presentation: {
        binding: { scopeId, messageId, observationId },
        actions: [],
        questions: (next.value as string[]).map((question, index) => ({
          id: `${observationId}:question:${index}`,
          label: question,
          text: question,
        })),
        showFreeBadge: false,
      },
    })
  }
  return {
    text: parsed.text,
    blocks,
    titleSuggestion: title ? { messageId, value: title.value as string } : null,
    valid: true,
  }
}

/** Rebuild the original ares ASK submission from the validated presentation.
 * The caller sends only this ordinary user text; IDs and tags are not wire data. */
export function nativeInvestmentQuestionUserText(presentation: MarketQuestionPresentation, answer: MarketQuestionAnswer) {
  if (marketBindingKey(answer.binding) !== marketBindingKey(presentation.binding)) return null
  if (answer.mode === 'delegate') return answer.rows.length === 0 ? ASK_SKIP_TEXT : null
  if (presentation.steps.length !== 1 || answer.rows.length !== 1) return null
  const step = presentation.steps[0], row = answer.rows[0]
  if (row.stepId !== step.id) return null
  let value: string
  if (row.directText !== undefined) {
    value = row.directText.trim()
    if (!value || row.optionIds.length !== 0) return null
  } else {
    if (row.optionIds.length !== 1) return null
    const option = step.options.find(candidate => candidate.id === row.optionIds[0])
    if (!option) return null
    value = `${option.label}${option.description ? ` (${option.description})` : ''}`
  }
  const title = step.title.replace(/[?？].*$/, '').trim()
  return `${title ? `${title}: ` : ''}${value} 기준으로 진행해줘`
}
