import { expect, test, type Page } from '@playwright/test'

// Frozen visual/copy oracle: tesia-lab@9fbff821 help-widget.js HW.
// FAQ and policy links are an approved React integration affordance. They
// remain separate from these three source-owned copy blocks and do not imply
// a live support provider or availability guarantee.
const sourceCopy = {
  ko: ['24/7 고객지원', '무엇이든 물어보십시오. 상담원이 연중무휴 24시간 대기하고 있습니다.', '상담원이 24시간 답합니다. support@teth.ai'],
  en: ['24/7 Support', 'Ask us anything. Our agents are available around the clock.', 'Our team answers 24/7. support@teth.ai'],
  ja: ['24時間サポート', '何でもお尋ねください。担当者が24時間365日対応します。', 'ライブチャットは近日提供予定です。support@teth.ai'],
  'zh-CN': ['24/7客服支持', '有任何问题都可以咨询，客服全年无休24小时在线。', '在线聊天即将上线。support@teth.ai'],
  'zh-TW': ['24/7客服支援', '有任何問題都可以諮詢，客服全年無休24小時在線。', '線上聊天即將上線。support@teth.ai'],
  es: ['Soporte 24/7', 'Pregúntanos lo que sea. Nuestro equipo está disponible 24/7.', 'El chat en vivo llegará pronto. support@teth.ai'],
  fr: ['Assistance 24h/24', 'Posez-nous vos questions. Notre équipe est disponible 24h/24, 7j/7.', 'Le chat en direct arrive bientôt. support@teth.ai'],
} as const

const nativeHtml = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import("/src/internal-poc/service-main.tsx");</script></body></html>'

async function mount(page: Page, baseURL: string | undefined, surface: 'Main' | 'Native') {
  if (!baseURL) throw new Error('Local origin required')
  const origin = new URL(baseURL).origin
  const audit = { external: [] as string[], mutations: [] as string[], unexpectedApi: [] as string[], errors: [] as string[] }
  page.on('pageerror', error => audit.errors.push(error.message))
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin) { audit.external.push(url.origin); return route.abort('blockedbyclient') }
    if (!['GET', 'HEAD'].includes(request.method())) { audit.mutations.push(`${request.method()} ${url.pathname}`); return route.abort('blockedbyclient') }
    if (url.pathname.startsWith('/api/')) {
      if (surface !== 'Native' || !['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(url.pathname)) {
        audit.unexpectedApi.push(url.pathname)
        return route.abort('blockedbyclient')
      }
      const session = url.pathname.endsWith('/session')
      return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"help_copy_anonymous_001"' } : {}, body: JSON.stringify({
        meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_help_copy_0001', traceId: 'trace_help_copy_0001' },
        data: session ? { sessionId: 'session_help_copy_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
          : { csrfToken: 'csrf_help_copy_0001', expiresAt: '2030-01-02T00:00:00Z' },
      }) })
    }
    if (surface === 'Native' && request.isNavigationRequest() && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: nativeHtml })
    return route.continue()
  })
  await page.goto('/')
  if (surface === 'Native') await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  else await expect(page.locator('.client-source-app:not(.client-service-app)')).toBeVisible()
  return audit
}

async function assertAllSourceLocales(page: Page, keyboard: boolean) {
  for (const [language, [title, body, sub]] of Object.entries(sourceCopy)) {
    await page.evaluate(value => localStorage.setItem('tethLang', value), language)
    await page.reload()
    const trigger = page.locator('.site-help-trigger:visible')
    if (keyboard) { await trigger.focus(); await page.keyboard.press('Enter') }
    else await trigger.click()
    const panel = page.locator('.site-help-pop')
    await expect(panel).toBeVisible()
    await expect(panel.locator(':scope > h2')).toHaveText(title)
    await expect(panel.locator(':scope > p').nth(0)).toHaveText(body)
    await expect(panel.locator(':scope > p').nth(1)).toHaveText(sub)
    await expect(panel.locator(':scope > a')).toHaveCount(2)
    await expect(panel.locator(':scope > a').nth(0)).toHaveAttribute('href', '/about/#faq')
    await expect(panel.locator(':scope > a').nth(1)).toHaveAttribute('href', '/policies/#overview')
    expect(await panel.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return {
        contained: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
        overflow: element.scrollWidth > element.clientWidth,
      }
    })).toEqual({ contained: true, overflow: false })
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(trigger).toBeFocused()
  }
}

test('Main desktop help keeps the exact 9fb three-part copy in all seven locales', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const audit = await mount(page, baseURL, 'Main')
  await assertAllSourceLocales(page, false)
  expect(audit).toEqual({ external: [], mutations: [], unexpectedApi: [], errors: [] })
})

test('Native mobile help keeps the exact 9fb copy, approved links and keyboard return', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  const audit = await mount(page, baseURL, 'Native')
  await assertAllSourceLocales(page, true)
  expect(audit).toEqual({ external: [], mutations: [], unexpectedApi: [], errors: [] })
})
