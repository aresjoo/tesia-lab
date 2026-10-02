import { expect, test, type Page } from '@playwright/test'

async function mount(page: Page, own: 'missing' | 'none' | 'supplied' = 'supplied') {
  await page.route('**/broker-own-review-audit.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0f1012"><div id="fixture"></div></body></html>' }))
  await page.goto('/broker-own-review-audit.html'); await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(async own => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/internal-poc/NativeBrokers.tsx', code = await (await fetch(path)).text(), rp = code.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React')
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, dp = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */dp)
    const { NativeBrokers } = await import(/* @vite-ignore */path), pp = '/src/client-preferences.ts', preferences = await import(/* @vite-ignore */pp)
    for (const css of ['/src/styles.css', '/src/client-reference.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/node_modules/@fontsource-variable/noto-sans-sc/index.css']) await import(/* @vite-ignore */css)
    document.getElementById('fixture')!.style.fontFamily = '"Noto Sans KR Variable", "Noto Sans SC Variable", "Geist Variable", -apple-system, BlinkMacSystemFont, sans-serif'
    preferences.setClientPreference('language', 'ko')
    const h = React.createElement, root = (DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('fixture'))
    const calls: unknown[] = [], pending: { resolve: () => void; reject: () => void }[] = []
    const submitReview = (id: string, value: unknown) => { calls.push({ id, value }); return new Promise<void>((resolve, reject) => pending.push({ resolve, reject: () => reject(new Error('PRIVATE_REVIEW_FAILURE')) })) }
    const ownReview = { id: 7, rating: 4, text: '서버가 확인한 본인 리뷰 전체 본문입니다. '.repeat(16), author: '공급 작성자', date: '2031년 공급 날짜', categories: ['거래 조건'] }
    const reviews = Array.from({ length: 19 }, (_, i) => ({ id: i, rating: 5, text: `일반 리뷰 ${i}`, author: `다른 작성자 ${i}`, date: '일반 공급 날짜', categories: ['고객 지원'] }))
    let currentOwn = own, owner = 'owner-a', identity = 'data-a', missingReviews = false, reviewCount = reviews.length, dates: 'none' | 'partial' | 'full' = 'none'
    const render = () => root.render(h(React.StrictMode, null, h(NativeBrokers, { onReturn: () => {}, shouldFocus: () => true, listRequest: 0, accountScope: owner, signedIn: true,
      presentation: { scope: owner, identity, catalog: [{ broker: { id: 'binance', name: 'Own Review Broker', ord: 1, tag: '거래소', assets: 'BTC', assetsList: ['BTC'], conn: true, rating: 5, traders: '12', fw0: 0, rvN: 19, col: '#aabbee', fg: '#111111', site: 'example.com', about: '공급된 내용' }, connectionState: 'CONNECTED', reviews: missingReviews ? null : reviews.slice(0, reviewCount).map((review, index) => ({ ...review, ...(dates === 'full' || dates === 'partial' && index < 2 ? { publishedAt: new Date(Date.UTC(2031, 0, index + 1)).toISOString() } : {}) })),
        ...(currentOwn === 'missing' ? {} : { ownReview: currentOwn === 'none' ? null : ownReview }) }], actions: { submitReview } },
    })))
    Object.assign(window, { ownReviewCalls: calls, ownReviewSettle: (i: number, failure = false) => failure ? pending[i].reject() : pending[i].resolve(),
      ownReviewSupply: (value: typeof own) => { currentOwn = value; render() }, ownReviewOwner: () => { owner = 'owner-b'; currentOwn = 'missing'; render() },
      ownReviewIdentity: () => { identity = 'data-b'; currentOwn = 'missing'; render() }, ownReviewMissingRows: () => { missingReviews = true; render() },
      ownReviewRows: (count: number | null) => { missingReviews = count === null; if (count !== null) reviewCount = count; render() },
      ownReviewDates: (value: typeof dates) => { dates = value; render() },
      ownReviewLocale: (value: string) => preferences.setClientPreference('language', value) })
    render()
  }, own)
  await detail(page)
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
}
async function detail(page: Page) { await page.locator('.bk2-card .obtn').click(); await page.locator('[data-tab=reviews]').click() }
async function write(page: Page) {
  await page.locator('.bk2-review-heading .wbtn').click()
  await page.getByRole('radio', { name: '5점', exact: true }).click()
  await page.getByRole('textbox', { name: '리뷰 내용', exact: true }).fill('작성 중 입력은 서버 본인 리뷰가 아닙니다')
  await page.locator('dialog[open] .bk2-actions .wbtn').click()
}

