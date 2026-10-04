import { expect, test, type Page } from '@playwright/test'
import { sharedAnalysisRequest, sharedHash, sharedPeriodResult, sourceSharedStrategies } from '../src/client-shared-strategies'
import { evaluateDelegation } from '../src/client-delegation-engine'
import { sourceTerminalDate, sourceTerminalPrices } from '../src/client-terminal-source-fixture'
import { catalogueStrategies } from '../src/client-catalogue'
import { loadCatalogueMarketData } from '../src/client-catalogue-market-data'
import { runCatalogueSpotPreview } from '../src/client-catalogue-spot-engine'
import { runCatalogueFuturesPreview } from '../src/client-catalogue-futures-engine'
import { catalogueListPerformance } from '../src/client-catalogue-presentation'
import { sourceSharingNames, traverseSourceSharingPages, returnFromSourceSharing } from './fixtures/source-sharing-page-helper'

async function catalogueRows() {
  const data = await loadCatalogueMarketData()
  return catalogueStrategies.map(row => ({ ...row, performance: catalogueListPerformance(row.fut ? runCatalogueFuturesPreview(row, data) : runCatalogueSpotPreview(row, data))! }))
}

const rows = sourceSharedStrategies()
const byReturn = [...rows].sort((a, b) => b.result.ret - a.result.ret)
const percent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
async function open(page: Page, hash = '#/share', signedIn = true) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  if (signedIn) await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '공유 검수자', email: 'sharing@example.test' })))
  await page.goto(`/${hash}`)
  await expect(page.locator('.client-strategy-sharing')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}
const cards = (page: Page) => page.locator('.client-strategy-sharing article.tfbk-card')
const names = sourceSharingNames
async function selectDropdown(page: Page, label: string, option: string) {
  await page.getByRole('button', { name: new RegExp(`^${label}: `) }).click()
  await page.getByRole('listbox', { name: label, exact: true }).getByRole('option', { name: option, exact: true }).click()
}
async function navigation(page: Page) {
  if ((page.viewportSize()?.width ?? 0) <= 860) {
    // Source scroll-down hides the mobile trigger; keyboard focus restores it.
    await page.locator('.client-hamburger').focus()
    await page.keyboard.press('Enter')
  }
  else if (!await page.getByRole('button', { name: '전략 복사', exact: true }).isVisible()) await page.locator('.client-rail-logo-row button').click()
}
async function detail(page: Page, nick = byReturn[0].nick) {
  // Saved legacy links still need their own engine/period coverage. The latest
  // catalogue no longer lists these five seeds or aliases their results.
  await page.evaluate(hash => { history.pushState(null, '', hash); dispatchEvent(new Event('teth:navigate')) }, sharedHash({ nick, period: 'all' }))
  await expect(page.locator('.ss3-dtitle')).toContainText(nick)
}
async function noPageOverflow(page: Page) {
  const widths = await page.evaluate(() => [document.documentElement, document.body, document.getElementById('research-main'), document.querySelector('.client-strategy-sharing')].filter((el): el is HTMLElement => el instanceof HTMLElement).map(el => ({ name: el.id || el.className || el.tagName, scroll: el.scrollWidth, client: el.clientWidth })))
  for (const value of widths) expect(value.scroll, value.name).toBeLessThanOrEqual(value.client + 1)
}

