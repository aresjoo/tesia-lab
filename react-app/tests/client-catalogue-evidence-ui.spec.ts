import { expect, test, type Page } from '@playwright/test'
import { createCatalogueEvidenceOracle } from './fixtures/catalogue-evidence-source-oracle'
import { computeCatalogueBacktest } from '../src/client-catalogue-backtest-result'
import { CatalogueMarketData } from '../src/client-catalogue-market-data'
import spot from '../src/client-catalogue-spot-data.json' with { type: 'json' }
import futures from '../src/client-catalogue-futures-data.json' with { type: 'json' }
import type { CatalogueBacktestObservation } from '../src/client-catalogue-backtest'

test('원본 oracle는 마지막 목록 선언과 plain 후처리·원본 미니차트를 독립 실행한다', () => {
  const value = computeCatalogueBacktest({ owner: 'bt-owner-a', strategyId: 'd1', period: 365, amount: 1000 }, new CatalogueMarketData(spot, futures))
  const oracle = createCatalogueEvidenceOracle(value)
  expect(oracle.decisions.length).toBeGreaterThan(value.judgments.length)
  expect(oracle.list('all').length).toBeGreaterThan(36)
  expect(oracle.page('all').match(/ROW:/g)).toHaveLength(12)
  expect(oracle.page('all')).toContain('BT.decN=36;')
  expect(oracle.page('all')).toContain('class="bt-ym"')
  expect(oracle.page('all', 'big')).not.toContain('class="bt-ym"')
  const buy = oracle.decisions.find(d => d.k === 'buy')!
  expect(buy.act).toContain('매수')
  expect(oracle.mini(buy.ix)).toContain('viewBox="0 0 400 176"')
})

test('전체 판단과 같은 날 묶음은 축약 요약이 아니라 원본 D·EV의 모든 필드와 결속된다', () => {
  const data = new CatalogueMarketData(spot, futures)
  for (const strategyId of ['r1', 'd1', 'f7']) for (const period of [90, 365, 730, 0] as const) {
    const value = computeCatalogueBacktest({ owner: 'bt-owner-a', strategyId, period, amount: 1000 }, data)
    const oracle = createCatalogueEvidenceOracle(value)
    const expected = oracle.decisions.map(raw => {
      const { e, ...decision } = raw
      return { ...decision, eventIndex: value.result.events.indexOf(e), runId: value.runId }
    })
    const groups = oracle.groups.map(raw => {
      const { ds, ...group } = raw
      return { ...group, decisionIndices: ds.map(decision => decision.ix), runId: value.runId }
    })
    // JSON normalizes VM realm prototypes and optional undefined properties,
    // not numbers, ordering, fields, copy, provenance, or event identities.
    expect(value.evidence.decisions, `${strategyId}/${period}/D`).toEqual(JSON.parse(JSON.stringify(expected)))
    expect(value.evidence.dailyGroups, `${strategyId}/${period}/EV`).toEqual(JSON.parse(JSON.stringify(groups)))
    expect(value.evidence.runId).toBe(value.runId)
    expect(value.evidence.source).toBe('client-snapshot-preview')
    // Observation provenance is the frozen market snapshot commit, not the
    // separate 9fb HTML commit from which this display oracle was extracted.
    expect(value.evidence.sourceSha).toBe(value.sourceSha)
    expect(value.evidence.prices.source).toBe('client-snapshot-close')
    expect(value.evidence.prices.calendarStartIndex).toBe(0)
    for (const series of value.evidence.prices.series) expect(series.values).toEqual(spot.px[series.asset as keyof typeof spot.px])
  }
})

