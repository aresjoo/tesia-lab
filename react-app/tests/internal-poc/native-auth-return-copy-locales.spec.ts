import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import ts from 'typescript'
const dictionary = JSON.parse(fs.readFileSync('src/internal-poc/native-app-ui-copy.json', 'utf8')) as Record<string, Record<string, string>>

// Independent exact copy oracle from personal(1) Sonnet 5.5 review, not the product dictionary.
const expected = {
  "로그인 반환 복구": {
    "ko": "로그인 반환 복구",
    "en": "Sign-in return recovery",
    "ja": "ログイン戻り画面の復旧",
    "zh-CN": "登录返回恢复",
    "zh-TW": "登入返回復原",
    "es": "Recuperación del retorno de inicio de sesión",
    "fr": "Récupération du retour de connexion"
  },
  "로그인 반환 화면을 벗어났습니다. 해당 화면으로 돌아가 세션을 다시 확인해주세요. 새 로그인을 시작하지 않았습니다.": {
    "ko": "로그인 반환 화면을 벗어났습니다. 해당 화면으로 돌아가 세션을 다시 확인해주세요. 새 로그인을 시작하지 않았습니다.",
    "en": "You left the sign-in return screen. Go back to that screen to recheck your session. No new sign-in has been started.",
    "ja": "ログイン戻り画面から離れました。その画面に戻って、セッションをもう一度確認してください。新しいログインは開始されていません。",
    "zh-CN": "您已离开登录返回页面。请返回该页面重新确认会话。尚未开始新的登录。",
    "zh-TW": "您已離開登入返回畫面。請回到該畫面重新確認工作階段。尚未開始新的登入。",
    "es": "Saliste de la pantalla de retorno de inicio de sesión. Vuelve a esa pantalla para volver a comprobar la sesión. No se ha iniciado un nuevo inicio de sesión.",
    "fr": "Vous avez quitté l'écran de retour de connexion. Revenez à cet écran pour revérifier la session. Aucune nouvelle connexion n'a été lancée."
  },
  "로그인 반환 화면으로 돌아가기": {
    "ko": "로그인 반환 화면으로 돌아가기",
    "en": "Return to the sign-in return screen",
    "ja": "ログイン戻り画面に戻る",
    "zh-CN": "返回登录返回页面",
    "zh-TW": "回到登入返回畫面",
    "es": "Volver a la pantalla de retorno de inicio de sesión",
    "fr": "Revenir à l'écran de retour de connexion"
  }
} as const
const keys = Object.keys(expected) as (keyof typeof expected)[]
const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const baseline = '1accbbd0603e0c04573bb6595c2ffe87897a2dcb'
const deployedCopyBaseline = '0da0a6d7ba559beabd9783859321b0270af43e2e'
// Exact reviewed functional candidate; the historical copy-only invariant below
// remains intact instead of incorrectly forbidding every subsequent auth repair.
const recoveryCandidateSha = 'aa8036323a32ea8a02b4603d3cbc1d112ee821d2d9ecff3123c1f144a2126c16'
const appPath = 'src/internal-poc/NativeServiceApp.tsx'
test.use({ serviceWorkers: 'block', trace: 'off', video: 'off', screenshot: 'off' })

