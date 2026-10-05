import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { CLIENT_RESEARCH_FIXTURE } from '../src/client-research-fixtures'

// 원9fb final gDocAsk index:20884/20891. 기대 원문은 제품 reply helper에서 만들지 않는다.
// 공개 Main Mock 진입과 standalone 명시 props 경계만; 실제 AI/Native/검증 성공이 아니다.
const emptyReply = '아직 검증 결과가 없습니다. 연구를 먼저 시작하십시오.'
const reportReply = '현재 report 기준, 수익 +12.9%, 낙폭 -7.4%, Holdout 통과. 구체적으로 물어보면 근거와 함께 답합니다.'
const oldPlanReply = '조건과 검증 범위를 연구 계획에 정리했습니다. 행의 코멘트에서 변경할 조건을 남길 수 있어요.'
const oldReportReply = '수익성 판단은 일치하지만 위험 심사는 낙폭과 손실 지속 기간 측면에서 보류했습니다. 다수결로 덮지 않고 실제 체결 차이는 가상 검증에서 확인합니다.'
const oldQuestion = '이전에 문서에 남긴 질문'
const oldAnswer = '보존해야 하는 기존 답변'
type Seed = {
  active?: 'plan' | 'report' | 'bt1'
  seconds?: number
  status?: 'idle' | 'paused' | 'completed'
  tabs?: string[]
  priorResult?: 'bt1' | 'bt2' | 'report'
  registered?: boolean
  recovery?: boolean
  parameters?: boolean
  hasBacktestResult?: boolean
  denied?: boolean
  language?: 'ko' | 'en'
}
const audit = new WeakMap<Page, { blocked: string[]; errors: string[] }>()
test.use({ serviceWorkers: 'block' })

async function guard(page: Page, baseURL: string | undefined) {
  if (!baseURL) throw Error('LOCAL_BASE_REQUIRED')
  const origin = new URL(baseURL).origin
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname)) throw Error('LOOPBACK_REQUIRED')
  const result = { blocked: [] as string[], errors: [] as string[] }
  audit.set(page, result)
  page.on('pageerror', () => result.errors.push('PAGE_ERROR'))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (request.method() !== 'GET' || url.origin !== origin || url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      result.blocked.push(request.method() !== 'GET' ? 'MUTATION' : url.origin !== origin ? 'EXTERNAL' : 'API')
      return route.abort('blockedbyclient')
    }
    if (url.pathname === '/reply-copy-standalone.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="reply-copy-root"></div></body></html>' })
    return route.continue()
  })
  await page.context().routeWebSocket('**', socket => {
    const url = new URL(socket.url())
    // Vite 개발 클라이언트의 정확한 loopback HMR 경로도 닫는다. 앱/외부 WS는
    // 여전히 실패이며, 개발용 연결 시도를 제품 네트워크로 집계하지 않는다.
    const localHmr = url.origin === origin.replace(/^http/, 'ws') && url.pathname === '/'
      && url.searchParams.has('token') && [...url.searchParams.keys()].every(key => key === 'token')
    if (!localHmr) result.blocked.push('WEBSOCKET')
    socket.close()
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
}

async function seed(page: Page, id: string, options: Seed) {
  await page.addInitScript(({ id, options, oldQuestion, oldAnswer }) => {
    localStorage.setItem('tethLang', options.language ?? 'ko')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{
      id, title: '원문 답변 경계 검수', renamed: true, idea: '원문 답변 경계 검수', draft: '대화의 원래 초안',
      pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%',
      workspace: 'research', researchStatus: '초안', turns: [], updatedAt: 1,
    }] }))
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, options.recovery ? '{' : JSON.stringify({
      seconds: options.seconds ?? 0, status: options.status ?? 'idle', view: 'plan', questions: [], clockVersion: 1,
    }))
    const active = options.active ?? 'plan'
    sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({ active,
      tabs: options.tabs ?? [active], drafts: { [active]: '문서의 원래 초안' }, rowDrafts: {},
      replies: [{ doc: active, question: oldQuestion, answer: oldAnswer }, ...(options.priorResult ? [{ doc: options.priorResult, question: '기존 결과 질문', answer: '기존 결과 답변' }] : [])],
      positions: {}, edits: {}, paper: false, paused: false,
    }))
  }, { id, options, oldQuestion, oldAnswer })
}

