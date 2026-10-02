import { expect, test, type Page } from '@playwright/test'
import type { SharedStrategy, SharedLocation } from '../../src/client-shared-strategies'

test.setTimeout(25_000)
function strategy(): SharedStrategy {
  const parameters = { sl: -4, tp: 10, rsiTh: 31, trendFilter: false, startI: 0, endI: 59 }
  return { nick: 'supplied', title: '공급된 전략', asset: '비트코인', score: 88, parameters, result: {
    params: parameters, eq: [{ i: 0, v: 1 }, { i: 31, v: 1.1 }, { i: 59, v: 1.123 }], trades: [{ entry: 0, exit: 31, pnl: .1, kind: 'tp', lowVol: false }],
    ret: 12.3, mdd: -1, winRate: 100, n: 1, pf: 4, byYear: { '2031': { prod: 1.123, pnl: .123, n: 1, w: 1 } }, worstYear: '2031', bestYear: '2031', worstYearPnl: 12.3, bestYearPnl: 12.3,
    mddStartI: 1, mddEndI: 2, underwaterDays: 1, cagr: 12, sharpe: 1, sortino: 1, calmar: 1, exposure: 50, tradeVol: 1, avgHold: 31, lossCount: 0, lowVolLosses: 0, lowVolLossShare: 0, costImpact: .2,
  } }
}
async function mount(page: Page) {
  await page.route('**/sharing-result-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#101114"><main id="research-main"><div id="result-test-root"></div></main></body></html>' }))
  await page.goto('/sharing-result-test.html')
  await page.evaluate(async row => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const rp = '/@id/react', dp = '/@id/react-dom/client', cp = '/src/components/ClientStrategySharing.tsx', pp = '/src/client-preferences.ts', skin = '/src/internal-poc/ClientServiceExperience.tsx'
    await import(/* @vite-ignore */skin)
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, dom = await import(/* @vite-ignore */dp), { ClientStrategySharing } = await import(/* @vite-ignore */cp), preferences = await import(/* @vite-ignore */pp)
    preferences.setClientPreference('language', 'ko')
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('result-test-root'))
    let location: SharedLocation = { nick: row.nick, period: 'all' }, current: SharedStrategy['result'] | null = row.result, fail = false, missingYear = false
    const provider = { state: 'ready', strategies: [row], watched: [],
      periodResult: (_row: SharedStrategy, period: string) => { if (fail) throw new Error('PRIVATE_RESULT_PROVIDER_SECRET'); return missingYear && period === '1y' ? null : current },
      indexToDate: (i: number) => new Date(Date.UTC(2031, 0, i + 1)), entryPrice: () => 123, exitPrice: () => 135,
      metricDetails: () => ({ strategyNick: row.nick, period: location.period, revision: 'unchanged-score-evidence', sourceLabel: 'SUPPLIED SOURCE', score: { value: 88, description: '공급된 점수 설명', axes: [] } }),
      onValidateCopy: () => new Promise(resolve => Reflect.set(window, 'settleRefreshCopy', () => resolve({ score: 88, result: row.result }))),
    }
    const render = () => root.render(React.createElement(React.StrictMode, null, React.createElement(ClientStrategySharing, {
      owner: 'owner-a', location, onNavigate: (next: SharedLocation) => { location = next; render() }, onAsk: async () => {}, onReturn: () => {}, signedIn: true, onLogin: () => {}, servicePresentation: provider,
    })))
    const next = { ...row.result, ret: 27.4, mdd: -2.5, n: 2, avgHold: 15,
      eq: [{ i: 151, v: 1 }, { i: 181, v: 1.2 }, { i: 212, v: 1.274 }],
      trades: [{ entry: 151, exit: 181, pnl: .2, kind: 'tp' as const, lowVol: false }, { entry: 181, exit: 212, pnl: .0617, kind: 'time' as const, lowVol: false }],
    }
    Object.assign(window, {
      resultRefresh: () => { current = next; render() }, resultRestore: () => { current = row.result; fail = false; render() },
      resultMissing: () => { current = null; render() }, resultFail: () => { fail = true; render() },
      resultMissingYear: () => { missingYear = true; render() },
      resultSame: () => { current = structuredClone(current); render() }, resultRerender: render,
    }); render()
  }, strategy())
  await expect(page.locator('[data-metric="ret"] b')).toHaveText('+12.3%')
}

