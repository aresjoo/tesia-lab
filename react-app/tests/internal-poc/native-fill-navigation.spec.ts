import { expect, test } from '@playwright/test'
import { nativeFillChartTarget } from '../../src/internal-poc/native-fill-navigation'

const available = { fromInclusive: '2024-01-01T00:00:00Z', toExclusive: '2026-01-01T00:00:00Z' }
const window = { requestedRange: { fromInclusive: available.fromInclusive, toExclusive: '2024-01-01T16:40:00Z' }, resolution: '1m' as const }
test('실제 조회 가능한 구간 경계·현재 창·정밀도별 이동 힌트만 계산한다', () => {
  expect(nativeFillChartTarget(available.fromInclusive, available, window)).toEqual({ kind: 'visible' })
  expect(nativeFillChartTarget('2024-01-01T16:39:59Z', available, window)).toEqual({ kind: 'visible' })
  expect(nativeFillChartTarget(window.requestedRange.toExclusive, available, window)).toEqual({ kind: 'request', fromInclusive: '2024-01-01T16:20:00Z' })
  for (const time of ['2023-12-31T23:59:59Z', available.toExclusive, 'invalid']) expect(nativeFillChartTarget(time, available, window)).toEqual({ kind: 'unavailable' })
  for (const [resolution, expected] of [['1m', '2025-05-31T23:40:00Z'], ['15m', '2025-05-31T19:00:00Z'], ['1h', '2025-05-31T04:00:00Z'], ['1d', '2025-05-12T00:00:00Z']] as const) {
    expect(nativeFillChartTarget('2025-06-01T00:00:00Z', available, { ...window, resolution })).toEqual({ kind: 'request', fromInclusive: expected })
  }
  expect(nativeFillChartTarget(available.fromInclusive, available, { ...window, requestedRange: { fromInclusive: '2025-01-01T00:00:00Z', toExclusive: available.toExclusive } })).toEqual({ kind: 'request', fromInclusive: available.fromInclusive })
})
