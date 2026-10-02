import { expect, test, type Page } from '@playwright/test'
import { securityText } from '../src/client-settings-security-copy'
import copy from '../src/client-settings-copy.json' with { type: 'json' }
const path = '/tests/fixtures/client-settings-security.html'
test.setTimeout(40_000)
type Kind = 'password' | 'twoFactor' | 'logoutOthers'
async function open(page: Page, kind: Kind, query = '') {
  await page.goto(`${path}${query}#/settings/security`)
  await page.locator(`[data-security-row=${kind}] button`).click()
  return page.getByRole('dialog')
}
async function submit(page: Page, kind: Kind) {
  const dialog = await open(page, kind)
  if (kind === 'password') {
    await dialog.locator('input').nth(0).fill('fictional-old-test')
    await dialog.locator('input').nth(1).fill('fictional-new-test')
    await dialog.locator('input').nth(2).fill('fictional-new-test')
  }
  await dialog.locator('button[type=submit]').evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
  await expect(dialog.locator('button[type=submit]')).toBeDisabled()
  expect(await page.evaluate(() => Reflect.get(window, 'securityCalls')())).toHaveLength(1)
  return dialog
}
test('security displays supplied devices and permissions without inventing authority', async ({ page }) => {
  await page.goto(`${path}#/settings/security`)
  const pane = page.locator('.stg-main')
  await expect(pane).toContainText('SUPPLIED SECURITY TEST')
  await expect(pane).toContainText('Windows, Edge')
  await expect(pane).toContainText('Mac, Safari')
  await expect(pane).toContainText('READ ONLY')
  await expect(pane.getByRole('switch', { name: '2단계 인증', exact: true })).toBeChecked()
  await expect(pane).not.toContainText('주문 실행')
})

test('unknown is not disabled two-factor, local browser identity, or empty lists', async ({ page }) => {
  await page.goto(`${path}?unknown&unavailable#/settings/security`)
  const pane = page.locator('.stg-main')
  await expect(pane.getByRole('switch')).toHaveCount(0)
  await expect(pane).not.toContainText('Windows')
  await expect(pane.locator('.stg-badge').filter({ hasText: /^이 기기$/ })).toHaveCount(0)
  await expect(pane).not.toContainText(securityText('ko', 'noDevices'))
  await page.evaluate(() => Reflect.get(window, 'securitySetData')({ sourceLabel: 'EMPTY SUPPLIED', devices: [], permissions: [], twoFactor: { enabled: false, description: 'CONFIRMED OFF' } }))
  await expect(pane.getByRole('switch')).not.toBeChecked()
  await expect(pane.getByRole('switch')).toBeDisabled()
  await expect(pane).toContainText(securityText('ko', 'noDevices'))
  await expect(pane).toContainText(securityText('ko', 'noPermissions'))
})

test('unconnected password dialog preserves original form but cannot collect or submit credentials', async ({ page }) => {
  const dialog = await open(page, 'password', '?unavailable')
  await expect(dialog.getByRole('heading')).toHaveText('비밀번호 변경')
  await expect(dialog.locator('input')).toHaveCount(3)
  for (const input of await dialog.locator('input').all()) await expect(input).toBeDisabled()
  await expect(dialog.locator('button[type=submit]')).toBeDisabled()
  await expect(dialog).toContainText(copy.actionUnavailable.ko)
  await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-security-row=password] button')).toBeFocused()
  expect(await page.evaluate(() => Reflect.get(window, 'securityCalls')())).toEqual([])
})

