import { installCompiledModuleResponse } from '../fixtures/compiled-module-response'
import { expect, test, type Page } from '@playwright/test'
import { resultHost } from './helpers/native-result-presentation-host'

// 실제 NativeServiceResult/renderer와 생성 SDK를 통과하는 합성 HTTP 자료.
// 원 producer, 실제 거래 내역 또는 실제 730일 source custody 증거는 아니다.
const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const chronologicalCopy = [
  '현재 차트 표시 체결 {visible}개 · 전체 체결 아님',
  '{visible} executions shown on chart · Not total executions',
  'チャート表示中の約定 {visible}件 · 全約定ではありません',
  '当前图表显示成交 {visible} 笔 · 非全部成交',
  '目前圖表顯示成交 {visible} 筆 · 非全部成交',
  '{visible} ejecuciones en gráfico · No representa el total',
  '{visible} exécutions affichées sur le graphique · Ne représente pas la totalité',
]
const legacyCopy = [
  '체결 첫 페이지 중 현재 표시 범위 {visible}개 · 전체 체결 아님',
  '{visible} in the current display range from the first page of fills · not all fills',
  '約定の最初のページのうち現在の表示範囲{visible}件 · 全約定ではありません',
  '成交首页中当前显示范围 {visible} 个 · 并非全部成交',
  '成交首頁中目前顯示範圍 {visible} 個 · 並非全部成交',
  '{visible} en el rango mostrado de la primera página de ejecuciones · no son todas las ejecuciones',
  "{visible} dans la plage affichée de la première page d'exécutions · pas la totalité des exécutions",
]
type Paint = { frame: { fillId: string | null } | null; fillIds: string[] }
const paint = (page: Page): Promise<Paint | undefined> => page.evaluate(() => Reflect.get(window, 'paginationPaint'))
const reads = (control: Awaited<ReturnType<typeof resultHost>>, suffix: string) => control.requests.filter(url => url.pathname.endsWith(`/${suffix}`))

async function setLanguage(page: Page, language: typeof locales[number]) {
  await page.evaluate(value => Reflect.get(window, 'setAutomaticResultLanguage')(value), language)
  await expect(page.locator('html')).toHaveAttribute('lang', language)
}

async function checkCopy(page: Page, count: number, chronological: boolean) {
  const accepted = chronological ? chronologicalCopy : legacyCopy
  const rejected = chronological ? legacyCopy : chronologicalCopy
  for (const [index, language] of locales.entries()) {
    await setLanguage(page, language)
    const context = page.locator('.native-service-result')
    await expect(context.getByText(accepted[index].replace('{visible}', String(count)), { exact: true })).toBeVisible()
    await expect(context.getByText(rejected[index].replace('{visible}', String(count)), { exact: true })).toHaveCount(0)
  }
  await setLanguage(page, 'ko')
}

async function ready(page: Page, paginated: boolean) {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  if (paginated) await installCompiledModuleResponse(page, "/src/components/ClientProfessionalPriceChart.tsx", original => {
    const body = original;
    expect(body).toContain('updateExternalReplay.current = () => {')
    return body.replace('updateExternalReplay.current = () => {',
      'updateExternalReplay.current = () => { window.paginationPaint = { frame: runtimeInput.current.externalReplay?.frame ?? null, fillIds: runtimeInput.current.fills.map(fill => fill.id) };')
    }, ["updateExternalReplay.current = () => {"])
  const control = await resultHost(page, { replayReader: paginated, boundedReplayPrices: paginated, paginatedReplayFills: paginated })
  await expect(page.locator('.native-service-result').getByRole('button', { name: '차트로 결과 보기', exact: true, includeHidden: true })).toHaveAttribute('aria-disabled', 'false')
  await expect(page.locator('.cp-surface canvas').first()).toBeAttached()
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  const input = await page.locator('.g-composer textarea').elementHandle()
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))
  await page.evaluate(() => Reflect.get(window, 'deliverAutomaticResult')())
  await expect(page.getByRole('button', { name: 'Skip · 결과 보기', exact: true })).toBeVisible()
  return { control, canvas, input }
}

