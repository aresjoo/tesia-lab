import { expect, test, type Page } from '@playwright/test'
import type { ClientCopyDetailHistoryProps } from '../src/components/ClientCopyDetailHistory'
import { sourceSharedStrategies } from '../src/client-shared-strategies'
import { sourceTerminalDate, sourceTerminalPrices } from '../src/client-terminal-source-fixture'
import { copyHistoryText, type CopyHistoryKey } from '../src/client-copy-history-copy'
import type { ClientLanguage } from '../src/client-preferences'

// Source b2ee991d index.html cpxHist/cpxShare/cpxBal/cpxTx. Browser fixture is
// intercepted here; no new product route, account request or service data.
const at = Date.UTC(2026, 8, 1)
function fixture(tab: ClientCopyDetailHistoryProps['tab']): ClientCopyDetailHistoryProps {
  const source = sourceSharedStrategies()[0]
  source.nick = 'history-fixture'
  source.result.trades = Array.from({ length: 35 }, (_, i) => ({ entry: i * 2 + 10, exit: i * 2 + 11, pnl: i % 2 ? -0.02 : 0.05, kind: i % 2 ? 'sl' : 'tp', lowVol: false }))
  return { tab, now: at + 5 * 864e5, source,
    copy: { id: 'cp-history', nick: source.nick, mode: 'ratio', amount: 200, pairs: ['BTC/USDT'], simStartI: 0,
      at, status: 'active', adv: { marginMode: 'follow', lev: 'follow', slip: 'sys', maxMarginPct: 95, maxPosX: 5 },
      ledger: [{ at, type: 'add', amt: 200 }, { at: at + 864e5, type: 'add', amt: 100 }, { at: at + 2 * 864e5, type: 'out', amt: 25 }] },
    calculation: { inv: 275, pnlPct: 0.2, total: 40, realized: 30, unreal: 10, share: 3, net: 37, est: 312, avail: 232, posOpen: true, closedN: 35 },
  }
}
async function mount(page: Page, props: ClientCopyDetailHistoryProps, language = 'ko', currency = 'USD') {
  await page.route('**/copy-detail-history-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="fixture"></main></body></html>' }))
  await page.goto('/copy-detail-history-fixture.html')
  await page.evaluate(async ({ props, language, currency }) => {
    localStorage.setItem('tethLang', language)
    localStorage.setItem('tethCurrency', currency)
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientCopyDetailHistory.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
      ?? (await (await fetch('/src/client-preferences.ts')).text()).match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, dom = await import(/* @vite-ignore */ dp), component = await import(/* @vite-ignore */ cp)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    root.render(react.createElement(component.ClientCopyDetailHistory, props))
  }, { props, language, currency })
  await expect(page.locator('#fixture')).not.toBeEmpty()
}

test('청산 이력은 원본 마지막30건 역순·합계·가격·청산 사유와 일치한다', async ({ page }) => {
  const props = fixture('hist'), recent = props.source!.result.trades.slice(-30).reverse()
  await mount(page, props)
  await expect(page.getByRole('table', { name: '청산 이력' })).toBeVisible()
  await expect(page.getByRole('region', { name: '청산 이력' })).toHaveAttribute('tabindex', '0')
  await expect(page.locator('thead th')).toHaveText(['페어', '방향', '진입가', '청산가', '손익', '수익률', '청산 사유', '청산 시각'])
  await expect(page.locator('tbody tr')).toHaveCount(30)
  const sum = recent.reduce((acc, trade) => acc + trade.pnl, 0) * props.copy.amount
  await expect(page.locator('.cpx-sumline')).toHaveText(`청산 30회, 그중 15회 수익. 합계 ${sum.toLocaleString('ko', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT.`)
  for (const [index, trade] of recent.entries()) {
    const cells = page.locator('tbody tr').nth(index).locator('td')
    await expect(cells.nth(2)).toHaveText(Math.round(sourceTerminalPrices[trade.entry]).toLocaleString('ko'))
    await expect(cells.nth(3)).toHaveText(Math.round(sourceTerminalPrices[trade.exit]).toLocaleString('ko'))
    await expect(cells.nth(4)).toHaveText(`${(trade.pnl * 200).toFixed(2)} USDT`)
    await expect(cells.nth(5)).toHaveText(`${trade.pnl >= 0 ? '+' : ''}${(trade.pnl * 100).toFixed(1)}%`)
    await expect(cells.nth(6)).toHaveText(trade.kind === 'tp' ? '목표가 도달' : '손절 규칙')
  }
})

test('종료·정리 snapshot은 변경된 source보다 우선하며 source 없이 원본가격을 표시한다', async ({ page }) => {
  for (const closed of [false, true]) {
    const props = fixture('hist'), saved = props.source!.result.trades.slice(0, 1)
    props.copy = closed ? { ...props.copy, status: 'closed', closedAt: at + 864e5, closedTrades: saved } : { ...props.copy, flatI: saved[0].exit, flatTrades: saved }
    props.source = null
    await mount(page, props)
    await expect(page.locator('tbody tr')).toHaveCount(1)
    await expect(page.locator('tbody td').nth(2)).toHaveText(Math.round(sourceTerminalPrices[saved[0].entry]).toLocaleString('ko'))
    props.source = fixture('hist').source
    await mount(page, props)
    await expect(page.locator('tbody tr')).toHaveCount(1)
  }
})

