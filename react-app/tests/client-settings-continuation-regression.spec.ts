import { expect, test, type Page } from '@playwright/test'
import copy from '../src/client-settings-copy.json' with { type: 'json' }
import { accountActivityText } from '../src/client-account-activity-copy'
import { accountPlanText } from '../src/client-account-plan-copy'
import { nativeAccountText } from '../src/internal-poc/native-account-presentation-copy'

// Fixed source 9fbff821: stEdit/stEmailPaint (23512–23526), stGeneral USD
// (23487–23493), and terminal inbox (14617–14665). The later override at
// 26088 hides nf-util; residual tfNotifOpen is not a reachable popover contract.
// These tests use explicit test providers or the actual public Mock shell.
// No external identity, email, payment, notification or support is supplied.
test.setTimeout(35_000)
test.use({ actionTimeout: 8_000 })

async function french(page: Page) {
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    ;(await import(/* @vite-ignore */ path)).setClientPreference('language', 'fr')
  })
}
async function visibleFocus(page: Page) {
  expect(await page.evaluate(() => {
    const node = document.activeElement
    if (!(node instanceof HTMLElement) || node === document.body || node.closest('[hidden],[inert]')) return false
    const box = node.getBoundingClientRect()
    return box.width > 0 && box.height > 0 && box.left >= -1 && box.right <= innerWidth + 1 && box.top >= -1 && box.bottom <= innerHeight + 1
  })).toBe(true)
}
async function helpRoundTrip(page: Page) {
  const trigger = page.locator('.stg-navigation').getByRole('button', { name: copy.help.fr, exact: true })
  await trigger.focus(); await trigger.press('Enter')
  const popup = page.locator('.client-modal-help .site-help-pop')
  await expect(popup.locator('.help-close')).toBeFocused()
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press(index < 3 ? 'Tab' : 'Shift+Tab')
    expect(await popup.evaluate(node => node.contains(document.activeElement))).toBe(true)
    await visibleFocus(page)
  }
  await page.keyboard.press('Escape')
  await expect(popup).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await visibleFocus(page)
}

test('actual public Mock: short French settings preserve inline draft through email, mobile list and consecutive help dismissal', async ({ page }, info) => {
  const errors: string[] = [], mutations: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.url()) })
  await page.setViewportSize({ width: 320, height: 280 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수 계정', email: 'continuation@example.test' })))
  await page.goto('/#/settings/account'); await french(page)
  const name = page.locator('[data-identity-field="name"]')
  await name.getByRole('button').click()
  const input = name.getByRole('textbox'), original = await input.elementHandle()
  await input.fill('상담 뒤 이어 쓸 초안')
  await expect(name.getByRole('button', { name: copy.save.fr, exact: true })).toBeDisabled()
  const email = page.locator('[data-email-settings] button')
  await email.click()
  const dialog = page.getByRole('dialog', { name: copy.emailChange.fr, exact: true })
  await expect(dialog.getByRole('textbox')).toBeFocused()
  await expect(dialog.getByRole('button', { name: copy.emailSend.fr, exact: true })).toBeDisabled()
  await dialog.getByRole('textbox').fill('unsent@example.test')
  await dialog.getByRole('textbox').evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, cancelable: true })))
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0)
  await expect(email).toBeFocused(); await visibleFocus(page)
  await page.locator('.stg-mback').click()
  for (let index = 0; index < 2; index++) await helpRoundTrip(page)
  await page.locator('[data-settings-tab="account"]').click()
  await expect(input).toHaveValue('상담 뒤 이어 쓸 초안')
  expect(await input.evaluate((node, old) => node === old, original)).toBe(true)
  await input.focus(); await input.press('Escape')
  await expect(name.getByRole('button')).toBeFocused(); await visibleFocus(page)
  await page.locator('.stg-mback').click(); await page.locator('[data-settings-tab="general"]').click()
  await expect(page.locator('.stg-main .num')).toHaveText('USD')
  await expect(page.locator('.stg-main select')).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath('public-short-settings-fr.png'), fullPage: true })
  expect(errors).toEqual([]); expect(mutations).toEqual([])
})

