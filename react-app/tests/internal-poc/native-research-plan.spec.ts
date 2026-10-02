import { expect, test, type Page } from '@playwright/test'
import { nativeResearchPlanCopy, nativeResearchPlanText } from '../../src/internal-poc/native-research-plan-copy'

const keys = ['target', 'entry', 'stopLoss', 'takeProfit', 'researchRange', 'holdoutRange', 'costs', 'validation'] as const
const values = ['BTC/USDT, 15m', 'RSI < 29.999999999999999 / 30.000000000000001', '-2.000000000000001%', '+3.000000000000001%', '공급 연구구간 A', '공급 봉인구간 B', '0.00030001% + 0.00030002%', '확정된 검증 범위만']

async function mount(page: Page, options: { supplied?: boolean; start?: boolean; actions?: boolean; editor?: boolean } = {}) {
  await page.route('**/native-plan-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0f1012"><div id="fixture"></div></body></html>' }))
  await page.goto('/native-plan-fixture.html')
  await page.evaluate(async ({ options, keys, values }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/internal-poc/NativeResearchPlan.tsx', rowPath = '/src/internal-poc/NativeRowComment.tsx', domPath = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text(), reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React')
    const rm = await import(/* @vite-ignore */ reactPath), react = rm.default ?? rm, h = react.createElement
    const dom = await import(/* @vite-ignore */ domPath), { NativeResearchPlan } = await import(/* @vite-ignore */ cp), { NativeRowComment } = await import(/* @vite-ignore */ rowPath)
    for (const path of ['/node_modules/@fontsource-variable/noto-sans-kr/wght.css', '/src/internal-poc/client-service.css']) await import(/* @vite-ignore */ path)
    document.body.style.fontFamily = '"Noto Sans KR Variable",sans-serif'
    const audit = { calls: [] as unknown[][], mode: 'resolve', resolve: () => {}, reject: () => {} }
    const start = async () => { audit.calls.push(['start']); if (audit.mode === 'reject') throw new Error('PRIVATE_TEST_FAILURE'); if (audit.mode === 'hold') await new Promise<void>((resolve, reject) => { audit.resolve = resolve; audit.reject = () => reject(new Error('PRIVATE_TEST_FAILURE')) }) }
    function Host() {
      const [scope, setScope] = react.useState('scope-a'), [revision, setRevision] = react.useState(1), [disabled, setDisabled] = react.useState(false)
      const [rows, setRows] = react.useState({})
      Object.assign(window, { planAudit: audit, setPlanScope: setScope, rerenderPlan: () => setRevision((value: number) => value + 1), setPlanDisabled: setDisabled })
      const editor = { rows, disabled: false, onOpen: (key: string, open: boolean) => setRows((previous: Record<string, object>) => ({ ...previous, [key]: { text: '', ...previous[key], open } })), onChange: (key: string, text: string) => setRows((previous: Record<string, object>) => ({ ...previous, [key]: { ...previous[key], text } })), onSubmit: (key: string, label: string) => audit.calls.push(['edit', key, label]) }
      const fields = options.supplied === false ? {} : Object.fromEntries(keys.map((key, index) => [key, { value: values[index], editor: options.editor && key === 'entry' ? h(NativeRowComment, { rowKey: key, label: '진입', editor }) : undefined }]))
      return h('div', { className: 'client-service-app client-restored-research', style: { height: 'auto', minHeight: '100dvh' }, 'data-render': revision }, h('div', { className: 'g-doc g-adoc' }, h(NativeResearchPlan, {
        scopeId: scope, summary: options.supplied === false ? undefined : '제공된 공개 가설만 표시', ...fields,
        onResearchStart: options.start ? start : undefined, researchStartDisabled: disabled,
        onEditConditions: () => audit.calls.push(['conditions']),
        actions: options.actions ? h('div', { 'data-controller': 'workflow', style: { width: '100%', minWidth: 0 } }, h('input', { style: { width: '100%', minWidth: 0, boxSizing: 'border-box' }, 'aria-label': '기존 controller 입력', defaultValue: '기존 초안' }), h('button', { type: 'button', onClick: () => audit.calls.push(['controller']) }, '기존 승인 controller')) : undefined,
        rawDetails: h('details', {}, h('summary', {}, '원본 SDK 조건'), h('pre', {}, '공급한 전체 조건')), })))
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  }, { options, keys, values })
  await expect(page.locator('.native-research-plan h3')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}
