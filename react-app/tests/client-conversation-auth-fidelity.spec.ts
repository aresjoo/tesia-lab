import { expect, test, type Locator, type Page } from '@playwright/test'
import reference from '../src/client-reference-copy.json' with { type: 'json' }

// Source621cbed index1418/1549/4392: desktop guest keeps four auth controls;
// mobile conversation hides them. This is local preview, not provider auth.
type Language = keyof typeof reference.I18N['nav.login']
const languages = reference.GLC_LANGS.map(item => item.c as Language)
const draft = '인증 창을 열어도 남길 원문 초안 0123456789'
const title = '긴 대화 제목: 인증 메뉴와 이름 변경 및 세션 메뉴가 서로를 덮지 않아야 합니다'

async function mount(page: Page, baseURL: string | undefined, width: number, language: Language, signedIn = false, research = false, historical = false) {
  if (!baseURL) throw new Error('로컬 baseURL이 필요합니다.')
  const origin = new URL(baseURL).origin, blocked: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
      blocked.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort()
    }
    return route.continue()
  })
  await page.setViewportSize({ width, height: width <= 860 ? 844 : 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // New-document seeding runs AFTER any previous document's pagehide flush.
  await page.addInitScript(({ language, signedIn, research, historical, draft, title }) => {
    localStorage.setItem('tethLang', language); localStorage.setItem('tethCurrency', 'USD')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    if (signedIn) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '표시 검수', email: 'conversation-layout@example.test' }))
    const id = 'conversation-auth-fidelity'
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{
      id, title, renamed: true, idea: title, draft, pair: 'BTC/USDT', mode: 'dip', phase: 'plan',
      timeframe: '일봉', risk: '-3%', takeProfit: '+8%', researchStatus: '초안', workspace: research ? 'research' : 'conversation',
      turns: [{ id: 'fixture-turn', question: '표시 검수 질문', answer: '명시 공개 미리보기 답변', fullAnswer: '명시 공개 미리보기 답변', phase: 'plan', status: 'done', suggestions: [], startedAt: 1700000000000 },
        ...(historical ? [{ id: 'historical-intake', question: '기존 질문 기록', answer: '', fullAnswer: '', phase: 'plan', status: 'done', suggestions: [], startedAt: 1700000000001, finishedAt: 1700000000001, sourceIntake: { answers: [] } }] : [])],
      updatedAt: 1700000000000,
    }] }))
  }, { language, signedIn, research, historical, draft, title })
  await page.goto('/')
  await expect(page.locator(research ? '.client-restored-research[data-source="client-fixture"]' : '.client-main-existing .client-conversation-frame')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return { blocked, errors }
}

async function hit(locator: Locator) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox(); expect(box).not.toBeNull()
  expect(await locator.evaluate(element => {
    const r = element.getBoundingClientRect(), found = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return found === element || !!found && element.contains(found)
  }), '조작부 중앙이 인증 메뉴나 다른 헤더 요소에 덮이면 안 된다').toBe(true)
  return box!
}

for (const width of [861, 1100, 1440]) for (const language of languages) {
  test(`게스트 대화 ${width}px ${language}: 원본 인증4항목과 대화 헤더를 동시에 조작한다`, async ({ page, baseURL }, info) => {
    const audit = await mount(page, baseURL, width, language)
    const nav = page.locator('.client-auth-nav'), header = page.locator('.g-chead')
    await expect(nav).toBeVisible()
    const controls = nav.locator(':scope > a, :scope > button')
    await expect(controls).toHaveCount(4)
    for (const [index, key] of ['nav.about', 'nav.download', 'nav.login', 'nav.signup'].entries()) {
      await expect(controls.nth(index)).toHaveText(reference.I18N[key as 'nav.login'][language])
      const box = await hit(controls.nth(index))
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width)
    }
    await expect(nav.locator('a').nth(0)).toHaveAttribute('href', '/about/')
    await expect(nav.locator('a').nth(1)).toHaveAttribute('href', '/download/')
    const titleButton = header.locator('.g-title'), menu = header.locator('.client-session-options > button')
    expect((await hit(titleButton)).width).toBeGreaterThanOrEqual(96)
    await hit(menu); await hit(header.locator('.g-tabs button').first())
    const bounds = await header.boundingBox(); expect(bounds).not.toBeNull()
    expect(bounds!.height).toBe(44)
    const composer = page.locator('.g-composer textarea')
    await expect(composer).toHaveValue(draft)
    const originalInput = await composer.elementHandle()
    await composer.focus(); await composer.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(3, 12))
    for (const selector of ['.client-login', '.client-signup']) {
      const trigger = nav.locator(selector)
      await trigger.click(); await expect(page.locator('.ca-auth')).toBeVisible()
      await page.keyboard.press('Escape'); await expect(page.locator('.ca-auth')).toHaveCount(0)
      await expect(trigger).toBeFocused(); await expect(composer).toHaveValue(draft)
      expect(await composer.evaluate((node, original) => node === original, originalInput)).toBe(true)
      expect(await composer.evaluate(node => [(node as HTMLTextAreaElement).selectionStart, (node as HTMLTextAreaElement).selectionEnd])).toEqual([3, 12])
    }
    await titleButton.click(); await expect(header.locator('.g-title-input')).toBeFocused()
    await hit(header.locator('.g-title-input'))
    await header.locator('.g-title-input').press('Escape'); await expect(titleButton).toBeFocused()
    await expect(titleButton).toHaveAttribute('title', title)
    await menu.click(); await expect(page.locator('.client-session-pop')).toBeVisible()
    await page.keyboard.press('Escape'); await expect(menu).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`conversation-auth-${width}-${language}.png`) })
    expect(audit).toEqual({ blocked: [], errors: [] })
  })
}

