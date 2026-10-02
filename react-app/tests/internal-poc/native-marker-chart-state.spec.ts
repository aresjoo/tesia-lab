import { expect, test, type Page } from '@playwright/test'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }

// Presentation-only adapter fixtures. These are not accepted HTTP receipts or live runs.
// Binding/authentication rejection remains covered by native-fill-markers.spec.ts.
async function mount(page: Page, strict = false) {
  await page.route('**/marker-chart-state-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture"></div></body></html>' }))
  await page.route('**/src/components/ClientProfessionalPriceChart.tsx*', async route => {
    const response = await route.fetch(), body = await response.text()
    expect(body).toContain('api.current = chart;')
    await route.fulfill({ response, body: body.replace('api.current = chart;', 'api.current = chart; window.__markerStateChart = chart;') })
  })
  await page.goto('/marker-chart-state-test.html')
  await page.evaluate(async ({ data, strict }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const rp = '/@id/react', dp = '/@id/react-dom/client', cp = '/src/internal-poc/NativeServiceResult.tsx'
    const react = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp), { NativeServiceResult } = await import(/* @vite-ignore */ cp)
    const skin = '/src/internal-poc/ClientServiceExperience.tsx'
    await import(/* @vite-ignore */ skin)
    const report = Reflect.get(data.sources[1].fixture, 'response').data
    const price = data.sources[0].fixture as unknown as { manifest: { manifestContentHash: string }; window: { requestedRange: { fromInclusive: string; toExclusive: string }; bars: { openTime: string; open: string; high: string; low: string; close: string; volume: string }[] } }
    const trade = Reflect.get(data.sources[2].fixture, 'pages').find((item: { name: string }) => item.name === 'oos-default').response.data
    let failMarkers = false
    Object.assign(window, { failMarkerStateRequest: () => { failMarkers = true } })
    const calls = { report: 0, trades: 0, chart: 0, markers: 0 }
    Object.assign(window, { markerStateCalls: calls })
    const api = {
      report: async () => { calls.report++; return report },
      trades: async () => { calls.trades++; return trade },
      chart: async () => {
        calls.chart++
        return { manifest: price.manifest, window: price.window,
          navigation: { supportedResolutions: ['1m'], availableRange: price.window.requestedRange, previousFromInclusive: null, nextFromInclusive: null },
          view: { identity: 'bound-price-window-fixture', market: 'BTC/USDT', resolutionSeconds: 60, pricePrecision: 3, sourceLabel: 'SYNTHETIC_CONTRACT_FIXTURE · UI 상태 시험', fills: [],
            bars: price.window.bars.map(bar => ({ time: Date.parse(bar.openTime) / 1000, open: Number(bar.open), high: Number(bar.high), low: Number(bar.low), close: Number(bar.close), volume: Number(bar.volume) })) },
        }
      },
      markers: async (_manifest: unknown, _trades: unknown, cursor?: string) => {
        calls.markers++
        if (Reflect.get(window, 'delayMarkerPresentation')) await new Promise<void>(resolve => Reflect.set(window, 'resolveMarkerPresentation', resolve))
        if (failMarkers) { failMarkers = false; throw { code: 'AUTHENTICATION_REQUIRED' } }
        const second = Boolean(cursor), row = trade.trades[0], bar = price.window.bars[second ? price.window.bars.length - 1 : 0]
        return { binding: { segment: 'OOS' }, manifestContentHash: price.manifest.manifestContentHash, tradeManifestContentHash: trade.tradeManifestContentHash,
          pageContentHash: (second ? 'b' : 'a').repeat(64), nextCursor: second ? undefined : 'second-marker-page', markers: [{
            fillRef: second ? row.exitFillRef : row.entryFillRef, tradeEntryFillRef: row.entryFillRef, tradeExitFillRef: row.exitFillRef,
            occurredAt: bar.openTime, price: second ? row.exitPrice : row.entryPrice, side: second ? 'SELL' : 'BUY',
          }],
        }
      },
    }
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    const element = react.createElement ?? react.default.createElement
    const component = element(NativeServiceResult, { api, job: { backtestId: report.binding.backtestId } })
    root.render(strict ? element(react.StrictMode ?? react.default.StrictMode, null, component) : component)
    Reflect.set(window, 'unmountMarkerPresentation', () => root.unmount())
    Object.assign(window, { mountMarkerAutoReplay: async () => {
      const path = '/src/components/ClientProfessionalPriceChart.tsx'
      const { ClientProfessionalPriceChart } = await import(/* @vite-ignore */ path)
      const result = await api.chart()
      const bars = result.view.bars
      const view = { ...result.view, fills: [
        { id: 'first-buy', tradeId: 'first-and-last-trade', side: 'BUY', time: bars[0].time, price: bars[0].close },
        { id: 'last-sell', tradeId: 'first-and-last-trade', side: 'SELL', time: bars[bars.length - 1].time, price: bars[bars.length - 1].close },
      ] }
      const events: boolean[] = []
      Reflect.set(window, 'markerAutoReplayEvents', events)
      root.render(element(ClientProfessionalPriceChart, { view, autoReplay: true, onReplayChange: (playing: boolean) => events.push(playing), onFillSelect: (fill: { id: string }) => Reflect.set(window, 'markerAutoSelectedFill', fill.id) }))
    } })
  }, { data: fixtures, strict })
  await expect(page.getByRole('button', { name: '체결 마커 조회', exact: true })).toBeEnabled()
  await page.evaluate(() => document.fonts.ready)
}