async function language(page: Page, code: string) { await page.evaluate(async code => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', code) }, code) }

test('원본 계획8행·문구·정밀숫자·미제공 경계를 유지한다', async ({ page }) => {
  await mount(page)
  await expect(page.locator('.native-research-plan h3')).toHaveText('연구 계획')
  await expect(page.locator('.native-research-plan .meta')).toHaveText('BTC/USDT, 15m, 행 위에서 💬로 수정 요청')
  await expect(page.locator('.native-research-plan .g-row > .k')).toHaveText(['대상', '진입', '손절', '익절', '연구 데이터', '봉인 구간', '거래 비용', '검증'])
  await expect(page.locator('.native-research-plan .g-row > .v')).toHaveText(values)
  await expect(page.getByRole('button', { name: '연구 시작', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '조건 수정', exact: true }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'planAudit').calls)).toEqual([['conditions']])
  await mount(page, { supplied: false })
  await expect(page.locator('.g-row > .v')).toHaveText(Array(8).fill('미제공'))
  await expect(page.locator('.native-research-plan')).not.toContainText('7단계')
  await expect(page.locator('.native-research-plan')).not.toContainText('2025.07')
})

test('320px·7언어 변경은 행 순서·동일값·단일 controller DOM을 유지한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await mount(page, { actions: true })
  await page.evaluate(() => Reflect.set(window, 'planControllerNode', document.querySelector('[data-controller] input')))
  await page.getByRole('textbox', { name: '기존 controller 입력' }).fill('수정되지 않은 초안 0.000000000001')
  for (const code of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await language(page, code)
    await expect(page.locator('.g-row > .k')).toHaveText(keys.map(key => nativeResearchPlanText(code, key)))
    await expect(page.locator('.g-row > .v')).toHaveText(values)
    await expect(page.locator('[data-controller]')).toHaveCount(1)
    expect(await page.evaluate(() => Reflect.get(window, 'planControllerNode') === document.querySelector('[data-controller] input'))).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
  }
  await expect(page.locator('[data-controller] input')).toHaveValue('수정되지 않은 초안 0.000000000001')
  await expect(page.getByRole('button', { name: 'Lancer la recherche', exact: true })).toHaveCount(0)
  await expect(page.locator('.native-research-plan details')).toHaveCount(1)
  await page.screenshot({ path: info.outputPath('plan-320-fr.png'), fullPage: true })
})

test('공급 NativeRowComment는 trigger·form·입력 한개이며 부모 및 언어 변경에도 DOM을 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await mount(page, { editor: true })
  await expect(page.locator('[data-k="entry"] .cbtn')).toHaveCount(0)
  await expect(page.locator('[data-k="entry"] .native-row-trigger')).toHaveCount(1)
  await page.locator('[data-k="entry"] .native-row-trigger').click()
  await expect(page.locator('.native-row-form')).toHaveCount(1)
  await page.locator('.native-row-form input').fill('-2.000000000000001% 요청')
  await page.evaluate(() => Reflect.set(window, 'planEditorNode', document.querySelector('.native-row-form input')))
  await page.evaluate(() => Reflect.get(window, 'rerenderPlan')())
  await language(page, 'en')
  expect(await page.evaluate(() => Reflect.get(window, 'planEditorNode') === document.querySelector('.native-row-form input'))).toBe(true)
  await expect(page.locator('.native-row-form input')).toHaveValue('-2.000000000000001% 요청')
  const form = await page.locator('.native-row-form').boundingBox(), value = await page.locator('[data-k="entry"] > .v').boundingBox()
  expect(form!.y).toBeGreaterThanOrEqual(value!.y + value!.height)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
  await page.locator('.native-row-form input').press('Escape')
  await expect(page.locator('.native-row-form')).toHaveCount(0)
  await expect(page.locator('.native-row-trigger')).toBeFocused()
})

test('명시 연구 시작만 실행하고 중복·실패·scope 교체에서 완료를 합성하지 않는다', async ({ page }) => {
  await mount(page, { start: true })
  await page.evaluate(() => { Reflect.get(window, 'planAudit').mode = 'reject' })
  await page.getByRole('button', { name: '연구 시작', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('PRIVATE_TEST_FAILURE')
  await page.evaluate(() => { Reflect.get(window, 'planAudit').mode = 'hold'; const b = document.querySelector<HTMLButtonElement>('.native-research-plan-actions .g-btn-p')!; b.click(); b.click() })
  expect(await page.evaluate(() => Reflect.get(window, 'planAudit').calls)).toEqual([['start'], ['start']])
  await expect(page.getByRole('button', { name: '연구 시작', exact: true })).toBeDisabled()
  await page.evaluate(() => Reflect.get(window, 'setPlanScope')('scope-b'))
  await expect(page.locator('.native-research-plan')).toHaveAttribute('data-plan-scope', 'scope-b')
  await page.evaluate(() => Reflect.get(window, 'planAudit').reject())
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.native-research-plan [role="status"]')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'setPlanDisabled')(true))
  await expect(page.getByRole('button', { name: '연구 시작', exact: true })).toBeDisabled()
  await expect(page.locator('.g-row > .v')).toHaveText(values)
})

test('계획 static copy는 한국어원문과7언어를완전히갖고있다', () => {
  for (const [key, translations] of Object.entries(nativeResearchPlanCopy)) {
    expect(translations, key).toHaveLength(7)
    translations.forEach(value => expect(value.trim(), key).not.toBe(''))
    translations.slice(1).forEach(value => expect(value, key).not.toMatch(/[가-힣]/))
  }
})
