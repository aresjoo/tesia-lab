import { expect, test, type Page } from '@playwright/test'

async function openBrokers(page: Page) {
  // Catalogue component checks must not restore the retired public menu route.
  // The real public menu now opens the connection plan; Native routing has its
  // own source-surface-parity tests with recorded service responses.
  await page.route('**/broker-catalogue-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="fixture"></div></body></html>' }))
  await page.goto('/broker-catalogue-test.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/components/ClientResearchHub.tsx', source = await (await fetch(path)).text()
    const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ reactPath), React = rm.default ?? rm, domPath = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */ domPath)
    const { ClientResearchHub } = await import(/* @vite-ignore */ path)
    for (const css of ['/src/styles.css', '/src/client-reference.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css']) await import(/* @vite-ignore */ css)
    document.body.style.fontFamily = '"Noto Sans KR Variable", sans-serif'
    function Host() {
      const [request, setRequest] = React.useState(0)
      Object.assign(window, { brokerCatalogueList: () => setRequest((value: number) => value + 1) })
      return React.createElement(ClientResearchHub, { page: 'brokers', records: [], brokerServices: { authenticated: true }, brokerListRequest: request, onSelect: () => {}, onNew: () => {}, onFollow: () => {}, onReturn: () => {} })
    }
    ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('fixture')).render(React.createElement(React.StrictMode, null, React.createElement(Host)))
  })
  await expect(page.getByRole('heading', { name: '연결하면, 실행됩니다' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}
async function detail(page: Page, name = 'Binance') {
  await page.getByRole('button', { name: name + ' 자세히', exact: true }).click()
  await expect(page.locator('.bk2-head h2')).toHaveText(name)
}

test('현재 공개 지원 거래소 메뉴는 구 카탈로그가 아니라 원본 연결 플랜으로 이어진다', async ({ page }) => {
  const mutations: string[] = []
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.url()) })
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수자', email: 'review@example.test' })))
  await page.goto('/')
  const menu = page.locator('.client-sidebar').getByRole('button', { name: '거래소 연결', exact: true })
  if (!await menu.isVisible()) await page.locator('.client-hamburger:visible, .client-rail-logo-row button:visible').first().click()
  await menu.click()
  await expect(page.getByTestId('connection-plan')).toBeVisible()
  await expect(page.getByRole('heading', { name: '거래소 연결', exact: true })).toBeVisible()
  await expect(page.locator('.bk2-page')).toHaveCount(0)
  expect(mutations).toEqual([])
})
async function sortBy(page: Page, label: string, option: string) {
  await page.getByRole('button', { name: new RegExp(`^${label}:`) }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
  await expect(page.getByRole('listbox', { name: label })).toHaveCount(0)
}

// Isolated caller seam: the actual component invokes only a supplied local callback.
// No external account/provider/API is opened by this fixture.
async function mountBrokerAccountCaller(page: Page) {
  await page.route('**/broker-account-caller-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012;color:#e3e3e3"><main id="research-main"><div id="fixture"></div></main></body></html>' }))
  await page.goto('/broker-account-caller-test.html')
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh', componentPath = '/src/components/ClientBrokers.tsx', domPath = '/@id/react-dom/client'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const source = await (await fetch(componentPath)).text()
    const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ reactPath), dm = await import(/* @vite-ignore */ domPath)
    const { ClientBrokers } = await import(/* @vite-ignore */ componentPath), react = rm.default ?? rm
    for (const fontPath of ['/node_modules/@fontsource-variable/geist/index.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/node_modules/@fontsource-variable/noto-sans-sc/index.css', '/src/client-reference.css']) await import(/* @vite-ignore */ fontPath)
    document.body.style.fontFamily = '"Noto Sans KR Variable", "Noto Sans SC Variable", "Geist Variable", sans-serif'
    const state = { calls: [] as string[], generation: 1, listRequest: 0, available: true }
    const root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture'))
    const render = () => {
      const generation = state.generation
      root.render(react.createElement(ClientBrokers, { onTitleChange: () => {}, listRequest: state.listRequest,
        onOpenAccount: state.available ? (id: string) => { state.calls.push(`${generation}:${id}`) } : undefined,
      }))
    }
    Object.assign(window, { brokerCaller: state, patchBrokerCaller: (patch: object) => { Object.assign(state, patch); render() } })
    render()
  })
  await expect(page.getByRole('heading', { name: '연결하면, 실행됩니다' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

test('프로모 배너는 흰색 혜택 CTA만 유지하고 계정 개설은 설명 하단으로 옮긴다', async ({ page, context }, info) => {
  const mutations: string[] = []
  page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) mutations.push(request.url()) })
  await openBrokers(page)
  await expect(page.locator('.bk2-card[aria-label="Binance"] .bt').getByRole('button', { name: '계정 개설 ↗', exact: true })).toHaveCount(1)
  await detail(page)
  const banner = page.locator('.bk2-promo'), trigger = banner.getByRole('button', { name: '혜택 자세히', exact: true })
  await expect(banner.getByRole('button')).toHaveCount(1)
  await expect(trigger).toHaveClass('wbtn')
  await expect(page.locator('.bk2-head').getByRole('button', { name: '계정 개설 ↗', exact: true })).toHaveCount(1)
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(() => document.fonts.ready)
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Binance 파트너 혜택', exact: true })
    const action = dialog.getByRole('button', { name: 'Binance 계정 개설 ↗', exact: true })
    await expect(dialog.locator('.tfbk-dialog-body > :last-child')).toHaveText('Binance 계정 개설 ↗')
    await expect(dialog).toContainText('현재 화면만으로 무료 자격이나 계정 연결이 생성되지 않습니다.')
    const layout = await action.evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, scroll: el.scrollWidth, client: el.clientWidth, background: getComputedStyle(el).backgroundColor }))
    const bodyWidth = await dialog.locator('.tfbk-dialog-body').evaluate(el => el.clientWidth - parseFloat(getComputedStyle(el).paddingLeft) - parseFloat(getComputedStyle(el).paddingRight))
    expect(layout.width).toBeCloseTo(bodyWidth, 0)
    expect(layout.height).toBeGreaterThanOrEqual(48)
    expect(layout.scroll).toBeLessThanOrEqual(layout.client + 1)
    expect(layout.background).toBe('rgb(255, 255, 255)')
    expect(await dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
    await dialog.screenshot({ path: info.outputPath(`promo-dialog-${width}.png`) })
    await action.focus()
    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await banner.screenshot({ path: info.outputPath(`promo-banner-${width}.png`) })
  }
  await trigger.click()
  await page.getByRole('button', { name: 'Binance 계정 개설 ↗', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '계정 개설', exact: true })).toContainText('새 계정이나 연결은 생성되지 않았어요')
  await expect(page.locator('.bk2-promo-account')).toHaveCount(0)
  expect(mutations).toEqual([])
  expect(context.pages()).toHaveLength(1)
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

