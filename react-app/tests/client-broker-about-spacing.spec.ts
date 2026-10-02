import { expect, test, type Page } from '@playwright/test'

const notes = {
  ko: ['TETH 연결은 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요.', 'TETH 연결은 준비 중이며, 연결이 열리면 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요.', '연결 후에도 설정에서 언제든 끊을 수 있습니다.'],
  en: ['TETH connection uses only read and trade permissions and never requests withdrawal permissions.', 'TETH connection is under preparation; once open, it will only use read and trade permissions and never request withdrawal permissions.', 'You can disconnect anytime from settings even after connecting.'],
  fr: ["La connexion TETH utilise uniquement les autorisations de consultation et de trading, et n'exige aucune autorisation de retrait.", "La connexion TETH est en préparation ; une fois ouverte, elle n'utilisera que les autorisations de consultation et de trading, sans jamais exiger d'autorisation de retrait.", 'Vous pouvez vous déconnecter à tout moment dans les paramètres même après la connexion.'],
} as const
type Language = keyof typeof notes

async function mount(page: Page, language: Language, service = false) {
  await page.route('**/broker-about-spacing.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0f1012;color:#e3e3e3"><div id="fixture"></div></body></html>' }))
  await page.goto('/broker-about-spacing.html')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(async ({ language, service }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/components/ClientBrokers.tsx', code = await (await fetch(path)).text(), reactPath = code.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React')
    const rm = await import(/* @vite-ignore */reactPath), React = rm.default ?? rm, dp = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */dp)
    const { ClientBrokers } = await import(/* @vite-ignore */path), pp = '/src/client-preferences.ts', preferences = await import(/* @vite-ignore */pp), fp = '/src/client-broker-fixtures.ts', fixtures = await import(/* @vite-ignore */fp)
    for (const css of ['/src/styles.css', '/src/client-reference.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/node_modules/@fontsource-variable/noto-sans-sc/index.css']) await import(/* @vite-ignore */css)
    document.getElementById('fixture')!.style.fontFamily = '"Noto Sans KR Variable", "Noto Sans SC Variable", "Geist Variable", sans-serif'
    preferences.setClientPreference('language', language)
    const root = (DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('fixture')), h = React.createElement
    const suppliedAbout = '  Provider sentence.\n원문 공백 · 출금 권한 is provider-owned.  '
    const broker = { ...fixtures.CLIENT_BROKERS[0], name: 'Supplied Broker', about: suppliedAbout }
    const pending: { reject: () => void }[] = []
    const submitReview = () => new Promise<void>((_resolve, reject) => pending.push({ reject: () => reject(new Error('PRIVATE_ERROR')) }))
    let about = suppliedAbout, missing = false
    const render = () => root.render(h(React.StrictMode, null, h(ClientBrokers, { onTitleChange: () => {}, ...(service ? { serviceBoundary: true, presentationScope: 'owner-a', authenticated: true,
      presentation: { scope: 'owner-a', identity: 'data-a', actions: { submitReview }, catalog: missing ? null : [{ broker, info: { founded: '2000', about }, reviews: [], connectionState: 'CONNECTED' }] },
    } : {}) })))
    Object.assign(window, { aboutBrokerSource: (id: string) => { const broker = fixtures.CLIENT_BROKERS.find((item: { id: string }) => item.id === id); return { about: fixtures.BROKER_INFO[id]?.about ?? broker.about, connected: broker.conn } },
      aboutBrokerSupply: (value: string) => { about = value; render() }, aboutBrokerMissing: () => { missing = true; render() }, aboutBrokerReject: () => pending[0].reject() })
    render()
  }, { language, service })
  await expect(page.locator('.bk2-card').first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
}

for (const language of ['ko', 'en', 'fr'] as const) test(`${language} 공개 개요의 연결·미지원 안내는 문장 경계 한 칸과 원문을 보존한다`, async ({ page }) => {
  await mount(page, language)
  for (const id of ['binance', 'ibkr']) {
    await page.locator(`#broker-${id}`).click()
    const source = await page.evaluate(id => Reflect.get(window, 'aboutBrokerSource')(id), id)
    const expected = [source.about, !source.about.includes('출금 권한') ? notes[language][source.connected ? 0 : 1] : '', source.connected ? notes[language][2] : ''].filter(Boolean).join(' ')
    expect(await page.locator('.bk2-about > p').textContent()).toBe(expected)
    await page.locator('.bk2-bc button').click()
  }
})

for (const language of ['ko', 'en', 'fr'] as const) test(`${language} 서비스 소개는 공급 원문 그대로이며 미리보기 연결 보충문장을 삽입하지 않는다`, async ({ page }) => {
  await mount(page, language, true)
  await page.locator('#broker-binance').click()
  for (const raw of ['  Provider sentence.\n원문 공백 · 출금 권한 is provider-owned.  ', 'Provider-only sentence without permission claims.', '']) {
    await page.evaluate(raw => Reflect.get(window, 'aboutBrokerSupply')(raw), raw)
    await expect.poll(() => page.locator('.bk2-about > p').textContent()).toBe(raw)
    for (const note of notes[language]) await expect(page.locator('.bk2-about > p')).not.toContainText(note)
  }
  await page.locator('.bk2-bc button').click()
  await page.evaluate(() => Reflect.get(window, 'aboutBrokerMissing')())
  await page.locator('#broker-binance').click()
  const unavailable = await page.locator('.bk2-about > p').textContent()
  expect(unavailable?.trim()).toBe(unavailable)
  expect(unavailable).toBeTruthy()
  for (const note of notes[language]) await expect(page.locator('.bk2-about > p')).not.toContainText(note)
})

test('작성창을 닫은 후 확인 실패는 원문 alert와 기존 오류 스타일을 함께 표시한다', async ({ page }) => {
  await mount(page, 'ko', true)
  await page.locator('#broker-binance').click()
  await page.locator('[data-tab=reviews]').click()
  await page.locator('.bk2-review-heading .wbtn').click()
  await page.getByRole('radio', { name: '5점', exact: true }).click()
  await page.getByRole('textbox', { name: '리뷰 내용', exact: true }).fill('작성한 리뷰를 제출합니다')
  await page.locator('dialog[open] .bk2-actions .wbtn').click()
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'aboutBrokerReject')())
  await expect(page.getByRole('alert')).toHaveText('요청을 확인하지 못했습니다')
  await expect(page.getByRole('alert')).toHaveClass('bk2-error')
  await expect(page.locator('.bk2-review-heading .wbtn')).toBeEnabled()
  await expect(page.locator('body')).not.toContainText('PRIVATE_ERROR')
})
