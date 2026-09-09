/** Conservative parsing for a local editable UI, never a trading/risk validator. */
const numberSource = String.raw`[+\-−]?(?:(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?|Infinity|NaN)`
const percentage = new RegExp(`^(${numberSource})\\s*%$`, 'i')
const edit = new RegExp(`^(${numberSource})\\s*%\\s*(?:로(?:\\s*(?:변경|수정|설정)해\\s*주세요)?)?$`, 'i')
const formatError = '적용할 값 하나만 입력해주세요. 예: 2.5% (쉼표 없이)'
const numericError = '계산할 수 있는 숫자로 입력해주세요. 예: 2%'

function finiteNumber(token: string): number | null {
  const number = Number(token.replace('−', '-'))
  // A tiny nonzero exponent must not silently turn into a zero-percent rule.
  if (!Number.isFinite(number) || (number === 0 && /[1-9]/.test(token.split(/e/i)[0]))) return null
  return number
}

export function readStoredPercentage(input: string): number | null {
  const match = input.trim().normalize('NFKC').match(percentage)
  return match ? finiteNumber(match[1]) : null
}

export function parsePercentageEdit(input: string): { kind: 'comment' } | { kind: 'error'; message: string } | { kind: 'value'; value: number } {
  const text = input.trim().normalize('NFKC')
  if (!text.includes('%')) return { kind: 'comment' }
  const match = text.match(edit)
  if (!match) return { kind: 'error', message: formatError }
  const value = finiteNumber(match[1])
  return value === null ? { kind: 'error', message: numericError } : { kind: 'value', value }
}