test('three exact UI keys retain their copy-only baseline and the current recovery candidate is explicitly pinned', () => {
  const oldDictionary = JSON.parse(execFileSync('git', ['show', baseline + ':src/internal-poc/native-app-ui-copy.json'], { encoding: 'utf8' }))
  expect(Object.keys(dictionary).filter(key => !Object.hasOwn(oldDictionary, key)).sort()).toEqual([...keys].sort())
  for (const [key, value] of Object.entries(oldDictionary)) expect(dictionary[key as keyof typeof dictionary]).toEqual(value)
  for (const key of keys) expect(dictionary[key as keyof typeof dictionary]).toEqual(Object.fromEntries(locales.filter(locale => locale !== 'ko').map(locale => [locale, expected[key][locale]])))
  const original = execFileSync('git', ['show', baseline + ':' + appPath], { encoding: 'utf8' })
  const product = fs.readFileSync(appPath, 'utf8')
  expect(createHash('sha256').update(product).digest('hex')).toBe(recoveryCandidateSha)
  let current = execFileSync('git', ['show', deployedCopyBaseline + ':' + appPath], { encoding: 'utf8' })
  const inverse = [
    [`aria-label={ui('${keys[0]}')}`, `aria-label="${keys[0]}"`, 1],
    [`>{ui('${keys[1]}')}</p>`, `>${keys[1]}</p>`, 1],
    [`>{ui('${keys[2]}')}</button>`, `>${keys[2]}</button>`, 2],
    [`!plainAuthReturn() ? ui('${keys[1]}') : ui(`, `!plainAuthReturn() ? '${keys[1]}' : ui(`, 1],
  ] as const
  for (const [after, before, count] of inverse) {
    expect(product.split(after).length - 1).toBe(count)
    expect(current.split(after).length - 1).toBe(count); current = current.split(after).join(before)
  }
  expect(current).toBe(original)
  const ast = (text: string) => {
    const file = ts.createSourceFile(appPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const printer = ts.createPrinter({ removeComments: true })
    const nodes: string[] = []
    const visit = (node: ts.Node) => {
      if (ts.isIfStatement(node) || ts.isArrowFunction(node) || ts.isFunctionDeclaration(node) || (ts.isCallExpression(node) && node.expression.getText(file) === 'setError')) nodes.push(printer.printNode(ts.EmitHint.Unspecified, node, file))
      ts.forEachChild(node, visit)
    }
    visit(file)
    return nodes
  }
  expect(ast(current)).toEqual(ast(original))
  for (const file of ['native-app-ui-copy.ts', 'NativeLoginPanel.tsx', 'NativeAuthSurface.tsx', 'native-browser-auth.ts']) {
    expect(fs.readFileSync('src/internal-poc/' + file, 'utf8')).toBe(execFileSync('git', ['show', baseline + ':src/internal-poc/' + file], { encoding: 'utf8' }))
  }
})

const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true; await import('/src/internal-poc/service-main.tsx');</script></body></html>`
async function setLanguage(page: Page, locale: string) {
  await page.evaluate(async locale => { const p = '/src/client-preferences.ts'; const m = await import(p); m.setClientPreference('language', locale) }, locale)
}
async function navigate(page: Page, route: string) {
  await page.evaluate(route => { history.pushState(null, '', route); window.dispatchEvent(new Event('teth:navigate')) }, route)
}

test('mounted Native off-route banner and retained dialog localize in place with escape focus and 320px wrapping', async ({ page, baseURL }, info) => {
  test.setTimeout(90_000)
  if (!baseURL || new URL(baseURL).hostname !== '127.0.0.1') throw Error('LOOPBACK_ONLY')
  const origin = new URL(baseURL).origin, blocked: string[] = [], calls: string[] = [], errors: string[] = []
  let blockedDevHmrAttempts = 0
  page.on('pageerror', error => errors.push(error.message))
  await page.context().routeWebSocket('**/*', socket => {
    const url = new URL(socket.url())
    // Vite's loopback HMR handshake is also blocked, never connected. Do not
    // report it as a product/provider websocket or record its dev token.
    if (url.origin === origin.replace('http:', 'ws:') && url.pathname === '/' && [...url.searchParams.keys()].every(key => key === 'token')) blockedDevHmrAttempts++
    else blocked.push('NON_HMR_WS')
    socket.close()
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 320, height: 900 })
  await page.addInitScript(() => { localStorage.setItem('tethLang', 'ko'); sessionStorage.setItem('teth-app-banner-dismissed', '1') })
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || request.method() !== 'GET') { blocked.push(request.method() + ' ' + url.pathname); return route.abort() }
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname !== '/api/v1/auth/session' || url.search) { blocked.push(url.pathname); return route.abort() }
      calls.push('GET /api/v1/auth/session')
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ meta: { apiContractVersion: '0.1.0', resourceRevision: null, requestId: 'req_return_locale_fixture_01', traceId: 'trace_return_locale_fixture_01' }, error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic absent session.' } }) })
    }
    if (request.isNavigationRequest() && ['/', '/auth/complete'].includes(url.pathname)) return route.fulfill({ contentType: 'text/html', body: html })
    return route.continue()
  })
  await page.goto(origin + '/auth/complete')
  await expect(page.locator('.native-auth-surface')).toBeVisible()
  await page.keyboard.press('Escape')
  await navigate(page, '/')
  const banner = page.locator('.client-service-issue').filter({ visible: true })
  const observations = []
  for (const locale of locales) {
    await setLanguage(page, locale)
    await expect(banner.locator('p').first()).toHaveText(expected[keys[1]][locale])
    await expect(banner.getByRole('button', { name: expected[keys[2]][locale], exact: true })).toBeVisible()
    observations.push({ locale, banner: await banner.innerText() })
  }
  await navigate(page, '/auth/complete#/trade')
  const cta = page.locator('.txh-hero .txh-cta')
  await cta.click()
  const region = page.locator('.native-auth-surface section[aria-label]').filter({ visible: true })
  for (const locale of locales) {
    await setLanguage(page, locale)
    await expect(region).toHaveAttribute('aria-label', expected[keys[0]][locale])
    await expect(region.getByRole('alert')).toHaveText(expected[keys[1]][locale])
    const button = region.getByRole('button', { name: expected[keys[2]][locale], exact: true })
    await expect(button).toBeVisible()
    const measured = await region.evaluate(element => {
      const targets = [...element.querySelectorAll('p,button')].map(node => {
        const box = node.getBoundingClientRect(), range = document.createRange()
        // A collapsed line-end space can have a Range rect outside the line
        // without drawing ink or overflowing. Check every non-space glyph.
        const lines: { left: number; right: number; top: number; bottom: number }[] = []
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
        let text: Node | null
        while ((text = walker.nextNode())) for (let index = 0; index < (text.textContent?.length ?? 0); index++) {
          if (/\s/u.test(text.textContent![index])) continue
          range.setStart(text, index); range.setEnd(text, index + 1)
          for (const r of range.getClientRects()) lines.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })
        }
        return { text: node.textContent, left: box.left, right: box.right, overflow: node.scrollWidth - node.clientWidth,
          lines, top: box.top, bottom: box.bottom }
      })
      return { overflow: document.documentElement.scrollWidth - innerWidth, targets }
    })
    expect(measured.overflow).toBeLessThanOrEqual(1)
    for (const target of measured.targets) {
      expect(target.left).toBeGreaterThanOrEqual(0); expect(target.right).toBeLessThanOrEqual(321); expect(target.overflow).toBeLessThanOrEqual(1)
      for (const line of target.lines) { expect(line.left, JSON.stringify({ locale, target })).toBeGreaterThanOrEqual(target.left - 1); expect(line.right, JSON.stringify({ locale, target })).toBeLessThanOrEqual(target.right + 1); expect(line.bottom, JSON.stringify({ locale, target })).toBeLessThanOrEqual(target.bottom + 1) }
    }
    observations.push({ locale, region: await region.getAttribute('aria-label'), measured })
  }
  await page.screenshot({ path: info.outputPath('auth-return-fr-320.png') })
  await page.keyboard.press('Escape'); await expect(page.locator('.native-auth-surface')).toBeHidden(); await expect(cta).toBeFocused()
  await cta.click(); await region.getByRole('button', { name: expected[keys[2]].fr, exact: true }).click()
  await expect(page).toHaveURL(/\/auth\/complete$/)
  await expect(page.locator('.native-auth-surface [data-native-auth-close]').filter({ visible: true })).toBeFocused()
  const rawPreserved = await page.evaluate(async ({ keys, locales, expected }) => {
    const p = '/src/internal-poc/native-app-ui-copy.ts'; const { nativeAppNotice } = await import(p)
    const unknown = ['Provider: 한국어 raw stays', 'UNKNOWN_CODE · 임의 서버 문장', 'REQUEST_UNCONFIRMED · API 자유 문장']
    return locales.every(locale => unknown.every(raw => nativeAppNotice(locale, raw) === raw) && keys.every(key => nativeAppNotice(locale, key) === expected[key][locale]))
  }, { keys, locales: [...locales], expected })
  expect(rawPreserved).toBe(true); expect(calls).toEqual(['GET /api/v1/auth/session']); expect(blocked).toEqual([]); expect(errors).toEqual([])
  info.annotations.push({ type: 'FIXTURE_ONLY_RETURN_COPY', description: JSON.stringify({ observations, calls, blocked, blockedDevHmrAttempts, connectedWebSockets: 0, errors, rawPreserved, actualProvider: false }) })
})
