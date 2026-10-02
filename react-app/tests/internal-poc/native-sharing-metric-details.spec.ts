import { expect, test, type Page } from '@playwright/test'
import type { SharedMetricPresentation } from '../../src/client-sharing-presentation'
import type { SharedStrategy, SharedLocation } from '../../src/client-shared-strategies'
import { sharingDetailCopy } from '../../src/client-sharing-detail-copy'
import { sharingUnavailable } from '../../src/client-sharing-presentation'

test.setTimeout(25_000)

function evidence(): SharedMetricPresentation {
  return { strategyNick: 'supplied-author', period: 'all', revision: 'evidence-r7', sourceLabel: 'SUPPLIED VALIDATION SOURCE',
    score: { value: 88, description: '공급된 점수 산정 설명', axes: [
      { key: 'winRate', valueLabel: 'SUPPLIED 61.234%', contribution: 19.26, maximum: 30, barPercent: 64.2, benchmark: { valueLabel: 'SUPPLIED MEDIAN 58.12%', barPercent: 47.3, comparisonLabel: '공급된 비교: 중앙값 위' } },
      { key: 'cagr', valueLabel: '+7.34%', contribution: 27.72, maximum: 28, barPercent: 99 },
      { key: 'mdd', valueLabel: '-3.42%', contribution: 26.46, maximum: 27, barPercent: 98 },
      { key: 'tradeVol', valueLabel: 'SUPPLIED ACTIVITY', contribution: 14.56, maximum: 15, barPercent: 97.0667 },
    ], notices: ['공급된 표본 주의사항'], criteria: '공급된 평가 기준이며 주문 승인 권한이 아닙니다.' },
    definitions: [
      { key: 'ret', description: '공급된 검증 수익 정의. 해당 결과는 제공된 수수료 모델을 따릅니다.', valueLabel: '+12.3%', sourceLabel: 'SUPPLIED RETURN METHOD' },
      { key: 'pf', description: '공급된 손익비 정의' }, { key: 'hold', description: '공급된 보유 기간 정의' },
      { key: 'mdd', description: '공급된 낙폭 평가 방식' }, { key: 'n', description: '공급된 거래 집계 방식' },
    ],
  }
}
function strategy(): SharedStrategy {
  const parameters = { sl: -4, tp: 10, rsiTh: 31, trendFilter: false, startI: 0, endI: 3 }
  return { nick: 'supplied-author', title: '공급된 전략', asset: '비트코인', score: 88, parameters, result: {
    params: parameters, eq: [{ i: 0, v: 1 }, { i: 1, v: 1.03 }, { i: 2, v: 1.02 }, { i: 3, v: 1.123 }], trades: [],
    ret: 12.3, mdd: -1, winRate: 100, n: 2, pf: 4, byYear: { '2031': { prod: 1.123, pnl: .123, n: 2, w: 2 } }, worstYear: '2031', bestYear: '2031', worstYearPnl: 12.3, bestYearPnl: 12.3,
    mddStartI: 1, mddEndI: 2, underwaterDays: 1, cagr: 12, sharpe: 1, sortino: 1, calmar: 1, exposure: 50, tradeVol: 1, avgHold: 1, lossCount: 0, lowVolLosses: 0, lowVolLossShare: 0, costImpact: .2,
  } }
}
type FixtureState = { owner: string; location: SharedLocation; evidence: SharedMetricPresentation | null; throwProvider?: boolean }

