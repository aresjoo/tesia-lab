import { expect, test, type Page } from '@playwright/test'
import { billingText } from '../src/client-settings-billing-copy'
import { securityText } from '../src/client-settings-security-copy'
import copy from '../src/client-settings-copy.json' with { type: 'json' }
import type { ClientBillingPresentation, ClientBillingSubscription } from '../src/client-settings-billing-presentation'
const path = '/tests/fixtures/client-settings-billing.html'
test.setTimeout(40_000)
const confirmation = { title: 'SUPPLIED TITLE', description: 'SUPPLIED END DATE', consequences: ['SUPPLIED CONSEQUENCE'], confirmLabel: 'SUPPLIED CONFIRM' }
const snapshot = (subscription: ClientBillingSubscription): ClientBillingPresentation => ({ sourceLabel: 'SUPPLIED', invoices: [], methods: [], information: null, subscription })
const active: ClientBillingSubscription = { state: 'active', amountLabel: '100 USDT', description: 'SUPPLIED BILLING DATE', cancellation: { summary: 'SUPPLIED SUMMARY', confirmation } }
const ending = (kind: 'resume' | 'add-method'): ClientBillingSubscription => ({ state: 'ending', amountLabel: '100 USDT', description: 'SUPPLIED UNTIL DATE', resumption: { kind, confirmation } })
async function cancel(page: Page) {
  await page.getByRole('button', { name: '구독 관리', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '구독 해지', exact: true }).click()
}
async function open(page: Page, kind: 'cancel' | 'resume' | 'add-method', query = '') {
  await page.goto(`${path}${query}#/settings/billing`)
  await page.evaluate(data => Reflect.get(window, 'billingSetData')(data), snapshot(kind === 'cancel' ? active : ending(kind)))
  if (kind === 'cancel') await cancel(page)
  else await page.getByRole('button', { name: '다시 시작', exact: true }).click()
  return page.getByRole('dialog')
}
test('latest active subscription shows supplied terms without local price or date defaults', async ({ page }) => {
  await page.goto(`${path}#/settings/billing`)
  await page.evaluate(() => Reflect.get(window, 'billingSetData')({ sourceLabel: 'SUPPLIED', invoices: [], methods: [], information: null,
    subscription: { state: 'active', amountLabel: '100 USDT / OBSERVED PERIOD', description: 'OBSERVED BILLING DATE', cancellation: { summary: 'OBSERVED CANCELLATION SUMMARY', confirmation: { title: 'SUPPLIED CANCEL TITLE', description: 'SUPPLIED END DATE', consequences: ['SUPPLIED CONSEQUENCE'], confirmLabel: 'SUPPLIED CONFIRM' } } },
  }))
  const pane = page.locator('.stg-subscription-overview')
  await expect(pane).toContainText('TETH 구독')
  await expect(pane).toContainText('100 USDT / OBSERVED PERIOD')
  await expect(pane).toContainText('OBSERVED BILLING DATE')
  await cancel(page)
  await expect(page.getByRole('dialog')).toContainText('SUPPLIED CONSEQUENCE')
})

test('latest subscription exclusively replaces legacy overview; absence restores existing host data', async ({ page }) => {
  await page.goto(`${path}?legacy#/settings/billing`)
  await expect(page.locator('.native-settings-plan')).toContainText('LEGACY PLAN SOURCE')
  await page.evaluate(data => Reflect.get(window, 'billingSetData')(data), snapshot(active))
  await expect(page.locator('.native-settings-plan')).toHaveCount(0)
  await expect(page.locator('.stg-subscription-overview')).toHaveCount(1)
  await page.evaluate(() => Reflect.get(window, 'billingSetData')({ sourceLabel: 'NO NEW STATE', invoices: [], methods: [], information: null }))
  await expect(page.locator('.stg-subscription-overview')).toHaveCount(0)
  await expect(page.locator('.native-settings-plan')).toContainText('LEGACY PLAN SOURCE')
})