test('password form validates without normalizing credentials, clears on submit/failure and localizes errors', async ({ page }) => {
  const dialog = await open(page, 'password')
  const inputs = dialog.locator('input'), button = dialog.locator('button[type=submit]')
  await expect(inputs.nth(0)).toBeFocused()
  await expect(inputs.nth(0)).toHaveAttribute('autocomplete', 'current-password')
  await expect(inputs.nth(1)).toHaveAttribute('autocomplete', 'new-password')
  await button.click(); await expect(inputs.nth(0)).toBeFocused()
  await expect(dialog.getByRole('alert')).toHaveText(securityText('ko', 'currentRequired'))
  await inputs.nth(0).fill('fictional-old-test')
  await button.click(); await expect(dialog.getByRole('alert')).toHaveText(securityText('ko', 'passwordRequired'))
  await inputs.nth(1).fill('fictional-new-test')
  await button.click(); await expect(dialog.getByRole('alert')).toHaveText(securityText('ko', 'mismatch'))
  await inputs.nth(1).fill('fictional-old-test'); await inputs.nth(2).fill('fictional-old-test')
  await button.click(); await expect(dialog.getByRole('alert')).toHaveText(securityText('ko', 'same'))
  await inputs.nth(1).fill('short'); await inputs.nth(2).fill('short')
  await button.click(); await expect(dialog.getByRole('alert')).toHaveText('HOST PASSWORD POLICY')
  await inputs.nth(1).fill('  fictional-new-test  '); await inputs.nth(2).fill('  fictional-new-test  ')
  await expect(inputs.nth(1)).toHaveValue('  fictional-new-test  ')
  expect(await inputs.nth(2).evaluate(el => !el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })))).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'securityCalls')())).toEqual([])
  await button.click()
  for (const input of await inputs.all()) { await expect(input).toHaveValue(''); await expect(input).toHaveAttribute('readonly', '') }
  await page.evaluate(() => Reflect.get(window, 'securityReject')())
  await expect(dialog.getByRole('alert')).toHaveText(securityText('ko', 'failed'))
  await expect(page.locator('body')).not.toContainText('PRIVATE_ERROR_NOT_FOR_UI')
  const stored = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), location.href]))
  expect(stored).not.toContain('fictional-')
  // Existing error is a translation key, not a stale language string.
  await page.evaluate(() => { localStorage.setItem('tethLang', 'fr'); dispatchEvent(new StorageEvent('storage', { key: 'tethLang', newValue: 'fr' })) })
  await expect(dialog.getByRole('alert')).toHaveText(securityText('fr', 'failed'))
})

for (const kind of ['password', 'twoFactor', 'logoutOthers'] as const) {
  test(`${kind} waits for explicit capability; completion never invents new facts`, async ({ page }) => {
    const dialog = await submit(page, kind)
    await expect(dialog.getByRole('status')).toHaveText(securityText('ko', 'working'))
    await page.evaluate(() => Reflect.get(window, 'securityResolve')())
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('[data-security-row=twoFactor]').getByRole('switch')).toBeChecked()
    await expect(page.locator('.stg-security')).toContainText('Mac, Safari')
    await expect(page.locator('[data-security-row=password]')).toContainText('2026-09-29')
    await expect(page.locator(`[data-security-row=${kind}] button`)).toBeFocused()
  })
  for (const boundary of ['close', 'owner', 'dataset', 'snapshot', 'tab', 'port'] as const) for (const settle of ['resolve', 'reject'] as const) {
    test(`${kind} ignores late ${settle} after ${boundary}`, async ({ page }) => {
      const dialog = await submit(page, kind)
      if (boundary === 'close') await page.keyboard.press('Escape')
      if (boundary === 'owner') await page.evaluate(() => Reflect.get(window, 'securitySetOwner')('owner-b'))
      if (boundary === 'dataset') await page.evaluate(() => Reflect.get(window, 'securitySetDataset')('dataset-b'))
      if (boundary === 'snapshot') await page.evaluate(() => Reflect.get(window, 'securitySetData')({ sourceLabel: 'NEW SUPPLIED SNAPSHOT' }))
      if (boundary === 'tab') await page.evaluate(() => { location.hash = '#/settings/general' })
      if (boundary === 'port') await page.evaluate(() => Reflect.get(window, 'securitySetAvailable')(false))
      await expect.poll(() => page.evaluate(() => Reflect.get(window, 'securityCalls')()[0].aborted)).toBe(true)
      await page.evaluate(settle => Reflect.get(window, settle === 'resolve' ? 'securityResolve' : 'securityReject')(), settle)
      await expect(page.locator('.stg-main').getByRole('status')).toHaveCount(0)
      await expect(page.locator('.stg-main').getByRole('alert')).toHaveCount(0)
      if (boundary === 'port') {
        await expect(dialog.locator('button[type=submit]')).toBeDisabled()
        await expect(dialog).toContainText(copy.actionUnavailable.ko)
        await page.keyboard.press('Escape')
      }
      await expect(dialog).toHaveCount(0)
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
    })
  }
}

test('confirmations default to Cancel, trap focus and restore body overflow priority', async ({ page }) => {
  await page.addInitScript(() => addEventListener('DOMContentLoaded', () => document.body.style.setProperty('overflow', 'auto', 'important')))
  const dialog = await open(page, 'logoutOthers')
  await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeFocused()
  for (const key of ['Tab', 'Shift+Tab']) for (let n = 0; n < 5; n++) {
    await page.keyboard.press(key)
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true)
  }
  await page.mouse.click(2, 2)
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => [document.body.style.getPropertyValue('overflow'), document.body.style.getPropertyPriority('overflow')])).toEqual(['auto', 'important'])
  expect(await page.evaluate(() => Reflect.get(window, 'securityCalls')())).toEqual([])
})

