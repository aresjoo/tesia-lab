import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// Independent 9fb source oracle, including both late intro wrappers and the
// final applyLang. Initial tfIntroView literals alone are not the final UI.
const fixtureBytes = readFileSync(new URL('./fixtures/client-trading-intro-9fb.json', import.meta.url))
const fixtureSha = 'ba1d236ae30fa13095d6f67a227e82f4a4f65d99b8b7191dd9f82987834960ab'
if (createHash('sha256').update(fixtureBytes).digest('hex') !== fixtureSha) throw new Error('ORIGINAL_FIXTURE_BYTES_CHANGED')
const fixture: {
  sourceCommit: string; sourceWholeSha256: string; originalCode: string
  sections: { start: string; end: string; sourceStart: number; sourceEnd: number; codeStart: number; codeEnd: number; sha256: string }[]
} = JSON.parse(fixtureBytes.toString('utf8'))
const originalSha = 'f2475453a03b2646361546ac32002b00e4ce26ee014abf79d3be6262b318e321'
if (fixture.sourceCommit !== '9fbff821df62cad11d026022fc7628c7fcebc431' || fixture.sourceWholeSha256 !== originalSha) throw new Error('ORIGINAL_SOURCE_PIN_CHANGED')
const originalCode = fixture.originalCode
let sectionEnd = 0
for (const part of fixture.sections) {
  const code = originalCode.slice(part.codeStart, part.codeEnd)
  if (part.codeStart !== sectionEnd || !code.startsWith(part.start) || part.sourceEnd - part.sourceStart !== code.length
    || createHash('sha256').update(code).digest('hex') !== part.sha256) throw new Error(`ORIGINAL_SECTION_CHANGED:${part.start}`)
  sectionEnd = part.codeEnd
}
if (sectionEnd !== originalCode.length || fixture.sections.length !== 5) throw new Error('ORIGINAL_SECTION_COVERAGE_CHANGED')
const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const examples = ['화면 예시 · 실제 거래 기록이 아닙니다', 'Illustrative example · Not actual trading records', '画面例 · 実際の取引記録ではありません', '界面示例 · 非真实交易记录', '介面範例 · 非真實交易記錄', 'Ejemplo ilustrativo · No son registros de trading reales', 'Exemple illustratif · Données de trading non réelles']

async function presentation(page: Page) {
  return page.locator('.txh').evaluate(root => {
    const texts = (selector: string) => [...root.querySelectorAll(selector)].map(node => node.textContent!.replace(/\s+/g, ' ').trim())
    return {
      eyebrow: texts('.txh-eyebrow'), title: texts('h1'), sub: texts('.txh-sub'),
      headings: texts('h2'), leads: texts('.txh-lead'), columns: texts('.txh-ai-col h3'),
      models: texts('.txh-ai-col li b'), roles: texts('.txh-ai-col li span'),
      names: texts('.txh-name'), venues: texts('.txh-xch'), labels: texts('.txh-stat dt'), values: texts('.txh-stat dd'),
      bodies: texts('.txh-body'), emphasis: texts('.txh-body b'), steps: texts('.txh-step b'), stepBodies: texts('.txh-step p'),
      safety: texts('.txh-safe li b'), safetyBodies: texts('.txh-safe li span'), notes: texts('.txh-note'), ctas: texts('.txh-cta'),
      removedControls: root.querySelectorAll('.txh-kick,.txh-term,.txh-tip,.txh-step .n,.txh-sub br').length,
    }
  })
}

async function originalOracle(page: Page) {
  await page.goto('about:blank')
  await page.evaluate(code => {
    // Only source presentation functions execute. No original bootstrap,
    // provider, auth request, timers, storage or decorative media producer.
    Object.assign(window, { sourceIntroActions: [] as string[], authOpen: (mode: string) => {
      (window as unknown as { sourceIntroActions: string[] }).sourceIntroActions.push(`authOpen:${mode}`)
    }, acStart: () => { throw new Error('UNEXPECTED_SOURCE_PLAN_ACTION') }, tfNav: () => { throw new Error('UNEXPECTED_SOURCE_NAVIGATION') } })
    new Function(`var S={user:null},G={},GLC={lang:'ko'};var TF_RENDERING=false,TF_ONNF=false;
      function $(id){return document.getElementById(id)}
      function gComposer(){} function gSideRender(){} function gTabsRender(){} function gChead(){} function tfIntroFx(){}
      function nowMoneyHtml(n){return String(n)} function L(k){return k}
      function gContent(html){$('g-content').innerHTML=html}
      document.body.innerHTML='<div id="g-aux"></div><div id="g-content"></div>';
      ${code}
      tfIntroView(); window.sourceIntroSetLanguage=function(lang){GLC.lang=lang;applyLang()};`)()
  }, originalCode)
  const baseline = await presentation(page)
  for (const language of languages) {
    await page.evaluate(value => (window as unknown as { sourceIntroSetLanguage: (lang: string) => void }).sourceIntroSetLanguage(value), language)
    expect(await presentation(page)).toEqual(baseline)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    // Inspect and execute the FINAL DOM handlers, not the unused late
    // tfIntroStart helper. Both source CTAs open signup before any plan page.
    for (const cta of await page.locator('.txh-cta').all()) {
      await expect(cta).toHaveAttribute('onclick', "authOpen('signup')")
      await cta.click()
    }
  }
  expect(await page.evaluate(() => (window as unknown as { sourceIntroActions: string[] }).sourceIntroActions)).toEqual(Array(14).fill('authOpen:signup'))
  // Late skIntroCopy intentionally removes the early kicker, bold prose and
  // term buttons. Do not turn an excerpt-only review into a product change.
  expect(baseline.removedControls).toBe(0)
  expect(baseline.emphasis).toEqual([])
  expect(baseline.ctas).toEqual(['시작하기', '시작하기'])
  return baseline
}

