import { expect, test } from '@playwright/test'
import { catalogueStrategies } from '../src/client-catalogue'
import { catalogueIdentity } from '../src/client-catalogue-presentation'
import { CatalogueMarketData } from '../src/client-catalogue-market-data'
import { computeCatalogueBacktest } from '../src/client-catalogue-backtest-result'
import { catalogueDetailGlossary, catalogueDetailLocale, sourceCatalogueIdentity } from '../src/client-catalogue-detail-locale'
import type { ClientLanguage } from '../src/client-preferences'
import spot from '../src/client-catalogue-spot-data.json' with { type: 'json' }
import futures from '../src/client-catalogue-futures-data.json' with { type: 'json' }
import glossary from '../src/client-catalogue-judgment-assets.json' with { type: 'json' }

const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
const numbers = (text: string) => [...text.matchAll(/[+-]?\d+(?:,\d{3})*(?:\.\d+)?/g)].map(v => v[0]).sort()

test('31×4 상세 고정본문·제목·용어31의 완전성 및 숫자·저장값·미등록 원문 경계', () => {
  const market = new CatalogueMarketData(spot, futures)
  const originals = JSON.stringify(catalogueStrategies)
  expect(catalogueStrategies).toHaveLength(31)
  expect(Object.keys(glossary.MK_GLOSS)).toHaveLength(31)
  for (const language of languages) {
    for (const row of catalogueDetailGlossary(language)) {
      expect(row.term in glossary.MK_GLOSS).toBe(true)
      const original = glossary.MK_GLOSS[row.term as keyof typeof glossary.MK_GLOSS]
      expect(numbers(row.body)).toEqual(numbers(original))
      if (language === 'ko') { expect(row.label).toBe(row.term); expect(row.body).toBe(original) }
      else { expect(row.label).not.toMatch(/[가-힣\uFFFD]/); expect(row.body).not.toMatch(/[가-힣\uFFFD]/) }
    }
  }
  for (const strategy of catalogueStrategies) for (const period of [0, 90, 365, 730] as const) {
    const value = computeCatalogueBacktest({ owner: 'detail-locale-test', strategyId: strategy.id, period, amount: 1000 }, market)
    const before = JSON.stringify(value), row = catalogueIdentity(strategy)
    for (const language of languages) {
      const display = catalogueDetailLocale(value, language)
      expect(display.eligible).toBe(true)
      for (const key of ['title', 'description', 'asset'] as const) {
        // Existing Japanese copy spells Korean written counts with digits.
        // Those are authored constants, not newly inserted result quantities.
        const writtenCounts: Record<string, string> = { 하나: '1', 둘: '2', 셋: '3', '네 시장': '4', '세 종목': '3', '두 종목': '2', 여섯: '6', '두 달': '2' }
        const expected = numbers(row[key])
        if (language === 'ja') expected.push(...(row[key].match(/하나|둘|셋|네 시장|세 종목|두 종목|여섯|두 달/g) ?? []).map(word => writtenCounts[word]))
        expect(numbers(display.identity[key])).toEqual(expected.sort())
        if (language === 'ko') expect(display.identity[key]).toBe(row[key])
        else expect(display.identity[key], `${strategy.id}/${language}/${key}`).not.toMatch(/[가-힣\uFFFD]/)
      }
      for (const message of value.judgments!) for (const original of [message.title, message.t]) {
        const text = display.narrative(original)
        expect(text.translated, `${strategy.id}/${period}/${language}/${original}`).toBe(true)
        expect(numbers(text.text)).toEqual(numbers(original))
        if (language === 'ko') expect(text.text).toBe(original)
        else expect(text.text).not.toMatch(/[가-힣\uFFFD]/)
      }
      const user = { ...strategy, name: '고객 전략 $& <제목>', one: '사용자/API 설명 12.34% 원문' }
      expect(sourceCatalogueIdentity(user, language, true)).toEqual(catalogueIdentity(user))
      expect(sourceCatalogueIdentity(strategy, language, false)).toEqual(row)
      const server = catalogueDetailLocale({ ...value, sourceSha: 'server-source-not-static' }, language)
      expect(server.eligible).toBe(false)
      expect(server.identity).toEqual(row)
      expect(server.narrative('실제 서버 응답 $& 12.34% 원문').text).toBe('실제 서버 응답 $& 12.34% 원문')
      expect(display.narrative('알 수 없는 새 설명 $& 12.34% 원문').text).toBe('알 수 없는 새 설명 $& 12.34% 원문')
      expect(JSON.stringify(value)).toBe(before)
    }
  }
  expect(JSON.stringify(catalogueStrategies)).toBe(originals)
})

