import { expect, test, type Page } from '@playwright/test'

test.use({ trace: 'off', video: 'off' })

async function mount(page: Page, supplied = false) {
  await page.route('**/native-research-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture" style="height:100dvh"></div></body></html>' }))
  await page.goto('/native-research-fixture.html')
  await page.evaluate(async supplied => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const font = '/node_modules/@fontsource-variable/noto-sans-kr/wght.css'
    await import(/* @vite-ignore */ font)
    document.body.style.fontFamily = '"Noto Sans KR Variable", sans-serif'
    const path = '/src/internal-poc/NativeResearchWorkspace.tsx'
    const source = await (await fetch(path)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, h = react.createElement
    const dp = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ dp)
    const { NativeResearchWorkspace } = await import(/* @vite-ignore */ path)
    const audit = { intervals: 0, back: 0 }
    const original = window.setInterval.bind(window)
    window.setInterval = ((...args: Parameters<typeof setInterval>) => { audit.intervals++; return original(...args) }) as typeof setInterval
    function Host() {
      const [scopeId, setScopeId] = react.useState('owner-a:conversation-a')
      const [status, setStatus] = react.useState(supplied ? 'running' : 'unavailable')
      const [analysisOpen, setAnalysisOpen] = react.useState(false)
      const [hasDocuments, setHasDocuments] = react.useState(supplied)
      const [typed, setTyped] = react.useState(false)
      Object.assign(window, { researchAudit: audit, setResearchStatus: setStatus, setResearchScope: setScopeId, setResearchDocuments: setHasDocuments, setTypedResearchDocuments: setTyped })
      const strategy = hasDocuments ? h('section', { 'data-testid': 'real-strategy' }, h('h3', {}, '서버에서 공급한 전략'), h('input', { 'aria-label': '전략 문서 초안', defaultValue: '남길 초안' })) : undefined
      return h(NativeResearchWorkspace, { scopeId, title: '원본 연구 문서', onBack: () => { audit.back++ }, status,
        strategyDocument: strategy, analysisOpen, onOpenAnalysis: () => setAnalysisOpen(true), onCloseAnalysis: () => setAnalysisOpen(false),
        analysis: h('div', { 'data-testid': 'real-analysis' }, h('h3', {}, '기존 전문 차트 슬롯'), h('input', { 'aria-label': '차트 입력', defaultValue: '차트 상태' })),
        hypothesis: hasDocuments ? h('p', {}, '공급된 가설 원문만 표시') : undefined,
        critic: hasDocuments ? h('section', {}, h('h3', {}, 'Critic Review'), h('p', {}, 'Builder 주장 → Critic 반박 → 데이터'), h('p', {}, '관측된 비판 원문')) : undefined,
        entries: hasDocuments ? [{ id: 'observed-1', agent: 'Strategy Architect', summary: '<script>공급된 원문</script>', state: 'done', finding: { title: '공급된 근거', professional: '관측된 전문 원문', plain: '공급된 설명', meaning: '공급된 의미', nextAction: '공급된 다음 행동' } }, { id: 'observed-2', elapsedSeconds: 12, agent: 'Strategy Critic', summary: '관측된 확인', state: 'warn' }] : [],
        team: hasDocuments ? [{ id: 'actual-architect', name: 'Strategy Architect', status: 'done' }, { id: 'actual-critic', name: 'Strategy Critic', status: 'working' }] : [],
        documents: hasDocuments ? [{ id: 'report', title: 'Final Report', statusLabel: '검토 필요', content: h('p', {}, '실제 전달된 보고서 슬롯') }] : [],
        typedDocuments: typed ? [
          { id: 'bt1', kind: 'backtest', state: 'ready', revision: 'observed-v1', data: { metrics: { trades: { text: '공급 거래 수' } }, years: [{ id: 'y1', year: '2025', pnl: { text: '공급된 손익' }, trades: '계약상 거래 수', winRate: '확정 승률' }], chart: { versionIdentity: 'observed-v1', prices: { versionIdentity: 'observed-v1', sourceLabel: '명시 OHLC 시험', rangeLabel: '명시 조회 구간', pricePrecision: 2, bars: [{ time: 1800000000, open: 100, high: 104, low: 99, close: 102 }, { time: 1800000060, open: 102, high: 105, low: 101, close: 104 }], fills: [{ id: 'actual-buy', time: 1800000001, barTime: 1800000000, price: 101.25, side: 'BUY' }, { id: 'actual-sell', time: 1800000062, barTime: 1800000060, price: 103.75, side: 'SELL' }] }, equity: { versionIdentity: 'observed-v1', label: '공급 자산 곡선', sourceLabel: '명시 NAV 시험', rangeLabel: '명시 조회 구간', valuePrecision: 2, points: [{ time: 1800000000, value: 1000 }, { time: 1800000060, value: 1002.5 }] } } } },
          { id: 'report', kind: 'report', state: 'ready', data: { strategyName: '공급 검증 전략', metrics: {}, evidence: [{ id: 'e1', text: '확인된 근거로 이동', status: 'confirmed', documentId: 'bt1' }], activityDocumentId: 'activity' } },
        ] : [],
      })
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  }, supplied)
  await expect(page.locator('.native-research-workspace')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

async function openDocument(page: Page, title: string) {
  const toggle = page.getByRole('button', { name: '연구 문서 열기', exact: true })
  if (await toggle.isVisible()) await toggle.click()
  await page.locator('.rw-artifact').filter({ hasText: title }).click()
}

test('원본 전용 본문은 문서 탭·근거 링크·단일 차트와 연결되고 실제 보고서를 덮어쓰지 않는다', async ({ page }) => {
  await mount(page, true)
  await page.evaluate(() => Reflect.get(window, 'setTypedResearchDocuments')(true))
  await openDocument(page, '검증 결과')
  const report = page.getByRole('tabpanel', { name: '검증 결과 문서' })
  await expect(report).toContainText('공급 검증 전략')
  await expect(report).toContainText('실제 전달된 보고서 슬롯')
  await report.locator('.rw-evidence > div').filter({ hasText: '확인된 근거로 이동' }).getByRole('button', { name: '근거', exact: true }).click()
  const backtest = page.locator('[role="tabpanel"]:visible')
  await expect(backtest).toContainText('공급된 손익')
  await expect(backtest).toContainText('계약상 거래 수')
  await expect(backtest.locator('[data-chart-state="ready"]')).toHaveCount(2)
  await expect.poll(() => backtest.locator('[data-chart-mount="prices"] canvas').count()).toBeGreaterThan(0)
  await page.evaluate(() => Reflect.set(window, 'documentPriceCanvas', document.querySelector('[data-chart-mount="prices"] canvas')))
  await expect(page.locator('.rw-tabs [aria-selected="true"]')).toBeFocused()
  await backtest.getByRole('button', { name: /차트/ }).click()
  await expect(page.getByTestId('real-analysis')).toBeVisible()
  await expect(page.getByTestId('real-analysis')).toHaveCount(1)
  await page.getByRole('button', { name: '문서로 돌아가기', exact: true }).click()
  await expect(backtest).toContainText('공급된 손익')
  expect(await page.evaluate(() => Reflect.get(window, 'documentPriceCanvas') === document.querySelector('[data-chart-mount="prices"] canvas'))).toBe(true)
  await expect(backtest.getByRole('button', { name: '전문 차트 열기', exact: true })).toBeFocused()
  expect(await page.evaluate(() => Reflect.get(window, 'researchAudit').intervals)).toBe(0)
})

test('미공급 연구도 원본 문서·팀 구조를 유지하고 실행·성과를 만들지 않는다', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await expect(page.getByRole('tabpanel', { name: '연구 계획 문서' })).toContainText('아직 공급된 연구 계획 문서가 없습니다.')
  await expect(page.locator('.g-tag').first()).toHaveText('연구 상태 미공급')
  expect(await page.locator('.rw-team[data-role-status="unavailable"]').count()).toBe(7)
  await openDocument(page, '연구 과정')
  await expect(page.getByRole('tabpanel', { name: '연구 과정 문서' })).toContainText('아직 공급된 연구 진행 기록이 없습니다.')
  await expect(page.locator('.g-act-row')).toHaveCount(0)
  await expect(page.locator('.native-research-workspace')).not.toContainText(/7단계 완료|가설 확인|봉인 구간 통과|과매도 반등/)
  expect(await page.evaluate(() => Reflect.get(window, 'researchAudit').intervals)).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
  expect(errors).toEqual([])
  await page.screenshot({ path: info.outputPath('research-unavailable.png'), fullPage: true })
})

