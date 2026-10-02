import { expect, test, type Page } from '@playwright/test'

type Options = { kind?: 'completed' | 'stopped' | 'none'; status?: 'running' | 'stopped' | 'completed'; scope?: string; revision?: string; report?: 'slot' | 'typed' | 'loading' | 'none'; summary?: boolean; summaryValues?: { completedStages: number; strategyRevisions: number; backtests: number }; resume?: boolean; override?: boolean; freshCallback?: boolean }
async function mount(page: Page, initial: Options = {}) {
  await page.route('**/research-completion-audit.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture" style="height:100dvh"></div></body></html>' }))
  await page.goto('/research-completion-audit.html')
  await page.evaluate(async initial => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const font = '/node_modules/@fontsource-variable/noto-sans-kr/wght.css'; await import(/* @vite-ignore */font)
    document.body.style.fontFamily = '"Noto Sans KR Variable", sans-serif'
    const dp = '/@id/react-dom/client', wp = '/src/internal-poc/NativeResearchWorkspace.tsx', pp = '/src/client-preferences.ts'
    const source = await (await fetch(wp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, DOM = await import(/* @vite-ignore */dp), { NativeResearchWorkspace } = await import(/* @vite-ignore */wp)
    ;(await import(/* @vite-ignore */pp)).setClientPreference('language', 'ko')
    const h = React.createElement ?? React.default.createElement, root = (DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('fixture'))
    const pending: { resolve: () => void; reject: () => void }[] = [], calls: string[] = []
    const resume = () => { calls.push('resume'); return new Promise<void>((resolve, reject) => pending.push({ resolve, reject: () => reject(new Error('PRIVATE_BACKEND_EXCEPTION')) })) }
    function Host({ options }: { options: Options }) {
      const { kind = 'completed', scope = 'owner-a', revision = 'revision-a', report = 'slot', summary = true, resume: canResume = true, override = false } = options
      const [view, setView] = React.useState({ activeDocumentId: 'activity', openDocumentIds: ['plan', 'activity'] })
      return h(NativeResearchWorkspace, {
        scopeId: scope, title: '관측된 연구', status: options.status ?? (kind === 'stopped' ? 'stopped' : 'completed'), onBack: () => {}, view, onViewChange: setView,
        strategyDocument: h('p', {}, '보존한 연구 계획'),
        documents: report === 'slot' ? [{ id: 'report', title: 'Final Report', content: h('p', {}, '실제 최종 보고서') }] : [],
        typedDocuments: report === 'typed' ? [{ id: 'report', kind: 'report', state: 'ready', data: { strategyName: '실제 구조 보고서', metrics: {}, evidence: [] } }] : report === 'loading' ? [{ id: 'report', kind: 'report', state: 'loading' }] : [],
        completion: override ? h('p', {}, '기존 completion override') : undefined,
        completionPresentation: kind === 'none' ? undefined : kind === 'completed' ? { kind, revision, summary: summary ? options.summaryValues ?? { completedStages: 9, strategyRevisions: 2, backtests: 13, holdout: 'warning' } : undefined } : { kind, revision, reason: '관측된 중단 사유', onResume: canResume ? options.freshCallback ? () => resume() : resume : undefined },
      })
    }
    const render = (options: Options) => root.render(h(Host, { key: options.scope ?? 'owner-a', options }))
    Object.assign(window, { renderCompletion: render, completionCalls: calls, settleCompletion: (index: number, failure = false) => failure ? pending[index].reject() : pending[index].resolve(), closeCompletion: () => root.render(null) })
    render(initial)
  }, initial)
  await expect(page.locator('.native-research-workspace')).toBeVisible()
  await page.evaluate(async () => { await document.fonts.load('14px "Noto Sans KR Variable"', '관측된 연구 중단 사유'); await document.fonts.ready })
}
async function render(page: Page, options: Options) { await page.evaluate(options => Reflect.get(window, 'renderCompletion')(options), options) }
async function settle(page: Page, index = 0, failure = false) { await page.evaluate(({ index, failure }) => Reflect.get(window, 'settleCompletion')(index, failure), { index, failure }) }
const card = (page: Page) => page.locator('.rw-complete')