// Real catalogue worker + frozen prices. This harness has no account/provider
// authority; every request outside this local Vite origin is rejected.
async function openEvidence(page: Page, strategy = 'd1') {
  const rejected: string[] = []
  const origin = new URL(test.info().project.use.baseURL!).origin
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || !['GET', 'HEAD'].includes(request.method()) || url.pathname.startsWith('/api/')) {
      rejected.push(`${request.method()} ${url.pathname}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.route('**/catalogue-evidence-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#171717;color:#ececec"><main id="fixture"></main></body></html>' }))
  await page.goto('/catalogue-evidence-test.html')
  await page.evaluate(async strategy => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (v: unknown) => v, __vite_plugin_react_preamble_installed__: true })
    const path = '/tests/fixtures/catalogue-backtest-host.tsx'
    const fixture = (await import(/* @vite-ignore */path)).mount()
    Reflect.set(window, 'btFixture', fixture)
    fixture.strategy(strategy)
  }, strategy)
  await expect(page.getByRole('button', { name: '과거를 다시 돌려 보기', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '과거를 다시 돌려 보기', exact: true }).click()
  await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-phase', 'run')
  await page.getByRole('button', { name: '바로 결과 보기', exact: true }).click()
  await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-phase', 'result')
  return rejected
}

async function observed(page: Page, strategyId = 'd1') {
  return page.evaluate(async strategyId => Reflect.get(window, 'btFixture').run({ owner: 'bt-owner-a', strategyId, period: 365, amount: 1000 }), strategyId) as Promise<CatalogueBacktestObservation>
}

async function rowIdentities(page: Page) {
  return page.locator('#bt-dl .bt-row[data-decision-index],#bt-dl .bt-row[data-daily-group-index]').evaluateAll(rows => rows.map(row => row.hasAttribute('data-daily-group-index')
    ? `e:${row.getAttribute('data-daily-group-index')}` : `d:${row.getAttribute('data-decision-index')}`))
}

async function expandHoldGroups(page: Page) {
  // Source skbGroupHolds (24969) compacts consecutive hold decisions by
  // default. The approved accessible expansion exposes their identities;
  // do not mistake the compact visual row count for lost source decisions.
  const closed = page.locator('#bt-dl .bt-hold-group > .skb-grp > button[aria-expanded="false"]')
  while (await closed.count()) await closed.first().click()
}

test('원본 final 판단 탭·정렬·월 그룹·12개와 24개 추가를 보존한다', async ({ page }, info) => {
  const rejected = await openEvidence(page)
  await page.screenshot({ path: info.outputPath('whole-evidence-baseline.png'), fullPage: true })
  const section = page.locator('#bt-dec')
  // Final btEvidence (23707), followed by SKB_EXACT (24900). The earlier
  // baseline failed before this label: #bt-dec itself did not exist.
  await expect(section.getByRole('heading', { name: '판단 기록', exact: true })).toBeVisible()
  await section.getByRole('tab', { name: /전체 기록/ }).click()
  const value = await observed(page), oracle = createCatalogueEvidenceOracle(value)
  const groups = section.locator('.bt-hold-group')
  expect(await groups.count(), 'final source hold summaries remain compact initially').toBeGreaterThan(0)
  await expect(groups.locator('.bt-hold-members')).toHaveCount(0)
  for (const summary of await groups.locator('.skb-grp > button').all()) {
    await expect(summary).toHaveAttribute('aria-expanded', 'false')
    await expect(summary).toContainText(/그대로 유지 \d+번/)
  }
  await expandHoldGroups(page)
  expect(await rowIdentities(page)).toEqual(oracle.list().slice(0, 12).map(row => `d:${row.d!.ix}`))
  await expect(section.getByRole('combobox', { name: '정렬', exact: true })).toHaveValue('new')
  // Month grouping remains in source btDecRows; final source CSS8167 hides
  // its headings. Do not resurrect the intermediate visible design.
  await expect(section.locator('.bt-ym').first()).toBeHidden()
  expect(await section.locator('.bt-ym').count()).toBeGreaterThan(0)
  await section.getByRole('button', { name: /이전 판단 더 보기/ }).click()
  await expandHoldGroups(page)
  expect(await rowIdentities(page)).toEqual(oracle.list().slice(0, 36).map(row => `d:${row.d!.ix}`))
  await expect(section.locator('.bt-s4 .k-all b')).toHaveText(`${oracle.list().length}건`)
  for (const filter of ['all', 'buy', 'sell', 'opp']) {
    await section.locator(`.bt-s4 .k-${filter}`).click()
    for (const sort of ['new', 'old', 'big']) {
      await section.getByRole('combobox', { name: '정렬', exact: true }).selectOption(sort)
      const expected = oracle.list(filter, sort)
      await expandHoldGroups(page)
      expect(await rowIdentities(page), `${filter}/${sort}`).toEqual(expected.slice(0, 12).map(row => row.ev ? `e:${row.ev.ix}` : `d:${row.d!.ix}`))
      await expect(section.locator('.bt-row.on')).toHaveCount(0)
      if (sort === 'big') await expect(section.locator('.bt-ym')).toHaveCount(0)
    }
  }
  expect(rejected).toEqual([])
})

test('동일 날짜의 다종목 판단 마커는 실제 포인터로 근거에 접근한다', async ({ page }, info) => {
  const rejected = await openEvidence(page)
  const value = await observed(page), oracle = createCatalogueEvidenceOracle(value)
  const width = await page.locator('.bt-chart').evaluate(el => el.clientWidth)
  const shared = oracle.markers(width).find(marker => marker.k === 'buy' && marker.n > 1)!
  expect(shared, 'source d1 same-day multi-asset purchase must remain reachable').toBeTruthy()
  const marker = page.locator(`.bt-chart [data-marker-index="${shared.ix}"]`)
  await marker.scrollIntoViewIfNeeded()
  const point = await marker.boundingBox()
  expect(point).not.toBeNull()
  await page.mouse.click(point!.x + point!.width / 2, point!.y + point!.height / 2)
  await page.screenshot({ path: info.outputPath('same-day-pointer-baseline.png'), fullPage: true })
  await expect(page.locator('.bt-row.on')).toHaveCount(1)
  await expect(page.locator('.bt-row.on .bt-dd-in')).toBeVisible()
  const expected = oracle.selectMarker(shared.ix)
  await expect(page.locator('.bt-row.on')).toHaveAttribute('data-daily-group-index', String(expected.selected.ix))
  const group = oracle.groups[expected.selected.ix], buys = group.ds.filter(d => d.k === 'buy')
  expect(buys.length).toBeGreaterThan(1)
  for (const buy of buys) await expect(page.locator('.bt-row.on .bt-dd-in')).toContainText(buy.tk)
  await expect(page.locator('.bt-row.on')).toHaveAttribute('data-run-id', value.runId)
  await page.locator('.bt-row.on > .bt-rb').press('Enter')
  await expect(page.locator('.bt-row.on')).toHaveCount(0)
  await marker.focus()
  await marker.press('Enter')
  await expect(page.locator('.bt-row.on')).toHaveAttribute('data-daily-group-index', String(expected.selected.ix))
  expect(rejected).toEqual([])
})

test('축약한 차트 밖의 모든 판단도 전체 목록에서 키보드로 정확한 원장에 접근한다', async ({ page }) => {
  const rejected = await openEvidence(page)
  const value = await observed(page), oracle = createCatalogueEvidenceOracle(value)
  await page.locator('#bt-dec .bt-s4 .k-all').click()
  const list = page.locator('details.bt-marker-list')
  await list.locator('summary').focus()
  await list.locator('summary').press('Enter')
  await expect(list).toHaveAttribute('open', '')
  const identities = await list.locator('[data-marker-decision-index]').evaluateAll(buttons => buttons.map(button => Number(button.getAttribute('data-marker-decision-index'))))
  expect(identities).toEqual(oracle.decisions.map(decision => decision.ix))
  const outsideFirstPage = oracle.list('all').slice(36).find(row => row.d?.k === 'hold')!.d!
  const trigger = list.locator(`[data-marker-decision-index="${outsideFirstPage.ix}"]`)
  await trigger.focus()
  await trigger.press('Enter')
  const row = page.locator(`#bt-dl .bt-row[data-decision-index="${outsideFirstPage.ix}"]`)
  await expect(row).toHaveClass(/\bon\b/)
  await expect(row.locator('.bt-dd-in')).toBeVisible()
  await expect(row).toHaveAttribute('data-run-id', value.runId)
  await expect(row).toHaveAttribute('data-event-index', String(value.result.events.findIndex(event => event.i === outsideFirstPage.e.i && event.t === outsideFirstPage.e.t && event.a === outsideFirstPage.e.a && event.tid === outsideFirstPage.e.tid)))
  // Deselecting an implicitly expanded hold must not unmount its focused
  // button. The user's keyboard position belongs to the selected ledger row.
  await row.locator(':scope > .bt-rb').focus()
  await row.locator(':scope > .bt-rb').press('Enter')
  await expect(row.locator(':scope > .bt-rb')).toBeFocused()
  await expect(row.locator(':scope > .bt-rb')).toHaveAttribute('aria-expanded', 'false')
  await expect(row.locator('.bt-dd-in')).toHaveCount(0)
  expect(rejected).toEqual([])
})