async function mount(page: Page) {
  await page.route('**/sharing-metric-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#101114"><main id="research-main"><div id="metric-test-root"></div></main></body></html>' }))
  await page.goto('/sharing-metric-test.html')
  await page.evaluate(async ({ row, evidence }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const rp = '/@id/react', dp = '/@id/react-dom/client', cp = '/src/components/ClientStrategySharing.tsx', pp = '/src/client-preferences.ts', skin = '/src/internal-poc/ClientServiceExperience.tsx'
    await import(/* @vite-ignore */skin)
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, dom = await import(/* @vite-ignore */dp), { ClientStrategySharing } = await import(/* @vite-ignore */cp), preferences = await import(/* @vite-ignore */pp)
    preferences.setClientPreference('language', 'ko')
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('metric-test-root'))
    const state: FixtureState = { owner: 'owner-a', location: { nick: row.nick, period: 'all' }, evidence }
    // Intentionally retain the provider object across updates. Its synchronous
    // getter may read a refreshed cache without changing the provider identity.
    const presentation = { state: 'ready', strategies: [row], watched: [], periodResult: () => row.result,
      indexToDate: (i: number) => new Date(Date.UTC(2031, 0, i + 1)),
      metricDetails: () => { if (state.throwProvider) throw new Error('PRIVATE_PROVIDER_CREDENTIAL'); return state.evidence },
    }
    const render = (patch: Partial<FixtureState> = {}) => {
      Object.assign(state, patch)
      root.render(React.createElement(React.StrictMode, null, React.createElement(ClientStrategySharing, {
        owner: state.owner, location: state.location, onNavigate: (location: SharedLocation) => render({ location }), onAsk: async () => {}, onReturn: () => {}, signedIn: true, onLogin: () => {},
        servicePresentation: presentation,
      })))
    }
    Object.assign(window, { metricState: state, metricRender: render }); render()
  }, { row: strategy(), evidence: evidence() })
  await expect(page.locator('.ss3-dtitle')).toContainText('공급된 전략')
}
async function score(page: Page) { await page.locator('[data-metric="score"]').click(); await expect(page.getByRole('dialog')).toBeVisible() }
async function close(page: Page) { await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0) }

test('실제 공유 상세의 원본 4축·기여도·중앙값 막대는 공급값을 그대로 표시한다', async ({ page }, info) => {
  await mount(page); await score(page)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading')).toContainText('88점')
  await expect(dialog.locator('.ss3-score-axis')).toHaveCount(4)
  const win = dialog.locator('[data-score-axis=winRate]')
  await expect(win).toContainText('SUPPLIED 61.234%'); await expect(win).toContainText('19.3')
  await expect(win).toContainText('SUPPLIED MEDIAN 58.12%'); await expect(win).toContainText('공급된 비교: 중앙값 위')
  expect(await win.locator('.ss3-score-bar i').evaluate(node => (node as HTMLElement).style.width)).toBe('64.2%')
  expect(await win.locator('.ss3-score-bar u').evaluate(node => (node as HTMLElement).style.left)).toBe('47.3%')
  await expect(dialog).toContainText('공급된 평가 기준'); await expect(dialog).toContainText('SUPPLIED VALIDATION SOURCE')
  await expect(dialog).not.toContainText('35% 감점'); await expect(dialog).not.toContainText('80점 이상만 실행')
  await page.screenshot({ path: info.outputPath('shared-score-supplied.png'), fullPage: true })
  await close(page); await expect(page.locator('[data-metric="score"]')).toBeFocused()
})

test('모든 지표 설명은 공급 정의·값·출처를 사용하고 고정 수수료·청산 가정을 넣지 않는다', async ({ page }) => {
  await mount(page)
  for (const [index, key, expected] of [[0, 'ret', '공급된 검증 수익 정의'], [2, 'mdd', '공급된 낙폭 평가 방식'], [3, 'pf', '공급된 손익비 정의'], [4, 'hold', '공급된 보유 기간 정의'], [5, 'n', '공급된 거래 집계 방식']] as const) {
    const button = page.locator('.ss3-matrix button.mx').nth(index)
    await button.click()
    await expect(page.locator(`[data-shared-metric=${key}]`)).toContainText(expected)
    await expect(page.getByRole('dialog')).not.toContainText('0.2%'); await expect(page.getByRole('dialog')).not.toContainText('25봉')
    if (key === 'ret') await expect(page.getByRole('dialog')).toContainText('SUPPLIED RETURN METHOD')
    await close(page); await expect(button).toBeFocused()
  }
})

