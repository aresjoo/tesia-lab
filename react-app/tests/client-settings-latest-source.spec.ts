import { expect, test } from '@playwright/test'

test('320px short payment amounts leave room for a complete localized date', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/tests/fixtures/client-settings-billing.html#/settings/billing')
  await page.evaluate(() => Reflect.get(window, 'billingSetData')({ sourceLabel: 'SUPPLIED', information: null, methods: [], invoices: [{ id: 'one', label: '원본 내역', dateLabel: '2026년 9월 30일', amountLabel: '$28', statusLabel: '결제 완료', kind: 'paid' }] }))
  const date = page.locator('.stg-invoice .date')
  expect(await date.evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); return range.getClientRects().length })).toBe(1)
  const row = page.locator('.stg-invoice')
  await row.focus()
  await expect(row).toBeFocused()
  expect(await row.evaluate(el => {
    const row = el.getBoundingClientRect(), card = el.closest('.stg-card')!.getBoundingClientRect()
    return row.left - card.left >= 5 && card.right - row.right >= 5
  })).toBe(true)
})

for (const width of [320, 900, 901, 1440, 1920]) test(`latest settings ${width}px title, alignment and mobile safe spacing`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 800 })
  await page.goto('/tests/fixtures/client-settings-identity.html#/settings/general')
  const title = page.locator('.client-settings-page h1'), main = page.locator('.stg-main')
  await expect(title).toHaveCSS('font-size', '28px')
  await expect(title).toHaveCSS('font-weight', '400')
  if (width <= 900) {
    await expect(main).toHaveCSS('padding-top', '16px')
    await page.locator('.stg-mback').click()
    await expect(page.locator('.stg-navigation')).toHaveCSS('padding-top', '24px')
  } else {
    const box = (await main.boundingBox())!
    const available = width - 300
    expect(Math.abs(width - box.x - box.width - Math.max(0, (available - 840) / 2 - 100))).toBeLessThanOrEqual(1)
  }
  expect(await page.locator('.client-settings-page').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('latest-settings.png') })
})

for (const language of ['ko', 'fr']) test(`notification ${language} channels are separate with no invented selected value`, async ({ page }, info) => {
  await page.goto('/tests/fixtures/client-settings-identity.html#/settings/general')
  await page.locator('.stg-sel').selectOption(language)
  await page.evaluate(() => { location.hash = '#/settings/notify' })
  const main = page.locator('.stg-main')
  await expect(main.getByRole('heading', { name: 'TETH', exact: true })).toHaveCount(0)
  const groups = main.locator('.stg-seg.multi')
  await expect(groups).toHaveCount(6)
  for (const group of await groups.all()) {
    await expect(group).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(group).toHaveCSS('gap', '8px')
    await expect(group.locator('[aria-pressed]')).toHaveCount(0)
    for (const button of await group.getByRole('button').all()) {
      await expect(button).toBeDisabled()
      await expect(button).toHaveCSS('background-color', 'rgb(47, 47, 47)')
    }
  }
  if (language === 'ko') {
    for (const text of ['전략의 주문이 체결되면 알립니다.', '전략이 중지되거나 오류가 발생하면 알립니다.', '설정한 손실 한도에 도달하면 알립니다.', '원본 전략의 설정이 변경되면 알립니다.', '결제와 로그인 내역, 보안 설정 변경을 알립니다.', '새 기능과 전략을 안내합니다.']) await expect(main).toContainText(text)
  }
  await page.setViewportSize({ width: 320, height: 800 })
  await main.locator('.stg-seg button').evaluateAll(elements => elements.forEach(el => { (el as HTMLElement).style.fontSize = '28px' }))
  for (const group of await groups.all()) expect(await group.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  expect(await page.locator('.client-settings-page').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('latest-notifications.png') })
})

test('latest history shows three receipts with date/status and keeps all original receipt facts', async ({ page }, info) => {
  await page.goto('/tests/fixtures/client-settings-billing.html#/settings/billing')
  const rows = page.locator('.stg-invoice')
  await expect(rows).toHaveCount(3)
  await expect(rows.first().locator('.k .date')).toHaveCount(1)
  await expect(rows.first().locator('.k .stg-invoice-status')).toHaveCount(1)
  await expect(rows.first().locator('.stg-badge')).toHaveCount(0)
  await rows.first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading')).toHaveCSS('font-weight', '600')
  await expect(dialog).toContainText('HISTORICAL RECIPIENT')
  await expect(dialog).toContainText('100 USDT')
  await page.keyboard.press('Escape')
  await expect(rows.first()).toBeFocused()
  await page.getByRole('button', { name: '전체 보기', exact: true }).click()
  await expect(rows).toHaveCount(6)
  await page.getByRole('button', { name: '접기', exact: true }).click()
  await expect(rows).toHaveCount(3)
  await page.screenshot({ path: info.outputPath('latest-history.png') })
})

for (const count of [0, 3, 4]) test(`history ${count} receipts exposes every supplied item without a fourth-row dead end`, async ({ page }) => {
  await page.goto('/tests/fixtures/client-settings-billing.html#/settings/billing')
  await page.evaluate(count => Reflect.get(window, 'billingSetData')({ sourceLabel: 'SUPPLIED', information: null, methods: [], invoices: Array.from({ length: count }, (_, i) => ({ id: `receipt-${i}`, label: `Original description ${i}`, dateLabel: `2026. 09. 0${i + 1}.`, amountLabel: `${i + 1} USDT`, statusLabel: '결제 완료', kind: 'paid' })) }), count)
  const rows = page.locator('.stg-invoice'), all = page.getByRole('button', { name: '전체 보기', exact: true })
  await expect(rows).toHaveCount(Math.min(count, 3))
  await expect(all).toHaveCount(count > 3 ? 1 : 0)
  if (count > 3) {
    await all.click()
    await expect(rows).toHaveCount(count)
    await rows.last().click()
    await expect(page.getByRole('dialog')).toContainText(`Original description ${count - 1}`)
    await expect(page.getByRole('dialog')).toContainText(`${count} USDT`)
    await page.keyboard.press('Escape')
    await expect(rows.last()).toBeFocused()
  }
  expect(await page.evaluate(() => Reflect.get(window, 'billingCalls')())).toEqual([])
})
