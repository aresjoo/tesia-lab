import { expect, test, type Page } from '@playwright/test'

const root = '.client-restored-research[data-source="client-fixture"]'
const chipSelector = `${root} .g-newmsg`
const now = Date.UTC(2026, 9, 5, 12)

async function mount(page: Page, baseURL: string | undefined, reducedMotion: 'reduce' | 'no-preference') {
  if (!baseURL) throw new Error('Loopback fixture baseURL required')
  const origin = new URL(baseURL).origin, owner = 'newmsg-motion-supplied-mock'
  const blocked: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
      blocked.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort()
    }
    return route.continue()
  })
  await page.emulateMedia({ reducedMotion })
  await page.addInitScript(({ owner, now }) => {
    localStorage.setItem('tethLang', 'ko'); sessionStorage.setItem('teth-app-banner-dismissed', '1')
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: owner, homeDraft: '', sessions: [{ id: owner,
      title: '새 응답 모션용 명시 Mock', renamed: true, idea: '새 응답 모션용 명시 Mock', draft: '', pair: 'BTC/USDT', mode: 'dip',
      timeframe: '일봉', risk: '-3%', takeProfit: '+8%', phase: 'plan', workspace: 'research', researchStatus: '진행 중', turns: [], updatedAt: now }] }))
    sessionStorage.setItem(`teth-research-preview:restored:${owner}`, JSON.stringify({ seconds: 65, status: 'paused', view: 'activity', questions: [], clockVersion: 1 }))
    sessionStorage.setItem(`teth-client-research-documents:${owner}`, JSON.stringify({ active: 'activity', tabs: ['activity', 'plan'], drafts: {}, rowDrafts: {},
      replies: [], positions: { activity: 0 }, edits: {}, paper: false, paused: false }))
    // Observe the real CSS animation at insertion and native paint frames.
    // No tokens/styles/time delays, animation setters or RAF mocks are supplied.
    const samples: unknown[] = []
    Reflect.set(window, '__newmsgPaintSamples', samples)
    new MutationObserver(() => {
      const chip = document.querySelector<HTMLElement>('.client-restored-research .g-newmsg')
      if (!chip || samples.length) return
      const sample = (phase: string) => {
        if (!chip.isConnected) return
        const style = getComputedStyle(chip), animation = chip.getAnimations()[0]
        samples.push({ phase, opacity: style.opacity, transform: style.transform, name: style.animationName, duration: style.animationDuration,
          currentTime: animation?.currentTime ?? null, state: animation?.playState ?? null,
          keyframes: animation?.effect instanceof KeyframeEffect ? animation.effect.getKeyframes() : [] })
      }
      sample('inserted')
      chip.addEventListener('animationend', () => sample('animationend'), { once: true })
      let frame = 0
      const paint = () => {
        sample(`paint-${++frame}`)
        if (chip.isConnected && frame < 30 && Number(getComputedStyle(chip).opacity) < 1) requestAnimationFrame(paint)
      }
      requestAnimationFrame(paint)
    }).observe(document, { childList: true, subtree: true })
  }, { owner, now })
  await page.goto('/?ui-debug=1')
  await expect(page.locator(root)).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return { blocked, errors }
}

async function showChip(page: Page) {
  await page.getByLabel('연구 과정에 질문', { exact: true }).fill('읽기 위치를 유지하는 새 응답 모션, 명시 Mock')
  await page.getByRole('button', { name: '문서 질문 보내기', exact: true }).click()
  await expect(page.locator(chipSelector)).toBeVisible()
}
async function style(page: Page) {
  return page.locator(chipSelector).evaluate(element => {
    const s = getComputedStyle(element), animation = element.getAnimations()[0]
    return { ease: s.getPropertyValue('--ease').trim(), name: s.animationName, duration: s.animationDuration, curve: s.animationTimingFunction,
      fill: s.animationFillMode, opacity: s.opacity, transform: s.transform, cursor: s.cursor, background: s.backgroundColor,
      currentTime: animation?.currentTime ?? null, state: animation?.playState ?? null }
  })
}

