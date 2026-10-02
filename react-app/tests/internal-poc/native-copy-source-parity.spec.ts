import { expect, test, type Page } from '@playwright/test'
import { copyProfileText } from '../../src/client-copy-profile-copy'
import { copySummaryText } from '../../src/client-copy-trading-copy'
import type { ClientLanguage } from '../../src/client-preferences'
import { sharedHash, sourceSharedStrategies } from '../../src/client-shared-strategies'
import { copyPreviewStorageKey } from '../../src/client-copy-preview-store'

const locales: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
const hub = (page: Page) => page.locator('#sharing-test-root')
const at = Date.UTC(2031, 0, 2, 9, 15)
async function mount(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.goto('/')
  await page.evaluate(async () => {
    const path = '/tests/fixtures/sharing-service-harness.tsx'
    Reflect.set(window, 'sharingHarness', (await import(/* @vite-ignore */ path)).mountSharing(true))
  })
  await expect(hub(page).locator('.native-strategies')).toBeVisible()
}
async function language(page: Page, value: ClientLanguage) {
  await page.evaluate(value => {
    localStorage.setItem('tethLang', value)
    window.dispatchEvent(new StorageEvent('storage', { key: 'tethLang', newValue: value, storageArea: localStorage }))
  }, value)
}
async function detail(page: Page) {
  await hub(page).getByRole('button', { name: /^따라가는 중/ }).click()
  await hub(page).locator('.cpd-card').getByRole('button', { name: '상세', exact: true }).click()
}
async function settle(page: Page, success: boolean) {
  await page.evaluate(success => Reflect.get(window, 'sharingHarness').settle('close', success), success)
}
test.beforeEach(async ({ page }) => { test.setTimeout(25_000); await mount(page) })
test.afterEach(async ({ page }) => { await expect(page.locator('body')).not.toContainText('PRIVATE_ADAPTER_PAYLOAD_NOT_FOR_DISPLAY') })

test('service calendar retains the source strategy-detail action in all seven locales', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 })
  await hub(page).locator('.strategy-list-link').first().click()
  await hub(page).locator('.shared-detail-profile').click()
  await hub(page).getByRole('button', { name: '손익 캘린더', exact: true }).click()
  for (const locale of locales) {
    await language(page, locale)
    const button = hub(page).getByRole('button', { name: copyProfileText(locale, '전략 상세에서 캘린더 보기'), exact: true })
    await expect(button).toBeVisible()
    await expect(hub(page).locator('.ss3-cal')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  }
  await language(page, 'ko')
  await page.evaluate(() => window.dispatchEvent(new Event('sharing-test-missing')))
  await expect(hub(page).locator('.ss3-cal')).toContainText('아직 제공되지 않은 정보')
  await hub(page).getByRole('button', { name: '전략 상세에서 캘린더 보기', exact: true }).click()
  await expect(hub(page).locator('.ss3-dtitle')).toContainText('공급된 전략')
  await expect(hub(page).locator('.client-shared-performance').first()).toBeVisible()
})

test('copy header renders only the supplied valid start instant and localizes without changing it', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 })
  await detail(page)
  const time = hub(page).locator('.cpx .cpp-meta time')
  await expect(time).toHaveAttribute('datetime', new Date(at).toISOString())
  for (const locale of locales) {
    await language(page, locale)
    const expected = await page.evaluate(({ locale, at }) => new Date(at).toLocaleString(locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }), { locale, at })
    await expect(time).toHaveText(copySummaryText(locale, '{date} 시작', { date: expected }))
    await expect(time).toHaveAttribute('datetime', new Date(at).toISOString())
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  }
  for (const value of [null, NaN, Infinity, 8.64e15 + 1]) {
    await page.evaluate(value => window.dispatchEvent(new CustomEvent('sharing-test-started-at', { detail: value })), value)
    await expect(time).toHaveCount(0)
    await expect(hub(page).locator('.cpp-meta')).not.toContainText('Invalid Date')
  }
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('sharing-test-started-at', { detail: 0 })))
  await expect(time).toHaveAttribute('datetime', '1970-01-01T00:00:00.000Z')
})

