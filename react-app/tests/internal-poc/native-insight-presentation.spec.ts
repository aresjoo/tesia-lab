import { expect, test, type Page } from '@playwright/test'
import type { InsightPersonalizedPresentation, InsightPresentationData } from '../../src/client-insight-presentation'
import { insightPresentationCopy } from '../../src/client-insight-presentation-copy'

// Explicit presentation fixture, not a real news feed or an HTTP contract.
const data: InsightPresentationData = {
  identity: 'test-publisher-edition-a', heading: '공급된 기사 모음', subheading: '공급된 시장 해설', periodLabel: '2026.08.01–2026.08.04',
  curators: [{ name: '공급 큐레이터' }], curatorLabel: '편집',
  articles: Array.from({ length: 4 }, (_, i) => ({
    slug: `supplied-${i}`, title: `공급된 기사 ${i}`, sub: `고유한 기사 설명 ${i}`, cat: '시장 흐름',
    authorName: `공급 저자 ${i}`, publishedAt: `2026-08-0${i + 1}T12:34:56Z`,
    placement: i === 0 ? 'featured' : i < 3 ? 'secondary' : 'standard', trendingRank: 10 - i,
    tags: i % 2 ? ['금리'] : ['비트코인'], assets: [['BTC', '비트코인']],
    body: [{ h: '첫 번째 근거', ps: ['사용자가 공급한 **강조 문장**입니다.'] }, { h: '두 번째 근거', ps: ['독립된 두 번째 단락입니다.'] }, { q: '공급된 인용' }, { h: '세 번째 근거', ps: ['마지막 근거입니다.'] }],
    shareUrl: `https://news.example.test/articles/supplied-${i}`,
  })),
}

async function mount(page: Page, options: { supplied?: InsightPresentationData | null; guest?: boolean; unavailableAsk?: boolean; noHref?: boolean; preview?: boolean } = {}) {
  const failures: string[] = []
  page.on('pageerror', error => failures.push(error.message))
  await page.route('**/native-insight-presentation-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#0f1012"></body></html>' }))
  await page.goto('/native-insight-presentation-test.html')
  await page.evaluate(async ({ supplied, guest, unavailableAsk, noHref, preview }) => {
    const path = '/@react-refresh', runtime = (await import(/* @vite-ignore */ path)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (value: unknown) => value, __vite_plugin_react_preamble_installed__: true })
    await Promise.all(['/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/node_modules/@fontsource-variable/geist/index.css'].map(path => import(/* @vite-ignore */ path)))
    const rp = '/@id/react', dp = '/@id/react-dom/client', cp = preview ? '/src/components/ClientInsights.tsx' : '/src/internal-poc/NativeInsights.tsx', ep = '/src/client-insight-navigation.ts'
    const React = await import(/* @vite-ignore */ rp), DOM = await import(/* @vite-ignore */ dp), component = await import(/* @vite-ignore */ cp), { ClientInsightQuestionError } = await import(/* @vite-ignore */ ep)
    const View = preview ? component.ClientInsights : component.NativeInsights
    const host = document.createElement('div'); document.body.append(host)
    const root = (DOM.createRoot ?? DOM.default.createRoot)(host)
    let currentData = supplied, location: { slug?: string; tag?: string } = {}
    const state = { asks: [] as string[], login: [] as string[], feedback: [] as [string, number][], failAsk: false, returns: 0, failFeedback: false }
    const render = () => root.render((React.createElement ?? React.default.createElement)(View, {
      data: currentData, signedIn: !guest, shouldFocus: () => true, controlledLocation: location,
      locationHref: noHref ? undefined : (next: typeof location) => next.slug ? `#/native-insight/${encodeURIComponent(next.slug)}` : '#/native-insight',
      onNavigate: (next: typeof location) => { location = next; render() },
      onAsk: unavailableAsk ? undefined : async (text: string) => { state.asks.push(text); if (state.failAsk) throw new ClientInsightQuestionError('테스트 질문 연결 실패') },
      onFeedback: async (slug: string, value: number) => { state.feedback.push([slug, value]); if (state.failFeedback) throw new Error('test-offline') },
      onLogin: (mode: string) => state.login.push(mode), onReturn: () => { state.returns++ },
    }))
    Object.assign(window, { nativeInsightState: state, nativeInsightNavigate: (next: typeof location) => { location = next; render() }, nativeInsightData: (next: typeof supplied) => { currentData = next; render() } })
    render()
  }, { supplied: options.supplied === undefined ? data : options.supplied, guest: options.guest, unavailableAsk: options.unavailableAsk, noHref: options.noHref, preview: options.preview })
  await expect(page.locator('.client-insights')).toBeVisible()
  return failures
}

