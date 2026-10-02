import { expect, test, type Page } from '@playwright/test'
import jobFixtures from './internal-poc/fixtures/native-service-contracts.json' with { type: 'json' }

async function mountGrowingService(page: Page) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/conversation-growth.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><div id="fixture"></div></body></html>' }))
  await page.goto('/conversation-growth.html')
  await page.evaluate(async job => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/tests/fixtures/conversation-growth-harness.tsx'
    const { mountConversationGrowth } = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'growth', mountConversationGrowth(document.getElementById('fixture'), job))
  }, jobFixtures.sources[3].fixture.cases!.find(item => item.name === 'QUEUED')!.response.data)
  await expect(page.locator('[data-growth-tail]')).toBeInViewport()
  await page.evaluate(() => document.fonts.ready)
  expect(errors).toEqual([])
  return errors
}

for (const mode of ['parent', 'child', 'job'] as const) for (const above of [false, true]) test(`실제 서비스 outcome ${mode} 성장·${above ? '위읽기' : '바닥'}는 고정 대화 상태와 입력 DOM을 보존한다`, async ({ page }) => {
  const errors = await mountGrowingService(page)
  const scroll = page.locator('.g-scroll'), tail = page.locator('[data-growth-tail]')
  const input = page.locator('.g-composer textarea')
  await input.evaluate(el => Reflect.set(window, 'growthInput', el))
  const bottom = await scroll.evaluate(el => el.scrollTop)
  if (above) {
    await page.waitForTimeout(180)
    await scroll.hover()
    await page.mouse.wheel(0, -120)
    await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeLessThan(bottom - 100)
  }
  const before = await scroll.evaluate(el => el.scrollTop)
  const height = await page.locator('[data-growth-outcome]').evaluate(el => el.getBoundingClientRect().height)
  const commits = await page.evaluate(() => Reflect.get(window, 'growth').parentCommits)
  if (mode === 'job') await page.evaluate(job => Reflect.get(window, 'growth').job(job), jobFixtures.sources[3].fixture.cases!.find(item => item.name === 'REPLAYING')!.response.data)
  else await page.evaluate(mode => Reflect.get(window, 'growth')[mode === 'parent' ? 'growParent' : 'growChild'](), mode)
  await expect.poll(() => page.locator('[data-growth-outcome]').evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(height + 10)
  if (above) {
    await expect(page.locator('.g-newmsg')).toBeVisible()
    await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(before)
  } else {
    await expect(tail).toBeInViewport()
    await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(before + 10)
  }
  if (mode !== 'parent') expect(await page.evaluate(() => Reflect.get(window, 'growth').parentCommits)).toBe(commits)
  await expect(input).toHaveValue('보존할 실제 셸 초안')
  expect(await input.evaluate(el => el === Reflect.get(window, 'growthInput'))).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'growth').sends)).toBe(0)
  expect(errors).toEqual([])
})

test('실제 자식 갱신은 숨김 복귀에 알리고 언어·폭 재배치만으로 새 응답을 만들지 않는다', async ({ page }) => {
  const errors = await mountGrowingService(page)
  const scroll = page.locator('.g-scroll')
  const bottom = await scroll.evaluate(el => el.scrollTop)
  await page.waitForTimeout(180)
  await scroll.hover()
  await page.mouse.wheel(0, -120)
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeLessThan(bottom - 100)
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', language) }, language)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(page.locator('.g-newmsg')).toHaveCount(0)
  }
  await page.setViewportSize({ width: 320, height: 860 })
  await expect(page.locator('.g-newmsg')).toHaveCount(0)
  // A taller viewport may now include the old tail. Establish a fresh, real
  // upward reading intent before testing content received while hidden.
  const resizedTop = await scroll.evaluate(el => el.scrollTop)
  await scroll.hover()
  await page.mouse.wheel(0, -160)
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeLessThan(resizedTop - 100)
  const reading = await scroll.evaluate(el => el.scrollTop)
  await page.evaluate(() => Reflect.get(window, 'growth').show(false))
  await expect(scroll).toBeHidden()
  await page.evaluate(() => Reflect.get(window, 'growth').growChild())
  await expect(page.getByText('명시 공급된 결과 설명 8', { exact: true })).toBeAttached()
  await page.evaluate(() => Reflect.get(window, 'growth').show(true))
  await expect(page.locator('.g-newmsg')).toBeVisible()
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(reading)
  await expect(page.locator('.g-composer textarea')).toHaveValue('보존할 실제 셸 초안')
  expect(errors).toEqual([])
})

