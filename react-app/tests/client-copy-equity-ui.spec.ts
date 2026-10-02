import { expect, test } from '@playwright/test'
import { sharedHash, sourceSharedStrategies } from '../src/client-shared-strategies'
import { copyPreviewStorageKey } from '../src/client-copy-preview-store'

const source = sourceSharedStrategies()[0], owner = 'equity-ui@example.test'
const storageKey = copyPreviewStorageKey(owner)
const textAmount = (value: number) => `${value.toLocaleString('ko', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`

for (const width of [320, 1440]) test(`${width}px 최신 원본 카피는 청산 후 허구 포지션 없이 표시하고 같은 손익으로 종료·복원한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const mutations: string[] = []
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.url()) })
  await page.addInitScript(owner => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '카피 손익 검수', email: owner })), owner)
  await page.goto(`/${sharedHash({ view: 'copy-setup', nick: source.nick, period: 'all' })}`)
  await page.getByRole('textbox', { name: '카피 금액', exact: true }).fill('200')
  await page.getByRole('button', { name: '카피 시작', exact: true }).click()
  await expect(page.getByRole('region', { name: '카피 대시보드' })).toBeVisible()
  // Independent closed-window expectation, not a call to the implementation.
  const eq = source.result.eq, start = eq[eq.length - 31], last = eq.at(-1)!
  expect(Math.max(...source.result.trades.map(trade => trade.exit))).toBe(last.i)
  const realized = 200 * (last.v / start.v - 1), share = Math.max(0, realized) * .1
  const net = realized - share, est = 200 + net
  const metrics = page.locator('.cpd-sum .cpp-kpi')
  await expect(metrics.filter({ has: page.locator('small', { hasText: /^실현 손익$/ }) }).locator('b')).toHaveText(textAmount(realized))
  await expect(metrics.filter({ has: page.locator('small', { hasText: /^미실현 손익$/ }) }).locator('b')).toHaveText(textAmount(0))
  await expect(metrics.filter({ has: page.locator('small', { hasText: /^가용 잔고$/ }) }).locator('b')).toHaveText(textAmount(est))
  await page.locator('.cpd-card').getByRole('button', { name: '상세', exact: true }).click()
  await expect(page.locator('.cpp-empty')).toContainText('지금 열려 있는 카피 포지션이 없어요')
  await expect(page.getByRole('button', { name: '포지션 전체 정리', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath(`copy-equity-${width}.png`) })
  await page.getByRole('button', { name: '카피 종료', exact: true }).click()
  await expect(page.getByRole('dialog').locator('.cpp-kpi').filter({ hasText: '회수 금액' })).toContainText(textAmount(est))
  await page.getByRole('button', { name: '종료하고 정산', exact: true }).click()
  await expect(page.locator('.cpx')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/share\/library$/); await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  await page.getByRole('button', { name: '종료 포함', exact: true }).click()
  await page.locator('.cpd-card').getByRole('button', { name: '기록 보기', exact: true }).click()
  await expect(page.locator('.cpp-meta')).toContainText('종료됨')
  const raw = await page.evaluate(key => sessionStorage.getItem(key), storageKey), saved = JSON.parse(raw!)
  expect(saved.copies[0].settle).toMatchObject({ realized, unreal: 0, net, back: est, posOpen: false })
  expect(saved.copies[0].realizedBasis).toEqual({ model: 'equity-last-close-v1', startEquity: start.v, lastClosedEquity: last.v, lastClosedIndex: last.i })
  await page.reload()
  await expect(page.locator('.cpp-meta')).toContainText('종료됨')
  expect(await page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBe(raw)
  await expect(page.locator('.copy-storage-error')).toHaveCount(0)
  expect(mutations).toEqual([])
})