test('원본 태그의 표시만 번역하고 긴 외부 태그·기사 제목·발행 시각은 보존한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 920 })
  const longTag = 'publisher-original-taxonomy-'.repeat(12)
  const supplied = { ...data, articles: data.articles.map(article => ({ ...article, tags: ['bitcoin', longTag] })) }
  await mount(page, { supplied })
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', language) }, language)
    await expect(page.locator('.nfz-open h1')).toHaveText('공급된 기사 모음공급된 시장 해설')
    await expect(page.locator('.nfz-topics .tp').filter({ hasText: longTag })).toHaveText(longTag)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.locator('.nfz-topics .tp').filter({ hasText: longTag }).click()
  await expect(page.locator('.nfz-sh h2').first()).toHaveText(`태그: ${longTag}`)
  await expect(page.locator('.nfz-t1 .nfz-card')).toHaveCount(4)
  await page.locator('.nfz-t1 .nfz-card').first().click()
  const time = page.locator('.nfz-meta time')
  await expect(time).toHaveAttribute('datetime', '2026-08-01T12:34:56.000Z')
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('.nfz-tags .tg,.nfz-topics .tp span')) el.style.fontSize = '26px'
  })
  await expect(page.locator('.nfz-a h1')).toHaveText('공급된 기사 0')
  await expect(page.locator('.nfz-tags .tg').filter({ hasText: longTag })).toHaveText(longTag)
  expect(await page.locator('.nfz-tags .tg,.nfz-topics .tp').evaluateAll(nodes => nodes.every(el => el.scrollWidth <= el.clientWidth + 2))).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.locator('.nfz-tags').screenshot({ path: info.outputPath('source-tags-320-200.png') })
})

