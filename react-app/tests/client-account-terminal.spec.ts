import { expect, test, type Page } from '@playwright/test'
import type { ClientLanguage } from '../src/client-preferences'
import { accountTerminalText } from '../src/client-account-terminal-copy'
import { shellText } from '../src/client-shell-copy'

const languages: readonly ClientLanguage[] = ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'ko', 'fr']

test('복사 가격 슬롯은 사용자 전략보다 우선하지 않으며 조회불가·중복ID를 빈 계정으로 간주하지 않는다', async ({ page }) => {
  await mount(page, false, true)
  await expect(page.locator('.ctm-symbol b')).toHaveText('BTC/USDT')
  await expect(page.getByTestId('copy-price-chart')).toHaveCount(0)
  for (const state of ['missing', 'duplicate']) {
    await page.evaluate(state => Reflect.get(window, 'setAccountEntries')(state), state)
    await expect(page.getByTestId('copy-price-chart')).toHaveCount(0)
    await expect(page.locator('.ctm-symbol b')).toHaveText('—')
  }
  await page.evaluate(() => Reflect.get(window, 'setAccountEntries')('empty'))
  await expect(page.getByTestId('copy-price-chart')).toBeVisible()
  await expect(page.locator('.ctm-symbol b')).toHaveText('COPY/SNAPSHOT')
  await expect(page.locator('.cat-context')).toContainText('복사 차트 출처')
  await page.evaluate(() => Reflect.get(window, 'setAccountEntries')('original'))
  await expect(page.getByTestId('copy-price-chart')).toHaveCount(0)
  await expect(page.locator('.ctm-symbol b')).toHaveText('BTC/USDT')
})