test('고정 카탈로그 목록·상세 본문·용어는 선택 언어로 이어진다', async ({ page, baseURL }, info) => {
  const requests: string[] = [], errors: string[] = [], origin = new URL(baseURL!).origin
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) { requests.push(`${request.method()} ${url.pathname}`); return route.abort() }
    return route.continue()
  })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'en'))
  await page.goto('/#/share/s/d1')
  const section = page.locator('.catalogue-judgments')
  await expect(section).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('.ss3-dtitle')).toHaveText('Split across three coins')
  await page.setViewportSize({ width: 320, height: 1000 })
  const ids = await section.locator('li').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-judgment-key')))
  const storage = await page.evaluate(() => JSON.stringify(Object.entries(sessionStorage)))
  for (const language of languages) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', language) }, language)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    if (language !== 'ko') {
      await expect(page.locator('.ss3-dtitle')).not.toContainText(/[가-힣]/)
      await expect(page.locator('.ss3-ddescription')).not.toContainText(/[가-힣]/)
      await expect(section.locator('.catalogue-judgment-body').first()).not.toContainText(/[가-힣]/)
    } else await expect(page.locator('.ss3-dtitle')).toHaveText('코인 셋 나눠 담기')
    expect(await section.locator('li').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-judgment-key')))).toEqual(ids)
    const term = section.locator('.catalogue-term').first()
    await term.click()
    const dialog = page.locator('.catalogue-meaning')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('p')).toHaveAttribute('lang', language)
    if (language !== 'ko') await expect(dialog).not.toContainText(/[가-힣]/)
    const box = (await dialog.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(11); expect(box.x + box.width).toBeLessThanOrEqual(309)
    if (language === 'en' || language === 'fr') await page.screenshot({ path: info.outputPath(`detail-glossary-${language}-320.png`) })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0); await expect(term).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    expect(await page.evaluate(() => JSON.stringify(Object.entries(sessionStorage)))).toBe(storage)
  }
  await page.goto('/#/share')
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', 'en') })
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('.strategy-list-card').first()).toBeVisible()
  for (const card of await page.locator('.strategy-list-card h3').all()) await expect(card).not.toContainText(/[가-힣]/)
  await page.locator('.ss3-search input').fill('Split across three coins')
  await expect(page.locator('.strategy-list-card')).toHaveCount(1)
  await expect(page.locator('.strategy-list-card a')).toHaveAttribute('href', /\/s\/d1/)
  await expect(page.locator('.strategy-list-card a')).toHaveAttribute('aria-label', 'Split across three coins')
  await page.locator('.ss3-search input').fill('코인 셋 나눠 담기')
  await expect(page.locator('.strategy-list-card')).toHaveCount(1)
  expect(errors).toEqual([]); expect(requests).toEqual([])
})