test('native는 공급 기사로 원본 갤러리·상세·태그·관련기사와 목록 복귀를 모두 제공한다', async ({ page }, info) => {
  const errors = await mount(page)
  await expect(page.locator('.client-insights')).toHaveAttribute('data-source', 'SUPPLIED')
  await expect(page.locator('.nfz-card')).toHaveCount(4)
  await expect(page.locator('.nfz-top3 .c1 .nfz-card')).toHaveCount(2)
  await expect(page.locator('.nfz-cur')).toContainText('공급 큐레이터')
  await expect(page.locator('.client-insights')).not.toContainText('Sarah Bennett')
  await expect(page.locator('.client-insights')).not.toContainText('최근 72시간')
  await expect(page.locator('.nfz-bigc')).toHaveAttribute('href', '#/native-insight/supplied-0')
  await page.locator('.nfz-bigc').click()
  await expect(page.locator('.nfz-a h1')).toHaveText('공급된 기사 0')
  await expect(page.locator('.nfz-meta')).toContainText('공급 저자 0')
  await expect(page.locator('.nfz-meta time')).toHaveAttribute('datetime', '2026-08-01T12:34:56.000Z')
  await expect(page.locator('.nfz-body strong')).toHaveText('강조 문장')
  await expect(page.locator('.nfz-body h2')).toHaveCount(3)
  await expect(page.locator('.nfz-body blockquote')).toHaveText('공급된 인용')
  await page.locator('.nfz-tags button').click()
  await expect(page.getByRole('heading', { name: '태그: 비트코인' })).toBeVisible()
  await expect(page.locator('.nfz-t1 .nfz-card')).toHaveCount(2)
  await page.locator('.nfz-t1 .nfz-card').first().click()
  await page.locator('.nfz-nextg a').first().click()
  await expect(page.locator('.nfz-a h1')).toHaveText('공급된 기사 1')
  await page.locator('.nfz-back').first().click()
  await expect(page.getByRole('heading', { name: '태그: 비트코인' })).toBeVisible()
  await page.getByRole('button', { name: '전체 보기', exact: true }).click()
  await expect(page.locator('.nfz-top3')).toBeVisible()
  await page.screenshot({ path: info.outputPath('supplied-native-gallery.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('질문 실패는 초안을 유지하고 재시도 성공에서만 질문창을 닫는다', async ({ page }) => {
  await mount(page)
  await page.locator('.nfz-bigc').click()
  await page.evaluate(() => { Reflect.get(window, 'nativeInsightState').failAsk = true })
  await page.locator('.nfz-ast').click()
  await page.getByRole('textbox', { name: '추가로 궁금한 점' }).fill('원래 대화에 준비해주세요')
  await page.getByRole('button', { name: 'TETH에게 물어보기', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('테스트 질문 연결 실패')
  await expect(page.getByRole('textbox', { name: '추가로 궁금한 점' })).toHaveValue('원래 대화에 준비해주세요')
  await page.evaluate(() => { Reflect.get(window, 'nativeInsightState').failAsk = false })
  await page.getByRole('button', { name: 'TETH에게 물어보기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const asks = await page.evaluate(() => Reflect.get(window, 'nativeInsightState').asks as string[])
  expect(asks).toHaveLength(2)
  expect(asks[0]).toEqual(asks[1])
  expect(asks[0]).toContain('공급된 기사 0')
  expect(asks[0]).toContain('원래 대화에 준비해주세요')
  await expect(page.locator('.nfz-a h1')).toHaveText('공급된 기사 0')
})

test('서비스 공유는 공급 canonical URL을 사용하며 실제 확인 이후만 평가를 잠근다', async ({ page }) => {
  await mount(page)
  await page.locator('.nfz-bigc').click()
  await page.getByRole('button', { name: '공유', exact: true }).click()
  await expect(page.locator('.nfz-shpop a').first()).toHaveAttribute('href', 'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fnews.example.test%2Farticles%2Fsupplied-0')
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { Reflect.set(window, 'copiedArticle', text) } } }))
  await page.locator('.nfz-shpop').getByRole('button', { name: '링크 복사' }).click()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'copiedArticle'))).toBe(data.articles[0].shareUrl)
  await page.evaluate(() => { Reflect.get(window, 'nativeInsightState').failFeedback = true })
  await page.getByRole('button', { name: '조금 도움', exact: true }).click()
  await expect(page.locator('.insight-notice')).toContainText('의견을 보내지 못했어요')
  await expect(page.locator('.nfz-fb .bs')).not.toHaveClass(/locked/)
  await page.evaluate(() => { Reflect.get(window, 'nativeInsightState').failFeedback = false })
  await page.getByRole('button', { name: '조금 도움', exact: true }).click()
  await expect(page.locator('.nfz-fb .bs')).toHaveClass(/locked/)
})

test('미공급과 실제 빈 목록을 구별하고 owner/feed 교체는 이전 기사를 제거한다', async ({ page }) => {
  await mount(page, { supplied: null })
  await expect(page.locator('.client-insights')).toHaveAttribute('data-source', 'UNAVAILABLE')
  await expect(page.locator('.nfz-card, .nfz-a, time, img.av2')).toHaveCount(0)
  await page.evaluate(data => Reflect.get(window, 'nativeInsightData')({ ...data, articles: [] }), data)
  await expect(page.locator('.client-insights')).toHaveAttribute('data-source', 'SUPPLIED')
  await expect(page.getByRole('heading', { name: '아직 게시된 인사이트가 없어요' })).toBeVisible()
  await page.evaluate(data => Reflect.get(window, 'nativeInsightData')(data), data)
  await page.locator('.nfz-bigc').click()
  await page.locator('.nfz-ast').click()
  await page.evaluate(() => Reflect.get(window, 'nativeInsightData')(null))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.nfz-a')).toHaveCount(0)
  await expect(page.locator('.client-insights')).not.toContainText('공급된 기사 0')
})

