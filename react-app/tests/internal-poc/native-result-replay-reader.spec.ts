import { expect, test, type Page } from '@playwright/test'
import { resultHost } from './helpers/native-result-presentation-host'
import { EXECUTION_DWELL_MS } from '../../src/chart/price-execution-timeline'

// Consumer evidence: v6/v5 bindings + generated-v11-validated synthetic fills.
// Whole supplied segment UI scheduling is NOT genuine producer/source evidence.
test.setTimeout(35_000)
test.use({ trace: 'retain-on-failure', video: 'off' })
const deliver = (page: Page) => page.evaluate(() => Reflect.get(window, 'deliverAutomaticResult')())
const skip = (page: Page) => page.getByRole('button', { name: 'Skip · 결과 보기', exact: true })
const audit = (page: Page) => page.evaluate(() => Reflect.get(window, 'automaticResultAudit') as { markers: number; readerCreated: number; readerDisposed: number; readerMarkers: number; readerChronologicalMarkers: number; readerWindows: number; readerBindingFailures: number; scopeInvalidated: number; statuses: {state: string; reportReady: boolean}[] })
const chronological = 'chronological-fill-markers'
const reads = (control: Awaited<ReturnType<typeof resultHost>>, path: string) => control.requests.filter(url => url.pathname.endsWith(`/${path}`))
const flush = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
async function ready(page: Page) {
  const control = await resultHost(page, { replayReader: true, boundedReplayPrices: true })
  await expect(page.locator('.cp-chart canvas').first()).toBeAttached()
  // Mobile keeps the prepared chart in the inactive analysis tab. This is a
  // readiness observation, not a user click on a hidden control.
  await expect(page.locator('.native-service-result').getByRole('button', { name: '차트로 결과 보기', exact: true, includeHidden: true })).toHaveAttribute('aria-disabled', 'false')
  return control
}

test('자동 전체기간 재생은 독립 reader의 새 manifest·가격창·시간순 체결을 읽고 Skip 후 동일 canvas·초안으로 복귀한다', async ({ page }) => {
  const control = await ready(page), before = control.requests.length
  const canvas = await page.locator('.cp-chart canvas').first().elementHandle()
  const input = page.locator('.g-composer textarea'), original = await input.elementHandle()
  await input.focus(); await input.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(3, 8))
  await deliver(page)
  await expect(page.locator('.cp-replay progress')).toBeVisible()
  const replayRequests = control.requests.slice(before)
  expect(replayRequests[0].pathname).toMatch(/chart-manifest$/)
  expect(replayRequests.filter(url => url.pathname.endsWith('chart-manifest'))).toHaveLength(1)
  expect(reads(control, chronological)).toHaveLength(1)
  expect(reads(control, 'fill-markers')).toHaveLength(0)
  expect(replayRequests.some(url => url.pathname.endsWith('/chart-window'))).toBe(true)
  expect(await audit(page)).toMatchObject({ readerCreated: 1, readerChronologicalMarkers: 1, readerMarkers: 0, readerDisposed: 0, markers: 0 })
  await skip(page).click(); await expect(skip(page)).toHaveCount(0)
  await expect.poll(async () => (await audit(page)).readerDisposed).toBe(1)
  await expect(input).toHaveValue('자동 재생 뒤에도 보존할 질문'); await expect(input).toBeFocused()
  expect(await input.evaluate((node, old) => node === old, original)).toBe(true)
  expect(await input.evaluate(node => [(node as HTMLTextAreaElement).selectionStart, (node as HTMLTextAreaElement).selectionEnd])).toEqual([3,8])
  expect(await page.locator('.cp-chart canvas').first().evaluate((node, old) => node === old, canvas)).toBe(true)
  expect(control.errors).toEqual([])
})

test('새 manifest 대기 중 Skip은 reader를 폐기하고 늦은 응답이 marker 조회나 재생을 만들지 않는다', async ({ page }) => {
  const control = await ready(page), before = reads(control,'chart-manifest').length
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  control.heldPath = 'chart-manifest'; control.hold = () => pending
  try {
    await deliver(page); await expect(skip(page)).toBeVisible()
    await expect.poll(() => reads(control,'chart-manifest').length).toBe(before + 1)
    expect(reads(control,chronological)).toHaveLength(0)
    await skip(page).click(); await expect.poll(async () => (await audit(page)).readerDisposed).toBe(1)
  } finally { release() }
  await expect.poll(() => control.settled.filter(url => url.pathname.endsWith('chart-manifest')).length).toBe(before + 1)
  await flush(page)
  await expect(skip(page)).toHaveCount(0); await expect(page.locator('.cp-replay progress')).toHaveCount(0)
  expect(reads(control,chronological)).toHaveLength(0)
  await expect(page.locator('.g-composer textarea')).toHaveValue('자동 재생 뒤에도 보존할 질문')
  expect(control.errors).toEqual([])
})

