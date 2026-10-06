import { expect, test } from '@playwright/test'
import { catalogueFirstSentence } from '../src/client-catalogue-first-sentence'

const cases = [
  { language: 'ko', head: '조건 2.5%를 확인합니다.', rest: ' 다음 조건은 0.125%입니다.' },
  { language: 'en', head: 'Value 2.5% uses version 1.2.3.', rest: ' Next value is 0.125%.' },
  { language: 'ja', head: '条件2.5%を確認します。', rest: '次の条件は0.125%です。' },
  { language: 'zh-CN', head: '确认2.5%的条件。', rest: '下一个条件是0.125%。' },
  { language: 'zh-TW', head: '確認2.5%的條件。', rest: '下一個條件是0.125%。' },
  { language: 'es', head: 'Se comprueba el valor 2.5%.', rest: ' El siguiente valor es 0.125%.' },
  { language: 'fr', head: 'La valeur 2.5% est vérifiée.', rest: ' La valeur suivante est 0.125%.' },
] as const

test('첫 문장 분리는 CJK 무공백과 소수를 구분하며 원문을 무손실 보존한다', () => {
  const examples = [
    ...cases,
    { head: '確認！', rest: '次も確認。' },
    { head: '確認？', rest: '再確認。' },
    { head: '原文。', rest: '  空白を保持。' },
    { head: '원문입니다.', rest: '\n\t다음 문장입니다.' },
    { head: 'Price 1,234.56 and 0.125.', rest: ' Next is 3.14.' },
    { head: '', rest: '' },
    { head: '2.5%', rest: '' },
    { head: '마침표 없는 원문 $& <b> 0.125%', rest: '' },
  ]
  for (const { head, rest } of examples) {
    const original = head + rest, result = catalogueFirstSentence(original)
    expect(result, original).toEqual({ head, rest })
    expect(result.head + result.rest).toBe(original)
  }
})

test('실제 React 판단은 7언어 첫 문장만 강조하고 raw 본문·용어·키·SVG를 보존한다', async ({ page, baseURL }) => {
  const errors: string[] = [], forbidden: string[] = [], origin = new URL(baseURL!).origin
  page.on('pageerror', error => errors.push(error.message))
  // Vite's loopback HMR socket is development infrastructure, not a service API.
  page.on('websocket', socket => { if (new URL(socket.url()).host !== new URL(origin).host) forbidden.push('external WS') })
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
      forbidden.push(`${request.method()} ${url.pathname}`); return route.abort()
    }
    return route.continue()
  })
  await page.route('**/cjk-emphasis-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#141414;margin:0"><main id="tesia-main"><div id="fixture"></div></main></body></html>' }))
  await page.goto('/cjk-emphasis-fixture.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientCatalogueJudgments.tsx', dp = '/@id/react-dom/client', pp = '/src/client-preferences.ts'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw Error('React import missing')
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp), component = await import(/* @vite-ignore */ cp), preferences = await import(/* @vite-ignore */ pp)
    for (const css of ['/src/styles.css', '/src/client-reference.css', '/src/client-shared-detail.css']) await import(/* @vite-ignore */ css)
    const React = rm.default ?? rm, root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture'))
    const raw = Object.freeze({ i: 401, k: 'now', title: '고객·API 제목 $& 그대로', t: '추적 손절은 +2.5%입니다. 고객 원문 $& <b> 0.125%는 그대로입니다.' })
    let messages: readonly unknown[] = []
    const render = (language: string, text: string) => {
      preferences.setClientPreference('language', language)
      messages = Object.freeze([Object.freeze({ i: 400, k: 'now', title: 'Unknown caller title', t: text }), raw])
      root.render(React.createElement(component.ClientCatalogueJudgments, { messages, calendar: { start: '2023-01-02', asof: '2026-08-31' }, active: true }))
    }
    Object.assign(window, { cjkFixture: { render, snapshot: () => JSON.stringify(messages) } })
  })
  let structure: unknown, svg: unknown
  for (const { language, head, rest } of cases) {
    await page.evaluate(({ language, text }) => Reflect.get(window, 'cjkFixture').render(language, text), { language, text: head + rest })
    const section = page.locator('.catalogue-judgments'), rows = section.locator('li'), paragraphs = section.locator('.catalogue-judgment-body > p')
    await expect(rows).toHaveCount(2)
    await expect(paragraphs.first()).toHaveText(head + rest)
    expect(await paragraphs.first().textContent()).toBe(head + rest)
    await expect(paragraphs.first().locator('strong')).toHaveText(head)
    await expect(paragraphs.nth(1)).toHaveText('추적 손절은 +2.5%입니다. 고객 원문 $& <b> 0.125%는 그대로입니다.')
    await expect(paragraphs.nth(1).locator('strong')).toHaveText('추적 손절은 +2.5%입니다.')
    await expect(rows.nth(1).locator('h4')).toHaveText('고객·API 제목 $& 그대로')
    const original = await page.evaluate(() => Reflect.get(window, 'cjkFixture').snapshot())
    await expect(section.locator('header small')).toHaveCount(language === 'ko' ? 0 : 1)
    const currentStructure = await section.locator('ol').evaluate(el => ({ elements: el.querySelectorAll('*').length, paragraphs: el.querySelectorAll('p').length, strong: el.querySelectorAll('strong').length, keys: [...el.querySelectorAll('li')].map(row => row.dataset.judgmentKey) }))
    const currentSvg = await section.locator('svg').evaluateAll(nodes => nodes.map(el => el.outerHTML))
    if (structure === undefined) { structure = currentStructure; svg = currentSvg }
    else { expect(currentStructure).toEqual(structure); expect(currentSvg).toEqual(svg) }
    const term = rows.nth(1).locator('[data-term="추적 손절"]')
    await term.click()
    await expect(page.locator('.catalogue-meaning')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.catalogue-meaning')).toHaveCount(0)
    await expect(term).toBeFocused()
    expect(await page.evaluate(() => Reflect.get(window, 'cjkFixture').snapshot())).toBe(original)
  }
  expect(errors).toEqual([]); expect(forbidden).toEqual([])
})