for (const state of ['expired', 'none'] as const) test(`${state} connects through the host without creating a subscription`, async ({ page }) => {
  await page.goto(`${path}#/settings/billing`)
  await page.evaluate(data => Reflect.get(window, 'billingSetData')(data), snapshot({ state, description: 'SUPPLIED DESCRIPTION', warning: 'SUPPLIED PAYMENT FAILURE' }))
  await expect(page.locator('.stg-subscription-overview')).toContainText(billingText('ko', state))
  await expect(page.locator('.stg-billing').getByRole('alert')).toHaveText('SUPPLIED PAYMENT FAILURE')
  await page.locator('.stg-subscription-overview').getByRole('button', { name: billingText('ko', state === 'expired' ? 'subscribe' : 'connect'), exact: true }).click()
  await expect(page.locator('.client-settings-page')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'billingCalls')())).toEqual([])
})

for (const lists of ['empty', 'unknown', 'card', 'invoice'] as const) test(`invited ${lists} keeps source-specific billing visibility`, async ({ page }) => {
  await page.goto(`${path}#/settings/billing`)
  const data = snapshot({ state: 'invited', feeLabel: 'SUPPLIED FEE', description: 'SUPPLIED INVITATION TERMS' })
  if (lists === 'unknown') { data.methods = null; data.invoices = null }
  if (lists === 'card') data.methods = [{ id: 'a', brand: 'SUPPLIED CARD', last4: '4242', expiryLabel: '12/28', isDefault: true, removable: false }]
  if (lists === 'invoice') data.invoices = [{ id: 'b', label: 'SUPPLIED INVOICE', dateLabel: 'SUPPLIED DATE', amountLabel: '100 USDT', kind: 'paid', statusLabel: 'SUPPLIED STATUS' }]
  await page.evaluate(data => Reflect.get(window, 'billingSetData')(data), data)
  await expect(page.locator('.stg-subscription-overview')).toContainText('SUPPLIED FEE')
  for (const selector of ['[data-billing-information]', '[data-billing-methods]']) await expect(page.locator(selector)).toHaveCount(lists === 'empty' ? 0 : 1)
  if (lists === 'empty' || lists === 'card') await expect(page.locator('.stg-billing')).toContainText(billingText('ko', 'noInvitedInvoices'))
  else await expect(page.locator('.stg-billing')).not.toContainText(billingText('ko', 'noInvitedInvoices'))
})

for (const kind of ['cancel', 'resume', 'add-method'] as const) {
  test(`${kind} requires confirmation, single-dispatches, retries safely and never invents updated facts`, async ({ page }) => {
    const dialog = await open(page, kind)
    await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeFocused()
    expect(await page.evaluate(() => Reflect.get(window, 'billingCalls')())).toEqual([])
    const confirm = dialog.getByRole('button', { name: confirmation.confirmLabel, exact: true })
    await confirm.evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
    await expect(confirm).toBeDisabled()
    await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeFocused()
    expect(await page.evaluate(() => Reflect.get(window, 'billingCalls')())).toEqual([{ kind: kind === 'add-method' ? 'add' : kind, aborted: false }])
    await page.evaluate(() => Reflect.get(window, 'billingReject')())
    await expect(dialog.getByRole('alert')).toHaveText(securityText('ko', 'failed'))
    await expect(page.locator('body')).not.toContainText('PRIVATE_ERROR_NOT_FOR_UI')
    await confirm.click()
    await page.evaluate(() => Reflect.get(window, 'billingResolve')(1))
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('button', { name: kind === 'cancel' ? '구독 관리' : '다시 시작', exact: true })).toBeFocused()
    await expect(page.locator('.stg-subscription-overview')).toContainText(kind === 'cancel' ? 'SUPPLIED BILLING DATE' : 'SUPPLIED UNTIL DATE')
    expect(await page.evaluate(() => Reflect.get(window, 'billingCalls')())).toHaveLength(2)
    await expect(page.locator('.stg-billing')).not.toContainText('구독을 해지했습니다')
  })
  test(`${kind} without a service callback stays disabled and explains why`, async ({ page }) => {
    const dialog = await open(page, kind, '?unavailable')
    await expect(dialog.getByRole('button', { name: confirmation.confirmLabel, exact: true })).toBeDisabled()
    await expect(dialog).toContainText(copy.actionUnavailable.ko)
    expect(await page.evaluate(() => Reflect.get(window, 'billingCalls')())).toEqual([])
  })
}