test('확인된 내 리뷰는 첫페이지에 원본 전용 전체본문·나/공급날짜로 표시하고 같은 ID를 중복 집계하지 않는다', async ({ page }) => {
  await mount(page)
  const mine = page.locator('.bk2-mine')
  await expect(mine).toBeVisible(); await expect(mine.locator('p')).toHaveText('서버가 확인한 본인 리뷰 전체 본문입니다. '.repeat(16).trim())
  await expect(mine.locator('.by')).toHaveText('나, 2031년 공급 날짜')
  await expect(mine.locator('.bk2-stars')).toHaveAttribute('aria-label', '별점 4')
  await expect(page.locator('.bk2-dist .n')).toHaveText(['18', '1', '0', '0', '0'])
  await expect(page.locator('.bk2-st').first()).toContainText('평가19')
  await expect(page.locator('.bk2-rvgrid')).not.toContainText('일반 리뷰 7')
  await page.locator('.bk2-pg').getByRole('button', { name: '다음 페이지', exact: true }).click()
  await expect(mine).toHaveCount(0)
  await page.locator('.bk2-cats button').filter({ hasText: /^고객 지원$/ }).click()
  await expect(mine).toBeVisible()
  await expect(page.locator('.bk2-rvgrid')).not.toContainText('일반 리뷰 7')
})

for (const own of ['missing', 'none'] as const) test(`${own}는 본인 리뷰를 만들지 않고 ACK 뒤 첫페이지/작성창 닫힘만 진행한다`, async ({ page }) => {
  await mount(page, own)
  await page.locator('.bk2-pg').getByRole('button', { name: '다음 페이지', exact: true }).click()
  await write(page)
  await expect(page.locator('dialog[open]')).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'ownReviewSettle')(0))
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(page.locator('.bk2-pg [aria-current=page]')).toHaveText('1')
  await expect(page.locator('.bk2-mine')).toHaveCount(0)
  await expect(page.locator('.bk2-rvgrid')).not.toContainText('작성 중 입력은 서버 본인 리뷰가 아닙니다')
  await expect(page.locator('[role=status]').filter({ hasText: '리뷰를 등록했습니다' })).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'ownReviewSupply')('supplied'))
  await expect(page.locator('.bk2-mine')).toBeVisible()
})

test('실패·중복·owner교체 늦은 ACK는 초안과 새 화면을 오염시키지 않는다', async ({ page }) => {
  await mount(page, 'missing'); await write(page)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'ownReviewCalls').length)).toBe(1)
  await expect(page.locator('dialog[open] .bk2-actions .wbtn')).toBeDisabled()
  await page.evaluate(() => Reflect.get(window, 'ownReviewSettle')(0, true))
  await expect(page.getByRole('textbox', { name: '리뷰 내용', exact: true })).toHaveValue('작성 중 입력은 서버 본인 리뷰가 아닙니다')
  await expect(page.locator('dialog[open] [role=alert]')).not.toContainText('PRIVATE_REVIEW_FAILURE')
  await page.locator('dialog[open] .bk2-actions .wbtn').click()
  await page.evaluate(() => Reflect.get(window, 'ownReviewOwner')())
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await detail(page)
  await page.locator('.bk2-pg').getByRole('button', { name: '다음 페이지', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'ownReviewSettle')(1))
  await expect(page.locator('.bk2-pg [aria-current=page]')).toHaveText('2')
  await expect(page.locator('.bk2-mine')).toHaveCount(0)
})

test('본인 리뷰만 공급되어도 표시하되 전체 미제공 평점분포를 합성하지 않으며 7언어·320px 본문은 보존한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 }); await mount(page)
  await page.evaluate(() => Reflect.get(window, 'ownReviewMissingRows')())
  const labels = ['나', 'Me', '自分', '我', '我', 'Yo', 'Moi']
  for (const [index, language] of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'].entries()) {
    await page.evaluate(value => Reflect.get(window, 'ownReviewLocale')(value), language)
    await expect(page.locator('.bk2-mine .by')).toHaveText(`${labels[index]}, 2031년 공급 날짜`)
    await expect(page.locator('.bk2-dist .n')).toHaveText(['—', '—', '—', '—', '—'])
    await expect(page.locator('.bk2-st b').first()).toHaveText('—')
    await expect(page.locator('.bk2-mine p')).toContainText('서버가 확인한 본인 리뷰')
    expect(await page.locator('.bk2-mine p').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.locator('.bk2-mine').screenshot({ path: info.outputPath('own-review-fr-320.png') })
})

for (const close of ['Escape', 'X'] as const) test(`pending ${close}는 요청 취소를 위조하지 않고 창만 닫으며 ACK 전 중복 제출을 막는다`, async ({ page }) => {
  await mount(page, 'missing'); await write(page)
  if (close === 'Escape') await page.keyboard.press('Escape')
  else await page.locator('dialog[open]>header button').click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(page.locator('[role=status]').filter({ hasText: '창을 닫아도 등록 요청은 계속 진행됩니다.' })).toBeVisible()
  await expect(page.locator('.bk2-review-heading h3')).toBeFocused()
  await expect(page.locator('.bk2-review-heading .wbtn')).toBeDisabled()
  await expect(page.locator('.bk2-review-heading .wbtn')).toHaveAttribute('aria-busy', 'true')
  await page.locator('.bk2-review-heading .wbtn').evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  expect(await page.evaluate(() => Reflect.get(window, 'ownReviewCalls').length)).toBe(1)
  await page.evaluate(() => Reflect.get(window, 'ownReviewSettle')(0))
  await expect(page.locator('.bk2-review-heading .wbtn')).toBeEnabled()
  await expect(page.locator('[role=status]').filter({ hasText: '리뷰를 등록했습니다' })).toBeVisible()
  await expect(page.locator('.bk2-mine')).toHaveCount(0)
})

test('미공급과 개요에서의 임시 축소는 리뷰 페이지를 폐기하지 않고 확인된 리뷰 탭 축소만 저장한다', async ({ page }) => {
  await mount(page, 'missing')
  const current = page.locator('.bk2-pg [aria-current=page]')
  await page.locator('.bk2-pg').getByRole('button', { name: '다음 페이지', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'ownReviewRows')(null))
  await expect(page.locator('.bk2-st b').first()).toHaveText('—')
  await page.evaluate(() => Reflect.get(window, 'ownReviewRows')(19))
  await expect(current).toHaveText('2')
  await page.locator('[data-tab=overview]').click()
  await page.evaluate(() => Reflect.get(window, 'ownReviewRows')(9))
  await expect(page.locator('.bk2-st b').first()).toHaveText('9')
  await page.evaluate(() => Reflect.get(window, 'ownReviewRows')(19))
  await page.locator('[data-tab=reviews]').click()
  await expect(current).toHaveText('2')
  await page.evaluate(() => Reflect.get(window, 'ownReviewRows')(9))
  await expect(page.locator('.bk2-pg')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'ownReviewRows')(19))
  await expect(current).toHaveText('1')
})