for (const issue of ['missing', 'strategy', 'period', 'revision', 'score', 'scoreInfinity', 'NaN', 'range', 'excess', 'duplicate'] as const) {
  test(`${issue} 근거는 합성하지 않고 해당 근거를 거부한다`, async ({ page }) => {
    await mount(page)
    await page.evaluate(issue => {
      const state = Reflect.get(window, 'metricState') as FixtureState, next = structuredClone(state.evidence!)
      if (issue === 'strategy') next.strategyNick = 'another-strategy'
      if (issue === 'period') next.period = '1y'
      if (issue === 'revision') next.revision = ' '
      if (issue === 'score') next.score!.value = 87
      if (issue === 'scoreInfinity') next.score!.value = Infinity
      if (issue === 'NaN') next.score!.axes[0].contribution = NaN
      if (issue === 'range') { next.score!.axes[0].barPercent = 100.01; next.score!.axes[0].benchmark!.barPercent = -1 }
      if (issue === 'excess') next.score!.axes[0].contribution = 30.01
      if (issue === 'duplicate') next.score!.axes = [...next.score!.axes, { ...next.score!.axes[0] }]
      Reflect.get(window, 'metricRender')({ evidence: issue === 'missing' ? null : next })
    }, issue)
    await score(page)
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('.ss3-score-axis')).toHaveCount(4)
    await expect(dialog.locator('[data-score-axis=winRate] .ss3-score-bar i')).toHaveCount(0)
    await expect(dialog).toContainText(sharingUnavailable('ko'))
    await expect(dialog).not.toContainText('NaN'); await expect(dialog).not.toContainText('Infinity')
    if (['missing', 'strategy', 'period', 'revision', 'score', 'scoreInfinity'].includes(issue)) await expect(dialog.locator('.ss3-score-bar i')).toHaveCount(0)
    else await expect(dialog.locator('[data-score-axis=cagr] .ss3-score-bar i')).toHaveCount(1)
    if (issue === 'score') await expect(dialog.getByRole('heading')).toHaveText('TETH 점수')
  })
}

test('중복 지표 정의만 미공급으로 처리하며 일반 설명을 지어내지 않는다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    const state = Reflect.get(window, 'metricState') as FixtureState, next = structuredClone(state.evidence!)
    next.definitions = [next.definitions![0], next.definitions![0]]
    Reflect.get(window, 'metricRender')({ evidence: next })
  })
  await page.locator('.ss3-matrix button.mx').first().click()
  await expect(page.getByRole('dialog')).toContainText(sharingUnavailable('ko'))
  await expect(page.getByRole('dialog')).not.toContainText('공급된 검증 수익 정의')
})

test('부분 축 공급은 원본 4축 자리와 실제 공급된 축만 유지한다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    const state = Reflect.get(window, 'metricState') as FixtureState, next = structuredClone(state.evidence!)
    next.score!.axes = [next.score!.axes[0]]
    Reflect.get(window, 'metricRender')({ evidence: next })
  })
  await score(page)
  await expect(page.locator('.ss3-score-axis')).toHaveCount(4)
  await expect(page.locator('.ss3-score-bar i')).toHaveCount(1)
  await expect(page.locator('[data-score-axis=cagr]')).toContainText(sharingUnavailable('ko'))
  await expect(page.locator('[data-score-axis=winRate]')).toContainText('SUPPLIED MEDIAN 58.12%')
})

test('긴 공급 원문은 320px 모달 안에서 줄바꿈되고 근거 마지막 줄까지 스크롤된다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 }); await mount(page)
  await page.evaluate(() => {
    const state = Reflect.get(window, 'metricState') as FixtureState, next = structuredClone(state.evidence!)
    next.score!.description = 'LongProvidedEvidenceWithoutSpaces'.repeat(40)
    next.score!.axes[0].valueLabel = 'LongProvidedValue'.repeat(20)
    next.score!.axes[0].benchmark!.valueLabel = 'LongProvidedMedian'.repeat(20)
    next.score!.criteria = 'END_OF_SUPPLIED_EVIDENCE'
    Reflect.get(window, 'metricRender')({ evidence: next })
  })
  await score(page)
  const dialog = page.getByRole('dialog')
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  await dialog.locator('.ss3-dialog-body').evaluate(node => { node.scrollTop = node.scrollHeight })
  await expect(dialog.getByText('END_OF_SUPPLIED_EVIDENCE')).toBeInViewport()
  await close(page); await expect(page.locator('[data-metric="score"]')).toBeFocused()
})