test('marker 대기 중 Skip은 독립 조회를 폐기하고 늦은 체결로 다시 열지 않는다', async ({ page }) => {
  const control = await ready(page)
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  control.heldPath=chronological; control.hold=()=>pending
  const canvas=await page.locator('.cp-chart canvas').first().elementHandle()
  try {
    await deliver(page); await expect.poll(()=>reads(control,chronological).length).toBe(1)
    await expect(skip(page)).toBeVisible(); await skip(page).click()
    await expect.poll(async()=>(await audit(page)).readerDisposed).toBe(1)
  } finally { release() }
  await expect.poll(()=>control.settled.filter(url=>url.pathname.endsWith(`/${chronological}`)).length).toBe(1)
  await flush(page); await expect(skip(page)).toHaveCount(0)
  await expect(page.locator('.cp-chart')).not.toHaveAttribute('data-replaying','true')
  expect(await page.locator('.cp-chart canvas').first().evaluate((node,old)=>node===old,canvas)).toBe(true)
  expect(await audit(page)).toMatchObject({readerCreated:1,readerDisposed:1,readerChronologicalMarkers:1,readerMarkers:0,markers:0})
  expect(control.errors).toEqual([])
})

for (const heldPath of ['chart-manifest','chart-window',chronological]) for (const abandon of ['owner','unmount'] as const)
test(`${heldPath} 대기 중 ${abandon} 교체는 전용 scope와 재생을 폐기한다`, async ({page})=>{
  const control=await ready(page),before=reads(control,heldPath).length
  let heldRequest: URL | undefined
  let chronologicalBeforeRetire: number
  let release!:()=>void
  const pending=new Promise<void>(resolve=>{release=resolve})
  control.heldPath=heldPath;control.hold=()=>pending
  try {
    await deliver(page);await expect.poll(()=>reads(control,heldPath).length).toBe(before+1)
    heldRequest = reads(control, heldPath)[before]
    chronologicalBeforeRetire = reads(control, chronological).length
    await page.evaluate(abandon=>Reflect.get(window,abandon==='owner'?'replaceAutomaticOwner':'retireAutomaticResult')(),abandon)
    await expect.poll(async()=>(await audit(page)).scopeInvalidated).toBe(1)
    await expect.poll(async()=>(await audit(page)).readerDisposed).toBe(1)
  } finally {release()}
  // Owner replacement can mount a fresh ordinary result reader. Observe this
  // exact retired request, rather than conflating it with the new owner's GET.
  await expect.poll(()=>control.settled.includes(heldRequest!)).toBe(true)
  await flush(page);await expect(skip(page)).toHaveCount(0)
  await expect(page.locator('.cp-replay progress')).toHaveCount(0)
  expect(reads(control,chronological)).toHaveLength(chronologicalBeforeRetire)
  if (heldPath === 'chart-manifest') expect(chronologicalBeforeRetire).toBe(0)
  if (heldPath === chronological) expect(chronologicalBeforeRetire).toBe(1)
  expect(reads(control,'fill-markers')).toHaveLength(0)
  if(abandon==='unmount')await expect(page.locator('.native-service-result')).toHaveCount(0)
  else await expect(page.locator('.g-composer textarea')).toHaveValue('자동 재생 뒤에도 보존할 질문')
  expect(control.errors).toEqual([])
})

