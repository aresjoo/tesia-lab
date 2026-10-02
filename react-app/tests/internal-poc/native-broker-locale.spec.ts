import { expect, test, type Page } from '@playwright/test'

test.use({ trace: 'retain-on-failure', video: 'off' })

async function mount(page: Page, language = 'fr', mode: 'unavailable' | 'ready' | 'empty' = 'unavailable') {
  await page.route('**/broker-locale-audit.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012"><div id="root"></div></body></html>' }))
  await page.goto('/broker-locale-audit.html')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(async ({ language, mode }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/internal-poc/NativeBrokers.tsx'
    const code = await (await fetch(cp)).text()
    const rp = code.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing transformed React instance')
    const dp = '/@id/react-dom/client', pp = '/src/client-preferences.ts'
    const rm = await import(/* @vite-ignore */ rp), React = rm.default ?? rm, DOM = await import(/* @vite-ignore */ dp), { NativeBrokers } = await import(/* @vite-ignore */ cp)
    const preferences = await import(/* @vite-ignore */ pp)
    for (const css of ['/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/node_modules/@fontsource-variable/noto-sans-sc/index.css', '/src/styles.css', '/src/client-reference.css']) await import(/* @vite-ignore */ css)
    // Match the service shell's bundled font stack, not the test host's fonts.
    document.body.style.fontFamily = '"Noto Sans KR Variable", "Noto Sans SC Variable", "Geist Variable", -apple-system, BlinkMacSystemFont, sans-serif'
    preferences.setClientPreference('language', language)
    const h = React.createElement ?? React.default.createElement
    const root = (DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('root'))
    const calls: unknown[] = [], pending: { resolve: () => void; reject: () => void }[] = []
    const wait = (value: unknown) => { calls.push(value); return new Promise<void>((resolve, reject) => pending.push({ resolve, reject: () => reject(new Error('PRIVATE_PROVIDER_ERROR')) })) }
    const catalog = [{ broker: { id: 'binance', name: 'Alpha 공급', ord: 1, tag: '거래소', assets: '공급 자산', assetsList: ['공급 자산'], conn: true, rating: 4.2,
      ratingSrc: '공급 평점 원문', traders: '21', fw0: 0, rvN: 2, traderN: 21, col: '#aabbee', fg: '#111111', site: 'example.com', about: '연결됨',
      fees: { dep: '무료 원문', wd: '공급 수수료', ina: '공급 조건' }, promo: '공급 프로모션' },
      info: { founded: '2020', hq: '공급 본사', docsUrl: 'https://example.com/docs', faq: [{ q: '닫기', a: '공급 답변' }], caps: { publicApi: true } },
      connectionState: 'CONNECTED', promotionBody: '공급 프로모션 설명', feeAsOfLabel: '공급 날짜 원문',
      reviews: [{ id: 1, rating: 4, text: '닫기', author: '공급 작성자', date: '공급 날짜', categories: ['고객 지원'] },
        { id: 2, rating: 5, text: '공급 후기 두 번째', author: '다른 작성자', date: '공급 날짜 2', categories: ['거래 조건'] }] }]
    const render = (view = mode, scope = 'broker-locale-owner', identity = 'broker-locale-data') => root.render(h(React.StrictMode, null, h(NativeBrokers, {
      onReturn: () => {}, shouldFocus: () => true, listRequest: 0, accountScope: scope, signedIn: true,
      presentation: { scope, identity, catalog: view === 'unavailable' ? null : view === 'empty' ? [] : catalog,
        actions: { onConnect: (id: string) => wait({ kind: 'connect', id }), submitReview: (id: string, review: unknown) => wait({ kind: 'review', id, review }) } },
    })))
    render()
    Object.assign(window, { brokerLocale: (value: string) => preferences.setClientPreference('language', value), brokerLocaleRender: render, brokerLocaleCalls: calls,
      brokerLocaleSettle: (index: number, failure = false) => failure ? pending[index].reject() : pending[index].resolve() })
  }, { language, mode })
  await expect(page.locator('.native-brokers')).toBeVisible()
}

