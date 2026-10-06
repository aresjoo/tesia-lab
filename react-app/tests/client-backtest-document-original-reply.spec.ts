import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// 원9fb final gSend:20891의 latest fin 요약을 완료된 공개 Mock bt2만 계승한다.
// Native producer/실제 AI/실제 백테스트·권한·재검증 성공을 만들지 않는다.
const summary = '현재 bt2 기준, 수익 +12.9%, 낙폭 -7.4%, Holdout 통과. 구체적으로 물어보면 근거와 함께 답합니다.'
const priorQuestion = '이전에 문서에 남긴 질문'
const priorAnswer = '보존해야 하는 기존 답변'
const draft = '문서에서 아직 보내지 않은 초안'
const conversationDraft = '대화에서 아직 보내지 않은 별도 초안'
const oldBt2 = '수익률만이 아니라 최대 낙폭, 거래 수, 승률과 연도별 손익을 함께 확인하세요. v2는 10회 거래, 최대 낙폭 -7.4%입니다.'
const oldBt1 = '수익률만이 아니라 최대 낙폭, 거래 수, 승률과 연도별 손익을 함께 확인하세요. v1은 27회 거래, 최대 낙폭 -14.8%입니다.'
const oldPlan = '조건과 검증 범위를 연구 계획에 정리했습니다. 행의 코멘트에서 변경할 조건을 남길 수 있어요.'
const audits = new WeakMap<Page, { blocked: string[]; errors: string[] }>()
type Seed = { seconds?: number; status?: 'paused' | 'completed'; active?: 'bt1' | 'bt2' | 'hypo' | 'report'; recovery?: boolean; denied?: boolean }
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
    if (url.pathname === '/backtest-reply-standalone.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="backtest-reply-root"></div></body></html>' })
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

async function seed(page: Page, options: Seed = {}) {
  const id = 'backtest-original-reply'
  await page.addInitScript(({ id, options, priorQuestion, priorAnswer, draft, conversationDraft }) => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{
      id, title: '원문 백테스트 문서 질문', renamed: true, idea: '원문 백테스트 문서 질문', draft: conversationDraft,
      pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%',
      workspace: 'research', researchStatus: '검토 필요', turns: [], updatedAt: 1,
    }] }))
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, options.recovery ? '{' : JSON.stringify({
      seconds: options.seconds ?? 95, status: options.status ?? 'completed', view: 'plan', questions: [], clockVersion: 1,
    }))
    const active = options.active ?? 'bt2'
    sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({ active,
      tabs: ['plan', 'hypo', 'bt1', 'bt2', 'report'], drafts: { [active]: draft, hypo: '가설의 별도 초안' }, rowDrafts: {},
      replies: [{ doc: active, question: priorQuestion, answer: priorAnswer }], positions: {}, edits: {}, paper: false, paused: false,
    }))
  }, { id, options, priorQuestion, priorAnswer, draft, conversationDraft })
  return id
}

async function main(page: Page, options: Seed = {}) {
  const id = await seed(page, options)
  await page.goto('/')
  await expect(page.locator('.client-restored-research')).toBeVisible()
  await expect(page.locator('.rw-heading')).toContainText('원문 백테스트 문서 질문')
  return id
}

async function standalone(page: Page, options: Seed) {
  const id = await seed(page, options)
  await page.goto('/backtest-reply-standalone.html')
  // 既검증된 실제 Vite React identity와 공개 컴포넌트를 마운트한다. 제품 state나 API는 주입하지 않는다.
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
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('backtest-reply-root')).render(react.createElement(ClientResearchWorkspace, {
      sessionId: id, idea: '원문 백테스트 문서 질문', onBack() {}, onBeforeAi: () => !options.denied,
    }))
  }, { id, options })
  await expect(page.locator('.client-restored-research')).toBeVisible()
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
test.afterEach(async ({ page }) => {
  expect(audits.get(page)).toEqual({ blocked: [], errors: [] })
})