async function mount(page: Page, management = false, marketFallback = false) {
  await page.route('**/account-terminal-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012;color:#e3e3e3;font-family:sans-serif"><div id="fixture"></div></body></html>' }))
  await page.goto('/account-terminal-test.html')
  await page.evaluate(async ({ management, marketFallback }) => {
    for (const font of ['/node_modules/@fontsource-variable/noto-sans-kr/wght.css', '/node_modules/@fontsource-variable/geist/wght.css']) await import(/* @vite-ignore */ font)
    document.body.style.fontFamily = '"Geist Variable", "Noto Sans KR Variable", sans-serif'
    const style = document.createElement('style'); style.textContent = 'input{font:inherit}'; document.head.append(style)
    const refreshPath = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientAccountTerminal.tsx', dp = '/@id/react-dom/client', fp = '/src/dev/chart-workspace-fixture.ts'
    const source = await (await fetch(cp)).text()
    const rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const reactModule = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp), { ClientAccountTerminal } = await import(/* @vite-ignore */ cp), { fixture } = await import(/* @vite-ignore */ fp)
    const preferencesPath = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ preferencesPath)
    Object.assign(window, { accountTerminalSetPreference: setClientPreference })
    const react = reactModule.default ?? reactModule, h = react.createElement
    const changes: (string | null)[] = []
    const makeEntry = (id: string, status: string) => ({ strategy: { id, name: '같은 이름', symbol: id === 'a' ? 'BTC/USDT' : 'ETH/USDT', market: '현물', version: 'v1', status, exchange: { id: 'x', name: 'TEST', color: '#333' }, capitalLabel: '미공급' }, chart: id === 'a' ? fixture : null, agent: h('input', { 'aria-label': 'Agent 초안', defaultValue: id }), dashboard: h('p', null, `${id} 지표`), completed: h('p', null, `${id} 거래`) })
    const original = [makeEntry('a', 'live'), makeEntry('b', 'off')]
    function Host() {
      const [entries, setEntries] = react.useState(original)
      const control = react.useRef(null)
      Object.assign(window, { restoreAccountManagement: () => control.current?.select('a', undefined, true) })
      Object.assign(window, { setAccountStrategyName: (name: string) => setEntries(original.map(entry => ({ ...entry, strategy: { ...entry.strategy, name } }))) })
      Object.assign(window, { setAccountStrategyVersion: (version: string) => setEntries((entries: typeof original) => entries.map(entry => ({ ...entry, strategy: { ...entry.strategy, version } }))) })
      Object.assign(window, { setAccountStatusHeaders: () => setEntries(original.map(entry => ({ ...entry, statusHeader: h('p', { 'data-testid': 'bound-status' }, `${entry.strategy.id} 공급된 상태`) }))) })
      Object.assign(window, { setAccountEntries: (kind: string) => setEntries(kind === 'missing' ? null : kind === 'duplicate' ? [original[0], { ...original[1], strategy: { ...original[1].strategy, id: 'a' } }] : kind === 'removed' ? original.slice(1) : kind === 'empty' ? [] : original), accountChanges: changes })
      return h(ClientAccountTerminal, { entries, emptyMarket: marketFallback ? { symbol: 'COPY/SNAPSHOT', market: '과거 스냅샷', context: '복사 차트 출처', chart: h('p', { 'data-testid': 'copy-price-chart' }, '복사 가격 입력') } : undefined, controlRef: control, management: management ? { label: '복사한 전략 관리', backLabel: '전략 분석으로 돌아가기', content: h('h2', { tabIndex: -1 }, '계정의 복사 목록') } : undefined, onNew: () => {}, onSelectionChange: (id: string | null) => changes.push(id), renderBottom: (id: string, scope: string) => [{ id: 'source', label: '출처', content: h('p', { 'data-testid': 'scope' }, `${id ?? 'none'}:${scope}`) }] })
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  }, { management, marketFallback })
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'a')
  await page.evaluate(async () => { await document.fonts.load('600 12px "Noto Sans KR Variable"', '비트코인 장기 추세 사용자 전략'); await document.fonts.ready })
  await expect(page.locator('.ctt-notice')).toHaveCount(0)
  // A caller without these observations/actions must not inherit preview data.
  await expect(page.locator('.cat-evaluation,.cat-context-tools')).toHaveCount(0)
  expect(await page.locator('.tft-card .nm').first().evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)')
}
async function showPanel(page: Page, name: string) {
  const tabs = page.getByRole('tablist', { name: '터미널 영역', exact: true })
  if (await tabs.isVisible()) await tabs.getByRole('tab', { name: name === 'Agent' || name === '전략' ? '판단' : name, exact: true }).click()
  if (name === '전략' && await page.locator('.ctt-selector-button').getAttribute('aria-expanded') !== 'true') await page.locator('.ctt-selector-button').click()
  if (name !== '전략' && await page.locator('.ctt-selector-button').getAttribute('aria-expanded') === 'true') await page.locator('.ctt-selector-button').click()
}

async function setLanguage(page: Page, language: string) {
  await page.evaluate(code => Reflect.get(window, 'accountTerminalSetPreference')('language', code), language)
}

test('어댑터 상태 머리는 선택에 결속되고 조회 실패 때 숨겨지며 복구 후 초안은 유지한다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => Reflect.get(window, 'setAccountStatusHeaders')())
  await expect(page.getByTestId('bound-status')).toHaveText('a 공급된 상태')
  await expect(page.locator('.cat-tabs button').first()).toHaveText('판단')
  const input = page.getByRole('textbox', { name: 'Agent 초안' })
  await input.fill('보존할 초안')
  const node = await input.elementHandle()
  await page.evaluate(() => Reflect.get(window, 'setAccountEntries')('missing'))
  await expect(page.getByTestId('bound-status')).toHaveCount(0)
  await expect(input).toBeHidden()
  await page.evaluate(() => Reflect.get(window, 'setAccountStatusHeaders')())
  await expect(page.getByTestId('bound-status')).toHaveText('a 공급된 상태')
  await expect(input).toHaveValue('보존할 초안')
  expect(await input.evaluate((el, old) => el === old, node)).toBe(true)
  await showPanel(page, '전략')
  await page.locator('[data-strategy-id=b] .tft-select').click()
  await expect(page.getByTestId('bound-status')).toHaveText('b 공급된 상태')
  await expect(page.getByTestId('bound-status')).not.toContainText('a 공급된 상태')
})