test('속성 갱신은 추가 대화 geometry 측정이 없고 숨김 자식 갱신도 측정 없이 복귀까지 보존한다', async ({ page }) => {
  const errors = await mountGrowingService(page)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await page.evaluate(() => {
    const original = HTMLElement.prototype.getBoundingClientRect
    Reflect.set(window, 'growthMeasurements', 0)
    Reflect.set(window, 'growthMeasureEnabled', true)
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (Reflect.get(window, 'growthMeasureEnabled') && this.matches('.g-scroll,.g-spacer')) Reflect.set(window, 'growthMeasurements', Reflect.get(window, 'growthMeasurements') + 1)
      return original.call(this)
    }
    const child = document.querySelector<HTMLElement>('[data-growth-outcome]')!
    for (let index = 0; index < 500; index++) {
      child.setAttribute('data-progress-paint', String(index))
      child.style.opacity = index % 2 ? '1' : '.99'
    }
  })
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  expect(await page.evaluate(() => Reflect.get(window, 'growthMeasurements'))).toBe(0)
  await page.evaluate(() => Reflect.get(window, 'growth').growChild())
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'growthMeasurements'))).toBeGreaterThan(0)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const settledMeasurements = await page.evaluate(() => Reflect.get(window, 'growthMeasurements'))
  await page.evaluate(async () => {
    for (let frame = 0; frame < 4; frame++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  })
  expect(await page.evaluate(() => Reflect.get(window, 'growthMeasurements'))).toBe(settledMeasurements)
  await page.evaluate(() => Reflect.set(window, 'growthMeasureEnabled', false))
  await expect(page.locator('[data-growth-tail]')).toBeInViewport()
  await page.evaluate(() => Reflect.get(window, 'growth').show(false))
  await expect(page.locator('.g-scroll')).toBeHidden()
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await page.evaluate(() => {
    Reflect.set(window, 'growthMeasurements', 0)
    Reflect.set(window, 'growthMeasureEnabled', true)
    Reflect.get(window, 'growth').growChild()
  })
  await expect(page.getByText('명시 공급된 결과 설명 16', { exact: true })).toBeAttached()
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  expect(await page.evaluate(() => Reflect.get(window, 'growthMeasurements'))).toBe(0)
  await page.evaluate(() => { Reflect.set(window, 'growthMeasureEnabled', false); Reflect.get(window, 'growth').show(true) })
  await expect(page.locator('[data-growth-tail]')).toBeInViewport()
  expect(errors).toEqual([])
})

