import { expect, test, type Page } from '@playwright/test'

// Supplied presentation and explicit acceptance only. This is not a producer,
// SDK TURN acceptance, persisted server context, or resumed model stream.
const draft = '전송하지 않은 기존 초안'
const partial = '이미 확인한 부분 답변입니다. 아직 결론은'
const prompt = '방금 끊긴 답변을 이어서 계속 작성해줘'
const binding = { scopeId: 'owner-a/conversation-a', messageId: 'partial-message', observationId: 'partial-observation' }
type Port = 'bound' | 'missing' | 'foreign'

async function mount(page: Page, research = false, port: Port = 'bound') {
  await page.route('**/native-continuation-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture" style="height:100dvh"></div></body></html>' }))
  await page.goto('/native-continuation-test.html')
  await page.evaluate(async ({ research, port, draft, partial, binding }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/internal-poc/ClientServiceExperience.tsx', dp = '/@id/react-dom/client', pp = '/src/client-preferences.ts'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, dom = await import(/* @vite-ignore */ dp)
    const { ClientServiceExperience } = await import(/* @vite-ignore */ cp), { setClientPreference } = await import(/* @vite-ignore */ pp)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    let input = draft, mode = 'reject', stateCase = 'interrupted', owner = 'owner-a', suppliedPort = port
    let currentBinding = { ...binding }, currentPartial = partial
    const pending: ((value: boolean) => void)[] = []
    const audit = { voidSends: 0, aborted: 0, calls: [] as { request: unknown; thread: unknown }[] }
    const thread = research ? { scopeId: 'research-a', documentId: 'plan' } : undefined
    const render = () => root.render(react.createElement(ClientServiceExperience, {
      nativeAccounts: true, accountScope: owner,
      continuationActions: suppliedPort === 'missing' ? undefined : { scope: suppliedPort === 'foreign' ? 'owner-foreign' : owner,
        resume: (request: unknown, signal: AbortSignal, origin: unknown) => {
          audit.calls.push({ request: structuredClone(request), thread: origin ?? null })
          signal.addEventListener('abort', () => { audit.aborted++ }, { once: true })
          if (mode === 'pending') return new Promise<boolean>(resolve => { pending.push(resolve) })
          if (mode === 'void') return undefined // Invalid ACK must never consume the action.
          if (mode === 'throw') throw new Error('TEST_ONLY_RESUME_REJECTED')
          return mode === 'accept'
        } },
      clarification: stateCase === 'clarification' ? { prompt: '먼저 확인할 단일 질문', identity: 'priority-question' } : null,
      ...(research ? { researchPresentation: { scope: owner, data: { scopeId: 'research-a', status: 'done' } } } : {}),
      state: { phase: 'ready', sessionState: 'AUTHENTICATED', input, busy: false, inputDisabled: false, source: 'service', recovery: null,
        quickReplies: stateCase === 'clarification' ? ['공급된 선택'] : [], workflow: null, outcome: null, issue: null,
        messages: [{ id: 'original-user', role: 'user', text: '원래 질문과 조건을 보존해주세요', ...(thread ? { researchThread: thread } : {}) },
          { id: currentBinding.messageId, role: 'assistant', text: currentPartial, ...(thread ? { researchThread: thread } : {}),
            continuationBinding: stateCase === 'unbound' ? undefined : stateCase === 'wrong-message' ? { ...currentBinding, messageId: 'another-message' } : currentBinding,
            ...(stateCase === 'observed' ? { observation: { id: 'verified-response', label: ['공급된 작업 기록'], status: 'done', steps: [], reply: ['SDK 관측 완료 응답'] } } : {}),
            responseBlocks: [{ id: 'partial-response', kind: 'text', text: stateCase === 'empty' ? '  ' : currentPartial,
              status: stateCase === 'done' ? 'done' : stateCase === 'streaming' ? 'streaming' : 'interrupted' }],
          }, ...(stateCase === 'past' ? [{ id: 'new-user', role: 'user', text: '새로운 명시 요청', ...(thread ? { researchThread: thread } : {}) }] : [])],
        onInput: (value: string) => { input = value; render() }, onSend: async () => { audit.voidSends++ }, onReset: () => false, onRecover: undefined, onLogout: undefined,
      },
      onQuickReply: async () => { audit.voidSends++ },
    }))
    Object.assign(window, { continuationAudit: audit,
      continuationMode: (value: string) => { mode = value },
      continuationCase: (value: string) => { stateCase = value; render() },
      continuationPort: (value: Port) => { suppliedPort = value; render() },
      continuationSettle: (index: number, accepted: boolean) => pending[index]?.(accepted),
      continuationReplace: (kind: string) => {
        if (kind === 'owner') { owner = 'owner-b'; currentBinding = { ...currentBinding, scopeId: 'owner-b/conversation-b' } }
        if (kind === 'message') currentBinding = { ...currentBinding, messageId: 'replacement-message' }
        if (kind === 'observation') currentBinding = { ...currentBinding, observationId: 'replacement-observation' }
        if (kind === 'partial') currentPartial = '새로 공급된 미완성 답변은'
        render()
      },
    })
    setClientPreference('language', 'ko'); render()
  }, { research, port, draft, partial, binding })
  if (research) await page.locator('[data-native-open-research]').click()
  await expect(list(page)).toBeVisible()
}