for (const change of ['owner', 'route', 'revision', 'evidence'] as const) {
  test(`${change} 변경은 이전 근거 모달을 닫고 늦은 데이터로 다시 열지 않는다`, async ({ page }) => {
    await mount(page); await score(page)
    await page.evaluate(change => {
      const state = Reflect.get(window, 'metricState') as FixtureState, next = structuredClone(state.evidence!)
      Reflect.set(window, 'previousMetricEvidence', state.evidence)
      if (change === 'revision') next.revision = 'evidence-r8'
      if (change === 'evidence') next.score!.description = '교정된 공급 설명'
      Reflect.get(window, 'metricRender')(change === 'owner' ? { owner: 'owner-b' } : change === 'route' ? { location: { nick: 'supplied-author', period: '1y' } } : { evidence: next })
    }, change)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.evaluate(() => Reflect.get(window, 'metricRender')({ owner: 'owner-a', location: { nick: 'supplied-author', period: 'all' }, evidence: Reflect.get(window, 'previousMetricEvidence') }))
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await score(page); await expect(page.getByRole('dialog')).toContainText('SUPPLIED MEDIAN 58.12%')
  })
}

test('HTML 및 provider 예외는 실행·노출되지 않는다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await page.evaluate(() => {
    const state = Reflect.get(window, 'metricState') as FixtureState, next = structuredClone(state.evidence!)
    next.definitions = [{ key: 'ret', description: '<img src=x onerror=alert(1)>공급된 텍스트', sourceLabel: '<script>secret</script>' }]
    Reflect.get(window, 'metricRender')({ evidence: next })
  })
  await page.locator('.ss3-matrix button.mx').first().click()
  await expect(page.getByRole('dialog')).toContainText('<img src=x onerror=alert(1)>')
  await expect(page.getByRole('dialog').locator('img,script')).toHaveCount(0); await close(page)
  await page.evaluate(() => Reflect.get(window, 'metricRender')({ throwProvider: true }))
  await score(page); await expect(page.getByRole('dialog')).toContainText(sharingUnavailable('ko'))
  await expect(page.locator('body')).not.toContainText('PRIVATE_PROVIDER_CREDENTIAL'); expect(errors).toEqual([])
})

test('비배열·누락된 정의 및 안내 자료는 전체 화면을 중단시키지 않는다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await page.evaluate(() => {
    const state = Reflect.get(window, 'metricState') as FixtureState, next = structuredClone(state.evidence!)
    Reflect.set(next, 'definitions', { key: 'ret', description: 'INVALID DEFINITION' })
    Reflect.set(next.score!, 'notices', { message: 'INVALID NOTICE' })
    Reflect.set(next.score!, 'axes', [null, next.score!.axes[0]])
    Reflect.get(window, 'metricRender')({ evidence: next })
  })
  await score(page); await expect(page.locator('.ss3-score-axis')).toHaveCount(4)
  await expect(page.getByRole('dialog')).not.toContainText('INVALID NOTICE'); await close(page)
  await page.locator('.ss3-matrix button.mx').first().click()
  await expect(page.getByRole('dialog')).toContainText(sharingUnavailable('ko'))
  expect(errors).toEqual([])
})

test('320px·7언어에서 원본 시트·긴 설명·키보드 닫기·초점 복귀를 보존한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 }); await mount(page)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */path)).setClientPreference('language', language) }, language)
    await score(page)
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: sharingDetailCopy(language, '닫기'), exact: true })).toBeVisible()
    await expect(dialog.locator('[data-score-axis=winRate]')).toContainText(sharingDetailCopy(language, '승률'))
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    if (language === 'fr') await page.screenshot({ path: info.outputPath('shared-score-320-fr.png'), fullPage: true })
    await close(page); await expect(page.locator('[data-metric="score"]')).toBeFocused()
  }
})