test('SVG 판단 마커는 실제 Chromium 접근성 트리에 이름 있는 버튼으로 노출된다', async ({ page }) => {
  const rejected = await openEvidence(page)
  const marker = page.locator('.bt-chart [data-marker-index]').first()
  const label = await marker.getAttribute('aria-label')
  expect(label).toBeTruthy()
  await marker.focus()
  const session = await page.context().newCDPSession(page)
  const { root } = await session.send('DOM.getDocument')
  const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.bt-chart [data-marker-index]' })
  const { nodes } = await session.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false })
  expect(nodes.some(node => !node.ignored && node.role?.value === 'button' && node.name?.value === label)).toBe(true)
  await session.detach()
  expect(rejected).toEqual([])
})

test('선택으로 자동 펼친 유지 묶음은 상세를 닫아도 사용자의 초점을 제거하지 않는다', async ({ page }) => {
  const rejected = await openEvidence(page)
  const value = await observed(page), oracle = createCatalogueEvidenceOracle(value)
  const rows = oracle.list().slice(0, 12)
  const month = (index: number) => new Date(Date.parse(`${value.calendar.start}T00:00:00Z`) + index * 86_400_000).toISOString().slice(0, 7)
  const member = rows.find((row, i) => row.d?.title === '그대로 유지' && rows[i + 1]?.d?.title === '그대로 유지' && month(row.d.i) === month(rows[i + 1].d!.i))!.d!
  expect(member).toBeTruthy()
  await page.locator('details.bt-marker-list > summary').click()
  await page.locator(`[data-marker-decision-index="${member.ix}"]`).click()
  const row = page.locator(`.bt-hold-members .bt-row[data-decision-index="${member.ix}"]`)
  await expect(row).toHaveClass(/\bon\b/)
  const button = row.locator(':scope > .bt-rb')
  await button.focus()
  await button.press('Enter')
  await expect(button).toBeFocused()
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(row.locator('.bt-dd-in')).toHaveCount(0)
  const group = page.locator('.bt-hold-group').filter({ has: row })
  const trade = page.locator('#bt-tl .bt-tr').first()
  await trade.locator(':scope > .bt-rb').click()
  await expect(trade).toHaveClass(/\bon\b/)
  await group.locator(':scope > .skb-grp > button').click()
  await expect(trade).toHaveClass(/\bon\b/)
  await expect(trade.locator('.bt-dd-in')).toBeVisible()
  expect(rejected).toEqual([])
})