test('revoking a focused password capability moves focus to Cancel and clears all inputs', async ({ page }) => {
  const dialog = await open(page, 'password')
  await dialog.locator('input').first().fill('fictional-unsent-test')
  await page.evaluate(() => Reflect.get(window, 'securitySetAvailable')(false))
  await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeFocused()
  for (const input of await dialog.locator('input').all()) { await expect(input).toBeDisabled(); await expect(input).toHaveValue('') }
  expect(await page.evaluate(() => Reflect.get(window, 'securityCalls')())).toEqual([])
})

test('enabling two-factor sends the requested target only after confirmation and never flips locally', async ({ page }) => {
  await page.goto(`${path}#/settings/security`)
  await page.evaluate(() => Reflect.get(window, 'securitySetData')({ sourceLabel: 'SUPPLIED', twoFactor: { enabled: false, description: 'HOST DESCRIPTION' } }))
  const toggle = page.getByRole('switch', { name: '2단계 인증', exact: true })
  await toggle.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading')).toHaveText(securityText('ko', 'enable'))
  await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeFocused()
  expect(await page.evaluate(() => Reflect.get(window, 'securityCalls')())).toEqual([])
  await dialog.locator('button[type=submit]').click()
  expect(await page.evaluate(() => Reflect.get(window, 'securityCalls')())).toEqual([{ kind: 'twoFactor', enabled: true, aborted: false }])
  await page.evaluate(() => Reflect.get(window, 'securityReject')())
  await expect(dialog.getByRole('alert')).toHaveText(securityText('ko', 'failed'))
  await expect(toggle).not.toBeChecked()
  await dialog.locator('button[type=submit]').click()
  await page.evaluate(() => Reflect.get(window, 'securityResolve')(1))
  await expect(dialog).toHaveCount(0)
  await expect(toggle).not.toBeChecked()
  await page.evaluate(() => Reflect.get(window, 'securitySetData')({ sourceLabel: 'SUPPLIED', twoFactor: { enabled: true, description: 'HOST DESCRIPTION' } }))
  await expect(page.getByRole('switch', { name: '2단계 인증', exact: true })).toBeChecked()
})

test('password dialog remains usable inside a short visual viewport without leaking drafts on close', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.addInitScript(() => {
    const viewport = new EventTarget()
    Object.assign(viewport, { height: 290, offsetTop: 48 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  })
  const dialog = await open(page, 'password')
  const rect = (await dialog.boundingBox())!
  expect(rect.y).toBeGreaterThanOrEqual(63); expect(rect.y + rect.height).toBeLessThanOrEqual(323)
  await dialog.locator('input').first().fill('fictional-unsent-test')
  await dialog.getByRole('button', { name: '취소', exact: true }).click()
  await page.locator('[data-security-row=password] button').click()
  await expect(dialog.locator('input').first()).toHaveValue('')
  await dialog.locator('button[type=submit]').click()
  await expect(dialog.getByRole('alert')).toHaveText(securityText('ko', 'currentRequired'))
})

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) for (const width of [320, 861, 1440]) {
  test(`${language} security ${width}px wraps supplied text and dialog content`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(language => localStorage.setItem('tethLang', language), language)
    await page.goto(`${path}#/settings/security`)
    await page.evaluate(() => Reflect.get(window, 'securitySetData')({ sourceLabel: 'SUPPLIED',
      devices: [{ id: 'long', label: 'LongDeviceName'.repeat(10), current: true, activityLabel: 'ObservedActivity'.repeat(10) }],
      permissions: [{ id: 'long', label: 'ExchangeName'.repeat(10), value: 'ConfirmedPermission'.repeat(10), description: 'PermissionDescription'.repeat(10) }],
      twoFactor: { enabled: false, description: 'TwoFactorDescription'.repeat(10) },
    }))
    for (const element of await page.locator('.stg-security,.stg-security .stg-r,.stg-security .k,.stg-security .v,.stg-security button').all()) {
      expect(await element.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    }
    if (language === 'fr' && width !== 861) await page.screenshot({ path: info.outputPath(`security-fr-${width}.png`), fullPage: true })
    await page.locator('[data-security-row=password] button').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading')).toHaveText(securityText(language, 'passwordTitle'))
    for (const element of await dialog.locator('h2,p,label,button').all()) expect(await element.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    const rect = (await dialog.boundingBox())!
    expect(rect.x).toBeGreaterThanOrEqual(15); expect(rect.x + rect.width).toBeLessThanOrEqual(width - 15)
    for (const button of await dialog.getByRole('button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(width <= 900 ? 44 : 40)
    if (width <= 900) expect(await dialog.locator('input').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
    if (language === 'fr' && width !== 861) await page.screenshot({ path: info.outputPath(`security-password-fr-${width}.png`), fullPage: true })
  })
}
