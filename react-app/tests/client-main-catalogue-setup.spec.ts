import { expect, test, type Page } from '@playwright/test'
import { installMainCatalogueSetup, mainCatalogueSetupOwner } from './fixtures/client-main-catalogue-setup-entry'
import { catalogueCopyStorageKey } from '../src/client-catalogue-copy-store'

type Fixture = { patch(patch: { owner?: string; sourceSha?: string; revision?: string }): void; settle(index: number): void; calls(): { aborted: boolean }[] }
const fixture = (page: Page, action: 'settle' | 'revision' | 'foreign' | 'source') => page.evaluate(action => {
  const port = Reflect.get(window, 'mainCatalogueSetupFixture') as Fixture
  if (action === 'settle') port.settle(0)
  else port.patch(action === 'revision' ? { revision: 'observed-mock-2' } : action === 'foreign' ? { owner: 'other@example.test' } : { sourceSha: 'wrong-source' })
}, action)
async function open(page: Page) {
  await page.goto('/#/share/s/f1')
  await page.locator('.catalogue-source-header .shared-detail-actions > .wbtn').click()
}
const records = (page: Page) => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? 'null'), catalogueCopyStorageKey(mainCatalogueSetupOwner))

test('실제 Main 공급 설정 확정은 computed Mock 복사 원장→관리→설정→reload에 이어진다', async ({ page }) => {
  await installMainCatalogueSetup(page); await open(page)
  const sheet = page.getByRole('dialog', { name: '전략 복사', exact: true })
  await expect(sheet).toBeVisible(); await expect(sheet.locator('.ccs-hint').first()).toContainText('사용 가능 $1,000.00')
  await sheet.getByLabel('복사 예산', { exact: true }).fill('500')
  await sheet.getByRole('button', { name: '전략 복사 시작', exact: true }).click()
  await expect(sheet).toHaveCount(0)
  const saved = await records(page)
  expect(saved).toMatchObject({ owner: mainCatalogueSetupOwner, spot: 500, copies: [{ record: { binding: { strategyId: 'f1' }, settings: { amount: 500, loss: -20, existing: 'skip', cap: 95 } } }] })
  expect(saved.copies[0].record.ledger).toHaveLength(1)
  await page.locator('.catalogue-source-header .shared-detail-actions > .wbtn').click()
  const management = page.locator('.catalogue-copy-management')
  await expect(management).toBeVisible(); await management.getByRole('button', { name: '설정', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('20%')
  await page.keyboard.press('Escape'); await page.reload()
  await expect(page.locator('.catalogue-copy-management')).toBeVisible()
  expect(await records(page)).toEqual(saved)
})

for (const mode of ['foreign', 'unsupplied'] as const) test(`${mode} 공급은 Main에서 설정창·복사기록 없이 플랜으로 이동한다`, async ({ page }) => {
  await installMainCatalogueSetup(page, mode); await open(page)
  await expect(page).toHaveURL(/#\/connect\/plan\?exchange=binance$/)
  await expect(page.getByRole('dialog', { name: '전략 복사', exact: true })).toHaveCount(0)
  expect((await records(page))?.copies ?? []).toEqual([])
})

for (const change of ['revision', 'foreign', 'source'] as const) test(`${change} 공급 교체는 실제 Main 대기 확인을 중단하고 늦은 성공을 저장하지 않는다`, async ({ page }) => {
  await installMainCatalogueSetup(page, 'deferred'); await open(page)
  const sheet = page.getByRole('dialog', { name: '전략 복사', exact: true })
  await sheet.getByLabel('복사 예산', { exact: true }).fill('500')
  await sheet.getByRole('button', { name: '전략 복사 시작', exact: true }).click()
  await expect(sheet.getByRole('button', { name: '설정 확인 중', exact: true })).toBeDisabled()
  await fixture(page, change); await expect(sheet).toHaveCount(0)
  expect(await page.evaluate(() => (Reflect.get(window, 'mainCatalogueSetupFixture') as Fixture).calls())).toEqual([{ aborted: true }])
  await fixture(page, 'settle')
  expect((await records(page))?.copies ?? []).toEqual([])
})

test('확인 취소 후 실제 로그아웃은 이전 owner의 늦은 확인을 저장하지 않는다', async ({ page }) => {
  await installMainCatalogueSetup(page, 'deferred'); await open(page)
  const sheet = page.getByRole('dialog', { name: '전략 복사', exact: true })
  await sheet.getByLabel('복사 예산', { exact: true }).fill('500')
  await sheet.getByRole('button', { name: '전략 복사 시작', exact: true }).click()
  await page.keyboard.press('Escape')
  const hamburger = page.locator('.client-hamburger')
  if (await hamburger.isVisible()) { await hamburger.focus(); await hamburger.click() }
  else await page.locator('.client-rail-logo-row button').click()
  await page.locator('[data-sidebar-action=profile-settings]:visible').click()
  await page.locator('[data-account-action=logout]').click()
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-profile-preview'))).toBeNull()
  expect(await page.evaluate(() => (Reflect.get(window, 'mainCatalogueSetupFixture') as Fixture).calls())).toEqual([{ aborted: true }])
  await fixture(page, 'settle'); expect((await records(page))?.copies ?? []).toEqual([])
})