test('공급 관측·가설·Critic를 원문 그대로 표시하고 완료를 추정하지 않는다', async ({ page }, info) => {
  await mount(page, true)
  await openDocument(page, '연구 과정')
  const panel = page.getByRole('tabpanel', { name: '연구 과정 문서' })
  await expect(panel.locator('.g-act-row')).toHaveCount(2)
  await expect(panel).toContainText('<script>공급된 원문</script>')
  await expect(panel.locator('script')).toHaveCount(0)
  await expect(panel.getByLabel('경과 시간 미공급')).toHaveText('—')
  await expect(panel.locator('time')).toHaveText('00:12')
  expect(await page.locator('.rw-team[data-role-status="done"]').count()).toBe(1)
  expect(await page.locator('.rw-team[data-role-status="unavailable"]').count()).toBe(5)
  await openDocument(page, '가설')
  await expect(page.getByRole('tabpanel', { name: '가설 문서' })).toHaveText('공급된 가설 원문만 표시')
  await openDocument(page, '비판 검토 기록')
  await expect(page.getByRole('tabpanel', { name: '비판 검토 기록 문서' })).toContainText('관측된 비판 원문')
  await page.evaluate(() => Reflect.get(window, 'setResearchStatus')('completed'))
  await expect(page.locator('.g-tag').first()).toHaveText('연구 완료')
  await expect(page.locator('.rw-complete')).toHaveCount(0)
  await expect(page.locator('.native-research-workspace')).not.toContainText('7단계')
  expect(await page.evaluate(() => Reflect.get(window, 'researchAudit').intervals)).toBe(0)
  await page.screenshot({ path: info.outputPath('research-supplied.png'), fullPage: true })
})