test('프랑스어 선택은 헤더뿐 아니라 원본 거래소 본문에도 적용된다', async ({ page }) => {
  await mount(page)
  await expect(page.locator('.hub-header h1')).toHaveText('Plateformes compatibles')
  await expect(page.locator('.bk2-hero h2')).toHaveText('Connectez, puis lancez')
  await expect(page.locator('.bk2-bar')).not.toContainText('기본 순서')
})

const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const overview = ['개요', 'Overview', '概要', '概览', '概覽', 'Resumen', 'Aperçu']
const reviewLabels = ['리뷰', 'Reviews', 'レビュー', '评价', '評價', 'Reseñas', 'Avis']
async function changeLanguage(page: Page, language: string) { await page.evaluate(value => Reflect.get(window, 'brokerLocale')(value), language) }
async function render(page: Page, mode: string, owner = 'broker-locale-owner', identity = 'broker-locale-data') { await page.evaluate(args => Reflect.get(window, 'brokerLocaleRender')(...args), [mode, owner, identity]) }

async function expectReadableActions(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  const results = await page.locator('dialog[open]').last().locator('.bk2-actions button').evaluateAll(buttons => buttons.map(button => {
    const rect = button.getBoundingClientRect(), parent = button.parentElement!.getBoundingClientRect()
    const splitWords: string[] = []
    const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      for (const match of (node.textContent ?? '').matchAll(/[\p{L}\p{M}]+/gu)) {
        const range = document.createRange()
        range.setStart(node, match.index!); range.setEnd(node, match.index! + match[0].length)
        const tops = new Set(Array.from(range.getClientRects(), box => Math.round(box.top)))
        if (tops.size > 1) splitWords.push(match[0])
      }
    }
    return { text: button.textContent, splitWords, width: rect.width, height: rect.height,
      verticalOverflows: button.scrollHeight > button.clientHeight + 1,
      inside: rect.left >= parent.left - 1 && rect.right <= parent.right + 1,
      overflows: button.scrollWidth > button.clientWidth + 1 }
  }))
  expect(results).toHaveLength(2)
  for (const result of results) {
    expect(result.splitWords, result.text ?? 'button').toEqual([])
    expect(result.inside).toBe(true)
    expect(result.overflows).toBe(false)
    expect(result.verticalOverflows).toBe(false)
    expect(result.width).toBeGreaterThanOrEqual(44)
    expect(result.height).toBeGreaterThanOrEqual(44)
  }
}

