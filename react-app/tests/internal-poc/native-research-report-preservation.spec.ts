import { expect as baseExpect, test } from '@playwright/test'

const expect = baseExpect.configure({ timeout: 10_000 })
test.use({ trace: 'off', video: 'off', actionTimeout: 10_000 })
test.setTimeout(45_000)

// 실제 shell/g-doc/portal 조립, 명시 합성 표시 입력. SDK·서버·모델·주문 시험은 아니다.
test('실연구 report는 현재 출처의 결과가 도착해도 원문·선택을 보존하고 기존 bt1에만 결과를 연결한다', async ({ page }) => {
  const errors: string[] = [], requests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/') || request.method() !== 'GET') requests.push(request.url())
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.route('**/report-preservation-fixture.html', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture"></div></body></html>',
  }))
  await page.goto('/report-preservation-fixture.html')
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh', refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/internal-poc/ClientServiceExperience.tsx', source = await (await fetch(path)).text()
    const reactPath = source.match(/from "([^"\n]*\/react\.js[^"\n]*)"/)?.[1]
    if (!reactPath) throw new Error('Vite React 인스턴스를 찾지 못했습니다.')
    const rm = await import(/* @vite-ignore */ reactPath), react = rm.default ?? rm, h = react.createElement
    const domPath = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ domPath)
    const { ClientServiceExperience } = await import(/* @vite-ignore */ path)
    const portalPath = '/src/internal-poc/NativeAnalysisLayout.tsx'
    const { NativeAnalysisReportPortal } = await import(/* @vite-ignore */ portalPath)
    const original = Object.freeze({ owner: 'owner_report_a', id: 'report', work: 'work_report_a',
      title: '연구 원문 보고서', text: '원 연구 보고서의 고객 조건·출처·근거를 그대로 보존합니다.' })
    const originalBytes = JSON.stringify(original), mounts: string[] = []
    function Analysis({ ready }: { ready: boolean }) {
      react.useEffect(() => { mounts.push('getter-mounted'); return () => { mounts.push('getter-retired') } }, [])
      return ready ? h(NativeAnalysisReportPortal, {}, () => h('section', {
        className: 'native-report-document', 'data-backtest-id': 'backtest_actual_report_a', 'data-result-fixture': '',
      }, h('h3', {}, '확인된 결과 본문'), h('p', {}, '현재 출처의 완료·reportReady 결과'))) : null
    }
    function Host() {
      const [owner, setOwner] = react.useState(original.owner), [work, setWork] = react.useState(original.work)
      const [stage, setStage] = react.useState('none'), [input, setInput] = react.useState('')
      const [identity, setIdentity] = react.useState('backtest_actual_report_a'), [collision, setCollision] = react.useState(false)
      const [view, setView] = react.useState({ activeDocumentId: 'report', openDocumentIds: ['plan', 'report'] })
      const report = work === original.work ? original : { ...original, work, title: '새 출처의 연구 보고서', text: '새 출처의 보고서 원문' }
      const documents = [{ id: report.id, title: report.title, content: h('p', { 'data-original-report': '', 'data-source-work': work }, report.text) },
        ...(collision ? [{ id: 'bt1', title: '기존 백테스트 문서', content: h('p', { 'data-existing-backtest': '' }, '삭제하면 안 되는 기존 자료') }] : [])]
      Object.assign(window, { reportStage: setStage, reportOwner: setOwner, reportWork: setWork,
        reportIdentity: setIdentity, reportCollision: setCollision, reportView: setView, reportMounts: mounts,
        reportOriginalUnchanged: () => JSON.stringify(original) === originalBytes })
      return h(ClientServiceExperience, { accountScope: owner,
        strategyDocument: { identity: work, content: h('p', {}, '기존 전략 슬롯') },
        researchPresentation: { scope: original.owner, data: { scopeId: work, status: 'completed', view, onViewChange: setView, documents } },
        analysisIdentity: identity,
        analysisBinding: { owner: JSON.stringify([original.owner, 'AUTHENTICATED']), sourceConversationId: 'conversation_source_report_a',
          researchWorkId: original.work, strategyVersionId: 'sv_v03_actual_report_a', semanticHash: 'a'.repeat(64),
          backtestId: 'backtest_actual_report_a', reportReady: stage === 'ready' },
        analysis: stage === 'none' ? undefined : h(Analysis, { ready: stage === 'ready' }),
        state: { phase: 'ready', sessionState: 'AUTHENTICATED', messages: [{ id: 'question_report_a', role: 'user', text: '원 연구 요청' }],
          input, busy: false, source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
          onInput: setInput, onSend: async () => {}, onReset: () => {} },
      })
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  })
  await page.locator('[data-native-open-research]').click()
  const workspace = page.locator('.native-research-workspace')
  const original = workspace.locator('[data-original-report]')
  const active = workspace.locator('[role="tabpanel"]:visible')
  await expect(original).toBeVisible()
  await original.evaluate(node => {
    Reflect.set(window, 'reportOriginalNode', node)
    const range = document.createRange(); range.selectNodeContents(node)
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
  })
  await page.evaluate(() => Reflect.get(window, 'reportStage')('pending'))
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'reportMounts').filter((item: string) => item === 'getter-mounted').length)).toBe(1)
  await expect(original).toBeVisible()
  await expect(workspace.getByRole('tab', { name: '백테스트 결과', exact: true })).toHaveCount(0)
  await expect(page.locator('[data-result-fixture]')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'reportStage')('ready'))
  await expect(original).toBeVisible()
  await expect(active).toContainText('원 연구 보고서의 고객 조건·출처·근거를 그대로 보존합니다.')
  expect(await original.evaluate(node => node === Reflect.get(window, 'reportOriginalNode'))).toBe(true)
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('원 연구 보고서의 고객 조건·출처·근거를 그대로 보존합니다.')
  await expect(workspace.getByRole('tab', { name: '연구 원문 보고서', exact: true })).toHaveAttribute('aria-selected', 'true')
  const resultArtifact = workspace.locator('.rw-artifact').filter({ has: page.locator('span', { hasText: /^백테스트 결과$/ }) })
  if (!await workspace.locator('.rw-aux').isVisible()) await workspace.locator('.rw-title .rw-mobile-artifacts').click()
  await resultArtifact.click()
  await expect(active.locator('[data-result-fixture]')).toBeVisible()
  await expect(active).not.toContainText('원 연구 보고서의 고객 조건')
  await workspace.getByRole('tab', { name: '연구 원문 보고서', exact: true }).click()
  await expect(original).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'reportStage')('pending'))
  await expect(page.locator('[data-result-fixture]')).toHaveCount(0)
  await expect(resultArtifact).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'reportStage')('ready'))
  await expect(resultArtifact).toHaveCount(1)
  await page.evaluate(() => Reflect.get(window, 'reportIdentity')('backtest_foreign_report_b'))
  await expect(resultArtifact).toHaveCount(0)
  await expect(original).toBeVisible()
  await expect(page.locator('[data-result-fixture]')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'reportIdentity')('backtest_actual_report_a'))
  await expect(resultArtifact).toHaveCount(1)
  await page.evaluate(() => Reflect.get(window, 'reportOwner')('owner_report_b'))
  await expect(workspace).toHaveCount(0)
  await expect(page.locator('[data-result-fixture]')).toHaveCount(0)
  await page.evaluate(() => { Reflect.get(window, 'reportOwner')('owner_report_a'); Reflect.get(window, 'reportWork')('work_report_b') })
  await expect(workspace.locator('[data-original-report]')).toContainText('새 출처의 보고서 원문')
  await expect(resultArtifact).toHaveCount(0)
  await expect(page.locator('[data-result-fixture]')).toHaveCount(0)
  await page.evaluate(() => { Reflect.get(window, 'reportWork')('work_report_a'); Reflect.get(window, 'reportCollision')(true) })
  await expect(workspace.locator('[data-existing-backtest]')).toHaveText('삭제하면 안 되는 기존 자료')
  await expect(resultArtifact).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'reportOriginalUnchanged')())).toBe(true)
  expect(errors).toEqual([])
  expect(requests).toEqual([])
})