const list = (page: Page) => page.locator('.client-followups:visible')
const composer = (page: Page) => page.locator('.g-composer textarea:visible')
const audit = (page: Page) => page.evaluate(() => Reflect.get(window, 'continuationAudit'))

for (const research of [false, true]) test(`${research ? '연구' : '일반'} 이어쓰기는 부분 원문·초안·origin을 보존하고 명시 true만 수락한다`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page, research)
  await composer(page).evaluate(el => Reflect.set(window, 'originalContinuationComposer', el))
  await expect(page.getByText(partial, { exact: true })).toBeVisible()
  await expect(page.getByText('원래 질문과 조건을 보존해주세요', { exact: true })).toBeVisible()
  await expect(list(page).getByRole('button', { name: '이어서 계속', exact: true })).toBeVisible()
  for (const mode of ['reject', 'void', 'throw']) {
    await page.evaluate(mode => Reflect.get(window, 'continuationMode')(mode), mode)
    await list(page).locator('button').click()
    await expect(list(page).locator('.followup-notice')).toContainText('전달하지 못했습니다')
    await expect(composer(page)).toHaveValue(draft)
    await expect(page.getByText(partial, { exact: true })).toBeVisible()
  }
  await page.evaluate(() => Reflect.get(window, 'continuationMode')('pending'))
  await list(page).locator('button').evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
  await expect(list(page)).toHaveAttribute('aria-busy', 'true')
  await expect(list(page).locator('button')).toBeDisabled()
  expect((await audit(page)).calls).toHaveLength(4)
  await page.screenshot({ path: info.outputPath(`native-continuation-${research ? 'research' : 'conversation'}.png`), fullPage: true })
  await page.evaluate(() => Reflect.get(window, 'continuationSettle')(0, true))
  await expect(list(page)).toHaveCount(0)
  await expect(composer(page)).toHaveValue(draft)
  expect(await composer(page).evaluate(el => el === Reflect.get(window, 'originalContinuationComposer'))).toBe(true)
  await expect(page.getByText(partial, { exact: true })).toBeVisible()
  const result = await audit(page)
  expect(result.voidSends).toBe(0)
  for (const call of result.calls) expect(call).toEqual({ request: { binding, partialText: partial, prompt }, thread: research ? { scopeId: 'research-a', documentId: 'plan' } : null })
  expect(errors).toEqual([])
})

for (const research of [false, true]) for (const port of ['missing', 'foreign'] as const) test(`${research ? '연구' : '일반'} ${port} 포트는 void 전송으로 우회하지 않는다`, async ({ page }) => {
  await mount(page, research, port)
  await list(page).locator('button').click()
  await expect(list(page).locator('.followup-notice')).toContainText('현재 대화에서 이 작업을 진행할 수 없습니다')
  expect(await audit(page)).toEqual({ voidSends: 0, aborted: 0, calls: [] })
  await expect(composer(page)).toHaveValue(draft)
  await expect(page.getByText(partial, { exact: true })).toBeVisible()
})