test('missing confirmed terms never fabricate a confirmation, date or price', async ({ page }) => {
  await page.goto(`${path}#/settings/billing`)
  await page.evaluate(data => Reflect.get(window, 'billingSetData')(data), snapshot({ state: 'active', amountLabel: 'OBSERVED', description: 'OBSERVED TERMS' }))
  await page.getByRole('button', { name: '구독 관리', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: '구독 해지', exact: true })).toBeDisabled()
  await expect(page.getByRole('dialog').getByRole('button', { name: '구독 해지', exact: true })).toHaveAccessibleDescription(copy.actionUnavailable.ko)
  await page.keyboard.press('Escape')
  await page.evaluate(data => Reflect.get(window, 'billingSetData')(data), snapshot({ state: 'ending', amountLabel: 'OBSERVED', description: 'OBSERVED TERMS' }))
  await expect(page.getByRole('button', { name: '다시 시작', exact: true })).toBeDisabled()
  await expect(page.locator('.stg-subscription-overview')).not.toContainText('$280')
})

test('a changed confirmation invalidates the open dialog even when the subscription state is unchanged', async ({ page }) => {
  const dialog = await open(page, 'cancel')
  await dialog.getByRole('button', { name: confirmation.confirmLabel, exact: true }).click()
  const changed = snapshot({ ...active, state: 'active', cancellation: { summary: 'REVISED SUMMARY', confirmation: { ...confirmation, description: 'REVISED END DATE' } } })
  await page.evaluate(data => Reflect.get(window, 'billingSetData')(data), changed)
  await expect(dialog).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'billingCalls')()[0].aborted)).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'billingResolve')())
  await cancel(page)
  await expect(dialog).toContainText('REVISED END DATE')
  await expect(dialog).not.toContainText('SUPPLIED END DATE')
})

test('restoring a callback preserves a new request when an abandoned request settles late', async ({ page }) => {
  const dialog = await open(page, 'resume')
  const confirm = dialog.getByRole('button', { name: confirmation.confirmLabel, exact: true })
  await confirm.click()
  await page.evaluate(() => Reflect.get(window, 'billingSetEnabled')(false))
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'billingCalls')()[0].aborted)).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'billingSetEnabled')(true))
  await confirm.click()
  await page.evaluate(() => Reflect.get(window, 'billingReject')(0))
  await expect(confirm).toBeDisabled()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'billingResolve')(1))
  await expect(dialog).toHaveCount(0)
})

test('confirmation fits a short visual viewport and escapes supplied text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.addInitScript(() => {
    const viewport = new EventTarget()
    Object.assign(viewport, { height: 290, offsetTop: 48 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  })
  await page.goto(`${path}#/settings/billing`)
  const data = snapshot({ ...active, state: 'active', cancellation: { summary: 'SUPPLIED SUMMARY', confirmation: { ...confirmation, consequences: ['<img src=x onerror=alert(1)>', 'LongConsequence'.repeat(30)] } } })
  await page.evaluate(data => Reflect.get(window, 'billingSetData')(data), data)
  await cancel(page)
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('img')).toHaveCount(0)
  await expect(dialog).toContainText('<img src=x onerror=alert(1)>')
  const box = (await dialog.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(63); expect(box.y + box.height).toBeLessThanOrEqual(323)
  await dialog.getByRole('button', { name: '취소', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'billingCalls')())).toEqual([])
})

test('source Korean subscription retains compact rows and clear cancellation consequences', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${path}#/settings/billing`)
  const data = snapshot({ state: 'active', amountLabel: '$280 / 월', description: '다음 결제일 2026. 10. 30.', cancellation: { summary: '해지해도 결제한 기간이 끝날 때까지는 모든 기능을 쓸 수 있습니다', confirmation: { title: '구독을 해지하시겠습니까?', description: '2026. 10. 30. 까지는 지금처럼 쓸 수 있습니다.', consequences: ['그 뒤에는 결제되지 않습니다', '그 뒤에는 돌아가는 전략이 새 주문을 내지 않습니다. 열린 포지션은 거래소에 그대로 남습니다'], confirmLabel: '구독 해지' } } })
  // Source copy is supplied fixture evidence, not a service policy default.
  await page.evaluate(data => Reflect.get(window, 'billingSetData')(data), data)
  await expect(page.locator('.stg-subscription-overview')).toContainText('다음 결제일 2026. 10. 30.')
  await page.screenshot({ path: info.outputPath('source-subscription-ko.png') })
  await cancel(page)
  await expect(page.getByRole('dialog').getByRole('button', { name: '취소', exact: true })).toBeFocused()
  await page.screenshot({ path: info.outputPath('source-cancel-ko.png') })
})

