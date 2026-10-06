import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// 고정9fb index:11884의 Hypothesis 본문 원문을 ask에도 공유하는 작은 회귀.
// 원 gSend:20884의 모든 문서 무결과 분기 복원/실제 연구 성공/Native 응답이 아니다.
const criterion = '이 패턴이 Research 구간과 Holdout 구간 모두에서 확인되어야 가설이 유지됩니다. 결과는 Backtest, Holdout artifact에서 확인하십시오.'
const plain = '많이 떨어져 과매도가 된 뒤, 가격이 다시 고개를 드는 순간의 반등을 노립니다.'
const expectedReply = `${plain} ${criterion}`
const priorQuestion = '기존 가설 질문'
const priorAnswer = '보존해야 하는 기존 가설 답변'
const initialDraft = '가설 문서에서 아직 보내지 않은 초안'
const conversationDraft = '대화에 보존해야 하는 별도 초안'
const audits = new WeakMap<Page, { blocked: string[]; errors: string[] }>()
test.use({ serviceWorkers: 'block' })

async function guard(page: Page, baseURL: string | undefined) {
  if (!baseURL) throw Error('LOCAL_BASE_REQUIRED')
  const origin = new URL(baseURL).origin
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname)) throw Error('LOOPBACK_REQUIRED')
  const audit = { blocked: [] as string[], errors: [] as string[] }
  audits.set(page, audit)
  page.on('pageerror', () => audit.errors.push('PAGE_ERROR'))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (request.method() !== 'GET' || url.origin !== origin || url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      audit.blocked.push(request.method() !== 'GET' ? 'MUTATION' : url.origin !== origin ? 'EXTERNAL' : 'API')
      return route.abort('blockedbyclient')
    }
    if (url.pathname === '/hypothesis-copy-standalone.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="hypothesis-copy-root"></div></body></html>' })
    return route.continue()
  })
  await page.context().routeWebSocket('**', socket => {
    const url = new URL(socket.url())
    const localHmr = url.origin === origin.replace(/^http/, 'ws') && url.pathname === '/'
      && url.searchParams.has('token') && [...url.searchParams.keys()].every(key => key === 'token')
    if (!localHmr) audit.blocked.push('WEBSOCKET')
    socket.close()
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
}

async function seed(page: Page, id: string, completed = false) {
  await page.addInitScript(({ id, completed, priorQuestion, priorAnswer, initialDraft, conversationDraft }) => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{
      id, title: '가설 원문 공유 검수', renamed: true, idea: '가설 원문 공유 검수', draft: conversationDraft,
      pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%',
      workspace: 'research', researchStatus: completed ? '검토 필요' : '진행 중', turns: [], updatedAt: 1,
    }] }))
    // 독립 고정 공개 Mock 관측. 실제 전략/진행/결과를 만들어낸 증거가 아니다.
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({
      seconds: completed ? 95 : 1, status: completed ? 'completed' : 'paused', view: 'plan', questions: [], clockVersion: 1,
    }))
    sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({
      active: 'hypo', tabs: completed ? ['plan', 'hypo', 'report'] : ['plan', 'hypo'],
      drafts: { hypo: initialDraft, report: '보고서의 별도 초안' }, rowDrafts: {},
      replies: [{ doc: 'hypo', question: priorQuestion, answer: priorAnswer }], positions: {}, edits: {}, paper: false, paused: false,
    }))
  }, { id, completed, priorQuestion, priorAnswer, initialDraft, conversationDraft })
}

const answers = (page: Page) => page.locator('.g-adoc .rw-thread .rw-answer')
async function ready(page: Page) {
  await expect(page.locator('.client-restored-research')).toBeVisible()
  await expect(page.getByRole('tab', { name: '가설', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('article', { name: '가설 문서', exact: true }).locator('.g-note').last()).toHaveText(criterion)
  await expect(answers(page)).toHaveText([priorAnswer])
  await expect(page.getByLabel('가설에 질문', { exact: true })).toHaveValue(initialDraft)
}

async function main(page: Page, baseURL: string | undefined, completed = false) {
  await guard(page, baseURL)
  const id = 'hypothesis-copy-main'
  await seed(page, id, completed)
  await page.goto('/')
  await ready(page)
  return id
}

async function deniedStandalone(page: Page, baseURL: string | undefined) {
  await guard(page, baseURL)
  const id = 'hypothesis-copy-denied'
  await seed(page, id)
  await page.goto('/hypothesis-copy-standalone.html')
  await page.evaluate(async id => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const componentPath = '/src/components/ClientResearchWorkspace.tsx'
    const source = await (await fetch(componentPath)).text()
    const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw Error('SAME_REACT_REQUIRED')
    const module = await import(/* @vite-ignore */ reactPath), react = module.default ?? module
    const domPath = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ domPath)
    const { ClientResearchWorkspace } = await import(/* @vite-ignore */ componentPath)
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('hypothesis-copy-root')).render(react.createElement(ClientResearchWorkspace, {
      sessionId: id, idea: '가설 원문 공유 검수', onBack() {}, onBeforeAi: () => false,
    }))
  }, id)
  await ready(page)
  return id
}