async function mount(page: Page, service = false, background = false, omitActivityKey = false, fixedActivityKey = false) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/conversation-artifact-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root" style="height:100dvh"></div></body></html>' }))
  await page.goto('/conversation-artifact-test.html')
  await page.evaluate(async ({ service, background, omitActivityKey, fixedActivityKey }) => {
    const refresh = '/@react-refresh', rp = '/@id/react', dp = '/@id/react-dom/client'
    const runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const react = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp)
    const cp = '/src/components/ClientConversation.tsx', skin = '/src/internal-poc/ClientServiceExperience.tsx'
    await import(/* @vite-ignore */ skin)
    const { ClientConversation } = await import(/* @vite-ignore */ cp)
    const h = react.createElement ?? react.default.createElement
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('root'))
    let value = '보내지 않은 아이디어'
    let hidden = false, busy = background, longReply = false
    let extraReply = 0, questionNumber = 0
    Object.assign(window, { artifactBackground: (nextHidden: boolean, nextBusy: boolean, expanded = false) => { hidden = nextHidden; busy = nextBusy; longReply = expanded; render() } })
    Object.assign(window, { artifactAppend: () => { extraReply += 400; render() } })
    Object.assign(window, { artifactQuestion: () => { questionNumber++; extraReply = 0; longReply = false; busy = true; render() } })
    function render() {
      root.render(h('div', { hidden, style: { height: '100%' } }, h(ClientConversation, {
        value, onChange: (next: string) => { value = next; render() }, onSend: () => { Reflect.set(window, 'artifactSendCount', (Reflect.get(window, 'artifactSendCount') ?? 0) + 1) },
        onStop: () => {}, busy, ...(omitActivityKey ? {} : { activityKey: fixedActivityKey ? 'unchanged-controller-state' : `${busy ? 'pending' : 'complete'}:${extraReply}:${questionNumber}` }), initialTitle: '문서 탐색',
        onViewportChange: (state: unknown) => { Reflect.set(window, 'artifactViewport', state) },
        inputLabel: '질문', sendLabel: '전송', titleLabel: '제목',
        ...(service ? { artifactLabel: '전략 초안', artifactOpenLabel: '현재 서버 전략 초안 열기', showResearchTeam: false, previewTools: h(react.Fragment ?? react.default.Fragment) } : {}),
        artifact: h('section', { 'aria-label': '읽기 전용 조건' }, h('h2', {}, '조건 문서'), ...Array.from({ length: 30 }, (_, i) => h('p', { key: i }, `조건 ${i + 1} · 원문 그대로`))),
      }, background ? h(react.Fragment ?? react.default.Fragment, {}, h('div', { style: { height: 1200 } }, '이전 대화'), h('div', { className: 'g-urow' }, h('div', { className: 'g-umsg' }, questionNumber ? `새 질문 ${questionNumber}` : '마지막 질문')), longReply && h('div', { style: { height: 1400 + extraReply } }, '길어진 응답 본문'), h('p', {}, busy ? '응답 대기' : '응답 완료')) : h('p', {}, '기존 대화와 승인 안내'))))
    }
    render()
  }, { service, background, omitActivityKey, fixedActivityKey })
  await expect.poll(async () => ({ errors, inputs: await page.getByRole('textbox', { name: '질문', exact: true }).count() })).toEqual({ errors: [], inputs: 1 })
  await expect(page.getByRole('textbox', { name: '질문', exact: true })).toHaveValue('보내지 않은 아이디어')
  return errors
}

for (const readingAbove of [false, true]) test(`고정 activityKey·busy의 실제 children 성장: ${readingAbove ? '위읽기 위치와 새 응답 표시' : '바닥 읽기 추적'}`, async ({ page }) => {
  await mount(page, true, true, false, true)
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(false, false, true))
  const scroll = page.locator('.g-scroll')
  await expect(page.getByText('응답 완료', { exact: true })).toBeInViewport()
  const bottom = await scroll.evaluate(el => el.scrollTop)
  if (readingAbove) {
    await page.waitForTimeout(180)
    await scroll.hover()
    await page.mouse.wheel(0, -120)
    await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeLessThan(bottom - 100)
  }
  const before = await scroll.evaluate(el => el.scrollTop)
  await page.evaluate(() => Reflect.get(window, 'artifactAppend')())
  if (readingAbove) {
    await expect(page.locator('.g-newmsg')).toBeVisible()
    await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(before)
  } else {
    await expect(page.getByText('응답 완료', { exact: true })).toBeInViewport()
    await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(before + 300)
    await expect(page.locator('.g-newmsg')).toHaveCount(0)
  }
})

test('동적 호출의 activityKey 생략도 최초 표시와 숨김 복귀에서 null 캐시를 역참조하지 않는다', async ({ page }) => {
  // Runtime hardening for untyped callers; the typed component contract still
  // requires activityKey. Do not invent an activity identity in the fixture.
  const errors = await mount(page, true, true, true)
  const input = page.getByRole('textbox', { name: '질문', exact: true })
  await input.evaluate(el => Reflect.set(window, 'omittedKeyComposer', el))
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(true, true))
  await expect(page.locator('.g-scroll')).toBeHidden()
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(true, false, true))
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(false, false, true))
  await expect(page.getByText('응답 완료', { exact: true })).toBeInViewport()
  await expect(input).toHaveValue('보내지 않은 아이디어')
  expect(await input.evaluate(el => el === Reflect.get(window, 'omittedKeyComposer'))).toBe(true)
  expect(errors).toEqual([])
  expect(await page.evaluate(() => Reflect.get(window, 'artifactSendCount') ?? 0)).toBe(0)
})