for (const state of ['active', 'invited'] as const) test(`${state} amount aligns with the card inset without an empty action track`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${path}#/settings/billing`)
  const subscription: ClientBillingSubscription = state === 'active' ? active : { state, feeLabel: 'SUPPLIED FEE', description: 'SUPPLIED DESCRIPTION' }
  await page.evaluate(data => Reflect.get(window, 'billingSetData')(data), snapshot(subscription))
  const excess = await page.locator('.stg-subscription-row').evaluate((row, state) => {
    const value = row.querySelector(state === 'active' ? '.a' : '.v')!
    return row.getBoundingClientRect().right - value.getBoundingClientRect().right - parseFloat(getComputedStyle(row).paddingRight)
  }, state)
  expect(Math.abs(excess)).toBeLessThan(1)
})

for (const kind of ['cancel', 'resume', 'add-method'] as const) for (const boundary of ['close', 'owner', 'dataset', 'snapshot', 'tab', 'port'] as const) for (const settle of ['resolve', 'reject'] as const) {
  test(`${kind} discards late ${settle} after ${boundary}`, async ({ page }) => {
    const dialog = await open(page, kind)
    await dialog.getByRole('button', { name: confirmation.confirmLabel, exact: true }).click()
    if (boundary === 'close') await page.keyboard.press('Escape')
    if (boundary === 'owner') await page.evaluate(() => Reflect.get(window, 'billingSetOwner')('owner-b'))
    if (boundary === 'dataset') await page.evaluate(() => Reflect.get(window, 'billingSetDataset')('dataset-b'))
    if (boundary === 'snapshot') await page.evaluate(data => Reflect.get(window, 'billingSetData')(data), snapshot({ state: 'none', description: 'NEW OBSERVED STATE' }))
    if (boundary === 'tab') await page.evaluate(() => { location.hash = '#/settings/general' })
    if (boundary === 'port') await page.evaluate(() => Reflect.get(window, 'billingSetEnabled')(false))
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'billingCalls')()[0].aborted)).toBe(true)
    await page.evaluate(settle => Reflect.get(window, settle === 'resolve' ? 'billingResolve' : 'billingReject')(), settle)
    await expect(page.locator('.stg-main').getByRole('status')).toHaveCount(0)
    await expect(page.locator('.stg-main').getByRole('alert')).toHaveCount(0)
    if (boundary === 'port') { await expect(dialog.getByRole('button').last()).toBeDisabled(); await page.keyboard.press('Escape') }
    await expect(dialog).toHaveCount(0)
  })
}

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) for (const width of [320, 861, 1440]) test(`${language} subscription ${width}px keeps labels, amounts and confirmation readable`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await page.addInitScript(language => localStorage.setItem('tethLang', language), language)
  await page.goto(`${path}#/settings/billing`)
  const data = snapshot({ ...ending('resume'), description: 'Description'.repeat(12), amountLabel: '123,456,789.12345678 USDT', state: 'ending', resumption: { kind: 'resume', confirmation: { ...confirmation, title: 'LongTitle'.repeat(6), consequences: ['LongConsequence'.repeat(14)] } } })
  await page.evaluate(data => Reflect.get(window, 'billingSetData')(data), data)
  const row = page.locator('.stg-subscription-overview')
  await expect(row).toContainText(billingText(language, 'subscription'))
  expect(await row.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  for (const part of await row.locator('.k,.v,.a').all()) expect(await part.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  if (width <= 900) {
    const text = (await row.locator('.k').boundingBox())!, amount = (await row.locator('.v').boundingBox())!, action = (await row.locator('.a').boundingBox())!
    expect(amount.y).toBeGreaterThanOrEqual(text.y + text.height)
    expect(action.y).toBeGreaterThanOrEqual(amount.y + amount.height)
  }
  await page.screenshot({ path: info.outputPath(`subscription-${language}-${width}.png`) })
  await row.getByRole('button', { name: billingText(language, 'resume'), exact: true }).click()
  const dialog = page.getByRole('dialog')
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  for (const key of ['Tab', 'Shift+Tab']) for (let i = 0; i < 3; i++) { await page.keyboard.press(key); expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true) }
  await page.screenshot({ path: info.outputPath(`confirmation-${language}-${width}.png`) })
  await page.keyboard.press('Escape')
  await expect(row.getByRole('button')).toBeFocused()
})
