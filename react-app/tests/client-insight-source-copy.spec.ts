import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { INSIGHT_TAG_LABELS, insightTagLabel, insightSourceCopy } from '../src/client-insight-source-copy'

test('9fbff821 sk-ins 원본 38개 태그 표시를 정확히 계승하고 키는 보존한다', () => {
  // Independently extracted from 9fbff821 tools/sk-ins.js, not from the React map.
  const pairs = Object.entries(INSIGHT_TAG_LABELS).map(([key, values]) => [key, values[0]])
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
  expect(pairs).toHaveLength(38)
  expect(createHash('sha256').update(JSON.stringify(pairs)).digest('hex')).toBe('fb7e511cae245130c3e333ad0b213604afed47799b0be655e4bc00c7aca584a0')
  for (const [key, values] of Object.entries(INSIGHT_TAG_LABELS)) {
    expect(values).toHaveLength(7)
    expect(values.every(value => value.trim().length > 0)).toBe(true)
    expect(insightTagLabel('ko', key.toUpperCase())).toBe(values[0])
  }
  for (const tag of ['__proto__', 'constructor', 'toString', 'publisher-special-tag', ' bitcoin ', '']) {
    expect(insightTagLabel('ko', tag)).toBe(tag)
  }
  expect(insightSourceCopy('ko', 'topics')).toBe('주제별로 보기')
  expect(insightSourceCopy('ko', 'popular')).toBe('많이 읽는 글')
  expect((['negative', 'neutral', 'positive'] as const).map(key => insightSourceCopy('ko', key))).toEqual(['도움 안 됨', '조금 도움', '도움 됨'])
})

// Fixed 9fbff821 index.html final tfIns2View:17795–17820 and
// tfIns2AssetDlg:17912–17917. These literals are independent source expectations.
async function mountArticle(page: Page, signedIn = false, emptyAssets = false, initialSlug?: string, shareUrl?: string) {
  await page.route('**/insight-source-copy-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture"></div></body></html>' }))
  await page.goto('/insight-source-copy-test.html')
  await page.evaluate(async options => {
    const refresh = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const rp = '/@id/react', dp = '/@id/react-dom/client', cp = '/src/components/ClientInsights.tsx'
    const fp = '/src/client-insight-fixtures.ts', pp = '/src/client-preferences.ts'
    const react = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp)
    const { ClientInsights } = await import(/* @vite-ignore */ cp)
    const { CLIENT_INSIGHTS } = await import(/* @vite-ignore */ fp)
    const { setClientPreference } = await import(/* @vite-ignore */ pp)
    setClientPreference('language', 'ko')
    const original = CLIENT_INSIGHTS[0]
    // Explicit presentation fixture, not a network provider or article source.
    const article = { ...original, assets: options.emptyAssets ? [] : original.assets, shareUrl: options.shareUrl }
    const data = { identity: 'source-copy-boundary', heading: '시험 기사', subheading: '', articles: [article] }
    const calls = { login: [] as string[], asks: [] as string[], feedback: [] as unknown[] }
    Object.assign(window, { insightCopyCalls: calls, sourceAssets: CLIENT_INSIGHTS.map((row: { assets: string[][] }) => row.assets.length), articleAssets: article.assets, articleTitle: article.title })
    const h = react.createElement ?? react.default.createElement
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    root.render(h(react.StrictMode ?? react.default.StrictMode, null, h(ClientInsights, {
      source: 'service', data, signedIn: options.signedIn, initialSlug: options.initialSlug ?? article.slug,
      onAsk: async (text: string) => { calls.asks.push(text) },
      onLogin: (mode: string) => calls.login.push(mode),
      onFeedback: async (slug: string, value: number) => { calls.feedback.push([slug, value]) },
    })))
  }, { signedIn, emptyAssets, initialSlug, shareUrl })
  await expect(page.locator('.client-insights h1')).toBeVisible()
}