test('누락 메타데이터·이미지·공유주소를 예시나 현재시각으로 채우지 않는다', async ({ page }) => {
  const supplied: InsightPresentationData = { ...data, articles: [{ ...data.articles[0], authorName: null, publishedAt: 'invalid-date', shareUrl: 'javascript:alert(1)', art: { heroUrl: 'data:image/svg+xml,<svg/>', wideUrl: 'https://user:password@example.test/image' }, authorAvatarUrl: 'javascript:alert(1)' }], figureUrls: { missing: 'javascript:alert(1)' }, curators: undefined, periodLabel: undefined }
  const errors = await mount(page, { supplied })
  await page.locator('.nfz-bigc').click()
  await expect(page.locator('.nfz-meta time, img')).toHaveCount(0)
  await expect(page.locator('.nfz-meta')).toContainText('—, —')
  await page.getByRole('button', { name: '공유', exact: true }).click()
  await expect(page.locator('.nfz-shpop a')).toHaveCount(0)
  await expect(page.locator('.nfz-shpop button')).toHaveCount(4)
  for (const button of await page.locator('.nfz-shpop button').all()) {
    await expect(button).toBeDisabled()
    await expect(button).toHaveAttribute('title', insightPresentationCopy.ko.shareUnavailable)
  }
  expect(errors).toEqual([])
})

test('게스트 가입게이트와 외부 탐색으로 기사·태그·질문창 상태를 복구한다', async ({ page }) => {
  await mount(page, { guest: true })
  await page.locator('.nfz-bigc').click()
  await expect(page.locator('.nfz-body h2')).toHaveCount(2)
  await page.getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'nativeInsightState').login)).toEqual(['signup'])
  await page.evaluate(() => Reflect.get(window, 'nativeInsightNavigate')({ tag: '없는주제' }))
  await expect(page.getByRole('heading', { name: '이 태그의 인사이트가 아직 없어요' })).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'nativeInsightNavigate')({ slug: '없는기사' }))
  await expect(page.getByRole('heading', { name: '글을 찾을 수 없어요' })).toBeVisible()
  await page.getByRole('button', { name: '인사이트 전체 보기' }).click()
  await expect(page.locator('.nfz-card')).toHaveCount(4)
})

const personalized: InsightPersonalizedPresentation = {
  token: 'supplied-personal', state: 'available',
  article: { ...data.articles[0], slug: 'private-article', title: '공급된 맞춤 인사이트' },
  chips: ['BTC', '공급된 관심 주제'], publicationLabel: '2026.08.01 발행', expiryLabel: '2026.08.03까지 제공',
  question: '내 기존 대화에 공급된 맞춤 질문을 준비해줘', ctaLabel: '첫 거래가 고민되시나요? 지금 TETH에게 물어보세요',
  email: { senderLabel: '테스트 발행자 <edition@example.test>', sections: [{ h: '이메일 첫 문단', ps: ['공급된 이메일 요약입니다.'] }] },
}
const personalizedData: InsightPresentationData = { ...data, personalized: [personalized], currentPersonalizedToken: personalized.token }

