import { expect, test, type Page } from '@playwright/test'

test.use({ trace: 'off', video: 'off' })
const kinds = ['hypothesis', 'strategy', 'backtest', 'critic', 'stress', 'holdout', 'report', 'connect', 'run', 'live'] as const

async function mount(page: Page, supplied = true) {
  await page.route('**/research-document-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012"><main id="fixture"></main></body></html>' }))
  await page.goto('/research-document-fixture.html')
  await page.evaluate(async supplied => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const font = '/node_modules/@fontsource-variable/noto-sans-kr/wght.css'
    await import(/* @vite-ignore */ font)
    document.body.style.fontFamily = '"Noto Sans KR Variable", sans-serif'
    const path = '/src/internal-poc/NativeResearchDocuments.tsx', source = await (await fetch(path)).text()
    const rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, h = react.createElement
    const dp = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ dp)
    const { NativeResearchDocuments } = await import(/* @vite-ignore */ path)
    const preferences = '/src/client-preferences.ts', { setClientPreference } = await import(/* @vite-ignore */ preferences)
    const calls: string[] = [], deferred = new Map<string, { resolve: (value?: unknown) => void; reject: (error: Error) => void }>()
    const request = (id: string) => { calls.push(id); return new Promise((resolve, reject) => deferred.set(id, { resolve, reject })) }
    const row = (id: string, label: string, value: string) => ({ id, label, value, onComment: (text: string) => request(`comment:${text}`) })
    const metrics = { return: { text: '+7.123%', tone: 'positive' }, drawdown: { text: '−4.678%', tone: 'negative' }, winRate: { text: '52.246%' }, trades: { text: '913' }, profitFactor: { text: '1.372' } }
    const documents = [
      { id: 'hypo', kind: 'hypothesis', data: { professional: '<script>공급한 가설 원문</script>', plain: '공급한 쉬운 설명', criteria: '공급한 검증 기준' } },
      { id: 'strat2', kind: 'strategy', data: { versionLabel: 'v17', description: '공급한 전략 조건', entry: row('entry', '진입', '가격 ≥ 101.005'), stopLoss: row('sl', '손절', '−1.125%'), takeProfit: row('tp', '익절', '+2.75%'), maxHolding: row('holding', '최대 보유', '17시간'), costs: row('costs', '비용', '공급 비용 원문') } },
      { id: 'bt2', kind: 'backtest', data: { versionLabel: 'v17', description: '2024-09-18 → 2026-09-17 · 공급 기간', metrics, years: [{ id: 'y24', year: '2024', pnl: { text: '−1.123%', tone: 'negative' }, trades: '321', winRate: '49.375%' }, { id: 'y25', year: '2025', pnl: { text: '+8.246%', tone: 'positive' }, trades: '592', winRate: '53.250%' }], drawdownExplanation: '공급된 낙폭 설명', equityDescription: '기존 보고서에서 제공하는 자산 곡선' } },
      { id: 'critic', kind: 'critic', data: { builder: '공급된 Builder 주장', critic: '공급된 Critic 반박', verdict: '판정 보류', verdictTone: 'warning' } },
      { id: 'stress', kind: 'stress', data: { scenarios: [{ id: 'fees', name: '수수료 2배', result: '수익 +3.123%, 낙폭 −5.246%', verdict: { text: 'Warning', tone: 'warning' } }] } },
      { id: 'holdout', kind: 'holdout', data: { description: '공급된 봉인 구간', annualizedReturn: { research: '+7.123%', holdout: '+2.375%' }, drawdown: { research: '−4.678%', holdout: '−6.125%' }, trades: { research: '913', holdout: '217' }, assessment: { kind: 'finding', finding: { title: 'Out-of-sample degradation', plain: '공급한 구간 밖 설명', meaning: '공급한 의미', nextAction: '공급한 다음 행동', tone: 'negative' } } } },
      { id: 'report', kind: 'report', data: { strategyName: '공급된 전략명', description: '공급된 출처', verdict: { summary: '추가 확인 필요', grade: { text: '보류', tone: 'warning' } }, metrics: { researchReturn: metrics.return, holdoutReturn: { text: '+2.375%' }, drawdown: metrics.drawdown, profitFactor: metrics.profitFactor }, evidence: [{ id: 'e1', text: '실제 확인한 근거', status: 'confirmed', documentId: 'bt2' }, { id: 'e2', text: '미확인 공급 근거', status: 'unknown' }], disagreement: { opinions: [{ id: 'critic', author: 'Strategy Critic', verdict: '보류' }], explanation: '공급한 불일치 설명' }, integrity: { summary: '공급한 무결성 검사 기록', conclusion: '공급한 무결성 결론' }, unknowns: '공급한 미확인 범위', whatIf: [{ id: 'fee2', label: '수수료 2배', onRun: () => request('whatif') }, { id: 'delay', label: '진입 1캔들 지연' }, { id: 'sl2', label: '손절 -2%' }], connectDocumentId: 'connect', activityDocumentId: 'activity' } },
      { id: 'connect', kind: 'connect', data: { primaryLabel: 'Binance로 간편 연결', onConnect: () => request('connect'), onPartner: () => request('partner'), permissions: { balancesAndQuotes: true, orders: true, withdrawals: false }, disclosure: '공급한 권한 설명' } },
      { id: 'run', kind: 'run', data: { description: '공급한 실행 모드', strategy: row('strategy', '전략', '공급된 전략명'), conditions: row('conditions', '조건', '승인한 조건 원문'), stopAndTarget: row('stopAndTarget', '손절·익절', '−1.125% / +2.75%'), capital: row('capital', '투자금', '150.50 USDC'), verification: row('verification', '검증', '공급한 검증 상태'), disclosure: '공급한 주문 경계 설명', onPaper: () => request('paper') } },
      { id: 'live', kind: 'live', data: { strategyName: '공급된 전략명', modeLabel: 'Paper', status: 'active', statusLabel: '공급한 실행 상태', broker: '공급 거래소', summary: '공급된 현재 상태 원문', activity: [{ id: 'a1', time: '2026-09-17 14:33:02 UTC', type: 'BUY', quantity: '0.003125 BTC', pnl: { text: '−0.125 USDC', tone: 'negative' } }], realityCheck: [{ id: 'r1', label: '체결 지연', assumed: '100ms', observed: '123ms', verdict: { text: '확인 필요', tone: 'warning' } }], onOpenTrading: () => calls.push('trading'), onPause: () => request('pause'), onResume: () => request('resume'), onStop: () => request('stop') } },
    ]
    function Host() {
      const [index, setIndex] = react.useState(0), [owner, setOwner] = react.useState('owner-a'), [state, setState] = react.useState(supplied ? 'ready' : 'unavailable'), [revision, setRevision] = react.useState('one')
      Object.assign(window, { researchRevision: setRevision, researchSet: setIndex, researchOwner: setOwner, researchState: setState, researchLanguage: (lang: string) => setClientPreference('language', lang), researchCalls: calls,
        researchResolve: (id: string, value?: unknown) => deferred.get(id)?.resolve(value), researchReject: (id: string) => deferred.get(id)?.reject(new Error('SECRET_INTERNAL_TOKEN_DO_NOT_SHOW')) })
      return h('section', { className: 'client-restored-research' }, h('article', { className: 'g-doc g-adoc' }, h(NativeResearchDocuments, { scopeId: owner, document: { ...documents[index], revision, state, data: supplied ? documents[index].data : undefined }, onOpenDocument: (id: string) => { calls.push(`open:${id}`); const next = documents.findIndex(doc => doc.id === id); if (next >= 0) setIndex(next) }, onOpenAnalysis: () => calls.push('analysis') })))
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  }, supplied)
  await expect(page.locator('[data-research-document-kind]')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}