for (const width of [320, 1440]) test(`${width}px 복사 관리·전체화면·복귀는 분석 초안과 canvas를 재생성하지 않는다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 960 }); await mount(page, true)
  await showPanel(page, 'Agent')
  const draft = page.getByRole('textbox', { name: 'Agent 초안' }), canvas = page.locator('.cp-chart canvas').first()
  await draft.fill('내 초안 보존')
  const input = await draft.elementHandle(), chart = await canvas.elementHandle()
  await showPanel(page, '전략')
  await page.getByRole('button', { name: '복사한 전략 관리', exact: true }).click()
  await expect(page.getByRole('heading', { name: '계정의 복사 목록' })).toBeFocused()
  // Deterministic reproduction: identical selected ID and open panel, no parent
  // rerender. A second explicit return still needs a committed focus request.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.locator('.cat-management-back').focus()
    await page.evaluate(() => Reflect.get(window, 'restoreAccountManagement')())
    await expect(page.getByRole('heading', { name: '계정의 복사 목록' })).toBeFocused()
  }
  await expect(draft).toBeHidden()
  await page.locator('.cat-expand').click()
  await expect(page.locator('.ctt-modal')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ctt-modal')).toBeHidden()
  await page.getByRole('button', { name: '전략 분석으로 돌아가기', exact: true }).click()
  await expect(page.locator('.cat-tabs [aria-selected="true"]')).toBeFocused()
  await expect(draft).toHaveValue('내 초안 보존')
  expect(await draft.evaluate((node, original) => node === original, input)).toBe(true)
  expect(await canvas.evaluate((node, original) => node === original, chart)).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'setAccountEntries')('missing'))
  await expect(page.locator('.cat-management-trigger')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'setAccountEntries')('original'))
  await expect(draft).toHaveValue('내 초안 보존')
})

test('계정 터미널 언어 설정은 제목·분석·범위에 함께 반영된다', async ({ page }) => {
  await mount(page)
  await setLanguage(page, 'en')
  await expect(page.locator('.cat-heading h1')).toHaveText('AI trading')
  await expect(page.locator('.cat-tabs')).not.toHaveAttribute('aria-label', /[가-힣]/)
  await expect(page.locator('.cat-scope select')).not.toHaveAttribute('aria-label', /[가-힣]/)
  await expect(page.locator('.cat-context .cat-status')).not.toContainText(/[가-힣]/)
})

for (const width of [320, 1440]) test(`${width}px 계정7언어 전환은 검색·범위·Agent 초안·선택·canvas를 유지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 960 }); await mount(page)
  const requests: string[] = []
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.method()) })
  await showPanel(page, '전략')
  const search = page.locator('.tft-rf input')
  await search.fill('BTC')
  await page.getByLabel('상태 필터').selectOption('live')
  await page.getByLabel('거래소 필터').selectOption('x')
  await showPanel(page, '차트')
  await page.locator('.cat-scope select').selectOption('all')
  await showPanel(page, 'Agent')
  const draft = page.getByRole('textbox', { name: 'Agent 초안' })
  await draft.fill('손절 조건은 내가 정할게요 $& <조건>')
  await draft.press('ArrowLeft')
  const cursor = await draft.evaluate(node => (node as HTMLInputElement).selectionStart)
  const originalInput = await draft.elementHandle(), originalSearch = await search.elementHandle()
  const canvas = page.locator('.cp-chart canvas').first(), originalCanvas = await canvas.elementHandle()
  const originalTab = await page.locator('.cat-tabs [role="tab"]').first().elementHandle()
  for (const language of languages) {
    await setLanguage(page, language)
    const t = (key: Parameters<typeof accountTerminalText>[1]) => accountTerminalText(language, key)
    await expect(page.locator('.cat-heading h1')).toHaveText(shellText(language, 'trading'))
    await expect(page.locator('.cat-expand')).toHaveAccessibleName(t('expandTerminal'))
    await expect(page.locator('.cat-expand span')).toHaveText(t('fullscreen'))
    await expect(page.locator('.cat-tabs')).toHaveAccessibleName(t('analysis'))
    await expect(page.locator('.cat-tabs [role="tab"]')).toHaveText([t('agent'), t('dashboard'), t('completed')])
    // Source 17d keeps the ledger visible beside/before judgment at every width.
    await expect(page.locator('.cat-scope select')).toHaveAttribute('aria-label', t('scope'))
    await expect(page.locator('.cat-scope select')).toHaveAccessibleName(t('scope'))
    await expect(page.locator('.cat-scope select')).toHaveValue('all')
    await expect(page.locator('.cat-scope option')).toHaveText([t('current'), t('all')])
    await expect(page.locator('.cat-brain > header .cat-status')).toHaveText(t('live'))
    await expect(page.locator('.cat-context .cat-status')).toHaveText(t('live'))
    await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'a')
    await expect(page.getByTestId('scope')).toHaveText('a:all')
    await expect(search).toHaveValue('BTC')
    await expect(page.locator('.tft-rf select').nth(0)).toHaveValue('live')
    await expect(page.locator('.tft-rf select').nth(1)).toHaveValue('x')
    await expect(draft).toHaveValue('손절 조건은 내가 정할게요 $& <조건>')
    await expect(draft).toBeFocused()
    expect(await draft.evaluate(node => (node as HTMLInputElement).selectionStart)).toBe(cursor)
    for (const [locator, original] of [[draft, originalInput], [search, originalSearch], [canvas, originalCanvas], [page.locator('.cat-tabs [role="tab"]').first(), originalTab]] as const)
      expect(await locator.evaluate((node, previous) => node === previous, original)).toBe(true)
    for (const tab of await page.locator('.cat-tabs [role="tab"]').all()) {
      const box = await tab.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
      expect(await tab.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    }
    expect(await page.evaluate(() => Reflect.get(window, 'accountChanges'))).toEqual(['a'])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath(`account-locale-fr-${width}.png`) })
  const mainTabs = page.locator('.ctt-main-tabs')
  if (width <= 960) {
    await expect(mainTabs).toBeHidden()
    await expect(page.locator('.ctt-market')).toBeVisible()
    await expect(page.locator('.ctt-detail')).toBeVisible()
    await expect(page.locator('.cat-scope select')).toHaveAccessibleName(accountTerminalText('fr', 'scope'))
  }
  const expand = page.locator('.cat-expand')
  await expand.click()
  await expect(page.getByRole('dialog')).toHaveAccessibleName(shellText('fr', 'trading'))
  await page.keyboard.press('Escape')
  await expect(expand).toBeFocused()
  await expect(draft).toHaveValue('손절 조건은 내가 정할게요 $& <조건>')
  expect(await canvas.evaluate((node, previous) => node === previous, originalCanvas)).toBe(true)
  const tabs = page.locator('.cat-tabs')
  await tabs.getByRole('tab').first().focus()
  await page.keyboard.press('End')
  await expect(tabs.getByRole('tab').last()).toBeFocused()
  await expect(tabs.getByRole('tab').last()).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Home')
  await expect(draft).toHaveValue('손절 조건은 내가 정할게요 $& <조건>')
  expect(requests).toEqual([])
  for (const handle of [originalInput, originalSearch, originalCanvas, originalTab]) await handle?.dispose()
})