test('FOR YOU는 원본 그리드에서 공급된 맞춤 본문·질문으로 연결되며 실패 재시도를 제공한다', async ({ page }, info) => {
  await mount(page, { supplied: personalizedData })
  await expect(page.locator('.nfz-grid3 > .nfz-fycard')).toBeVisible()
  await expect(page.locator('.nfz-fycard svg.av2 path')).toHaveAttribute('d', 'M8 19.5l4-6 3 4 3.4-8 5.6 9.5')
  await expect(page.locator('.nfz-fycard .cat')).toHaveCount(0)
  await expect(page.locator('.nfz-fycard')).toContainText('2026.08.01 발행')
  await page.locator('.nfz-fycard').click()
  await expect(page.locator('.nfz-a h1')).toHaveText('공급된 맞춤 인사이트')
  await expect(page.locator('.nfz-meta')).toContainText('2026.08.03까지 제공')
  await expect(page.locator('.nfz-body h2')).toHaveCount(3)
  await page.evaluate(() => { Reflect.get(window, 'nativeInsightState').failAsk = true })
  await page.locator('.nfz-pcta').click()
  await expect(page.locator('.insight-notice')).toContainText('테스트 질문 연결 실패')
  await page.evaluate(() => { Reflect.get(window, 'nativeInsightState').failAsk = false })
  await page.locator('.nfz-pcta').click()
  expect(await page.evaluate(() => Reflect.get(window, 'nativeInsightState').asks)).toEqual([personalized.question, personalized.question])
  await page.screenshot({ path: info.outputPath('supplied-personal-insight.png'), fullPage: true })
})

test('만료·갱신은 공급 상태만 따르며 최신 입력으로 복귀하고 브라우저 시계로 상태를 만들지 않는다', async ({ page }) => {
  await mount(page, { supplied: personalizedData })
  await page.locator('.nfz-fycard').click()
  await page.clock.install({ time: new Date('2040-01-01T00:00:00Z') })
  await expect(page.locator('.nfz-a h1')).toHaveText('공급된 맞춤 인사이트')
  const expired: InsightPresentationData = { ...personalizedData, personalized: [{ ...personalized, state: 'expired', availabilityMessage: '공급자가 이 문서를 만료 처리했습니다.', latestToken: 'replacement' }, { ...personalized, token: 'replacement', article: { ...personalized.article, title: '새로 공급된 맞춤 인사이트' } }] }
  await page.evaluate(data => Reflect.get(window, 'nativeInsightData')(data), expired)
  await expect(page.getByRole('heading', { name: '이 인사이트는 만료됐어요' })).toBeVisible()
  await expect(page.locator('.nfz-body')).toHaveCount(0)
  await page.getByRole('button', { name: '최신 인사이트 보기' }).click()
  await expect(page.locator('.nfz-a h1')).toHaveText('새로 공급된 맞춤 인사이트')
  const superseded = { ...expired, personalized: expired.personalized!.map(item => ({ ...item, state: 'superseded' as const, latestToken: undefined })) }
  await page.evaluate(data => Reflect.get(window, 'nativeInsightData')(data), superseded)
  await expect(page.getByRole('heading', { name: '이 인사이트는 새 버전으로 갱신됐어요' })).toBeVisible()
  await page.getByRole('button', { name: '인사이트 홈으로' }).click()
  await expect(page.locator('.nfz-fycard')).toHaveCount(0)
})

test('이메일 미리보기는 공급 발신자·요약만 보여주고 원본 계속 읽기에서 맞춤 기사로 이어진다', async ({ page }, info) => {
  await mount(page, { supplied: personalizedData })
  await page.evaluate(() => Reflect.get(window, 'nativeInsightNavigate')({ slug: 'email' }))
  await expect(page.locator('.nfz-mail')).toBeVisible()
  await expect(page.locator('.nfz-mail .mh')).toContainText(personalized.email!.senderLabel)
  await expect(page.locator('.nfz-mail .nfz-body')).toContainText('공급된 이메일 요약입니다.')
  await expect(page.locator('.nfz-mail')).not.toContainText('insights@teth.ai')
  await page.screenshot({ path: info.outputPath('supplied-personal-email.png'), fullPage: true })
  await page.getByRole('button', { name: 'TETH에서 계속 읽기' }).click()
  await expect(page.locator('.nfz-a h1')).toHaveText('공급된 맞춤 인사이트')
  expect(await page.evaluate(() => Reflect.get(window, 'nativeInsightState').asks)).toEqual([])
})