test('문서 전환과 분석 복귀는 전략·차트 DOM과 입력을 보존한다', async ({ page }) => {
  await mount(page, true)
  await page.getByRole('textbox', { name: '전략 문서 초안' }).fill('편집하던 원문')
  await page.evaluate(() => { Reflect.set(window, 'savedStrategyNode', document.querySelector('[data-testid="real-strategy"]')); Reflect.set(window, 'savedAnalysisNode', document.querySelector('[data-testid="real-analysis"]')) })
  await openDocument(page, '검증 결과')
  await expect(page.getByRole('tabpanel', { name: '검증 결과 문서' })).toContainText('실제 전달된 보고서 슬롯')
  await openDocument(page, '연구 계획')
  await expect(page.getByRole('textbox', { name: '전략 문서 초안' })).toHaveValue('편집하던 원문')
  await page.getByRole('button', { name: '차트로 자세히 보기' }).click()
  await expect(page.getByTestId('real-analysis')).toBeVisible()
  await page.getByRole('textbox', { name: '차트 입력' }).fill('보존된 차트 상태')
  await page.getByRole('button', { name: '문서로 돌아가기' }).click()
  await expect(page.getByRole('button', { name: '차트로 자세히 보기' })).toBeFocused()
  expect(await page.evaluate(() => Reflect.get(window, 'savedStrategyNode') === document.querySelector('[data-testid="real-strategy"]') && Reflect.get(window, 'savedAnalysisNode') === document.querySelector('[data-testid="real-analysis"]'))).toBe(true)
  await page.getByRole('button', { name: '차트로 자세히 보기' }).click()
  await expect(page.getByRole('textbox', { name: '차트 입력' })).toHaveValue('보존된 차트 상태')
})

test('탭 키보드 탐색·공급 문서 제거·scope 변경은 안전한 문서로 돌아간다', async ({ page }) => {
  await mount(page, true)
  await page.getByRole('tab', { name: '연구 계획', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: '연구 과정', exact: true })).toBeFocused()
  await expect(page.getByRole('tabpanel', { name: '연구 과정 문서' })).toBeVisible()
  await openDocument(page, '비판 검토 기록')
  await page.evaluate(() => Reflect.get(window, 'setResearchDocuments')(false))
  await expect(page.getByRole('tabpanel', { name: '비판 검토 기록 문서' })).toContainText('아직 공급된 문서 데이터가 없습니다.')
  await expect(page.getByRole('tabpanel', { name: '비판 검토 기록 문서' })).not.toContainText('관측된 비판 원문')
  await page.evaluate(() => Reflect.get(window, 'setResearchScope')('owner-b:conversation-b'))
  await expect(page.getByRole('tab', { name: '연구 계획', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.g-act-row')).toHaveCount(0)
  await page.getByRole('button', { name: '대화로 돌아가기' }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'researchAudit').back)).toBe(1)
})

