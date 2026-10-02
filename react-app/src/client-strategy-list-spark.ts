/** Client source mkSpark3: preserve daily points and flat intervals; round only
 * the corners by 2.5 viewBox units. This is presentation, never a price model. */
export function strategyListSpark(values: readonly number[]) {
  if (values.length < 2 || !values.every(Number.isFinite)) return null
  const base = values[0], min = Math.min(base, ...values), max = Math.max(base, ...values)
  const flat = max - min < 1e-9
  const y = (value: number) => flat ? 39 : 5 + (1 - (value - min) / (max - min)) * 68
  const points = values.map((value, index) => [1 + index / (values.length - 1) * 168, y(value)] as const)
  const xy = (point: readonly number[]) => `${point[0].toFixed(1)} ${point[1].toFixed(1)}`
  let path = `M${xy(points[0])}`, flatAtBase = ''
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1]
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1])
    if (l1 < 1e-6 || l2 < 1e-6) { path += ` L${xy(b)}`; continue }
    const r1 = Math.min(2.5, l1 / 2), r2 = Math.min(2.5, l2 / 2)
    path += ` L${xy([b[0] - (b[0] - a[0]) / l1 * r1, b[1] - (b[1] - a[1]) / l1 * r1])}`
    path += ` Q${xy(b)} ${xy([b[0] + (c[0] - b[0]) / l2 * r2, b[1] + (c[1] - b[1]) / l2 * r2])}`
  }
  path += ` L${xy(points.at(-1)!)}`
  for (let i = 0; i < values.length - 1; i++) {
    if (Math.abs(values[i] - base) < 1e-12 && Math.abs(values[i + 1] - base) < 1e-12) flatAtBase += `M${xy(points[i])} L${xy(points[i + 1])} `
  }
  return { flat, path, flatAtBase, baseline: y(base), negative: min < base - 1e-9 }
}