test('원본누락·종료snapshot누락은 현재source거래를 종료이력으로 만들지 않는다', async ({ page }) => {
  for (const tab of ['hist', 'tx'] as const) {
    const props = fixture(tab)
    props.source = null
    await mount(page, props)
    await expect(page.locator('.cpp-empty')).toContainText('아직 청산된 카피 거래가 없어요')
    await expect(page.getByRole('table')).toHaveCount(0)
  }
  const props = fixture('hist')
  props.copy.status = 'closed'
  await mount(page, props)
  await expect(page.locator('.cpp-empty')).toBeVisible()
})

test('분배 탭은 실현수익만 요약하고 종료일을 고정한다', async ({ page }) => {
  const props = fixture('share')
  props.copy.status = 'closed'
  props.copy.closedAt = at + 864e5
  await mount(page, props)
  await expect(page.locator('.cpp-ai')).toHaveText('분배는 실현 수익에서만 차감돼요. 지금까지 실현 수익 30.00 USDT 중 10%가 분배됐어요.')
  await expect(page.locator('tbody td').nth(1)).toHaveText('30.00 USDT')
  await expect(page.locator('tbody td').nth(2)).toHaveText('3.00 USDT')
  await expect(page.locator('tbody td').nth(3)).toHaveText('0.00 USDT')
  await expect(page.locator('tbody td').first()).not.toContainText('현재')
  const before = await page.locator('#fixture').textContent()
  props.now += 365 * 864e5
  await mount(page, props)
  await expect(page.locator('#fixture')).toHaveText(before!)
  props.calculation.realized = -10
  props.calculation.share = 0
  await mount(page, props)
  await expect(page.locator('.cpp-empty')).toContainText('미실현 수익에는 분배가 붙지 않아요. 손실에는 당연히 없어요.')
})

test('자금 이동은 원장 역순으로 표시하고 손실중3회입금 경고를 원문대로 낸다', async ({ page }) => {
  const props = fixture('bal')
  props.copy.ledger.push({ at: at + 3 * 864e5, type: 'add', amt: 50 })
  props.calculation.pnlPct = -0.25
  await mount(page, props)
  await expect(page.locator('.cpp-ai')).toHaveText('손실 구간에서 입금이 3회 반복됐어요. 반복 충전은 수익률을 실제보다 부풀려 보이게 해요. 금액을 늘리기 전에 전략 자체를 다시 점검해보세요.')
  await expect(page.locator('.cpx-sumline')).toHaveText('입출금 4건. 모든 이동은 스팟 계좌와 카피 계좌 사이에서 일어나요 (최근 180일).')
  await expect(page.locator('tbody tr').first().locator('td').nth(2)).toHaveText('+50.00 USDT')
  await expect(page.locator('tbody tr').nth(1).locator('td').nth(2)).toHaveText('-25.00 USDT')
  await expect(page.locator('tbody tr').nth(1).locator('td').last()).toHaveText('카피 → 스팟')
})

test('거래 명세는 최근10거래의20체결·비용을 보존하고 종료후시간에불변이다', async ({ page }) => {
  const props = fixture('tx')
  props.copy.status = 'closed'
  props.copy.closedAt = at + 5 * 864e5
  props.copy.closedTrades = props.source!.result.trades
  props.source = null
  await mount(page, props)
  await expect(page.locator('.cpx-sumline')).toHaveText('이 카피에서 지금까지 체결 20건이 있었고, 수수료로 약 4.00 USDT, 펀딩비로 약 -0.70 USDT를 지출했어요.')
  await expect(page.locator('details')).not.toHaveAttribute('open')
  await page.locator('summary').click()
  await expect(page.getByRole('table', { name: '원본 거래 내역' })).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(23)
  const summary = await page.locator('.cpx-sumline').innerText()
  props.now += 500 * 864e5
  await mount(page, props)
  await expect(page.locator('.cpx-sumline')).toHaveText(summary)
})

test('표시언어숫자·날짜가적용돼도설정통화로USDT를환산하지않는다', async ({ page }) => {
  const props = fixture('hist'), trade = props.source!.result.trades.at(-1)!
  await mount(page, props, 'fr', 'KRW')
  await expect(page.locator('tbody td').nth(4)).toHaveText('10,00 USDT')
  await expect(page.locator('tbody td').nth(5)).toHaveText('+5,0%')
  await expect(page.locator('tbody td').nth(7)).toHaveText(new Intl.DateTimeFormat('fr', { calendar: 'gregory', month: 'numeric', day: 'numeric' }).format(sourceTerminalDate(trade.exit)))
  await expect(page.locator('#fixture')).not.toContainText('₩')
})