for (const state of ['missing', 'duplicate', 'empty']) test(`계정 ${state} 안내는7언어에서도 미공급/오류/빈목록을 구분한다`, async ({ page }) => {
  await mount(page)
  await page.evaluate(kind => Reflect.get(window, 'setAccountEntries')(kind), state)
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', '')
  const changes = await page.evaluate(() => Reflect.get(window, 'accountChanges'))
  for (const language of languages) {
    await setLanguage(page, language)
    await expect(page.locator('.cat-context')).toHaveText(accountTerminalText(language, state === 'empty' ? 'selectContext' : 'unavailable'))
    await expect(page.locator('.tft-empty b')).toHaveText(accountTerminalText(language, state === 'empty' ? 'empty' : 'unavailable'))
    if (state === 'empty') {
      await expect(page.locator('.tft-empty span')).toHaveText(accountTerminalText(language, 'emptyHint'))
      await expect(page.locator('.tft-empty button')).toHaveText(accountTerminalText(language, 'create'))
      await expect(page.locator('.cat-brain > section .cat-empty')).toHaveText(Array(3).fill(accountTerminalText(language, 'selectAnalysis')))
    } else {
      await expect(page.locator('.ctt-chart [role=tabpanel] > .cat-empty')).toHaveText(accountTerminalText(language, 'unavailable'))
      await expect(page.locator('.cat-brain > .cat-empty')).toHaveText(accountTerminalText(language, 'unavailable'))
    }
    if (state === 'duplicate') await expect(page.getByRole('alert')).toHaveText(accountTerminalText(language, 'invalidIds'))
    else await expect(page.getByRole('alert')).toHaveCount(0)
    expect(await page.evaluate(() => Reflect.get(window, 'accountChanges'))).toEqual(changes)
    await expect(page.locator('.tft-card')).toHaveCount(0)
  }
  await page.evaluate(() => Reflect.get(window, 'setAccountEntries')('restore'))
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'a')
})