test('선물 보류 상세의 이후 변화는 승인된 원장 배지 수치와 동일하게 설명한다', async ({ page }) => {
  const rejected = await openEvidence(page, 'f5')
  const value = await observed(page, 'f5')
  const decision = value.evidence.decisions[6]
  expect(decision.k).toBe('skip')
  expect(decision.out?.mute).toBe(1)
  await page.locator('details.bt-marker-list > summary').click()
  await page.locator(`[data-marker-decision-index="${decision.ix}"]`).click()
  const row = page.locator(`#bt-dl [data-decision-index="${decision.ix}"]`)
  await expect(row.locator('.bt-dd-in')).toBeVisible()
  const rounded = +decision.out!.v.toFixed(1), expected = `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`
  await expect(row.locator('.ot i')).toHaveText(expected)
  // The original also mixed futures out.v with a recomputed spot change.
  // ROOT explicitly approved repairing that inconsistency, not replacing
  // the display-only spot mini-chart or changing the underlying backtest.
  await expect(row.locator('.bt-after b')).toHaveText(expected)
  expect(rejected).toEqual([])
})

test('전체 판단 목록 안의 Home·End 키가 바깥 차트 관측값을 바꾸지 않는다', async ({ page }) => {
  const rejected = await openEvidence(page)
  const chart = page.locator('.bt-chart'), list = chart.locator('details.bt-marker-list')
  await list.locator('summary').click()
  const button = list.locator('[data-marker-decision-index]').first()
  await button.focus()
  const before = await chart.getByRole('status').textContent()
  for (const key of ['End', 'Home', 'ArrowRight', 'ArrowLeft']) {
    await button.press(key)
    await expect(chart.getByRole('status')).toHaveText(before!)
    await expect(button).toBeFocused()
  }
  expect(rejected).toEqual([])
})

