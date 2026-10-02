import { expect, test, type Page } from '@playwright/test'

/** Supplied native presentation ports only; no producer, order or HTTP acceptance proof. */
async function mount(page: Page, research = false, port: 'bound' | 'missing' | 'foreign' = 'bound') {
  await page.route('**/native-followups-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture" style="height:100dvh"></div></body></html>' }))
  await page.goto('/native-followups-test.html')
  await page.evaluate(async ({ research, port }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/internal-poc/ClientServiceExperience.tsx', dp = '/@id/react-dom/client', pp = '/src/client-preferences.ts'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, dom = await import(/* @vite-ignore */ dp)
    const { ClientServiceExperience } = await import(/* @vite-ignore */ cp), { setClientPreference } = await import(/* @vite-ignore */ pp)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    let input = '전송하지 않은 기존 초안', mode = 'reject', priority = 'none', newTail = false
    let settle: ((accepted: boolean) => void) | undefined
    const audit = { voidSends: 0, aborted: 0, calls: [] as { selection: unknown; thread: unknown }[] }
    const binding = { scopeId: 'owner-a/conversation-a', messageId: 'followup-message', observationId: 'followup-observation' }
    const thread = research ? { scopeId: 'research-a', documentId: 'plan' } : undefined
    const followup = { id: 'followup-list', kind: 'followups', presentation: { binding, showFreeBadge: true,
      actions: [{ id: 'validate', type: 'backtest', label: '공급된 조건으로 검증하기' }, { id: 'alert', type: 'alert', label: '공급된 알림 조건 저장' }],
      questions: [{ id: 'why', label: '근거를 더 알아보기', text: '공급된 조건의 근거를 설명해주세요' }],
    } }
    const question = { id: 'priority-question', kind: 'market-question', presentation: { binding: { ...binding, observationId: 'priority-question' }, steps: [{ id: 'asset', title: '먼저 확인할 공급 질문', options: [{ id: 'btc', label: '비트코인' }] }] } }
    const render = () => root.render(react.createElement(ClientServiceExperience, {
      nativeAccounts: true, accountScope: 'owner-a',
      followupActions: port === 'missing' ? undefined : { scope: port === 'foreign' ? 'owner-b' : 'owner-a', activate: (selection: unknown, signal: AbortSignal, origin: unknown) => {
        audit.calls.push({ selection: structuredClone(selection), thread: origin ?? null })
        signal.addEventListener('abort', () => { audit.aborted++ }, { once: true })
        if (mode === 'pending') return new Promise<boolean>(resolve => { settle = resolve })
        if (mode === 'void') return undefined // Deliberately invalid ACK: must never become accepted.
        return mode === 'accept'
      } },
      clarification: priority === 'clarification' ? { prompt: '먼저 확인할 단일 질문', identity: 'priority-clarification' } : null,
      ...(research ? { researchPresentation: { scope: 'owner-a', data: { scopeId: 'research-a', status: 'done' } } } : {}),
      state: { phase: 'ready', sessionState: 'AUTHENTICATED', input, busy: false, inputDisabled: false, source: 'service', recovery: null,
        quickReplies: priority === 'clarification' ? ['공급된 답변 선택'] : [], workflow: null, outcome: null, issue: null,
        messages: [{ id: 'user-message', role: 'user', text: '현재 조건을 확인해주세요', ...(thread ? { researchThread: thread } : {}) },
          { id: binding.messageId, role: 'assistant', text: '원문 응답', ...(thread ? { researchThread: thread } : {}),
            observation: { id: 'observed-work', label: ['공급된 작업 기록'], status: 'done', steps: [], reply: ['관측된 답변 원문'] },
            responseBlocks: [{ id: 'ignored-text', kind: 'text', text: '관측을 덮어쓰면 안 되는 본문', status: 'done' }, followup, ...(priority === 'market' ? [question] : [])],
          }, ...(newTail ? [{ id: 'new-user-message', role: 'user', text: '새로 보낸 대화 원문', ...(thread ? { researchThread: thread } : {}) }] : [])],
        onInput: (value: string) => { input = value; render() }, onSend: async () => { audit.voidSends++ }, onReset: () => false, onRecover: undefined, onLogout: undefined,
      },
    }))
    Object.assign(window, { followupHostAudit: audit,
      followupHostMode: (value: string) => { mode = value },
      followupHostPriority: (value: string) => { priority = value; render() },
      followupHostTail: () => { newTail = true; render() },
      followupHostSettle: (accepted: boolean) => settle?.(accepted),
    })
    setClientPreference('language', 'ko'); render()
  }, { research, port })
  if (research) await page.locator('[data-native-open-research]').click()
  await expect(page.locator('.client-followups:visible')).toBeVisible()
}

const list = (page: Page) => page.locator('.client-followups:visible')
const audit = (page: Page) => page.evaluate(() => Reflect.get(window, 'followupHostAudit'))

