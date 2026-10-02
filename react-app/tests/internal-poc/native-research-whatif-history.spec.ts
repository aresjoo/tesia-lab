import { expect, test, type Page } from '@playwright/test'

test.use({ trace: 'off', video: 'off' })

/** Synthetic producer values test the real renderer; no backend or calculation is simulated as production. */
async function mount(page: Page) {
  await page.route('**/whatif-history-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012"><main id="fixture"></main></body></html>' }))
  await page.goto('/whatif-history-fixture.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/internal-poc/NativeResearchDocuments.tsx', source = await (await fetch(path)).text()
    const rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, h = react.createElement
    const dp = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ dp)
    const { NativeResearchDocuments } = await import(/* @vite-ignore */ path)
    const preferencePath = '/src/client-preferences.ts', { setClientPreference } = await import(/* @vite-ignore */ preferencePath)
    setClientPreference('language', 'ko')
    const calls: string[] = [], deferred = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
    const request = (owner: string, id: string, choice: string) => {
      calls.push(`${owner}:${id}:${choice}`)
      return new Promise((resolve, reject) => deferred.set(calls.length, { resolve, reject }))
    }
    function Host() {
      const [owner, setOwner] = react.useState('owner-a'), [revision, setRevision] = react.useState('one')
      const [active, setActive] = react.useState('a'), [id, setId] = react.useState('a'), [kind, setKind] = react.useState('report'), [state, setState] = react.useState('ready')
      Object.assign(window, { whatIfOwner: setOwner, whatIfRevision: setRevision, whatIfActive: setActive, whatIfId: setId, whatIfKind: setKind, whatIfState: setState,
        whatIfLanguage: (language: string) => setClientPreference('language', language), whatIfCalls: calls,
        whatIfResolve: (number: number, title: string) => deferred.get(number)?.resolve({ title, summary: '<script>공급된 설명</script>', metrics: { return: { text: '+1.000125%' }, drawdown: { text: '−0.000126%' } } }),
        whatIfReject: (number: number) => deferred.get(number)?.reject(new Error('PRIVATE_FAILURE_DETAILS')) })
      return h('section', { className: 'client-restored-research' }, ...['a', 'b'].map(slot => {
        const documentId = slot === 'a' ? id : 'b'
        const data = kind === 'report' || slot === 'b' ? {
          strategyName: `보고서 ${documentId}`, metrics: {}, evidence: [],
          whatIf: [{ id: 'fee', label: '수수료 2배', onRun: () => request(owner, documentId, 'fee') }, { id: 'delay', label: '진입 1캔들 지연', onRun: () => request(owner, documentId, 'delay') }, { id: 'missing', label: '미공급 조건' }],
        } : { professional: '공급 가설', plain: '공급 설명', criteria: '공급 기준' }
        return h('article', { key: slot, className: 'g-doc g-adoc', 'data-slot': slot, hidden: active !== slot },
          h(NativeResearchDocuments, { scopeId: owner, active: active === slot, document: { id: documentId, kind: slot === 'a' ? kind : 'report', revision, state, data } }),
          h('div', { 'data-general-thread': slot }, '기존 일반 대화 기록'))
      }))
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  })
  await expect(page.locator('[data-slot="a"]')).toBeVisible()
}
const report = (page: Page, slot = 'a') => page.locator(`[data-slot="${slot}"]`)
async function update(page: Page, field: string, value: string) { await page.evaluate(({ field, value }) => Reflect.get(window, `whatIf${field}`)(value), { field, value }) }
async function resolve(page: Page, number: number, title: string) { await page.evaluate(({ number, title }) => Reflect.get(window, 'whatIfResolve')(number, title), { number, title }) }
async function finish(page: Page, number: number, title: string, choice = '수수료 2배') {
  await report(page).getByRole('button', { name: choice, exact: true }).click()
  await resolve(page, number, title)
  await expect(report(page).getByRole('heading', { name: title, exact: true }).last()).toBeVisible()
}