for (const strategy of ['r1', 'f1', 'f7']) test(`${strategy} 원본 개별 거래 근거·미니차트 경로와 조건선을 보존한다`, async ({ page }, info) => {
  const rejected = await openEvidence(page, strategy)
  const value = await observed(page, strategy), oracle = createCatalogueEvidenceOracle(value)
  const section = page.locator('#bt-dec')
  await section.locator('.bt-s4 .k-buy').click()
  await section.getByRole('combobox', { name: '정렬', exact: true }).selectOption('old')
  const decision = oracle.list('buy', 'old')[0].d!
  const row = page.locator(`.bt-row[data-decision-index="${decision.ix}"]`)
  await row.locator('.bt-rb').focus()
  await row.locator('.bt-rb').press('Enter')
  await expect(row).toHaveAttribute('data-event-index', String(value.result.events.findIndex(event => event.i === decision.e.i && event.t === decision.e.t && event.a === decision.e.a && event.tid === decision.e.tid)))
  await expect(row).toHaveAttribute('data-run-id', value.runId)
  const mini = row.locator('svg.bt-mini')
  await expect(mini).toBeVisible()
  await expect(mini).toHaveAttribute('viewBox', '0 0 400 176')
  const original = oracle.mini(decision.ix)
  expect(await mini.locator('path').first().getAttribute('d')).toBe(original.match(/<path d="([^"]+)"/)![1])
  expect(await mini.locator('circle').count()).toBe((original.match(/<circle /g) ?? []).length)
  expect(await mini.locator('line').count()).toBe((original.match(/<line /g) ?? []).length)
  const originalLines = await page.evaluate(html => [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('line')].map(line => ({
    x1: Number(line.getAttribute('x1')), x2: Number(line.getAttribute('x2')),
    y1: Number(line.getAttribute('y1')), y2: Number(line.getAttribute('y2')),
    color: line.getAttribute('stroke'),
    text: line.nextElementSibling?.textContent,
    textY: Number(line.nextElementSibling?.getAttribute('y')),
  })), original)
  const actualLines = await mini.locator('line').evaluateAll(lines => lines.map(line => ({
    x1: Number(line.getAttribute('x1')), x2: Number(line.getAttribute('x2')),
    y1: Number(line.getAttribute('y1')), y2: Number(line.getAttribute('y2')),
    color: line.getAttribute('stroke'),
    text: line.nextElementSibling?.textContent,
    textY: Number(line.nextElementSibling?.getAttribute('y')),
  })))
  if (strategy === 'r1' || strategy === 'f1') expect(actualLines.some(line => line.text?.startsWith('손절 '))).toBe(true)
  for (const [index, line] of actualLines.entries()) {
    expect({ ...line, y1: undefined, y2: undefined, textY: undefined }).toEqual({ ...originalLines[index], y1: undefined, y2: undefined, textY: undefined })
    // Original SVG rounds its coordinate attributes to one decimal place;
    // compare that exact serialization, not a looser visual tolerance.
    for (const key of ['y1', 'y2', 'textY'] as const) expect(line[key].toFixed(1)).toBe(originalLines[index][key].toFixed(1))
  }
  await expect(row.locator('.bt-dd-in')).toContainText(decision.tk)
  if (strategy === 'f7') await expect(row.locator('.bt-dd-c > small')).toContainText('현물 종가(참고)')
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await row.scrollIntoViewIfNeeded()
    expect(await row.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    const box = await mini.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
    await page.screenshot({ path: info.outputPath(`${strategy}-mini-${width}.png`) })
  }
  expect(rejected).toEqual([])
})

