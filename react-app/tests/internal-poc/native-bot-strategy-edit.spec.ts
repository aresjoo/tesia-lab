import { expect, test, type Page } from '@playwright/test'
import type { BotStrategyEditInput, BotStrategyEditParameters } from '../../src/client-bot-strategy-edit-presentation'

type Options = { owner?: string; revision?: string; strategyId?: string; connected?: boolean; custom?: boolean; otherAction?: boolean }
type Controls = {
  editRender: (options: Options) => void
  editCalls: { kind: string; input: BotStrategyEditInput }[]
  editSettle: (index: number, failure?: boolean) => void
  editObservation: (kind: 'validation' | 'application', index: number, patch?: Record<string, unknown>) => void
  editClose: () => void
}
async function mount(page: Page, initial: Options = {}) {
  await page.route('**/native-bot-edit-audit.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0f1012"><div id="fixture"></div></body></html>' }))
  await page.goto('/native-bot-edit-audit.html')
  await page.evaluate(async initial => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const font = '/node_modules/@fontsource-variable/noto-sans-kr/wght.css'; await import(/* @vite-ignore */font)
    document.body.style.fontFamily = '"Noto Sans KR Variable", sans-serif'
    const path = '/src/internal-poc/NativeAccountPlan.tsx', dp = '/@id/react-dom/client', pp = '/src/client-preferences.ts'
    const source = await (await fetch(path)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React')
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, DOM = await import(/* @vite-ignore */dp), { NativeAccountPlan } = await import(/* @vite-ignore */path)
    ;(await import(/* @vite-ignore */pp)).setClientPreference('language', 'ko')
    const h = React.createElement, root = (DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('fixture'))
    const calls: Controls['editCalls'] = [], pending: { resolve: () => void; reject: () => void }[] = []
    let options = initial, validation: unknown, application: unknown
    const action = (kind: string, input: BotStrategyEditInput) => { calls.push({ kind, input }); return new Promise<void>((resolve, reject) => pending.push({ resolve, reject: () => reject(new Error('PRIVATE_EDIT_EXCEPTION')) })) }
    const onValidate = (input: BotStrategyEditInput) => action('validate', input), onApply = (input: BotStrategyEditInput) => action('apply', input)
    const render = (next: Options) => {
      options = next
      const { owner = 'owner-a', revision = 'revision-a', strategyId = 'bot-a', connected = true, custom = false, otherAction = false } = options
      const initial: BotStrategyEditParameters = custom ? { stopLossPercent: -6.25, takeProfitPercent: 11.5, rsiThreshold: 43.5, trendFilter: false } : { stopLossPercent: -5, takeProfitPercent: 10, rsiThreshold: 42, trendFilter: true }
      const view = { id: 'bot-a', title: '공급된 봇 전략', sourceLabel: 'SUPPLIED TEST DATA', environment: { label: '관측된 환경', key: 'off' }, actions: [{ id: 'edit', label: '전략 수정' }, { id: 'pause', label: '실행 일시정지' }], score: null, returnMetric: null, drawdownMetric: null, equity: null, orders: null, position: null, execution: null, log: null,
        edit: { actionId: 'edit', strategyId, revision, initial, validation, application, onValidate: connected ? onValidate : undefined, onApply: connected ? onApply : undefined } }
      const data = { scope: owner, identity: 'account-a', sourceLabel: 'SUPPLIED TEST DATA', strategies: null, accounts: null, ledger: { pos: null, open: null, orders: null, fills: null, closed: null, assets: null }, documents: [{ id: 'bot-a', kind: 'bot', title: view.title, sourceLabel: view.sourceLabel, fields: [], sections: [], presentation: { kind: 'bot', view } }], actions: otherAction ? { onDocumentAction: (id: string, name: string) => { calls.push({ kind: `${id}:${name}`, input: null as unknown as BotStrategyEditInput }); return Promise.resolve() } } : undefined }
      root.render(h(NativeAccountPlan, { accountScope: owner, presentation: data, location: { kind: 'bot', id: 'bot-a' }, onReturn: () => {}, onTrading: () => {} }))
    }
    Object.assign(window, { editRender: render, editCalls: calls, editSettle: (index: number, failure = false) => failure ? pending[index].reject() : pending[index].resolve(), editClose: () => root.render(null),
      editObservation: (kind: 'validation' | 'application', index: number, patch: Record<string, unknown> = {}) => {
        const base = structuredClone(calls[index].input)
        if (kind === 'validation') validation = { ...base, confirmed: true, verdict: 'passed', scoreLabel: '91.25점', returnLabel: '+7.125%', drawdownLabel: '-3.25%', tradesLabel: '137회', sourceLabel: '공급된 검증 결과', ...patch }
        else application = { ...base, status: 'applied', ...patch }
        render(options)
      },
    })
    render(initial)
  }, initial)
  await expect(page.locator('.native-service-plan')).toBeVisible()
  await page.evaluate(async () => { await document.fonts.load('14px "Noto Sans KR Variable"', '전략 수정 손절선'); await document.fonts.ready })
}
const dialog = (page: Page) => page.getByRole('dialog')
async function open(page: Page) { await page.getByRole('button', { name: '전략 수정', exact: true }).click(); await expect(dialog(page)).toBeVisible() }
async function settle(page: Page, index: number, failure = false) { await page.evaluate(({ index, failure }) => (window as unknown as Controls).editSettle(index, failure), { index, failure }) }
async function observation(page: Page, kind: 'validation' | 'application', index: number, patch: Record<string, unknown> = {}) { await page.evaluate(({ kind, index, patch }) => (window as unknown as Controls).editObservation(kind, index, patch), { kind, index, patch }) }
async function rerender(page: Page, options: Options) { await page.evaluate(options => (window as unknown as Controls).editRender(options), options) }
async function validate(page: Page) { await dialog(page).getByRole('button', { name: '재검증', exact: true }).click() }

