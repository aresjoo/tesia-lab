import { sourceSidebarNavigationLabel } from '../../src/client-shell-copy'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import { researchCopy } from '../../src/client-research-copy'

// Exercise the real entry point and published SDK, not a component-only host.
// Network responses are explicit fixtures; browsing never claims an account
// connection, a saved review, or access to actual exchange credentials.
const ready = fixture.snapshots.ready
const owner = 'session_broker_memory_fixture_0001'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision,
  requestId: 'req_broker_memory_fixture_0001', traceId: 'trace_broker_memory_fixture_0001' })

async function setup(page: Page) {
  const requests: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (path.startsWith('/api/')) requests.push(`${request.method()} ${path}`)
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ id, owner }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { id: ready.conversationId, owner })
  await page.route('**/api/**', route => route.abort('failed'))
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"broker_memory_session_0001"' },
    body: JSON.stringify({ meta: meta('0.1.0', '1'), data: { sessionId: owner, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: 'csrf_broker_memory_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route(`**/api/v3/conversations/${ready.conversationId}`, route => route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"broker_memory_draft_0001"' },
    body: JSON.stringify({ meta: meta('0.3.0', ready.conversationStateRevision), data: ready }) }))
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  const input = page.locator('.g-composer textarea')
  await expect(input).toBeVisible()
  await input.fill('거래소를 둘러봐도 이 대화와 투자 조건은 그대로')
  await input.evaluate(node => Reflect.set(window, 'brokerOriginalComposer', node))
  return { requests, errors, baseline: [...requests], stored: await page.evaluate(() => JSON.stringify({ ...sessionStorage })) }
}

for (const width of [320, 1440]) test(`${width}px: SDK 서비스에서 거래소 선택을 보존하고 기존 대화 DOM·요청·세션을 유지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await setup(page)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async value => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */path)
      setClientPreference('language', value)
    }, language)
    for (let visit = 0; visit < 2; visit++) {
      if (width <= 860) {
        await revealSourceNavigation(page)
        await page.locator('.client-hamburger').click()
      }
      await page.locator('.client-sidebar').getByRole('button', { name: sourceSidebarNavigationLabel(language, 'brokers'), exact: true }).click()
      const brokers = page.locator('.native-brokers')
      await expect(brokers).toBeVisible()
      const stocks = brokers.locator('.bk2-bar .fp').nth(2)
      if (language === 'ko' && visit === 0) {
        await stocks.focus(); await page.keyboard.press('Enter')
      }
      await expect(stocks).toHaveAttribute('aria-pressed', 'true')
      await expect(brokers.locator('input[type="password"]')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      const badge = await brokers.locator('.bk2-card .bk2-bdg').first().evaluate(node => {
        const range = document.createRange(); range.selectNodeContents(node)
        const text = range.getBoundingClientRect(), box = node.getBoundingClientRect()
        return { textTop: text.top, textBottom: text.bottom, textLeft: text.left, textRight: text.right,
          top: box.top, bottom: box.bottom, left: box.left, right: box.right }
      })
      const label = `${width}px/${language}/${visit}: status text stays inside its badge`
      expect.soft(badge.textTop, label).toBeGreaterThanOrEqual(badge.top - 1)
      expect.soft(badge.textBottom, label).toBeLessThanOrEqual(badge.bottom + 1)
      expect.soft(badge.textLeft, label).toBeGreaterThanOrEqual(badge.left - 1)
      expect.soft(badge.textRight, label).toBeLessThanOrEqual(badge.right + 1)
      if (language === 'fr' && visit === 1) await page.screenshot({ path: info.outputPath('broker-shell-fr.png') })
      await brokers.locator('.hub-header').getByRole('button', { name: researchCopy(language, 'return'), exact: true }).click()
      const input = page.locator('.g-composer textarea')
      await expect(input).toBeVisible()
      await expect(input).toHaveValue('거래소를 둘러봐도 이 대화와 투자 조건은 그대로')
      expect(await input.evaluate(node => node === Reflect.get(window, 'brokerOriginalComposer'))).toBe(true)
      expect(state.requests).toEqual(state.baseline)
      expect(await page.evaluate(() => JSON.stringify({ ...sessionStorage }))).toBe(state.stored)
    }
  }
  expect(state.errors).toEqual([])
})

test('760–769px: 긴 번역의 거래소 필터와 정렬은 줄바꿈 또는 스크롤로 모두 도달한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 761, height: 900 })
  const state = await setup(page)
  await page.locator('.client-hamburger').click()
  await page.locator('.client-sidebar').getByRole('button', { name: sourceSidebarNavigationLabel('ko', 'brokers'), exact: true }).click()
  const brokers = page.locator('.native-brokers')
  await expect(brokers).toBeVisible()
  for (const language of ['fr', 'es'] as const) {
    await page.evaluate(async value => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */path)
      setClientPreference('language', value)
    }, language)
    for (const width of [760, 761, 768, 769]) {
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      const bar = brokers.locator('.bk2-bar')
      const geometry = await bar.evaluate(node => ({ client: node.clientWidth, content: node.scrollWidth,
        overflow: getComputedStyle(node).overflowX, wrap: getComputedStyle(node).flexWrap }))
      expect.soft(geometry.content <= geometry.client + 1 || ['auto', 'scroll'].includes(geometry.overflow),
        `${language}/${width}: ${JSON.stringify(geometry)}`).toBe(true)
      // Above the source Select's sheet breakpoint the popover must not be
      // clipped by a horizontal scrolling ancestor; long labels wrap instead.
      if (width > 760) await expect.soft(bar).toHaveCSS('flex-wrap', 'wrap')
      const sort = bar.locator('.tfbk-drop')
      await sort.click()
      const choice = page.getByRole('option').last()
      await expect(choice).toBeVisible()
      await choice.click()
      if (language === 'fr' && width === 768) await page.screenshot({ path: info.outputPath('broker-filter-fr-768.png') })
    }
  }
  expect(state.requests).toEqual(state.baseline)
  expect(state.errors).toEqual([])
})

// Isolate the production cascade to prevent a future stronger shorthand from
// silently cancelling the compact dialog padding. Full dialogs are exercised
// by native-broker-locale.spec.ts; this is not a visual-parity substitute.
test('후기 버튼의 모바일 논리 여백은 데스크톱 공통 padding보다 우선한다', async ({ page }) => {
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div class="tfbk-dialog"><div class="bk2-actions"><button class="obtn">Annuler</button><button class="wbtn">Publier un avis</button></div></div></body></html>')
  await page.addStyleTag({ content: readFileSync('src/client-brokers.css', 'utf8') })
  for (const width of [320, 768, 769, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const button of await page.locator('.bk2-actions button').all()) {
      const expected = width <= 768 ? '16px' : '31px'
      await expect(button).toHaveCSS('padding-inline-start', expected)
      await expect(button).toHaveCSS('padding-inline-end', expected)
    }
  }
})