async function main(page: Page, baseURL: string | undefined, options: Seed = {}) {
  await guard(page, baseURL)
  const id = 'document-reply-main'
  await seed(page, id, options)
  await page.goto('/')
  await expect(page.locator('.client-restored-research')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return id
}

async function standalone(page: Page, baseURL: string | undefined, options: Seed = {}) {
  await guard(page, baseURL)
  const id = 'document-reply-standalone'
  await seed(page, id, options)
  await page.goto('/reply-copy-standalone.html')
  await page.evaluate(async ({ id, options }) => {
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
    const props = { sessionId: id, idea: '원문 답변 경계 검수', onBack() {}, registered: options.registered ?? false, hasBacktestResult: options.hasBacktestResult ?? false,
      onBeforeAi: () => !options.denied,
      ...(options.parameters ? { planContext: { pair: 'BTC/USDT', mode: 'dip', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', parameters: { sl: -3, tp: 8, rsiTh: 40, trendFilter: false, startI: 61, endI: 909 } } } : {}),
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('reply-copy-root')).render(react.createElement(ClientResearchWorkspace, props))
  }, { id, options })
  await expect(page.locator('.client-restored-research')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return id
}

const answers = (page: Page) => page.locator('.g-adoc .rw-thread .rw-answer')
async function ask(page: Page, question: string, expected: string) {
  const composer = page.locator('.rw-composer textarea'), count = await answers(page).count()
  await composer.fill(question)
  await composer.press('Enter')
  await expect(answers(page)).toHaveCount(count + 1)
  await expect(answers(page).last()).toHaveText(expected)
  await expect(composer).toHaveValue('')
  await expect(composer).toBeFocused()
}
test.afterEach(async ({ page }) => { expect(audit.get(page) ?? { blocked: [], errors: [] }).toEqual({ blocked: [], errors: [] }) })

test('원9fb 독립 원문과 기존 v2 fixture는 report 요약 수치의 근거를 보존한다', () => {
  // 원문 추출 출처는 저장소의 독립 Golden에 고정한다. 다른 checkout/CI에서도
  // 로컬 원본 worktree 없이 실행하며, 원20884/20891의 리터럴과 보간을 직접 검산한다.
  const { provenance } = JSON.parse(readFileSync(new URL('./fixtures/approved-client-copy.json', import.meta.url), 'utf8'))
  expect(provenance.originalCommit).toBe('9fbff821df62cad11d026022fc7628c7fcebc431')
  expect(provenance.sha256).toBe('f2475453a03b2646361546ac32002b00e4ce26ee014abf79d3be6262b318e321')
  const source = readFileSync(new URL('../src/components/ClientResearchWorkspace.tsx', import.meta.url), 'utf8')
  expect(source).toContain("freshPlan ? '아직 검증 결과가 없습니다. 연구를 먼저 시작하십시오.'")
  expect(source).toContain('completedReport ? `현재 ${doc} 기준, 수익 ${pct(FIXTURE.versions[1].ret)}, 낙폭 ${FIXTURE.versions[1].mdd.toFixed(1)}%, Holdout ${FIXTURE.holdout.ret > 0 ? \'통과\' : \'경고\'}. 구체적으로 물어보면 근거와 함께 답합니다.`')
  expect(CLIENT_RESEARCH_FIXTURE.versions[1].ret).toBeCloseTo(12.852237351667517, 12)
  expect(CLIENT_RESEARCH_FIXTURE.versions[1].mdd).toBeCloseTo(-7.443031041101533, 12)
  expect(CLIENT_RESEARCH_FIXTURE.holdout.ret).toBeCloseTo(8.890059801600003, 12)
})

test('Main 새 idle 계획의 반복 일반 질문은 미검증 원문·제목·초안·기존 thread를 보존한다', async ({ page, baseURL }) => {
  const id = await main(page, baseURL)
  await expect(page.locator('.rw-heading')).toContainText('원문 답변 경계 검수')
  await expect(answers(page).first()).toHaveText(oldAnswer)
  await expect(page.getByRole('tab', { name: '연구 계획', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: '백테스트 v1', exact: true })).toHaveCount(0)
  await ask(page, '지금 문서에 관해 설명하세요', emptyReply)
  await ask(page, '검증 결과가 있습니까', emptyReply)
  await expect(answers(page)).toHaveText([oldAnswer, emptyReply, emptyReply])
  const cached = await page.evaluate(id => JSON.parse(sessionStorage.getItem(`teth-client-research-documents:${id}`)!), id)
  expect(cached.tabs).toEqual(['plan'])
  expect(cached.replies.map((row: { answer: string }) => row.answer)).toEqual([oldAnswer, emptyReply, emptyReply])
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions[0].draft)).toBe('대화의 원래 초안')
})

test('Main 완료 report의 일반 질문은 원 report 템플릿·반복·제목·기존 reply를 보존한다', async ({ page, baseURL }) => {
  await main(page, baseURL, { active: 'report', seconds: 95, status: 'completed', tabs: ['plan', 'report'] })
  await expect(page.getByRole('tab', { name: '검증 결과', exact: true })).toHaveAttribute('aria-selected', 'true')
  await ask(page, '현재 문서를 설명하세요', reportReply)
  await ask(page, '결과를 한 번 더 설명하세요', reportReply)
  await expect(answers(page)).toHaveText([oldAnswer, reportReply, reportReply])
  await expect(page.locator('.rw-heading')).toContainText('원문 답변 경계 검수')
})

for (const [label, options] of [
  ['기존 inline parameters', { parameters: true }],
  ['선택하지 않은 기존 inline 결과', { hasBacktestResult: true }],
  ['이미 등록된 계획', { registered: true }],
  ['읽을 수 없는 재생 복구', { recovery: true }],
  ['0초지만 일시 중지된 계획', { seconds: 0, status: 'paused' }],
  ['idle이지만 진행 기록이 있는 계획', { seconds: 10, status: 'idle' }],
  ['이미 완료된 계획', { seconds: 95, status: 'completed', tabs: ['plan', 'report'] }],
  ['기존 bt1 답변', { priorResult: 'bt1' }],
  ['기존 bt2 답변', { priorResult: 'bt2' }],
  ['기존 report 답변', { priorResult: 'report' }],
] as [string, Seed][]) test(`standalone 명시 경계: ${label}는 기존 계획 답변을 유지한다`, async ({ page, baseURL }) => {
  const id = await standalone(page, baseURL, options)
  await ask(page, '현재 문서를 설명하세요', oldPlanReply)
  await expect(answers(page).first()).toHaveText(oldAnswer)
  if (options.recovery) await expect(page.locator('.rw-notice')).toContainText('저장된 연구 진행을 확인할 수 없어요.')
  if (options.priorResult) {
    const cached = await page.evaluate(id => JSON.parse(sessionStorage.getItem(`teth-client-research-documents:${id}`)!), id)
    expect(cached.replies).toContainEqual({ doc: options.priorResult, question: '기존 결과 질문', answer: '기존 결과 답변' })
  }
})

test('standalone admissionfalse는 원문 요약·답변 추가·초안 삭제를 하지 않는다', async ({ page, baseURL }) => {
  await standalone(page, baseURL, { denied: true })
  const composer = page.locator('.rw-composer textarea')
  await composer.fill('현재 문서를 설명하세요')
  await composer.press('Enter')
  await expect(composer).toHaveValue('현재 문서를 설명하세요')
  await expect(composer).toBeFocused()
  await expect(answers(page)).toHaveText([oldAnswer])
})

test('Main 완료 report의 명시 수정·원인·가정·위험 질문은 기존 답변 경계를 유지한다', async ({ page, baseURL }) => {
  await main(page, baseURL, { active: 'report', seconds: 95, status: 'completed' })
  for (const question of ['줄여 주세요', '늘려 주세요', '바꿔 주세요', '수정하세요', '해줘', '재검증 요청', '다시 설명', '왜', '약했나요', '손실 원인', '가정은', '위험은']) {
    await ask(page, question, oldReportReply)
  }
  await expect(answers(page).first()).toHaveText(oldAnswer)
})

test('standalone 등록 완료 report는 읽기용 원 요약만 추가하고 실행 권한을 만들지 않는다', async ({ page, baseURL }) => {
  await standalone(page, baseURL, { active: 'report', seconds: 95, status: 'completed', registered: true })
  await ask(page, '현재 문서를 설명하세요', reportReply)
  await expect(answers(page).first()).toHaveText(oldAnswer)
  await expect(page.locator('.rw-notice')).toHaveCount(0)
})

test('standalone v1은 완료 report 수치나 미검증 계획 원문을 발행하지 않는다', async ({ page, baseURL }) => {
  await standalone(page, baseURL, { active: 'bt1', seconds: 21, status: 'paused' })
  await ask(page, '현재 문서를 설명하세요', '수익률만이 아니라 최대 낙폭, 거래 수, 승률과 연도별 손익을 함께 확인하세요. v1은 27회 거래, 최대 낙폭 -14.8%입니다.')
})

test('standalone 미완료 report 요청은 미발행 문서를 열거나 완료 요약을 만들지 않는다', async ({ page, baseURL }) => {
  await standalone(page, baseURL, { active: 'report', seconds: 94.9, status: 'paused', tabs: ['plan', 'report'] })
  await expect(page.getByRole('tab', { name: '검증 결과', exact: true })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: '연구 계획', exact: true })).toHaveAttribute('aria-selected', 'true')
  await ask(page, '현재 문서를 설명하세요', oldPlanReply)
})

test('Main report what-if의 명시 supplied 답변은 원 일반 요약에 덮이지 않는다', async ({ page, baseURL }) => {
  await main(page, baseURL, { active: 'report', seconds: 95, status: 'completed' })
  const composer = page.locator('.rw-composer textarea')
  await expect(composer).toHaveValue('문서의 원래 초안')
  await page.getByRole('button', { name: '수수료 2배', exact: true }).click()
  await expect(answers(page).last()).toHaveText('만약에 · 수수료 2배, 수익 +10.6%, 낙폭 -8.0%, 10회 (정식 연구 아님)')
  await expect(composer).toHaveValue('문서의 원래 초안')
  await expect(answers(page).first()).toHaveText(oldAnswer)
})

test('Main plan 행 comment의 명시 답변과 초안은 미검증 일반 질문으로 덮이지 않는다', async ({ page, baseURL }) => {
  await main(page, baseURL)
  await page.getByRole('button', { name: '진입 수정 요청', exact: true }).click()
  await page.getByRole('textbox', { name: '진입 코멘트', exact: true }).fill('매수 조건을 검토')
  await page.getByRole('button', { name: '적용', exact: true }).click()
  await expect(answers(page).last()).toHaveText('수정 요청을 이 문서에 남겼습니다. 검증이 끝난 버전의 조건은 그대로 유지됩니다.')
  await expect(page.locator('.rw-composer textarea')).toHaveValue('문서의 원래 초안')
  await expect(page.getByRole('button', { name: '진입 수정 요청', exact: true })).toBeFocused()
})

test('standalone English 표시 제목은 유지하며 원문 답변과 이전 thread만 추가한다', async ({ page, baseURL }) => {
  await standalone(page, baseURL, { language: 'en' })
  const selected = page.getByRole('tab', { selected: true })
  const title = await selected.textContent()
  expect(title).toBe('Research Plan')
  await ask(page, '현재 문서를 설명하세요', emptyReply)
  await expect(selected).toHaveText(title!)
  await expect(answers(page).first()).toHaveText(oldAnswer)
  expect(await page.evaluate(() => localStorage.getItem('tethLang'))).toBe('en')
})