test.afterEach(async ({ page }) => {
  expect(audits.get(page) ?? { blocked: [], errors: [] }).toEqual({ blocked: [], errors: [] })
})

test('Hypothesis 검증 기준의 독립 Golden 출처는 원9fb에 고정된다', () => {
  const { provenance } = JSON.parse(readFileSync(new URL('./fixtures/approved-client-copy.json', import.meta.url), 'utf8'))
  expect(provenance.originalCommit).toBe('9fbff821df62cad11d026022fc7628c7fcebc431')
  expect(provenance.sha256).toBe('f2475453a03b2646361546ac32002b00e4ce26ee014abf79d3be6262b318e321')
  const source = readFileSync(new URL('../src/components/ClientResearchWorkspace.tsx', import.meta.url), 'utf8')
  expect(source).toContain(`<div className="g-note">${criterion}</div>`)
})

for (const width of [320, 1440]) test(`Main ${width} 가설 질문은 원 검증 기준·본문·이전 기록과 대화 초안을 보존한다`, async ({ page, baseURL }) => {
  await page.setViewportSize({ width, height: width === 320 ? 480 : 900 })
  const id = await main(page, baseURL)
  const composer = page.getByLabel('가설에 질문', { exact: true })
  const question = '이 가설의 검증 기준을 설명하세요'
  await composer.fill(question)
  await composer.press('Enter')
  await expect(answers(page)).toHaveText([priorAnswer, expectedReply])
  await expect(page.locator('.g-adoc .rw-thread .rw-user-message')).toHaveText([priorQuestion, question])
  await expect(composer).toHaveValue('')
  await expect(composer).toBeFocused()
  await expect(page.getByRole('article', { name: '가설 문서', exact: true }).locator('.g-note').last()).toHaveText(criterion)
  await expect(page.getByRole('tab', { name: '백테스트 v1', exact: true })).toHaveCount(0)
  const cache = await page.evaluate(id => ({
    documents: JSON.parse(sessionStorage.getItem(`teth-client-research-documents:${id}`)!),
    conversation: JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions[0],
  }), id)
  expect(cache.documents.replies).toEqual([
    { doc: 'hypo', question: priorQuestion, answer: priorAnswer }, { doc: 'hypo', question, answer: expectedReply },
  ])
  expect(cache.documents.drafts.hypo).toBe('')
  expect(cache.conversation.draft).toBe(conversationDraft)
})

test('standalone admission false는 가설 답변·초안·기존 thread를 변경하지 않는다', async ({ page, baseURL }) => {
  await deniedStandalone(page, baseURL)
  const composer = page.getByLabel('가설에 질문', { exact: true })
  const draft = '거부된 AI 진입에서 보존할 가설 질문'
  await composer.fill(draft)
  await composer.press('Enter')
  await expect(composer).toHaveValue(draft)
  await expect(composer).toBeFocused()
  await expect(answers(page)).toHaveText([priorAnswer])
  await page.getByRole('button', { name: '문서 질문 보내기', exact: true }).click()
  await expect(composer).toHaveValue(draft)
  await expect(answers(page)).toHaveText([priorAnswer])
})

test('명시 what-if 답변 우선순위는 가설 원문 공유와 독립이며 가설 초안을 보존한다', async ({ page, baseURL }) => {
  await main(page, baseURL, true)
  await page.getByRole('tab', { name: '검증 결과', exact: true }).click()
  const composer = page.getByLabel('검증 결과에 질문', { exact: true })
  await expect(composer).toHaveValue('보고서의 별도 초안')
  await page.getByRole('button', { name: '수수료 2배', exact: true }).click()
  await expect(answers(page)).toHaveText(['만약에 · 수수료 2배, 수익 +10.6%, 낙폭 -8.0%, 10회 (정식 연구 아님)'])
  await expect(composer).toHaveValue('보고서의 별도 초안')
  await page.getByRole('tab', { name: '가설', exact: true }).click()
  await expect(page.getByLabel('가설에 질문', { exact: true })).toHaveValue(initialDraft)
  await expect(answers(page)).toHaveText([priorAnswer])
})