async function select(page: Page, kind: typeof kinds[number]) { await page.evaluate(index => Reflect.get(window, 'researchSet')(index), kinds.indexOf(kind)); await expect(page.locator('[data-research-document-kind]')).toHaveAttribute('data-research-document-kind', kind) }
async function resolve(page: Page, id: string, value?: unknown) { await page.evaluate(({ id, value }) => Reflect.get(window, 'researchResolve')(id, value), { id, value }) }
async function reject(page: Page, id: string) { await page.evaluate(id => Reflect.get(window, 'researchReject')(id), id) }

test('같은 문서의 새 revision과 철회된 상태에는 이전 what-if 응답을 붙이지 않는다', async ({ page }) => {
  await mount(page); await select(page, 'report')
  await page.getByRole('button', { name: '수수료 2배', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'researchRevision')('two'))
  await resolve(page, 'whatif', { title: '이전 버전 결과', summary: '붙으면 안 되는 분석' })
  await expect(page.getByText('이전 버전 결과')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '수수료 2배', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '수수료 2배', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'researchState')('unavailable'))
  await resolve(page, 'whatif', { title: '철회된 결과', summary: '표시 금지' })
  await expect(page.getByText('철회된 결과')).toHaveCount(0)
})

test('10개 원본 전용 본문이 공급값·근거·실차트 동선을 그대로 표시한다', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await expect(page.locator('.rw-hypothesis')).toHaveText('<script>공급한 가설 원문</script>')
  await expect(page.locator('[data-research-document-kind] script')).toHaveCount(0)
  await select(page, 'strategy'); await expect(page.locator('.g-row')).toHaveCount(5); await expect(page.locator('.cbtn svg')).toHaveCount(5); await expect(page.getByRole('heading')).toHaveText('Strategy v17')
  await select(page, 'backtest'); await expect(page.locator('.g-vstat > div')).toHaveCount(5); await expect(page.locator('tbody tr')).toHaveCount(2); await expect(page.locator('.g-vstat')).toContainText('+7.123%'); await expect(page.locator('tbody')).toContainText('49.375%'); await expect(page.locator('.g-chartbox')).toHaveCount(2)
  await page.getByRole('button', { name: '전문 차트 열기' }).click()
  await select(page, 'critic'); await expect(page.locator('.research-critic-blocks > div')).toHaveCount(3); await expect(page.locator('.g-tag').last()).toHaveText('Verdict'); await expect(page.locator('.research-critic-blocks')).toContainText('판정 보류')
  await select(page, 'stress'); await expect(page.locator('tbody')).toContainText('수익 +3.123%, 낙폭 −5.246%')
  await select(page, 'holdout'); await expect(page.locator('.g-vstat')).toContainText('+7.123% → +2.375%'); await expect(page.locator('.g-finding')).toContainText('공급한 다음 행동')
  await select(page, 'report'); for (const name of ['근거', '의견 불일치', '검증 무결성', '아직 모르는 것', '만약에']) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  await expect(page.locator('.g-qchip')).toHaveCount(3); await page.getByRole('button', { name: '근거', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Backtest v17' })).toBeVisible()
  await select(page, 'connect'); await expect(page.locator('tbody tr')).toHaveCount(3); await expect(page.locator('tbody tr').last()).toContainText('요청 안 함')
  await select(page, 'run'); await expect(page.locator('.g-row')).toHaveCount(5); await expect(page.getByRole('button', { name: '실전 시작', exact: true })).toBeDisabled()
  await select(page, 'live'); await expect(page.locator('tbody').first()).toContainText('0.003125 BTC'); await expect(page.locator('tbody').last()).toContainText('100ms → 123ms'); await page.getByRole('button', { name: 'AI 트레이딩에서 열기' }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'researchCalls'))).toEqual(['analysis', 'open:bt2', 'trading']); expect(errors).toEqual([])
  await page.screenshot({ path: info.outputPath('live-supplied.png'), fullPage: true })
})