for (const gap of [80, 120]) test(`실제 휠로 ${gap}px 위를 읽으면 새 응답은 위치를 빼앗지 않고 맨 아래 복귀 후만 추적한다`, async ({ page }) => {
  await mount(page, true, true)
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(false, false, true))
  const scroll = page.locator('.g-scroll')
  await expect(page.getByText('응답 완료', { exact: true })).toBeInViewport()
  const bottom = await scroll.evaluate(el => el.scrollTop)
  // Match the source's 140ms exclusion window for its own programmatic scroll.
  await page.waitForTimeout(180)
  await scroll.hover()
  await page.mouse.wheel(0, -(gap + 20))
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeLessThan(bottom - gap)
  const reading = await scroll.evaluate(el => el.scrollTop)
  await page.evaluate(() => Reflect.get(window, 'artifactAppend')())
  await expect(page.getByRole('button', { name: '새 응답', exact: true })).toBeVisible()
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(reading)
  await page.mouse.wheel(0, 5000)
  await expect(page.getByRole('button', { name: '새 응답', exact: true })).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'artifactAppend')())
  await expect(page.getByText('응답 완료', { exact: true })).toBeInViewport()
  expect(await scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(bottom)
})

test('근처 위읽기는 문서 왕복과 숨김 중 완료 뒤에도 유지하고 명시 새 질문만 다시 추적한다', async ({ page }) => {
  await mount(page, true, true)
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(false, false, true))
  const scroll = page.locator('.g-scroll')
  await expect(page.getByText('응답 완료', { exact: true })).toBeInViewport()
  const bottom = await scroll.evaluate(el => el.scrollTop)
  await page.waitForTimeout(180)
  await scroll.hover()
  await page.mouse.wheel(0, -120)
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeLessThan(bottom - 100)
  const reading = await scroll.evaluate(el => el.scrollTop)
  await page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true }).click()
  await page.locator('.g-tabs').getByRole('button', { name: '대화', exact: true }).click()
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(reading)
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(true, true, true))
  await expect(scroll).toBeHidden()
  await page.evaluate(() => { Reflect.get(window, 'artifactAppend')(); Reflect.get(window, 'artifactBackground')(true, false, true) })
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(false, false, true))
  await expect(page.locator('.g-newmsg')).toBeVisible()
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(reading)
  await page.evaluate(() => Reflect.get(window, 'artifactQuestion')())
  await expect(page.getByText('새 질문 1', { exact: true })).toBeInViewport()
  await expect(page.locator('.g-newmsg')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(false, false, true))
  await expect(page.getByText('응답 완료', { exact: true })).toBeInViewport()
  expect(await page.evaluate(() => Reflect.get(window, 'artifactSendCount') ?? 0)).toBe(0)
})

test('320px·7언어·컴포저 높이 변경은 위읽기 의도를 바꾸지 않고 칩의 자동 스크롤은 재추적한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 860 })
  await mount(page, true, true)
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(false, false, true))
  const scroll = page.locator('.g-scroll'), input = page.getByRole('textbox', { name: '질문', exact: true })
  await expect(page.getByText('응답 완료', { exact: true })).toBeInViewport()
  const bottom = await scroll.evaluate(el => el.scrollTop)
  await page.waitForTimeout(180)
  await scroll.hover()
  await page.mouse.wheel(0, -120)
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeLessThan(bottom - 100)
  const reading = await scroll.evaluate(el => el.scrollTop)
  await input.evaluate(el => Reflect.set(window, 'preservedComposer', el))
  const draft = '보존할 초안\n두 번째 줄\n세 번째 줄\n네 번째 줄'
  await input.fill(draft)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', language) }, language)
    await page.evaluate(() => Reflect.get(window, 'artifactAppend')())
    await expect(page.locator('.g-newmsg')).toBeVisible()
    await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(reading)
    await expect(input).toHaveValue(draft)
    expect(await input.evaluate(el => el === Reflect.get(window, 'preservedComposer'))).toBe(true)
  }
  await page.locator('.g-newmsg').click()
  await expect(page.locator('.g-newmsg')).toHaveCount(0)
  // Own queued onScroll events must not detach the new follow intention.
  await page.evaluate(() => Reflect.get(window, 'artifactAppend')())
  await expect(page.getByText('응답 완료', { exact: true })).toBeInViewport()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'artifactViewport').follow)).toBe(true)
  await expect(input).toHaveValue(draft)
  expect(await page.evaluate(() => Reflect.get(window, 'artifactSendCount') ?? 0)).toBe(0)
})