for (const [index, language] of languages.entries()) test(`${language} 목록·상세·리뷰·모달과 empty/unavailable는 UI만 번역하고 공급 원문을 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width: info.project.name === 'mobile' ? 320 : 1440, height: 900 })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page, language, 'ready')
  await expect(page.locator('.bk2-card')).toHaveCount(1)
  if (language !== 'ko') {
    await expect(page.locator('.bk2-hero')).not.toContainText(/[가-힣]/)
    await expect(page.locator('.bk2-bar')).not.toContainText(/[가-힣]/)
  }
  await page.locator('.bk2-card .obtn').click()
  await expect(page.locator('[data-tab=overview]')).toHaveText(overview[index])
  await expect(page.locator('.bk2-about>p')).toHaveText('연결됨')
  await expect(page.locator('.bk2-fees')).toContainText('무료 원문')
  await expect(page.locator('.bk2-asof')).toHaveText('공급 날짜 원문')
  await expect(page.locator('.bk2-faq .q')).toContainText('닫기')
  await page.locator('.bk2-faq .q').click()
  await expect(page.locator('.bk2-faq .a')).toHaveText('공급 답변')
  if (language !== 'ko') await expect(page.locator('.bk2-feat')).not.toContainText(/[가-힣]/)
  await page.locator('[data-tab=reviews]').click()
  await expect(page.locator('[data-tab=reviews]')).toHaveText(reviewLabels[index])
  await page.locator('.bk2-rvgrid .bk2-rvc').filter({ hasText: '공급 작성자' }).click()
  await expect(page.locator('dialog[open] .bk2-full-review')).toHaveText('닫기')
  await expect(page.locator('dialog[open]')).toContainText('공급 작성자, 공급 날짜')
  await page.locator('dialog[open]>header button').click()
  await page.locator('.bk2-review-heading>.wbtn').click()
  await expect(page.locator('dialog[open] textarea')).toBeVisible()
  if (language !== 'ko') await expect(page.locator('dialog[open] .bk2-wm')).not.toContainText(/[가-힣]/)
  await expectReadableActions(page)
  await page.screenshot({ path: info.outputPath(`broker-writer-${language}.png`) })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.locator('dialog[open]>header button').click()
  await page.locator('.bk2-bc button').click()
  await expect(page.locator('.bk2-hero')).toBeVisible()
  await render(page, 'empty')
  await expect(page.locator('.bk2-card')).toHaveCount(0)
  await expect(page.locator('.bk2-empty')).toBeVisible()
  if (language !== 'ko') await expect(page.locator('.bk2-page')).not.toContainText(/[가-힣]/)
  await render(page, 'unavailable')
  await expect(page.locator('.bk2-card')).toHaveCount(21)
  await page.locator('.bk2-card .obtn').first().click()
  if (language !== 'ko') await expect(page.locator('.bk2-det')).not.toContainText(/[가-힣]/)
  expect(errors).toEqual([])
})

test('언어 변경은 필터·정렬·상세·FAQ·리뷰 초안과 pending을 보존하고 성공/실패 카피만 갱신한다', async ({ page }) => {
  await mount(page, 'ko', 'ready')
  await page.locator('.bk2-bar .fp').nth(4).click()
  await page.locator('.tfbk-drop').click()
  await page.getByRole('option', { name: '최고 평점', exact: true }).click()
  await changeLanguage(page, 'fr')
  await expect(page.locator('.bk2-bar .fp').nth(4)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.tfbk-drop')).toContainText('Meilleure note')
  await page.locator('.bk2-card .obtn').click()
  await page.locator('.bk2-faq .q').click()
  await changeLanguage(page, 'en')
  await expect(page.locator('.bk2-faq .q')).toHaveAttribute('aria-expanded', 'true')
  await page.locator('[data-tab=reviews]').click()
  await page.locator('.bk2-cats button').nth(3).click()
  await page.locator('.bk2-review-heading>.wbtn').click()
  await page.locator('[data-rating="4"]').click()
  const field = page.locator('dialog[open] textarea')
  await field.fill('공급자 문구가 아닌 내가 쓰는 원문 {name} 😃')
  await field.evaluate(node => Reflect.set(window, 'originalBrokerDraft', node))
  for (const language of languages) {
    await changeLanguage(page, language)
    await expect(field).toHaveValue('공급자 문구가 아닌 내가 쓰는 원문 {name} 😃')
    expect(await field.evaluate(node => node === Reflect.get(window, 'originalBrokerDraft'))).toBe(true)
    await expect(page.locator('[data-rating="4"]')).toHaveAttribute('aria-checked', 'true')
  }
  await page.locator('.bk2-actions .wbtn').click()
  await changeLanguage(page, 'en')
  await expect(page.locator('.bk2-actions .wbtn')).toHaveText('Submitting…')
  await expect(field).toBeDisabled()
  expect(await page.evaluate(() => Reflect.get(window, 'brokerLocaleCalls').length)).toBe(1)
  await page.evaluate(() => Reflect.get(window, 'brokerLocaleSettle')(0, true))
  await expect(page.locator('.bk2-error')).toContainText('Failed to submit review')
  await changeLanguage(page, 'fr')
  await expect(page.locator('.bk2-error')).toContainText("Échec de l'envoi")
  await expect(field).toHaveValue('공급자 문구가 아닌 내가 쓰는 원문 {name} 😃')
  await page.locator('.bk2-actions .wbtn').click()
  await changeLanguage(page, 'en')
  await page.evaluate(() => Reflect.get(window, 'brokerLocaleSettle')(1))
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(page.locator('.bk2-rvgrid')).toBeVisible()
  await expect(page.locator('.bk2-mine')).toHaveCount(0)
  await changeLanguage(page, 'fr')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(page.locator('.bk2-rvgrid')).not.toContainText('공급자 문구가 아닌 내가 쓰는 원문 {name} 😃')
})

for (const width of [320, 390, 768, 1440]) test(`후기 작성 ${width}px 확대 버튼은 단어를 쪼개지 않고 확인·취소·등록 중 상태를 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await mount(page, 'en', 'ready')
  await page.addStyleTag({ content: '.tfbk-dialog .bk2-actions button { font-size: 24px; }' })
  await page.locator('.bk2-card .obtn').click()
  await page.locator('[data-tab=reviews]').click()
  await page.locator('.bk2-review-heading>.wbtn').click()
  const expectedPadding = width <= 768 ? '16px' : '31px'
  for (const button of await page.locator('dialog[open] .bk2-actions button').all()) {
    await expect(button).toHaveCSS('padding-inline-start', expectedPadding)
    await expect(button).toHaveCSS('padding-inline-end', expectedPadding)
  }
  for (const language of ['en', 'es', 'fr']) {
    await changeLanguage(page, language)
    await expectReadableActions(page)
  }
  await page.locator('[data-rating="4"]').click()
  const draft = page.locator('dialog[open] textarea')
  await draft.fill('A detailed review I want to keep.')
  await page.locator('.bk2-wm .bk2-actions .obtn').click()
  await expect(page.locator('dialog[open]')).toHaveCount(2)
  for (const language of ['en', 'es', 'fr']) {
    await changeLanguage(page, language)
    await expectReadableActions(page)
  }
  await page.locator('dialog[open]').last().locator('.bk2-actions .obtn').click()
  await expect(page.locator('dialog[open]')).toHaveCount(1)
  await expect(draft).toHaveValue('A detailed review I want to keep.')
  await page.locator('.bk2-actions .wbtn').click()
  await expect(draft).toBeDisabled()
  await expectReadableActions(page)
  await page.evaluate(() => Reflect.get(window, 'brokerLocaleSettle')(0, true))
  await expect(draft).toBeEnabled()
  await expect(draft).toHaveValue('A detailed review I want to keep.')
  await expectReadableActions(page)
  await page.screenshot({ path: info.outputPath(`broker-writer-expanded-${width}.png`) })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})