test('최신순은 일부 timestamp가 미공급이면 공급순서, 전체 유효일 때만 날짜 정렬한다', async ({ page }) => {
  await mount(page, 'missing')
  await page.evaluate(() => Reflect.get(window, 'ownReviewDates')('partial'))
  await page.getByRole('button', { name: /^리뷰 정렬:/ }).click()
  await page.getByRole('option', { name: '최신순', exact: true }).click()
  await expect(page.locator('.bk2-rvgrid .bk2-rvc p').first()).toHaveText('일반 리뷰 0')
  await page.evaluate(() => Reflect.get(window, 'ownReviewDates')('full'))
  await expect(page.locator('.bk2-rvgrid .bk2-rvc p').first()).toHaveText('일반 리뷰 18')
})

test('pending 창닫힘 뒤 실패는 요청 잠금만 해제하고 새 작성·동시 중복 클릭을 분리한다', async ({ page }) => {
  await mount(page, 'missing'); await write(page); await page.keyboard.press('Escape')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'ownReviewSettle')(0, true))
  await expect(page.locator('.bk2-review-heading .wbtn')).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveText('요청을 확인하지 못했습니다')
  await expect(page.locator('.native-brokers')).not.toContainText('작성 내용은 유지됩니다')
  await page.locator('.bk2-review-heading .wbtn').click()
  await expect(page.getByRole('textbox', { name: '리뷰 내용', exact: true })).toHaveValue('')
  await page.getByRole('radio', { name: '4점', exact: true }).click()
  await page.getByRole('textbox', { name: '리뷰 내용', exact: true }).fill('명시적으로 새로 작성한 리뷰 본문')
  await page.locator('dialog[open] .bk2-actions .wbtn').evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  expect(await page.evaluate(() => Reflect.get(window, 'ownReviewCalls').length)).toBe(2)
  await page.evaluate(() => Reflect.get(window, 'ownReviewSettle')(1))
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(page.locator('[role=status]').filter({ hasText: '리뷰를 등록했습니다' })).toBeVisible()
  await expect(page.locator('.bk2-mine')).toHaveCount(0)
})

test('pending 창닫힘 직후 사용자가 연 새 모달의 초점은 늦은 heading복귀와 ACK가 빼앗지 않는다', async ({ page }) => {
  await mount(page, 'missing'); await write(page)
  await page.evaluate(async () => {
    document.querySelector<HTMLButtonElement>('dialog[open]>header button')!.click()
    const overlay = document.createElement('dialog'), input = document.createElement('input')
    overlay.id = 'separate-user-modal'; input.setAttribute('aria-label', '사용자가 연 다른 모달')
    overlay.append(input); document.body.append(overlay); overlay.showModal(); input.focus()
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  await expect(page.locator('.tfbk-dialog[open]')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: '사용자가 연 다른 모달' })).toBeFocused()
  await page.evaluate(() => Reflect.get(window, 'ownReviewSettle')(0))
  await expect(page.getByRole('textbox', { name: '사용자가 연 다른 모달' })).toBeFocused()
  await page.evaluate(() => { const overlay = document.getElementById('separate-user-modal') as HTMLDialogElement; overlay.close(); overlay.remove() })
})
