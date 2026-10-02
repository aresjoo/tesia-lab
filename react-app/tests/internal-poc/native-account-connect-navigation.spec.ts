import { expect, test, type Page } from '@playwright/test'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import { clientTerminalText } from '../../src/client-terminal-copy'
import { researchCopy } from '../../src/client-research-copy'
import { sourceSidebarNavigationLabel } from '../../src/client-shell-copy'

// Actual service entry + published SDK with explicit network fixtures. Browsing
// an exchange is not account connection, permission, or an execution receipt.
const ready = fixture.snapshots.ready
const owner = 'session_connect_navigation_fixture_0001'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision,
  requestId: 'req_connect_navigation_fixture_0001', traceId: 'trace_connect_navigation_fixture_0001' })
async function setup(page: Page) {
  const requests: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { const path = new URL(request.url()).pathname; if (path.startsWith('/api/')) requests.push(`${request.method()} ${path}`) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ id, owner }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { id: ready.conversationId, owner })
  await page.route('**/api/**', route => route.abort('failed'))
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"connect_navigation_session_0001"' },
    body: JSON.stringify({ meta: meta('0.1.0', '1'), data: { sessionId: owner, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: 'csrf_connect_navigation_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route(`**/api/v3/conversations/${ready.conversationId}`, route => route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"connect_navigation_draft_0001"' },
    body: JSON.stringify({ meta: meta('0.3.0', ready.conversationStateRevision), data: ready }) }))
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  const input = page.locator('.g-composer textarea')
  await expect(input).toBeVisible()
  await input.fill('거래소 탐색 후에도 남아야 할 조건')
  await input.evaluate(node => Reflect.set(window, 'connectOriginalComposer', node))
  return { requests, errors, baseline: [...requests], stored: await page.evaluate(() => JSON.stringify({ ...sessionStorage })) }
}
async function enterTrading(page: Page) {
  if (page.viewportSize()!.width <= 860) { await page.locator('.client-hamburger').focus(); await page.keyboard.press('Enter') }
  await page.locator('.client-sidebar').getByRole('button', { name: sourceSidebarNavigationLabel('ko', 'trading'), exact: true }).click()
  await expect(page.locator('.native-trading-workspace').getByRole('heading', { name: '내 트레이딩', exact: true })).toBeFocused()
}