test('RED: 같은 공급자·전략·기간에서 getter 결과만 교체해도 최신 성과·차트·체결표가 반영된다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => Reflect.get(window, 'resultRefresh')())
  await expect(page.locator('[data-metric="ret"] b')).toHaveText('+27.4%', { timeout: 2000 })
  await expect(page.locator('.ss3-matrix button.mx').nth(2)).toContainText('-2.5%')
  await expect(page.locator('.ss3-tbl tbody tr')).toHaveCount(2)
  await expect(page.locator('.ss3-tbl')).toContainText('2031.08.01')
  await expect(page.locator('.client-shared-equity-chart')).toContainText('+27.4%')
})

test('RED: 같은 점수 근거라도 결과가 교체되면 열린 지표 모달은 닫힌다', async ({ page }) => {
  await mount(page); await page.locator('[data-metric="score"]').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'resultRefresh')())
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 2000 })
  await expect(page.locator('[data-metric="score"]')).toBeFocused()
  await page.evaluate(() => Reflect.get(window, 'resultRestore')())
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('RED: 새 검증 결과의 달력은 이전 결과 월 선택을 물려받지 않는다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '이전 월', exact: true }).click()
  await expect(page.locator('.shared-calendar-heading h3').first()).toContainText('2031년 2월')
  await page.evaluate(() => Reflect.get(window, 'resultRefresh')())
  await expect(page.locator('.shared-calendar-heading h3').first()).toContainText('2031년 8월', { timeout: 2000 })
})

test('동일 내용 재공급은 열린 모달과 선택 월·동일 차트 DOM을 보존한다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '이전 월', exact: true }).click()
  await page.evaluate(() => Reflect.set(window, 'refreshOriginalChart', document.querySelector('.ss3-chart')))
  await page.locator('[data-metric="score"]').click()
  await page.evaluate(() => Reflect.get(window, 'resultSame')())
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.shared-calendar-heading h3').first()).toContainText('2031년 2월')
  expect(await page.evaluate(() => Reflect.get(window, 'refreshOriginalChart') === document.querySelector('.ss3-chart'))).toBe(true)
})

test('차트 키보드 선택은 새 관측으로 섞이지 않고 같은 SVG는 유지한다', async ({ page }) => {
  await mount(page)
  const chart = page.locator('.ss3-chart')
  await chart.focus(); await page.keyboard.press('End')
  await expect(page.locator('.ss3-xtip')).toContainText('+12.30%')
  await page.evaluate(() => Reflect.set(window, 'refreshOriginalChart', document.querySelector('.ss3-chart')))
  await page.evaluate(() => Reflect.get(window, 'resultRefresh')())
  await expect(page.locator('.ss3-xtip')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'refreshOriginalChart') === document.querySelector('.ss3-chart'))).toBe(true)
  await page.keyboard.press('End'); await expect(page.locator('.ss3-xtip')).toContainText('+27.40%')
})

test('복제 검증 중 원본 결과가 교체되면 모달을 폐기하고 늦은 검증으로 다시 열지 않는다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '따라하기', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: '확정하고 검증 시작', exact: true })).toBeDisabled()
  await page.evaluate(() => Reflect.get(window, 'resultRefresh')())
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '따라하기', exact: true })).toBeFocused()
  await page.evaluate(() => Reflect.get(window, 'settleRefreshCopy')())
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('[data-metric="ret"] b')).toHaveText('+27.4%')
})

test('동일 공급자에서 특정 기간 공급만 철회하면 해당 버튼만 즉시 비활성화한다', async ({ page }) => {
  await mount(page)
  await expect(page.getByRole('button', { name: '최근 1년', exact: true })).toBeEnabled()
  await page.locator('[data-metric="score"]').click()
  await page.evaluate(() => Reflect.get(window, 'resultMissingYear')())
  // The selected all-period evidence did not change. An unrelated period must
  // not close the current sheet or discard the reader's context.
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '최근 1년', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '최근 2년', exact: true })).toBeEnabled()
  await expect(page.locator('[data-metric="ret"] b')).toHaveText('+12.3%')
})

for (const state of ['resultMissing', 'resultFail']) {
  test(`${state}: 철회·오류에서 이전 결과와 모달을 표시하지 않고 원문 오류를 숨긴다`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
    await mount(page); await page.locator('[data-metric="score"]').click()
    await page.evaluate(state => Reflect.get(window, state)(), state)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('[data-metric="ret"] b')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('PRIVATE_RESULT_PROVIDER_SECRET')
    await page.evaluate(() => Reflect.get(window, 'resultRestore')())
    await expect(page.locator('[data-metric="ret"] b')).toHaveText('+12.3%')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