test('체결 페이지 교체는 가격 차트 DOM·눈금·지표·거래량·확대 범위를 유지한다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '로그', exact: true }).click()
  await page.getByRole('button', { name: 'EMA 20', exact: true }).click()
  await page.getByRole('button', { name: '거래량', exact: true }).click()
  await page.evaluate(() => {
    Reflect.set(window, 'markerStateCanvas', document.querySelector('.cp-chart canvas'))
    Reflect.get(window, '__markerStateChart').timeScale().setVisibleLogicalRange({ from: -3, to: 4 })
  })
  await page.getByRole('button', { name: '체결 마커 조회', exact: true }).click()
  await expect(page.getByRole('region', { name: '체결 마커 조회', exact: true })).toContainText('1페이지')
  await page.getByRole('group', { name: /가격 캔들 및 BUY/ }).press('Home')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('BUY')
  await page.getByRole('button', { name: '다음 체결 마커 페이지', exact: true }).click()
  await expect(page.getByRole('region', { name: '체결 마커 조회', exact: true })).toContainText('2페이지')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toHaveCount(0)
  await page.getByRole('group', { name: /가격 캔들 및 BUY/ }).press('End')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('SELL')
  await expect(page.getByRole('button', { name: '로그', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'EMA 20', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '거래량', exact: true })).toHaveAttribute('aria-pressed', 'false')
  expect(await page.evaluate(() => Reflect.get(window, 'markerStateCanvas') === document.querySelector('.cp-chart canvas'))).toBe(true)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__markerStateChart').timeScale().getVisibleLogicalRange())).toEqual({ from: -3, to: 4 })
  expect(await page.evaluate(() => Reflect.get(window, 'markerStateCalls'))).toEqual({ report: 1, trades: 1, chart: 1, markers: 2 })
})

test('재생 중 마커 교체는 재생을 중단하거나 뒤늦은 과거 체결을 새 효과로 재연하지 않는다', async ({ page }) => {
  await page.clock.install()
  await mount(page)
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await page.clock.runFor(10_000)
  const before = Number(await page.getByRole('progressbar', { name: '결과 설명 재생' }).getAttribute('value'))
  await page.getByRole('button', { name: '체결 마커 조회', exact: true }).click()
  await expect(page.getByRole('region', { name: '체결 마커 조회', exact: true })).toContainText('1페이지')
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await expect(page.locator('.cp-execution')).toHaveCount(0)
  await page.clock.runFor(1000)
  expect(Number(await page.getByRole('progressbar', { name: '결과 설명 재생' }).getAttribute('value'))).toBeGreaterThan(before)
  await page.getByRole('button', { name: '다음 체결 마커 페이지', exact: true }).click()
  await expect(page.getByRole('region', { name: '체결 마커 조회', exact: true })).toContainText('2페이지')
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await expect(page.locator('.cp-execution')).toHaveCount(0)
  await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  await page.getByRole('group', { name: /가격 캔들 및 BUY/ }).press('End')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('SELL')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).not.toContainText('BUY')
})