for (const width of [320, 390, 860]) {
  test(`게스트 대화 ${width}px: 모바일 원본 인증숨김과 입력을 보존한다`, async ({ page, baseURL }) => {
    const audit = await mount(page, baseURL, width, 'fr')
    await expect(page.locator('.client-auth-nav')).toBeHidden()
    await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
    await hit(page.locator('.client-hamburger'))
    expect(audit).toEqual({ blocked: [], errors: [] })
  })
}

for (const width of [861, 1440]) {
  test(`회원 대화 ${width}px: 게스트 인증을 만들지 않고 예약공간을 남기지 않는다`, async ({ page, baseURL }) => {
    const audit = await mount(page, baseURL, width, 'fr', true)
    await expect(page.locator('.client-auth-nav')).toHaveCount(0)
    await hit(page.locator('.g-chead .g-title'))
    await hit(page.locator('.client-session-options > button'))
    await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
    expect(audit).toEqual({ blocked: [], errors: [] })
  })
}

test('연구 문서는 view-briefing이어도 일반대화 인증 복원 범위를 넓히지 않는다', async ({ page, baseURL }) => {
  const audit = await mount(page, baseURL, 1440, 'ko', false, true)
  await expect(page.locator('.client-auth-nav')).toBeHidden()
  expect(audit).toEqual({ blocked: [], errors: [] })
})

test('실제폭 부족시에만 줄을 분리하고 언어·폭·확대 왕복은 초안과 선택 영역을 보존한다', async ({ page, baseURL }) => {
  const audit = await mount(page, baseURL, 861, 'fr')
  const header = page.locator('.g-chead'), nav = page.locator('.client-auth-nav'), composer = page.locator('.g-composer textarea')
  const original = await composer.elementHandle()
  await composer.focus(); await composer.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(3, 12))
  const offset = () => header.evaluate(node => parseFloat(getComputedStyle(node).marginTop))
  const selection = async () => {
    await expect(composer).toHaveValue(draft); await expect(composer).toBeFocused()
    expect(await composer.evaluate((node, original) => node === original, original)).toBe(true)
    expect(await composer.evaluate(node => [(node as HTMLTextAreaElement).selectionStart, (node as HTMLTextAreaElement).selectionEnd])).toEqual([3, 12])
  }
  const changeLanguage = (language: Language) => page.evaluate(async language => {
    const path = '/src/client-preferences.ts', { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', language)
  }, language)
  await expect.poll(offset).toBeGreaterThan(0)
  const navBox = await nav.boundingBox(), headerBox = await header.boundingBox()
  expect(navBox).not.toBeNull(); expect(headerBox).not.toBeNull()
  expect(headerBox!.y).toBeGreaterThanOrEqual(navBox!.y + navBox!.height)
  const before = await offset()
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  expect(await offset()).toBe(before)
  await changeLanguage('ko'); await expect.poll(offset).toBe(0); await selection()
  await changeLanguage('fr'); await expect.poll(offset).toBeGreaterThan(0); await selection()
  await page.setViewportSize({ width: 1440, height: 900 }); await expect.poll(offset).toBe(0); await selection()
  await page.evaluate(() => { document.documentElement.style.zoom = '2' })
  await expect.poll(offset).toBeGreaterThan(0)
  await hit(header.locator('.g-title')); await hit(header.locator('.client-session-options > button'))
  for (const control of await nav.locator(':scope > a, :scope > button').all()) {
    const box = await hit(control)
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(1440)
  }
  await selection()
  await page.evaluate(() => { document.documentElement.style.zoom = '' })
  await expect.poll(offset).toBe(0)
  await page.setViewportSize({ width: 860, height: 844 }); await expect(nav).toBeHidden()
  await expect.poll(offset).toBe(0); await selection()
  await page.setViewportSize({ width: 861, height: 900 }); await expect(nav).toBeVisible()
  await expect.poll(offset).toBeGreaterThan(0); await selection()
  expect(audit).toEqual({ blocked: [], errors: [] })
})

