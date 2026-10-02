import { expect, test, type Page } from '@playwright/test'
import { resultHost } from './helpers/native-result-presentation-host'

// Actual React/SDK composition over explicitly synthetic HTTP responses.
// This proves UI ownership/recovery, not a genuine backend result producer.
const chronological = 'chronological-fill-markers'
async function ready(page: Page) {
  const control = await resultHost(page, { replayReader: true, boundedReplayPrices: true })
  const analysis = page.locator('[data-analysis-tab="analysis"]')
  if (await analysis.isVisible()) await analysis.click()
  const trigger = page.locator('.native-service-result > button').first()
  await expect(trigger).toHaveAttribute('aria-disabled', 'false')
  return { control, trigger }
}

test('시간순 첫페이지를 확인하기 전에는 가격 준비만으로 재생을 시작하지 않는다', async ({ page }) => {
  const { control, trigger } = await ready(page)
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  control.heldPath = chronological; control.hold = () => held
  try {
    await trigger.click()
    await expect.poll(() => control.requests.filter(url => url.pathname.endsWith(chronological)).length).toBe(1)
    await expect.poll(() => control.settled.filter(url => url.pathname.endsWith('/chart-window')).length).toBeGreaterThanOrEqual(2)
    // Observe multiple real ticker turns; a prepared price window cannot stand
    // in for the still-unverified first execution page.
    await page.waitForTimeout(240)
    await expect(page.locator('.cp-replay progress')).toHaveCount(0)
    await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
    await expect(page.locator('dialog[open]')).toHaveCount(0)
  } finally { release() }
  expect(control.errors).toEqual([])
})

test('수동 체결 재시도 대기에는 같은 체결 오류·원차트를 보존하고 성공 뒤에만 재생한다', async ({ page }) => {
  const { control, trigger } = await ready(page)
  const canvas = await page.locator('.cp-chart canvas').first().elementHandle()
  control.failure = chronological
  await trigger.click()
  const error = page.locator('[data-native-replay-error]')
  await expect(error).toContainText('체결 마커를 확인하지 못했습니다.')
  await expect(page.locator('.cp-replay progress')).toHaveCount(0)
  const retry = error.getByRole('button', { name: '같은 체결 마커 페이지 다시 조회', exact: true })
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  control.failure = ''; control.heldPath = chronological; control.hold = () => held
  try {
    await retry.click()
    await expect.poll(() => control.requests.filter(url => url.pathname.endsWith(chronological)).length).toBe(2)
    await page.waitForTimeout(240)
    await expect(error).toContainText('체결 마커를 확인하지 못했습니다.')
    await expect(retry).toBeDisabled()
    await expect(page.locator('.cp-replay progress')).toHaveCount(0)
  } finally { control.hold = undefined; release() }
  await expect(error).toHaveCount(0)
  await expect(page.locator('.cp-replay progress')).toBeVisible()
  await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  expect(await page.locator('.cp-chart canvas').first().evaluate((node, old) => node === old, canvas)).toBe(true)
  expect(control.requests.filter(url => url.pathname.endsWith(chronological))).toHaveLength(2)
  expect(control.errors).toEqual([])
})

async function failedReplay(page: Page) {
  const setup = await ready(page)
  setup.control.failure = chronological
  await setup.trigger.click()
  await expect(page.locator('[data-native-replay-error]')).toContainText('체결 마커를 확인하지 못했습니다.')
  return setup
}
async function skipReplay(page: Page) {
  await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)
}
async function sourceControls(page: Page) {
  const tab = page.getByRole('tab', { name: '실행 구간', exact: true })
  if (await tab.isVisible()) await tab.click()
}
async function replaceLifetime(page: Page, boundary: 'api' | 'factory', alternate: boolean) {
  await page.evaluate(({ boundary, alternate }) => {
    Reflect.get(window, boundary === 'api' ? 'replaceAutomaticResultApi' : 'replaceAutomaticResultFactory')(alternate)
  }, { boundary, alternate })
}

