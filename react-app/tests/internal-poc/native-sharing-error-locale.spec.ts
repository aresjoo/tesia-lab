import { expect, test, type Locator, type Page } from '@playwright/test'
import { sharingActionFailed, sharingUnavailable } from '../../src/client-sharing-presentation'
import type { ClientLanguage } from '../../src/client-preferences'

const languages: ClientLanguage[] = ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']
const hub = (page: Page) => page.locator('#sharing-test-root')
async function mount(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.goto('/')
  await page.evaluate(async () => {
    const path = '/tests/fixtures/sharing-service-harness.tsx'
    const { mountSharing } = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'sharingHarness', mountSharing(true))
  })
  await expect(hub(page).locator('.native-strategies')).toBeVisible()
}
async function language(page: Page, value: ClientLanguage) {
  await page.evaluate(value => {
    localStorage.setItem('tethLang', value)
    window.dispatchEvent(new StorageEvent('storage', { key: 'tethLang', newValue: value, storageArea: localStorage }))
  }, value)
}
async function settle(page: Page, kind: string, success = false) {
  await page.evaluate(({ kind, success }) => Reflect.get(window, 'sharingHarness').settle(kind, success), { kind, success })
}
async function verifyLocales(page: Page, target: Locator, unavailable = false) {
  const text = unavailable ? sharingUnavailable : sharingActionFailed
  await expect(target).toHaveText(text('ko'))
  const element = await target.elementHandle()
  for (const locale of languages) {
    await language(page, locale)
    await expect(target).toHaveText(text(locale))
    expect(await target.evaluate((node, original) => node === original, element)).toBe(true)
    await expect(hub(page)).not.toContainText('PRIVATE_ADAPTER_PAYLOAD_NOT_FOR_DISPLAY')
  }
}
async function detail(page: Page) {
  await hub(page).getByRole('link', { name: '공급된 전략', exact: true }).click()
  await expect(hub(page).locator('.ss3-dtitle')).toBeVisible()
}
async function follow(page: Page) {
  await hub(page).getByRole('button', { name: /^따라가는 중/ }).click()
}
async function ownerChange(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('sharing-test-owner')))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(hub(page).getByRole('alert')).toHaveCount(0)
  await expect(hub(page).locator('.ss3-notice')).toHaveCount(0)
}
test.beforeEach(async ({ page }) => { test.setTimeout(25_000); await mount(page) })

test('service copy start failure translates live, preserves amount and retries once', async ({ page }) => {
  await detail(page)
  await hub(page).locator('.shared-detail-profile').click()
  await hub(page).getByRole('button', { name: '카피하기', exact: true }).click()
  const amount = hub(page).getByRole('textbox', { name: '카피 금액', exact: true })
  await amount.fill('100')
  const button = hub(page).locator('.cps-cta')
  await button.click(); await settle(page, 'copy')
  await verifyLocales(page, hub(page).getByRole('alert'))
  await expect(amount).toHaveValue('100')
  await button.click(); await expect(hub(page).getByRole('alert')).toHaveCount(0)
  await language(page, 'fr'); await settle(page, 'copy')
  await expect(hub(page).getByRole('alert')).toHaveText(sharingActionFailed('fr'))
  await ownerChange(page)
})

