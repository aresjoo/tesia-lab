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

for (const success of [true, false]) test(`공유 메뉴 ${success ? '성공' : '실패'}는 원본 한 위치와 수명만 사용한다`, async ({ page }) => {
  await mountArticle(page, false, false, undefined, 'https://news.example.test/copy-lifecycle')
  await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') })
  await page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'))
  await page.evaluate(success => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { if (!success) throw new Error('TEST_DENIED') } } }), success)
  const trigger = page.getByRole('button', { name: '공유', exact: true })
  await trigger.click()
  const popup = page.locator('.nfz-shpop'), status = page.locator('.nfz-social .cplbl')
  await popup.getByRole('button', { name: '링크 복사' }).click()
  if (success) {
    await expect(popup).toContainText('복사했습니다!')
    await expect(status).toBeEmpty()
    await expect(popup.getByRole('status')).toHaveText('복사했습니다!')
    await page.clock.runFor(1399)
    await expect(popup).toBeVisible()
    await page.clock.runFor(1)
    await expect(popup).toHaveCount(0)
    await expect(trigger).toBeFocused()
  } else {
    await expect(status).toHaveText('복사에 실패했습니다')
    await expect(popup.getByRole('button', { name: '링크 복사' })).toHaveText('링크 복사')
    await page.clock.runFor(1999)
    await expect(popup).toBeVisible()
    await expect(status).toHaveText('복사에 실패했습니다')
    await page.clock.runFor(1)
    await expect(status).toBeEmpty()
    await expect(popup).toBeVisible()
  }
})

test('닫은 공유 메뉴의 늦은 복사와 이전 타이머는 다시 연 메뉴를 변경하지 않는다', async ({ page }) => {
  await mountArticle(page, false, false, undefined, 'https://news.example.test/copy-late')
  await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') })
  await page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'))
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise<void>(resolve => { Reflect.set(window, 'resolveInsightCopy', resolve) }) } }))
  const trigger = page.getByRole('button', { name: '공유', exact: true }), popup = page.locator('.nfz-shpop')
  await trigger.click()
  await popup.getByRole('button', { name: '링크 복사' }).click()
  await page.keyboard.press('Escape')
  await trigger.click()
  await page.evaluate(() => Reflect.get(window, 'resolveInsightCopy')())
  await page.clock.runFor(2100)
  await expect(popup).toBeVisible()
  await expect(popup.getByRole('button', { name: '링크 복사' })).toHaveText('링크 복사')
  await expect(page.locator('.nfz-social .cplbl')).toBeEmpty()
  await popup.getByRole('button', { name: '링크 복사' }).click()
  await page.evaluate(() => Reflect.get(window, 'resolveInsightCopy')())
  await expect(popup).toContainText('복사했습니다!')
  await page.keyboard.press('Escape')
  await trigger.click()
  await page.clock.runFor(2100)
  await expect(popup).toBeVisible()
  await expect(popup.getByRole('button', { name: '링크 복사' })).toHaveText('링크 복사')
})

test('하단 복사는 메뉴 결과를 재사용하지 않고 1600ms 뒤 표시만 지운다', async ({ page }) => {
  await mountArticle(page, false, false, undefined, 'https://news.example.test/copy-social')
  await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') })
  await page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'))
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } }))
  await page.locator('.nfz-social button[aria-label="링크 복사"]').click()
  const status = page.locator('.nfz-social .cplbl')
  await expect(status).toHaveText('복사했습니다!')
  await page.getByRole('button', { name: '공유', exact: true }).click()
  await expect(page.locator('.nfz-shpop button').first()).toHaveText('링크 복사')
  await page.clock.runFor(1599)
  await expect(status).toHaveText('복사했습니다!')
  await page.clock.runFor(1)
  await expect(status).toBeEmpty()
  await expect(page.locator('.nfz-shpop')).toBeVisible()
})