test('nullable 지표는 실제 결과 UI에서도 단위 없는 대시로 표시한다', async ({ page }) => {
  // Explicit test-only nullable observation. The actual worker still runs;
  // only contract-permitted optional metrics are withheld after its reply.
  await page.addInitScript(() => {
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args)
        let handler: Worker['onmessage'] = null
        Object.defineProperty(this, 'onmessage', { configurable: true, get: () => handler, set: value => { handler = value } })
        this.addEventListener('message', event => {
          const reply = event.data
          if (reply?.kind === 'result') {
            for (const key of ['avgHold', 'underwaterDays', 'pf', 'cagr', 'exposure', 'costImpact']) reply.value.result[key] = null
            Reflect.set(window, 'nullableCatalogueObservation', reply.value)
          }
          handler?.call(this, new MessageEvent('message', { data: reply }))
        })
      }
    }
  })
  const rejected = await openEvidence(page, 'r1')
  expect(await page.evaluate(async () => {
    const path = '/src/client-catalogue-backtest.ts'
    const { validCatalogueBacktestObservation } = await import(/* @vite-ignore */path)
    return validCatalogueBacktestObservation(Reflect.get(window, 'nullableCatalogueObservation'), { owner: 'bt-owner-a', strategyId: 'r1', period: 365, amount: 1000 })
  })).toBe(true)
  await expect(page.locator('.bt-k3 > div').filter({ has: page.getByText('평균 보유', { exact: true }) }).locator('b')).toHaveText('—')
  const metrics = page.locator('details.bt-tech')
  await metrics.locator('summary').click()
  for (const name of ['손익비', '1년으로 환산한 수익률', '종목을 들고 있던 시간', '낸 수수료', '가장 길게 회복을 기다린 기간']) {
    await expect(metrics.locator('.bt-tech-g > div').filter({ has: page.getByRole('button', { name, exact: true }) }).locator('dd')).toHaveText('—')
  }
  await expect(page.getByTestId('catalogue-backtest-shell')).not.toContainText(/null일|undefined일|—일/)
  expect(rejected).toEqual([])
})

