import { expect, test, type Locator, type Page } from '@playwright/test'
import reference from '../src/client-reference-copy.json' with { type: 'json' }

test.use({ serviceWorkers: 'block' })
type Language = keyof typeof reference.I18N['nav.login']
const draft = '미전송 입력을 보존하는 원문 초안 0123456789'
const title = '긴 대화 제목과 인증 및 언어 메뉴가 서로 겹치지 않아야 합니다'

async function mount(page: Page, baseURL: string | undefined, native: boolean, width: number, language: Language, height = 844) {
  if (!baseURL) throw new Error('로컬 URL이 필요합니다.')
  const origin = new URL(baseURL).origin, blocked: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || !['GET', 'HEAD'].includes(request.method()) || url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      blocked.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort()
    }
    if (url.pathname === '/entry-native.html' && request.method() === 'GET' && !url.search) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture"></div></body></html>' })
    return route.continue()
  })
  await page.setViewportSize({ width, height })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ language, draft, title }) => {
    localStorage.setItem('tethLang', language); localStorage.setItem('tethCurrency', 'USD')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    const id = 'entry-parity-conversation'
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{
      id, title, renamed: true, idea: title, draft, pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '-3%', takeProfit: '+8%', researchStatus: '초안', workspace: 'conversation',
      turns: [{ id: 'fixture-turn', question: '명시 표시 검수 질문', answer: '명시 표시 검수 답변', fullAnswer: '명시 표시 검수 답변', phase: 'plan', status: 'done', suggestions: [], startedAt: 1700000000000 }], updatedAt: 1700000000000,
    }] }))
  }, { language, draft, title })
  await page.goto(native ? '/entry-native.html' : '/')
  if (native) await page.evaluate(async ({ draft, title }) => {
    const refreshPath = '/@react-refresh', refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true, entryLoginCount: 0 })
    const path = '/src/internal-poc/ClientServiceExperience.tsx', source = await (await fetch(path)).text()
    const rp = source.match(/from "([^"\n]*\/react\.js[^"\n]*)"/)?.[1]
    if (!rp) throw new Error('Vite React 인스턴스를 찾지 못했습니다.')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, h = react.createElement
    const dp = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ dp)
    const { ClientServiceExperience } = await import(/* @vite-ignore */ path)
    function Host() {
      const [input, onInput] = react.useState(draft)
      return h(ClientServiceExperience, { nativeAccounts: true, accountScope: 'anonymous-entry-layout', onLogin: () => { const target = window as unknown as { entryLoginCount: number }; target.entryLoginCount++ },
        library: { records: [{ id: 'fixture-record', title, market: 'BTC/USDT', status: '초안', updatedAt: 1700000000000 }], activeId: 'fixture-record', status: 'ready' },
        state: { phase: 'ready', sessionState: 'ANONYMOUS', messages: [{ id: 'native-question', role: 'user', text: '명시 표시 검수 질문' }], input, inputDisabled: false, busy: false, source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null, onInput, onSend: async () => {}, onReset: () => {} },
      })
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  }, { draft, title })
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await page.evaluate(() => document.fonts.ready)
  return { blocked, errors }
}

async function hit(locator: Locator, minimum = 44) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox(); expect(box).not.toBeNull()
  expect(box!.height).toBeGreaterThanOrEqual(minimum)
  expect(await locator.evaluate(element => { const r = element.getBoundingClientRect(), found = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return found === element || !!found && element.contains(found) })).toBe(true)
  return box!
}

