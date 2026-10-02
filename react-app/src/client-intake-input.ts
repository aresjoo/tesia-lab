/** Conservative source-preview intake, not a model, validator or order policy.
 * The native consumer always sends the original request to the published SDK.
 */
import { parsePercentageEdit, readStoredPercentage } from './client-percentage-input'

type Intents = { risk?: number; take?: number }
const numeric = String.raw`[+\-−]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?`
const label = String.raw`손절|손실(?:\s*한도)?|익절|목표(?:\s*수익률)?`
const refused = /않|아니|아냐|말고|(?:하지|지)\s*마|없|(?:^|[\s,;%])안(?:\s+|\s*(?:할|해|하|함|돼|되|잡|넣|쓰|쓸))|제외|취소|\?|어떨|어때|%\s*(?:에서|→|->)/
const field = (value: string): keyof Intents => /손절|손실/.test(value) ? 'risk' : 'take'

/** Only unambiguous, explicitly named percentages are inferred in an idea. */
export function namedIntakePercentages(input: string): Intents {
  const text = input.trim().normalize('NFKC')
  const matches: { start: number; end: number; field: keyof Intents; value: number }[] = []
  const add = (start: number, end: number, name: string, token: string) => {
    const clauseStart = Math.max(text.lastIndexOf(',', start), text.lastIndexOf(';', start), text.lastIndexOf('\n', start)) + 1
    const nextBoundary = text.slice(end).search(/[,;\n]/)
    const clause = text.slice(clauseStart, nextBoundary < 0 ? text.length : end + nextBoundary)
    if (refused.test(clause)) return
    const value = readStoredPercentage(token + '%')
    const kind = field(name)
    // A negative take-profit is not permission to silently turn it positive.
    if (value !== null && !(kind === 'take' && value < 0)) matches.push({ start, end, field: kind, value: Math.abs(value) })
  }
  const prefix = new RegExp(`(${label})(?:은|는|을|를)?\\s*(${numeric})\\s*%(?![%\\d.])`, 'gi')
  for (const match of text.matchAll(prefix)) add(match.index, match.index + match[0].length, match[1], match[2])
  const suffix = new RegExp(`(^|[\\s,;])(${numeric})\\s*%\\s*(${label})(?=$|[\\s,;.!]|로|은|는)`, 'gi')
  for (const match of text.matchAll(suffix)) {
    const start = match.index + match[1].length, end = match.index + match[0].length
    if (/(?:[\d.]\s*[,;]?|[+−-])\s*$/.test(text.slice(0, start))) continue
    // "손절 2% 익절 8%" must not also interpret "2% 익절".
    if (!matches.some(item => start < item.end && end > item.start)) add(start, end, match[3], match[2])
  }
  let remainder = text
  for (const item of [...matches].sort((a, b) => b.start - a.start)) remainder = remainder.slice(0, item.start) + ' '.repeat(item.end - item.start) + remainder.slice(item.end)
  // Unbound/invalid/multiple values are a question, never a guessed selection.
  if (remainder.includes('%') || matches.filter(item => item.field === 'risk').length > 1 || matches.filter(item => item.field === 'take').length > 1) return {}
  return Object.fromEntries(matches.map(item => [item.field, item.value]))
}

export function intakePercentage(input: string, kind: keyof Intents): number | undefined {
  const text = input.trim().normalize('NFKC')
  const named = namedIntakePercentages(text)
  if (Object.keys(named).length) return Object.keys(named).length === 1 ? named[kind] : undefined
  if (refused.test(text)) return undefined
  const bare = text.replace(/\s*\(표준\)$/, '')
  // The active percentage question also accepts a bare decimal, as the source does.
  const result = parsePercentageEdit(new RegExp(`^${numeric}$`, 'i').test(bare) ? `${bare}%` : bare)
  return result.kind === 'value' && !(kind === 'take' && result.value < 0) ? Math.abs(result.value) : undefined
}

export const intakeWithoutTake = (input: string): boolean => /^(?:익절\s*없이(?:\s*진행)?|익절\s*안\s*할래요|없이|없음|그냥\s*진행)$/.test(input.trim().normalize('NFKC'))

/** Source sk-ask tfAiStrategy normalization, only for public local preview. */
export const normalizeSourceRsi = (value: number): number => Math.max(5, Math.min(70, Math.round(value)))
export type IntakeRsi = { kind: 'absent' } | { kind: 'unresolved' } | { kind: 'value'; requested: number }
/** Deliberately limited to one explicitly named entry threshold. It is not an AI
 * interpreter: periods, exit rules, comparisons and negations need clarification. */
export function namedIntakeRsi(input: string): IntakeRsi {
  const text = input.trim().normalize('NFKC')
  const occurrences = [...text.matchAll(/\bRSI/gi)]
  if (!occurrences.length) return { kind: 'absent' }
  if (occurrences.length !== 1) return { kind: 'unresolved' }
  const start = occurrences[0].index
  const boundary = text.slice(start).search(/[,;\n]/)
  const end = boundary < 0 ? text.length : start + boundary
  const clause = text.slice(Math.max(text.lastIndexOf(',', start), text.lastIndexOf(';', start), text.lastIndexOf('\n', start)) + 1, end)
  const match = text.slice(start, end).match(/^RSI(?:가|는|은|를|을)?\s*(?:(?:진입\s*)?(?:기준|임계값)\s*)?(?:[:=]\s*)?([+\-−]?(?:\d+(?:\.\d+)?|\.\d+))/i)
  if (!match || refused.test(clause) || /이상|이하|초과|매도|청산|팔|숏|[>≥≤]/.test(clause)) return { kind: 'unresolved' }
  const tail = text.slice(start + match[0].length, end)
  // Never accept the prefix of 2..5, 1e3, a percentage or a second threshold.
  if (/^[\d.eE%+−-]/.test(tail) || /^\s*(?:\d|[~/]|일|봉|기간|주기)/.test(tail) || boundary >= 0 && /^,\d/.test(text.slice(end))) return { kind: 'unresolved' }
  const requested = Number(match[1].replace('−', '-'))
  return Number.isFinite(requested) ? { kind: 'value', requested } : { kind: 'unresolved' }
}
