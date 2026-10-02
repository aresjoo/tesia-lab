import { expect, test, type Page } from '@playwright/test'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import conversation from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import type { NativeChartManifest, NativeChartWindow, NativeReport, NativeTrades } from '../../src/internal-poc/native-service-api'

/** Presentation seam only: REAL result/document/shell components, controlled
 * read-only API promises. No backend authority, provider, session protocol or
 * NativeServiceApp binding claim. Owner replacement below models unmount; the
 * native controller's actual owner guard has separate integration acceptance.
 */
type Status = { backtestId: string; state: 'loading' | 'ready' | 'error'; label: string }
async function mount(page: Page) {
  await page.route('**/native-document-result-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="document-result-root"></div></body></html>' }))
  await page.goto('/native-document-result-test.html')
  await page.evaluate(async data => {
    const refresh = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/internal-poc/ClientServiceExperience.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, h = react.createElement, dom = await import(/* @vite-ignore */ dp)
    const { ClientServiceExperience } = await import(/* @vite-ignore */ cp)
    const resultPath = '/src/internal-poc/NativeServiceResult.tsx', documentPath = '/src/internal-poc/NativeStrategyDocument.tsx'
    const { NativeServiceResult } = await import(/* @vite-ignore */ resultPath), { NativeStrategyDocument } = await import(/* @vite-ignore */ documentPath)
    const report = (data.fixtures.sources[1].fixture as unknown as { response: { data: NativeReport } }).response.data
    const chart = data.fixtures.sources[0].fixture as unknown as { manifest: NativeChartManifest; window: NativeChartWindow }
    const pages = (data.fixtures.sources[2].fixture as unknown as { pages: { name: string; response: { data: NativeTrades } }[] }).pages
    const calls = { report: 0, chart: 0, trades: 0 }, statuses: (Status & { owner: string })[] = []
    const pending: { jobId: string; resolve: () => void; reject: () => void }[] = []
    const api = {
      report: (job: { backtestId: string }) => {
        calls.report++
        return new Promise((resolve, reject) => pending.push({ jobId: job.backtestId,
          resolve: () => resolve({ ...report, binding: { ...report.binding, backtestId: job.backtestId } }), reject: () => reject(new Error('SYNTHETIC_DISPLAY_FAILURE')) }))
      },
      trades: async (_report: unknown, segment: string) => { calls.trades++; return pages.find(item => item.name === (segment === 'OOS' ? 'oos-default' : 'is-last'))!.response.data },
      chart: async (_job: unknown, _report: unknown, segment: string) => {
        calls.chart++
        return { manifest: chart.manifest, window: chart.window,
          navigation: { supportedResolutions: ['1m'], availableRange: chart.window.requestedRange, previousFromInclusive: null, nextFromInclusive: null },
          view: { identity: `document-result-${segment}`, market: 'BTC/USDT', resolutionSeconds: 60, pricePrecision: 3,
            sourceLabel: 'SYNTHETIC_CONTRACT_FIXTURE · 표시 연결 검수', fills: [],
            bars: chart.window.bars.map(bar => ({ time: Date.parse(bar.openTime) / 1000, open: Number(bar.open), high: Number(bar.high), low: Number(bar.low), close: Number(bar.close), volume: Number(bar.volume) })) },
        }
      },
    }
    type View = { owner: string; jobId: string; input: string; revision: string; notice: Status | null; locked: boolean; listener: number }
    function Host() {
      const [view, setView] = react.useState({ owner: 'owner-a', jobId: report.binding.backtestId, input: '작성 중인 질문', revision: data.snapshot.draftRevision, notice: null, locked: false, listener: 0 } as View)
      const onStatusChange = react.useCallback((status: Status) => {
        statuses.push({ owner: view.owner, ...status })
        setView((current: View) => current.owner === view.owner && current.jobId === status.backtestId ? { ...current, notice: status } : current)
      }, [view.owner, view.jobId, view.listener])
      const job = react.useMemo(() => ({ backtestId: view.jobId, state: 'COMPLETED' }), [view.jobId])
      Object.assign(window, { documentResultChange: (patch: Partial<View>) => setView((current: View) => ({ ...current, ...patch })), documentResultView: view })
      return h(ClientServiceExperience, {
        state: { phase: 'ready', sessionState: 'AUTHENTICATED', messages: [{ id: 'u1', role: 'user', text: '계약 fixture 전략 질문' }],
          input: view.input, busy: false, inputDisabled: view.locked, source: 'service', recovery: null, quickReplies: [],
          workflow: h('section', { 'aria-label': '전략 요약' }, '현재 서버 초안과 별도로 승인된 작업 결과를 확인합니다.'),
          outcome: h(NativeServiceResult, { key: `${view.owner}:${view.jobId}`, api, job, onStatusChange }), issue: null,
          onInput: (input: string) => setView((current: View) => ({ ...current, input })), onSend: async () => {}, onReset: () => {}, onRecover: undefined, onLogout: undefined },
        strategyDocument: { identity: `${view.owner}:conversation:document`, content: h(NativeStrategyDocument, { snapshot: { ...data.snapshot, draftRevision: view.revision } }) },
        conversationNotice: view.notice?.backtestId === view.jobId ? view.notice.label : undefined,
      })
    }
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('document-result-root'))
    Object.assign(window, { documentResultCalls: calls, documentResultStatuses: statuses,
      settleDocumentReport: (index: number, failure: boolean) => failure ? pending[index].reject() : pending[index].resolve(), unmountDocumentResult: () => root.unmount() })
    root.render(h(Host))
  }, { fixtures, snapshot: conversation.snapshots.ready })
  await expect.poll(() => calls(page)).toEqual({ report: 1, chart: 0, trades: 0 })
  await page.getByRole('button', { name: '전략 초안', exact: true }).click()
  await expect(page.locator('.native-strategy-document')).toBeVisible()
}
const calls = (page: Page) => page.evaluate(() => Reflect.get(window, 'documentResultCalls'))
const audit = (page: Page) => page.evaluate(() => Reflect.get(window, 'documentResultStatuses') as (Status & { owner: string })[])
const settle = (page: Page, index: number, failure = false) => page.evaluate(({ index, failure }) => Reflect.get(window, 'settleDocumentReport')(index, failure), { index, failure })

