import { expect, test, type Page } from '@playwright/test'

// Fixed tesia-lab 9fb index.html:23528/23532: six KO topic labels + ' 알림'.
// Final :24533 changes descriptions only; :24534 removes the TETH header.
// Foreign literals preserve six existing translations, not foreign-source parity.
const topics = ['fill', 'state', 'risk', 'copy', 'bill', 'news'] as const
const oracles = [
  { language: 'ko', labels: ['체결', '전략 상태', '손실 한도', '복사한 전략', '결제와 계정', '소식'], channels: ['푸시', '이메일'] },
  { language: 'en', labels: ['Order Filled', 'Strategy Status', 'Loss Limit', 'Copied Strategies', 'Billing & Account', 'News'], channels: ['Push', 'Email'] },
  { language: 'ja', labels: ['約定', '戦略ステータス', '損失限度額', 'コピーした戦略', '請求とアカウント', 'お知らせ'], channels: ['プッシュ', 'メールアドレス'] },
  { language: 'zh-CN', labels: ['成交', '策略状态', '止损限额', '已复制策略', '账单与账户', '消息'], channels: ['推送', '电子邮箱'] },
  { language: 'zh-TW', labels: ['成交', '策略狀態', '止損限額', '已複製策略', '帳單與帳號', '最新消息'], channels: ['推播', '電子郵件'] },
  { language: 'es', labels: ['Ejecución', 'Estado de la estrategia', 'Límite de pérdidas', 'Estrategias copiadas', 'Facturación y cuenta', 'Noticias'], channels: ['Push', 'Correo electrónico'] },
  { language: 'fr', labels: ['Exécution', 'Statut de la stratégie', 'Limite de perte', 'Stratégies copiées', 'Facturation et compte', 'Actualités'], channels: ['Push', 'Adresse e-mail'] },
] as const
const koDescriptions = ['전략의 주문이 체결되면 알립니다.', '전략이 중지되거나 오류가 발생하면 알립니다.', '설정한 손실 한도에 도달하면 알립니다.', '원본 전략의 설정이 변경되면 알립니다.', '결제와 로그인 내역, 보안 설정 변경을 알립니다.', '새 기능과 전략을 안내합니다.']
type Host = 'Main' | 'Native supplied'
const fixture = (page: Page, method: 'calls' | 'resolve') => page.evaluate(method => Reflect.get(window, 'settingsSuppliedHost')[method](), method)

async function bindSetter(page: Page) {
  // Reuse the real preference setter through a retained, synchronous bridge.
  // Product copy is never imported to construct an expected value.
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'notificationGroupLanguage', setClientPreference)
    await document.fonts.ready
  })
}
async function setLanguage(page: Page, language: typeof oracles[number]['language']) {
  expect(await page.evaluate(language => {
    const setter = Reflect.get(window, 'notificationGroupLanguage') as typeof import('../src/client-preferences').setClientPreference
    return setter('language', language)
  }, language)).toBe(true)
  await expect(page.locator('html')).toHaveAttribute('lang', language)
}