test('시간순 두 번째 페이지의 실제 ordinal 100 표시 후 7언어 집계가 첫 페이지나 전체 체결로 잘못 표시되지 않는다', async ({ page }) => {
  const { control, canvas, input } = await ready(page, true)
  await expect.poll(() => control.settled.filter(url => url.pathname.endsWith('/chart-window')).length).toBe(3)
  await expect.poll(() => control.settled.filter(url => url.pathname.endsWith('/chronological-fill-markers')).length).toBe(1)
  await page.clock.runFor(80)
  await expect.poll(async () => (await paint(page))?.frame?.fillId).toBe('evt_synthetic_entry_00000000')
  await expect(page.locator('.cp-execution b')).toHaveText('BUY')

  // 각 체결의 dwell을 보존하며 1페이지 100건을 실제 renderer로 소비한다.
  for (let index = 0; index < 110 && reads(control, 'chronological-fill-markers').length < 2; index++) await page.clock.runFor(640)
  await expect.poll(() => control.settled.filter(url => url.pathname.endsWith('/chronological-fill-markers')).length).toBe(2)
  // 2페이지 GET만으로 표시를 증명하지 않는다. 마지막 1페이지 dwell 뒤
  // ordinal100의 정확 ID가 actual renderer에 도달해야 문구를 검사한다.
  await page.clock.runFor(720)
  await expect.poll(() => paint(page)).toMatchObject({ frame: { fillId: 'evt_synthetic_entry_00000050' }, fillIds: ['evt_synthetic_entry_00000050'] })
  await expect(page.locator('.cp-execution b')).toHaveText('BUY')
  const beforeLocale = control.requests.length
  await checkCopy(page, 1, true)
  expect(control.requests).toHaveLength(beforeLocale)
  await page.clock.runFor(640)
  await expect.poll(() => paint(page)).toMatchObject({ frame: { fillId: 'evt_synthetic_exit_00000050' }, fillIds: ['evt_synthetic_entry_00000050', 'evt_synthetic_exit_00000050'] })
  await expect(page.locator('.cp-execution b')).toHaveText('SELL')
  await checkCopy(page, 2, true)
  expect(control.requests).toHaveLength(beforeLocale)
  const requests = reads(control, 'chronological-fill-markers')
  expect(requests.map(url => url.searchParams.get('cursor'))).toEqual([null, 'synthetic_chronological_page_000002'])
  expect(requests.map(url => url.searchParams.get('limit'))).toEqual(['100', '100'])
  expect(reads(control, 'fill-markers')).toHaveLength(0)
  expect(await page.evaluate(() => Reflect.get(window, 'automaticResultAudit'))).toMatchObject({ readerChronologicalMarkers: 2, readerBindingFailures: 0, readerCreated: 1, readerDisposed: 0 })
  expect(await page.locator('.cp-surface canvas').first().evaluate((node, old) => node === old, canvas)).toBe(true)
  await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  expect(await page.locator('.g-composer textarea').evaluate((node, old) => node === old, input)).toBe(true)
  await expect(page.locator('.g-composer textarea')).toHaveValue('자동 재생 뒤에도 보존할 질문')
  expect(await page.locator('.cp-surface canvas').first().evaluate((node, old) => node === old, canvas)).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'automaticResultAudit').readerDisposed)).toBe(1)
  expect(control.errors).toEqual([])
})

test('전용 reader 없는 기존 마커 경로는 7언어 첫 페이지 원문과 기존 GET 경로를 유지한다', async ({ page }) => {
  const { control } = await ready(page, false)
  await expect(page.locator('.cp-replay progress')).toBeAttached()
  await expect.poll(() => control.settled.filter(url => url.pathname.endsWith('/fill-markers')).length).toBe(1)
  const beforeLocale = control.requests.length
  await checkCopy(page, 2, false)
  expect(control.requests).toHaveLength(beforeLocale)
  expect(reads(control, 'fill-markers')).toHaveLength(1)
  expect(reads(control, 'chronological-fill-markers')).toHaveLength(0)
  expect(await page.evaluate(() => Reflect.get(window, 'automaticResultAudit'))).toMatchObject({ readerCreated: 0, markers: 1 })
  await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  expect(control.errors).toEqual([])
})