test('상세 게이트·관련 자산·다음 글의 최종 원본문구와 로그인 의도를 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await mountArticle(page)
  await expect(page.locator('.nfz-gate .hl')).toHaveText('TETH에서 계속 읽어보십시오')
  await expect(page.locator('.nfz-gate .s2')).toHaveText('무료 계정을 만들면 모든 인사이트와개인화된 시장 분석을 끝까지 읽을 수 있습니다.')
  await expect(page.locator('.nfz-gate .fr')).toHaveText('영원히 무료, 카드 등록 필요없음')
  await expect(page.locator('.nfz-gate .lg')).toHaveText('이미 계정이 있으십니까? 로그인')
  await expect(page.locator('.nfz-assets .ah')).toHaveText('이 인사이트에 나온 자산, 지금은 어떤 상황입니까?')
  await expect(page.locator('.nfz-assets .as')).toHaveText('누르면 TETH에게 물어볼 내용을 정리해드립니다.')
  await expect(page.locator('.nfz-next .nh')).toHaveText('다음 인사이트도 읽어보십시오')
  await page.locator('.nfz-gate .b1').click()
  await page.locator('.nfz-gate .lg button').click()
  await page.locator('.nfz-ast').first().click()
  expect(await page.evaluate(() => Reflect.get(window, 'insightCopyCalls'))).toEqual({ login: ['signup', 'login', 'login'], asks: [], feedback: [] })
  await expect(page.locator('dialog')).toHaveCount(0)
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
})

test('회원 피드백과 자산 질문 시트의 원본문구·질문 전달·키보드 복귀를 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await mountArticle(page, true)
  await expect(page.locator('.nfz-gate')).toHaveCount(0)
  await expect(page.locator('.nfz-fb .q')).toHaveText('이 인사이트가 도움이 되었습니까?')
  const asset = page.locator('.nfz-ast').first()
  await asset.click()
  await expect(page.locator('dialog .nfz-astdlg > p')).toHaveText('TETH에게 추가적으로 궁금한 점이 있습니까?비워두고 진행해도 됩니다. 기본 분석 질문과 함께 전달됩니다.')
  await expect(page.locator('dialog textarea')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog')).toHaveCount(0)
  await expect(asset).toBeFocused()
  await asset.press('Enter')
  await page.locator('dialog textarea').fill('거래량도 같이 설명해줘')
  await page.locator('dialog button[type=submit]').click()
  await expect(page.locator('dialog')).toHaveCount(0)
  const expected = await page.evaluate(() => {
    const [symbol, name] = Reflect.get(window, 'articleAssets')[0]
    return `${name}(${symbol})의 현재 시장 상태를 분석해줘. 최근 가격 흐름, 주요 뉴스, 변동성, 핵심 기술적 구간과, 방금 읽은 인사이트 "${Reflect.get(window, 'articleTitle')}" 내용과의 관련성을 함께 설명해줘. 추가로 궁금한 점: 거래량도 같이 설명해줘`
  })
  expect(await page.evaluate(() => Reflect.get(window, 'insightCopyCalls').asks)).toEqual([expected])
  await page.getByRole('button', { name: '도움 됨', exact: true }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'insightCopyCalls').feedback.length)).toBe(1)
})

test('원본 15개 기사 자산은 유지하고 명시 빈 자산에는 제목·빈 선택 행을 만들지 않는다', async ({ page }) => {
  await mountArticle(page, false, true)
  const counts: number[] = await page.evaluate(() => Reflect.get(window, 'sourceAssets'))
  expect(counts).toHaveLength(15)
  expect(counts.every(count => count > 0)).toBe(true)
  await expect(page.locator('.nfz-assets')).toHaveCount(0)
  await expect(page.locator('.nfz-gate')).toBeVisible()
  await expect(page.locator('.nfz-social')).toBeVisible()
  await expect(page.locator('.nfz-next')).toBeVisible()
  expect(await page.evaluate(() => Reflect.get(window, 'insightCopyCalls'))).toEqual({ login: [], asks: [], feedback: [] })
})

