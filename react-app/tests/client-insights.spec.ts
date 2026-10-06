import { expect, test, type Page } from '@playwright/test'
import { CLIENT_INSIGHTS, CLIENT_INSIGHT_SOURCE } from '../src/client-insight-fixtures'
import { insightSourceCopy, insightTagLabel } from '../src/client-insight-source-copy'
import previewLocaleCopy from '../src/client-insights-preview-locale-copy.json' with { type: 'json' }

async function mount(page: Page, props: { signedIn?: boolean; initialSlug?: string; initialTag?: string; failAsk?: boolean; failFeedback?: boolean; feedbackReady?: boolean; controlled?: boolean } = {}) {
  await page.route('**/insight-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#0f1012"></body></html>' }))
  await page.goto('/insight-test.html')
  await page.evaluate(async options => {
    const refresh = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const fontPaths = ['/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/node_modules/@fontsource-variable/geist/index.css']
    await Promise.all(fontPaths.map(path => import(/* @vite-ignore */ path)))
    const rp = '/@id/react', dp = '/@id/react-dom/client', cp = '/src/components/ClientInsights.tsx'
    const react = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp)
    const { ClientInsights } = await import(/* @vite-ignore */ cp)
    const host = document.createElement('div'); document.body.append(host)
    document.execCommand = () => false
    const asks: string[] = [], feedback: [string, number][] = [], login: string[] = []
    Object.assign(window, { insightAsks: asks, insightFeedback: feedback, insightLogin: login })
    const root = (dom.createRoot ?? dom.default.createRoot)(host)
    let controlledLocation = { slug: options.initialSlug, tag: options.initialTag }
    const render = () => root.render((react.createElement ?? react.default.createElement)(ClientInsights, {
      ...options,
      controlledLocation: options.controlled ? controlledLocation : undefined,
      onNavigate: options.controlled ? (next: typeof controlledLocation) => { controlledLocation = next; render() } : undefined,
      onAsk: async (text: string) => { asks.push(text); if (options.failAsk) throw new Error('EXPECTED_OFFLINE') },
      onLogin: (mode: string) => login.push(mode),
      onFeedback: options.feedbackReady ? async (slug: string, value: number) => { feedback.push([slug, value]); if (options.failFeedback) throw new Error('EXPECTED_OFFLINE') } : undefined,
    }))
    Object.assign(window, { insightNavigate: (next: typeof controlledLocation) => { controlledLocation = next; render() } })
    render()
  }, props)
  await expect(page.locator('.client-insights')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

for (const width of [320, 768, 1440]) test(`9fb 인사이트 제목·윤곽·태그·상세 스타일 ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 960 })
  await mount(page, { signedIn: true, feedbackReady: true })
  await expect(page.locator('.client-insights')).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await expect(page.locator('.nfz-open h1')).toHaveCSS('font-size', width <= 760 ? '28px' : '32px')
  await expect(page.locator('.nfz-open h1')).toHaveCSS('font-weight', '400')
  await expect(page.locator('.nfz-open em')).toHaveCSS('font-size', width <= 760 ? '16px' : '18px')
  await expect(page.locator('.nfz-sh h2').first()).toHaveCSS('font-size', '18px')
  await expect(page.locator('.nfz-cur')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(page.locator('.nfz-cur .tx')).toHaveText('오늘의 인사이트는 Sarah Bennett과 James Carter가 큐레이션했습니다.')
  await expect(page.locator('.nfz-bigc .nfz-art')).toHaveCSS('border-radius', '16px')
  await expect(page.locator('.nfz-bigc h4')).toHaveCSS('font-size', width <= 760 ? '22px' : '28px')
  await expect(page.locator('.nfz-topics .th5')).toHaveText('주제별로 보기')
  await expect(page.locator('.nfz-rail .rh')).toHaveText('많이 읽는 글')
  await page.screenshot({ path: info.outputPath(`insight-list-${width}.png`), fullPage: true })
  await page.locator('.nfz-bigc').click()
  await expect(page.locator('.nfz-a h1')).toHaveCSS('font-size', width <= 760 ? '26px' : '32px')
  await expect(page.locator('.nfz-body h2').first()).toHaveCSS('font-size', '24px')
  await page.getByRole('button', { name: '도움 됨', exact: true }).click()
  await expect(page.locator('.nfz-fbb.on')).toHaveCSS('background-color', 'rgb(48, 48, 48)')
  await expect(page.locator('.nfz-fbb.on')).toHaveCSS('border-top-color', 'rgb(255, 255, 255)')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath(`insight-detail-${width}.png`), fullPage: true })
})

test('7언어 변경에도 태그 필터·기사·평가를 보존하고 확대에서 넘치지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 920 })
  await mount(page, { signedIn: true, feedbackReady: true, controlled: true, initialTag: 'bitcoin' })
  const count = await page.locator('.nfz-t1 .nfz-card').count()
  // Static UI now follows the selected language; article identity/feedback and
  // supplied article content are still preserved by the assertions below.
  const prefixes = { ko: '태그: ', en: 'Tag: ', ja: 'タグ: ', 'zh-CN': '标签: ', 'zh-TW': '標籤: ', es: 'Etiqueta: ', fr: 'Étiquette : ' }
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', language) }, language)
    await expect(page.locator('.nfz-sh h2').first()).toHaveText(`${prefixes[language]}${insightTagLabel(language, 'bitcoin')}`)
    await expect(page.locator('.nfz-t1 .nfz-card')).toHaveCount(count)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  const selectedSlug = await page.locator('.nfz-t1 .nfz-card').first().getAttribute('data-article')
  const selectedOriginal = CLIENT_INSIGHTS.find(article => article.slug === selectedSlug)!
  await page.locator('.nfz-t1 .nfz-card').first().click()
  await page.getByRole('button', { name: insightSourceCopy('fr', 'positive'), exact: true }).click()
  // Double actual text, including pixel-sized source typography.
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>('.client-insights *')]
    const sizes = nodes.map(el => getComputedStyle(el).fontSize)
    nodes.forEach((el, i) => { el.style.fontSize = `${parseFloat(sizes[i]) * 2}px` })
  })
  for (const language of ['en', 'ko', 'fr'] as const) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', language) }, language)
    // New localization policy translates owned preview copy while preserving
    // the selected article identity and confirmed feedback across languages.
    await expect(page.locator('.nfz-a h1')).toHaveText(language === 'ko' ? selectedOriginal.title : previewLocaleCopy[selectedOriginal.title as keyof typeof previewLocaleCopy][language])
    await expect(page.locator('.nfz-fbb.on')).toHaveText(insightSourceCopy(language, 'positive'))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await page.locator('.nfz-fbb').evaluateAll(nodes => nodes.every(el => el.scrollWidth <= el.clientWidth + 2))).toBe(true)
  }
  expect(await page.evaluate(() => Reflect.get(window, 'insightFeedback').length)).toBe(1)
  await page.locator('.nfz-fb').screenshot({ path: info.outputPath('insight-feedback-fr-200.png') })
})

test('확인된 평가만 원본 잠금 표시를 적용하고 선택 항목의 가독성을 유지한다', async ({ page }, info) => {
  await mount(page, { signedIn: true, initialSlug: 'bitcoin-miner-cashflow', feedbackReady: true })
  const group = page.locator('.nfz-fb .bs')
  await expect(group).not.toHaveClass(/locked/)
  await page.getByRole('button', { name: '도움 됨', exact: true }).click()
  const selected = group.getByRole('button', { name: '도움 됨', exact: true })
  await expect(selected).toHaveAttribute('aria-pressed', 'true')
  await expect(selected).toBeDisabled()
  await expect(selected).toHaveCSS('opacity', '1')
  await expect(group).toHaveClass(/locked/)
  for (const label of ['도움 안 됨', '조금 도움']) {
    await expect(group.getByRole('button', { name: label, exact: true })).toBeDisabled()
    await expect(group.getByRole('button', { name: label, exact: true })).toHaveCSS('opacity', '0.32')
  }
  expect(await page.evaluate(() => Reflect.get(window, 'insightFeedback'))).toEqual([['bitcoin-miner-cashflow', 2]])
  await page.locator('.nfz-fb').screenshot({ path: info.outputPath('confirmed-feedback.png') })
})

test('실패한 평가는 선택 잠금을 남기지 않고 재시도할 수 있다', async ({ page }) => {
  await mount(page, { signedIn: true, initialSlug: 'bitcoin-miner-cashflow', feedbackReady: true, failFeedback: true })
  const group = page.locator('.nfz-fb .bs')
  await group.getByRole('button', { name: '조금 도움', exact: true }).click()
  await expect(page.locator('.insight-notice')).toContainText('의견을 보내지 못했어요')
  await expect(group).not.toHaveClass(/locked/)
  await expect(group.locator('button[aria-pressed="true"]')).toHaveCount(0)
  await expect(group.getByRole('button', { name: '조금 도움', exact: true })).toBeEnabled()
})

test('평가 완료 안내는 원본 페이드로 등장하고 모션 최소화 설정을 따른다', async ({ page }) => {
  await mount(page, { signedIn: true, initialSlug: 'bitcoin-miner-cashflow', feedbackReady: true })
  await page.addStyleTag({ content: '.client-insights .nfz-fb .fbok { animation-play-state: paused !important; }' })
  await page.getByRole('button', { name: '조금 도움', exact: true }).click()
  const thanks = page.locator('.nfz-fb .fbok')
  await expect(thanks).toBeAttached()
  const animations = await thanks.evaluate(el => el.getAnimations().map(animation => ({
    duration: animation.effect?.getTiming().duration,
    opacity: (animation.effect as KeyframeEffect | null)?.getKeyframes().map(frame => frame.opacity),
  })))
  expect(animations).toEqual([{ duration: 250, opacity: ['0', '1'] }])
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(thanks).toHaveCSS('animation-name', 'none')
  await expect(thanks).toHaveCSS('opacity', '1')
  await expect(thanks).toBeVisible()
})

test('15편 원문 갤러리·3존·큐레이터·고정시각을 보존한다', async ({ page }) => {
  await mount(page)
  await expect(page.locator('.nfz-top3 .c1 .nfz-card')).toHaveCount(2)
  await expect(page.locator('.nfz-top3 .c2 .nfz-card')).toHaveCount(1)
  await expect(page.locator('.nfz-grid3 .nfz-card')).toHaveCount(12)
  await expect(page.locator('.nfz-card')).toHaveCount(CLIENT_INSIGHTS.length)
  await expect(page.locator('.nfz-cur')).toContainText('Sarah Bennett과 James Carter가 큐레이션했습니다.')
  await expect(page.locator('.nfz-open h1')).toHaveText('9월 13일, 시장은 이렇게 움직입니다내 전략에 무엇이 달라지는지 함께 봅니다')
  await expect(page.locator('.client-insights')).toHaveAttribute('data-source', CLIENT_INSIGHT_SOURCE.kind)
  const before = await page.locator('time').first().getAttribute('datetime')
  await page.clock.install({ time: new Date('2035-01-01T12:00:00Z') })
  await expect(page.locator('time').first()).toHaveAttribute('datetime', before!)
  await expect(page.locator('.nfz-card img')).toHaveCount(30)
  await expect.poll(() => page.locator('.nfz-bigc .nfz-art img').evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  const artSource = decodeURIComponent((await page.locator('.nfz-bigc .nfz-art img').getAttribute('src'))!)
  expect(artSource).not.toContain('&#8383;')
  expect(artSource).toContain('M11.767 19.089')
  await expect.poll(() => page.locator('img.av2').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
})

test('태그 필터·전체 복귀·빈 태그와 외부 hash를 침범하지 않는다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => { location.hash = '#/research/retained' })
  await page.getByRole('button', { name: '비트코인', exact: true }).click()
  const expected = CLIENT_INSIGHTS.filter(p => p.tags.includes('bitcoin'))
  await expect(page.getByRole('heading', { name: '태그: 비트코인' })).toBeVisible()
  await expect(page.locator('.nfz-t1 .nfz-card')).toHaveCount(expected.length)
  await expect(page).toHaveURL(/#\/research\/retained$/)
  await page.getByRole('button', { name: '전체 보기', exact: true }).click()
  await expect(page.locator('.nfz-top3')).toBeVisible()
  await mount(page, { initialTag: '없는-주제' })
  await expect(page.getByRole('heading', { name: '이 태그의 인사이트가 아직 없습니다' })).toBeVisible()
  await expect(page.locator('.insight-empty p')).toHaveText('다른 태그를 눌러보거나 전체 목록으로 돌아가십시오.')
})

test('게스트 본문은 배열 2개가 아니라 텍스트 2섹션 기준으로 끊고 로그인 맥락을 유지한다', async ({ page }) => {
  await mount(page, { initialSlug: 'btc-liquidity-rotation' })
  const article = CLIENT_INSIGHTS.find(p => p.slug === 'btc-liquidity-rotation')!
  await expect(page.locator('.nfz-body h2')).toHaveCount(2)
  for (const part of article.body.filter(part => part.h).slice(0, 2)) {
    await expect(page.locator('.nfz-body')).toContainText(part.h!)
    for (const p of part.ps!) await expect(page.locator('.nfz-body')).toContainText(p.replaceAll('**', ''))
  }
  await page.getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  await expect(page.locator('.nfz-a h1')).toHaveText(article.title)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'insightLogin'))).toEqual(['signup'])
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'insightLogin'))).toEqual(['signup', 'login'])
  await expect(page.locator('.nfz-fb')).toHaveCount(0)
})

test('회원에게 15편 전체 원문·인용·개념도와 원본 자산을 보여준다', async ({ page }) => {
  await mount(page, { signedIn: true })
  for (const article of CLIENT_INSIGHTS) {
    await page.locator(`.nfz-card[data-article="${article.slug}"]`).click()
    await expect(page.locator('.nfz-a h1')).toHaveText(article.title)
    await expect(page.locator('.nfz-gate')).toHaveCount(0)
    await expect(page.locator('.nfz-body h2')).toHaveCount(article.body.filter(s => s.h).length)
    for (const section of article.body) {
      if (section.ps) for (const p of section.ps) await expect(page.locator('.nfz-body')).toContainText(p.replaceAll('**', ''))
      if (section.q) await expect(page.locator('.nfz-q')).toContainText(section.q)
      if (section.fig) await expect(page.locator('figcaption')).toContainText(section.fig.cap)
    }
    await expect(page.locator('.nfz-ast')).toHaveCount(article.assets.length)
    await expect.poll(() => page.locator('.nfz-ast img').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
    await expect(page.locator(`.nfz-nextg [data-article="${article.slug}"]`)).toHaveCount(0)
    await expect(page.locator(`.nfz-rail [data-article="${article.slug}"]`)).toHaveCount(0)
    await page.getByRole('button', { name: '인사이트', exact: true }).click()
    await expect(page.locator(`.nfz-card[data-article="${article.slug}"]`)).toBeFocused()
  }
})

test('자산 확인 시트를 거쳐 기사와 추가 질문을 같은 대화 콜백에 전달한다', async ({ page }) => {
  await mount(page, { signedIn: true, initialSlug: 'bitcoin-miner-cashflow' })
  await page.locator('.nfz-ast').click()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'insightAsks'))).toEqual([])
  const dialog = page.getByRole('dialog', { name: '비트코인 더 알아보기' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('textbox')).toBeFocused()
  await dialog.getByRole('textbox').fill('최근 지지선도 함께 봐줘')
  await dialog.getByRole('button', { name: 'TETH에게 물어보기' }).click()
  await expect(dialog).toHaveCount(0)
  const asks = await page.evaluate(() => Reflect.get(window, 'insightAsks'))
  expect(asks).toHaveLength(1)
  expect(asks[0]).toContain('비트코인(BTC)의 현재 시장 상태를 분석해줘.')
  expect(asks[0]).toContain(CLIENT_INSIGHTS[0].title)
  expect(asks[0]).toContain('추가로 궁금한 점: 최근 지지선도 함께 봐줘')
})

test('질문 실패는 입력 유지·재시도, 취소는 기사와 초점 복귀', async ({ page }) => {
  await mount(page, { signedIn: true, initialSlug: 'bitcoin-miner-cashflow', failAsk: true })
  const trigger = page.locator('.nfz-ast')
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill('보존할 질문')
  await dialog.getByRole('button', { name: 'TETH에게 물어보기' }).click()
  await expect(dialog.getByRole('alert')).toContainText('작성한 내용은 유지됩니다')
  await expect(dialog.getByRole('textbox')).toHaveValue('보존할 질문')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('자산 시트 배경 닫기와 하단 공유 아이콘 순서를 원본대로 보존한다', async ({ page }) => {
  await mount(page, { signedIn: true, initialSlug: 'bitcoin-miner-cashflow' })
  await expect(page.locator('.nfz-social a, .nfz-social button')).toHaveCount(4)
  await expect(page.locator('.nfz-social a, .nfz-social button').last()).toHaveAccessibleName('링크 복사')
  await page.locator('.nfz-ast').click()
  const bounds = await page.getByRole('dialog').boundingBox()
  await page.mouse.click(8, Math.max(4, bounds!.y - 8))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.nfz-ast')).toBeFocused()
})

test('피드백 미연결과 실제 callback 실패를 성공으로 위장하지 않는다', async ({ page }) => {
  await mount(page, { signedIn: true, initialSlug: 'bitcoin-miner-cashflow' })
  await page.getByRole('button', { name: '도움 됨', exact: true }).click()
  await expect(page.locator('.insight-notice')).toContainText('아직 전송되지 않았습니다')
  await expect(page.locator('.nfz-fb .fbok')).toHaveCount(0)
  await mount(page, { signedIn: true, initialSlug: 'bitcoin-miner-cashflow', feedbackReady: true, failFeedback: true })
  await page.getByRole('button', { name: '도움 됨', exact: true }).click()
  await expect(page.locator('.insight-notice')).toContainText('의견을 보내지 못했어요')
  await expect(page.locator('.nfz-fb .fbok')).toHaveCount(0)
})

test('피드백 서버 확인 뒤 1회 잠금과 중복 제출 차단', async ({ page }) => {
  await mount(page, { signedIn: true, initialSlug: 'bitcoin-miner-cashflow', feedbackReady: true })
  await page.getByRole('button', { name: '도움 됨', exact: true }).click()
  await expect(page.locator('.nfz-fb .fbok')).toContainText('소중한 의견 감사합니다')
  await expect(page.locator('.nfz-fbb:disabled')).toHaveCount(3)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'insightFeedback'))).toEqual([['bitcoin-miner-cashflow', 2]])
})

test('공유 팝오버·복사 실패·Esc 복귀와 새 기사 상태 격리', async ({ page }) => {
  await mount(page, { signedIn: true, initialSlug: 'bitcoin-miner-cashflow' })
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('DENIED') } } }))
  const trigger = page.getByRole('button', { name: '공유', exact: true })
  await trigger.click()
  await expect(page.locator('.nfz-shpop a')).toHaveCount(3)
  await page.locator('.nfz-shpop').getByRole('button', { name: '링크 복사' }).click()
  await expect(page.locator('.nfz-social .cplbl')).toHaveText('복사에 실패했습니다')
  await expect(page.locator('.nfz-shpop').getByRole('button', { name: '링크 복사' })).toHaveText('링크 복사')
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await page.locator('.nfz-nextg a').first().click()
  await expect(page.locator('.nfz-social .cplbl')).toBeEmpty()
})

test('없는 기사 안전 복구', async ({ page }) => {
  await mount(page, { initialSlug: 'missing' })
  await expect(page.getByRole('heading', { name: '글을 찾을 수 없습니다' })).toBeVisible()
  await page.getByRole('button', { name: '인사이트 전체 보기' }).click()
  await expect(page.locator('.nfz-top3')).toBeVisible()
})

test('부모 라우팅·외부 뒤로 가기는 동기화하고 동일 위치 재전달은 입력을 보존한다', async ({ page }) => {
  await mount(page, { signedIn: true, initialSlug: 'bitcoin-miner-cashflow', controlled: true })
  await page.locator('.nfz-ast').click()
  await page.getByRole('dialog').getByRole('textbox').fill('작성 중인 질문')
  await page.evaluate(() => Reflect.get(window, 'insightNavigate')({ slug: 'bitcoin-miner-cashflow' }))
  await expect(page.getByRole('dialog').getByRole('textbox')).toHaveValue('작성 중인 질문')
  await page.evaluate(() => Reflect.get(window, 'insightNavigate')({ tag: 'bitcoin' }))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '태그: 비트코인' })).toBeVisible()
  await page.locator('.nfz-card').first().click()
  await expect(page.locator('.nfz-a h1')).toBeVisible()
  await page.getByRole('button', { name: '인사이트', exact: true }).click()
  await expect(page.getByRole('heading', { name: '태그: 비트코인' })).toBeVisible()
})

test('320·390·768·1024·1440 반응형 넘침과 핵심 계층 검수', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page, { signedIn: true })
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    if (width <= 1120) {
      const hero = await page.locator('.c2').boundingBox(), small = await page.locator('.c1').boundingBox()
      expect(hero!.y).toBeLessThan(small!.y)
    }
    if (width === 1440) await page.screenshot({ path: test.info().outputPath('insight-home-desktop.png'), fullPage: true })
  }
  await page.locator('.nfz-bigc').click()
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    if (width === 390) await page.screenshot({ path: test.info().outputPath('insight-article-mobile.png'), fullPage: true })
  }
  expect(errors).toEqual([])
})

test('원본 T2 모바일 가로 목록은 스크롤바 없이 다음 카드와 키보드 접근을 유지한다', async ({ page }, info) => {
  await mount(page, { signedIn: true, initialSlug: 'bitcoin-miner-cashflow' })
  await expect(page.locator('.nfz-au .nm3').first()).toContainText(', ')
  for (const width of [320, 390, 760]) {
    await page.setViewportSize({ width, height: 900 })
    for (const selector of ['.nfz-nextg', '.nfz-astrow']) {
      const rail = page.locator(selector)
      await expect(rail).toHaveCSS('scrollbar-width', 'none')
      await expect(rail).toHaveCSS('overflow-x', 'auto')
    }
    const rail = page.locator('.nfz-nextg')
    await rail.evaluate(el => { el.scrollLeft = 0 })
    const box = await rail.boundingBox(), first = await rail.locator('.nfz-nc').first().boundingBox(), second = await rail.locator('.nfz-nc').nth(1).boundingBox()
    expect(first!.width).toBe(220)
    expect(second!.x).toBeLessThan(box!.x + box!.width)
    expect(await rail.evaluate(el => el.scrollWidth)).toBeGreaterThan(box!.width)
    await rail.locator('.nfz-nc').first().focus()
    for (let i = 0; i < 3; i++) await page.keyboard.press('Tab')
    await expect(rail.locator('.nfz-nc').last()).toBeFocused()
    // Chromium may keep a partly visible focus target in place at 760px.
    // Verify the rail's actual scroll range separately from focus acquisition.
    await rail.evaluate(el => { el.scrollLeft = el.scrollWidth })
    await expect.poll(() => rail.evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
    await rail.screenshot({ path: info.outputPath(`source-mobile-rail-${width}.png`) })
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  }
})

test('844×390 가로형 모바일에서 햄버거와 뒤로 가기가 겹치지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/#/insight/bitcoin-miner-cashflow')
  await expect(page.locator('.nfz-back')).toBeVisible()
  const menu = await page.locator('.client-hamburger').boundingBox()
  const back = await page.locator('.nfz-back').boundingBox()
  expect(menu).not.toBeNull()
  expect(back!.y).toBeGreaterThanOrEqual(menu!.y + menu!.height)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})

test('브라우저 목록 복귀는 원래 카드 초점과 스크롤 위치를 복원한다', async ({ page }) => {
  await mount(page, { signedIn: true, controlled: true })
  const original = page.locator('.nfz-grid3 .nfz-card').last()
  await original.scrollIntoViewIfNeeded()
  const scroll = await page.evaluate(() => scrollY)
  await original.click()
  await expect(page.locator('.nfz-a h1')).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'insightNavigate')({}))
  await expect(original).toBeFocused()
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(scroll, 0)
})

test('추천 기사에서 브라우저 뒤로 가기는 nfz-nc 초점과 읽던 위치를 복원한다', async ({ page }) => {
  await mount(page, { signedIn: true, controlled: true, initialSlug: 'bitcoin-miner-cashflow' })
  const original = page.locator('.nfz-nextg .nfz-nc').first()
  await original.scrollIntoViewIfNeeded()
  const scroll = await page.evaluate(() => scrollY)
  await original.click()
  await expect(page.locator('.nfz-a h1')).not.toHaveText(CLIENT_INSIGHTS[0].title)
  await page.evaluate(() => Reflect.get(window, 'insightNavigate')({ slug: 'bitcoin-miner-cashflow' }))
  await expect(original).toBeFocused()
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(scroll, 0)
})

test('공유 자동 닫기는 팝오버 안 초점만 복원하고 외부 초점은 빼앗지 않는다', async ({ page }) => {
  await mount(page, { signedIn: true, initialSlug: 'bitcoin-miner-cashflow' })
  await page.clock.install()
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } }))
  const trigger = page.getByRole('button', { name: '공유', exact: true })
  await trigger.click()
  await page.locator('.nfz-shpop').getByRole('button', { name: '링크 복사' }).click()
  await expect(page.locator('.nfz-shpop')).toContainText('복사했습니다!')
  await page.clock.runFor(1700)
  await expect(page.locator('.nfz-shpop')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.locator('.nfz-shpop').getByRole('button', { name: '링크 복사' }).click()
  await expect(page.locator('.nfz-shpop')).toContainText('복사했습니다!')
  await page.locator('.nfz-ast').focus()
  await page.clock.runFor(1700)
  await expect(page.locator('.nfz-ast')).toBeFocused()
})