const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
async function preference(page: Page, language: ClientLanguage) {
  await page.evaluate(async language => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', language); setClientPreference('currency', 'KRW')
  }, language)
}
for (const tab of ['hist', 'share', 'bal', 'tx'] as const) test(`${tab}: 7언어는 표·설명·초점·열린명세를 유지하고 원값과 USDT를 보존한다`, async ({ page }, info) => {
  const props = fixture(tab), original = structuredClone(props)
  if (tab === 'bal') { props.copy.ledger.push({ at: at + 3 * 864e5, type: 'add', amt: 50 }); props.calculation.pnlPct = -0.1 }
  const calls: string[] = [], errors: string[] = []
  page.on('request', req => { if (new URL(req.url()).pathname.startsWith('/api/')) calls.push(req.url()) })
  page.on('pageerror', error => errors.push(error.message))
  await mount(page, props)
  await page.addStyleTag({ url: '/src/client-copy-trading.css' })
  await page.addStyleTag({ content: 'body{margin:0;background:#101216;color:#e3e3e3;font-family:system-ui,sans-serif}#fixture{padding:16px;min-width:0}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}' })
  await page.evaluate(() => { document.body.className = 'client-strategy-sharing'; document.getElementById('fixture')!.className = 'cpp' })
  if (tab === 'tx') await page.locator('summary').click()
  const table = await page.locator('table').elementHandle()
  const region = page.getByRole('region')
  await region.focus()
  const counts = { hist: 30, share: 1, bal: 4, tx: 23 }
  const expected: Record<typeof tab, CopyHistoryKey[]> = {
    hist: ['pair', 'direction', 'entryPrice', 'exitPrice', 'pnl', 'return', 'reason', 'exitTime'],
    share: ['period', 'realized', 'settled', 'pending', 'ratio', 'shareAmount'],
    bal: ['at', 'type', 'amount', 'asset', 'direction'],
    tx: ['at', 'category', 'pair', 'quantity', 'fee', 'balanceChange'],
  }
  for (const language of languages) {
    await preference(page, language)
    const h = (key: CopyHistoryKey) => copyHistoryText(language, key)
    await expect(region).toHaveAttribute('aria-label', h(tab === 'tx' ? 'raw' : tab))
    await expect(page.locator('thead th')).toHaveText(expected[tab].map(h))
    await expect(page.locator('caption')).toHaveText(h(tab === 'tx' ? 'raw' : tab))
    await expect(page.locator('tbody tr')).toHaveCount(counts[tab])
    await expect(region).toBeFocused()
    expect(await table!.evaluate(node => node.isConnected)).toBe(true)
    if (language !== 'ko') expect(await page.locator('#fixture').innerText()).not.toMatch(/[가-힣]/)
    await expect(page.locator('#fixture')).not.toContainText('₩')
    expect(await page.locator('#fixture').textContent()).not.toMatch(/\{\w+\}/)
    if (tab === 'hist') await expect(page.locator('tbody td').nth(4)).toHaveText(`${new Intl.NumberFormat(language, {minimumFractionDigits:2}).format(10)} USDT`)
    if (tab === 'share') await expect(page.locator('th[title]')).toHaveAttribute('title', h('ratioHint'))
    if (tab === 'tx') await expect(page.locator('details')).toHaveAttribute('open', '')
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      const geometry = await region.evaluate(node => {
        const r = node.getBoundingClientRect(), first = node.querySelector('th')!.getBoundingClientRect()
        return { width: r.width, first: first.width }
      })
      expect(geometry.first).toBeLessThan(geometry.width * .8)
      if (tab === 'share' && width <= 390) {
        expect(geometry.first).toBeLessThanOrEqual(144)
        await expect(page.locator('tbody td').first()).toContainText(new Intl.DateTimeFormat(language, {calendar:'gregory'}).format(props.copy.at))
      }
      if (language === 'fr' && width === 320) await page.screenshot({ path: info.outputPath(`${tab}-fr-320.png`), fullPage: true })
    }
  }
  expect(props.source).toEqual(original.source); expect(calls).toEqual([]); expect(errors).toEqual([])
})

for (const tab of ['hist', 'share'] as const) test(`${tab}: 빈 이력 안내도 7언어에 따라 표시된다`, async ({ page }) => {
  const props = fixture(tab); props.source = null; props.calculation.realized = -10; props.calculation.share = 0
  await mount(page, props)
  for (const language of languages) {
    await preference(page, language)
    await expect(page.locator('.cpp-empty b')).toHaveText(copyHistoryText(language, tab === 'hist' ? 'emptyTitle' : 'noShareTitle'))
    if (language !== 'ko') expect(await page.locator('#fixture').innerText()).not.toMatch(/[가-힣]/)
    if (tab === 'share' && language === 'en') await expect(page.locator('.nx')).toHaveText('No profit sharing is charged on unrealized profits or on losses.')
    await expect(page.getByRole('table')).toHaveCount(0)
  }
})