test('프로모 계정 CTA는 현재 거래소·최신 caller에만 결속되고 다른 안내에 남지 않는다', async ({ page }) => {
  await mountBrokerAccountCaller(page)
  const calls = () => page.evaluate(() => Reflect.get(window, 'brokerCaller').calls)
  const patch = (value: object) => page.evaluate(value => Reflect.get(window, 'patchBrokerCaller')(value), value)
  await detail(page)
  const trigger = page.getByRole('button', { name: '혜택 자세히', exact: true })
  await trigger.click()
  expect(await calls()).toEqual([])
  await patch({ generation: 2 })
  await page.getByRole('button', { name: 'Binance 계정 개설 ↗', exact: true }).click()
  expect(await calls()).toEqual(['2:binance'])
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await page.locator('.bk2-bc').getByRole('button', { name: '지원 거래소', exact: true }).click()
  await detail(page, 'OKX')
  await trigger.click()
  await expect(page.getByRole('button', { name: 'Binance 계정 개설 ↗', exact: true })).toHaveCount(0)
  const okxAction = page.getByRole('button', { name: 'OKX 계정 개설 ↗', exact: true })
  await okxAction.focus()
  await page.keyboard.press('Enter')
  expect(await calls()).toEqual(['2:binance', '2:okx'])
  await patch({ listRequest: 1 })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.bk2-promo-account')).toHaveCount(0)
  await detail(page, 'WOO X')
  await trigger.click()
  await patch({ available: false })
  await page.getByRole('button', { name: 'WOO X 계정 개설 ↗', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '계정 개설', exact: true })).toBeVisible()
  await expect(page.locator('.bk2-promo-account')).toHaveCount(0)
  expect(await calls()).toEqual(['2:binance', '2:okx'])
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'TETH로 연결', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'TETH로 연결', exact: true })).toBeVisible()
  await expect(page.locator('.bk2-promo-account')).toHaveCount(0)
})