test('전체 segment의 60초 시계와 체결별 dwell·두 가격창 대기 후 완료는 reader·동일 차트·대화를 보존한다',async({page})=>{
  await page.clock.install({time:new Date('2026-01-01T00:00:00Z')})
  const control=await ready(page)
  const canvas=await page.locator('.cp-chart canvas').first().elementHandle()
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))
  await deliver(page)
  await expect.poll(() => control.settled.filter(url => url.pathname.endsWith(`/${chronological}`)).length).toBe(1)
  // Delivery does not tick the caller-owned clock. Start it explicitly only
  // after the asynchronous first inputs have arrived (the clock is paused).
  await expect.poll(() => control.settled.filter(url => url.pathname.endsWith('/chart-window')).length).toBeGreaterThanOrEqual(2)
  await page.clock.runFor(80)
  await expect(page.locator('.cp-replay progress')).toBeAttached()
  const execution = page.locator('.cp-execution b')
  await expect(execution).toHaveText('BUY')
  await page.clock.runFor(EXECUTION_DWELL_MS - 1)
  await expect(execution).toHaveText('BUY')
  const observedSides = new Set(['BUY'])
  const observeExecution = async () => {
    if (await execution.count()) observedSides.add((await execution.textContent())!)
  }
  // Observe the same five-second caller-clock cadence without rendering every
  // intermediate RAF in this UI test. The real controller still clamps to the
  // earliest fill, enforces dwell, and promotes at most one prepared window.
  // Continuous tick/dwell behavior has separate unchanged controller tests.
  for (let i = 0; i < 11; i++) {
    await page.clock.fastForward(5000)
    await page.evaluate(() => Promise.resolve())
    await observeExecution()
  }
  await page.clock.runFor(5000 - (EXECUTION_DWELL_MS - 1));await expect(skip(page)).toBeVisible()
  expect((await audit(page)).readerDisposed).toBe(0)
  await expect.poll(async () => (await audit(page)).readerWindows).toBe(2)
  for (let i = 0; i < 20 && (await audit(page)).readerDisposed === 0; i++) {
    await page.clock.fastForward(5000)
    await page.evaluate(() => Promise.resolve())
    await observeExecution()
  }
  await expect(skip(page)).toHaveCount(0)
  expect((await audit(page)).readerDisposed).toBe(1)
  expect(await page.locator('.cp-chart canvas').first().evaluate((node,old)=>node===old,canvas)).toBe(true)
  await expect(page.locator('.g-composer textarea')).toHaveValue('자동 재생 뒤에도 보존할 질문')
  expect(reads(control,chronological)).toHaveLength(1)
  expect(reads(control,'fill-markers')).toHaveLength(0)
  const requested = reads(control,'chart-window').map(url => url.searchParams.get('fromInclusive'))
  expect(new Set(requested).size).toBe(2)
  expect(observedSides).toEqual(new Set(['BUY', 'SELL']))
  expect(control.errors).toEqual([])
})

test('새 manifest가 기존 chart와 다르면 marker를 읽기 전에 재생을 거절한다',async({page})=>{
  const control=await ready(page),before=reads(control,'chart-manifest').length
  const canvas=await page.locator('.cp-chart canvas').first().elementHandle()
  control.manifestHash='6'.repeat(64)
  await deliver(page)
  await expect.poll(()=>reads(control,'chart-manifest').length).toBe(before+1)
  await expect.poll(async()=>(await audit(page)).readerDisposed).toBe(1)
  await expect(skip(page)).toHaveCount(0);await expect(page.locator('.cp-replay progress')).toHaveCount(0)
  expect(reads(control,chronological)).toHaveLength(0)
  expect((await audit(page)).readerBindingFailures).toBeGreaterThanOrEqual(1)
  await expect.poll(async () => (await audit(page)).statuses.at(-1)).toMatchObject({ state: 'error', reportReady: true })
  expect(await page.locator('.cp-chart canvas').first().evaluate((node,old)=>node===old,canvas)).toBe(true)
  await expect(page.locator('.g-composer textarea')).toHaveValue('자동 재생 뒤에도 보존할 질문')
  expect(control.errors).toEqual([])
})

test('이미 폐기된 재생 factory는 결과 조회 오류로 표시하지 않는다', async ({ page }) => {
  const control = await resultHost(page, { replayReader: true, factoryDisposed: true })
  await expect.poll(async () => (await audit(page)).statuses.at(-1)).toMatchObject({ state: 'ready', reportReady: true })
  const before = (await audit(page)).statuses.length
  await deliver(page)
  await flush(page)
  await expect(skip(page)).toHaveCount(0)
  const observed = await audit(page)
  expect(observed.statuses.slice(before).some(status => status.state === 'error')).toBe(false)
  expect(observed.statuses.at(-1)).toMatchObject({ state: 'ready', reportReady: true })
  expect(observed.readerCreated).toBe(0)
  expect(reads(control, 'fill-markers')).toHaveLength(0)
  await expect(page.locator('.g-composer textarea')).toHaveValue('자동 재생 뒤에도 보존할 질문')
  expect(control.errors).toEqual([])
})