test('관측된 완료 요약과 원본 최종 보고서 버튼을 실제 문서에 연결한다', async ({ page }) => {
  await mount(page)
  await expect(card(page)).toContainText('검증 9단계 완료, 전략 수정 2회, 백테스트 13회, Holdout 경고')
  await card(page).getByRole('button', { name: '최종 보고서 열기', exact: true }).click()
  await expect(page.locator('[role=tabpanel]:visible')).toContainText('실제 최종 보고서')
  await expect(page.locator('.rw-tabs [aria-selected=true]')).toBeFocused()
  await page.getByRole('tab', { name: '연구 과정', exact: true }).click()
  await expect(card(page)).toBeVisible()
})

test('완료 상태만으로 요약을 합성하지 않고 미공급 보고서는 열 수 없다', async ({ page }) => {
  await mount(page, { kind: 'none' })
  await expect(card(page)).toHaveCount(0)
  await render(page, { report: 'none', summary: false })
  await expect(card(page)).toContainText('완료 요약이 아직 제공되지 않았습니다.')
  await expect(card(page).getByRole('button', { name: '최종 보고서 열기' })).toBeDisabled()
  await expect(card(page)).not.toContainText(/7단계|Holdout 통과|백테스트 0회/)
  await render(page, { report: 'loading' })
  await expect(card(page).getByRole('button', { name: '최종 보고서 열기' })).toBeDisabled()
  await render(page, { report: 'typed' })
  await card(page).getByRole('button', { name: '최종 보고서 열기' }).click()
  await expect(page.locator('[role=tabpanel]:visible')).toContainText('실제 구조 보고서')
})

test('중단 카드 재개는 중복을 막고 실패 후 다시 시도하며 성공도 상태를 발명하지 않는다', async ({ page }) => {
  await mount(page, { kind: 'stopped' })
  await expect(card(page)).toContainText('연구가 중단됐어요')
  const resume = card(page).getByRole('button', { name: '이어서 진행', exact: true })
  await resume.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  expect(await page.evaluate(() => Reflect.get(window, 'completionCalls'))).toEqual(['resume'])
  await expect(card(page).getByRole('button', { name: '요청 중…' })).toHaveAttribute('aria-busy', 'true')
  await expect(card(page).getByRole('button', { name: '연구 계획 보기' })).toBeEnabled()
  await settle(page, 0, true)
  await expect(card(page).getByRole('alert')).toContainText('연구를 재개하지 못했습니다.')
  await expect(card(page)).not.toContainText('PRIVATE_BACKEND_EXCEPTION')
  await resume.click(); await settle(page, 1)
  await expect(card(page).getByRole('status')).toContainText('재개 요청을 전달했습니다.')
  await expect(resume).toBeDisabled()
  await expect(page.locator('.native-research-workspace')).toHaveAttribute('data-research-status', 'stopped')
  await card(page).getByRole('button', { name: '연구 계획 보기' }).click()
  await expect(page.locator('[role=tabpanel]:visible')).toContainText('보존한 연구 계획')
})

test('owner·revision 교체와 콜백 철회는 이전 재개 응답을 격리한다', async ({ page }) => {
  await mount(page, { kind: 'stopped' })
  await card(page).getByRole('button', { name: '이어서 진행', exact: true }).click()
  await render(page, { kind: 'stopped', scope: 'owner-b' }); await settle(page, 0, true)
  await expect(card(page).getByRole('alert')).toHaveCount(0)
  await card(page).getByRole('button', { name: '이어서 진행', exact: true }).click()
  await render(page, { kind: 'stopped', scope: 'owner-b', revision: 'revision-b' }); await settle(page, 1)
  await expect(card(page).getByRole('status')).toHaveCount(0)
  await card(page).getByRole('button', { name: '이어서 진행', exact: true }).click()
  await render(page, { kind: 'stopped', scope: 'owner-b', revision: 'revision-b', resume: false }); await settle(page, 2, true)
  await expect(card(page).getByRole('alert')).toHaveCount(0)
  await expect(card(page).getByRole('button', { name: '이어서 진행', exact: true })).toBeDisabled()
})