for (const [kind, label, confirm] of [
  ['adjust', '잔고 조정', '확인'], ['flatten', '포지션 전체 정리', '정리하기'], ['close', '카피 종료', '종료하고 정산'],
] as const) test(`service ${kind} failure translates in the same confirmation dialog`, async ({ page }) => {
  await follow(page)
  await hub(page).locator('.cpd-card').getByRole('button', { name: '상세', exact: true }).click()
  await hub(page).getByRole('button', { name: label, exact: true }).click()
  const dialog = page.getByRole('dialog')
  if (kind === 'adjust') {
    await dialog.getByRole('button', { name: '출금', exact: true }).click()
    await dialog.getByRole('textbox').fill('50')
  }
  await dialog.getByRole('button', { name: confirm, exact: true }).click()
  await settle(page, kind)
  await verifyLocales(page, dialog.getByRole('alert'))
  if (kind === 'adjust') await expect(dialog.getByRole('textbox')).toHaveValue('50')
  await dialog.getByRole('button', { name: confirm, exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await settle(page, kind, true)
  await expect(dialog).toHaveCount(0)
})

test('trader analysis error follows all locales without leaking exception or resetting profile', async ({ page }) => {
  await detail(page)
  await hub(page).locator('.shared-detail-profile').click()
  const button = hub(page).locator('.cpp-chips button.obtn')
  await button.click(); await settle(page, 'analyze')
  await verifyLocales(page, hub(page).getByRole('alert'))
  await button.click(); await expect(hub(page).getByRole('alert')).toHaveCount(0)
  await ownerChange(page); await settle(page, 'analyze')
  await expect(hub(page).getByRole('alert')).toHaveCount(0)
})

for (const kind of ['validate-copy', 'validate-confirm'] as const) test(`${kind} failure retains copy conditions and translates inside its modal`, async ({ page }) => {
  await detail(page)
  await hub(page).getByRole('button', { name: '따라하기', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  if (kind === 'validate-confirm') {
    await settle(page, 'validate-copy', true)
    await dialog.getByRole('button', { name: '확정하고 검증 시작', exact: true }).click()
  }
  await settle(page, kind)
  await verifyLocales(page, dialog.getByRole('alert'))
  await expect(dialog.locator('.ss3-copy-metrics')).toContainText(kind === 'validate-copy' ? '—' : '+5.6%')
  await ownerChange(page)
})

for (const action of ['retry', 'back'] as const) test(`copy confirmation ${action} clears the prior failure without losing conditions`, async ({ page }) => {
  await detail(page)
  await hub(page).getByRole('button', { name: '따라하기', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const conditions = await dialog.locator('select').evaluateAll(elements => elements.map(element => (element as HTMLSelectElement).value))
  await dialog.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  await settle(page, 'validate-copy', true)
  const confirm = dialog.getByRole('button', { name: '확정하고 검증 시작', exact: true })
  await confirm.click(); await settle(page, 'validate-confirm')
  await expect(dialog.getByRole('alert')).toHaveText(sharingActionFailed('ko'))
  if (action === 'retry') {
    await confirm.click()
    await expect(confirm).toHaveAttribute('aria-busy', 'true')
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    await expect(dialog.locator('.ss3-copy-metrics')).toContainText('+5.6%')
  }
  await dialog.getByRole('button', { name: '뒤로', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  expect(await dialog.locator('select').evaluateAll(elements => elements.map(element => (element as HTMLSelectElement).value))).toEqual(conditions)
  if (action === 'retry') {
    await settle(page, 'validate-confirm')
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: '다음: 예상 결과 보기', exact: true })).toBeEnabled()
  }
  await expect(hub(page)).not.toContainText('PRIVATE_ADAPTER_PAYLOAD_NOT_FOR_DISPLAY')
})

for (const [kind, label] of [['watch', '관심 전략'], ['analyze', 'TETH에게 분석시키기']] as const) test(`strategy ${kind} notice translates and owner change retires it`, async ({ page }) => {
  await detail(page)
  const button = hub(page).getByRole('button', { name: label, exact: true })
  await button.click(); await settle(page, kind)
  await verifyLocales(page, hub(page).locator('.ss3-notice'))
  await expect(button).toBeEnabled()
  await button.click(); await ownerChange(page); await settle(page, kind)
  await expect(hub(page).locator('.ss3-notice')).toHaveCount(0)
})

for (const [kind, label] of [['resume', '이어서 진행'], ['edit', '설정 변경'], ['archive', '중지'], ['remove', '목록에서 삭제']] as const) test(`follow ${kind} failure changes language without changing supplied records`, async ({ page }) => {
  await follow(page)
  const list = hub(page).locator('.client-shared-follow-list')
  const card = list.locator('article')
  if (kind === 'remove') {
    await card.getByRole('button', { name: '중지', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: '중지하고 보관', exact: true }).click()
    await settle(page, 'archive', true)
  }
  await card.getByRole('button', { name: label, exact: true }).click()
  if (kind === 'archive') await page.getByRole('dialog').getByRole('button', { name: '중지하고 보관', exact: true }).click()
  await settle(page, kind)
  await verifyLocales(page, kind === 'archive' ? page.getByRole('dialog').getByRole('alert') : list.getByRole('alert'))
  await expect(card).toHaveCount(1)
  await ownerChange(page)
})

test('unavailable share URL remains disabled across locales and owner retirement', async ({ page }) => {
  await detail(page)
  const button = hub(page).locator('.shared-detail-share')
  const element = await button.elementHandle()
  const saved = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
  for (const locale of languages) {
    await language(page, locale)
    await expect(button).toBeDisabled()
    await expect(hub(page).locator('.ss3-notice')).toHaveCount(0)
    expect(await button.evaluate((node, original) => node === original, element)).toBe(true)
    expect(await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))).toEqual(saved)
  }
  await ownerChange(page)
})