test('판단 근거와 조건 연결의 색상은 최종 원본 scope 및 승인된 CSS 구문 복원을 따른다', async ({ page }) => {
  const rejected = await openEvidence(page, 'f5')
  const value = await observed(page, 'f5')
  const decision = value.evidence.decisions.find(d => d.chain && d.k === 'skip')!
  expect(decision).toBeTruthy()
  await page.locator('details.bt-marker-list > summary').click()
  await page.locator(`[data-marker-decision-index="${decision.ix}"]`).click()
  const row = page.locator(`#bt-dl [data-decision-index="${decision.ix}"]`)
  await expect(row.locator('.bt-jb')).toBeVisible()
  // Source8064/65 and8074/76 apply through an ancestor #g-content.
  // The React shell must not require a nonexistent descendant #g-content.
  await expect(row.locator('.bt-jb')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(row.locator('.bt-jb h4')).toHaveCSS('color', 'rgb(205, 205, 205)')
  await expect(row.locator('.bt-chain .ok')).toHaveCSS('color', 'rgb(205, 205, 205)')
  await expect(row.locator('.bt-chain .no')).toHaveCSS('color', 'rgb(255, 255, 255)')
  // Source6712 has border:0!important; it overrides later color-only rules
  // too. Preserve the final borderless/currentColor result, not an earlier
  // declaration that does not win the actual cascade.
  await expect(row.locator('.bt-chain .no')).toHaveCSS('border-top-width', '0px')
  await expect(row.locator('.bt-chain .no')).toHaveCSS('border-top-color', 'rgb(255, 255, 255)')
  // Source8064/8075 themselves contain invalid rgba syntax. This border
  // expectation is ROOT-approved syntax repair, not original computed parity.
  await expect(row.locator('.bt-jb')).toHaveCSS('border-top-color', 'rgba(255, 255, 255, 0.14)')
  await expect(row.locator('.bt-chain .ok')).toHaveCSS('border-top-width', '0px')
  await expect(row.locator('.bt-chain .ok')).toHaveCSS('border-top-color', 'rgb(205, 205, 205)')
  expect(rejected).toEqual([])
})

test('다른 run과 owner로 바뀌면 선택·상세·기존 가격 근거를 남기지 않는다', async ({ page }) => {
  const rejected = await openEvidence(page, 'r1')
  const value = await observed(page, 'r1')
  await page.locator('#bt-dec .bt-s4 .k-buy').click()
  await page.locator('#bt-dl .bt-row > .bt-rb').first().click()
  await expect(page.locator('.bt-row.on')).toHaveCount(1)
  await page.getByRole('button', { name: '조건을 바꿔 다시 돌리기', exact: true }).click()
  await expect(page.locator('.bt-row.on,.bt-mini')).toHaveCount(0)
  await page.getByRole('group', { name: '기간', exact: true }).getByRole('button', { name: '최근 3개월', exact: true }).click()
  await page.getByRole('button', { name: '과거를 다시 돌려 보기', exact: true }).click()
  await page.getByRole('button', { name: '바로 결과 보기', exact: true }).click()
  await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-phase', 'result')
  await expect.poll(() => page.locator('[data-run-id]').evaluateAll((elements, oldRunId) => elements.filter(element => element.getAttribute('data-run-id') === oldRunId).length, value.runId)).toBe(0)
  await expect(page.locator('.bt-row.on,.bt-mini')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'btFixture').owner('bt-owner-b'))
  await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-phase', 'ready')
  await expect(page.locator('#bt-dec,.bt-row.on,.bt-mini')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'btFixture').owner(null))
  await expect(page.getByTestId('catalogue-backtest-unavailable')).toBeVisible()
  await expect(page.locator('[data-marker-index],#bt-dec,.bt-mini')).toHaveCount(0)
  expect(rejected).toEqual([])
})

test('원본 agent 결과 세 칸은 종목 체결 수가 아니라 재평가 날짜와 유지·매수 의미를 표시한다', async ({ page }) => {
  const rejected = await openEvidence(page)
  const value = await observed(page), oracle = createCatalogueEvidenceOracle(value)
  const count = (kind: string) => oracle.decisions.filter(d => d.k === kind).length
  // Final btSumCells22563 + SKB_EXACT24900. Agent nOpp is EV.length,
  // not buy+skip: multiple assets on one day remain one reassessment.
  const expected = [
    ['1AI 재평가', `${oracle.groups.length}번`, `${value.result.eq.length.toLocaleString()}일 동안`],
    ['2시장 확인', `쉬어 감 ${count('skip')}번`, `유지 ${count('hold')}번`],
    ['3거래 결과', `종목 매수 ${count('buy')}번`, `끝난 거래 ${value.result.trades.length}번`],
  ]
  const cells = page.locator('.bt-panel .pc > .cell')
  await expect(cells).toHaveCount(3)
  expect(await cells.evaluateAll(items => items.map(cell => ['small', 'b', 'span'].map(tag => cell.querySelector(`:scope > ${tag}`)?.textContent)))).toEqual(expected)
  for (const filter of ['opp', 'skip', 'buy']) {
    await page.locator(`.bt-panel .pc button.k-${filter}`).click()
    await expect(page.locator(`#bt-dec .bt-s4 .k-${filter}`)).toHaveAttribute('aria-selected', 'true')
    await expandHoldGroups(page)
    expect(await rowIdentities(page)).toEqual(oracle.list(filter).slice(0, 12).map(row => row.ev ? `e:${row.ev.ix}` : `d:${row.d!.ix}`))
  }
  expect(rejected).toEqual([])
})

