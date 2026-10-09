import { expect, test } from '@playwright/test'

// Client source 9fbff821 pxBAcct / pxPaidLink and the final Gate acLogo override.
// This verifies navigation only, never payment or provider success.
for (const width of [320, 1440]) test(`original account subscription branch preserves exchange at ${width}px`, async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '연결 검수', email: 'connection@example.test' })))
  await page.setViewportSize({ width, height: 900 })
  const mutations: string[] = []
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.url()) })
  for (const [exchange, name] of [['gate', 'Gate'], ['okx', 'OKX'], ['woox', 'WOO X']]) {
    await page.goto(`/#/connect/account?exchange=${exchange}`)
    const root = page.getByTestId('connection-plan')
    const subscription = root.getByRole('button', { name: `지금 쓰는 ${name} 계정으로 연결 (월 $280)`, exact: true })
    await expect(subscription).toBeVisible()
    await expect(root.getByRole('button', { name: '기존 초대 계정 연결', exact: true })).toBeVisible()
    expect(await root.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await subscription.focus()
    await page.keyboard.press('Enter')
    await expect(root).toHaveAttribute('data-step', 'checkout')
    await expect(root.getByRole('radio', { name, exact: true })).toBeChecked()
    await expect(root.locator('.cpl-lines > div')).toHaveCount(2)
    await expect(root.locator('.cpl-lines')).not.toContainText('연결할 계정:')
    await expect(root.getByLabel('카드 번호', { exact: true })).toBeDisabled()
    await expect(root.getByRole('button', { name: '$280 결제하고 시작하기', exact: true })).toBeDisabled()
    if (exchange === 'gate') {
      const logo = root.getByRole('radio', { name, exact: true }).locator('img')
      await expect(logo).toHaveAttribute('src', '/client-broker-assets/app-gate.jpg')
      await expect.poll(() => logo.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    }
    await page.goBack()
    await expect(root).toHaveAttribute('data-step', 'account')
    await expect(subscription).toBeVisible()
    await page.goForward()
    await expect(root).toHaveAttribute('data-step', 'checkout')
    await page.reload()
    await expect(root.getByRole('radio', { name, exact: true })).toBeChecked()
  }
  expect(mutations).toEqual([])
})