test('문서 중 실제 결과 조회 실패를 알리고 대화 복귀·기존 재시도·성공까지 중복 조회 없이 이어진다', async ({ page }) => {
  const apiRequests: string[] = [], errors: string[] = []
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()) })
  page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  const banner = page.locator('.g-conversation-notice'), draft = page.locator('.native-strategy-document')
  await expect(banner.getByRole('status')).toHaveText('보고서 확인 중')
  await settle(page, 0, true)
  await expect(banner.getByRole('status')).toHaveText('결과 확인 필요')
  await expect(draft).toBeVisible()
  // The detailed error and retry stay in their ORIGINAL chat result surface.
  await expect(page.getByText('검증된 보고서를 가져오지 못했습니다. 미확인 수치는 표시하지 않습니다.', { exact: true })).toBeHidden()
  const beforeReturn = await calls(page)
  await banner.getByRole('button', { name: '대화', exact: true }).click()
  await expect(page.locator('.g-tabs').getByRole('button', { name: '대화', exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: '보고서 다시 조회', exact: true })).toBeVisible()
  expect(await calls(page)).toEqual(beforeReturn)
  await page.getByRole('button', { name: '보고서 다시 조회', exact: true }).click()
  await expect.poll(() => calls(page)).toEqual({ report: 2, chart: 0, trades: 0 })
  await page.getByRole('button', { name: '전략 초안', exact: true }).click()
  await expect(banner.getByRole('status')).toHaveText('보고서 확인 중')
  const composer = page.locator('.g-composer textarea')
  await composer.focus()
  await composer.evaluate(element => { (element as HTMLTextAreaElement).setSelectionRange(3, 3); Reflect.set(window, 'retainedDocumentComposer', element) })
  await page.evaluate(() => Reflect.get(window, 'documentResultChange')({ revision: '99' }))
  await settle(page, 1)
  await expect(banner.getByRole('status')).toHaveText('결과 준비됨')
  await expect.poll(() => calls(page)).toEqual({ report: 2, chart: 1, trades: 1 })
  await expect(draft).toHaveAttribute('data-draft-revision', '99')
  await expect(composer).toHaveValue('작성 중인 질문')
  expect(await composer.evaluate(element => ({ same: element === Reflect.get(window, 'retainedDocumentComposer'), caret: (element as HTMLTextAreaElement).selectionStart, focused: element === document.activeElement }))).toEqual({ same: true, caret: 3, focused: true })
  const settledCalls = await calls(page)
  await banner.getByRole('button', { name: '대화', exact: true }).click()
  await expect(page.getByRole('region', { name: '백테스트 결과', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '전략 초안', exact: true }).click()
  expect(await calls(page)).toEqual(settledCalls)
  await page.evaluate(() => Reflect.get(window, 'documentResultChange')({ locked: true }))
  await expect(composer).toBeDisabled()
  expect(apiRequests).toEqual([])
  expect(errors).toEqual([])
})