test('수동 재생 factory가 폐기되면 빈 전체창을 남기지 않고 호출 버튼으로 돌아간다', async ({ page }) => {
  const control = await resultHost(page, { replayReader: true, factoryDisposed: true })
  await expect.poll(async () => (await audit(page)).statuses.at(-1)).toMatchObject({ state: 'ready', reportReady: true })
  const analysis = page.locator('[data-analysis-tab="analysis"]')
  if (await analysis.isVisible()) await analysis.click()
  const trigger = page.locator('.native-service-result').getByRole('button', { name: '차트로 결과 보기', exact: true })
  await trigger.focus(); await trigger.click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  expect((await audit(page)).statuses.at(-1)).toMatchObject({ state: 'ready', reportReady: true })
  expect(reads(control, 'fill-markers')).toHaveLength(0)
  expect(control.errors).toEqual([])
})

test('재생 준비가 취소되어도 이전 체결 조회 오류와 재시도 경로는 보존한다', async ({ page }) => {
  const control = await resultHost(page, { replayReader: true, factoryDisposed: true })
  await expect.poll(async () => (await audit(page)).statuses.at(-1)).toMatchObject({ state: 'ready', reportReady: true })
  const analysis = page.locator('[data-analysis-tab="analysis"]')
  if (await analysis.isVisible()) await analysis.click()
  const result = page.locator('.native-service-result')
  const markerPanel = result.locator('[data-native-controls="fill-markers"]')
  control.failure = 'fill-markers'
  await markerPanel.getByRole('button', { name: '체결 마커 조회', exact: true }).click()
  await expect(markerPanel.getByRole('alert')).toContainText('체결 마커를 확인하지 못했습니다.')
  await result.getByRole('button', { name: '차트로 결과 보기', exact: true }).click()
  await expect(markerPanel.getByRole('alert')).toContainText('체결 마커를 확인하지 못했습니다.')
  await expect.poll(async () => (await audit(page)).statuses.at(-1)).toMatchObject({ state: 'error', reportReady: true })
  control.failure = ''
  await markerPanel.getByRole('button', { name: '같은 체결 마커 페이지 다시 조회', exact: true }).click()
  await expect(markerPanel.getByRole('alert')).toHaveCount(0)
  await expect.poll(async () => (await audit(page)).statuses.at(-1)).toMatchObject({ state: 'ready', reportReady: true })
  expect(reads(control, 'fill-markers')).toHaveLength(2)
  expect((await audit(page)).readerCreated).toBe(0)
  expect(control.errors).toEqual([])
})

for (const previousError of [false, true]) test(`inflight 재생 scope 폐기는 모달을 닫고 기존 오류 ${previousError} 상태만 유지한다`, async ({ page }) => {
  const control = await ready(page)
  const analysis = page.locator('[data-analysis-tab="analysis"]')
  if (await analysis.isVisible()) await analysis.click()
  const result = page.locator('.native-service-result')
  const markerPanel = result.locator('[data-native-controls="fill-markers"]')
  if (previousError) {
    control.failure = 'fill-markers'
    await markerPanel.getByRole('button', { name: '체결 마커 조회', exact: true }).click()
    await expect(markerPanel.getByRole('alert')).toBeVisible()
    control.failure = ''
  }
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  control.heldPath = chronological; control.hold = () => pending
  const before = reads(control, chronological).length
  try {
    await result.getByRole('button', { name: '차트로 결과 보기', exact: true }).click()
    await expect.poll(() => reads(control, chronological).length).toBe(before + 1)
    // No prop change or unmount: exercise asynchronous owner-scope retirement.
    await page.evaluate(() => Reflect.get(window, 'invalidateAutomaticReaderScope')())
    await expect(page.locator('dialog[open]')).toHaveCount(0)
    await expect.poll(async () => (await audit(page)).statuses.at(-1)).toMatchObject({ state: previousError ? 'error' : 'ready', reportReady: true })
    await expect(markerPanel.getByRole('alert')).toHaveCount(previousError ? 1 : 0)
    await expect(markerPanel.getByRole('button', { name: '체결 마커 조회', exact: true })).toBeEnabled()
  } finally { release() }
  await expect.poll(() => control.settled.filter(url => url.pathname.endsWith(`/${chronological}`)).length).toBe(before + 1)
  await flush(page)
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(markerPanel.getByRole('alert')).toHaveCount(previousError ? 1 : 0)
  expect((await audit(page)).readerDisposed).toBe(1)
  expect(control.errors).toEqual([])
})

test('폐기되지 않은 재생 reader의 전송 실패는 실제 오류로 남긴다', async ({ page }) => {
  const control = await ready(page)
  control.failure = chronological
  await deliver(page)
  await expect.poll(async () => (await audit(page)).statuses.at(-1)).toMatchObject({ state: 'error', reportReady: true })
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  expect(reads(control, chronological)).toHaveLength(1)
  expect((await audit(page)).readerDisposed).toBe(1)
  expect(control.errors).toEqual([])
})