test('원본 같은 날 진입 거래는 원장 입력 순서를 안정적으로 보존한다', async ({ page }) => {
  const rejected = await openEvidence(page)
  const oracle = createCatalogueEvidenceOracle(await observed(page))
  const first = oracle.trades.slice(0, 8)
  expect(first.some((trade, i) => i > 0 && trade.e === first[i - 1].e)).toBe(true)
  expect(await page.locator('#bt-tl .bt-tr').evaluateAll(rows => rows.map(row => Number(row.getAttribute('data-trade-id'))))).toEqual(first.map(trade => trade.id))
  expect(rejected).toEqual([])
})

test('원본 거래 행은 ticker와 매수·매도 날짜 보조문구 및 기간 머리글을 유지한다', async ({ page }) => {
  const rejected = await openEvidence(page)
  // btTrRows22787 uses mkTk, not the Korean asset name. The final skbText
  // replacement changes the exact text 기간 to 보유 기간 on this header.
  await expect(page.locator('#bt-tl .bt-th > span').nth(3)).toHaveText('보유 기간')
  const rows = page.locator('#bt-tl .bt-tr')
  const value = await observed(page)
  for (const row of await rows.all()) {
    const id = Number(await row.getAttribute('data-trade-id'))
    const decision = value.evidence.decisions.find(d => d.tid === id && d.k === 'buy')!
    expect.soft(await row.locator('.bt-rb > b').textContent()).toBe(decision.tk)
    expect.soft(await row.locator('.bt-rb > time').nth(0).locator('i').allTextContents()).toEqual(['매수'])
    expect.soft(await row.locator('.bt-rb > time').nth(1).locator('i').allTextContents()).toEqual(['매도'])
    break
  }
  expect(rejected).toEqual([])
})

test('원본 여섯 지표 설명은 초점·hover·Escape와 좁은 화면 양끝 가시성을 유지한다', async ({ page }) => {
  const rejected = await openEvidence(page, 'r1')
  const original = [
    ['승률', '끝난 거래 중 이익으로 끝난 거래의 비율입니다.'],
    ['손익비', '이긴 거래에서 번 돈을 진 거래에서 잃은 돈으로 나눈 값입니다. 1보다 크면 번 돈이 더 많습니다.'],
    ['1년으로 환산한 수익률', '이 기간의 수익률을 1년 기준으로 바꾼 값입니다.'],
    ['종목을 들고 있던 시간', '전체 기간 중 종목을 들고 있던 날의 비율입니다. 나머지는 현금으로 기다렸습니다.'],
    ['낸 수수료', '살 때와 팔 때 낸 수수료를 모두 더한 값입니다. 위 결과는 이 수수료를 뺀 뒤의 값입니다.'],
    ['가장 길게 회복을 기다린 기간', '잔고가 그 전 가장 높았던 값으로 돌아오기까지 걸린 가장 긴 기간입니다.'],
  ]
  const tech = page.locator('details.bt-tech')
  await tech.locator('summary').click()
  await expect(tech.locator('.bt-tech-g > div')).toHaveCount(6)
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const [label, hint] of original) {
      const button = tech.getByRole('button', { name: label, exact: true })
      await button.focus()
      const tooltip = button.getByRole('tooltip')
      await expect(tooltip).toHaveText(hint)
      await expect(tooltip).toBeVisible()
      await expect(button).toHaveAttribute('aria-describedby', await tooltip.getAttribute('id') as string)
      const box = await tooltip.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
      await button.press('Escape')
      await expect(tooltip).toHaveCount(0)
      await expect(button).toBeFocused()
      await page.mouse.move(0, 0)
      await button.hover()
      await expect(tooltip).toBeVisible()
      await button.press('Escape')
      await expect(tooltip).toHaveCount(0)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  expect(rejected).toEqual([])
})