test('원본 전략 복사 메뉴와 공유 직접 경로는 같은 탐색 허브를 연다', async ({ page }) => {
  await open(page)
  for (const label of ['전략 복사']) {
    await navigation(page)
    await page.locator('.client-util').filter({ hasText: label }).click()
    await expect(page).toHaveURL(/#\/share$/)
    await expect(page.locator('.hub-header h1')).toHaveText('전략 복사')
    expect(await names(page)).toEqual(catalogueStrategies.map(row => row.name))
  }
})

test('메인 공유 허브는 최신31종의 30일 성과와 검색·시장·3개 정렬을 제공한다', async ({ page }) => {
  await open(page)
  const catalogue = await catalogueRows()
  await expect(page.locator('.hub-header h1')).toHaveText('전략 복사')
  await expect(page.locator('.strategy-list-grid')).toHaveAttribute('aria-busy', 'false')
  expect(await names(page)).toEqual(catalogue.map(row => row.name))
  const checked = new Set<string>()
  await traverseSourceSharingPages(page, async () => {
    for (const row of catalogue) {
      if (checked.has(row.id)) continue
      const card = cards(page).filter({ has: page.getByRole('link', { name: row.name, exact: true }) })
      if (!await card.count()) continue
      await expect(card).toContainText(percent(row.performance.percent))
      await expect(card).not.toContainText('TETH 점수')
      checked.add(row.id)
    }
  })
  expect([...checked]).toEqual(catalogue.map(row => row.id))
  await page.getByRole('searchbox', { name: '전략 검색' }).fill(`  ${catalogue[0].name}  `)
  expect(await names(page)).toEqual([catalogue[0].name])
  await page.getByRole('searchbox', { name: '전략 검색' }).fill('검색 결과 없음 <script>')
  await expect(cards(page)).toHaveCount(0)
  await page.getByRole('button', { name: '필터 초기화', exact: true }).click()
  for (const [market, label] of [['crypto', '가상자산'], ['stock', '미국 주식'], ['index', '지수와 금'], ['multi', '여러 시장']]) {
    await selectDropdown(page, '시장', label)
    expect(await names(page)).toEqual(catalogue.filter(row => row.mkt === market).map(row => row.name))
  }
  await selectDropdown(page, '시장', '시장 전체')
  const select = page.getByRole('combobox', { name: '정렬 기준', exact: true })
  await expect(select.locator('option')).toHaveCount(3)
  const values = { ret: (row: typeof catalogue[number]) => row.performance.percent, fw: (row: typeof catalogue[number]) => row.fw }
  for (const [key, value] of Object.entries(values)) {
    await select.selectOption(key)
    expect(await names(page)).toEqual([...catalogue].sort((a, b) => value(b) - value(a)).map(row => row.name))
    await select.selectOption(key)
    expect(await names(page)).toEqual([...catalogue].sort((a, b) => value(a) - value(b)).map(row => row.name))
  }
})

test('공유 상세 기간은 재계산하고 replaceState로 교체되며 뒤로·앞으로와 새로고침을 보존한다', async ({ page }) => {
  const row = byReturn[0]
  await open(page)
  const hubLength = await page.evaluate(() => history.length)
  await detail(page, row.nick)
  expect(await page.evaluate(() => history.length)).toBe(hubLength + 1)
  for (const [period, label] of [['1y', '최근 1년'], ['2y', '최근 2년'], ['all', '전체'], ['1y', '최근 1년']] as const) {
    await page.getByRole('group', { name: '검증 기간' }).getByRole('button', { name: label, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${sharedHash({ nick: row.nick, period })}$`))
    await expect(page.locator('[data-metric="ret"] b')).toHaveText(percent(sharedPeriodResult(row, period).ret))
    await expect(page.locator('.client-shared-equity-chart')).toHaveAttribute('data-point-count', String(sharedPeriodResult(row, period).eq.length))
    expect(await page.evaluate(() => history.length)).toBe(hubLength + 1)
  }
  await page.goBack()
  await expect(page.locator('.hub-header h1')).toHaveText('전략 복사')
  await page.goForward()
  await expect(page.locator('.ss3-dtitle')).toContainText(row.nick)
  await expect(page.getByRole('button', { name: '최근 1년', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.locator('[data-metric="ret"] b')).toHaveText(percent(sharedPeriodResult(row, '1y').ret))
})

test('지표 설명은 실제 원본 값에 연결되고 Escape 뒤 원래 버튼으로 포커스가 돌아온다', async ({ page }) => {
  await open(page, sharedHash({ nick: rows[0].nick, period: 'all' }))
  const trigger = page.locator('.ss3-matrix').getByRole('button', { name: /최대 낙폭/ })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: '최대 낙폭 (MDD)', exact: true })
  await expect(dialog).toContainText('고점 대비 가장 많이 하락한 폭')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  const curve = page.getByRole('img', { name: '누적 수익 곡선', exact: true })
  await curve.focus()
  await page.keyboard.press('Home')
  await expect(page.locator('.xh')).toHaveAttribute('data-selected-index', String(rows[0].result.eq[0].i))
  await page.keyboard.press('End')
  await expect(page.locator('.xh')).toHaveAttribute('data-selected-index', String(rows[0].result.eq.at(-1)!.i))
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
})

test('조건 설정·예상 결과는 원본 엔진으로 계산하고 명시 확정 전에는 저장·실행하지 않는다', async ({ page }) => {
  const mutations: string[] = []
  page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) mutations.push(request.url()) })
  const row = byReturn[0]
  await open(page, sharedHash({ nick: row.nick, period: 'all' }))
  const initial = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))
  const trigger = page.getByRole('button', { name: '따라하기', exact: true })
  await trigger.click()
  const intro = page.getByRole('dialog', { name: '이 전략을 따라하려면 연결이 필요해요', exact: true })
  await expect(intro).toBeVisible()
  await intro.getByRole('button', { name: '나중에 하기', exact: true }).click()
  await page.getByRole('combobox', { name: '시작 예산', exact: true }).selectOption('0')
  await page.getByRole('combobox', { name: '손절선', exact: true }).selectOption('-3')
  await page.getByRole('combobox', { name: '익절 목표', exact: true }).selectOption('15')
  await page.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '예상 결과 확인', exact: true })
  const calculated = evaluateDelegation({ ...row.parameters, sl: -3, tp: 15 }, 1000000)
  await expect(dialog).toContainText(`${calculated.score}점`)
  await expect(dialog).toContainText(percent(calculated.result.ret))
  const budgetSummary = dialog.locator('.ss3-copy-summary > div').filter({ has: page.locator('dt', { hasText: /^시작 예산$/ }) })
  await expect(budgetSummary.locator('dd')).toHaveText('100만원')
  await expect(dialog).toContainText('실제 주문은 실행되지 않습니다.')
  const confirm = dialog.getByRole('button', { name: '확정하고 검증 시작', exact: true })
  await expect(confirm).toBeEnabled()
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(initial)
  expect(mutations).toEqual([])
  await dialog.getByRole('button', { name: '뒤로', exact: true }).click()
  await expect(page.getByRole('combobox', { name: '손절선', exact: true })).toHaveValue('-3')
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

test('최근 12건 체결·연도별 성과는 선택 기간의 원본 자료이며 달력 이동은 기간 전환에서 초기화된다', async ({ page }) => {
  const row = byReturn[0]
  await open(page, sharedHash({ nick: row.nick, period: 'all' }))
  const date = (index: number) => {
    const d = sourceTerminalDate(index)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }
  for (const [period, label] of [['all', '전체'], ['1y', '최근 1년'], ['2y', '최근 2년']] as const) {
    await page.getByRole('group', { name: '검증 기간' }).getByRole('button', { name: label, exact: true }).click()
    const result = sharedPeriodResult(row, period)
    const expected = result.trades.slice(-12).reverse().map(trade => [date(trade.entry), date(trade.exit), `${trade.exit - trade.entry}봉`, row.asset, { sl: '손절', tp: '익절', time: '기간 청산' }[trade.kind], Math.round(sourceTerminalPrices[trade.entry]).toLocaleString('ko-KR'), Math.round(trade.kind === 'sl' ? sourceTerminalPrices[trade.entry] * (1 + result.params.sl / 100) : trade.kind === 'tp' ? sourceTerminalPrices[trade.entry] * (1 + result.params.tp! / 100) : sourceTerminalPrices[trade.exit]).toLocaleString('ko-KR'), `${trade.pnl >= 0 ? '+' : ''}${(trade.pnl * 100).toFixed(2)}%`])
    expect(await page.locator('.ss3-tbl tbody tr').evaluateAll(els => els.map(el => [...el.querySelectorAll('td')].map(td => td.textContent)))).toEqual(expected)
    await expect(page.locator('.ss3-tbl th')).toHaveText(['진입일', '청산일', '보유', '자산', '구분', '진입가', '청산가', '손익률'])
    const years = Object.keys(result.byYear).sort()
    await expect(page.locator('.shared-year-bars')).toHaveAttribute('aria-label', years.map(year => `${year}년 ${result.byYear[year].pnl >= 0 ? '+' : ''}${(result.byYear[year].pnl * 100).toFixed(0)}%`).join(', '))
    const last = sourceTerminalDate(result.eq.at(-1)!.i)
    const month = page.locator('.shared-calendar-heading h3 span[aria-live]')
    await expect(month).toHaveText(`${last.getFullYear()}년 ${last.getMonth() + 1}월`)
    await expect(page.getByRole('button', { name: '다음 월', exact: true })).toHaveAttribute('aria-disabled', 'true')
    await page.getByRole('button', { name: '이전 월', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(month).not.toHaveText(`${last.getFullYear()}년 ${last.getMonth() + 1}월`)
  }
})

test('관심 전략은 홈 이동·재조회에서 유지되며 다른 계정과 게스트에는 섞이지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('sharing-owner-fixture')) {
      sessionStorage.setItem('sharing-owner-fixture', 'initialized')
      sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '계정 A', email: 'a@example.test' }))
    }
  })
  const hash = sharedHash({ nick: rows[0].nick, period: 'all' })
  await open(page, hash, false)
  await page.getByRole('button', { name: '관심 전략', exact: true }).click()
  await expect(page.getByRole('button', { name: '관심 전략 해제', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-sharing-watch:account:a%40example.test')!))).toEqual([rows[0].nick])
  await page.locator('.hub-header').getByRole('button').click()
  await navigation(page)
  await page.locator('.client-util').filter({ hasText: '전략 복사' }).click()
  await page.evaluate(() => { location.hash = '#/share/library' })
  await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  await expect(page.getByRole('heading', { name: '관심 전략', exact: true })).toBeVisible()
  expect(await names(page)).toEqual([rows[0].nick])
  await page.goto(`/${hash}`)
  await expect(page.getByRole('button', { name: '관심 전략 해제', exact: true })).toBeVisible()
  await page.evaluate(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '계정 B', email: 'b@example.test' })))
  await page.reload()
  await expect(page.getByRole('button', { name: '관심 전략', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.evaluate(() => sessionStorage.removeItem('teth-client-profile-preview'))
  await page.reload()
  await expect(page.getByRole('button', { name: '관심 전략', exact: true })).toHaveAttribute('aria-pressed', 'false')
  const guestBytes = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
  await page.getByRole('button', { name: '관심 전략', exact: true }).click()
  await expect(page.locator('.ca-auth')).toBeVisible()
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))).toEqual(guestBytes)
  expect(await page.evaluate(() => sessionStorage.getItem('teth-sharing-watch:guest'))).toBeNull()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '관심 전략', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.evaluate(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '계정 A', email: 'a@example.test' })))
  await page.reload()
  await expect(page.getByRole('button', { name: '관심 전략 해제', exact: true })).toBeVisible()
})

for (const signedIn of [false, true]) test(`${signedIn ? '회원' : '게스트'}의기존·신규관심전략은각자근거로보존되며기본31종목록을바꾸지않는다`, async ({ page }, info) => {
  const legacy = rows[0], current = catalogueStrategies[0]
  const key = signedIn ? 'teth-sharing-watch:account:sharing%40example.test' : 'teth-sharing-watch:guest'
  const saved = JSON.stringify([legacy.nick, current.id, current.name, 'unknown-saved-strategy'])
  await page.addInitScript(({ key, saved }) => {
    if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, saved)
  }, { key, saved })
  await open(page, '#/share/library', signedIn)
  await expect(cards(page).locator('h3')).toHaveText([current.name, legacy.nick])
  // Legacy equity is sparse: thirty observations are not thirty days. Its
  // preview-only flat gaps retain the last balance at the exact day boundary.
  const startBalance = legacy.result.eq.filter(point => point.i <= legacy.parameters.endI! - 30).at(-1)!.v
  await expect(cards(page).last().locator('.skf-ret b')).toHaveText(percent((legacy.result.eq.at(-1)!.v / startBalance - 1) * 100))
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(saved)
  await cards(page).last().getByRole('link').click()
  await expect(page.locator('.ss3-dtitle')).toHaveText(legacy.nick)
  await expect(page.locator('[data-metric="ret"] b')).toHaveText(percent(legacy.result.ret))
  await page.goBack()
  await expect(cards(page)).toHaveCount(2)
  await cards(page).first().getByRole('link').click()
  await expect(page.locator('.ss3-dtitle')).toHaveText(current.name)
  await expect(page.locator('[data-catalogue-metric="ret"]')).toBeVisible()
  if (!signedIn) {
    // Historical guest bookmarks remain readable compatibility data. Source
    // 21852 allows no anonymous toggle, migration, or write before signup.
    const watch = page.getByRole('button', { name: '즐겨찾기', exact: true })
    await expect(watch).toHaveAttribute('aria-pressed', 'false')
    await watch.click()
    await expect(page.locator('.ca-auth')).toBeVisible()
    expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(saved)
    await page.keyboard.press('Escape')
    await expect(page.locator('.ca-auth')).toHaveCount(0)
    await expect(watch).toHaveAttribute('aria-pressed', 'false')
    await page.goBack(); await page.reload()
    await expect(cards(page).locator('h3')).toHaveText([current.name, legacy.nick])
    await page.screenshot({ path: info.outputPath('retained-readonly-guest-watch.png') })
    await page.getByRole('button', { name: '전략 찾기', exact: true }).click()
    expect(await names(page)).toEqual(catalogueStrategies.map(row => row.name))
    expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(saved)
    return
  }
  await page.getByRole('button', { name: '즐겨찾기 해제', exact: true }).click()
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), key)).toEqual([legacy.nick, 'unknown-saved-strategy'])
  await page.goBack(); await page.reload()
  await expect(cards(page).locator('h3')).toHaveText([legacy.nick])
  await page.screenshot({ path: info.outputPath('retained-legacy-watch.png') })
  await page.getByRole('button', { name: '전략 찾기', exact: true }).click()
  expect(await names(page)).toEqual(catalogueStrategies.map(row => row.name))
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), key)).toEqual([legacy.nick, 'unknown-saved-strategy'])
})

test('링크 복사 실패는 현재 URL을 보이고 늦은 이전 요청·기간·화면 응답은 무시한다', async ({ page }) => {
  await page.addInitScript(() => {
    const pending: { url: string; resolve: () => void; reject: () => void }[] = []
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (url: string) => new Promise<void>((resolve, reject) => pending.push({ url, resolve, reject: () => reject(new Error('fixture clipboard denied')) })) } })
    Object.assign(window, { sharingClipboard: pending })
  })
  await open(page, sharedHash({ nick: rows[0].nick, period: 'all' }))
  const copy = page.getByRole('button', { name: '전략 링크 복사', exact: true })
  const finish = async (index: number, outcome: 'resolve' | 'reject') => {
    await page.evaluate(({ index, outcome }) => Reflect.get(window, 'sharingClipboard')[index][outcome](), { index, outcome })
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  }
  await copy.click()
  await page.getByRole('button', { name: '최근 1년', exact: true }).click()
  await finish(0, 'resolve')
  await expect(page.locator('.ss3-notice')).toHaveCount(0)
  await copy.click()
  await copy.click()
  await finish(1, 'resolve')
  await expect(page.locator('.ss3-notice')).toHaveCount(0)
  await finish(2, 'reject')
  await expect(page.locator('.ss3-notice')).toHaveText(page.url())
  await copy.click()
  await finish(3, 'resolve')
  await expect(page.locator('.ss3-notice')).toHaveText('전략 링크를 복사했습니다')
  await copy.click()
  await page.locator('.hub-header').getByRole('button').click()
  await finish(4, 'reject')
  await expect(page.locator('.ss3-notice')).toHaveCount(0)
})

test('달력 양 끝의 비활성 버튼은 포커스를 유지하고 빈 날짜는 수익을 만들지 않는다', async ({ page }) => {
  await open(page, sharedHash({ nick: rows[0].nick, period: '1y' }))
  const next = page.getByRole('button', { name: '다음 월', exact: true })
  const previous = page.getByRole('button', { name: '이전 월', exact: true })
  const month = page.locator('.shared-calendar-heading h3 span[aria-live]')
  const newest = await month.textContent()
  await next.focus()
  await page.keyboard.press('Enter')
  await expect(next).toBeFocused()
  await expect(month).toHaveText(newest!)
  for (let i = 0; i < 16 && await previous.getAttribute('aria-disabled') !== 'true'; i++) await previous.click()
  await expect(previous).toHaveAttribute('aria-disabled', 'true')
  const oldest = await month.textContent()
  await previous.focus()
  await page.keyboard.press('Space')
  await expect(previous).toBeFocused()
  await expect(month).toHaveText(oldest!)
  const blank = page.locator('.cal-c.off')
  expect(await blank.count()).toBeGreaterThan(0)
  for (const item of await blank.all()) {
    await expect(item).toHaveAttribute('aria-label', /평가 기록 없음$/)
    await expect(item.locator('.cal-tooltip, i')).toHaveCount(0)
    await expect(item).not.toHaveAttribute('tabindex', '0')
  }
  const observed = page.locator('.cal-c[tabindex="0"]').first()
  await observed.focus()
  await expect(observed.locator('.cal-tooltip')).toBeVisible()
  await expect(observed.locator('.cal-tooltip')).toHaveText(/[+-]\d+\.\d{2}%/)
  await next.focus()
  await expect(observed.locator('.cal-tooltip')).toBeHidden()
})

test('점수 근거는 원본 4축 기여도와 현재 seed 중앙값을 표시한다', async ({ page }) => {
  const row = rows[0]
  await open(page, sharedHash({ nick: row.nick, period: '1y' }))
  await page.locator('[data-metric="score"]').click()
  const dialog = page.getByRole('dialog', { name: `TETH 점수 ${row.score}점 산출 근거`, exact: true })
  const axes = [['승률', 'winRate', 35, 60, .30, '%'], ['수익 (CAGR)', 'cagr', 0, 6, .28, '%'], ['낙폭 방어', 'mdd', -25, -6, .27, '%'], ['거래 활동', 'tradeVol', 9, 4, .15, '']] as const
  await expect(dialog.locator('.ss3-score-axis')).toHaveCount(4)
  for (const [index, [label, key, lo, hi, weight, unit]] of axes.entries()) {
    const values = rows.map(row => row.result[key]).sort((a, b) => a - b), half = Math.floor(values.length / 2)
    const median = values.length % 2 ? values[half] : (values[half - 1] + values[half]) / 2
    const axis = dialog.locator('.ss3-score-axis').nth(index)
    await expect(axis).toContainText(`${label} ${row.result[key].toFixed(1)}${unit}`)
    await expect(axis).toContainText(`공유 전략 중앙값 ${median.toFixed(1)}${unit}`)
    await expect(axis.locator('b')).toHaveText((Math.max(0, Math.min(1, (row.result[key] - lo) / (hi - lo))) * weight * 100).toFixed(1))
  }
  await page.keyboard.press('Escape')
})

test('공유 분석은 홈 초안을 보존하고 새 대화에서 분석 질문을 전송한다', async ({ page }) => {
  await open(page)
  await returnFromSourceSharing(page)
  const input = page.getByRole('textbox', { name: '시장이나 전략에 대해 물어보세요' })
  await input.fill('아직 보내지 않은 홈 초안')
  await navigation(page)
  await page.locator('.client-util').filter({ hasText: '전략 복사' }).click()
  await detail(page)
  await page.getByRole('button', { name: '최근 1년', exact: true }).click()
  await page.getByRole('button', { name: 'TETH에게 분석시키기', exact: true }).click()
  await expect(page.locator('.g-umsg')).toHaveText(sharedAnalysisRequest(byReturn[0], '1y'))
  await expect(page.locator('.g-urow')).toHaveCount(1)
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!))
  expect(saved.sessions).toHaveLength(1)
  expect(saved.homeDraft).toBe('아직 보내지 않은 홈 초안')
  expect(saved.sessions[0].draft).toBe('')
  if ((page.viewportSize()?.width ?? 0) <= 860) {
    await page.locator('.client-hamburger').click()
    await page.locator('.client-new-strategy').click()
  } else await page.locator('.client-rail-new-row button').click()
  await expect(input).toHaveValue('아직 보내지 않은 홈 초안')
})

test('공유 분석은 현재 초안을 보존한 새 대화를 만들고 응답 중에는 또 만들지 않는다', async ({ page }) => {
  await page.clock.install()
  await open(page)
  await returnFromSourceSharing(page)
  await page.getByRole('textbox', { name: '시장이나 전략에 대해 물어보세요' }).fill('비트코인 하락 후 반등 전략')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await page.clock.fastForward(8000)
  await page.getByRole('button', { name: '질문 카드 닫기', exact: true }).click()
  const previousId = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).currentId)
  const draft = page.getByRole('textbox', { name: 'TETH에게 물어보세요' })
  await draft.fill('현재 대화의 미전송 초안')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await navigation(page)
  await page.locator('.client-util').filter({ hasText: '전략 복사' }).click()
  await detail(page)
  await page.getByRole('button', { name: 'TETH에게 분석시키기', exact: true }).click()
  await expect(page.locator('.g-umsg')).toHaveText(sharedAnalysisRequest(byReturn[0], 'all'))
  await expect(page.locator('.g-urow')).toHaveCount(1)
  const started = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!))
  expect(started.sessions).toHaveLength(2)
  expect(started.currentId).not.toBe(previousId)
  expect(started.sessions.find((session: { id: string }) => session.id === previousId).draft).toBe('현재 대화의 미전송 초안')
  await navigation(page)
  await page.locator('.client-util').filter({ hasText: '전략 복사' }).click()
  await detail(page)
  await page.getByRole('button', { name: 'TETH에게 분석시키기', exact: true }).click()
  await expect(page.locator('.ss3-notice')).toHaveText('이전 답변을 마무리하는 중이에요. 끝나면 다시 눌러주세요.')
  const unchanged = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!))
  expect(unchanged.sessions).toHaveLength(2)
  expect(unchanged.currentId).toBe(started.currentId)
})

test('게스트 공유 분석은 로그인만 요청하고 질문을 전송하지 않는다', async ({ page }) => {
  const hash = sharedHash({ nick: rows[0].nick, period: 'all' })
  await open(page, hash, false)
  const trigger = page.getByRole('button', { name: 'TETH에게 분석시키기', exact: true })
  await trigger.click()
  await expect(page.locator('.ca-auth')).toBeVisible()
  await expect(page.locator('.g-urow')).toHaveCount(0)
  expect(await page.evaluate(() => location.hash)).toBe(hash)
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

for (const width of [320, 1440]) test(`${width}px 공유 목록·상세는 본문 overflow 없이 원본 표와 고유 차트 ID를 보존한다`, async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 900 })
  await open(page)
  await noPageOverflow(page)
  const listIds = await cards(page).locator('svg [id]').evaluateAll(els => els.map(el => el.id))
  expect(new Set(listIds).size).toBe(listIds.length)
  await page.screenshot({ path: info.outputPath(`sharing-list-${width}.png`) })
  await detail(page)
  await noPageOverflow(page)
  for (const action of await page.locator('.tfbk-hero.detail .ss3-dacts > button').all()) {
    const layout = await action.evaluate(el => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const lines = new Set([...range.getClientRects()].filter(rect => rect.width > 0).map(rect => Math.round(rect.top)))
      return { label: el.textContent, lines: lines.size, height: el.getBoundingClientRect().height }
    })
    expect(layout.lines, layout.label!).toBeLessThanOrEqual(2)
    expect(layout.height, layout.label!).toBeGreaterThanOrEqual(44)
  }
  const header = await page.locator('.hub-header').getByRole('button').boundingBox()
  // Source26088 hides the global bell on public/current sharing surfaces.
  // Legacy research bell geometry remains in client-research-bell.spec.ts.
  await expect(page.locator('.client-account-utility')).toHaveCount(0)
  expect(header).not.toBeNull()
  expect(header!.height).toBeGreaterThanOrEqual(44)
  expect(await page.locator('.hub-header').getByRole('button').evaluate(node => {
    const r = node.getBoundingClientRect()
    return [.15, .5, .85].map(fraction => node.contains(document.elementFromPoint(r.left + r.width * fraction, r.top + r.height / 2)))
  })).toEqual([true, true, true])
  await expect(page.getByRole('heading', { name: '누적 수익 곡선', exact: true })).toBeVisible()
  const allIds = await page.locator('.client-strategy-sharing [id]').evaluateAll(els => els.map(el => el.id))
  expect(new Set(allIds).size).toBe(allIds.length)
  expect(await page.locator('.client-strategy-sharing svg').evaluateAll(els => els.flatMap(svg => [...svg.querySelectorAll('[fill],[clip-path]')].map(el => el.getAttribute('fill') ?? el.getAttribute('clip-path')).filter((value): value is string => Boolean(value?.startsWith('url(#'))).filter(value => !svg.querySelector(`[id="${value.slice(5, -1)}"]`))))).toEqual([])
  await page.screenshot({ path: info.outputPath(`sharing-detail-${width}.png`) })
  await expect(page.locator('.client-strategy-sharing table')).toHaveCount(1)
  for (const table of await page.locator('.client-strategy-sharing table').all()) {
    await table.scrollIntoViewIfNeeded()
    const bounds = await table.evaluate(el => {
      const owner = el.parentElement!
      return { overflow: getComputedStyle(owner).overflowX, scroll: owner.scrollWidth, client: owner.clientWidth, table: el.getBoundingClientRect().width }
    })
    if (bounds.table > bounds.client + 1) expect(['auto', 'scroll']).toContain(bounds.overflow)
    await noPageOverflow(page)
  }
  const tableRegion = page.getByRole('region', { name: '최근 검증 시뮬레이션 체결', exact: true })
  await tableRegion.focus()
  await expect(tableRegion).toBeFocused()
  if (width === 320) {
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => tableRegion.evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
  }
  await page.screenshot({ path: info.outputPath(`sharing-performance-${width}.png`) })
  await page.locator('.client-shared-performance > section').first().screenshot({ path: info.outputPath(`sharing-calendar-${width}.png`) })
  expect(errors).toEqual([])
})

test('손상·미존재 상세는 안전한 허브이고 HTML 같은 nickname도 코드로 실행하지 않는다', async ({ page }) => {
  for (const hash of ['#/share/s/%E0%A4%A', '#/share/s/name/1y/extra', sharedHash({ nick: '<img src=x onerror=globalThis.sharedInjected=true>', period: '1y' })]) {
    await open(page, hash)
    await expect(page.locator('.hub-header h1')).toHaveText('전략 복사')
    expect(await names(page)).toHaveLength(catalogueStrategies.length)
    // Approved exchange logos are now legitimate images. User-controlled
    // nickname markup must still never become a DOM node or event handler.
    await expect(page.locator('.client-strategy-sharing img[src="x"], .client-strategy-sharing [onerror], .client-strategy-sharing script')).toHaveCount(0)
    expect(await page.evaluate(() => Reflect.get(window, 'sharedInjected'))).toBeUndefined()
  }
})