for (const research of [false, true]) test(`${research ? '연구 문서' : '일반 대화'}의 원본 후속 목록은 관측을 보존하고 명시 ACK 뒤에만 닫힌다`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page, research)
  const composer = page.locator('.g-composer textarea:visible')
  await composer.evaluate(el => Reflect.set(window, 'followupOriginalComposer', el))
  await expect(page.getByText('관측된 답변 원문', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '공급된 작업 기록', exact: true })).toBeVisible()
  await expect(page.getByText('관측을 덮어쓰면 안 되는 본문', { exact: true })).toHaveCount(0)
  await expect(list(page).locator('button')).toHaveCount(3)
  expect(await list(page).locator('button').evaluateAll(nodes => nodes.map(node => node.className))).toEqual(['g-acbtn', 'g-acbtn', 'g-nextq'])
  await expect(list(page).locator('.g-actnote')).toHaveText('전략 초안과 검증은 무료예요. 실제 주문은 거래소 연결과 최종 확인 후에만 시작됩니다.')
  await expect(list(page).locator('.bdg')).toHaveCount(2)
  expect(await page.locator('.client-answer-actions').evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(await list(page).evaluate(el => el.getBoundingClientRect().top))
  for (const mode of ['reject', 'void']) {
    await page.evaluate(mode => Reflect.get(window, 'followupHostMode')(mode), mode)
    await list(page).locator('.g-acbtn').first().click()
    await expect(list(page).locator('.followup-notice')).toContainText('전달하지 못했습니다')
  }
  await page.screenshot({ path: info.outputPath(`native-followups-${research ? 'research' : 'conversation'}.png`), fullPage: true })
  await page.evaluate(() => Reflect.get(window, 'followupHostMode')('accept'))
  await list(page).locator('.g-acbtn').first().click()
  await expect(list(page)).toHaveCount(0)
  await expect(composer).toHaveValue('전송하지 않은 기존 초안')
  expect(await composer.evaluate(el => el === Reflect.get(window, 'followupOriginalComposer'))).toBe(true)
  const result = await audit(page)
  expect(result.voidSends).toBe(0); expect(result.calls).toHaveLength(3)
  for (const call of result.calls) {
    expect(call.selection).toEqual({ binding: { scopeId: 'owner-a/conversation-a', messageId: 'followup-message', observationId: 'followup-observation' }, kind: 'action', item: { id: 'validate', type: 'backtest', label: '공급된 조건으로 검증하기' } })
    expect(call.thread).toEqual(research ? { scopeId: 'research-a', documentId: 'plan' } : null)
  }
  expect(errors).toEqual([])
})

for (const port of ['missing', 'foreign'] as const) test(`${port === 'missing' ? '미공급' : '다른 계정'} 포트는 기존 void 전송으로 대체하지 않는다`, async ({ page }) => {
  await mount(page, false, port)
  await list(page).locator('.g-nextq').click()
  await expect(list(page).locator('.followup-notice')).toContainText('현재 대화에서 이 작업을 진행할 수 없습니다')
  expect(await audit(page)).toEqual({ voidSends: 0, aborted: 0, calls: [] })
  await expect(page.locator('.g-composer textarea:visible')).toHaveValue('전송하지 않은 기존 초안')
})

for (const priority of ['clarification', 'market']) test(`${priority === 'clarification' ? '단일 질문' : '다단계 질문'}이 활성화되면 후속 목록보다 우선한다`, async ({ page }) => {
  await mount(page)
  await page.evaluate(priority => Reflect.get(window, 'followupHostPriority')(priority), priority)
  await expect(page.getByText(priority === 'clarification' ? '먼저 확인할 단일 질문' : '먼저 확인할 공급 질문', { exact: true })).toBeVisible()
  await expect(list(page)).toHaveCount(0)
  await expect(page.getByText('관측된 답변 원문', { exact: true })).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'followupHostPriority')('none'))
  await expect(list(page)).toBeVisible()
  expect((await audit(page)).calls).toHaveLength(0)
})

test('새 대화 tail은 과거 목록과 대기 ACK를 폐기하되 이전 관측·새 메시지·초안을 보존한다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => Reflect.get(window, 'followupHostMode')('pending'))
  await list(page).locator('.g-nextq').click()
  await expect(list(page)).toHaveAttribute('aria-busy', 'true')
  await expect(list(page).locator('button:disabled')).toHaveCount(3)
  await page.evaluate(() => Reflect.get(window, 'followupHostTail')())
  await expect(list(page)).toHaveCount(0)
  await expect.poll(async () => (await audit(page)).aborted).toBe(1)
  await page.evaluate(() => Reflect.get(window, 'followupHostSettle')(true))
  await expect(page.getByText('새로 보낸 대화 원문', { exact: true })).toBeVisible()
  await expect(page.getByText('관측된 답변 원문', { exact: true })).toBeVisible()
  await expect(page.locator('.g-composer textarea:visible')).toHaveValue('전송하지 않은 기존 초안')
  await expect(list(page)).toHaveCount(0)
  expect((await audit(page)).calls).toHaveLength(1)
  expect((await audit(page)).voidSends).toBe(0)
})

test('연구 문서의 후속 질문은 표시 label과 전송 text 및 문서 origin을 구분한다', async ({ page }) => {
  await mount(page, true)
  await page.evaluate(() => Reflect.get(window, 'followupHostMode')('accept'))
  await list(page).locator('.g-nextq').click()
  await expect(list(page)).toHaveCount(0)
  expect((await audit(page)).calls).toEqual([{ selection: {
    binding: { scopeId: 'owner-a/conversation-a', messageId: 'followup-message', observationId: 'followup-observation' }, kind: 'question',
    item: { id: 'why', label: '근거를 더 알아보기', text: '공급된 조건의 근거를 설명해주세요' },
  }, thread: { scopeId: 'research-a', documentId: 'plan' } }])
  expect((await audit(page)).voidSends).toBe(0)
  await expect(page.locator('.g-composer textarea:visible')).toHaveValue('전송하지 않은 기존 초안')
})