test('목록으로 이동한 뒤 도착한 복사 결과는 새 기사 상태와 초점을 바꾸지 않는다', async ({ page }) => {
  await mountArticle(page, false, false, undefined, 'https://news.example.test/copy-navigation')
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise<void>(resolve => { Reflect.set(window, 'resolveInsightCopy', resolve) }) } }))
  await page.getByRole('button', { name: '공유', exact: true }).click()
  await page.locator('.nfz-shpop').getByRole('button', { name: '링크 복사' }).click()
  await page.locator('.nfz-back').click()
  await expect(page.locator('.nfz-grid3 .nfz-card')).toHaveCount(1)
  await page.locator('.nfz-grid3 .nfz-card').click()
  await expect(page.locator('.nfz-a h1')).toBeFocused()
  await page.evaluate(() => Reflect.get(window, 'resolveInsightCopy')())
  await expect(page.locator('.nfz-social .cplbl')).toBeEmpty()
  await expect(page.locator('.nfz-shpop')).toHaveCount(0)
  await expect(page.locator('.nfz-a h1')).toBeFocused()
  expect(await page.evaluate(() => Reflect.get(window, 'insightCopyCalls'))).toEqual({ login: [], asks: [], feedback: [] })
})

test('복사 요청의 역순 완료는 가장 최근 결과만 한 곳에 표시한다', async ({ page }) => {
  await mountArticle(page, false, false, undefined, 'https://news.example.test/copy-order')
  await page.evaluate(() => {
    const completions: { resolve: () => void; reject: () => void }[] = []
    Reflect.set(window, 'insightCopyCompletions', completions)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise<void>((resolve, reject) => completions.push({ resolve, reject: () => reject(new Error('TEST_DENIED')) })) } })
  })
  await page.getByRole('button', { name: '공유', exact: true }).click()
  const button = page.locator('.nfz-shpop').getByRole('button', { name: '링크 복사' })
  await button.click()
  await button.click()
  await page.evaluate(() => Reflect.get(window, 'insightCopyCompletions')[1].reject())
  await expect(page.locator('.nfz-social .cplbl')).toHaveText('복사에 실패했습니다')
  await page.evaluate(() => Reflect.get(window, 'insightCopyCompletions')[0].resolve())
  await expect(page.locator('.nfz-social .cplbl')).toHaveText('복사에 실패했습니다')
  await expect(button).toHaveText('링크 복사')
  await expect(button).toBeFocused()
})

test('Clipboard API 미제공은 실패 안내만 표시하며 대체 쓰기 권한을 추가하지 않는다', async ({ page }) => {
  await mountArticle(page, false, false, undefined, 'https://news.example.test/copy-unavailable')
  await page.evaluate(() => {
    Reflect.set(window, 'insightLegacyCopyCalls', 0)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    document.execCommand = () => { Reflect.set(window, 'insightLegacyCopyCalls', Reflect.get(window, 'insightLegacyCopyCalls') + 1); return true }
  })
  await page.locator('.nfz-social button[aria-label="링크 복사"]').click()
  await expect(page.locator('.nfz-social .cplbl')).toHaveText('복사에 실패했습니다')
  expect(await page.evaluate(() => Reflect.get(window, 'insightLegacyCopyCalls'))).toBe(0)
  await expect(page.locator('textarea')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'insightCopyCalls'))).toEqual({ login: [], asks: [], feedback: [] })
})

for (const reopen of [false, true]) test(`후속 늦은 복사 거절은 ${reopen ? '재열린' : '닫힌'} 메뉴와 무관하게 하단에만 2000ms 표시한다`, async ({ page }) => {
  await mountArticle(page, false, false, undefined, 'https://news.example.test/late-copy-denial')
  await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') })
  await page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'))
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise<void>((_resolve, reject) => Reflect.set(window, 'rejectInsightCopy', () => reject(new Error('TEST_DENIED')))) } }))
  const trigger = page.getByRole('button', { name: '공유', exact: true }), popup = page.locator('.nfz-shpop'), status = page.locator('.nfz-social .cplbl')
  await trigger.click()
  await popup.getByRole('button', { name: '링크 복사' }).click()
  await page.keyboard.press('Escape')
  if (reopen) await trigger.click()
  await page.evaluate(() => Reflect.get(window, 'rejectInsightCopy')())
  await expect(status).toHaveText('복사에 실패했습니다')
  await expect(trigger).toBeFocused()
  await expect(popup).toHaveCount(reopen ? 1 : 0)
  if (reopen) await expect(popup.getByRole('button', { name: '링크 복사' })).toHaveText('링크 복사')
  await page.clock.runFor(1999)
  await expect(status).toHaveText('복사에 실패했습니다')
  await page.clock.runFor(1)
  await expect(status).toBeEmpty()
  await expect(popup).toHaveCount(reopen ? 1 : 0)
})

