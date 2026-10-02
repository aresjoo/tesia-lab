import { expect, test } from '@playwright/test'
import { billingText } from '../src/client-settings-billing-copy'

const sample = {
  sourceLabel: 'SUPPLIED TEST',
  subscription: { state: 'active', amountLabel: '100 USDT / 월', description: '다음 결제일은 2026년 10월 30일입니다.', cancellation: { summary: 'SUPPLIED CANCELLATION TERMS', confirmation: { title: 'SUPPLIED CONFIRM', description: 'SUPPLIED DATE', consequences: ['SUPPLIED CONSEQUENCE'], confirmLabel: 'CONFIRM' } } },
  methods: [{ id: 'a', brand: 'TEST CARD', last4: '4242', expiryLabel: '2028년 12월 만료', isDefault: true, removable: false }],
  information: { email: 'supplied@example.invalid', name: 'SUPPLIED NAME', address: 'SUPPLIED ADDRESS' }, invoices: [],
}

test('source billing summary is one card and management never stacks dialogs', async ({ page }, info) => {
  await page.goto('/tests/fixtures/client-settings-billing.html#/settings/billing')
  await expect(page.locator('.stg-billing-summary > .stg-card')).toHaveCount(1)
  await expect(page.locator('.stg-billing > .stg-sec')).toHaveCount(2)
  await expect(page.locator('.stg-main > .stg-sec')).toHaveCount(0)
  await expect(page.locator('.stg-billing-summary')).toContainText('TEST CARD A')
  await expect(page.locator('.stg-billing-summary')).toContainText('billing@example.invalid')
  await expect(page.locator('[data-method=method-b]')).toHaveCount(0)
  const manage = page.locator('[data-billing-methods] button')
  await manage.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveCount(1)
  await expect(dialog.getByRole('heading')).toHaveText('결제 수단')
  await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeFocused()
  await dialog.locator('[data-method=method-b]').getByRole('button', { name: '기본으로 설정', exact: true }).click()
  await expect(dialog).toHaveCount(1)
  await expect(dialog.getByRole('heading')).toHaveText('기본 결제 수단으로 설정하시겠습니까?')
  await dialog.getByRole('button', { name: '기본으로 설정', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'billingResolve')())
  await expect(dialog.getByRole('heading')).toHaveText('결제 수단')
  await expect(dialog).toHaveCount(1)
  // An accepted request does not turn the old snapshot into confirmed billing facts.
  await expect(dialog.locator('[data-method=method-b]')).not.toContainText('기본 결제 수단')
  await page.screenshot({ path: info.outputPath('payment-management.png') })
  await page.keyboard.press('Escape')
  await expect(manage).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
})

for (const kind of ['methods', 'subscription', 'information']) for (const boundary of ['list', 'owner', 'snapshot']) test(`${kind} manager retires on ${boundary} without requests or a hidden modal`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/tests/fixtures/client-settings-billing.html#/settings/billing')
  await page.evaluate(data => Reflect.get(window, 'billingSetData')(data), sample)
  const trigger = kind === 'subscription' ? page.getByRole('button', { name: '구독 관리', exact: true }) : page.locator(`[data-billing-${kind}] button`)
  await trigger.click()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  if (kind === 'information') await page.getByRole('dialog').getByLabel('이름', { exact: true }).fill('UNSAVED')
  if (boundary === 'list') await page.evaluate(() => { location.hash = '#/settings' })
  if (boundary === 'owner') await page.evaluate(() => Reflect.get(window, 'billingSetOwner')('owner-b'))
  if (boundary === 'snapshot') await page.evaluate(data => Reflect.get(window, 'billingSetData')({ ...data, sourceLabel: 'NEW DATA' }), sample)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  if (boundary === 'snapshot') await expect(page.locator('.stg-main h1')).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
  if (boundary === 'list') {
    const tab = page.locator('[data-settings-tab=billing]')
    await expect(tab).toBeFocused()
    await tab.click()
  }
  await trigger.click()
  if (kind === 'information') await expect(page.getByRole('dialog').getByLabel('이름', { exact: true })).toHaveValue('SUPPLIED NAME')
  expect(await page.evaluate(() => Reflect.get(window, 'billingCalls')())).toEqual([])
})

test('holding Enter after a payment request cannot activate the newly focused cancel button', async ({ page }) => {
  await page.goto('/tests/fixtures/client-settings-billing.html#/settings/billing')
  await page.locator('[data-billing-methods] button').click()
  await page.getByRole('dialog').getByRole('button', { name: '결제 수단 추가', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button').last().focus()
  await page.keyboard.down('Enter')
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'billingCalls')().length)).toBe(1)
  await page.keyboard.down('Enter')
  await page.keyboard.up('Enter')
  await expect(dialog).toHaveCount(1)
  expect(await page.evaluate(() => Reflect.get(window, 'billingCalls')()[0].aborted)).toBe(false)
  await dialog.getByRole('button', { name: '취소', exact: true }).press('Enter')
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'billingCalls')()[0].aborted)).toBe(true)
})

test('snapshot replacement does not reclaim a newer explicit external focus', async ({ page }) => {
  await page.goto('/tests/fixtures/client-settings-billing.html#/settings/billing')
  await page.locator('[data-billing-methods] button').click()
  await page.evaluate(data => {
    Reflect.get(window, 'billingSetData')(data)
    const button = document.createElement('button'); button.id = 'external-choice'; button.textContent = 'External focus'
    document.body.append(button)
    queueMicrotask(() => { document.querySelector<HTMLDialogElement>('dialog')?.close(); button.focus() })
  }, sample)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('#external-choice')).toBeFocused()
})

for (const width of [320, 901, 1440]) for (const language of ['ko', 'fr'] as const) test(`billing managers ${width}px ${language} keep enlarged content and focus inside one modal`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 800 })
  await page.addInitScript(language => localStorage.setItem('tethLang', language), language)
  await page.goto('/tests/fixtures/client-settings-billing.html#/settings/billing')
  await page.evaluate(data => Reflect.get(window, 'billingSetData')(data), sample)
  await expect(page.locator('.stg-main > .stg-sec')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('billing-summary.png') })
  for (const kind of ['methods', 'subscription', 'information']) {
    const trigger = kind === 'subscription' ? page.getByRole('button', { name: billingText(language, 'manageSubscription'), exact: true }) : page.locator(`[data-billing-${kind}] button`)
    await trigger.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveCount(1)
    if (kind === 'information') await expect(dialog.getByLabel(billingText(language, 'email'), { exact: true })).toBeFocused()
    else await expect(dialog.getByRole('button', { name: billingText(language, 'close'), exact: true })).toBeFocused()
    for (const key of ['Tab', 'Shift+Tab']) for (let i = 0; i < 6; i++) {
      await page.keyboard.press(key)
      expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true)
    }
    await dialog.locator('h2,label > span,.k b,.k > span,.v,button').evaluateAll(elements => {
      for (const el of elements) (el as HTMLElement).style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * 2}px`
    })
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    if (kind === 'information') for (const label of await dialog.locator('.stg-billing-form label').all()) {
      const text = (await label.locator('span').boundingBox())!, input = (await label.locator('input').boundingBox())!
      expect(input.y).toBeGreaterThanOrEqual(text.y + text.height + 6)
      expect(Math.abs(input.x - text.x)).toBeLessThanOrEqual(1)
    }
    for (const el of await dialog.locator('h2,label,.k,.v,button').all()) expect(await el.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: info.outputPath(`${kind}-enlarged.png`) })
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
  }
  expect(await page.evaluate(() => Reflect.get(window, 'billingCalls')())).toEqual([])
})