test('기존 completion override를 유지하고 재개 없는 카드는 실행을 유도하지 않는다', async ({ page }) => {
  await mount(page, { override: true })
  await expect(card(page)).toHaveText('기존 completion override')
  await expect(card(page).getByRole('button')).toHaveCount(0)
  await render(page, { kind: 'stopped', resume: false })
  await expect(card(page).getByRole('button', { name: '이어서 진행' })).toBeDisabled()
  await expect(card(page)).not.toContainText('새로고침으로')
  expect(await page.evaluate(() => Reflect.get(window, 'completionCalls'))).toEqual([])
})

test('관측 상태 불일치·유효하지 않은 횟수는 숨기고 명시된 0만 표시한다', async ({ page }) => {
  await mount(page, { status: 'running' })
  await expect(card(page)).toHaveCount(0)
  await render(page, { kind: 'stopped', status: 'completed' })
  await expect(card(page)).toHaveCount(0)
  await render(page, { summaryValues: { completedStages: -1, strategyRevisions: 1.5, backtests: Number.MAX_SAFE_INTEGER + 1 } })
  await expect(card(page)).toContainText('완료 요약이 아직 제공되지 않았습니다.')
  await expect(card(page).getByRole('button', { name: '최종 보고서 열기' })).toBeEnabled()
  await render(page, { summaryValues: { completedStages: 0, strategyRevisions: 0, backtests: 0 } })
  await expect(card(page)).toContainText('검증 0단계 완료, 전략 수정 0회, 백테스트 0회')
})

test('문서 이동 중 재개는 보존하고 콜백 재공급·unmount에 늦은 실패가 새어 나오지 않는다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page, { kind: 'stopped' })
  await card(page).getByRole('button', { name: '이어서 진행', exact: true }).click()
  await card(page).getByRole('button', { name: '연구 계획 보기' }).click()
  await settle(page, 0, true)
  await page.getByRole('tab', { name: '연구 과정', exact: true }).click()
  await expect(card(page).getByRole('alert')).toContainText('연구를 재개하지 못했습니다.')
  await card(page).getByRole('button', { name: '이어서 진행', exact: true }).click()
  await render(page, { kind: 'stopped', resume: false })
  await expect(card(page).getByRole('button', { name: '이어서 진행', exact: true })).toBeDisabled()
  await render(page, { kind: 'stopped', resume: true }); await settle(page, 1, true)
  await expect(card(page).getByRole('alert')).toHaveCount(0)
  await card(page).getByRole('button', { name: '이어서 진행', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'closeCompletion')()); await settle(page, 2, true)
  await expect(page.locator('.native-research-workspace')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('부모의 inline callback 재생성은 같은 revision의 요청 잠금을 풀지 않는다', async ({ page }) => {
  await mount(page, { kind: 'stopped', freshCallback: true })
  await card(page).getByRole('button', { name: '이어서 진행', exact: true }).click()
  await card(page).getByRole('button', { name: '연구 계획 보기' }).click()
  await page.getByRole('tab', { name: '연구 과정', exact: true }).click()
  await expect(card(page).getByRole('button', { name: '요청 중…' })).toBeDisabled()
  expect(await page.evaluate(() => Reflect.get(window, 'completionCalls'))).toEqual(['resume'])
  await settle(page)
  await expect(card(page).getByRole('status')).toContainText('재개 요청을 전달했습니다.')
  await render(page, { kind: 'stopped', freshCallback: true })
  await expect(card(page).getByRole('button', { name: '이어서 진행', exact: true })).toBeDisabled()
})

test('7개 언어의 원본 후속 구조와 320px 버튼 줄바꿈을 유지한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 }); await mount(page)
  for (const [language, title] of [['ko', '연구 완료'], ['en', 'Research completed'], ['ja', '研究完了'], ['zh-CN', '研究已完成'], ['zh-TW', '研究已完成'], ['es', 'Investigación completada'], ['fr', 'Recherche terminée']]) {
    await page.evaluate(async language => { const p = '/src/client-preferences.ts'; (await import(/* @vite-ignore */p)).setClientPreference('language', language) }, language)
    await expect(card(page).getByRole('heading')).toHaveText(title)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    if (language !== 'ko') expect(await card(page).innerText()).not.toMatch(/[가-힣]/)
  }
  await render(page, { kind: 'stopped' })
  expect(await card(page).getByRole('button').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().right <= innerWidth + 1))).toBe(true)
  await page.screenshot({ path: info.outputPath('completion-320-fr.png'), fullPage: true })
})