test('후속 복사 결과 색상은 원본 성공 녹색과 실패 적색의 실제 계산값이다', async ({ page }) => {
  await mountArticle(page, false, false, undefined, 'https://news.example.test/copy-colors')
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } }))
  await page.getByRole('button', { name: '공유', exact: true }).click()
  await page.locator('.nfz-shpop').getByRole('button', { name: '링크 복사' }).click()
  await expect(page.locator('.nfz-shpop button span')).toHaveCSS('color', 'rgb(78, 192, 141)')
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('TEST_DENIED') } } }))
  await page.locator('.nfz-shpop').getByRole('button', { name: '링크 복사' }).click()
  await expect(page.locator('.nfz-social .cplbl')).toHaveText('복사에 실패했습니다')
  await expect(page.locator('.nfz-social .cplbl')).toHaveCSS('color', 'rgb(224, 96, 75)')
})

test('후속 복사 성공 알림은 버튼 밖의 기존 sr-only 형제 live region 한 곳에만 둔다', async ({ page }) => {
  await mountArticle(page, false, false, undefined, 'https://news.example.test/copy-live-region')
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } }))
  await page.getByRole('button', { name: '공유', exact: true }).click()
  const popup = page.locator('.nfz-shpop')
  await popup.getByRole('button', { name: '링크 복사' }).click()
  const status = popup.locator(':scope > .insight-sr[role="status"]')
  await expect(status).toHaveText('복사했습니다!')
  await expect(popup.locator('button [role="status"]')).toHaveCount(0)
  await expect(popup.getByRole('button', { name: '링크 복사' })).toHaveText('복사했습니다!')
  await expect(page.locator('.nfz-social .cplbl')).toBeEmpty()
  await expect(status).toHaveCSS('clip-path', 'inset(50%)')
})

test('후속 오래된 거절은 새 복사 요청이나 기사 세대를 넘어 표시되지 않는다', async ({ page }) => {
  await mountArticle(page, false, false, undefined, 'https://news.example.test/copy-stale-denial')
  await page.evaluate(() => {
    const completions: { resolve: () => void; reject: () => void }[] = []
    Reflect.set(window, 'insightCopyCompletions', completions)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise<void>((resolve, reject) => completions.push({ resolve, reject: () => reject(new Error('TEST_DENIED')) })) } })
  })
  const trigger = page.getByRole('button', { name: '공유', exact: true }), popup = page.locator('.nfz-shpop')
  await trigger.click()
  await popup.getByRole('button', { name: '링크 복사' }).click()
  await page.keyboard.press('Escape')
  await trigger.click()
  await popup.getByRole('button', { name: '링크 복사' }).click()
  await page.evaluate(() => { Reflect.get(window, 'insightCopyCompletions')[1].resolve(); Reflect.get(window, 'insightCopyCompletions')[0].reject() })
  await expect(popup.getByRole('button', { name: '링크 복사' })).toHaveText('복사했습니다!')
  await expect(page.locator('.nfz-social .cplbl')).toBeEmpty()
  await popup.getByRole('button', { name: '링크 복사' }).click()
  await page.locator('.nfz-back').click()
  await page.locator('.nfz-grid3 .nfz-card').click()
  await page.evaluate(() => Reflect.get(window, 'insightCopyCompletions')[2].reject())
  await expect(page.locator('.nfz-social .cplbl')).toBeEmpty()
  await expect(popup).toHaveCount(0)
  await expect(page.locator('.nfz-a h1')).toBeFocused()
})