test('실제 native 봇 상세에서 원본 폼과 정확한 percent 입력을 검증·별도 적용한다', async ({ page }) => {
  await mount(page); await open(page)
  await expect(dialog(page).getByRole('heading')).toBeFocused()
  await expect(dialog(page).getByRole('combobox')).toHaveCount(4)
  await dialog(page).getByLabel('손절선', { exact: true }).selectOption('-8')
  await dialog(page).getByLabel('익절 목표', { exact: true }).selectOption('15')
  await dialog(page).getByLabel('진입 RSI 임계', { exact: true }).selectOption('46')
  await dialog(page).getByLabel('추세 필터', { exact: true }).selectOption('0')
  await validate(page)
  const input = await page.evaluate(() => (window as unknown as Controls).editCalls[0].input)
  expect(input).toMatchObject({ strategyId: 'bot-a', revision: 'revision-a', parameters: { stopLossPercent: -8, takeProfitPercent: 15, rsiThreshold: 46, trendFilter: false } })
  await settle(page, 0)
  await expect(dialog(page)).toContainText('확인된 결과를 기다리고 있습니다.')
  await expect(dialog(page).getByRole('button', { name: '이 전략에 적용', exact: true })).toHaveCount(0)
  await observation(page, 'validation', 0)
  await expect(dialog(page)).toContainText('91.25점')
  await dialog(page).getByRole('button', { name: '이 전략에 적용', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as Controls).editCalls[1].input)).toEqual(input)
  await settle(page, 1)
  await expect(dialog(page)).toContainText('확인된 적용 결과를 기다리고 있습니다.')
  await expect(dialog(page)).not.toContainText('전략 설정이 적용됐어요')
  await observation(page, 'application', 1)
  await expect(dialog(page)).toContainText('전략 설정이 적용됐어요')
  await dialog(page).getByRole('button', { name: '닫기', exact: true }).last().click()
  await expect(page.getByRole('button', { name: '전략 수정', exact: true })).toBeFocused()
})