test('게스트는 공급된 개인화 본문을 보지 않으며 미연결 질문은 성공처럼 닫히지 않는다', async ({ page }) => {
  await mount(page, { supplied: personalizedData, guest: true })
  await expect(page.locator('.nfz-fycard')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'nativeInsightNavigate')({ slug: 'p/supplied-personal' }))
  await expect(page.getByRole('heading', { name: '개인화 인사이트는 로그인 후 볼 수 있어요' })).toBeVisible()
  await expect(page.locator('.client-insights')).not.toContainText('공급된 맞춤 인사이트')
  await mount(page, { unavailableAsk: true })
  await page.locator('.nfz-bigc').click()
  await page.locator('.nfz-ast').click()
  await page.getByRole('textbox', { name: '추가로 궁금한 점' }).fill('유지할 문장')
  await page.getByRole('button', { name: 'TETH에게 물어보기' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('질문 연결이 아직 제공되지 않았습니다.')
  await expect(page.getByRole('textbox', { name: '추가로 궁금한 점' })).toHaveValue('유지할 문장')
})

test('서비스 경로 미공급 시 프리뷰 URL이나 외부 공유 URL로 이동하지 않고 키보드 조작은 유지한다', async ({ page }) => {
  await mount(page, { noHref: true })
  await expect(page.locator('.nfz-bigc')).not.toHaveAttribute('href')
  await expect(page.locator('.nfz-bigc')).toHaveAttribute('role', 'button')
  await page.locator('.nfz-bigc').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.nfz-a h1')).toHaveText('공급된 기사 0')
  expect(new URL(page.url()).hash).toBe('')
  await page.locator('.nfz-nc').first().focus()
  await page.keyboard.press('Space')
  await expect(page.locator('.nfz-a h1')).toHaveText('공급된 기사 1')
  expect(new URL(page.url()).hash).toBe('')
})

test('명시 프리뷰 입력도 큐레이터를 원본 예시 이름으로 덮어쓰지 않는다', async ({ page }) => {
  await mount(page, { preview: true })
  await expect(page.locator('.nfz-cur')).toContainText('공급 큐레이터')
  await expect(page.locator('.nfz-cur')).not.toContainText('Sarah Bennett')
  await expect(page.locator('.nfz-cur')).not.toContainText('James Carter')
})

test('새 서비스 미공급 안내는 7언어로 바뀌며 공급 기사·질문 입력 DOM은 유지한다', async ({ page }) => {
  await mount(page, { supplied: { ...data, articles: [] }, unavailableAsk: true })
  for (const [language, copy] of Object.entries(insightPresentationCopy)) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', language) }, language)
    await expect(page.getByRole('heading', { name: copy.emptyArticles })).toBeVisible()
    await expect(page.locator('.nfz-open h1')).toHaveText(data.heading + data.subheading)
  }
  await page.evaluate(data => Reflect.get(window, 'nativeInsightData')(data), data)
  await page.locator('.nfz-bigc').click()
  await page.locator('.nfz-ast').click()
  await page.getByRole('textbox', { name: '추가로 궁금한 점' }).fill('공급 내용은 번역하지 않아요')
  await page.evaluate(() => Reflect.set(window, 'retainedInsightInput', document.querySelector('.nfz-dialog textarea')))
  for (const [language, copy] of Object.entries(insightPresentationCopy)) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', language) }, language)
    await page.getByRole('button', { name: 'TETH에게 물어보기' }).click()
    await expect(page.getByRole('alert')).toHaveText(copy.questionUnavailable)
    await expect(page.getByRole('textbox', { name: '추가로 궁금한 점' })).toHaveValue('공급 내용은 번역하지 않아요')
    expect(await page.evaluate(() => Reflect.get(window, 'retainedInsightInput') === document.querySelector('.nfz-dialog textarea'))).toBe(true)
  }
})