for (const width of [320, 1440]) test(`Main ${width} 완료 bt2의 일반 질문은 원 요약·v2 수치·초안·기존 기록을 보존한다`, async ({ page, baseURL }) => {
  const { provenance } = JSON.parse(readFileSync(new URL('./fixtures/approved-client-copy.json', import.meta.url), 'utf8'))
  expect(provenance.originalCommit).toBe('9fbff821df62cad11d026022fc7628c7fcebc431')
  expect(provenance.sha256).toBe('f2475453a03b2646361546ac32002b00e4ce26ee014abf79d3be6262b318e321')
  await guard(page, baseURL)
  await page.setViewportSize({ width, height: width === 320 ? 480 : 900 })
  const id = await main(page)
  await expect(page.getByRole('tab', { name: '백테스트 v2', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('백테스트 v2에 질문', { exact: true })).toHaveValue(draft)
  await expect(answers(page)).toHaveText([priorAnswer])
  const body = await page.locator('.g-adoc').evaluate(element => {
    const copy = element.cloneNode(true) as HTMLElement
    copy.querySelector('.rw-thread')?.remove()
    return copy.textContent
  })
  await ask(page, '현재 문서를 설명하세요', summary)
  await ask(page, '결과를 한 번 더 설명하세요', summary)
  await expect(answers(page)).toHaveText([priorAnswer, summary, summary])
  const saved = await page.evaluate(id => ({
    doc: JSON.parse(sessionStorage.getItem(`teth-client-research-documents:${id}`)!),
    session: JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions[0],
    body: (() => { const copy = document.querySelector('.g-adoc')!.cloneNode(true) as HTMLElement; copy.querySelector('.rw-thread')?.remove(); return copy.textContent })(),
  }), id)
  expect(saved.body).toBe(body)
  expect(saved.doc.replies.map((row: { answer: string }) => row.answer)).toEqual([priorAnswer, summary, summary])
  expect(saved.doc.drafts.bt2).toBe('')
  expect(saved.doc.drafts.hypo).toBe('가설의 별도 초안')
  expect(saved.session.draft).toBe(conversationDraft)
  expect(saved.session.turns).toEqual([])
})

test('53·82초와 95초 직전 미완료 bt2는 완료·Holdout 요약을 발행하지 않는다', async ({ page, baseURL }) => {
  await guard(page, baseURL)
  for (const options of [{ seconds: 53, status: 'paused' }, { seconds: 82, status: 'paused' }, { seconds: 94.9, status: 'completed' }] as const) {
    const id = await main(page, options)
    const seconds = await page.evaluate(id => JSON.parse(sessionStorage.getItem(`teth-research-preview:restored:${id}`)!).seconds, id)
    expect(seconds).toBe(options.seconds)
    await expect(page.getByRole('tab', { name: '백테스트 v2', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: '검증 결과', exact: true })).toHaveCount(0)
    await ask(page, '현재 문서를 설명하세요', oldBt2)
    await expect(answers(page)).toHaveText([priorAnswer, oldBt2])
    await expect(page.locator('.g-adoc .rw-thread')).not.toContainText('Holdout 통과')
  }
})

test('완료 v1·가설·report 문서는 bt2 요약으로 치환하지 않고 기존 원문을 유지한다', async ({ page, baseURL }) => {
  await guard(page, baseURL)
  await main(page, { active: 'bt1' })
  await ask(page, '현재 문서를 설명하세요', oldBt1)
  await page.getByRole('tab', { name: '가설', exact: true }).click()
  await ask(page, '검증 기준을 설명하세요', '많이 떨어져 과매도가 된 뒤, 가격이 다시 고개를 드는 순간의 반등을 노립니다. 이 패턴이 Research 구간과 Holdout 구간 모두에서 확인되어야 가설이 유지됩니다. 결과는 Backtest, Holdout artifact에서 확인하십시오.')
  await page.getByRole('tab', { name: '검증 결과', exact: true }).click()
  await ask(page, '현재 문서를 설명하세요', '현재 report 기준, 수익 +12.9%, 낙폭 -7.4%, Holdout 통과. 구체적으로 물어보면 근거와 함께 답합니다.')
  await page.getByRole('tab', { name: '백테스트 v1', exact: true }).click()
  await expect(answers(page)).toHaveText([priorAnswer, oldBt1])
})

test('완료 bt2의 제외 질문·선택 거래 supplied 답변은 일반 요약에 덮이지 않는다', async ({ page, baseURL }) => {
  await guard(page, baseURL)
  await page.setViewportSize({ width: 1440, height: 900 })
  await main(page)
  for (const question of ['줄여 주세요', '늘려 주세요', '바꿔 주세요', '수정하세요', '해줘', '재검증 요청', '다시 설명', '왜', '약했나요', '손실 원인', '가정은', '위험은']) await ask(page, question, oldBt2)
  const count = await answers(page).count()
  await page.getByRole('button', { name: '차트로 자세히 보기' }).click()
  await expect(page.locator('.ra-analysis')).toHaveAttribute('data-version', '2')
  await expect(page.locator('.ra-ledger > button')).toHaveCount(10)
  await page.locator('.ra-ledger > button').first().click()
  await expect(page.locator('.ra-reference')).toContainText('거래 1')
  await page.locator('#ra-question').fill('현재 문서를 설명하세요')
  await page.getByRole('button', { name: '차트 질문 보내기', exact: true }).click()
  const supplied = page.locator('.ra-thread .rw-answer').last()
  await expect(supplied).toContainText('Backtest v2 · 거래 1')
  await expect(supplied).toContainText('문서에 기록된 거래입니다. 조건 변경은 새 검증이 필요하며 기존 결과는 그대로 유지됩니다.')
  await expect(supplied).not.toHaveText(summary)
  const text = await supplied.textContent()
  await page.getByRole('button', { name: '백테스트 v2로 돌아가기', exact: true }).click()
  await expect(answers(page)).toHaveCount(count + 1)
  await expect(answers(page).last()).toHaveText(text!)
  await expect(page.getByLabel('백테스트 v2에 질문', { exact: true })).toHaveValue('')
})

test('복구 불명확 또는 admission false는 bt2 완료 요약·초안 삭제·새 권한을 만들지 않는다', async ({ page, baseURL }) => {
  await guard(page, baseURL)
  let id = await standalone(page, { recovery: true })
  await expect(page.locator('.rw-notice')).toContainText('저장된 연구 진행을 확인할 수 없어요.')
  await expect(page.getByRole('tab', { name: '백테스트 v2', exact: true })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: '연구 계획', exact: true })).toHaveAttribute('aria-selected', 'true')
  await ask(page, '현재 문서를 설명하세요', oldPlan)
  expect(await page.evaluate(id => sessionStorage.getItem(`teth-research-preview:restored:${id}`), id)).toBe('{')
  id = await standalone(page, { denied: true })
  const composer = page.getByLabel('백테스트 v2에 질문', { exact: true })
  await expect(composer).toHaveValue(draft)
  await composer.fill('거부된 AI 진입에서 보존할 질문')
  await composer.press('Enter')
  await expect(composer).toHaveValue('거부된 AI 진입에서 보존할 질문')
  await expect(composer).toBeFocused()
  await expect(answers(page)).toHaveText([priorAnswer])
  await page.getByRole('button', { name: '문서 질문 보내기', exact: true }).click()
  await expect(answers(page)).toHaveText([priorAnswer])
  const saved = await page.evaluate(id => JSON.parse(sessionStorage.getItem(`teth-client-research-documents:${id}`)!), id)
  expect(saved.paper).toBe(false)
  expect(saved.replies).toEqual([{ doc: 'bt2', question: priorQuestion, answer: priorAnswer }])
  expect(saved.drafts.bt2).toBe('거부된 AI 진입에서 보존할 질문')
})