test('카피 설정의 언어만 바뀌며 입력·payload·SVG·미등록 및 실제 호출자 원문은 유지된다', async ({ page, baseURL }) => {
  const forbidden: string[] = [], errors: string[] = [], origin = new URL(baseURL!).origin
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) { forbidden.push(`${request.method()} ${url.pathname}`); return route.abort() }
    return route.continue()
  })
  await page.route('**/detail-locale-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#141414;margin:0"><main id="tesia-main"><div id="fixture"></div></main></body></html>' }))
  await page.goto('/detail-locale-fixture.html')
  await page.setViewportSize({ width: 320, height: 1000 })
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientCatalogueCopySetup.tsx', jp = '/src/components/ClientCatalogueJudgments.tsx', dp = '/@id/react-dom/client', pp = '/src/client-preferences.ts', sp = '/src/client-catalogue.ts'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw Error('React import missing')
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp), components = await import(/* @vite-ignore */ cp), judgments = await import(/* @vite-ignore */ jp), preferences = await import(/* @vite-ignore */ pp), data = await import(/* @vite-ignore */ sp)
    for (const css of ['/src/styles.css', '/src/client-reference.css', '/src/client-shared-detail.css']) await import(/* @vite-ignore */ css)
    const React = rm.default ?? rm, root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture'))
    const strategy = data.catalogueStrategies.find((row: { id: string }) => row.id === 'd1'), before = JSON.stringify(strategy), calls: unknown[] = []
    const messages = [{ i: 400, k: 'now', title: '현재 포지션 고객 원문', t: '실제 API·사용자 원문 $& 12.34%를 유지합니다.' }]
    const render = (kind: string) => {
      if (kind === 'judgments') return root.render(React.createElement(judgments.ClientCatalogueJudgments, { messages, calendar: { start: '2023-01-02', asof: '2026-08-31' }, active: true }))
      root.render(React.createElement(components.ClientCatalogueCopySetup, { key: kind, strategy: kind === 'authored' ? { ...strategy, name: '고객 제목 $&', one: '고객 설명 그대로' } : strategy, sourcePreview: kind !== 'service', setup: { owner: 'detail-locale', sourceSha: data.catalogueSourceSha, strategyId: 'd1', revision: 'one', available: 2000, onConfirm: async (settings: unknown) => { calls.push(settings) } }, onClose: () => {} }))
    }
    Object.assign(window, { detailLocaleFixture: { render, locale: preferences.setClientPreference.bind(null, 'language'), snapshot: () => ({ strategy: JSON.stringify(strategy), before, messages: JSON.stringify(messages), calls }) } })
    render('known')
  })
  const sheet = page.locator('.catalogue-copy-sheet')
  await expect(sheet).toBeVisible()
  await sheet.locator('.ccs-field input').first().fill('1000')
  const icon = await sheet.locator('.ccs-identity svg').first().evaluate(el => el.outerHTML)
  const snapshot = await page.evaluate(() => Reflect.get(window, 'detailLocaleFixture').snapshot())
  for (const language of languages) {
    await page.evaluate(language => Reflect.get(window, 'detailLocaleFixture').locale(language), language)
    await expect(sheet.locator('.ccs-identity b')).toHaveAttribute('lang', language)
    if (language !== 'ko') await expect(sheet.locator('.ccs-identity')).not.toContainText(/[가-힣]/)
    await expect(sheet.locator('.ccs-field input').first()).toHaveValue('1000')
    expect(await sheet.locator('.ccs-identity svg').first().evaluate(el => el.outerHTML)).toBe(icon)
    expect(await page.evaluate(() => Reflect.get(window, 'detailLocaleFixture').snapshot())).toEqual(snapshot)
    expect(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  }
  await sheet.locator('.ccs-submit').click()
  expect((await page.evaluate(() => Reflect.get(window, 'detailLocaleFixture').snapshot())).calls).toEqual([{ amount: 1000, loss: -20, existing: 'skip', cap: 95 }])
  for (const kind of ['authored', 'service', 'judgments']) {
    await page.evaluate(kind => Reflect.get(window, 'detailLocaleFixture').render(kind), kind)
    for (const language of languages) {
      await page.evaluate(language => Reflect.get(window, 'detailLocaleFixture').locale(language), language)
      if (kind === 'judgments') {
        await expect(page.locator('.catalogue-judgment-heading h4')).toHaveText('현재 포지션 고객 원문')
        await expect(page.locator('.catalogue-judgment-body > p')).toHaveText('실제 API·사용자 원문 $& 12.34%를 유지합니다.')
      } else await expect(sheet.locator('.ccs-identity b')).toHaveText(kind === 'authored' ? '고객 제목 $&' : '코인 셋 나눠 담기')
    }
  }
  const after = await page.evaluate(() => Reflect.get(window, 'detailLocaleFixture').snapshot())
  expect(after.strategy).toBe(snapshot.before); expect(after.messages).toBe(snapshot.messages)
  expect(after.calls).toEqual([{ amount: 1000, loss: -20, existing: 'skip', cap: 95 }])
  expect(errors).toEqual([]); expect(forbidden).toEqual([])
})