for (const width of [320, 844, 1440]) test(`${width}px 긴 Agent 제목이 버전·상태·분석 탭을 밀어내지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 740 }); await mount(page)
  const name = '비트코인 장기 추세와 리스크를 함께 검증하는 사용자 전략 '.repeat(8)
  await page.evaluate(name => Reflect.get(window, 'setAccountStrategyName')(name), name)
  await showPanel(page, 'Agent')
  const header = page.locator('.cat-brain>header'), label = header.locator('b')
  await expect(label).toHaveAttribute('title', name)
  await expect(label).toHaveText(name)
  const geometry = await header.evaluate(element => {
    const label = element.querySelector('b')!, version = element.querySelector('small')!, status = element.querySelector('.cat-status')!
    const rect = label.getBoundingClientRect(), style = getComputedStyle(label)
    // The isolated page can inherit `normal`; do not compare geometry to NaN.
    const parsedLine = parseFloat(style.lineHeight), line = Number.isFinite(parsedLine) ? parsedLine : parseFloat(style.fontSize) * 1.6
    return { height: rect.height, line, right: rect.right, versionLeft: version.getBoundingClientRect().left,
      statusRight: status.getBoundingClientRect().right, headerRight: element.getBoundingClientRect().right }
  })
  expect(geometry.height).toBeLessThanOrEqual(geometry.line + 1)
  expect(geometry.right).toBeLessThanOrEqual(geometry.versionLeft)
  expect(geometry.statusRight).toBeLessThanOrEqual(geometry.headerRight)
  await page.getByRole('tablist', { name: '전략 분석' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('tablist', { name: '전략 분석' })).toBeInViewport()
  await page.getByRole('textbox', { name: 'Agent 초안' }).fill('읽고 있던 전략의 입력')
  await page.getByRole('tab', { name: '대시보드', exact: true }).click()
  await page.getByRole('tablist', { name: '전략 분석' }).getByRole('tab', { name: 'Agent', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Agent 초안' })).toHaveValue('읽고 있던 전략의 입력')
  await page.screenshot({ path: info.outputPath(`agent-heading-${width}.png`) })
})

for (const width of [320, 844, 1440]) test(`${width}px 원본 전략명 우선 표시는 한 줄로 유지하고 전체 이름은 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 }); await mount(page)
  const name = '비트코인 장기 추세와 리스크를 함께 검증하는 사용자 전략 '.repeat(4)
  await page.evaluate(name => Reflect.get(window, 'setAccountStrategyName')(name), name)
  await showPanel(page, '차트')
  const label = page.locator('.cat-context .cat-strategy-name')
  await expect(label).toHaveAttribute('title', `${name} v1`)
  const geometry = await label.evaluate(node => { const style = getComputedStyle(node), rect = node.getBoundingClientRect(); return {
    width: rect.width, height: rect.height, line: parseFloat(style.lineHeight), left: rect.left, right: rect.right,
    shrink: style.flexShrink, overflow: style.textOverflow, whiteSpace: style.whiteSpace, color: style.color,
  } })
  expect(geometry.width).toBeLessThanOrEqual(240)
  expect(geometry.height).toBeLessThanOrEqual(geometry.line + 1)
  expect(geometry.left).toBeGreaterThanOrEqual(0); expect(geometry.right).toBeLessThanOrEqual(width)
  expect(geometry.shrink).toBe('0'); expect(geometry.overflow).toBe('ellipsis'); expect(geometry.whiteSpace).toBe('nowrap')
  expect(geometry.color).toBe('rgb(255, 255, 255)')
  await expect(page.locator('.cat-context .cat-status')).toBeVisible()
  await page.screenshot({ path: info.outputPath(`strategy-name-${width}.png`) })
})