test('권한 오류로 마커가 제거돼도 가격 설정은 보존하고 이전 체결은 남기지 않는다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '체결 마커 조회', exact: true }).click()
  await expect(page.getByRole('region', { name: '체결 마커 조회', exact: true })).toContainText('1페이지')
  await page.getByRole('group', { name: /가격 캔들 및 BUY/ }).press('Home')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('BUY')
  await page.getByRole('button', { name: '로그', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'failMarkerStateRequest')())
  await page.getByRole('button', { name: '다음 체결 마커 페이지', exact: true }).click()
  await expect(page.getByRole('region', { name: '체결 마커 조회', exact: true }).getByRole('alert')).toBeVisible()
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '로그', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('자동 재생 첫 tick 전에 최초 마커를 준비하고 자연 완료 뒤 마지막 SELL을 보존한다', async ({ page }) => {
  await page.clock.install()
  await mount(page)
  await page.evaluate(() => Reflect.get(window, 'mountMarkerAutoReplay')())
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await expect(page.locator('.cp-execution')).toContainText('BUY')
  await page.clock.runFor(100)
  await expect(page.locator('.cp-execution')).toContainText('BUY')
  expect(await page.evaluate(() => Reflect.get(window, 'markerAutoReplayEvents'))).toEqual([true])
  await page.clock.runFor(60_000)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  await page.getByRole('group', { name: /가격 캔들 및 BUY/ }).press('End')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('SELL')
  await page.locator('[aria-label="조회 구간 체결"] button').click()
  expect(await page.evaluate(() => Reflect.get(window, 'markerAutoSelectedFill'))).toBe('last-sell')
  expect(await page.evaluate(() => Reflect.get(window, 'markerAutoReplayEvents'))).toEqual([true, false])
})

test('결과 설명은 첫 마커 페이지 확인 후 같은 캔버스에서 전체 창 재생하고 Skip으로 복귀한다', async ({ page }, info) => {
  await page.clock.install()
  await mount(page)
  const trigger = page.getByRole('button', { name: '차트로 결과 보기', exact: true })
  await page.locator('.cp-chart canvas').first().evaluate(node => Reflect.set(window, 'presentationCanvas', node))
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: '백테스트 터미널', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await expect(dialog.locator('.cp-execution')).toContainText('BUY')
  await expect(dialog.getByRole('button', { name: 'Skip · 결과 보기', exact: true })).toBeFocused()
  await expect(dialog.locator('.ctt-rail')).toBeHidden()
  await expect(dialog.getByText('합성 계약 fixture · 실제 시장 성과 아님', { exact: true })).toBeVisible()
  await dialog.getByText('청산 검증 불가 · 계산 가정과 데이터 한계', { exact: true }).click()
  await expect(dialog.getByText(/현재 MMR 미검증/)).toBeVisible()
  await dialog.getByText('청산 검증 불가 · 계산 가정과 데이터 한계', { exact: true }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'markerStateCalls'))).toEqual({ report: 1, trades: 1, chart: 1, markers: 1 })
  await page.clock.runFor(10_000)
  await expect(dialog.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await page.screenshot({ path: info.outputPath('native-result-replay.png') })
  await dialog.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  await expect(page.getByText(/현재 MMR 미검증/)).toBeVisible()
  expect(await page.evaluate(() => Reflect.get(window, 'presentationCanvas') === document.querySelector('.cp-chart canvas'))).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'markerStateCalls'))).toEqual({ report: 1, trades: 1, chart: 1, markers: 1 })
  await page.getByRole('group', { name: /가격 캔들 및 BUY/ }).press('Home')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('BUY')
})

test('전체 창 재생은 60초 자연 완료와 모션 감소 설정에서 원래 결과로 복귀한다', async ({ page }) => {
  await page.clock.install()
  await mount(page)
  const trigger = page.getByRole('button', { name: '차트로 결과 보기', exact: true })
  await trigger.click()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await page.clock.runFor(59_000)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.clock.runFor(1_000)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await trigger.click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  await expect(page.locator('.cp-chart')).toContainText('모션 줄이기 설정')
  await expect(trigger).toBeFocused()
})

test('체결 응답 대기 중 Skip은 늦은 응답으로 다시 열거나 재생하지 않는다', async ({ page }) => {
  await page.clock.install()
  await mount(page)
  await page.evaluate(() => Reflect.set(window, 'delayMarkerPresentation', true))
  const trigger = page.getByRole('button', { name: '차트로 결과 보기', exact: true })
  await trigger.click()
  await expect(page.getByRole('status', { name: '' }).filter({ hasText: '체결 데이터 확인 중' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => typeof Reflect.get(window, 'resolveMarkerPresentation'))).toBe('function')
  await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'resolveMarkerPresentation')())
  await expect(trigger).toBeEnabled()
  await page.clock.runFor(61_000)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  expect(await page.evaluate(() => Reflect.get(window, 'markerStateCalls'))).toEqual({ report: 1, trades: 1, chart: 1, markers: 1 })
})

test('체결 확인 실패는 재생 성공으로 처리하지 않고 오류와 키보드 복귀를 유지한다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => Reflect.get(window, 'failMarkerStateRequest')())
  await page.getByRole('button', { name: '차트로 결과 보기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '백테스트 터미널', exact: true })
  await expect(dialog.getByRole('region', { name: '체결 마커 조회' }).getByRole('alert')).toBeVisible()
  await expect(dialog.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  await expect(dialog.locator('.cp-execution')).toHaveCount(0)
  expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: '차트로 결과 보기', exact: true })).toBeFocused()
})