test('칩의 프로그램 scroll 통지 전에 콘텐츠 높이가 늘어도 사용자 위읽기로 오인하지 않는다', async ({ page }) => {
  await mount(page, true, true)
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(false, false, true))
  const scroll = page.locator('.g-scroll')
  await expect(page.getByText('응답 완료', { exact: true })).toBeInViewport()
  const bottom = await scroll.evaluate(el => el.scrollTop)
  await page.waitForTimeout(180)
  await scroll.hover()
  await page.mouse.wheel(0, -120)
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeLessThan(bottom - 100)
  await page.evaluate(() => Reflect.get(window, 'artifactAppend')())
  await expect(page.locator('.g-newmsg')).toBeVisible()
  const gap = await page.locator('.g-newmsg').evaluate(button => {
    button.click()
    // Model late image/chart layout, after our own scrollTop write but before
    // the browser delivers its native scroll event. No user scroll is emitted.
    const scroll = document.querySelector<HTMLElement>('.g-scroll')!
    const spacer = document.querySelector<HTMLElement>('.g-spacer')!
    const reply = [...document.querySelectorAll<HTMLElement>('.g-thread > div')].find(el => el.textContent === '길어진 응답 본문')!
    reply.style.height = `${reply.getBoundingClientRect().height + 400}px`
    return spacer.getBoundingClientRect().top - scroll.getBoundingClientRect().top - scroll.clientHeight
  })
  expect(gap).toBeGreaterThan(140)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'artifactViewport').follow)).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'artifactAppend')())
  await expect(page.getByText('응답 완료', { exact: true })).toBeInViewport()
  await expect(page.locator('.g-newmsg')).toHaveCount(0)
})

test('기본 문서 이름·아이콘·AI 연구팀·Mock 표시는 원본 기본값을 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await mount(page)
  await expect(page.locator('.g-tabs').getByRole('button', { name: '연구 계획', exact: true })).toBeVisible()
  await expect(page.locator('.g-aux .g-art svg')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'AI 연구팀', exact: true })).toBeVisible()
  await expect(page.locator('.g-demo')).toHaveText('Mock')
  await page.locator('.g-tabs').getByRole('button', { name: '연구 계획', exact: true }).click()
  await expect(page.locator('.g-ctx')).toHaveText('연구 계획')
  await expect(page.getByRole('region', { name: '읽기 전용 조건' })).toBeVisible()
})

test('다른 메뉴에서 응답이 완료되어도 숨은 대화의 spacer와 읽던 위치를 지우지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 1000 })
  await mount(page, true, true)
  const scroll = page.locator('.g-scroll')
  const spacer = page.locator('.g-spacer')
  // The previous conversation is being read, so completion must not force-follow.
  await scroll.evaluate(el => { el.scrollTop = 100; el.dispatchEvent(new Event('scroll')) })
  const before = await spacer.evaluate(el => (el as HTMLElement).style.height)
  expect(parseFloat(before)).toBeGreaterThan(0)
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(true, true))
  await expect(scroll).toBeHidden()
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(true, false))
  await expect(spacer).toHaveCSS('height', before)
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(false, false))
  await expect(scroll).toBeVisible()
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(100)
  await expect(page.getByRole('button', { name: '새 응답', exact: true })).toBeVisible()
  await expect(page.getByText('응답 완료', { exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '질문', exact: true })).toHaveValue('보내지 않은 아이디어')
  expect(await page.evaluate(() => Reflect.get(window, 'artifactSendCount') ?? 0)).toBe(0)
})