for (const width of [320, 1440]) for (const fullscreen of [false, true]) test(`${width}px fullscreen=${fullscreen}: 미연결 6탭은 실제 연결 대신 거래소 탐색으로 이어지고 대화를 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await setup(page)
  const terminal = page.locator('.native-trading-workspace')
  for (const tab of ['pos', 'open', 'orders', 'fills', 'closed', 'assets'] as const) {
    await enterTrading(page)
    if (fullscreen) await terminal.getByRole('button', { name: '터미널 전체화면', exact: true }).click()
    await terminal.getByRole('tab', { name: clientTerminalText('ko', tab), exact: true }).click()
    const panel = terminal.getByRole('tabpanel', { name: clientTerminalText('ko', tab), exact: true })
    const connect = panel.getByRole('button', { name: clientTerminalText('ko', 'connectExchange'), exact: true })
    await expect(connect).toBeEnabled()
    await connect.focus(); await page.keyboard.press('Enter')
    const brokers = page.locator('.native-brokers')
    await expect(brokers).toBeVisible()
    await expect(brokers.locator('h1')).toBeFocused()
    await expect.poll(() => page.evaluate(() => location.hash)).not.toBe('#/trade')
    const entryGeometry = await brokers.evaluate(node => {
      const box = (element: Element | null) => { const r = element?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right } : null }
      return { title: box(node.querySelector('.hub-header h1')), back: box(node.querySelector('.hub-header button')), hub: box(node), main: box(node.closest('main')),
        menu: box(document.querySelector('.client-hamburger')), bell: box(document.querySelector('.client-account-utility')), scrollY, hubScroll: node.scrollTop }
    })
    await info.attach(`catalogue-entry-${tab}`, { body: JSON.stringify(entryGeometry, null, 2), contentType: 'application/json' })
    expect(entryGeometry.title!.y).toBeGreaterThanOrEqual(0)
    expect(entryGeometry.back!.y).toBeGreaterThanOrEqual(0)
    expect(entryGeometry.back!.right).toBeLessThanOrEqual(width + 1)
    expect(entryGeometry.hub!.bottom).toBeLessThanOrEqual(entryGeometry.main!.bottom + 1)
    const overlaps = (a: NonNullable<typeof entryGeometry.back>, b: NonNullable<typeof entryGeometry.bell>) =>
      a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y
    expect(overlaps(entryGeometry.back!, entryGeometry.bell!)).toBe(false)
    if (width <= 860) expect(overlaps(entryGeometry.title!, entryGeometry.menu!)).toBe(false)
    await expect(terminal).toHaveCount(0)
    await expect(page.getByRole('dialog', { name: '내 트레이딩', exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
    expect(state.requests).toEqual(state.baseline)
    expect(await page.evaluate(() => JSON.stringify({ ...sessionStorage }))).toBe(state.stored)
    await expect(brokers.locator('input[type="password"]')).toHaveCount(0)
    if (tab === 'assets') await page.screenshot({ path: info.outputPath('account-connect-browse.png') })
    await brokers.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
    const input = page.locator('.g-composer textarea')
    await expect(input).toBeVisible()
    await expect(input).toHaveValue('거래소 탐색 후에도 남아야 할 조건')
    expect(await input.evaluate(node => node === Reflect.get(window, 'connectOriginalComposer'))).toBe(true)
    expect(state.requests).toEqual(state.baseline)
  }
  expect(state.errors).toEqual([])
})

for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1440, 900]]) test(`${width}x${height}: 서비스 목록 헤더는 7언어에서 유틸리티와 겹치지 않고 자체 스크롤을 유지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height })
  const state = await setup(page)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async value => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', value)
    }, language)
    for (const surface of ['brokers', 'history', 'sharing'] as const) {
      if (width <= 860) { await page.locator('.client-hamburger').focus(); await page.keyboard.press('Enter') }
      const name = sourceSidebarNavigationLabel(language, surface)
      await page.locator('.client-sidebar').getByRole('button', { name, exact: true }).click()
      const hub = page.locator('.native-service-route-content > .client-research-hub')
      const back = hub.locator('.hub-header').getByRole('button', { name: researchCopy(language, 'return'), exact: true })
      await expect(back).toBeVisible()
      for (const scrolled of [false, true]) {
        if (scrolled) await hub.evaluate(node => { node.scrollTop = 120 })
        const geometry = await hub.evaluate(node => {
          const box = (element: Element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, bottom: r.bottom, right: r.right, width: r.width, height: r.height } }
          const title = node.querySelector('.hub-header h1')!, button = node.querySelector('.hub-header button')!
          return { title: box(title), titleLineHeight: parseFloat(getComputedStyle(title).lineHeight), button: box(button), hub: box(node), main: box(node.closest('main')!),
            bell: box(document.querySelector('.client-account-utility')!), headerPosition: getComputedStyle(node.querySelector('.hub-header')!).position,
            titleScrollWidth: title.scrollWidth, titleClientWidth: title.clientWidth,
            buttonScrollWidth: button.scrollWidth, buttonClientWidth: button.clientWidth }
        })
        const label = `${surface}/${language}/${scrolled}`
        expect(geometry.title.y, label).toBeGreaterThanOrEqual(0)
        expect(geometry.title.bottom, label).toBeLessThanOrEqual(height)
        expect(geometry.title.height, label).toBeLessThanOrEqual(geometry.titleLineHeight * 4 + 1)
        expect(geometry.title.right, label).toBeLessThanOrEqual(geometry.button.x + 1)
        expect(geometry.button.right, label).toBeLessThanOrEqual(geometry.bell.x)
        expect(geometry.button.height, label).toBeGreaterThanOrEqual(44)
        expect(geometry.hub.bottom, label).toBeLessThanOrEqual(geometry.main.bottom + 1)
        expect(geometry.titleScrollWidth, label).toBeLessThanOrEqual(geometry.titleClientWidth + 1)
        expect(geometry.buttonScrollWidth, label).toBeLessThanOrEqual(geometry.buttonClientWidth + 1)
        expect(geometry.headerPosition, label).toBe('sticky')
      }
      if (language === 'fr') await page.screenshot({ path: info.outputPath(`hub-${surface}-${width}-fr.png`) })
      await back.click()
      await expect(page.locator('.g-composer textarea')).toHaveValue('거래소 탐색 후에도 남아야 할 조건')
      expect(await page.locator('.g-composer textarea').evaluate(node => node === Reflect.get(window, 'connectOriginalComposer'))).toBe(true)
    }
  }
  expect(state.requests).toEqual(state.baseline)
  expect(state.errors).toEqual([])
})