test('교체한 job의 늦은 report 실패는 현재 문서 알림을 덮지 않는다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => Reflect.get(window, 'documentResultChange')({ jobId: 'document-next-job', notice: null }))
  await expect.poll(() => calls(page)).toEqual({ report: 2, chart: 0, trades: 0 })
  await expect(page.locator('.g-conversation-notice')).toContainText('보고서 확인 중')
  const before = await audit(page)
  await settle(page, 0, true)
  await expect(page.locator('.g-conversation-notice')).toContainText('보고서 확인 중')
  await settle(page, 1)
  await expect(page.locator('.g-conversation-notice')).toContainText('결과 준비됨')
  const after = await audit(page)
  expect(after.slice(before.length).every(status => status.backtestId === 'document-next-job')).toBe(true)
  expect(after.filter(status => status.state === 'error')).toEqual([])
})

test('새 owner로 실제 subtree를 교체하거나 unmount하면 이전 결과 알림을 발행하지 않는다', async ({ page }) => {
  await mount(page)
  await page.locator('.g-title').click()
  await page.locator('.g-title-input').fill('owner-a의 개인 제목')
  await page.locator('.g-title-input').press('Enter')
  await page.evaluate(() => Reflect.get(window, 'documentResultChange')({ owner: 'owner-b', notice: null }))
  await expect(page.locator('.g-title')).toHaveText('새 전략')
  await expect.poll(() => calls(page)).toEqual({ report: 2, chart: 0, trades: 0 })
  await expect(page.locator('.g-tabs').getByRole('button', { name: '대화', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const before = await audit(page)
  await settle(page, 0, true)
  await settle(page, 1)
  await expect.poll(async () => (await audit(page)).at(-1)?.state).toBe('ready')
  expect((await audit(page)).slice(before.length).every(status => status.owner === 'owner-b')).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'documentResultChange')({ jobId: 'document-third-job', notice: null }))
  await expect.poll(() => calls(page)).toEqual({ report: 3, chart: 1, trades: 1 })
  await page.evaluate(() => Reflect.get(window, 'unmountDocumentResult')())
  const count = (await audit(page)).length
  await settle(page, 2, true)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect(await audit(page)).toHaveLength(count)
})

test('320px 문서에서 결과 알림과 44px 대화 복귀 버튼이 가려지지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await mount(page)
  await settle(page, 0, true)
  const banner = page.locator('.g-conversation-notice'), button = banner.getByRole('button', { name: '대화', exact: true })
  await expect(banner).toContainText('결과 확인 필요')
  await expect(button).toBeInViewport({ ratio: 1 })
  expect(await button.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await button.click()
  await expect(page.getByRole('button', { name: '보고서 다시 조회', exact: true })).toBeVisible()
})

test('같은 결과의 listener 교체는 현재 상태를 한 번 재통지하고 API 조회나 렌더 루프를 추가하지 않는다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await settle(page, 0)
  await expect(page.locator('.g-conversation-notice')).toContainText('결과 준비됨')
  const settledCalls = await calls(page), before = (await audit(page)).length
  await page.evaluate(() => Reflect.get(window, 'documentResultChange')({ listener: 1, notice: null }))
  await expect(page.locator('.g-conversation-notice')).toContainText('결과 준비됨')
  await expect.poll(async () => (await audit(page)).length).toBe(before + 1)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect(await audit(page)).toHaveLength(before + 1)
  expect(await calls(page)).toEqual(settledCalls)
  expect(errors).toEqual([])
})
