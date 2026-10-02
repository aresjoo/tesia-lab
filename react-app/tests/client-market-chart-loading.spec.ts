import { expect, test, type Page } from '@playwright/test'
import type { MarketChartPresentation } from '../src/client-market-chart-presentation'
import { marketChartText } from '../src/client-market-chart-copy'

const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const rendererPath = '/src/components/ClientProfessionalPriceChart.tsx'
const rendererRoute = '**/src/components/ClientProfessionalPriceChart.tsx*'
function presentation(revision = 1, resolutionSeconds = 3600): MarketChartPresentation {
  return {
    binding: { scopeId: 'owner-a/conversation-a', messageId: 'assistant-a', observationId: `observation-${revision}` },
    seriesId: 'market-a', asset: 'BTC / USDT', assetLabel: '비트코인', resolutionSeconds,
    availableResolutions: [3600, 7200, 14400], state: 'ready',
    view: { identity: `view-${revision}`, market: 'BTC / USDT', resolutionSeconds, pricePrecision: 2,
      sourceLabel: '검수용 합성 관측값, 실시간 시세 아님', fills: [],
      bars: Array.from({ length: 45 }, (_, index) => ({ time: 1_700_000_000 + index * resolutionSeconds,
        open: 100 + index + revision, high: 107 + index + revision, low: 98 + index + revision,
        close: 105 + index + revision, volume: 50 + index })),
    },
  }
}

