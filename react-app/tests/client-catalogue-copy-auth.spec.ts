import { expect, test, type Page } from '@playwright/test'
import { catalogueStrategies, catalogueSourceSha } from '../src/client-catalogue'
import { catalogueCopyStorageKey } from '../src/client-catalogue-copy-store'
import { clientUserStrategyKey } from '../src/client-user-strategy-store'

const email = 'copy-auth-host@example.test'
async function signup(page: Page) {
  const dialog = page.locator('.ca-auth')
  await dialog.locator('input[type=email]').fill(email)
  await dialog.locator('button[type=submit]').click()
  await dialog.locator('input[autocomplete=new-password]').fill('Mock-password-123!')
  await dialog.locator('button[type=submit]').click()
  await dialog.locator('input[autocomplete=one-time-code]').fill('123456')
  await dialog.locator('button[type=submit]').click()
  await dialog.getByLabel('연령', { exact: true }).fill('28')
  await dialog.getByRole('button', { name: '시장에 입장하기', exact: true }).click()
  await expect(dialog).toHaveCount(0)
}
async function noAutomaticRecords(page: Page) {
  const records = await page.evaluate(keys => keys.map(key => sessionStorage.getItem(key)), [catalogueCopyStorageKey(email), clientUserStrategyKey(email)])
  for (const [index, raw] of records.entries()) if (raw !== null) expect(index === 0 ? JSON.parse(raw).copies : JSON.parse(raw)).toEqual([])
}
async function copy(page: Page, id = 'f1') {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/share/s/' + encodeURIComponent(id))
  await page.locator('.catalogue-source-header .shared-detail-actions > .wbtn').click()
  await expect(page.locator('.ca-auth')).toContainText('로그인 또는 회원가입')
}

test('비회원 복사 가입 취소는 상세·guest 저장원문을 보존한다', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('teth-sharing-watch:guest', '["f2"]'))
  await copy(page)
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/#\/share\/s\/f1$/)
  expect(await page.evaluate(() => sessionStorage.getItem('teth-sharing-watch:guest'))).toBe('["f2"]')
  expect(await page.evaluate(() => history.state?.tethPlanCatalogue ?? null)).toBeNull()
  await noAutomaticRecords(page)
})

for (const alias of [false, true]) test(`복사 가입 ${alias ? '별칭' : 'ID'}는 같은 canonical 전략의 거래소 플랜으로 한 번만 재개한다`, async ({ page }) => {
  await copy(page, alias ? catalogueStrategies.find(s => s.id === 'f1')!.name : 'f1')
  await signup(page)
  await expect(page).toHaveURL(/#\/connect\/plan\?exchange=binance$/)
  expect(await page.evaluate(() => history.state.tethPlanCatalogue)).toEqual({ owner: email, sourceSha: catalogueSourceSha, id: 'f1', returnHash: '#/share/s/f1' })
  await noAutomaticRecords(page)
  await page.locator('.client-connection-plan .cpl-back').click()
  await expect(page).toHaveURL(/#\/share\/s\/f1$/)
  await expect(page.locator('.catalogue-source-header')).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/#\/share\/s\/f1$/)
  await noAutomaticRecords(page)
})

test('복사 가입 도중 다른 전략으로 이동하면 이전 복사 의도를 폐기한다', async ({ page }) => {
  await copy(page)
  await page.evaluate(() => { history.pushState(null, '', '#/share/s/f2'); window.dispatchEvent(new Event('teth:navigate')) })
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/share\/s\/f2$/)
  await page.locator('.shared-detail-watch').click()
  await signup(page)
  await expect(page).toHaveURL(/#\/share\/s\/f2$/)
  expect(await page.evaluate(() => history.state?.tethPlanCatalogue ?? null)).toBeNull()
  expect(await page.evaluate(email => JSON.parse(sessionStorage.getItem(`teth-sharing-watch:account:${encodeURIComponent(email)}`)!), email)).toEqual(['f2'])
  await noAutomaticRecords(page)
})