test('public pill은 원본 곡선·250ms 모션으로 실제 첫 paint에서 들어오고 완료 뒤 pointer 클릭된다', async ({ page, baseURL }, info) => {
  const audit = await mount(page, baseURL, 'no-preference')
  await showChip(page)
  const computed = await style(page)
  const samples = await page.evaluate(() => Reflect.get(window, '__newmsgPaintSamples'))
  await info.attach('newmsg-motion-start.json', { body: JSON.stringify({ computed, samples, audit }), contentType: 'application/json' })
  console.info('PUBLIC_NEWMSG_COMPUTED', JSON.stringify({ computed, samples }))
  // The observer's native paint samples, not screenshot timing, attest entry.
  await page.screenshot({ path: info.outputPath('newmsg-after-action.png') })
  expect.soft(computed.name).toBe('gFadeUpC')
  expect.soft(computed.duration).toBe('0.25s')
  expect.soft(computed.curve).toBe('cubic-bezier(0.16, 1, 0.3, 1)')
  expect.soft(computed.fill).toBe('both')
  expect(samples.some((sample: { opacity: string }) => Number(sample.opacity) < 1), 'Real first paint must include an entering state').toBe(true)
  await expect.poll(async () => Number((await style(page)).opacity)).toBe(1)
  const completed = await style(page)
  const afterSamples = await page.evaluate(() => Reflect.get(window, '__newmsgPaintSamples'))
  await page.screenshot({ path: info.outputPath('newmsg-complete.png') })
  await page.locator(chipSelector).hover()
  const hover = await page.locator(chipSelector).evaluate(element => ({ actual: getComputedStyle(element).backgroundColor,
    expected: getComputedStyle(element).getPropertyValue('--g3').trim(), cursor: getComputedStyle(element).cursor }))
  const placement = await page.locator(chipSelector).evaluate(element => {
    const chip = element.getBoundingClientRect(), composer = element.closest('.rw-center')!.querySelector('.rw-composer-wrap')!.getBoundingClientRect()
    const hit = document.elementFromPoint(chip.left + chip.width / 2, chip.top + chip.height / 2)
    return { gap: composer.top - chip.bottom, hit: Boolean(hit && element.contains(hit)) }
  })
  expect(hover.actual).not.toBe(completed.background); expect(hover.cursor).toBe('pointer')
  expect(placement.gap).toBeCloseTo(8); expect(placement.hit).toBe(true)
  await page.locator(chipSelector).click()
  await expect(page.locator(chipSelector)).toHaveCount(0)
  const clicked = await page.locator(`${root} .rw-scroll`).evaluate(element => ({ gap: element.scrollHeight - element.clientHeight - element.scrollTop }))
  expect(clicked.gap).toBeLessThan(2)
  await info.attach('newmsg-motion-complete.json', { body: JSON.stringify({ completed, samples: afterSamples, hover, placement, clicked, audit }), contentType: 'application/json' })
  expect(audit).toEqual({ blocked: [], errors: [] })
})

test('public reduced motion은 실제 root media rule로 짧게 종료하고 아래로 읽으면 pill을 자동 숨긴다', async ({ page, baseURL }, info) => {
  const audit = await mount(page, baseURL, 'reduce')
  await showChip(page)
  const computed = await style(page)
  const mediaRules = await page.evaluate(() => {
    const result: string[] = []
    for (const sheet of document.styleSheets) {
      let rules: CSSRuleList; try { rules = sheet.cssRules } catch { continue }
      for (const rule of Array.from(rules)) if (rule instanceof CSSMediaRule && rule.conditionText.includes('prefers-reduced-motion') && matchMedia(rule.conditionText).matches && rule.cssText.includes('animation-duration')) result.push(rule.cssText)
    }
    return result
  })
  await expect.poll(async () => Number((await style(page)).opacity)).toBe(1)
  expect.soft(computed.name).toBe('gFadeUpC')
  expect(parseFloat(computed.duration)).toBeLessThanOrEqual(0.01)
  expect(mediaRules.some(rule => rule.includes('animation-duration') && rule.includes('important'))).toBe(true)
  const scroll = page.locator(`${root} .rw-scroll`)
  await scroll.hover(); await page.mouse.wheel(0, 10_000)
  await expect(page.locator(chipSelector)).toHaveCount(0)
  await info.attach('newmsg-reduced-auto-hide.json', { body: JSON.stringify({ computed, mediaRules, samples: await page.evaluate(() => Reflect.get(window, '__newmsgPaintSamples')), audit }), contentType: 'application/json' })
  expect(audit).toEqual({ blocked: [], errors: [] })
})