test('body 확대 후에도 고정 인증 메뉴가 대화 헤더와 본문을 가리지 않는다',async({page,baseURL},info)=>{
  await mount(page,baseURL,1440,'fr')
  await page.locator('body').evaluate(el=>{el.style.zoom='2'})
  const nav=page.locator('.client-auth-nav'),header=page.locator('.g-chead'),scroll=page.locator('.g-scroll')
  await expect.poll(async()=>{
    const a=(await nav.boundingBox())!,b=(await header.boundingBox())!
    return b.y>=a.y+a.height
  }).toBe(true)
  await hit(header.locator('.g-title'));await hit(header.locator('.g-tabs button').first());await hit(header.locator('.client-session-options>button'))
  for(const control of await nav.locator(':scope>a,:scope>button').all())await hit(control)
  const a=(await nav.boundingBox())!,b=(await scroll.boundingBox())!
  expect(b.y).toBeGreaterThanOrEqual(a.y+a.height)
  await page.screenshot({path:info.outputPath('body-zoom-header.png')})
})

test('공통 백테스트 복귀 후 새 대화 헤더도 비로그인 인증 공간을 다시 측정한다', async ({ page, baseURL }) => {
  await mount(page, baseURL, 861, 'fr', false, false, true)
  for (const index of [0,1,1,1,1]) await page.getByTestId('source-intake').locator('.intake-options button').nth(index).click()
  await page.locator('.summary-open').click()
  await page.getByTestId('common-backtest-shell').locator('.cbt-head button').click()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  const header=page.locator('.g-chead')
  await expect.poll(()=>header.evaluate(el=>parseFloat(getComputedStyle(el).marginTop))).toBeGreaterThan(0)
  await hit(header.locator('.g-title')); await hit(header.locator('.client-session-options > button'))
  await page.setViewportSize({width:1440,height:900})
  await expect.poll(()=>header.evaluate(el=>parseFloat(getComputedStyle(el).marginTop))).toBe(0)
  await page.setViewportSize({width:861,height:900})
  await expect.poll(()=>header.evaluate(el=>parseFloat(getComputedStyle(el).marginTop))).toBeGreaterThan(0)
})

test('Native 게스트도 원본 대화 인증표시와 공간예약을 소비한다', async ({ page, baseURL }) => {
  const audit = await mount(page, baseURL, 1100, 'fr')
  await page.route('**/native-conversation-auth.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture"></div></body></html>' }))
  await page.goto('/native-conversation-auth.html')
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh', refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/internal-poc/ClientServiceExperience.tsx', source = await (await fetch(path)).text()
    const rp = source.match(/from "([^"\n]*\/react\.js[^"\n]*)"/)?.[1]
    if (!rp) throw new Error('Vite React 인스턴스를 찾지 못했습니다.')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, h = react.createElement
    const dp = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ dp)
    const { ClientServiceExperience } = await import(/* @vite-ignore */ path)
    function Host() {
      const [input, onInput] = react.useState('Native 원문 초안')
      return h(ClientServiceExperience, { accountScope: 'native-auth-layout-owner', onLogin: () => {},
        state: { phase: 'ready', sessionState: 'ANONYMOUS', messages: [{ id: 'native-question', role: 'user', text: '명시 Native 질문' }], input,
          inputDisabled: false, busy: false, source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
          onInput, onSend: async () => {}, onReset: () => {},
        },
      })
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  })
  await expect(page.locator('.client-service-app')).toBeVisible()
  await expect(page.locator('.client-service-app')).toHaveClass(/has-public-conversation/)
  await expect(page.locator('.client-service-app .client-auth-nav')).toBeVisible()
  await expect(page.locator('.g-composer textarea')).toHaveValue('Native 원문 초안')
  expect(await page.locator('.client-service-app').evaluate(element => getComputedStyle(element).getPropertyValue('--client-conversation-auth-space'))).not.toBe('')
  expect(audit).toEqual({ blocked: [], errors: [] })
})