test('최신 응답을 따라가던 대화는 숨김 중 길어진 응답을 복귀 시 따라간다', async ({ page }) => {
  await mount(page, true, true)
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(true, true))
  await expect(page.locator('.g-scroll')).toBeHidden()
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(true, false, true))
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(false, false, true))
  const completed = page.getByText('응답 완료', { exact: true })
  await expect(completed).toBeInViewport()
  await expect.poll(() => page.locator('.g-scroll').evaluate(el => el.scrollTop)).toBeGreaterThan(1400)
  expect(await page.evaluate(() => Reflect.get(window, 'artifactSendCount') ?? 0)).toBe(0)
})

test('숨김과 복귀 사이 ResizeObserver 통지가 지연되어도 완료 응답을 따라간다', async ({ page }) => {
  await page.addInitScript(() => {
    // A browser can coalesce hide/show notifications into one animation frame.
    // Retain the native measurements; only defer observer delivery in this test.
    const Observer = window.ResizeObserver
    Object.assign(window, { pendingResizeNotifications: [] })
    window.ResizeObserver = class extends Observer {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => Reflect.get(window, 'pendingResizeNotifications').push(() => callback(entries, observer)))
      }
    }
  })
  await mount(page, true, true)
  const scroll = page.locator('.g-scroll')
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(true, true))
  await expect(scroll).toBeHidden()
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(true, false, true))
  await expect(page.locator('.g-thread')).toHaveAttribute('aria-busy', 'false')
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(false, false, true))
  await expect(page.getByText('응답 완료', { exact: true })).toBeInViewport()
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(1400)
  // Later delivery must not undo the already restored reading position.
  await page.evaluate(() => {
    const queued = Reflect.get(window, 'pendingResizeNotifications').splice(0)
    queued.forEach((notify: () => void) => notify())
  })
  await expect(page.getByText('응답 완료', { exact: true })).toBeInViewport()
})

test('여러 줄 작성 중에도 새 응답 버튼이 실제 입력창 위에서 가리지 않고 클릭된다', async ({ page }) => {
  await mount(page, true, true)
  await page.locator('.g-scroll').evaluate(el => { el.scrollTop = 100; el.dispatchEvent(new Event('scroll')) })
  await page.evaluate(() => Reflect.get(window, 'artifactBackground')(false, false, true))
  const unread = page.getByRole('button', { name: '새 응답', exact: true })
  await expect(unread).toBeVisible()
  await page.getByRole('textbox', { name: '질문', exact: true }).fill(Array.from({ length: 9 }, (_, i) => `보존할 질문 ${i}`).join('\n'))
  await expect.poll(async () => {
    const button = await unread.boundingBox(), composer = await page.locator('.g-composer-wrap').boundingBox()
    return !!button && !!composer && button.y + button.height <= composer.y
  }).toBe(true)
  await unread.click()
  await expect(unread).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'artifactSendCount') ?? 0)).toBe(0)
})

test('서비스 문서 표제는 탭·Artifacts·작성 맥락에 일치하고 가짜 팀을 만들지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await mount(page, true)
  await expect(page.getByText('연구 계획', { exact: true })).toHaveCount(0)
  await expect(page.getByText('AI 연구팀', { exact: true })).toHaveCount(0)
  await expect(page.locator('.g-demo')).toHaveCount(0)
  await page.getByRole('button', { name: '현재 서버 전략 초안 열기', exact: true }).click()
  await expect(page.locator('.g-ctx')).toHaveText('전략 초안')
  const scroll = page.locator('.g-scroll')
  await scroll.evaluate(el => { el.scrollTop = 360 })
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(360)
  await page.locator('.g-tabs').getByRole('button', { name: '대화', exact: true }).click()
  await expect(page.getByText('기존 대화와 승인 안내', { exact: true })).toBeVisible()
  await page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true }).click()
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(360)
  await expect(page.getByRole('textbox', { name: '질문', exact: true })).toHaveValue('보내지 않은 아이디어')
  expect(await page.evaluate(() => Reflect.get(window, 'artifactSendCount') ?? 0)).toBe(0)
  await page.getByRole('textbox', { name: '질문', exact: true }).press('Enter')
  await expect(page.locator('.g-tabs').getByRole('button', { name: '대화', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => Reflect.get(window, 'artifactSendCount'))).toBe(1)
})