test('미연결 타 CTA는 유지하되 비활성이고 실제 action callback은 기존대로 전달한다', async ({ page }) => {
  await mount(page)
  await expect(page.getByRole('button', { name: '실행 일시정지' })).toBeDisabled()
  await rerender(page, { otherAction: true })
  await page.getByRole('button', { name: '실행 일시정지' }).click()
  expect(await page.evaluate(() => (window as unknown as Controls).editCalls.map(call => call.kind))).toEqual(['bot-a:pause'])
  await rerender(page, { connected: false }); await open(page)
  await expect(dialog(page).getByRole('button', { name: '재검증', exact: true })).toBeDisabled()
  await expect(dialog(page)).toContainText('재검증 기능이 아직 연결되지 않았습니다.')
})

test('공급 결과는 전략·revision·inputIdentity·파라미터와 confirmed 모두 일치해야 한다', async ({ page }) => {
  await mount(page); await open(page); await validate(page); await settle(page, 0)
  for (const patch of [{ strategyId: 'other-bot' }, { revision: 'old' }, { inputIdentity: 'other-request' }, { parameters: { stopLossPercent: -12, takeProfitPercent: 10, rsiThreshold: 42, trendFilter: true } }, { confirmed: false }, { verdict: 'pending' }]) {
    await observation(page, 'validation', 0, patch)
    await expect(dialog(page).getByRole('button', { name: '이 전략에 적용', exact: true })).toHaveCount(0)
  }
  await observation(page, 'validation', 0, { verdict: 'failed' })
  await expect(dialog(page)).toContainText('설정을 조정해 다시 검증해보세요.')
  await observation(page, 'validation', 0)
  await expect(dialog(page).getByRole('button', { name: '이 전략에 적용', exact: true })).toBeEnabled()
  await dialog(page).getByLabel('손절선', { exact: true }).selectOption('-3')
  await dialog(page).getByLabel('손절선', { exact: true }).selectOption('-5')
  await expect(dialog(page).getByRole('button', { name: '이 전략에 적용', exact: true })).toHaveCount(0)
  await expect(dialog(page)).toContainText('재검증을 다시 통과해야')
})