for (const host of ['Main', 'Native supplied'] as const) test(`${host}: original Korean notification group names and preserved six locales/state`, async ({ page, baseURL }, info) => {
  if (!baseURL) throw new Error('Local origin required')
  const origin = new URL(baseURL).origin
  const audit = { errors: [] as string[], external: [] as string[], api: [] as string[], mutations: [] as string[] }
  page.on('pageerror', error => audit.errors.push(error.message))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin) { audit.external.push(request.method()); return route.abort() }
    if (!['GET', 'HEAD'].includes(request.method())) { audit.mutations.push(request.method()); return route.abort() }
    if (url.pathname.startsWith('/api/')) { audit.api.push(url.pathname); return route.abort() }
    return route.continue()
  })
  await page.setViewportSize({ width: info.project.name === 'desktop' ? 1440 : 320, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: 'Notification reader', email: 'notification@example.test' }))
  })
  const draft = 'Notification copy must not change this draft'
  if (host === 'Main') {
    await page.goto('/')
    await expect(page.locator('#strategy-idea')).toBeVisible()
    await page.locator('#strategy-idea').fill(draft)
    await page.evaluate(() => { location.hash = '#/settings/notify' })
  } else {
    // Existing owner-bound real Native shell fixture: explicit UI observations
    // and capabilities, never actual NativeServiceApp/provider authentication.
    await page.route('**/settings-supplied-host.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;const {mountSettingsSuppliedHost}=await import("/tests/fixtures/client-settings-supplied-host.tsx");mountSettingsSuppliedHost();</script></body></html>' }))
    await page.goto('/settings-supplied-host.html#/settings/notify')
  }
  await expect(page.locator('.client-settings-page')).toBeVisible()
  const section = page.locator('.client-settings-notifications'), groups = section.getByRole('group'), buttons = section.locator('button')
  await expect(groups).toHaveCount(6)
  await expect(buttons).toHaveCount(12)
  await expect(section).toHaveAttribute('data-source-notification-valid', 'true')
  await expect(section).toHaveAttribute('aria-busy', 'false')
  const groupNode = await groups.first().elementHandle(), buttonNode = await buttons.first().elementHandle()
  await bindSetter(page)
  const observations = []
  for (const oracle of oracles) {
    await setLanguage(page, oracle.language)
    for (const [index, topic] of topics.entries()) {
      const row = section.locator(`[data-notification-topic="${topic}"]`), group = row.getByRole('group')
      const name = oracle.labels[index] + (oracle.language === 'ko' ? ' 알림' : '')
      await expect(group).toHaveAttribute('aria-label', name)
      await expect(group).toHaveAccessibleName(name)
      await expect(row.locator('.k > b')).toHaveText(oracle.labels[index])
      if (oracle.language === 'ko') await expect(row.locator('.k > span')).toHaveText(koDescriptions[index])
      for (const [channelIndex, channel] of ['push', 'email'].entries()) {
        const button = row.locator(`[data-notification-channel="${channel}"]`)
        await expect(button).toHaveText(oracle.channels[channelIndex] + (host === 'Main' ? ' —' : ''))
        await expect(button).toHaveAttribute('aria-describedby', await row.locator('.k > span').getAttribute('id') as string)
        if (host === 'Main') {
          await expect(button).toBeDisabled()
          await expect(button).not.toHaveAttribute('aria-pressed')
        } else {
          await expect(button).toHaveAttribute('aria-pressed', channel === 'push' ? 'true' : 'false')
          if (topic === 'bill' && channel === 'email') await expect(button).toBeDisabled()
          else await expect(button).toBeEnabled()
        }
      }
    }
    expect(await groups.first().evaluate((node, original) => node === original, groupNode)).toBe(true)
    expect(await buttons.first().evaluate((node, original) => node === original, buttonNode)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    observations.push({ language: oracle.language, names: await groups.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))) })
  }
  await setLanguage(page, 'ko')
  if (host === 'Native supplied') {
    await expect(page.locator('.native-settings-plan')).toContainText('Legacy group remains separate')
    expect(await fixture(page, 'calls')).toEqual([])
    const push = section.locator('[data-notification-topic="fill"] [data-notification-channel="push"]')
    await push.focus()
    await push.evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click() })
    expect(await fixture(page, 'calls')).toEqual([{ kind: 'preference', id: 'opaque/fill/push', checked: false, aborted: false }])
    await expect(section).toHaveAttribute('aria-busy', 'true')
    await expect(push).toBeDisabled()
    await expect(push).toHaveAttribute('aria-pressed', 'true')
    await fixture(page, 'resolve')
    await expect(push).toBeEnabled()
    await expect(push).toHaveAttribute('aria-pressed', 'true')
    await expect(section.getByRole('status')).toHaveText('요청을 전달했습니다. 갱신된 계정 기록을 확인해주세요.')
    expect(await push.evaluate((node, original) => node === original, buttonNode)).toBe(true)
    expect(await fixture(page, 'calls')).toEqual([{ kind: 'preference', id: 'opaque/fill/push', checked: false, aborted: false }])
  } else {
    await expect(section.getByRole('status')).toHaveCount(0)
    await page.evaluate(() => { location.hash = '' })
    await expect(page.locator('#strategy-idea')).toHaveValue(draft)
  }
  expect(audit).toEqual({ errors: [], external: [], api: [], mutations: [] })
  await info.attach('notification-group-source-and-state.json', { body: JSON.stringify({ host: host as Host, width: page.viewportSize()?.width, observations, audit }), contentType: 'application/json' })
})