test('두 성공 응답은 원본처럼 순서대로 누적되고 같은 조건 재실행도 기록을 보존한다', async ({ page }) => {
  await mount(page)
  await finish(page, 1, '첫 번째 결과')
  await finish(page, 2, '두 번째 결과', '진입 1캔들 지연')
  await expect(report(page).getByRole('heading', { name: '첫 번째 결과', exact: true })).toBeVisible()
  await finish(page, 3, '첫 번째 결과')
  await expect(report(page).locator('[data-research-whatif-history] h3')).toHaveText(['첫 번째 결과', '두 번째 결과', '첫 번째 결과'])
  await expect(report(page).locator('[data-research-whatif-history] .g-vstat')).toHaveCount(3)
  await expect(report(page).locator('[data-research-whatif-history]')).toContainText('+1.000125%')
  await expect(report(page).locator('[data-research-whatif-history] script')).toHaveCount(0)
  await expect(report(page).locator('[data-general-thread]')).toHaveText('기존 일반 대화 기록')
})

test('pending 이중 클릭과 다른 조건 요청을 잠그고 실패는 누적 기록을 지우거나 추가하지 않는다', async ({ page }) => {
  await mount(page); await finish(page, 1, '보존할 결과')
  await report(page).getByRole('button', { name: '수수료 2배', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(report(page).locator('.g-qchip:enabled')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'whatIfCalls'))).toEqual(['owner-a:a:fee', 'owner-a:a:fee'])
  await page.evaluate(() => Reflect.get(window, 'whatIfReject')(2))
  await expect(report(page).getByRole('alert')).toBeVisible()
  await expect(report(page).locator('[data-research-whatif-history] h3')).toHaveText(['보존할 결과'])
  await expect(page.locator('body')).not.toContainText('PRIVATE_FAILURE_DETAILS')
  await expect(report(page).getByRole('button', { name: '미공급 조건' })).toBeDisabled()
  await finish(page, 3, '재시도 결과')
  await expect(report(page).getByRole('alert')).toHaveCount(0)
  await expect(report(page).locator('[data-research-whatif-history] h3')).toHaveText(['보존할 결과', '재시도 결과'])
})

test('다른 문서가 열린 동안 도착한 응답은 요청한 숨김 문서에만 추가된다', async ({ page }) => {
  await mount(page); await finish(page, 1, 'A 첫 결과')
  await report(page).getByRole('button', { name: '수수료 2배', exact: true }).click()
  await update(page, 'Active', 'b'); await expect(report(page, 'b')).toBeVisible()
  await resolve(page, 2, 'A 늦은 결과')
  await expect(report(page, 'b')).not.toContainText('A 늦은 결과')
  await report(page, 'b').getByRole('button', { name: '수수료 2배', exact: true }).click(); await resolve(page, 3, 'B 결과')
  await update(page, 'Active', 'a')
  await expect(report(page).locator('[data-research-whatif-history] h3')).toHaveText(['A 첫 결과', 'A 늦은 결과'])
  await expect(report(page)).not.toContainText('B 결과')
})

for (const [field, value] of [['Owner', 'owner-b'], ['Id', 'replaced'], ['Revision', 'two'], ['Kind', 'hypothesis'], ['State', 'unavailable']]) {
  test(`${field} 경계 변경은 이전 기록과 늦은 성공을 새 문서에 노출하지 않는다`, async ({ page }) => {
    await mount(page); await finish(page, 1, '이전 기록')
    await report(page).getByRole('button', { name: '수수료 2배', exact: true }).click()
    await update(page, field, value); await resolve(page, 2, '폐기할 응답')
    await expect(report(page)).not.toContainText('이전 기록')
    await expect(report(page)).not.toContainText('폐기할 응답')
    await expect(report(page).locator('[data-research-whatif-history]')).toHaveCount(0)
  })
}

test('320px와 7언어 전환에서도 기록·대기 요청을 유지하고 새 HTTP 없이 응답 원문을 표시한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await mount(page)
  const requests: string[] = []; page.on('request', request => requests.push(request.url()))
  await finish(page, 1, '공급한 첫 결과')
  await report(page).getByRole('button', { name: '수수료 2배', exact: true }).click()
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await update(page, 'Language', language)
    await expect(report(page).getByRole('heading', { name: '공급한 첫 결과', exact: true })).toBeVisible()
    await expect(report(page).locator('.g-qchip:enabled')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await resolve(page, 2, '언어 전환 뒤 결과')
  await expect(report(page).locator('[data-research-whatif-history] h3')).toHaveText(['공급한 첫 결과', '언어 전환 뒤 결과'])
  await expect(report(page).locator('[data-research-whatif-history]')).toContainText('<script>공급된 설명</script>')
  expect(requests).toEqual([])
})