test('미공급에서도 10개 문서의 원본 구조를 보존하고 성과·권한·체결을 생성하지 않는다', async ({ page }) => {
  await mount(page, false)
  for (const kind of kinds) {
    await select(page, kind)
    await expect(page.locator('[data-research-document-kind] > [role="status"]')).toHaveText('아직 공급된 문서 데이터가 없습니다.')
    const enabled = await page.locator('button:enabled').count(); expect(enabled, kind).toBe(0)
    await expect(page.locator('[data-research-document-kind]')).not.toContainText(/MOCK|검증 통과|수익성 확인|100%|25일|요청함|가설 확인/)
    if (kind === 'strategy' || kind === 'run') await expect(page.locator('.g-row')).toHaveCount(5)
    if (kind === 'report') await expect(page.locator('.g-qchip')).toHaveCount(3)
    if (kind === 'backtest') { await expect(page.locator('.g-vstat > div')).toHaveCount(5); await expect(page.locator('thead th')).toHaveCount(4) }
  }
  expect(await page.evaluate(() => Reflect.get(window, 'researchCalls'))).toEqual([])
})

test('행 수정은 실패 때 초안·공급값 보존, 성공 때만 닫힘, 중복 요청 차단', async ({ page }) => {
  await mount(page); await select(page, 'strategy')
  await page.getByRole('button', { name: '진입 수정 요청', exact: true }).focus(); await page.getByRole('button', { name: '진입 수정 요청', exact: true }).click()
  await page.getByRole('textbox', { name: '진입 코멘트' }).fill('103으로')
  await page.getByRole('button', { name: '적용', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  expect(await page.evaluate(() => Reflect.get(window, 'researchCalls'))).toEqual(['comment:103으로'])
  await reject(page, 'comment:103으로'); await expect(page.getByRole('alert')).toHaveText('요청을 완료하지 못했습니다. 다시 시도해주세요.'); await expect(page.getByRole('textbox')).toHaveValue('103으로'); await expect(page.locator('.g-row').first()).toContainText('가격 ≥ 101.005')
  await expect(page.locator('body')).not.toContainText('SECRET_INTERNAL_TOKEN')
  await page.getByRole('button', { name: '적용', exact: true }).click(); await resolve(page, 'comment:103으로'); await expect(page.getByRole('textbox')).toHaveCount(0); await expect(page.getByRole('button', { name: '진입 수정 요청', exact: true })).toBeFocused(); await expect(page.locator('.g-row').first()).toContainText('가격 ≥ 101.005')
})

test('what-if 비동기 실제 응답만 표시하고 이전 owner의 늦은 결과를 폐기', async ({ page }) => {
  await mount(page); await select(page, 'report'); await page.getByRole('button', { name: '수수료 2배' }).click()
  await expect(page.locator('[aria-live="polite"]')).toHaveCount(0)
  await reject(page, 'whatif'); await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: '수수료 2배' }).click(); await resolve(page, 'whatif', { title: '공급한 민감도 결과', summary: '추가 조건에서 확인된 실제 응답', metrics: { return: { text: '−9.125%' } } }); await expect(page.locator('[aria-live="polite"]')).toContainText('−9.125%')
  await page.getByRole('button', { name: '수수료 2배' }).click(); await page.evaluate(() => Reflect.get(window, 'researchOwner')('owner-b')); await resolve(page, 'whatif', { title: '이전 사용자 결과', summary: '노출 금지' }); await expect(page.locator('[aria-live="polite"]')).toHaveCount(0)
})