const serviceHtml = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import("/src/internal-poc/service-main.tsx");</script></body></html>'

for (const host of ['Main', 'Native service entry'] as const) for (const width of [1440, 390, 320]) {
  test(`final 9fb intro ${host} ${width}px: overlay and locale parity`, async ({ page, context, baseURL }, info) => {
    if (!baseURL) throw new Error('LOCAL_ORIGIN_REQUIRED')
    const oraclePage = await context.newPage()
    const oracle = await originalOracle(oraclePage)
    await oraclePage.close()
    const origin = new URL(baseURL).origin, native = host === 'Native service entry'
    const audit = { external: 0, mutations: 0, blockedApi: 0, errors: [] as string[] }
    page.on('pageerror', error => audit.errors.push(error.message))
    await page.route('**/*', route => {
      const req = route.request(), url = new URL(req.url())
      if (url.origin !== origin) { audit.external++; return route.abort('blockedbyclient') }
      if (!['GET', 'HEAD'].includes(req.method())) { audit.mutations++; return route.abort('blockedbyclient') }
      if (url.pathname.startsWith('/api/')) {
        if (native && ['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(url.pathname)) {
          const session = url.pathname.endsWith('/session')
          return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"intro_final_session_0001"' } : {}, body: JSON.stringify({
            meta: { apiContractVersion: '0.1.0', requestId: 'req_intro_final_0001', traceId: 'trace_intro_final_0001', resourceRevision: session ? '1' : null },
            data: session ? { sessionId: 'session_intro_final_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
              : { csrfToken: 'csrf_intro_final_0001', expiresAt: '2030-01-02T00:00:00Z' },
          }) })
        }
        audit.blockedApi++; return route.abort('blockedbyclient')
      }
      if (native && req.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: serviceHtml })
      return route.continue()
    })
    await page.addInitScript(() => { localStorage.setItem('tethLang', 'ko'); sessionStorage.setItem('teth-app-banner-dismissed', '1') })
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/#/trade')
    if (native) await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    await expect(page.locator('.txh-hero h1')).toBeVisible()
    for (const [index, language] of languages.entries()) {
      await page.evaluate(async value => {
        const path = '/src/client-preferences.ts'
        const preferences = await import(path)
        preferences.setClientPreference('language', value)
      }, language)
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      expect(await presentation(page)).toEqual(oracle)
      await expect(page.locator('.txh .txh-cta')).toHaveCount(2)
      for (const cta of await page.locator('.txh .txh-cta').all()) await expect(cta).toHaveAttribute('lang', 'ko')
      await expect(page.locator('.txh-example-note')).toHaveText(examples[index])
      await expect(page.locator('.txh')).toHaveAttribute('lang', 'ko')
      await expect(page.locator('.txh video')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    }
    const bottom = page.locator('.txh-safe .txh-cta')
    await bottom.scrollIntoViewIfNeeded()
    await expect(bottom).toBeInViewport()
    expect(await bottom.evaluate(node => { const r = node.getBoundingClientRect(); return r.height >= 44 && r.left >= 0 && r.right <= innerWidth })).toBe(true)
    await bottom.click()
    const dialog = page.locator('.ca-auth')
    await expect(dialog).toBeVisible()
    await expect(page.getByTestId('connection-plan')).toHaveCount(0)
    await expect(page).toHaveURL(/#\/trade$/)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(bottom).toBeFocused()
    await expect(page).toHaveURL(/#\/trade$/)
    expect(audit).toEqual({ external: 0, mutations: 0, blockedApi: 0, errors: [] })
    await info.attach('source-overlay-boundary.json', { body: JSON.stringify({ originalSha, fixtureSha, host, width, locales: languages, originalFinalOverlay: true, syntheticAnonymousGets: native, actualProviderVerified: false }), contentType: 'application/json' })
  })
}
