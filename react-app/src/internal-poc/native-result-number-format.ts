/** Display-only ratio → percent. Not a metric/formula/schema validator.
 * Keep the server's raw value alongside this optional, rounded aid.
 * Half-up on the magnitude (ties away from zero), never binary floats.
 */
export function formatResultRatePercent(value: string | undefined, tinyNegativeLabel = '−0.01% 초과 · 0% 미만'): string | undefined {
  // Bound presentation work; unsupported input keeps its separate raw display.
  if (typeof value !== 'string' || value.length > 4096) return undefined
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value)
  if (!match) return undefined
  const [, sign, integer, fraction = ''] = match
  const nonzero = /[1-9]/.test(integer + fraction)
  const digits = fraction.padEnd(5, '0')
  const hundredths = BigInt(integer + digits.slice(0, 4)) + (digits[4] >= '5' ? 1n : 0n)
  if (hundredths === 0n && nonzero) return sign ? tinyNegativeLabel : '<0.01%'
  const whole = (hundredths / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const cents = (hundredths % 100n).toString().padStart(2, '0')
  return `${sign && nonzero ? '−' : ''}${whole}.${cents}%`
}
