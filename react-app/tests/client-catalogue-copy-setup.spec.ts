import { expect, test, type Page } from '@playwright/test'
import { catalogueStrategies, catalogueSourceSha } from '../src/client-catalogue'
import { catalogueCopyScope, catalogueCopyMinimum, catalogueCopySettings } from '../src/client-catalogue-copy-setup'
import copy from '../src/client-catalogue-copy-setup-copy.json' with { type: 'json' }
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import source from './fixtures/catalogue-copy-minimum-runtime.json' with { type: 'json' }

test.setTimeout(35_000)
declare global { interface Window { copySetupHarness: ReturnType<typeof import('./fixtures/catalogue-copy-setup-harness')['mountCatalogueCopy']> } }
async function mount(page: Page) {
  await page.goto('/')
  await page.evaluate(async () => { const path = '/tests/fixtures/catalogue-copy-setup-harness.tsx'; window.copySetupHarness = (await import(path)).mountCatalogueCopy() })
  await expect(page.locator('.ss3-dtitle')).toBeVisible()
}
const open = (page: Page) => page.locator('.shared-detail-actions .wbtn').click()

for (const width of [320, 1440]) test(`${width}px 원본 React 설정창의 확정은 실제 preview Worker와 저장으로 이어진다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 }); await page.goto('/')
  await page.evaluate(async () => { const path = '/tests/fixtures/catalogue-copy-setup-harness.tsx'; window.copySetupHarness = (await import(path)).mountCatalogueCopy(true) })
  await expect(page.locator('.ss3-dtitle')).toBeVisible(); await open(page)
  const sheet = page.getByRole('dialog', { name: '전략 복사', exact: true })
  await expect(sheet.locator('.ccs-hint').first()).toContainText('사용 가능 $1,000.00')
  await sheet.getByLabel('복사 예산', { exact: true }).fill('500')
  await page.screenshot({ path: info.outputPath('persisted-copy-sheet.png') })
  await sheet.getByRole('button', { name: '전략 복사 시작', exact: true }).click()
  await expect(sheet).not.toBeVisible()
  const saved = await page.evaluate(() => window.copySetupHarness.account())
  expect(saved).toMatchObject({ owner: 'one', spot: 500, copies: [{ record: { binding: { strategyId: 'f1' }, settings: { amount: 500, existing: 'skip', loss: -20, cap: 95 } } }] })
  expect(saved?.copies[0].record.ledger).toHaveLength(1)
  await expect(page.locator('.shared-detail-actions .wbtn')).toBeFocused()
  // Existing copies now open management, never another setup or deposit.
  await open(page)
  const management = page.locator('.catalogue-copy-management')
  await expect(management.getByRole('button', { name: '예산 조정', exact: true })).toBeEnabled()
  await expect(sheet).toHaveCount(0)
  expect(await page.evaluate(() => window.copySetupHarness.account())).toEqual(saved)
  await management.getByRole('tab', { name: '예산 내역', exact: true }).click()
  await expect(management.locator('.cq-budget .cq-row')).toHaveCount(1)
  await expect(management.locator('.cq-budget .cq-row')).toContainText('500.00')
  await page.evaluate(() => window.copySetupHarness.dispose())
})

test('31개 원본 최소 예산·정수 한도·유효 설정과 소유자/원본/전략 결속', () => {
  expect(source.sha).toBe(catalogueSourceSha)
  expect(createHash('sha256').update(source.code).digest('hex')).toBe(source.codeSha256)
  const context = vm.createContext({}); vm.runInContext(source.code, context)
  for (const strategy of catalogueStrategies) {
    const min = catalogueCopyMinimum(strategy)
    context.s = { cfg: strategy }; expect(min).toBe(vm.runInContext('mkMin(s)', context, { timeout: 1000 }))
    expect([100, 200, 300, 500]).toContain(min)
    expect(catalogueCopySettings(strategy, min, String(min), -20, 'skip', '95')).toEqual({ amount: min, loss: -20, existing: 'skip', cap: 95 })
    for (const amount of ['', '1e4', '-500', 'Infinity', 'NaN', '500foo', String(min - 1), '1001']) expect(catalogueCopySettings(strategy, 1000, amount, -20, 'skip', '95')).toBeNull()
    for (const cap of ['', '4', '96', '50.5', '90x']) expect(catalogueCopySettings(strategy, 1000, '1000', -20, 'skip', cap)).toBeNull()
    expect(catalogueCopySettings(strategy, 1000.75, '1000.75', -50, 'copy', '5')).not.toBeNull()
  }
  const setup = { owner: 'one', sourceSha: catalogueSourceSha, strategyId: 'f1', revision: 'v1', available: 1000, onConfirm: async () => {} }
  expect(catalogueCopyScope(setup, 'one', 'f1')).not.toBeNull()
  for (const bad of [{ ...setup, owner: 'other' }, { ...setup, sourceSha: 'old' }, { ...setup, strategyId: 'f2' }, { ...setup, available: NaN }, { ...setup, available: -1 }, { ...setup, revision: '' }]) expect(catalogueCopyScope(bad, 'one', 'f1')).toBeNull()
  expect(catalogueCopyScope(setup, null, 'f1')).toBeNull()
  for (const words of Object.values(copy)) {
    expect(Object.keys(words)).toEqual(Object.keys(copy.ko))
    for (const key of Object.keys(copy.ko) as (keyof typeof copy.ko)[]) expect(words[key].match(/\{\w+\}/g) ?? []).toEqual(copy.ko[key].match(/\{\w+\}/g) ?? [])
  }
})

for (const width of [320, 1440]) test(`${width}px 원본 복사창·실시간 요약·키보드·실패 재시도·배경 보존`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 }); await mount(page)
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await open(page)
  const sheet = page.getByRole('dialog', { name: '전략 복사', exact: true }), amount = sheet.getByLabel('복사 예산', { exact: true })
  await expect(sheet).toHaveCSS('background-color', 'rgb(48, 48, 48)')
  await expect(sheet.getByRole('button', { name: '전략 복사 시작', exact: true })).toBeDisabled()
  await amount.fill('99'); await expect(sheet.locator('.ccs-error').first()).toContainText('최소')
  await amount.fill('1001'); await expect(sheet.locator('.ccs-error').first()).toHaveText('사용 가능 금액보다 큽니다')
  await sheet.getByRole('button', { name: '최대', exact: true }).click(); await expect(amount).toHaveValue('1000')
  const radio = sheet.getByRole('radio', { name: '20%', exact: true })
  await radio.focus(); await radio.press('ArrowRight'); await expect(sheet.getByRole('radio', { name: '30%', exact: true })).toBeChecked()
  await expect(sheet.locator('.ccs-summary')).toContainText('$300.00 (30%)')
  await sheet.getByRole('button', { name: '세부 설정', exact: true }).click()
  await sheet.getByRole('radio', { name: '현재 포지션부터', exact: true }).click()
  await sheet.getByLabel('주문당 예산 한도', { exact: true }).fill('96')
  await expect(sheet.getByRole('button', { name: '전략 복사 시작', exact: true })).toBeDisabled()
  await sheet.getByLabel('주문당 예산 한도', { exact: true }).fill('50')
  await sheet.getByRole('button', { name: '세부 설정 접기', exact: true }).click()
  await expect(sheet.locator('.ccs-summary')).toContainText('50%')
  await sheet.getByRole('button', { name: '전략 복사 시작', exact: true }).click()
  await expect(sheet.getByRole('button', { name: '설정 확인 중', exact: true })).toBeDisabled()
  await expect(sheet.getByRole('button', { name: '설정 확인 중', exact: true })).toBeFocused()
  await sheet.getByRole('button', { name: '설정 확인 중', exact: true }).press('Enter')
  expect((await page.evaluate(() => window.copySetupHarness.snapshot())).calls).toEqual([{ settings: { amount: 1000, loss: -30, existing: 'copy', cap: 50 }, aborted: false }])
  await page.evaluate(() => window.copySetupHarness.settle(0, false))
  await expect(sheet.locator('footer [role="alert"]')).toHaveText(copy.ko.failed)
  await expect(amount).toHaveValue('1000'); await expect(sheet).not.toContainText('PRIVATE_ACCOUNT_PAYLOAD')
  await page.screenshot({ path: info.outputPath(`copy-${width}.png`) })
  await sheet.getByRole('button', { name: '전략 복사 시작', exact: true }).click()
  await page.evaluate(() => window.copySetupHarness.settle(1))
  await expect(sheet).toHaveCount(0); await expect(page.locator('.shared-detail-actions .wbtn')).toBeFocused()
  expect(errors).toEqual([])
})

test('닫기·계정교체·원본 revision 교체는 대기 확인을 취소하며 늦은 성공은 새창을 닫지 않는다', async ({ page }) => {
  await mount(page); await open(page)
  await page.getByLabel('복사 예산', { exact: true }).fill('1000'); await page.getByRole('button', { name: '전략 복사 시작', exact: true }).click()
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await page.evaluate(() => window.copySetupHarness.snapshot())).calls[0].aborted).toBe(true)
  await open(page); await page.evaluate(() => window.copySetupHarness.settle(0)); await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('복사 예산', { exact: true }).fill('500'); await page.getByRole('button', { name: '전략 복사 시작', exact: true }).click()
  await page.evaluate(() => window.copySetupHarness.patch({ revision: 'v2' })); await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await page.evaluate(() => window.copySetupHarness.snapshot())).calls[1].aborted).toBe(true)
  await open(page); await page.evaluate(() => window.copySetupHarness.patch({ owner: 'two' })); await expect(page.getByRole('dialog')).toHaveCount(0)
  await open(page); expect((await page.evaluate(() => window.copySetupHarness.snapshot())).actions).toEqual(['plan:f1'])
  await page.evaluate(() => window.copySetupHarness.patch({ owner: 'one' })); await expect(page.getByRole('dialog')).toHaveCount(0)
  await open(page); await page.evaluate(() => window.copySetupHarness.patch({ ready: false })); await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.evaluate(() => window.copySetupHarness.patch({ ready: true })); await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('연결 복귀 resume는 정확한 전략에 한 번만 표시하고 새 요청만 다시 연다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => window.copySetupHarness.patch({ ready: false })); await open(page)
  expect((await page.evaluate(() => window.copySetupHarness.snapshot())).actions).toEqual(['plan:f1'])
  await page.evaluate(() => window.copySetupHarness.patch({ ready: true, resumeId: 'return1' })); await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape'); await page.evaluate(() => window.copySetupHarness.patch({ revision: 'v2' })); await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.evaluate(() => window.copySetupHarness.patch({ resumeId: 'return2' })); await expect(page.getByRole('dialog')).toBeVisible()
  await page.evaluate(() => window.copySetupHarness.patch({ id: 'd1', resumeId: '' })); await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.ss3-dtitle')).toHaveText(catalogueStrategies.find(s => s.id === 'd1')!.name)
})

test('320px·7개 언어·200% 글자에서도 본문과 하단 동작이 분리되고 가로 넘침이 없다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 720 }); await mount(page); await open(page)
  for (const language of Object.keys(copy) as (keyof typeof copy)[]) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', language) }, language)
    const sheet = page.getByRole('dialog'), words = copy[language]
    await expect(sheet.getByRole('heading', { name: words.title, exact: true })).toBeVisible()
    await sheet.getByLabel(words.budget, { exact: true }).fill('1000.75')
    if (await sheet.getByRole('button', { name: words.details, exact: true }).count()) await sheet.getByRole('button', { name: words.details, exact: true }).click()
    expect(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await expect(sheet.getByRole('button', { name: words.start, exact: true })).toBeVisible()
    expect(await sheet.locator('.ccs-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  }
  await page.evaluate(() => { for (const el of document.querySelectorAll<HTMLElement>('.catalogue-copy-sheet h2,.catalogue-copy-sheet label,.catalogue-copy-sheet button,.catalogue-copy-sheet p,.catalogue-copy-sheet dt,.catalogue-copy-sheet dd')) el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * 2}px` })
  const sheet = page.getByRole('dialog')
  expect(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  expect(await sheet.locator('.ccs-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath('copy-fr-320-zoom.png') })
})

test('입력 중 Enter도 대기 단추에 초점을 보존하고 고대비 초점 및 IME 취소를 지킨다', async ({ page }) => {
  await mount(page); await open(page)
  const amount = page.getByLabel('복사 예산', { exact: true })
  await amount.fill('1000')
  await amount.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
  expect((await page.evaluate(() => window.copySetupHarness.snapshot())).calls).toHaveLength(0)
  await amount.dispatchEvent('keydown', { key: 'Escape', isComposing: true }); await expect(page.getByRole('dialog')).toBeVisible()
  await amount.press('Enter'); await expect(page.getByRole('button', { name: '설정 확인 중', exact: true })).toBeFocused()
  await page.evaluate(() => window.copySetupHarness.settle(0, false)); await expect(page.getByRole('button', { name: '전략 복사 시작', exact: true })).toBeFocused()
  await page.emulateMedia({ forcedColors: 'active' }); await amount.focus()
  expect(await amount.evaluate(el => getComputedStyle(el.parentElement!).outlineStyle)).toBe('solid')
  await page.keyboard.press('Escape'); await expect(page.locator('.shared-detail-actions .wbtn')).toBeFocused()
})