test('supplied email: long address failure, retry and modal retirement do not cross a later support visit', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 280 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/tests/fixtures/client-settings-identity.html#/settings/account'); await french(page)
  const trigger = page.locator('[data-email-settings] button')
  await trigger.click()
  let dialog = page.getByRole('dialog')
  const address = `${'long.address.'.repeat(9)}last@example.invalid`
  await dialog.getByRole('textbox').fill(address)
  await dialog.getByRole('textbox').press('Enter')
  await expect(dialog.getByRole('status')).toHaveText(copy.emailSending.fr)
  await page.evaluate(() => Reflect.get(window, 'emailReject')(0))
  await expect(dialog.getByRole('alert')).toHaveText(copy.emailSendFailed.fr)
  await expect(dialog.getByRole('textbox')).toHaveValue(address)
  await dialog.getByRole('textbox').press('Enter')
  await page.evaluate(() => Reflect.get(window, 'emailResolve')(1))
  await expect(dialog.getByRole('textbox', { name: copy.emailCode.fr, exact: true })).toBeFocused()
  await expect(dialog).toContainText(address)
  // Exercise text enlargement in the short dialog; this is not OS/browser zoom.
  await dialog.locator('h2,p,label,button,input').evaluateAll(nodes => nodes.forEach(node => {
    const element = node as HTMLElement
    element.style.fontSize = `${parseFloat(getComputedStyle(element).fontSize) * 2}px`
  }))
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  await dialog.getByRole('textbox').fill('123456'); await dialog.getByRole('textbox').press('Enter')
  await expect(dialog.getByRole('status')).toHaveText(copy.emailVerifying.fr)
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused(); await visibleFocus(page)
  await page.locator('.stg-mback').click(); await helpRoundTrip(page)
  await page.evaluate(() => Reflect.get(window, 'emailReject')(2))
  await page.locator('[data-settings-tab="account"]').click()
  await expect(page.locator('.stg-main').getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.stg-main').getByRole('status')).toHaveCount(0)
  await trigger.click(); dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading')).toHaveText(copy.emailChange.fr)
  await expect(dialog.getByRole('textbox')).toHaveValue('')
  await expect(dialog.getByRole('button', { name: copy.emailSend.fr, exact: true })).toBeEnabled()
  await expect(page.locator('body')).not.toContainText('DO_NOT_EXPOSE_RAW_ERROR')
  expect(await page.evaluate(() => Reflect.get(window, 'emailCalls')())).toEqual([
    { kind: 'send', email: address, aborted: false }, { kind: 'send', email: address, aborted: false },
    { kind: 'verify', email: address, codeLength: 6, aborted: true },
  ])
  await page.screenshot({ path: info.outputPath('email-reentry-short-fr.png'), fullPage: true })
})

test('supplied identity request can finish while the mobile list is open and failed retry preserves the draft', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/tests/fixtures/client-settings-identity.html#/settings/account'); await french(page)
  const row = page.locator('[data-identity-field="name"]')
  await row.getByRole('button').click(); await row.getByRole('textbox').fill('배경 처리 중인 이름')
  await row.getByRole('textbox').press('Enter')
  await expect(row).toHaveAttribute('aria-busy', 'true')
  await page.locator('.stg-mback').click()
  const navigation = page.locator('[data-settings-tab="account"]')
  await expect(navigation).toBeFocused()
  await page.evaluate(() => Reflect.get(window, 'identityReject')(0))
  await expect(navigation).toBeFocused()
  await navigation.click()
  await expect(row.getByRole('textbox')).toHaveValue('배경 처리 중인 이름')
  await expect(row.getByRole('alert')).toHaveText(copy.saveFailed.fr)
  await row.getByRole('textbox').focus(); await row.getByRole('textbox').press('Enter')
  await page.locator('.stg-mback').click(); await page.evaluate(() => Reflect.get(window, 'identityResolve')(1))
  await expect(navigation).toBeFocused()
  await navigation.click(); await expect(row.getByRole('textbox')).toHaveCount(0)
  await expect(row).toContainText('김투자')
  await expect(page.locator('.stg-main').getByRole('status')).toHaveText(nativeAccountText('fr', 'accepted'))
  expect(await page.evaluate(() => Reflect.get(window, 'identityCalls')())).toEqual([
    { field: 'name', value: '배경 처리 중인 이름', aborted: false }, { field: 'name', value: '배경 처리 중인 이름', aborted: false },
  ])
})