test('중복·검증실패·적용실패는 안전하게 처리하고 입력·확인 결과를 보존한다', async ({ page }) => {
  await mount(page); await open(page)
  await dialog(page).getByRole('button', { name: '재검증', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  expect(await page.evaluate(() => (window as unknown as Controls).editCalls.length)).toBe(1)
  await settle(page, 0, true); await expect(dialog(page).getByRole('alert')).not.toContainText('PRIVATE_EDIT_EXCEPTION')
  await expect(dialog(page).getByLabel('손절선', { exact: true })).toHaveValue('-5')
  await validate(page); await settle(page, 1); await observation(page, 'validation', 1)
  await dialog(page).getByRole('button', { name: '이 전략에 적용', exact: true }).click(); await settle(page, 2, true)
  await expect(dialog(page)).toContainText('91.25점')
  await dialog(page).getByRole('button', { name: '이 전략에 적용', exact: true }).click(); await settle(page, 3)
  for (const patch of [{ strategyId: 'wrong' }, { revision: 'wrong' }, { inputIdentity: 'wrong' }, { parameters: { stopLossPercent: -12, takeProfitPercent: 10, rsiThreshold: 42, trendFilter: true } }]) {
    await observation(page, 'application', 3, patch)
    await expect(dialog(page)).not.toContainText('전략 설정이 적용됐어요')
  }
  await observation(page, 'application', 3, { status: 'failed' })
  await expect(dialog(page).getByRole('alert')).toBeVisible()
  await expect(dialog(page).getByRole('button', { name: '이 전략에 적용', exact: true })).toBeEnabled()
})

test('owner·revision·초기 설정·권한 교체는 초안과 늦은 실패를 격리한다', async ({ page }) => {
  await mount(page); await open(page); await validate(page)
  await rerender(page, { owner: 'owner-b' }); await settle(page, 0, true)
  await expect(dialog(page)).toHaveCount(0)
  await open(page); await validate(page)
  await rerender(page, { owner: 'owner-b', revision: 'revision-b' }); await settle(page, 1, true)
  await expect(dialog(page)).toHaveCount(0)
  await open(page); await validate(page)
  await rerender(page, { owner: 'owner-b', revision: 'revision-b', connected: false }); await settle(page, 2, true)
  await expect(dialog(page)).toHaveCount(0)
  await open(page); await expect(dialog(page).getByRole('alert')).toHaveCount(0)
  await rerender(page, { owner: 'owner-b', revision: 'revision-b', connected: false, custom: true })
  await expect(dialog(page)).toHaveCount(0)
  await open(page); await expect(dialog(page).getByLabel('손절선', { exact: true })).toHaveValue('-6.25')
  await page.keyboard.press('Escape'); await rerender(page, { strategyId: 'other-bot' })
  await expect(page.getByRole('button', { name: '전략 수정', exact: true })).toBeDisabled()
})

test('관측 결과가 먼저 도착한 뒤 요청 응답이 실패해도 확정 결과를 지우지 않는다', async ({ page }) => {
  await mount(page); await open(page); await validate(page)
  await observation(page, 'validation', 0); await settle(page, 0, true)
  await expect(dialog(page)).toContainText('91.25점')
  await expect(dialog(page).getByRole('alert')).toHaveCount(0)
  await dialog(page).getByRole('button', { name: '이 전략에 적용', exact: true }).click()
  await observation(page, 'application', 1); await settle(page, 1, true)
  await expect(dialog(page)).toContainText('전략 설정이 적용됐어요')
  await expect(dialog(page).getByRole('alert')).toHaveCount(0)
})

test('기본 선택 범위 밖 공급값을 그대로 보존하고 언어 변경은 초안을 지우지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 }); await mount(page, { custom: true }); await open(page)
  await expect(dialog(page).getByLabel('손절선', { exact: true })).toHaveValue('-6.25')
  await expect(dialog(page).getByLabel('익절 목표', { exact: true })).toHaveValue('11.5')
  await expect(dialog(page).getByLabel('진입 RSI 임계', { exact: true })).toHaveValue('43.5')
  await expect(dialog(page)).toContainText('공급된 값을 유지했으니')
  await dialog(page).getByLabel('추세 필터', { exact: true }).selectOption('1')
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */path)).setClientPreference('language', language) }, language)
    await expect(dialog(page).getByRole('combobox').first()).toHaveValue('-6.25')
    await expect(dialog(page).getByRole('combobox').last()).toHaveValue('1')
    expect(await dialog(page).evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    expect(await dialog(page).getByRole('button').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().right <= innerWidth + 1))).toBe(true)
  }
  expect(await page.evaluate(async () => {
    const path = '/src/client-bot-strategy-edit-copy.ts', { botStrategyEditCopy, botStrategyEditText } = await import(/* @vite-ignore */path)
    return Object.entries(botStrategyEditCopy).every(([key, values]) => (values as string[]).length === 7 && ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'].every(language => {
      const text = botStrategyEditText(language, key, { name: 'BOT', value: 42, label: 'SUPPLIED' })
      return text.length && !/\{\w+\}/.test(text) && (language === 'ko' || !/[가-힣]/.test(text))
    }))
  })).toBe(true)
  await dialog(page).getByRole('combobox').last().scrollIntoViewIfNeeded()
  const filter = await dialog(page).getByRole('combobox').last().boundingBox(), actions = await dialog(page).locator('.ss3-dacts').boundingBox()
  expect(filter!.y + filter!.height).toBeLessThanOrEqual(actions!.y + 1)
  await page.screenshot({ path: info.outputPath('bot-edit-320-fr.png'), fullPage: true })
})
