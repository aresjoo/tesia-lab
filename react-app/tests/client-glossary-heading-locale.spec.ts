import { expect, test } from '@playwright/test'
import { catalogueDetailGlossary } from '../src/client-catalogue-detail-locale'
import copy from '../src/client-catalogue-judgment-copy.json' with { type: 'json' }
import type { ClientLanguage } from '../src/client-preferences'

const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
const terms = ['기간 만료', '진입', '관망']
const title = (language: ClientLanguage, term: string) => {
  const label = catalogueDetailGlossary(language).find(row => row.term === term)!.label
  return (language === 'fr' ? 'Définition : {term}' : copy[language].meaning).replace('{term}', label)
}

for (const width of [320, 1440]) test(`${width}px 7언어 용어 제목·Escape 초점·넘침`, async ({ page, baseURL }, info) => {
  await page.setViewportSize({ width, height: 1000 })
  const errors: string[] = [], forbidden: string[] = [], origin = new URL(baseURL!).origin
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) { forbidden.push(`${request.method()} ${url.pathname}`); return route.abort() }
    return route.continue()
  })
  await page.route('**/glossary-heading.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#141414"><div id="tesia-main"><div id="fixture" class="client-shared-detail"></div></div></body></html>' }))
  await page.goto('/glossary-heading.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const componentPath = '/src/components/ClientCatalogueJudgments.tsx', domPath = '/@id/react-dom/client', preferencesPath = '/src/client-preferences.ts'
    const source = await (await fetch(componentPath)).text(), reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw Error('React import missing')
    const react = await import(/* @vite-ignore */ reactPath), dom = await import(/* @vite-ignore */ domPath), component = await import(/* @vite-ignore */ componentPath), preferences = await import(/* @vite-ignore */ preferencesPath)
    for (const skin of ['/src/styles.css', '/src/client-reference.css', '/node_modules/@fontsource-variable/geist/index.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css']) await import(/* @vite-ignore */ skin)
    preferences.setClientPreference('language', 'ko')
    // Fixed UI glossary; caller prose remains Korean and is not represented as a translated report.
    const messages = Object.freeze([Object.freeze({ k: 'now', i: 1, title: '용어 설명', t: '기간 만료, 진입, 관망.' })])
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')), React = react.default ?? react
    Object.assign(window, { glossaryHeadingFixture: { messages, locale: (language: string) => preferences.setClientPreference('language', language) } })
    root.render(React.createElement(component.ClientCatalogueJudgments, { messages, calendar: { start: '2024-01-01', asof: '2026-01-01' }, active: true }))
  })
  const section = page.locator('.catalogue-judgments')
  await expect(section).toBeVisible()
  const original = await page.evaluate(() => JSON.stringify(Reflect.get(window, 'glossaryHeadingFixture').messages))
  for (const language of languages) {
    await page.evaluate(language => Reflect.get(window, 'glossaryHeadingFixture').locale(language), language)
    await expect(section.getByRole('heading', { level: 3 })).toHaveText(copy[language].heading)
    for (const canonical of terms) {
      const anchor = section.locator(`button[data-term="${canonical}"]`)
      await anchor.click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toHaveAccessibleName(title(language, canonical))
      await expect(dialog.getByRole('button', { name: copy[language].close, exact: true })).toBeFocused()
      await expect(dialog.locator('p')).toHaveAttribute('lang', language)
      await expect(dialog).toHaveAccessibleDescription(catalogueDetailGlossary(language).find(row => row.term === canonical)!.body)
      const box = (await dialog.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(11)
      expect(box.x + box.width).toBeLessThanOrEqual(width - 11)
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
      if (language === 'fr' && canonical === '기간 만료') await page.screenshot({ path: info.outputPath(`glossary-fr-${width}.png`) })
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(anchor).toBeFocused()
      await expect(anchor).toHaveAttribute('aria-expanded', 'false')
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, 'glossaryHeadingFixture').messages))).toBe(original)
  expect(errors).toEqual([])
  expect(forbidden).toEqual([])
})