for (const external of [false, true]) test(`거래소 안내의 스크롤 잠금은 ${external ? '다른 소유자의 새 잠금' : '원래 CSS 우선순위'}를 보존한다`, async ({ page }) => {
  await openBrokers(page)
  await detail(page)
  const scroll = page.locator('#research-main')
  await scroll.evaluate(el => el.style.setProperty('overflow-y', 'scroll', 'important'))
  await page.locator('.bk2-head').getByRole('button', { name: '계정 개설 ↗', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '계정 개설', exact: true })
  await expect(dialog).toBeVisible()
  if (external) await scroll.evaluate(el => el.style.setProperty('overflow-y', 'hidden', 'important'))
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(await scroll.evaluate(el => ({ value: el.style.getPropertyValue('overflow-y'), priority: el.style.getPropertyPriority('overflow-y') })))
    .toEqual({ value: external ? 'hidden' : 'scroll', priority: 'important' })
})

test('리뷰 카드는 별점·내용·작성일을 접근 가능한 설명으로 제공한다', async ({ page }) => {
  await openBrokers(page)
  await detail(page)
  const card = page.locator('.bk2-rvrow .bk2-rvc').first()
  const rating = await card.locator('.bk2-stars').getAttribute('aria-label')
  const text = await card.locator('p').innerText()
  const by = await card.locator('.by').innerText()
  await expect(card).toHaveAccessibleDescription(`${rating} ${text} ${by}`)
  await expect(card).toHaveAttribute('aria-haspopup', 'dialog')
  await card.click()
  await expect(page.getByRole('dialog', { name: '리뷰', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(card).toBeFocused()
})

test('짧은 리뷰 모달은 화면을 채우지 않고 내용 높이에 맞춘다', async ({ page }, info) => {
  await openBrokers(page)
  await detail(page)
  await page.locator('.bk2-rvrow .bk2-rvc').first().click()
  const dialog = page.getByRole('dialog', { name: '리뷰', exact: true })
  await expect(dialog).toBeVisible()
  const unusedHeight = await dialog.evaluate(el => el.clientHeight
    - el.querySelector<HTMLElement>('header')!.offsetHeight
    - el.querySelector<HTMLElement>('.tfbk-dialog-body')!.offsetHeight)
  expect(unusedHeight).toBeLessThanOrEqual(4)
  const bounds = await dialog.boundingBox()
  expect(bounds!.y).toBeGreaterThanOrEqual(12)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height - 12)
  await dialog.screenshot({ path: info.outputPath('compact-review.png') })
  // Stress only layout; no synthetic content is published or sent to a service.
  await dialog.locator('.bk2-full-review').evaluate(el => { el.textContent = '긴 리뷰 내용입니다. '.repeat(300) })
  const longBounds = await dialog.boundingBox()
  expect(longBounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height - 24)
  await expect.poll(() => dialog.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0)
  await dialog.evaluate(el => { el.scrollTop = el.scrollHeight })
  await expect.poll(() => dialog.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('bk2 원본 21종 기본 순서·리뷰·사용자 정렬과 6개 유형 필터', async ({ page }) => {
  await openBrokers(page)
  const cards = page.locator('.bk2-card')
  await expect(cards).toHaveCount(21)
  await expect(cards.first()).toHaveAttribute('aria-label', 'Binance')
  await expect(cards.locator('.bk2-stack img')).toHaveCount(63)
  await expect(page.getByText('1,247,306', { exact: true })).toHaveCount(0)
  await sortBy(page, '거래소 정렬', '최다 리뷰')
  await expect(cards.first()).toHaveAttribute('aria-label', 'Binance')
  await sortBy(page, '거래소 정렬', '최다 사용자')
  await expect(cards.nth(2)).toHaveAttribute('aria-label', 'Bitget')
  for (const [name, count] of [['증권사', 5], ['연결 지원', 6], ['지원 예정', 15], ['거래소', 8], ['브로커', 8], ['전체', 21]] as const) {
    await page.locator('.bk2-bar').getByRole('button', { name, exact: true }).click()
    await expect(cards).toHaveCount(count)
  }
  await expect.poll(() => cards.first().locator('img').first().evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
})

test('6개 거래소 고유 자산·문서·FAQ와 상세 왕복 초점 복원', async ({ page }) => {
  await openBrokers(page)
  for (const name of ['Binance', 'OKX', 'WOO X', '업비트', 'Bybit', '키움증권']) {
    await detail(page, name)
    await expect(page.locator('.bk2-head h2')).toBeFocused()
    await expect(page.locator('#research-title')).toHaveText(name)
    await expect(page.locator('.bk2-faq .q')).toHaveCount(8)
    await expect(page.getByRole('link', { name: '공식 문서 ↗' })).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(page.getByRole('button', { name: /팔로우|팔로잉/ })).toHaveCount(0)
    const q = page.getByRole('button', { name: '어떤 권한이 필요한가요?' })
    await q.click()
    await expect(q).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText('조회와 거래 권한만 사용해요. API 생성 시 출금 권한은 켜지 마세요.', { exact: true })).toBeVisible()
    if (name === '업비트') await expect(page.locator('.bk2-feat .fr').filter({ hasText: '스톱 주문' }).locator('i')).toHaveAttribute('aria-label', '지원하지 않음')
    if (name === 'OKX') await expect(page.locator('.bk2-feat .fr').filter({ hasText: 'OCO 주문' })).toHaveCount(0)
    await page.locator('.bk2-bc').getByRole('button', { name: '지원 거래소' }).click()
    await expect(page.getByRole('button', { name, exact: true })).toBeFocused()
  }
})

test('카탈로그 재진입 요청은 목록으로 돌아가고 직접 뒤로가기는 필터와 읽던 위치를 보존한다', async ({ page }) => {
  await openBrokers(page)
  await sortBy(page, '거래소 정렬', '최다 리뷰')
  await page.locator('.bk2-bar').getByRole('button', { name: '거래소', exact: true }).click()
  const target = page.getByRole('button', { name: 'Bybit 자세히', exact: true })
  await target.scrollIntoViewIfNeeded()
  const position = await page.locator('#research-main').evaluate(el => el.scrollTop)
  await detail(page, 'Bybit')
  await page.locator('.bk2-bc').getByRole('button', { name: '지원 거래소', exact: true }).click()
  await expect(page.getByRole('button', { name: '거래소 정렬: 최다 리뷰', exact: true })).toBeVisible()
  await expect(page.locator('.bk2-bar').getByRole('button', { name: '거래소', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => page.locator('#research-main').evaluate(el => el.scrollTop)).toBeCloseTo(position, 0)
  await expect(page.getByRole('button', { name: 'Bybit', exact: true })).toBeFocused()

  await detail(page, 'Bybit')
  await page.evaluate(() => Reflect.get(window, 'brokerCatalogueList')())
  await expect(page.locator('.bk2-head')).toHaveCount(0)
  await expect(page.locator('.bk2-card')).toHaveCount(8)
  await expect(page.getByRole('button', { name: '거래소 정렬: 최다 리뷰', exact: true })).toBeVisible()
  await expect(page.locator('.bk2-bar').getByRole('button', { name: '거래소', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#research-title')).toHaveText('지원 거래소')
  await expect(page.locator('#research-title')).toBeFocused()
  await expect.poll(() => page.locator('#research-main').evaluate(el => el.scrollTop)).toBe(0)
})

test('리뷰44개·9개 페이지 슬라이스·정렬과 카테고리 변경 페이지 리셋', async ({ page }) => {
  await openBrokers(page)
  await detail(page)
  await page.getByRole('tab', { name: '개요', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: '리뷰', exact: true })).toBeFocused()
  await sortBy(page, '리뷰 정렬', '최신순')
  const rows = page.locator('.bk2-rvgrid .bk2-rvc')
  await expect(rows).toHaveCount(9)
  await expect(rows.first()).toContainText('minsu_k, 9월 8일')
  await page.getByRole('button', { name: '다음 페이지', exact: true }).click()
  await expect(rows.first()).toContainText('nightowl')
  await page.getByRole('navigation', { name: '리뷰 페이지' }).getByRole('button', { name: '5', exact: true }).click()
  await expect(rows).toHaveCount(8)
  await expect(page.getByRole('button', { name: '다음 페이지', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '모바일', exact: true }).click()
  await expect(rows).toHaveCount(5)
  await expect(page.getByRole('navigation', { name: '리뷰 페이지' })).toHaveCount(0)
  await rows.first().click()
  const modal = page.getByRole('dialog', { name: '리뷰', exact: true })
  await expect(modal).toBeVisible()
  await expect(modal.getByRole('button', { name: '닫기', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(modal.getByRole('button', { name: '닫기', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(rows.first()).toBeFocused()
})

test('별점 키보드·8자검사·취소확인·미연결 제출에서 성공을 합성하지 않는다', async ({ page }) => {
  const mutations: string[] = []
  page.on('request', r => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method())) mutations.push(r.url()) })
  await openBrokers(page)
  await detail(page)
  await page.getByRole('tab', { name: '리뷰', exact: true }).click()
  await page.getByRole('button', { name: '리뷰 남기기', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Binance에 대해 다른 사람들과 의견 나누기' })
  await expect(modal).toBeVisible()
  await expect(modal.getByRole('button', { name: '별점을 선택해주세요' })).toBeDisabled()
  await modal.getByRole('radio', { name: '1점', exact: true }).focus()
  await page.keyboard.press('End')
  await expect(modal.getByRole('radio', { name: '5점', exact: true })).toHaveAttribute('aria-checked', 'true')
  const input = modal.getByRole('textbox', { name: '리뷰 내용' })
  await expect(input).toHaveAttribute('placeholder', /어떤 점이 특히 좋았나요/)
  await input.fill('좋아요')
  await expect(modal.getByRole('button', { name: '조금 더 알려주세요' })).toBeDisabled()
  await input.fill('연결 과정과 안내가 이해하기 쉬웠어요.')
  await page.keyboard.press('Escape')
  const confirm = page.getByRole('dialog', { name: '작성 중인 리뷰를 지울까요?' })
  await expect(confirm).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(confirm).toHaveCount(0)
  await expect(input).toHaveValue('연결 과정과 안내가 이해하기 쉬웠어요.')
  await modal.getByRole('button', { name: '리뷰 남기기', exact: true }).click()
  await expect(modal.getByRole('alert')).toContainText('전송되지 않았어요')
  await expect(input).toHaveValue('연결 과정과 안내가 이해하기 쉬웠어요.')
  expect(mutations).toEqual([])
  await modal.getByRole('button', { name: '취소', exact: true }).click()
  await confirm.getByRole('button', { name: '삭제', exact: true }).click()
  await expect(modal).toHaveCount(0)
  await expect(page.getByRole('button', { name: '리뷰 남기기', exact: true })).toBeFocused()
})

test('지원 거래소 연결·계정 개설은 서비스 없이 요청과 계정생성을 하지 않는다', async ({ page, context }) => {
  await openBrokers(page)
  await detail(page)
  await page.getByRole('button', { name: 'TETH로 연결', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAccessibleName('Binance 연결에는 플랜이 필요해요')
  await expect(dialog).toContainText('결제와 연동은 시뮬레이션이에요')
  await expect(dialog.getByRole('button', { name: '무료로 연동하기', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await page.locator('.bk2-head').getByRole('button', { name: '계정 개설 ↗' }).click()
  await expect(dialog).toContainText('새 계정이나 연결은 생성되지 않았어요')
  expect(context.pages()).toHaveLength(1)
})

test('320·390·768·1024·1440px에서 필터 접근·본문 넘침·버튼 겹침이 없다', async ({ page }) => {
  await openBrokers(page)
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.locator('.bk2-card').first()).toBeVisible()
    const overflow = await page.locator('.bk2-page').evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth }))
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.width + 1)
    const buttons = page.locator('.bk2-card[aria-label="Binance"] .bt button')
    const a = await buttons.nth(0).boundingBox(), b = await buttons.nth(1).boundingBox()
    expect(a).not.toBeNull(); expect(b).not.toBeNull()
    expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x + 1)
  }
})

for (const route of ['#/about', '/about/']) test(`개요 캐러셀 끝 상태와 감소 모션, ${route} 이탈 모달 정리`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openBrokers(page)
  await detail(page)
  // Mobile source intentionally uses swipe only; hidden arrows still track boundaries.
  await expect(page.locator('.bk2-arw.l')).toBeDisabled()
  await page.locator('.bk2-rvrow').evaluate(el => { el.scrollLeft = el.scrollWidth; el.dispatchEvent(new Event('scroll')) })
  await expect(page.locator('.bk2-arw.r')).toBeDisabled()
  await page.locator('.bk2-rvrow .bk2-rvc').last().click()
  await expect(page.getByRole('dialog', { name: '리뷰', exact: true })).toBeVisible()
  await page.evaluate(route => { history.pushState({}, '', route); dispatchEvent(new PopStateEvent('popstate')) }, route)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

for (const route of ['#/about', '/about/']) test(`작성 중 취소확인 중첩 모달도 ${route} 이동 시 함께 정리한다`, async ({ page }) => {
  await openBrokers(page)
  await detail(page)
  await page.getByRole('tab', { name: '리뷰', exact: true }).click()
  await page.getByRole('button', { name: '리뷰 남기기', exact: true }).click()
  await page.getByRole('radio', { name: '3점', exact: true }).click()
  await page.getByRole('textbox', { name: '리뷰 내용' }).fill('연결 안내가 이해하기 쉬웠어요.')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '작성 중인 리뷰를 지울까요?' })).toBeVisible()
  await page.evaluate(route => { history.pushState({}, '', route); dispatchEvent(new PopStateEvent('popstate')) }, route)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('dialog[open]')).toHaveCount(0)
})

test('320px 낮은 화면의 후기 작성 폼에서도 취소 버튼까지 스크롤할 수 있다', async ({ page }) => {
  await openBrokers(page)
  await detail(page)
  await page.getByRole('tab', { name: '리뷰', exact: true }).click()
  await page.getByRole('button', { name: '리뷰 남기기', exact: true }).click()
  await page.setViewportSize({ width: 320, height: 320 })
  const dialog = page.getByRole('dialog', { name: 'Binance에 대해 다른 사람들과 의견 나누기' })
  const cancel = dialog.getByRole('button', { name: '취소', exact: true })
  await cancel.scrollIntoViewIfNeeded()
  await expect(cancel).toBeInViewport()
  await cancel.click()
  await expect(dialog).toHaveCount(0)
})