test('연결·실행·정지 실패, 이중클릭과 owner 변경에도 상태를 임의 성공시키지 않는다', async ({ page }) => {
  await mount(page); await select(page, 'connect'); await page.getByRole('button', { name: 'Binance로 간편 연결' }).click(); await expect(page.getByRole('button', { name: '파트너 거래소로 시작' })).toBeDisabled(); await reject(page, 'connect'); await expect(page.getByRole('alert')).toBeVisible(); await expect(page.locator('[data-research-document-kind]')).toHaveAttribute('data-research-document-kind', 'connect')
  await select(page, 'run'); await page.getByRole('button', { name: '가상 검증으로 시작' }).click(); await reject(page, 'paper'); await expect(page.getByRole('alert')).toBeVisible()
  await select(page, 'live'); await page.getByRole('button', { name: '일시 정지', exact: true }).click(); await resolve(page, 'pause'); await expect(page.getByRole('button', { name: '일시 정지', exact: true })).toBeEnabled(); await expect(page.getByRole('button', { name: '재개', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '전략 종료', exact: true }).click(); await expect(page.getByText('정말 종료할까요?', { exact: true })).toBeVisible(); await page.getByRole('button', { name: '전략 종료', exact: true }).click(); await reject(page, 'stop'); await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByText('정말 종료할까요?', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '전략 종료', exact: true }).click(); await page.evaluate(() => Reflect.get(window, 'researchOwner')('owner-b')); await reject(page, 'stop'); await expect(page.getByRole('alert')).toHaveCount(0); await expect(page.getByText('정말 종료할까요?', { exact: true })).toHaveCount(0)
})

