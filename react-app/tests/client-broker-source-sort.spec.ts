import { expect, test, type Page } from '@playwright/test'
import { CLIENT_BROKERS, brokerReviews, filterBrokers } from '../src/client-broker-fixtures'

// Source 621cbed T1/T5 presentation only. Callback counters are test seams,
// never evidence of provider/account/review/payment authority.
async function mount(page: Page) {
  const requests: string[] = [], errors: string[] = []
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method()) || new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.url()) })
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/broker-source-sort-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012"><main id="research-main" style="height:100dvh;overflow-y:auto"><div id="broker-sort-root"></div></main></body></html>' }))
  await page.goto('/broker-source-sort-test.html')
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh', path = '/src/components/ClientBrokers.tsx', domPath = '/@id/react-dom/client'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const source = await (await fetch(path)).text(), reactPath = source.match(/from "([^"\n]*\/react\.js[^"\n]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const reactModule = await import(/* @vite-ignore */ reactPath), react = reactModule.default ?? reactModule, dom = await import(/* @vite-ignore */ domPath)
    const { ClientBrokers } = await import(/* @vite-ignore */ path)
    for (const css of ['/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/src/client-reference.css']) await import(/* @vite-ignore */ css)
    document.body.style.fontFamily = '"Noto Sans KR Variable", sans-serif'
    const state = { listRequest: 0, calls: [] as string[] }
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('broker-sort-root'))
    const render = () => root.render(react.createElement(ClientBrokers, { onTitleChange: () => {}, listRequest: state.listRequest }))
    Object.assign(window, { brokerSortState: state, brokerSortList: () => { state.listRequest++; render() }, unmountBrokerSort: () => root.unmount() })
    render()
  })
  await expect(page.getByRole('heading', { name: '연결하면, 실행됩니다' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return { requests, errors }
}
const trigger = (page: Page, review = false) => page.getByRole('button', { name: new RegExp(`^${review ? '리뷰' : '거래소'} 정렬:`) })
const box = (page: Page, review = false) => page.getByRole('listbox', { name: review ? '리뷰 정렬' : '거래소 정렬', exact: true })
const names = (page: Page) => page.locator('.bk2-card').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')))
async function pick(page: Page, name: string, review = false) {
  await trigger(page, review).click()
  await box(page, review).getByRole('option', { name, exact: true }).click()
  await expect(box(page, review)).toHaveCount(0)
  await expect(trigger(page, review)).toBeFocused()
}

for (const width of [320, 760, 761, 1440]) test(`${width}px 원본 정렬은 같은 선택 상태를 공유하고 화면 밖으로 잘리지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const { requests, errors } = await mount(page)
  await expect(page.locator('select')).toHaveCount(0)
  expect(await names(page)).toEqual(filterBrokers('all', 'order').map(broker => broker.name))
  const rating = page.locator('.bk2-card').first().locator('.rt')
  expect(await rating.locator('b').evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element)
    return range.getClientRects().length
  })).toBe(1)
  expect(await rating.locator('.bk2-stars').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(70)
  expect(await rating.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await trigger(page).click()
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true')
  const list = box(page)
  await expect(list.getByRole('option', { name: '기본 순서', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(list.getByRole('option', { name: '기본 순서', exact: true })).toBeFocused()
  await expect(page.locator('dialog.tfbk-sort-sheet')).toHaveCount(width <= 760 ? 1 : 0)
  await expect(page.locator('.bk2-page .tfbk-menu')).toHaveCount(width > 760 ? 1 : 0)
  for (const option of await list.getByRole('option').all()) {
    await expect(option).toBeInViewport({ ratio: 1 })
    expect(await option.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
  }
  expect(await list.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return rect.left >= -1 && rect.right <= innerWidth + 1 && element.scrollWidth <= element.clientWidth + 1
  })).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath(`broker-sort-${width}.png`), fullPage: false })
  await list.getByRole('option', { name: '최다 리뷰', exact: true }).click()
  await expect(list).toHaveCount(0)
  expect(await names(page)).toEqual(filterBrokers('all', 'reviews').map(broker => broker.name))
  await expect(trigger(page)).toHaveAccessibleName('거래소 정렬: 최다 리뷰')
  await pick(page, '최다 사용자')
  expect(await names(page)).toEqual(filterBrokers('all', 'users').map(broker => broker.name))
  await page.locator('.bk2-bar').getByRole('button', { name: '연결 지원', exact: true }).click()
  expect(await names(page)).toEqual(filterBrokers('conn', 'users').map(broker => broker.name))
  await expect(trigger(page)).toHaveAccessibleName('거래소 정렬: 최다 사용자')
  expect(requests).toEqual([]); expect(errors).toEqual([])
})

test('desktop 키보드 방향·끝·처음·Escape·Tab·외부 클릭은 선택과 초점을 분리한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mount(page)
  await trigger(page).focus(); await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  await expect(box(page).getByRole('option', { name: '최다 사용자', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(box(page).getByRole('option', { name: '기본 순서', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('Home')
  await expect(box(page).getByRole('option', { name: '기본 순서', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
  await expect(trigger(page)).toHaveAccessibleName('거래소 정렬: 최다 리뷰')
  await expect(trigger(page)).toBeFocused()
  await trigger(page).click()
  for (const event of [{ key: 'Escape', isComposing: true }, { key: 'Escape', keyCode: 229 }]) {
    await box(page).getByRole('option', { name: '최다 리뷰', exact: true }).dispatchEvent('keydown', event)
    await expect(box(page)).toBeVisible()
  }
  await page.keyboard.press('Escape'); await expect(trigger(page)).toBeFocused()
  await trigger(page).click(); await page.keyboard.press('Tab')
  await expect(box(page)).toHaveCount(0)
  await expect(page.locator('.bk2-bar').getByRole('button', { name: '전체', exact: true })).toBeFocused()
  await trigger(page).click(); await page.keyboard.press('Shift+Tab')
  await expect(box(page)).toHaveCount(0)
  await expect(trigger(page)).toBeFocused()
  await trigger(page).click()
  await page.locator('.bk2-bar').getByRole('button', { name: '지원 예정', exact: true }).click()
  await expect(box(page)).toHaveCount(0)
  expect(await names(page)).toEqual(filterBrokers('soon', 'reviews').map(broker => broker.name))
})

test('모바일 시트는 modal trap·IME·backdrop·닫기와 정확한 스크롤 스타일 복원을 제공한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await mount(page)
  const scroll = page.locator('#research-main')
  await scroll.evaluate(element => element.style.setProperty('overflow-y', 'scroll', 'important'))
  await page.evaluate(() => document.body.style.setProperty('overflow-y', 'auto', 'important'))
  await trigger(page).click()
  const dialog = page.getByRole('dialog', { name: '거래소 정렬', exact: true })
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true)
  expect(await scroll.evaluate(element => element.style.overflowY)).toBe('hidden')
  const close = dialog.getByRole('button', { name: '닫기', exact: true })
  await close.focus(); await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('option', { name: '최다 사용자', exact: true })).toBeFocused()
  await page.keyboard.press('Tab'); await expect(close).toBeFocused()
  for (const event of [{ key: 'Escape', isComposing: true }, { key: 'Escape', keyCode: 229 }]) {
    await close.dispatchEvent('keydown', event); await expect(dialog).toBeVisible()
  }
  // A drag originating inside the sheet must not count as a backdrop click.
  await close.dispatchEvent('pointerdown')
  await dialog.locator('.sc').dispatchEvent('click')
  await expect(dialog).toBeVisible()
  await dialog.locator('.sc').click({ position: { x: 4, y: 4 } })
  await expect(dialog).toHaveCount(0); await expect(trigger(page)).toBeFocused()
  expect(await scroll.evaluate(element => [element.style.getPropertyValue('overflow-y'), element.style.getPropertyPriority('overflow-y')])).toEqual(['scroll', 'important'])
  expect(await page.evaluate(() => [document.body.style.getPropertyValue('overflow-y'), document.body.style.getPropertyPriority('overflow-y')])).toEqual(['auto', 'important'])
  await trigger(page).click(); await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('breakpoint 전환·명시 목록 진입·라우트 이탈은 시트와 잠금을 남기지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 900 })
  await mount(page)
  await pick(page, '최다 리뷰')
  await trigger(page).click()
  await page.setViewportSize({ width: 761, height: 900 })
  await expect(page.locator('dialog')).toHaveCount(0)
  await expect(trigger(page)).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflowY)).toBe('')
  await trigger(page).click(); await expect(page.locator('.tfbk-menu')).toBeVisible()
  await page.setViewportSize({ width: 320, height: 900 })
  await expect(box(page)).toHaveCount(0)
  await expect(trigger(page)).toHaveAccessibleName('거래소 정렬: 최다 리뷰')
  await trigger(page).click()
  await page.evaluate(() => Reflect.get(window, 'brokerSortList')())
  await expect(page.locator('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflowY)).toBe('')
  await trigger(page).click()
  await page.evaluate(() => { history.pushState({}, '', '#another-route'); window.dispatchEvent(new Event('teth:navigate')) })
  await expect(page.locator('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflowY)).toBe('')
  await trigger(page).click()
  await page.evaluate(() => { document.body.style.setProperty('overflow-y', 'hidden', 'important'); Reflect.get(window, 'unmountBrokerSort')() })
  await expect(page.locator('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => [document.body.style.getPropertyValue('overflow-y'), document.body.style.getPropertyPriority('overflow-y')])).toEqual(['hidden', 'important'])
})

for (const width of [320, 1440]) test(`${width}px 리뷰 정렬은 같은 원본 옵션과 페이지 초기화를 사용한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await mount(page)
  await page.getByRole('button', { name: 'Binance 자세히', exact: true }).click()
  await page.getByRole('tab', { name: /리뷰/ }).click()
  await page.locator('.bk2-pg').getByRole('button', { name: '2', exact: true }).click()
  await pick(page, '최신순', true)
  await expect(page.locator('.bk2-pg [aria-current="page"]')).toHaveText('1')
  const fixture = brokerReviews(CLIENT_BROKERS.find(broker => broker.id === 'binance')!)
  await expect(page.locator('.bk2-rvgrid .bk2-rvc .by')).toHaveText(fixture.slice().sort((a, b) => a.id - b.id).slice(0, 9).map(review => `${review.author}, ${review.date}`))
  await pick(page, '별점 높은 순', true)
  await expect(page.locator('.bk2-rvgrid .bk2-rvc .by')).toHaveText(fixture.slice().sort((a, b) => b.rating - a.rating || a.id - b.id).slice(0, 9).map(review => `${review.author}, ${review.date}`))
})

test('프로모는 최종 원문 공통 문구이며 혜택·계정 개설 미연결 경계는 유지한다', async ({ page, context }) => {
  const { requests, errors } = await mount(page)
  for (const name of ['Binance', 'OKX', 'WOO X']) {
    await page.getByRole('button', { name: `${name} 자세히`, exact: true }).click()
    await expect(page.locator('.bk2-promo .tx > p')).toHaveText('TETH 초대코드로 가입하면 유동성 수수료 지원으로 TETH 이용료가 무료에요. 가입 즉시 자동 연결됩니다.')
    await expect(page.locator('.bk2-promo .tx > p br')).toHaveCount(0)
    await page.getByRole('button', { name: '혜택 자세히', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('현재 화면만으로 무료 자격이나 계정 연결이 생성되지 않습니다.')
    await page.getByRole('button', { name: `${name} 계정 개설 ↗`, exact: true }).click()
    await expect(page.getByRole('dialog', { name: '계정 개설', exact: true })).toContainText('새 계정이나 연결은 생성되지 않았어요.')
    await expect.poll(() => page.getByRole('dialog').evaluate(element => element.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '혜택 자세히', exact: true })).toBeFocused()
    await page.locator('.bk2-bc').getByRole('button', { name: '지원 거래소', exact: true }).click()
  }
  expect(context.pages()).toHaveLength(1)
  expect(requests).toEqual([]); expect(errors).toEqual([])
})

test('하단 리뷰 정렬은 모든 선택지가 보이고 수식키로 선택 초점을 빼앗지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mount(page)
  await page.getByRole('button', { name: 'Binance 자세히', exact: true }).click()
  await page.getByRole('tab', { name: '리뷰', exact: true }).click()
  // Add space above the real detail to exercise the same clipped scrollport
  // when the trigger is near its lower edge; no menu CSS or handler replacement.
  await page.locator('.bk2-det').evaluate(element => { element.style.paddingTop = '900px' })
  await trigger(page, true).evaluate(element => {
    const scroll = document.getElementById('research-main')!
    scroll.scrollTop += element.getBoundingClientRect().top - (scroll.getBoundingClientRect().bottom - 70)
  })
  await trigger(page, true).click()
  for (const option of await box(page, true).getByRole('option').all()) await expect(option).toBeInViewport({ ratio: 1 })
  const selected = box(page, true).getByRole('option', { name: '별점 높은 순', exact: true })
  await expect(selected).toBeFocused()
  await selected.dispatchEvent('keydown', { key: 'End', ctrlKey: true })
  await expect(selected).toBeFocused()
  await page.screenshot({ path: info.outputPath('broker-review-bottom-menu.png') })
})

test('CSS 경계와 정수 innerWidth가 달라도 정렬 모드는 media query를 따른다', async ({ page }) => {
  await page.setViewportSize({ width: 761, height: 900 })
  await mount(page)
  await page.evaluate(() => Object.defineProperty(window, 'innerWidth', { configurable: true, value: 760 }))
  await trigger(page).click()
  await expect(page.locator('.tfbk-menu')).toBeVisible()
  await expect(page.locator('dialog.tfbk-sort-sheet')).toHaveCount(0)
})

test('지원 예정 상세에는 현재 연결을 단언하는 보충 문장이 붙지 않는다', async ({ page }) => {
  await mount(page)
  for (const broker of CLIENT_BROKERS.filter(broker => !broker.conn)) {
    await page.getByRole('button', { name: `${broker.name} 자세히`, exact: true }).click()
    await expect(page.locator('.bk2-head .soon')).toHaveText('지원 예정')
    await expect(page.locator('.bk2-about > p')).toContainText('준비 중')
    await expect(page.locator('.bk2-about > p')).not.toContainText('연결 후에도 설정에서 언제든 끊을 수 있습니다.')
    await page.locator('.bk2-bc').getByRole('button', { name: '지원 거래소', exact: true }).click()
  }
})

test('확장 목록의 nullable 평점·누락 정보는 허구 리뷰 없이 원본 수수료 스냅샷으로 표시한다', async ({ page }) => {
  const { requests, errors } = await mount(page)
  await expect(page.locator('.bk2-card')).toHaveCount(21)
  const targets = [CLIENT_BROKERS.find(broker => broker.id === 'bitget')!, CLIENT_BROKERS.find(broker => broker.id === 'mexc')!, CLIENT_BROKERS.find(broker => broker.rating === null)!]
  for (const broker of targets) {
    const listing = page.locator('.bk2-card').filter({ has: page.getByRole('button', { name: broker.name, exact: true }) })
    await expect(listing.locator('.rt')).toHaveCount(broker.rating === null ? 0 : 1)
    if (broker.rating !== null) await expect(listing.locator('.rt')).toHaveAttribute('title', broker.ratingSrc || '앱스토어 공개 평점 기준')
    await page.getByRole('button', { name: `${broker.name} 자세히`, exact: true }).click()
    await expect(page.locator('.bk2-head .bk2-rc')).toHaveCount(broker.rating === null ? 0 : 1)
    const expectedLeverage = broker.lev2?.fut ? '1:' + broker.lev2.fut.replace(/[^0-9]/g, '') : broker.lev2 ? '현물 1:1' : broker.lev || '—'
    await expect(page.locator('.bk2-fees > div').filter({ hasText: '최대 레버리지' }).locator('b')).toHaveText(expectedLeverage)
    if (broker.fees?.fmk || broker.fees?.ftk || broker.lev2?.fut) {
      const expected = broker.fees?.fmk || broker.fees?.ftk ? `${broker.fees.fmk || '—'} / ${broker.fees.ftk || '—'}` : '—'
      await expect(page.locator('.bk2-fees > div').filter({ hasText: '선물 Maker / Taker' }).locator('b')).toHaveText(expected)
    }
    await expect(page.locator('.bk2-asof')).toContainText(`${broker.asof || '2026.09'} 기준 스냅샷`)
    if (!brokerReviews(broker).length) {
      await expect(page.locator('.bk2-rvrow .bk2-rvc')).toHaveCount(0)
      await page.getByRole('tab', { name: '리뷰', exact: true }).click()
      await expect(page.locator('.bk2-rvgrid .bk2-rvc')).toHaveCount(0)
      await expect(page.locator('.bk2-rvgrid .bk2-empty')).toHaveText('이 카테고리의 리뷰가 아직 없어요.')
    }
    await expect(page.locator('.bk2-page')).not.toContainText(/undefined|NaN/)
    await page.locator('.bk2-bc').getByRole('button', { name: '지원 거래소', exact: true }).click()
  }
  expect(requests).toEqual([]); expect(errors).toEqual([])
})