async function changeLanguage(page: Page, language: string) {
  await page.evaluate(async language => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', language)
  }, language)
}

test('영어 빈 상태·모바일 탐색 문구와 7언어 상태는 설정 변경을 따른다', async ({ page }) => {
  await mount(page)
  await changeLanguage(page, 'en')
  await expect(page.getByRole('tabpanel', { name: 'Research Plan document' })).toContainText('No Research Plan document has been supplied yet.')
  await expect(page.getByRole('button', { name: 'Back to conversation' })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Open research documents' })).toBeVisible()
  await expect(page.locator('.rw-team small')).toHaveText(Array(7).fill('Not supplied'))
  const toggle = page.getByRole('button', { name: 'Open Artifacts', exact: true })
  if (await toggle.isVisible()) {
    await toggle.click()
    await expect(page.getByRole('button', { name: 'Close Artifacts', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(toggle).toBeFocused()
  }
  await page.getByRole('tab', { name: 'Activity', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Research activity log' })).toContainText('No research activity records have been supplied yet.')
  for (const [language, status] of [['ko', '연구 상태 미공급'], ['en', 'Research status not supplied'], ['ja', '研究状況は未提供です'], ['zh-CN', '未提供研究状态'], ['zh-TW', '未提供研究狀態'], ['es', 'Estado de investigación no proporcionado'], ['fr', 'État de la recherche non fourni']]) {
    await changeLanguage(page, language)
    await expect(page.locator('.g-tag').first()).toHaveText(status)
    await expect(page.locator('.research-log-announcer')).toHaveText(status)
  }
  const catalogue = await page.evaluate(async () => {
    const path = '/src/internal-poc/native-research-workspace-copy.ts'
    const { nativeResearchCopy, nativeResearchText } = await import(/* @vite-ignore */ path)
    return Object.entries(nativeResearchCopy).every(([key, values]) => (values as string[]).length === 7 && ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'].every(language => {
      const value = nativeResearchText(language, key, { label: 'Observed $& label', seconds: 12, count: 12 })
      return value.length > 0 && !/\{\w+\}/.test(value) && (language === 'ko' || !/[가-힣]/.test(value))
    }))
  })
  expect(catalogue).toBe(true)
})

test('영어 로그 시간·근거 heading·상태는 번역하되 공급 원문과 DOM은 유지한다', async ({ page }) => {
  await mount(page, true)
  await page.getByRole('textbox', { name: '전략 문서 초안' }).fill('언어 변경 후 유지')
  await page.evaluate(() => Reflect.set(window, 'localeStrategyNode', document.querySelector('[data-testid="real-strategy"]')))
  await changeLanguage(page, 'en')
  await page.getByRole('tab', { name: 'Activity', exact: true }).click()
  const log = page.getByRole('region', { name: 'Research activity log' })
  await expect(log.getByLabel('Elapsed time not supplied')).toHaveText('—')
  await expect(log.getByLabel('12 seconds since start')).toHaveText('00:12')
  for (const heading of ['In plain language', 'Professional wording', 'Meaning', 'Next action']) await expect(log.getByText(heading, { exact: true })).toBeVisible()
  await expect(log).toContainText('<script>공급된 원문</script>')
  await expect(log).toContainText('관측된 전문 원문')
  await expect(log.locator('.research-row-state').last()).toHaveText('Warning: ')
  for (const [status, header, announcement] of [['paused', 'Research paused', 'Research paused'], ['stopped', 'Stopped', 'Research stopped'], ['failed', 'Research failed', 'Research failed'], ['completed', 'Research completed', 'Research log complete']]) {
    await page.evaluate(status => Reflect.get(window, 'setResearchStatus')(status), status)
    await expect(page.locator('.g-tag').first()).toHaveText(header)
    await expect(log.getByRole('status')).toContainText(announcement)
  }
  await page.getByRole('tab', { name: 'Research Plan', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '전략 문서 초안' })).toHaveValue('언어 변경 후 유지')
  expect(await page.evaluate(() => Reflect.get(window, 'localeStrategyNode') === document.querySelector('[data-testid="real-strategy"]'))).toBe(true)
  await page.getByRole('button', { name: 'View details in chart' }).click()
  await page.getByRole('button', { name: 'Back to document' }).click()
  await expect(page.getByRole('button', { name: 'View details in chart' })).toBeFocused()
  await changeLanguage(page, 'ko')
  await expect(page.getByRole('button', { name: '차트로 자세히 보기' })).toBeFocused()
})