test('320px 이전 지표 탭 선택 후에도 전체 창 재생 차트와 Skip이 가려지지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.clock.install()
  await mount(page)
  await page.getByRole('button', { name: '터미널에서 보기', exact: true }).click()
  await page.getByRole('tab', { name: '검증 지표', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '차트로 결과 보기', exact: true }).click()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.ctt-market')).not.toHaveAttribute('inert')
  await expect(dialog.locator('.cp-chart canvas').first()).toBeVisible()
  expect(await dialog.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1)
  const skip = dialog.getByRole('button', { name: 'Skip · 결과 보기', exact: true })
  const box = await skip.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  await skip.click()
  await expect(dialog).toHaveCount(0)
})

test('체결 준비 중 결과가 언마운트되면 늦은 응답과 타이머가 화면을 되살리지 않는다', async ({ page }) => {
  await page.clock.install()
  await mount(page)
  await page.evaluate(() => Reflect.set(window, 'delayMarkerPresentation', true))
  await page.getByRole('button', { name: '차트로 결과 보기', exact: true }).click()
  await expect.poll(() => page.evaluate(() => typeof Reflect.get(window, 'resolveMarkerPresentation'))).toBe('function')
  await page.evaluate(() => Reflect.get(window, 'unmountMarkerPresentation')())
  await page.evaluate(() => Reflect.get(window, 'resolveMarkerPresentation')())
  await page.clock.runFor(61_000)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.cp-chart')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('재생 중 화면 이동과 언마운트는 차트·스크롤 잠금을 정리하고 서버 요청을 늘리지 않는다', async ({ page }) => {
  await page.clock.install()
  await mount(page)
  await page.getByRole('button', { name: '차트로 결과 보기', exact: true }).click()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await page.evaluate(() => { location.hash = '#another-page' })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  await page.getByRole('button', { name: '차트로 결과 보기', exact: true }).click()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await page.evaluate(() => Reflect.get(window, 'unmountMarkerPresentation')())
  await page.clock.runFor(61_000)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.cp-chart')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  expect(await page.evaluate(() => Reflect.get(window, 'markerStateCalls'))).toEqual({ report: 1, trades: 1, chart: 1, markers: 2 })
})

test('인라인 50초 재생 중 전체 창 진입은 첫 체결부터 새로운60초를 재생한다', async ({ page }) => {
  await page.clock.install()
  await mount(page)
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await page.clock.runFor(50_000)
  await page.getByRole('button', { name: '차트로 결과 보기', exact: true }).click()
  await expect(page.locator('.cp-execution')).toContainText('BUY')
  await page.clock.runFor(11_000)
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await page.clock.runFor(48_000)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.clock.runFor(1_000)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('일반 터미널 닫기는 선택 체결을 지우거나 기존 인라인 재생을 중단하지 않는다', async ({ page }) => {
  await page.clock.install()
  await mount(page)
  await page.getByRole('button', { name: '체결 마커 조회', exact: true }).click()
  await page.getByRole('group', { name: /가격 캔들 및 BUY/ }).press('Home')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('BUY')
  await page.getByRole('button', { name: '터미널에서 보기', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('BUY')
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await page.clock.runFor(10_000)
  await page.getByRole('button', { name: '터미널에서 보기', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await page.clock.runFor(50_000)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
})

test('준비 취소는 늦은 첫 페이지로 사용자가 보던 둘째 체결 페이지를 덮지 않는다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '체결 마커 조회', exact: true }).click()
  await page.getByRole('button', { name: '다음 체결 마커 페이지', exact: true }).click()
  await expect(page.getByRole('region', { name: '체결 마커 조회' })).toContainText('2페이지')
  await page.evaluate(() => Reflect.set(window, 'delayMarkerPresentation', true))
  await page.getByRole('button', { name: '차트로 결과 보기', exact: true }).click()
  await expect.poll(() => page.evaluate(() => typeof Reflect.get(window, 'resolveMarkerPresentation'))).toBe('function')
  await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  await page.evaluate(async () => { Reflect.get(window, 'resolveMarkerPresentation')(); await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))) })
  await expect(page.getByRole('region', { name: '체결 마커 조회' })).toContainText('2페이지')
  await expect(page.getByRole('button', { name: '첫 체결 마커 페이지 다시 조회', exact: true })).toBeEnabled()
  await page.getByRole('group', { name: /가격 캔들 및 BUY/ }).press('End')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('SELL')
})

test('StrictMode 재설정 후에도 전체 창 재생은 한 번만 시작하고 초점·잠금을 정리한다', async ({ page }) => {
  await page.clock.install()
  await mount(page, true)
  const before = await page.evaluate(() => Reflect.get(window, 'markerStateCalls'))
  const trigger = page.getByRole('button', { name: '차트로 결과 보기', exact: true })
  await trigger.click()
  await expect(page.locator('.cp-execution')).toContainText('BUY')
  await page.clock.runFor(59_000)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.clock.runFor(1_000)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  expect(await page.evaluate(() => Reflect.get(window, 'markerStateCalls'))).toEqual({ ...before, markers: 1 })
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})