test('긴 버전도 Agent 상태 배지를 밀어내지 않고 전체 원문은 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await mount(page)
  const version = 'v2026.09.15-candidate-projection-identifier'
  await page.evaluate(version => Reflect.get(window, 'setAccountStrategyVersion')(version), version)
  await showPanel(page, 'Agent')
  const header = page.locator('.cat-brain>header')
  await expect(header.locator('small')).toHaveAttribute('title', version)
  await expect(header.locator('small')).toHaveText(version)
  const geometry = await header.evaluate(element => {
    const version = element.querySelector('small')!.getBoundingClientRect(), status = element.querySelector('.cat-status')!.getBoundingClientRect()
    return { versionRight: version.right, statusLeft: status.left, statusRight: status.right, right: element.getBoundingClientRect().right, overflow: element.scrollWidth - element.clientWidth }
  })
  expect(geometry.versionRight).toBeLessThanOrEqual(geometry.statusLeft)
  expect(geometry.statusRight).toBeLessThanOrEqual(geometry.right)
  expect(geometry.overflow).toBeLessThanOrEqual(1)
})

test('일시적 정보 누락을 선택 전 상태로 안내하지 않고 같은 전략으로 복구한다', async ({ page }) => {
  await mount(page); await showPanel(page, '차트')
  await page.evaluate(() => Reflect.get(window, 'setAccountEntries')('missing'))
  await expect(page.locator('.cat-context')).toHaveText('전략 정보를 확인하지 못했습니다.')
  await expect(page.locator('.cat-context-tools,.cat-evaluation')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'setAccountEntries')('restore'))
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'a')
  await expect(page.locator('.cat-context')).toContainText('BTC/USDT')
})

test('동명 전략 ID 선택은 차트/Agent/하단 범위를 함께 전환하고 타 자산에 이전 가격을 남기지 않는다', async ({ page }) => {
  await mount(page)
  await expect(page.locator('.cp-chart canvas').first()).toBeVisible()
  await showPanel(page, '전략')
  await page.locator('[data-strategy-id="b"] .tft-select').click()
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'b')
  await showPanel(page, 'Agent')
  await expect(page.getByRole('textbox', { name: 'Agent 초안' })).toHaveValue('b')
  await showPanel(page, '차트')
  await expect(page.locator('.cp-empty')).toContainText('검증된 가격 데이터를 기다리고 있습니다.')
  await expect(page.locator('.cp-chart canvas')).toHaveCount(0)
  await expect(page.getByTestId('scope')).toHaveText('b:current')
  await page.getByRole('combobox', { name: '데이터 범위' }).selectOption('all')
  await expect(page.getByTestId('scope')).toHaveText('b:all')
})