test('320px에서 모든 문서·7언어가 넘침 없이 읽히고 언어 변경이 수정 초안을 보존한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 }); await mount(page)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(language => Reflect.get(window, 'researchLanguage')(language), language)
    for (const kind of kinds) {
      await select(page, kind)
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), `${language}:${kind}`).toBe(false)
    }
  }
  await page.evaluate(() => Reflect.get(window, 'researchLanguage')('ko')); await select(page, 'strategy'); await page.getByRole('button', { name: '진입 수정 요청', exact: true }).click(); await page.getByRole('textbox').fill('유지할 초안')
  await page.evaluate(() => Reflect.get(window, 'researchLanguage')('fr')); await expect(page.getByRole('textbox')).toHaveValue('유지할 초안'); await expect(page.getByRole('button', { name: 'Appliquer', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('research-320-fr.png'), fullPage: true })
})

test('loading/error 상태에서도 본문을 유지하되 요청을 차단하고 오류를 7언어로 표시한다', async ({ page }) => {
  await mount(page); await select(page, 'connect')
  await page.evaluate(() => Reflect.get(window, 'researchState')('loading')); await expect(page.getByRole('status')).toHaveText('문서를 불러오는 중'); await expect(page.locator('tbody tr')).toHaveCount(3); await expect(page.locator('button:enabled')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'researchState')('error')); await expect(page.getByRole('status')).toHaveText('요청을 완료하지 못했습니다. 다시 시도해주세요.'); await expect(page.locator('button:enabled')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'researchState')('ready'))
  const messages = [
    ['ko', '요청을 완료하지 못했습니다. 다시 시도해주세요.'], ['en', 'The request could not be completed. Please try again.'], ['ja', 'リクエストを完了できませんでした。再試行してください。'],
    ['zh-CN', '未能完成请求，请重试。'], ['zh-TW', '未能完成請求，請重試。'], ['es', 'No se pudo completar la solicitud. Inténtalo de nuevo.'], ['fr', 'La demande n’a pas abouti. Réessayez.'],
  ]
  for (const [language, message] of messages) {
    await page.evaluate(language => Reflect.get(window, 'researchLanguage')(language), language)
    await page.getByRole('button', { name: 'Binance로 간편 연결' }).click(); await reject(page, 'connect'); await expect(page.getByRole('alert')).toHaveText(message)
    await expect(page.locator('body')).not.toContainText('SECRET_INTERNAL_TOKEN_DO_NOT_SHOW')
  }
})

test('행 요청 중 owner 전환과 다른 제어 초점은 늦은 성공/실패가 침범하지 않는다', async ({ page }) => {
  await mount(page); await select(page, 'strategy'); await page.getByRole('button', { name: '진입 수정 요청', exact: true }).focus(); await page.getByRole('button', { name: '진입 수정 요청', exact: true }).click(); await page.getByRole('textbox').fill('이전 사용자'); await page.getByRole('button', { name: '적용', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'researchOwner')('owner-b')); await reject(page, 'comment:이전 사용자'); await expect(page.getByRole('textbox')).toHaveCount(0); await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: '진입 수정 요청', exact: true }).focus(); await page.getByRole('button', { name: '진입 수정 요청', exact: true }).click(); await page.getByRole('textbox').fill('새 요청'); await page.getByRole('button', { name: '적용', exact: true }).click()
  await page.evaluate(() => { const button = document.createElement('button'); button.textContent = '다른 화면 제어'; button.id = 'outside-control'; document.body.appendChild(button); button.focus() })
  await resolve(page, 'comment:새 요청'); await expect(page.getByRole('textbox')).toHaveCount(0); await expect(page.locator('#outside-control')).toBeFocused()
})