async function mountInbox(page: Page) {
  await page.route('**/settings-continuation-inbox.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="fixture"></div></body></html>' }))
  await page.goto('/settings-continuation-inbox.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/internal-poc/NativeTradingWorkspace.tsx', plan = '/src/internal-poc/NativeAccountPlan.tsx'
    const source = await (await fetch(path)).text(), reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ reactPath), React = rm.default ?? rm, h = React.createElement
    const domPath = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */ domPath)
    const { NativeTradingWorkspace } = await import(/* @vite-ignore */ path), { NativeAccountPlan } = await import(/* @vite-ignore */ plan)
    const preferencePath = '/src/client-preferences.ts'
    ;(await import(/* @vite-ignore */ preferencePath)).setClientPreference('language', 'fr')
    const calls: string[] = [], pending: { resolve: () => void; reject: (error: Error) => void }[] = []
    const data = { scope: 'inbox-owner', identity: 'inbox-supplied', sourceLabel: 'SUPPLIED CONTINUATION TEST', accounts: null, strategies: null,
      ledger: { pos: null, open: null, orders: null, fills: null, closed: null, assets: null },
      notifications: [{ id: 'pos', type: 'pos', title: 'Supplied notification, preserved original body', timeLabel: 'SUPPLIED TIME', read: false }],
      actions: { onRead: async (id: string) => { calls.push(id); await new Promise<void>((resolve, reject) => pending.push({ resolve, reject })) },
        onReadAll: async () => { calls.push('all'); await new Promise<void>((resolve, reject) => pending.push({ resolve, reject })) } } }
    Object.assign(window, { continuationInboxCalls: calls, continuationInboxReject: (index: number) => pending[index].reject(new Error('PRIVATE_INBOX_ERROR')), continuationInboxResolve: (index: number) => pending[index].resolve() })
    function Host() {
      const [route, setRoute] = React.useState(null), [view, setView] = React.useState(null)
      const [notifications, setNotifications] = React.useState(data.notifications)
      const presentation = React.useMemo(() => ({ ...data, notifications }), [notifications])
      Object.assign(window, { continuationInboxSetRows: setNotifications })
      return route ? h(NativeAccountPlan, { accountScope: data.scope, presentation, location: route, onReturn: () => setRoute(null), onNavigate: setRoute })
        : h(NativeTradingWorkspace, { accountScope: data.scope, presentation, alertsRequest: 1, alertsView: view, onAlertsViewChange: setView, onNavigate: setRoute, onReturn: () => {}, onNew: () => {} })
    }
    ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('fixture')).render(h(React.StrictMode, null, h(Host)))
  })
  await expect(page.locator('[data-native-account-alerts]')).toBeVisible()
}