test('열린 미연결 안내·실패모달도 번역되며 owner 교체 뒤 늦은 응답은 새 화면을 바꾸지 않는다', async ({ page }) => {
  await mount(page, 'ko', 'unavailable')
  await page.locator('.bk2-card .wbtn').first().click()
  await changeLanguage(page, 'fr')
  await expect(page.locator('dialog[open]>header h2')).toHaveText('Ouvrir un compte')
  await expect(page.locator('dialog[open] .tfbk-dialog-body')).not.toContainText(/[가-힣]/)
  await page.locator('dialog[open]>header button').click()
  await render(page, 'ready')
  await page.locator('.bk2-card .obtn').click()
  await page.locator('.bk2-head .ha .obtn').click()
  await page.evaluate(() => Reflect.get(window, 'brokerLocaleSettle')(0, true))
  await expect(page.locator('dialog[open]>header h2')).toHaveText('Impossible de vérifier la demande')
  await changeLanguage(page, 'en')
  await expect(page.locator('dialog[open]>header h2')).toHaveText('Unable to verify request')
  await page.locator('dialog[open]>header button').click()
  await page.locator('.bk2-head .ha .obtn').click()
  await render(page, 'ready', 'new-owner')
  await page.evaluate(() => Reflect.get(window, 'brokerLocaleSettle')(1, true))
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(page.locator('.bk2-hero')).toBeVisible()
  expect(await page.evaluate(() => Reflect.get(window, 'brokerLocaleCalls').length)).toBe(2)
})