test('없는 일반 기사는 원본 안내로 표시하고 쓰기 없이 목록에 복귀한다', async ({ page }) => {
  await mountArticle(page, false, false, 'missing-source-copy-article')
  await expect(page.getByRole('heading', { name: '글을 찾을 수 없습니다', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '인사이트 전체 보기', exact: true }).click()
  await expect(page.locator('.nfz-grid3 .nfz-card')).toHaveCount(1)
  expect(await page.evaluate(() => Reflect.get(window, 'insightCopyCalls'))).toEqual({ login: [], asks: [], feedback: [] })
})

test('이메일 공급 부재는 원문으로 안내하며 불투명 개인화 토큰 부재와 구분한다', async ({ page }) => {
  await mountArticle(page, true, false, 'email')
  await expect(page.getByRole('heading', { name: '생성된 맞춤 인사이트가 없습니다', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '인사이트 홈으로', exact: true }).click()
  await expect(page.locator('.nfz-grid3 .nfz-card')).toHaveCount(1)
  expect(await page.evaluate(() => Reflect.get(window, 'insightCopyCalls'))).toEqual({ login: [], asks: [], feedback: [] })
  await mountArticle(page, true, false, 'p/unknown-opaque-token')
  // No supplied state means neither invalid syntax, expiration nor a new version.
  await expect(page.getByRole('heading', { name: '글을 찾을 수 없어요', exact: true })).toBeVisible()
  await expect(page.locator('.client-insights')).not.toContainText(/잘못된.*주소|만료|갱신/)
  await page.getByRole('button', { name: '인사이트 홈으로', exact: true }).click()
  await expect(page.locator('.nfz-grid3 .nfz-card')).toHaveCount(1)
  expect(await page.evaluate(() => Reflect.get(window, 'insightCopyCalls'))).toEqual({ login: [], asks: [], feedback: [] })
})

test('복사 성공은 최종 원본문구로 표시하고 공급된 링크만 클립보드에 전달한다', async ({ page }) => {
  const shareUrl = 'https://news.example.test/articles/source-copy'
  await mountArticle(page, false, false, undefined, shareUrl)
  await page.evaluate(() => {
    const copied: string[] = []
    Object.assign(window, { insightCopied: copied })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied.push(text) } } })
  })
  await page.locator('.nfz-social button[aria-label="링크 복사"]').click()
  await expect(page.locator('.nfz-social .cplbl')).toHaveText('복사했습니다!')
  expect(await page.evaluate(() => Reflect.get(window, 'insightCopied'))).toEqual([shareUrl])
  expect(await page.evaluate(() => Reflect.get(window, 'insightCopyCalls'))).toEqual({ login: [], asks: [], feedback: [] })
})

test('게스트 이메일 안내는 원문을 계승하고 명시 로그인 외 쓰기를 만들지 않는다', async ({ page }) => {
  await mountArticle(page, false, false, 'email')
  await expect(page.locator('.insight-empty h1')).toHaveText('이메일 미리보기는 로그인 후 볼 수 있습니다')
  await expect(page.locator('.nfz-mail')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'insightCopyCalls'))).toEqual({ login: [], asks: [], feedback: [] })
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'insightCopyCalls'))).toEqual({ login: ['login'], asks: [], feedback: [] })
  await page.locator('.nfz-back').click()
  await expect(page.locator('.nfz-grid3 .nfz-card')).toHaveCount(1)
})

test('복사 실패는 원문으로 알리며 성공 표시나 로그인·질문 쓰기를 만들지 않는다', async ({ page }) => {
  const shareUrl = 'https://news.example.test/articles/source-copy-failure'
  await mountArticle(page, false, false, undefined, shareUrl)
  await page.evaluate(() => {
    const attempted: string[] = []
    Object.assign(window, { insightCopyAttempts: attempted })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { attempted.push(text); throw new Error('TEST_CLIPBOARD_DENIED') } } })
  })
  await page.locator('.nfz-social button[aria-label="링크 복사"]').click()
  await expect(page.locator('.nfz-social .cplbl')).toHaveText('복사에 실패했습니다')
  expect(await page.evaluate(() => Reflect.get(window, 'insightCopyAttempts'))).toEqual([shareUrl])
  expect(await page.evaluate(() => Reflect.get(window, 'insightCopyCalls'))).toEqual({ login: [], asks: [], feedback: [] })
  await expect(page.locator('.client-insights')).not.toContainText('복사했습니다!')
})