for (const kind of ['owner', 'message', 'observation', 'partial']) test(`${kind} 교체는 이전 이어쓰기 ACK를 폐기한다`, async ({ page }) => {
  await mount(page)
  await page.evaluate(() => Reflect.get(window, 'continuationMode')('pending'))
  await list(page).locator('button').click()
  await expect(list(page)).toHaveAttribute('aria-busy', 'true')
  await page.evaluate(kind => Reflect.get(window, 'continuationReplace')(kind), kind)
  await expect.poll(async () => (await audit(page)).aborted).toBe(1)
  await expect(list(page).locator('button')).toBeEnabled()
  await page.evaluate(() => Reflect.get(window, 'continuationSettle')(0, true))
  await expect(list(page)).toBeVisible()
  await expect(composer(page)).toHaveValue(draft)
  await page.evaluate(() => Reflect.get(window, 'continuationMode')('accept'))
  await list(page).locator('button').click()
  await expect(list(page)).toHaveCount(0)
  const result = await audit(page)
  expect(result.calls).toHaveLength(2); expect(result.voidSends).toBe(0)
  expect(result.calls[1].request).toEqual({ binding: {
    ...binding,
    ...(kind === 'owner' ? { scopeId: 'owner-b/conversation-b' } : {}),
    ...(kind === 'message' ? { messageId: 'replacement-message' } : {}),
    ...(kind === 'observation' ? { observationId: 'replacement-observation' } : {}),
  }, partialText: kind === 'partial' ? '새로 공급된 미완성 답변은' : partial, prompt })
})

test('포트 제거·재연결에서 이전 ACK는 새 요청의 잠금과 결과에 영향을 주지 않는다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => Reflect.get(window, 'continuationMode')('pending'))
  await list(page).locator('button').click()
  await page.evaluate(() => Reflect.get(window, 'continuationPort')('missing'))
  await expect.poll(async () => (await audit(page)).aborted).toBe(1)
  await expect(list(page).locator('button')).toBeEnabled()
  await page.evaluate(() => Reflect.get(window, 'continuationPort')('bound'))
  await list(page).locator('button').click()
  await expect(list(page)).toHaveAttribute('aria-busy', 'true')
  await page.evaluate(() => Reflect.get(window, 'continuationSettle')(0, true))
  await expect(list(page)).toHaveAttribute('aria-busy', 'true')
  await expect(list(page).locator('button')).toBeDisabled()
  await page.evaluate(() => Reflect.get(window, 'continuationSettle')(1, true))
  await expect(list(page)).toHaveCount(0)
  expect((await audit(page)).calls).toHaveLength(2)
  expect((await audit(page)).voidSends).toBe(0)
  await expect(composer(page)).toHaveValue(draft)
})

for (const research of [false, true]) test(`${research ? '연구' : '일반'} 완료·과거·SDK 완료·명확화·무본문·미결속 응답에는 이어쓰기를 노출하지 않는다`, async ({ page }) => {
  await mount(page, research)
  for (const state of ['done', 'past', 'observed', 'clarification', 'empty', 'streaming', 'unbound', 'wrong-message']) {
    await page.evaluate(state => Reflect.get(window, 'continuationCase')(state), state)
    await expect(list(page)).toHaveCount(0)
    // Source ASK owns the composer while clarification is active; its draft remains intact.
    if (state === 'clarification') {
      await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
      await expect(composer(page)).toHaveCount(0)
      await expect(page.getByText('먼저 확인할 단일 질문', { exact: true })).toBeVisible()
    } else await expect(composer(page)).toHaveValue(draft)
    if (state === 'observed') {
      await expect(page.getByText('SDK 관측 완료 응답', { exact: true })).toBeVisible()
      await expect(page.getByText(partial, { exact: true })).toHaveCount(0)
    }
    await page.evaluate(() => Reflect.get(window, 'continuationCase')('interrupted'))
    await expect(list(page)).toBeVisible()
    await expect(composer(page)).toHaveValue(draft)
  }
  expect((await audit(page)).calls).toHaveLength(0)
  expect((await audit(page)).voidSends).toBe(0)
})

for (const research of [false, true]) test(`${research ? '연구' : '일반'} 새 tail은 대기 중 이어쓰기를 취소하고 늦은 수락을 무시한다`, async ({ page }) => {
  await mount(page, research)
  await page.evaluate(() => Reflect.get(window, 'continuationMode')('pending'))
  await list(page).locator('button').click()
  await page.evaluate(() => Reflect.get(window, 'continuationCase')('past'))
  await expect(list(page)).toHaveCount(0)
  await expect.poll(async () => (await audit(page)).aborted).toBe(1)
  await page.evaluate(() => Reflect.get(window, 'continuationSettle')(0, true))
  await expect(page.getByText('새로운 명시 요청', { exact: true })).toBeVisible()
  await expect(page.getByText(partial, { exact: true })).toBeVisible()
  await expect(composer(page)).toHaveValue(draft)
  await expect(list(page)).toHaveCount(0)
  expect((await audit(page)).calls).toHaveLength(1)
  expect((await audit(page)).voidSends).toBe(0)
})