async function mount(page: Page, initial = presentation()) {
  const errors: string[] = [], rendererRequests: string[] = [], documents: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.pathname === rendererPath) rendererRequests.push(url.pathname)
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(url.pathname)
  })
  const value = JSON.stringify(initial).replace(/</g, '\\u003c')
  // Real existing native shell and renderer, synthetic presentation only.
  // Reboot the fixture on a real document reload, not a mocked reload function.
  await page.route('**/market-chart-loading-test.html', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture" style="height:100dvh"></div><script type="module">
    import Runtime from '/@react-refresh'; Runtime.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;
    const {mount}=await import('/tests/fixtures/market-chart-host.tsx');
    window.marketChartHost=mount(${value},{native:true});
  </script></body></html>` }))
  await page.goto('/market-chart-loading-test.html', { waitUntil: 'commit' })
  await expect(page.locator('.g-composer textarea:visible')).toHaveValue('계속 작성하던 질문')
  return { errors, rendererRequests, documents }
}
const slot = (page: Page) => page.locator('[data-market-chart-load]')
const input = (page: Page) => page.locator('.g-composer textarea:visible')
const loadingLogo = (page: Page) => slot(page).locator('svg.client-animated-logo')
async function expectLoadingLogo(page: Page, reduced = false) {
  const logo = loadingLogo(page)
  await expect(logo).toHaveCount(1)
  await expect(logo).toBeVisible()
  await expect(logo).toHaveAttribute('width', '24')
  await expect(logo).toHaveAttribute('height', '15')
  await expect(logo).toHaveAttribute('aria-hidden', 'true')
  const path = logo.locator('defs mask path')
  await expect(path).toHaveCount(1)
  if (reduced) {
    await expect(logo).toHaveCSS('animation-name', 'none')
    await expect(path).toHaveCSS('animation-name', 'none')
    await expect(path).toHaveCSS('stroke-dashoffset', '0px')
  } else {
    await expect(logo).toHaveCSS('animation-duration', '2.1s')
    await expect(path).toHaveCSS('animation-duration', '2.1s')
    await expect(path).toHaveCSS('animation-timing-function', 'cubic-bezier(0.45, 0, 0.25, 1)')
    expect(await path.evaluate(node => getComputedStyle(node).animationName)).not.toBe('none')
  }
}
async function expectLoadingLayout(page: Page) {
  const layout = await slot(page).evaluate(element => {
    const logo = element.querySelector('svg.client-animated-logo')!.getBoundingClientRect()
    const box = element.getBoundingClientRect()
    // 실제 글자 조각을 비교한다. 로고를 포함하는 상태줄의 외곽상자는
    // 로고와 겹치는 것이 정상이므로 그 상자를 겹침 반례로 삼지 않는다.
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let overlapsText = false
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent?.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(walker.currentNode)
      for (const rect of range.getClientRects()) {
        if (Math.min(rect.right, logo.right) - Math.max(rect.left, logo.left) > 1
          && Math.min(rect.bottom, logo.bottom) - Math.max(rect.top, logo.top) > 1) overlapsText = true
      }
    }
    return { width: logo.width, height: logo.height, inside: logo.left >= box.left && logo.right <= box.right
      && logo.top >= box.top && logo.bottom <= box.bottom, overlapsText,
      overflow: element.scrollWidth > element.clientWidth + 1,
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 }
  })
  expect(layout).toEqual({ width: 24, height: 15, inside: true, overlapsText: false, overflow: false, pageOverflow: false })
}
async function update(page: Page, value: MarketChartPresentation) {
  await page.evaluate(value => Reflect.get(window, 'marketChartHost').update(value), value)
}
async function language(page: Page, value: string) {
  await page.evaluate(value => Reflect.get(window, 'marketChartHost').language(value), value)
}

test('홈은 시장 차트 renderer와 차트 라이브러리를 미리 요청하지 않는다', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => requests.push(new URL(request.url()).pathname))
  await page.goto('/')
  await page.locator('#strategy-idea').fill('아직 전송하지 않은 홈 초안')
  expect(requests.filter(path => /ClientProfessionalPriceChart|lightweight-charts/.test(path))).toEqual([])
  await expect(page.locator('#strategy-idea')).toHaveValue('아직 전송하지 않은 홈 초안')
})

test('빈 입력은 renderer를 요청하지 않고 공급 뒤 국소 로딩은 7언어·대화 초안·포커스를 보존한다', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route(rendererRoute, async route => { await gate; await route.fallback() })
  const initial = presentation()
  const audit = await mount(page, { ...initial, state: 'unavailable', view: undefined })
  try {
    await expect(page.locator('.market-chart-empty')).toBeVisible()
    await expect(page.locator('.client-market-chart svg.client-animated-logo')).toHaveCount(0)
    expect(audit.rendererRequests).toHaveLength(0)
    await update(page, initial)
    await expect(slot(page)).toHaveAttribute('data-market-chart-load', 'loading')
    await expect.poll(() => audit.rendererRequests.length).toBe(1)
    await input(page).fill('차트를 기다리며 작성한 초안')
    const composer = await input(page).elementHandle()
    const thread = await page.locator('.g-thread').elementHandle()
    for (const value of languages) {
      await language(page, value)
      await expect(slot(page).getByRole('status')).toHaveText(marketChartText(value, 'rendererLoading'))
      await expect(slot(page)).toHaveAttribute('aria-busy', 'true')
      await expectLoadingLogo(page)
      expect(await composer!.evaluate(node => node.isConnected && node === document.activeElement)).toBe(true)
      expect(await thread!.evaluate(node => node.isConnected)).toBe(true)
      await expect(input(page)).toHaveValue('차트를 기다리며 작성한 초안')
    }
    expect(await slot(page).evaluate(node => node.getBoundingClientRect().height)).toBe(info.project.name === 'mobile' ? 300 : 380)
    await page.setViewportSize({ width: 320, height: 844 })
    for (const value of languages) {
      await language(page, value)
      await expect(slot(page).getByRole('status')).toHaveText(marketChartText(value, 'rendererLoading'))
      await expectLoadingLogo(page)
      await expectLoadingLayout(page)
      await expect(input(page)).toHaveValue('차트를 기다리며 작성한 초안')
      expect(await composer!.evaluate(node => node.isConnected && node === document.activeElement)).toBe(true)
    }
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expectLoadingLogo(page, true)
    await expectLoadingLayout(page)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expectLoadingLogo(page)
    expect(audit.rendererRequests).toHaveLength(1)
    expect(audit.documents).toHaveLength(1)
    release()
    await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
    await expect(slot(page)).toHaveCount(0)
    await expect(page.locator('.client-market-chart svg.client-animated-logo')).toHaveCount(0)
    await expect(input(page)).toHaveValue('차트를 기다리며 작성한 초안')
    expect(await composer!.evaluate(node => node === document.activeElement)).toBe(true)
    expect(audit.errors).toEqual([])
  } finally { release() }
})

test('로드된 차트는 locale·선택·동일 입력·숨김 중 주기 변경 뒤에도 같은 canvas를 유지한다', async ({ page }) => {
  const audit = await mount(page)
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  await expect(page.locator('.client-market-chart svg.client-animated-logo')).toHaveCount(0)
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  const retained = async () => expect(await canvas!.evaluate(node => node.isConnected && node === document.querySelector('.cp-surface canvas'))).toBe(true)
  await page.locator('.cp-surface').focus()
  await page.keyboard.press('Home')
  await expect(page.locator('.cp-quote dd').nth(1)).toHaveText('101')
  for (const value of languages) {
    await language(page, value)
    await retained()
    await expect(page.locator('.client-market-chart svg.client-animated-logo')).toHaveCount(0)
    await expect(page.locator('.cp-quote dd').nth(1)).toHaveText('101')
  }
  await update(page, structuredClone(presentation()))
  await retained()
  await page.evaluate(() => { document.getElementById('fixture')!.style.display = 'none' })
  await update(page, presentation(2, 7200))
  await page.evaluate(() => { document.getElementById('fixture')!.style.display = '' })
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  await retained()
  await language(page, 'ko')
  await expect(page.locator('.market-chart-intervals').getByRole('button', { name: '2시간', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.cp-quote dd').nth(1)).toHaveText('146')
  expect(audit.rendererRequests).toHaveLength(1)
  expect(audit.errors).toEqual([])
})

test('실제 chunk 실패는 자동 재시도·초기화 없이 보존하고 명시 페이지 새로고침으로만 복구한다', async ({ page }) => {
  let release!: () => void, requests = 0
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route(rendererRoute, async route => {
    requests++
    if (requests === 1) { await gate; await route.fulfill({ status: 503, contentType: 'text/plain', body: 'TEST_ONLY_CHART_CHUNK_UNAVAILABLE' }) }
    else await route.fallback()
  })
  const audit = await mount(page)
  try {
    await expect(slot(page)).toHaveAttribute('data-market-chart-load', 'loading')
    await input(page).fill('실패해도 현재 화면에 남아야 하는 초안')
    const composer = await input(page).elementHandle()
    const thread = await page.locator('.g-thread').elementHandle()
    release()
    await expect(slot(page)).toHaveAttribute('data-market-chart-load', 'failed')
    await expect(page.locator('.client-market-chart svg.client-animated-logo')).toHaveCount(0)
    for (const value of languages) {
      await language(page, value)
      await expect(slot(page).getByRole('alert')).toHaveText(marketChartText(value, 'rendererFailed'))
      await expect(page.locator('.client-market-chart svg.client-animated-logo')).toHaveCount(0)
      await expect(slot(page).getByRole('button', { name: marketChartText(value, 'rendererReload'), exact: true })).toBeVisible()
      expect(await composer!.evaluate(node => node.isConnected && node === document.activeElement)).toBe(true)
      expect(await thread!.evaluate(node => node.isConnected)).toBe(true)
      await expect(input(page)).toHaveValue('실패해도 현재 화면에 남아야 하는 초안')
    }
    await update(page, presentation(2))
    await expect(slot(page)).toHaveAttribute('data-market-chart-load', 'failed')
    expect(requests).toBe(1)
    expect(audit.documents).toHaveLength(1)
    expect(audit.errors).toEqual([])
    await Promise.all([
      page.waitForEvent('request', request => request.isNavigationRequest() && request.frame() === page.mainFrame()),
      slot(page).getByRole('button', { name: marketChartText('fr', 'rendererReload'), exact: true }).click(),
    ])
    await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
    await expect(slot(page)).toHaveCount(0)
    await expect(page.locator('.client-market-chart svg.client-animated-logo')).toHaveCount(0)
    expect(requests).toBe(2)
    expect(audit.documents).toHaveLength(2)
    expect(audit.errors).toEqual([])
    // This synthetic fixture reboots on reload. Do not promise persisted drafts.
  } finally { release() }
})

test('로딩 중 카드가 사라지면 늦은 모듈 도착이 차트를 다시 만들지 않는다', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route(rendererRoute, async route => { await gate; await route.fallback() })
  const audit = await mount(page)
  try {
    await expect(slot(page)).toHaveAttribute('data-market-chart-load', 'loading')
    await expect(loadingLogo(page)).toHaveCount(1)
    await page.evaluate(() => Reflect.get(window, 'marketChartHost').unmount())
    await expect(page.locator('svg.client-animated-logo')).toHaveCount(0)
    const response = page.waitForResponse(response => new URL(response.url()).pathname === rendererPath)
    release()
    expect(await (await response).finished()).toBeNull()
    // Await dependency evaluation as well as response headers: the late lazy
    // import must actually settle before asserting that unmount stays final.
    await page.evaluate(async path => { await import(/* @vite-ignore */ path) }, rendererPath)
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(page.locator('.cp-surface canvas,[data-market-chart-load]')).toHaveCount(0)
    await expect(page.locator('svg.client-animated-logo')).toHaveCount(0)
    expect(audit.errors).toEqual([])
  } finally { release() }
})