test('closing a copy returns to followed strategies only after successful settlement', async ({ page }) => {
  await detail(page)
  await hub(page).getByRole('button', { name: '카피 종료', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '계속 카피', exact: true }).click()
  await expect(hub(page).locator('.cpx')).toBeVisible()
  await hub(page).getByRole('button', { name: '카피 종료', exact: true }).click()
  await dialog.getByRole('button', { name: '종료하고 정산', exact: true }).click()
  await expect(hub(page).locator('.cpx')).toBeVisible()
  await settle(page, false)
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(hub(page).locator('.cpx')).toBeVisible()
  await dialog.getByRole('button', { name: '종료하고 정산', exact: true }).click()
  await settle(page, true)
  await expect(dialog).toHaveCount(0)
  await expect(hub(page).locator('.cpx')).toHaveCount(0)
  await expect(hub(page).getByRole('button', { name: /^따라가는 중/ })).toHaveAttribute('aria-pressed', 'true')
  await hub(page).getByRole('button', { name: '종료 포함', exact: true }).click()
  await expect(hub(page).locator('.cpd-card')).toContainText('종료됨')
})

test('a successful close arriving after owner replacement cannot navigate the new owner', async ({ page }) => {
  await detail(page)
  await hub(page).getByRole('button', { name: '카피 종료', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '종료하고 정산', exact: true }).click()
  await page.evaluate(() => window.dispatchEvent(new Event('sharing-test-owner')))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await settle(page, true)
  await expect(hub(page).getByRole('button', { name: '전략 찾기', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(hub(page).locator('.cpx')).toHaveCount(0)
})

test('copy detail retains active header actions but omits them for a confirmed closed account', async ({ page }) => {
  await detail(page)
  const header = hub(page).locator('.cpx .cpp-head')
  for (const name of ['잔고 조정', '설정', '카피 종료']) {
    await expect(header.getByRole('button', { name, exact: true })).toBeEnabled()
  }
  await header.getByRole('button', { name: '설정', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('따라갈 페어:')
  await page.getByRole('dialog').locator('.ss3-dacts').getByRole('button', { name: '닫기', exact: true }).click()
  await header.getByRole('button', { name: '카피 종료', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '종료하고 정산', exact: true }).click()
  await settle(page, true)
  await hub(page).getByRole('button', { name: '종료 포함', exact: true }).click()
  await hub(page).locator('.cpd-card').getByRole('button', { name: '기록 보기', exact: true }).click()
  await expect(header).toContainText('종료됨')
  await expect(header.locator('.cpp-acts')).toHaveCount(0)
  for (const name of ['잔고 조정', '설정', '카피 종료']) {
    await expect(header.getByRole('button', { name, exact: true })).toHaveCount(0)
  }
  await expect(hub(page).locator('.cpx .cpp-tabs button')).toHaveCount(5)
})

test('public preview keeps its stored start time and follows the same source close destination', async ({ page }) => {
  const owner = 'copy-source-parity@example.test', key = copyPreviewStorageKey(owner), seed = sourceSharedStrategies()[0]
  await page.addInitScript(owner => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '원본 동선 검수', email: owner })), owner)
  await page.goto(`/${sharedHash({ view: 'copy-setup', nick: seed.nick, period: 'all' })}`)
  // beforeEach mounted a native harness at the same pathname. A hash-only
  // navigation does not reload that document or execute the preview login seed.
  await page.reload()
  await page.getByRole('textbox', { name: '카피 금액', exact: true }).fill('200')
  await page.getByRole('button', { name: '카피 시작', exact: true }).click()
  const storedAt = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).copies[0].at as number, key)
  await page.locator('.cpd-card').getByRole('button', { name: '상세', exact: true }).click()
  await expect(page.locator('.cpx .cpp-meta time')).toHaveAttribute('datetime', new Date(storedAt).toISOString())
  await page.getByRole('button', { name: '카피 종료', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '종료하고 정산', exact: true }).click()
  await expect(page.locator('.cpx')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/share\/library$/)
  await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).copies[0].at as number, key)).toBe(storedAt)
})
