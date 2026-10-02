import { expect, test, type Locator, type Page } from '@playwright/test'
import reference from '../src/client-reference-copy.json' with { type: 'json' }

// Source 621cbed: home 612, auth 1418–1425/1548–1550, modal 20px veil.
// These are local preview presentation checks, not authentication/provider evidence.
type Language = keyof typeof reference.I18N['nav.login']
const languages = reference.GLC_LANGS.map(item => item.c as Language)
const widths = [320, 390, 1440] as const

async function boot(page: Page, baseURL: string | undefined, width: number, language: Language = 'ko', signedIn = false) {
  if (!baseURL) throw new Error('이 시험에는 로컬 baseURL이 필요합니다.')
  const origin = new URL(baseURL).origin
  const blocked: string[] = []
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
      blocked.push(`${request.method()} ${url.origin}${url.pathname}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ language, signedIn }) => {
    localStorage.setItem('tethLang', language)
    localStorage.setItem('tethCurrency', 'USD')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    if (signedIn) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '표시 검수', email: 'fidelity@example.test' }))
  }, { language, signedIn })
  await page.goto('/')
  await expect(page.locator('.client-gallery-home')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', language)
  await page.evaluate(() => document.fonts.ready)
  return { blocked, errors }
}

async function box(locator: Locator) {
  await expect(locator).toBeVisible()
  const value = await locator.boundingBox()
  expect(value, '보이는 요소에는 실제 레이아웃 상자가 있어야 합니다.').not.toBeNull()
  return value!
}

async function modalGeometry(page: Page, width: number) {
  const modal = page.locator('.ca-auth')
  await expect(modal).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const actual = await modal.evaluate(element => {
    const css = getComputedStyle(element), rect = element.getBoundingClientRect()
    const title = getComputedStyle(element.querySelector('.au-title')!)
    const sub = element.querySelector('.au-sub')
    const free = element.querySelector('.au-free')
    return {
      width: rect.width, x: rect.x, right: rect.right,
      padding: [css.paddingTop, css.paddingRight, css.paddingBottom, css.paddingLeft],
      veilPadding: getComputedStyle(element.closest('.ca-auth-veil')!).padding,
      color: css.color, titleColor: title.color,
      titleLine: parseFloat(title.lineHeight) / parseFloat(title.fontSize),
      subColor: sub ? getComputedStyle(sub).color : null,
      freeColor: free ? getComputedStyle(free).color : null,
      scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
    }
  })
  expect(actual.width).toBeCloseTo(Math.min(480, width - 40), 1)
  expect(actual.x).toBeGreaterThanOrEqual(20)
  expect(actual.right).toBeLessThanOrEqual(width - 20)
  expect(actual.veilPadding).toBe('20px')
  expect(actual.padding).toEqual(width <= 520 ? ['36px', '22px', '28px', '22px'] : ['44px', '40px', '36px', '40px'])
  expect(actual.color).toBe('rgb(236, 236, 241)')
  expect(actual.titleColor).toBe(actual.color)
  expect(actual.titleLine).toBeCloseTo(1.6, 2)
  if (actual.subColor !== null) expect(actual.subColor).toBe(actual.color)
  if (actual.freeColor !== null) expect(actual.freeColor).toBe(actual.color)
  expect(actual.scrollWidth).toBeLessThanOrEqual(actual.clientWidth + 1)
}

for (const width of widths) {
  test(`원본 홈 ${width}px: 부모64+9vh·좌우24·부제1.6과 입력 연동 배지의 숨김 초점을 보존한다`, async ({ page, baseURL }, info) => {
    const audit = await boot(page, baseURL, width)
    const gallery = page.locator('.client-gallery-home'), input = page.locator('#strategy-idea')
    const originalInput = await input.elementHandle()
    const layout = await gallery.evaluate(element => {
      const css = getComputedStyle(element)
      const hero = getComputedStyle(element.closest('.landing-hero')!)
      const sub = getComputedStyle(element.querySelector('.client-hero-subtitle')!)
      return {
        parentTop: parseFloat(hero.paddingTop), top: parseFloat(css.paddingTop),
        left: parseFloat(css.paddingLeft), right: parseFloat(css.paddingRight),
        subtitleRatio: parseFloat(sub.lineHeight) / parseFloat(sub.fontSize), height: innerHeight,
      }
    })
    expect(layout.left).toBe(24)
    expect(layout.right).toBe(24)
    expect(layout.subtitleRatio).toBeCloseTo(1.6, 2)
    if (width <= 860) {
      expect(layout.parentTop).toBe(64)
      expect(layout.top).toBeCloseTo(layout.height * .09, 1)
    }
    const pill = await box(page.locator('.client-home-pill'))
    expect(pill.width).toBeCloseTo(width === 1440 ? 760 : width - 32, 1)

    const badge = page.locator('.client-free-row'), button = badge.locator('button')
    await expect(input).toHaveValue('')
    await expect(badge).toBeHidden()
    expect(await button.evaluate(element => { element.focus(); return document.activeElement === element })).toBe(false)
    expect(await badge.evaluate(element => getComputedStyle(element).pointerEvents)).toBe('none')
    const draft = '직접 쓴 질문은 배지 표시 변경으로 지워지지 않습니다.'
    await input.fill(draft)
    await expect(badge).toBeVisible()
    await expect(gallery).toHaveClass(/has-input/)
    await button.focus()
    await expect(button).toBeFocused()
    await expect(input).toHaveValue(draft)
    await input.fill('')
    await expect(input).toBeFocused()
    await expect(badge).toBeHidden()
    expect(await button.evaluate(element => { element.focus(); return document.activeElement === element })).toBe(false)
    await expect(input).toBeFocused()
    expect(await input.evaluate((element, original) => element === original, originalInput)).toBe(true)
    await input.fill('   ')
    await expect(badge).toBeHidden()
    await input.fill('다시 입력')
    await expect(badge).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(audit).toEqual({ blocked: [], errors: [] })
    await page.screenshot({ path: info.outputPath(`home-source-${width}.png`) })
  })
}

for (const width of widths) for (const language of languages) {
  test(`원본 인증 CTA ${language} ${width}px: 두 버튼·44px hit·전체 번역·모달 여백과 홈760폭`, async ({ page, baseURL }, info) => {
    const audit = await boot(page, baseURL, width, language)
    const login = page.locator('.client-auth-nav .client-login'), signup = page.locator('.client-auth-nav .client-signup')
    await expect(login).toHaveText(reference.I18N['nav.login'][language])
    await expect(signup).toHaveText(reference.I18N['nav.signup'][language])
    const loginBox = await box(login), signupBox = await box(signup)
    expect(loginBox.height).toBeGreaterThanOrEqual(44)
    expect(signupBox.height).toBeGreaterThanOrEqual(44)
    expect(loginBox.x + loginBox.width).toBeLessThanOrEqual(signupBox.x)
    expect(signupBox.x + signupBox.width).toBeLessThanOrEqual(width)
    for (const button of [login, signup]) {
      const paint = await box(button.locator('.client-auth-pill'))
      expect(paint.height).toBeCloseTo(width <= 860 ? 36 : 30, 1)
      expect(paint.y).toBeCloseTo(width <= 860 ? 12 : 14, 1)
      const overflow = await button.locator('.client-auth-pill').evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }))
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1)
    }
    if (width <= 860) {
      const hamburger = await box(page.locator('.client-hamburger'))
      expect(loginBox.x).toBeGreaterThanOrEqual(hamburger.x + hamburger.width + 1)
      if (width === 320 && language === 'fr') {
        const lines = await signup.locator('.client-auth-pill').evaluate(element => {
          const range = document.createRange(); range.selectNodeContents(element)
          return new Set([...range.getClientRects()].filter(rect => rect.width > 0).map(rect => Math.round(rect.top))).size
        })
        expect(lines).toBe(2)
      }
    }
    expect((await box(page.locator('.client-home-pill'))).width).toBeCloseTo(width === 1440 ? 760 : width - 32, 1)
    // No provider button is pressed: only open/close the local presentation.
    for (const entry of [login, signup]) {
      await entry.click()
      await modalGeometry(page, width)
      await page.locator('.ca-auth .au-x').click()
      await expect(page.locator('.ca-auth')).toHaveCount(0)
      await expect(entry).toBeFocused()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(audit).toEqual({ blocked: [], errors: [] })
    if (language === 'fr' || language === 'ko') await page.screenshot({ path: info.outputPath(`home-auth-${language}-${width}.png`) })
  })
}

for (const width of widths) for (const signedIn of [false, true]) {
  test(`인증 표시 수명 ${width}px ${signedIn ? '로그인 미리보기' : '게스트'}: 홈에서 대화로 이동해 모바일 헤더 정책을 보존한다`, async ({ page, baseURL }) => {
    const audit = await boot(page, baseURL, width, 'ko', signedIn)
    const nav = page.locator('.client-auth-nav')
    if (signedIn) await expect(nav).toHaveCount(0)
    else {
      await expect(nav.locator('.client-login')).toBeVisible()
      await expect(nav.locator('.client-signup')).toBeVisible()
    }
    // Seed after the previous page's pagehide flush, before the next store read.
    // Writing storage behind the live store would be overwritten on reload.
    // No assistant producer or auth is invoked.
    await page.addInitScript(() => {
      const id = 'home-auth-fidelity-chat'
      sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{
        id, title: '명시 합성 대화', renamed: true, idea: '비트코인 전략', draft: '남길 초안', pair: 'BTC/USDT', mode: 'dip', phase: 'plan',
        timeframe: '1일봉', risk: '-3%', takeProfit: '+8%', researchStatus: '초안', workspace: 'conversation',
        turns: [{ id: 'visual-turn', question: '합성 사용자 질문', answer: '공개 표시 검수입니다.', fullAnswer: '공개 표시 검수입니다.', phase: 'plan', status: 'done', suggestions: [], startedAt: 1700000000000 }],
        updatedAt: 1700000000000,
      }] }))
    })
    await page.reload()
    await expect(page.locator('.client-lab-conversation')).toBeVisible()
    await expect(page.locator('.g-umsg')).toHaveText('합성 사용자 질문')
    await expect(page.locator('.g-composer textarea')).toHaveValue('남길 초안')
    if (signedIn) await expect(nav).toHaveCount(0)
    else if (width <= 860) await expect(nav).toBeHidden()
    else await expect(nav).toBeVisible()
    expect(audit).toEqual({ blocked: [], errors: [] })
  })
}