test('inbox empty states distinguish one, multiple, zero and unsupplied rows in all languages without losing the focused filter', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 280 }); await page.emulateMedia({ reducedMotion: 'reduce' })
  await mountInbox(page)
  const inbox = page.locator('[data-native-account-alerts]'), filter = inbox.getByRole('group').getByRole('button').nth(3)
  await filter.click(); await filter.focus()
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      ;(await import(/* @vite-ignore */ path)).setClientPreference('language', language)
    }, language)
    for (const count of [1, 2, 0, null]) {
      await page.evaluate(count => Reflect.get(window, 'continuationInboxSetRows')(count === null ? null : Array.from({ length: count }, (_, index) => ({ id: `position-${index}`, type: 'pos', title: 'SUPPLIED ORIGINAL BODY', timeLabel: 'SUPPLIED TIME', read: false }))), count)
      const empty = inbox.locator('.nfx-empty')
      await expect(empty).toHaveRole('status')
      await expect(empty.locator('.nfx-etit')).toHaveText(count === null ? accountPlanText(language, 'unavailable') : accountActivityText(language, count ? 'noCategory' : 'noAlerts'))
      if (count) await expect(empty.locator('.nfx-edesc')).toHaveText(accountActivityText(language, new Intl.PluralRules(language).select(count) === 'one' ? 'otherAlertOne' : 'otherAlerts', { count: count.toLocaleString(language) }))
      else if (count === 0) await expect(empty.locator('.nfx-edesc')).toHaveText(accountActivityText(language, 'alertsEmptyDescription'))
      else await expect(empty.locator('.nfx-edesc')).toHaveCount(0)
      await expect(filter).toBeFocused(); await expect(filter).toHaveAttribute('aria-pressed', 'true')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    }
  }
  await page.screenshot({ path: info.outputPath('inbox-unsupplied-short-fr.png'), fullPage: true })
})

test('supplied inbox: empty category, rejected read, pending read-all and settings reentry preserve filter without fabricating reads', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 320, height: 568 }); await page.emulateMedia({ reducedMotion: 'reduce' })
  await mountInbox(page)
  const inbox = page.locator('[data-native-account-alerts]'), filter = (key: 'all' | 'position' | 'review') => inbox.getByRole('group').getByRole('button', { name: new RegExp(`^${accountActivityText('fr', key)}`) })
  await filter('review').click(); await expect(inbox.locator('.nf-item')).toHaveCount(0)
  await expect(inbox).toContainText(accountActivityText('fr', 'noCategory'))
  await expect(inbox).toContainText(accountActivityText('fr', 'otherAlertOne', { count: '1' }))
  await filter('position').click(); await inbox.locator('.nf-item').click()
  await expect(inbox.locator('.nf-item')).toBeDisabled()
  await expect(page.getByRole('status', { name: '' }).filter({ hasText: nativeAccountText('fr', 'pending') })).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'continuationInboxReject')(0))
  await expect(inbox.getByRole('alert')).toBeVisible()
  await expect(inbox.locator('.nf-item')).not.toHaveClass(/read/)
  await expect(inbox.locator('.nf-item')).toBeEnabled()
  await inbox.getByRole('button', { name: accountActivityText('fr', 'readAll'), exact: true }).click()
  await filter('review').click(); await expect(filter('review')).toHaveAttribute('aria-pressed', 'true')
  await inbox.getByRole('button', { name: accountActivityText('fr', 'preferences'), exact: true }).click()
  await expect(page.locator('.native-service-plan')).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'continuationInboxReject')(1))
  await expect(page.locator('.native-service-plan').getByRole('alert')).toHaveCount(0)
  await page.locator('.native-plan-return button').click()
  await expect(filter('review')).toHaveAttribute('aria-pressed', 'true')
  await expect(inbox.getByRole('alert')).toHaveCount(0)
  await filter('position').click(); await expect(inbox.locator('.nf-item')).not.toHaveClass(/read/)
  expect(await page.evaluate(() => Reflect.get(window, 'continuationInboxCalls'))).toEqual(['pos', 'all'])
  await expect(page.locator('body')).not.toContainText('PRIVATE_INBOX_ERROR')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath('inbox-short-fr.png'), fullPage: true })
  expect(errors).toEqual([])
})