for (const boundary of ['report', 'segment', 'api', 'factory'] as const) {
  test(`${boundary} 수명 교체는 이전 재생 체결 오류를 폐기하고 원참조 복귀에도 되살리지 않는다`, async ({ page }) => {
    const { control, trigger } = await failedReplay(page)
    await skipReplay(page)
    // Skip alone preserves a same-report failure; a distinct input lifetime
    // must retire it without treating the failed request as a successful read.
    await expect(page.locator('[data-native-replay-error]')).toHaveCount(1)
    control.failure = ''
    const reportReads = () => control.requests.filter(url => url.pathname.endsWith('/native-report')).length
    if (boundary === 'report') {
      const before = reportReads()
      await sourceControls(page)
      await page.getByRole('button', { name: '결과 상세 다시 조회', exact: true }).click()
      await expect.poll(reportReads).toBeGreaterThan(before)
    } else if (boundary === 'segment') {
      await sourceControls(page)
      await page.locator('[data-native-controls="segments"]').getByRole('button', { name: 'IS', exact: true }).click()
      await expect.poll(() => control.settled.some(url => url.pathname.endsWith('/chart-window') && url.searchParams.get('segment') === 'IS')).toBe(true)
    } else await replaceLifetime(page, boundary, true)
    await expect(page.locator('[data-native-replay-error]')).toHaveCount(0)
    await expect(trigger).toHaveAttribute('aria-disabled', 'false')
    if (boundary === 'segment') {
      await page.locator('[data-native-controls="segments"]').getByRole('button', { name: 'OOS', exact: true }).click()
    } else if (boundary === 'api' || boundary === 'factory') await replaceLifetime(page, boundary, false)
    await expect(trigger).toHaveAttribute('aria-disabled', 'false')
    await expect(page.locator('[data-native-replay-error]')).toHaveCount(0)
    await expect(page.getByTestId('native-result-detail-status')).toHaveCount(0)
    expect(control.requests.filter(url => url.pathname.endsWith(`/${chronological}`))).toHaveLength(1)
    await expect(page.locator('.g-composer textarea')).toHaveValue('자동 재생 뒤에도 보존할 질문')
    expect(control.errors).toEqual([])
  })
}

for (const boundary of ['api', 'factory'] as const) {
  test(`${boundary} 교체 뒤 이전 체결 재시도의 늦은 실패가 오류나 재생을 복원하지 않는다`, async ({ page }) => {
    const { control, trigger } = await failedReplay(page)
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    control.heldPath = chronological; control.hold = () => pending
    try {
      await page.getByRole('button', { name: '같은 체결 마커 페이지 다시 조회', exact: true }).click()
      await expect.poll(() => control.requests.filter(url => url.pathname.endsWith(`/${chronological}`)).length).toBe(2)
      await replaceLifetime(page, boundary, true)
      await expect(page.locator('dialog[open]')).toHaveCount(0)
      await expect(page.locator('[data-native-replay-error]')).toHaveCount(0)
    } finally { control.hold = undefined; release() }
    await expect.poll(() => control.settled.filter(url => url.pathname.endsWith(`/${chronological}`)).length).toBe(2)
    await replaceLifetime(page, boundary, false)
    await expect(trigger).toHaveAttribute('aria-disabled', 'false')
    await expect(page.locator('[data-native-replay-error]')).toHaveCount(0)
    await expect(page.locator('.cp-replay progress')).toHaveCount(0)
    await expect(page.locator('dialog[open]')).toHaveCount(0)
    expect(control.errors).toEqual([])
  })
}

test('이전 재생 오류 폐기는 현재 보고서 조회 실패를 지우지 않고 명시 재조회만 복구한다', async ({ page }) => {
  const { control, trigger } = await failedReplay(page)
  await skipReplay(page)
  control.failure = 'native-report'
  await sourceControls(page)
  await page.getByRole('button', { name: '결과 상세 다시 조회', exact: true }).click()
  const result = page.locator('.native-service-result')
  const failure = result.getByText('검증된 보고서를 가져오지 못했습니다. 미확인 수치는 표시하지 않습니다.', { exact: true })
  await expect(failure).toBeVisible()
  await replaceLifetime(page, 'factory', true)
  await expect(failure).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-disabled', 'true')
  await expect(page.locator('[data-native-replay-error]')).toHaveCount(0)
  control.failure = ''
  await result.getByRole('button', { name: '보고서 다시 조회', exact: true }).click()
  await expect(failure).toHaveCount(0)
  await expect(trigger).toHaveAttribute('aria-disabled', 'false')
  await expect(page.getByTestId('native-result-detail-status')).toHaveCount(0)
  expect(control.requests.filter(url => url.pathname.endsWith(`/${chronological}`))).toHaveLength(1)
  expect(control.errors).toEqual([])
})

test('첫 봉 체결도 현재 표시 개수에 포함하며 첫 dwell 1개에서 다음 체결 2개로 진행한다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  const { control, trigger } = await ready(page)
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))
  await trigger.click()
  await expect.poll(() => control.settled.filter(url => url.pathname.endsWith(`/${chronological}`)).length).toBe(1)
  await expect.poll(() => control.settled.filter(url => url.pathname.endsWith('/chart-window')).length).toBeGreaterThanOrEqual(2)
  await page.clock.runFor(80)
  await expect(page.locator('.cp-execution b')).toHaveText('BUY')
  await expect(page.locator('.ctt-context')).toContainText('현재 차트 표시 체결 1개')
  await page.clock.runFor(560)
  await expect(page.locator('.cp-execution b')).toHaveText('BUY')
  await expect(page.locator('.ctt-context')).toContainText('현재 차트 표시 체결 1개')
  await page.clock.runFor(160)
  await expect(page.locator('.cp-execution b')).toHaveText('SELL')
  await expect(page.locator('.ctt-context')).toContainText('현재 차트 표시 체결 2개')
  await skipReplay(page)
  expect(control.errors).toEqual([])
})