test('누락 응답은 선택을 보존하고 실제 삭제 후 복귀에는 삭제된 ID가 선택을 탈취하지 않는다', async ({ page }) => {
  await mount(page)
  await showPanel(page, 'Agent')
  await page.getByRole('textbox', { name: 'Agent 초안' }).fill('연결 복구 후 이어갈 초안')
  await page.evaluate(() => (window as unknown as { setAccountEntries: (kind: string) => void }).setAccountEntries('missing'))
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', '')
  await expect(page.getByRole('textbox', { name: 'Agent 초안' })).toHaveCount(0)
  await page.evaluate(() => (window as unknown as { setAccountEntries: (kind: string) => void }).setAccountEntries('restore'))
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'a')
  await expect(page.getByRole('textbox', { name: 'Agent 초안' })).toHaveValue('연결 복구 후 이어갈 초안')
  await page.evaluate(() => (window as unknown as { setAccountEntries: (kind: string) => void }).setAccountEntries('removed'))
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'b')
  await page.evaluate(() => (window as unknown as { setAccountEntries: (kind: string) => void }).setAccountEntries('restore'))
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'b')
  await page.evaluate(() => (window as unknown as { setAccountEntries: (kind: string) => void }).setAccountEntries('empty'))
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', '')
  expect(await page.evaluate(() => (window as unknown as { accountChanges: unknown[] }).accountChanges)).toEqual(['a', 'b', null])
})

test('중복 전략 식별자는 잘못된 차트 선택 대신 명시 오류로 차단하고 정상 목록 복구 가능', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => (window as unknown as { setAccountEntries: (kind: string) => void }).setAccountEntries('duplicate'))
  await expect(page.getByRole('alert')).toHaveText('전략 식별자가 중복되거나 비어 있어 표시할 수 없습니다.')
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', '')
  await expect(page.locator('.cp-chart canvas').first()).toBeHidden()
  await expect(page.locator('[data-strategy-id]')).toHaveCount(0)
  await page.evaluate(() => (window as unknown as { setAccountEntries: (kind: string) => void }).setAccountEntries('restore'))
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'a')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.cp-chart canvas').first()).toBeVisible()
})

test('전체화면 왕복·Agent 탭 변경에도 차트 canvas와 작성 중인 입력 유지', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => Object.assign(window, { accountCanvas: document.querySelector('.cp-chart canvas') }))
  await showPanel(page, 'Agent')
  await page.getByRole('textbox', { name: 'Agent 초안' }).fill('아직 전송하지 않은 조건')
  const tabs = page.getByRole('tablist', { name: '전략 분석' })
  await tabs.getByRole('tab', { name: 'Agent', exact: true }).focus()
  await page.keyboard.press('End')
  await expect(tabs.getByRole('tab', { name: '완료된 거래' })).toBeFocused()
  await page.keyboard.press('Home')
  await expect(page.getByRole('textbox', { name: 'Agent 초안' })).toHaveValue('아직 전송하지 않은 조건')
  await page.getByRole('button', { name: '터미널 전체화면' }).click()
  await expect(page.getByRole('dialog', { name: 'AI 트레이딩' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Agent 초안' })).toHaveValue('아직 전송하지 않은 조건')
  expect(await page.evaluate(() => (window as unknown as { accountCanvas: Element }).accountCanvas === document.querySelector('.cp-chart canvas'))).toBe(true)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('검수 페이지는 독립 주소이며 320/860/1440px 문서 가로넘침과 오류가 없다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/account-terminal-preview.html')
  for (const width of [320, 860, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.locator('.client-account-terminal')).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  }
  expect(errors).toEqual([])
})
