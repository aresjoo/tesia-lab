import { marketBindingKey } from './client-market-response-presentation'
import { marketQuestionText } from './client-market-question-copy'
import type { MarketQuestionAnswer, MarketQuestionPresentation, MarketQuestionStep, MarketQuestionViewState } from './client-market-question-presentation'

export function emptyMarketQuestionState(presentation: MarketQuestionPresentation): MarketQuestionViewState {
  return { index: 0, picks: presentation.steps.map(() => []), direct: presentation.steps.map(() => false), free: presentation.steps.map(() => ''), closed: false, accepted: null }
}

/** Derived from validated UI state, shared by submission and saved-summary validation. */
export function marketQuestionRows(steps: readonly MarketQuestionStep[], state: Pick<MarketQuestionViewState, 'picks' | 'free'>): MarketQuestionAnswer['rows'] {
  return steps.flatMap((step, index) => {
    const title = step.title.replace(/[?？].*$/, '').trim(), directText = state.free?.[index]?.trim()
    if (directText) return [{ stepId: step.id, title, optionIds: [], labels: [directText], directText }]
    const options = step.options.filter(option => state.picks[index].includes(option.id))
    return options.length ? [{ stepId: step.id, title, optionIds: options.map(option => option.id), labels: options.map(option => option.label) }] : []
  })
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const sameStrings = (value: unknown, expected: readonly string[]) => Array.isArray(value)
  && value.length === expected.length && expected.every((item, index) => value[index] === item)

/** Decode optional display metadata without trusting saved summaries or IDs.
 * Always return detached plain values. Corrupt metadata must not erase a turn. */
export function decodeMarketQuestionState(value: unknown, presentation: MarketQuestionPresentation): MarketQuestionViewState | null {
  try {
    const bindingKey = marketBindingKey(presentation.binding), steps = presentation.steps
    if (!bindingKey || !Array.isArray(steps) || !steps.length || !record(value)
      || !Number.isInteger(value.index) || (value.index as number) < 0 || (value.index as number) >= steps.length
      || !Array.isArray(value.picks) || value.picks.length !== steps.length
      || !Array.isArray(value.direct) || value.direct.length !== steps.length
      || value.free !== undefined && (!Array.isArray(value.free) || value.free.length !== steps.length || value.free.some(text => typeof text !== 'string' || text.length > 1000))
      || typeof value.closed !== 'boolean') return null
    const picks: string[][] = [], direct: boolean[] = [], stepIds = new Set<string>()
    for (let index = 0; index < steps.length; index++) {
      const step = steps[index], row: unknown = value.picks[index], manual: unknown = value.direct[index]
      if (!step || typeof step.id !== 'string' || !step.id.trim() || stepIds.has(step.id)
        || typeof step.title !== 'string' || step.multi !== undefined && typeof step.multi !== 'boolean'
        || !Array.isArray(step.options) || !step.options.length || !Array.isArray(row) || typeof manual !== 'boolean') return null
      stepIds.add(step.id)
      const known = new Set<string>()
      for (const option of step.options) {
        if (!option || typeof option.id !== 'string' || !option.id.trim() || known.has(option.id)
          || typeof option.label !== 'string' || !option.label.trim()) return null
        known.add(option.id)
      }
      const selection: string[] = []
      for (const id of row) {
        if (typeof id !== 'string' || !known.has(id) || selection.includes(id)) return null
        selection.push(id)
      }
      if (!step.multi && (selection.length > 1 || manual && selection.length > 0)) return null
      if (Array.isArray(value.free) && value.free[index].trim() && selection.length) return null
      picks.push(selection); direct.push(manual)
    }
    let accepted: MarketQuestionAnswer | null = null
    if (value.accepted !== null) {
      const answer = value.accepted
      if (value.closed || !record(answer) || answer.mode !== 'selection' || typeof answer.text !== 'string' || !answer.text.trim() || !record(answer.binding)
        || marketBindingKey(answer.binding as MarketQuestionAnswer['binding']) !== bindingKey || !Array.isArray(answer.rows)) return null
      // Submission uses presentation order, not the order in which boxes were
      // checked. Preserve the source's question-mark stripping rule exactly.
      const expected = marketQuestionRows(steps, { picks, free: value.free as string[] | undefined })
      if (!expected.length || answer.rows.length !== expected.length) return null
      for (let index = 0; index < expected.length; index++) {
        const row: unknown = answer.rows[index], match = expected[index]
        if (!record(row) || row.stepId !== match.stepId || row.title !== match.title
          || !sameStrings(row.optionIds, match.optionIds) || !sameStrings(row.labels, match.labels) || row.directText !== match.directText) return null
      }
      const body = expected.map(row => `${row.title ? `${row.title}: ` : ''}${row.labels.join(', ')}`).join(' / ')
      if (!(['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const).some(language => answer.text === body + marketQuestionText(language, 'suffix'))) return null
      accepted = { binding: { ...presentation.binding }, mode: 'selection', rows: expected, text: answer.text }
    }
    return { index: value.index as number, picks, direct, ...(value.free === undefined ? {} : { free: [...value.free as string[]] }), closed: value.closed, accepted }
  } catch { return null }
}