for (const native of [false, true]) for (const width of [320, 861, 1440]) for (const language of reference.GLC_LANGS.map(item => item.c as Language)) {
  test(`${native ? 'Native' : 'Main'} ${width}px ${language}: guest 원본 대화·insight 인증과 언어 진입 조건`, async ({ page, baseURL }, info) => {
    const audit = await mount(page, baseURL, native, width, language)
    const nav = page.locator('.client-auth-nav'), globe = page.locator('.client-globe'), composer = page.locator('.g-composer textarea')
    if (width > 860) {
      await expect(nav).toBeVisible(); await expect(globe).toBeVisible()
      const controls = nav.locator(':scope > a, :scope > button'); await expect(controls).toHaveCount(4)
      for (const [i, key] of ['nav.about', 'nav.download', 'nav.login', 'nav.signup'].entries()) {
        await expect(controls.nth(i)).toHaveText(reference.I18N[key as 'nav.login'][language]); await hit(controls.nth(i))
      }
      await hit(globe)
      await hit(page.locator('.g-chead .g-title'), 32); await hit(page.locator('.g-chead .g-tab').first(), 24)
      await globe.click(); await expect(page.locator('.client-locale-panel')).toBeVisible()
      await page.keyboard.press('Escape'); await expect(globe).toBeFocused(); await expect(composer).toHaveValue(draft)
      for (const selector of ['.client-login', '.client-signup']) {
        await nav.locator(selector).click()
        if (native) expect(await page.evaluate(() => (window as unknown as { entryLoginCount: number }).entryLoginCount)).toBeGreaterThan(0)
        else { await expect(page.locator('.ca-auth')).toBeVisible(); await page.keyboard.press('Escape'); await expect(nav.locator(selector)).toBeFocused() }
        await expect(composer).toHaveValue(draft)
      }
    } else { await expect(nav).toBeHidden(); await expect(globe).toBeHidden() }
    if (width <= 860) await page.locator('.client-hamburger').click()
    await page.locator('[data-sidebar-action="settings"]').click()
    await page.locator('.ca-settings [data-menu-action="insight"]').click()
    await expect(page.locator('.client-insights')).toBeVisible()
    await expect(nav).toBeVisible()
    for (const control of await nav.locator(':scope > a, :scope > button').all()) {
      if (await control.isVisible()) await hit(control)
    }
    if (width > 860) { await hit(globe); await globe.click(); await expect(page.locator('.client-locale-panel')).toBeVisible(); await page.keyboard.press('Escape'); await expect(globe).toBeFocused() }
    else await expect(globe).toBeHidden()
    for (const selector of ['.client-login', '.client-signup']) {
      await nav.locator(selector).click()
      if (native) expect(await page.evaluate(() => (window as unknown as { entryLoginCount: number }).entryLoginCount)).toBeGreaterThan(0)
      else { await expect(page.locator('.ca-auth')).toBeVisible(); await page.keyboard.press('Escape'); await expect(nav.locator(selector)).toBeFocused() }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('insight-entry.png') })
    expect(audit).toEqual({ blocked: [], errors: [] })
  })
}

for (const native of [false, true]) test(`${native ? 'Native' : 'Main'} guest 짧은 높이와 200% viewport emulation: 언어·인증·제목 keyboard 조건`, async ({ page, baseURL }) => {
  const audit = await mount(page, baseURL, native, 861, 'fr', 420)
  const globe = page.locator('.client-globe'), nav = page.locator('.client-auth-nav')
  for (const control of await nav.locator(':scope > a, :scope > button').all()) await hit(control)
  await hit(globe); await hit(page.locator('.g-chead .g-title'), 32)
  await globe.focus(); await page.keyboard.press('Enter'); await expect(page.locator('.client-locale-panel')).toBeVisible()
  await expect(page.locator('.client-locale-panel ul button')).toHaveCount(7)
  await page.keyboard.press('Escape'); await expect(globe).toBeFocused()
  // Half the CSS viewport emulates 200% zoom; this is not OS/browser zoom.
  await page.setViewportSize({ width: 720, height: 420 })
  await expect(nav).toBeHidden(); await expect(globe).toBeHidden()
  await page.setViewportSize({ width: 1440, height: 420 })
  await hit(globe); await hit(page.locator('.g-chead .g-title'), 32)
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(audit).toEqual({ blocked: [], errors: [] })
})
