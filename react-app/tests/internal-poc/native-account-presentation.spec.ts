import { expect, test, type Page } from '@playwright/test'
import type { NativeAccountPresentation, NativeAccountLedgerTab } from '../../src/internal-poc/native-account-presentation'
import { accountPlanText } from '../../src/client-account-plan-copy'
import { nativeAccountText } from '../../src/internal-poc/native-account-presentation-copy'

test.use({ trace: 'off', video: 'off' })
const tabs: NativeAccountLedgerTab[] = ['pos', 'open', 'orders', 'fills', 'closed', 'assets']
function fixture(): NativeAccountPresentation {
  return {
    scope: 'owner-a', identity: 'account-fixture-a', sourceLabel: '합성 계정 표시 입력, 실제 거래 아님',
    creditLabel: '공급된 이용 상태',
    notifications: [{ id: 'notice-a', type: 'review', title: '공급된 복기 알림', body: '관측된 공개 알림 원문', timeLabel: '공급된 알림 시각', read: false, target: { kind: 'review', id: 'review-a' } }, { id: 'notice-b', type: 'bot', title: '공급된 전략 알림', timeLabel: '공급된 시각', read: true }],
    accounts: [{ id: 'account-a', kind: 'account', title: '공급된 계정 A', sourceLabel: '명시 시험 자료', fields: [{ label: '계정 상태', value: '공급된 읽기 전용 상태' }], sections: [{ id: 'details', title: '계정 연결', text: '관측된 연결 설명' }] }],
    strategies: ['a', 'b'].map(id => ({ accountId: 'account-a', strategy: { id, name: `공급 전략 ${id.toUpperCase()}`, symbol: 'BTC/USDT', market: 'USDT', version: 'v3', status: 'off', exchange: { id: 'recorded', name: '시험 거래소', color: '#26282c' }, capitalLabel: '공급 자금 123', pnlLabel: '공급 손익 7' },
      chart: { identity: `chart-${id}`, market: 'BTC/USDT', sourceLabel: '합성 가격 시험', resolutionSeconds: 60, pricePrecision: 2, bars: [{ time: 1800000000, open: 10, high: 12, low: 9, close: 11, volume: 3 }, { time: 1800000060, open: 11, high: 13, low: 10, close: 12, volume: 4 }], fills: [] },
      agent: { events: [{ id: `event-${id}`, type: 'watch', timeLabel: '공급 시각', text: `공개 관측 ${id}` }], sourceLabel: '공개 시험 기록' },
      dashboard: [{ label: '관측 수익률', value: '공급값 그대로 2.17%' }], versionHistory: [{ from: 'v2', to: 'v3', timeLabel: '원본 시각', by: '공급자', diff: '확정된 변경 원문' }],
    })),
    ledger: Object.fromEntries(tabs.map(tab => [tab, ['a', 'b'].map(id => ({ id: `${tab}-${id}`, accountId: 'account-a', strategyId: id, cells: { exchange: '시험 거래소', strategy: `공급 전략 ${id.toUpperCase()}`, symbol: 'BTC/USDT', side: 'BUY', quantity: '7.0001', price: '101.234', entry: '89.12', current: '91.50', unrealized: '17.17', realized: '7.91', equity: `ACCOUNT-${id}`, available: '63.2', used: '26.1' }, target: { kind: 'review', id: 'review-a' } }))])) as NativeAccountPresentation['ledger'],
    documents: [{ id: 'a', kind: 'bot', strategyId: 'a', title: '전략 A 상세', sourceLabel: '제공된 문서', fields: [{ label: '원금', value: '공급된 123' }], sections: [{ id: 'rules', title: '확정 규칙', text: '공급된 규칙 원문' }], links: [{ label: '거래 복기 열기', target: { kind: 'review', id: 'review-a' } }] },
      { id: 'review-a', kind: 'review', strategyId: 'a', title: '공급된 거래 복기', sourceLabel: '제공된 복기', fields: [], sections: [{ id: 'evidence', title: '진입 근거', text: '실제 공급한 공개 설명' }], links: [{ label: '기간 보고서 열기', target: { kind: 'periodic', id: 'period-a' } }] },
      { id: 'period-a', kind: 'periodic', title: '공급된 기간 보고서', sourceLabel: '제공된 기간', fields: [{ label: '기간 수익률', value: '공급값 -3.141%' }], sections: [] }],
    plan: { title: '공급된 PLAN', sourceLabel: '공급된 자격 표시, 권위 생성 아님', sections: { plan: [{ id: 'plan', title: '현재 이용 상태', fields: [{ label: '이용 상태', value: '공급된 플랜' }] }], rebates: [{ id: 'rebate', title: '공급된 정산', fields: [{ label: '정산 값', value: '공급된 7.23' }] }], alerts: [] }, preferences: [{ id: 'reports', label: '보고서 알림', checked: true }] },
  }
}

function richFixture(): NativeAccountPresentation {
  const data = fixture()
  data.plan!.presentation = {
    title: '공급된 PLAN', sourceLabel: '확인된 표시 시험',
    status: { hero: { title: '이용 수준', badge: '제공 상태', label: '이용 상태', value: '계약 표시값', description: '권한을 만들어내지 않은 공개 설명' }, badgeTone: 'blue', gauge: { percent: 37.125, left: '공급 게이지 왼쪽', right: '공급 게이지 오른쪽' }, details: [{ id: 'uid', label: 'UID 연결', value: '확인된 원문', icon: 'link' }, { id: 'sub', label: '구독', value: '공급 기록', icon: 'card' }], actions: [{ id: 'link', label: '연결 요청', tone: 'pri' }, { id: 'upgrade', label: '구독 요청' }], footer: '권한은 서버에서 별도 확인' },
    rebates: { hero: { title: '누적 적립', label: '실제 공급된 정산 합계', value: '123.456789 TOKEN', tone: 'gain' }, metrics: [{ label: '기록', value: '42건이라는 공급값' }, { label: '요율', value: '0.123456%' }], historyLabel: '공급된 내역', history: [{ id: 'rebate-a', label: '확정 정산 A', description: '제공된 날짜', value: '+0.0023 TOKEN', route: '#/review/review-a', icon: 'won', tone: 'gain' }], actions: [{ id: 'trade', label: '내 트레이딩', route: '#/trade', tone: 'pri' }] },
    preferences: [{ id: 'kinds', title: '알림 종류', rows: [{ id: 'reports', label: '보고서 알림', description: '확정된 설정 설명', checked: true, icon: 'doc' }] }, { id: 'channels', title: '채널', footer: '공급자가 확인한 채널만', rows: [{ id: 'mail', label: '이메일 채널', checked: false, icon: 'mail' }, { id: 'unknown', label: '채널 확인 중', checked: null }] }],
  }
  data.documents![0].presentation = { kind: 'bot', view: {
    id: 'a', title: '전략 A 상세', sourceLabel: '관측 공개 데이터', environment: { label: '확인된 실행 환경', key: 'paper' }, origin: '공급 원본', notice: '실행 권한은 별도 확인', actions: [{ id: 'pause', label: '실행 일시정지', tone: 'dng' }, { id: 'edit', label: '전략 수정' }],
    score: { value: '83.125', percent: 83.125, badge: '원본 검증 기록', rank: '공급 평가 문구', description: '평가를 화면에서 재계산하지 않음' }, returnMetric: { label: '검증 수익률', value: '+99.777%', description: '곡선에서 다시 계산하지 않음', tone: 'gain', barPercent: 67 }, drawdownMetric: { label: '최대 낙폭', value: '-2.333%', barPercent: 12 },
    equity: { title: '검증 수익 곡선', sourceLabel: '확정 곡선', description: '실제 공급한 세 점', tone: 'gain', points: [{ label: '첫점', value: 100 }, { label: '중간', value: 112 }, { label: '끝', value: 95 }] },
    orders: [{ id: 'fill-a', label: '확정 체결 원문', value: '-0.10023%', route: '#/review/review-a', tone: 'loss', icon: 'trend' }], ordersLabel: '확정된 정산 원문', position: { title: '공급된 현재 포지션', description: '관측 상태 원문', badge: '제공된 상태', checks: ['확인된 조건 A', '확인된 조건 B'] }, execution: [{ id: 'authority', label: '실행 권한', value: '미승인' }, { id: 'exchange', label: '거래소', value: '공급된 거래소' }],
    log: { sourceLabel: '공개 확정 관측', summary: [{ label: '검증 구간', value: '공급된 봉 수' }], rows: Array.from({ length: 30 }, (_, index) => ({ id: `log-${index}`, timeLabel: `원시각 ${index}`, type: index % 2 ? 'entry' : 'watch', tag: index % 2 ? 'ENTRY' : 'WATCH', text: `확정 공개 기록 ${index}` })) },
  } }
  data.documents![1].presentation = { kind: 'review', view: { id: 'review-a', hero: { title: '공급된 거래 복기', badge: '확정 기록', label: '실현 손익', value: '-7.123456%', description: '실제 확정한 청산 설명', tone: 'loss' }, sourceLabel: '공급 근거', reportAction: { id: 'report', label: '기간 보고서', route: '#/periodic/period-a' }, chips: [{ label: '구분', value: '공급된 청산 분류' }, { label: '정산', value: '+0.001 TOKEN', tone: 'gain' }], evidenceLabel: '공개 확정 관측', causes: [{ id: 'entry', title: '진입 근거', tag: 'ENTRY', text: '공개 확정 진입 조건', tone: 'e', icon: 'doc' }, { id: 'exit', title: '청산 근거', tag: 'EXIT', text: '공개 확정 청산 조건', tone: 'x', icon: 'trend' }], actions: [{ id: 'bot', label: '이 전략 상세로', route: '#/trade/bot/a', tone: 'pri' }] } }
  data.documents![2].presentation = { kind: 'periodic', view: { id: 'period-a', hero: { title: '공급된 기간 보고서', label: '기간 합산 손익', value: '+17.123%', tone: 'gain' }, sourceLabel: '확정 집계', dateLabel: '제공된 기간 원문', ring: { percent: 42.125, label: '42.125%' }, metrics: [{ label: '체결', value: '공급된 9회' }, { label: '정산', value: '0.0177 TOKEN' }], reviewsLabel: '확인된 조회 범위', reviews: [{ id: 'review-a', label: '확정 복기 보기', value: '-7.123456%', route: '#/review/review-a', tone: 'loss' }], actions: [{ id: 'trade', label: '내 트레이딩', route: '#/trade', tone: 'pri' }] } }
  return data
}

async function mount(page: Page, supplied = true, rich = false) {
  await page.route('**/native-account-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0f1012"><div id="fixture" style="height:100dvh"></div></body></html>' }))
  await page.goto('/native-account-fixture.html')
  await page.evaluate(async ({ data, supplied }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const font = '/node_modules/@fontsource-variable/noto-sans-kr/wght.css'
    await import(/* @vite-ignore */ font)
    document.body.style.fontFamily = '"Noto Sans KR Variable", sans-serif'
    const path = '/src/internal-poc/NativeTradingWorkspace.tsx', planPath = '/src/internal-poc/NativeAccountPlan.tsx'
    const source = await (await fetch(path)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, h = react.createElement
    const dp = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ dp)
    const { NativeTradingWorkspace } = await import(/* @vite-ignore */ path)
    const { NativeAccountPlan } = await import(/* @vite-ignore */ planPath)
    const audit = { calls: [] as unknown[][], mode: 'resolve', resolve: () => {}, reject: () => {} }
    const action = async (...args: unknown[]) => {
      audit.calls.push(args)
      if (audit.mode === 'reject') throw new Error('RAW_PRIVATE_DIAGNOSTIC')
      if (audit.mode === 'hold') await new Promise<void>((resolve, reject) => { audit.resolve = resolve; audit.reject = () => reject(new Error('RAW_PRIVATE_DIAGNOSTIC')) })
    }
    function Host() {
      const [owner, setOwner] = react.useState('owner-a'), [presentation, setPresentation] = react.useState(supplied ? data : undefined)
      const [route, setRoute] = react.useState(null)
      Object.assign(window, { accountAudit: audit, setAccountOwner: setOwner, setAccountFixture: setPresentation, accountNavigate: setRoute })
      const input = react.useMemo(() => presentation && { ...presentation, actions: { onRename: (...args: unknown[]) => action('rename', ...args), onStatus: (...args: unknown[]) => action('status', ...args), onClone: (...args: unknown[]) => action('clone', ...args), onDelete: (...args: unknown[]) => action('delete', ...args), onMessage: (...args: unknown[]) => action('message', ...args), onPreference: (...args: unknown[]) => action('preference', ...args), onReconnect: (...args: unknown[]) => action('reconnect', ...args), onConnect: () => action('connect'), onRead: (...args: unknown[]) => action('read', ...args), onReadAll: () => action('readAll'), onPlanAction: (...args: unknown[]) => action('planAction', ...args), onDocumentAction: (...args: unknown[]) => action('documentAction', ...args) } }, [presentation])
      return h(react.Fragment, {}, h('div', { hidden: route !== null, style: { height: '100%' } }, h(NativeTradingWorkspace, { accountScope: owner, presentation: input, onNavigate: setRoute, onReturn: () => { audit.calls.push(['return']) }, onNew: () => { audit.calls.push(['new']) } })),
        route !== null && h(NativeAccountPlan, { accountScope: owner, presentation: input, location: route, onNavigate: setRoute, onTrading: () => setRoute(null), onReturn: () => setRoute(null) }))
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  }, { data: rich ? richFixture() : fixture(), supplied })
  await expect(page.locator('.native-trading-workspace')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}
async function panel(page: Page, name: string) {
  const button = page.locator('.ctt-main-tabs').getByRole('tab', { name: name === 'Agent' || name === '전략' ? '판단' : name, exact: true })
  if (await button.isVisible()) await button.click()
  const selector = page.locator('.ctt-selector-button')
  if ((await selector.getAttribute('aria-expanded') === 'true') !== (name === '전략')) await selector.click()
}
async function bottom(page: Page, id: NativeAccountLedgerTab) {
  await panel(page, '차트')
  await page.locator(`.ctt-bottom-tabs [data-tab-id="${id}"]`).click()
  return page.locator(`.ctt-bottom-pane[data-tab-id="${id}"]`)
}

for (const width of [320, 1440]) for (const mode of ['missing', 'supplied', 'rich'] as const) {
  test(`PLAN 원본 설명과 공급 출처를 분리한다 ${width}px ${mode}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 760 })
    await mount(page, mode !== 'missing', mode === 'rich')
    await page.evaluate(() => Reflect.get(window, 'accountNavigate')({ kind: 'plan', tab: 'alerts' }))
    const plan = page.locator('.native-service-plan')
    const selected = plan.locator('.nfx-tab').last()
    await selected.focus()
    const selectedNode = await selected.elementHandle()
    for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
      await page.evaluate(async language => {
        const path = '/src/client-preferences.ts'
        ;(await import(/* @vite-ignore */ path)).setClientPreference('language', language)
      }, language)
      await expect(plan.locator('.nfx-sub')).toHaveText(accountPlanText(language, 'description'))
      await expect(plan.locator('[data-plan-source]')).toHaveText(mode === 'missing' ? nativeAccountText(language, 'unavailable') : mode === 'rich' ? '확인된 표시 시험' : '공급된 자격 표시, 권위 생성 아님')
      await expect(selected).toHaveAttribute('aria-current', 'page')
      await expect(selected).toBeFocused()
      expect(await selected.evaluate((node, original) => node === original, selectedNode)).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    expect(await page.evaluate(() => Reflect.get(window, 'accountAudit').calls)).toEqual([])
    await page.screenshot({ path: info.outputPath('plan-description-source.png'), fullPage: true })
  })
}

test('미공급 입력에서도 원본 레일·차트·Agent·6탭을 유지한다', async ({ page }) => {
  await mount(page, false)
  await expect(page.locator('.ctt-bottom-tabs [role="tab"]')).toHaveCount(6)
  await expect(page.locator('.tft-card')).toHaveCount(0)
  for (const id of tabs) await expect((await bottom(page, id)).locator('.client-terminal-connection-empty')).toBeVisible()
  await panel(page, 'Agent')
  await expect(page.locator('.cat-tabs [role="tab"]')).toHaveCount(3)
  await panel(page, '전략')
  await page.getByRole('button', { name: '새 전략', exact: true }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'accountAudit').calls)).toEqual([['new']])
})

test('전략 선택·6원장·계정 전체 자산·상세·전체화면은 단일 차트를 보존한다', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await expect(page.locator('.cp-surface')).toHaveCount(1)
  await page.evaluate(() => Reflect.set(window, 'accountChartNode', document.querySelector('.cp-surface')))
  for (const id of tabs) {
    const pane = await bottom(page, id)
    if (id === 'assets') {
      await expect(pane.locator('.tft-asx')).toHaveCount(2)
      await expect(pane.locator('.ag2 b').nth(0)).toHaveText('ACCOUNT-a')
      await expect(pane.locator('.ag2 b').nth(4)).toHaveText('ACCOUNT-b')
    } else await expect(pane.locator('tbody tr')).toHaveCount(1)
  }
  await page.getByRole('combobox', { name: '데이터 범위' }).selectOption('all')
  await expect((await bottom(page, 'fills')).locator('tbody tr')).toHaveCount(2)
  await page.getByRole('button', { name: '터미널 전체화면' }).click()
  await panel(page, '차트')
  await page.locator('.ctt-bottom-pane[data-selected="true"] .stlk').filter({ hasText: '시험 거래소' }).first().click()
  await expect(page.locator('[data-native-account-document="account-a"]')).toContainText('관측된 연결 설명')
  await page.locator('[data-native-account-document] .native-plan-return button').click()
  await expect(page.locator('.ctt-bottom-pane[data-tab-id="fills"]')).toBeVisible()
  expect(await page.evaluate(() => Reflect.get(window, 'accountChartNode') === document.querySelector('.cp-surface'))).toBe(true)
  await page.locator('[data-terminal-close]').click()
  await panel(page, '전략')
  await page.getByRole('button', { name: '공급 전략 B 선택', exact: true }).click()
  await panel(page, '차트')
  await page.getByRole('combobox', { name: '데이터 범위' }).selectOption('current')
  await expect((await bottom(page, 'pos')).locator('tbody')).toContainText('공급 전략 B')
  await expect(page.locator('.cp-surface')).toHaveCount(1)
  expect(errors).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
  await page.screenshot({ path: info.outputPath('native-account-terminal.png'), fullPage: true })
})

test('Agent·버전·전략상세·복기·기간·PLAN 왕복은 공급 문서만 표시한다', async ({ page }) => {
  await mount(page)
  await panel(page, 'Agent')
  await expect(page.locator('.teth-agent-feed')).toContainText('공개 관측 a')
  await page.getByRole('tab', { name: '대시보드', exact: true }).click()
  await expect(page.locator('.cat-brain')).toContainText('공급값 그대로 2.17%')
  await page.getByRole('button', { name: '버전 기록 보기 (v3)' }).click()
  await expect(page.locator('dialog[open]')).toContainText('확정된 변경 원문')
  await page.locator('dialog[open] [data-cancel]').click()
  await page.locator('.cat-brain').getByRole('button', { name: '전략 상세', exact: true }).click()
  await expect(page.locator('[data-native-account-document="a"]')).toContainText('공급된 규칙 원문')
  await page.getByRole('button', { name: '거래 복기 열기' }).click()
  await expect(page.locator('[data-native-account-document="review-a"]')).toContainText('실제 공급한 공개 설명')
  await page.getByRole('button', { name: '기간 보고서 열기' }).click()
  await expect(page.locator('[data-native-account-document="period-a"]')).toContainText('공급값 -3.141%')
  await page.locator('[data-native-account-document="period-a"] .native-plan-return button').click()
  await page.getByRole('button', { name: 'PLAN', exact: true }).click()
  await expect(page.locator('.native-service-plan')).toContainText('공급된 플랜')
  await page.locator('.nfx-tabs button').nth(1).click()
  await expect(page.locator('.native-service-plan')).toContainText('공급된 7.23')
  await page.locator('.native-service-plan .native-plan-return button').click()
  await expect(page.locator('.native-trading-workspace')).toBeVisible()
})

test('메뉴 실패 초안·동기 중복 잠금·성공 후 서버 입력 대기를 지킨다', async ({ page }) => {
  await mount(page)
  await panel(page, '전략')
  await page.getByRole('button', { name: '공급 전략 A 전략 메뉴' }).click()
  await page.getByRole('menuitem', { name: '이름 변경', exact: true }).click()
  await page.locator('.csa-dialog input').fill('변경 요청 이름')
  await page.evaluate(() => { Reflect.get(window, 'accountAudit').mode = 'reject' })
  await page.locator('.csa-dialog button[type="submit"]').click()
  await expect(page.locator('.csa-dialog [role="alert"]')).toBeVisible()
  await expect(page.locator('.csa-dialog input')).toHaveValue('변경 요청 이름')
  await expect(page.locator('body')).not.toContainText('RAW_PRIVATE_DIAGNOSTIC')
  await page.evaluate(() => { Reflect.get(window, 'accountAudit').mode = 'hold'; const form = document.querySelector('.csa-dialog form')!; form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  expect(await page.evaluate(() => Reflect.get(window, 'accountAudit').calls)).toEqual([['rename', 'a', '변경 요청 이름'], ['rename', 'a', '변경 요청 이름']])
  await expect(page.locator('.csa-dialog button[type="submit"]')).toBeDisabled()
  await page.evaluate(() => Reflect.get(window, 'accountAudit').resolve())
  await expect(page.locator('.csa-dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '공급 전략 A 선택', exact: true })).toBeVisible()
  await expect(page.locator('.ctt-notice')).toContainText('갱신된 계정 기록을 확인해주세요.')
})

test('owner 교체·중복 ID·외부전략 원장 참조는 기존 자료와 늦은 완료를 숨긴다', async ({ page }) => {
  await mount(page)
  await panel(page, '전략')
  await page.evaluate(() => { Reflect.get(window, 'accountAudit').mode = 'hold' })
  await page.getByRole('button', { name: '거래소 연결하기', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'setAccountOwner')('owner-b'))
  await expect(page.locator('.tft-card')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'accountAudit').resolve())
  await expect(page.locator('.native-trading-workspace')).not.toContainText('공급 전략 A')
  await expect(page.locator('.ctt-notice')).not.toContainText('갱신된 계정 기록')
  const bad = fixture(); bad.scope = 'owner-b'; bad.strategies = [bad.strategies![0], bad.strategies![0]]
  await page.evaluate(data => Reflect.get(window, 'setAccountFixture')(data), bad)
  await expect(page.locator('.tft-card')).toHaveCount(0)
  const foreign = fixture(); foreign.scope = 'owner-b'; foreign.ledger.pos![0].strategyId = 'foreign'
  await page.evaluate(data => Reflect.get(window, 'setAccountFixture')(data), foreign)
  await expect(page.locator('.tft-card')).toHaveCount(0)
})

test('Agent 질문과 PLAN 설정 실패·영어 변경은 초안 및 공급 체크 상태를 보존한다', async ({ page }) => {
  await mount(page)
  await panel(page, 'Agent')
  const input = page.locator('.tft-comp input')
  await input.fill('공개 근거를 설명해주세요')
  await page.evaluate(() => { Reflect.get(window, 'accountAudit').mode = 'reject' })
  await page.locator('.tft-comp button[type="submit"]').click()
  await expect(page.locator('.ctt-notice [role="alert"]')).toBeVisible()
  await expect(input).toHaveValue('공개 근거를 설명해주세요')
  await page.evaluate(() => { Reflect.get(window, 'accountAudit').mode = 'resolve' })
  await page.locator('.tft-comp button[type="submit"]').click()
  await expect(input).toHaveValue('')
  await expect(page.locator('.tft-agc')).toHaveCount(1)
  await page.getByRole('button', { name: 'PLAN', exact: true }).click()
  await page.locator('.nfx-tabs button').nth(2).click()
  await page.evaluate(() => { Reflect.get(window, 'accountAudit').mode = 'reject' })
  await page.getByRole('switch', { name: '보고서 알림' }).press('Space')
  await expect(page.getByRole('switch', { name: '보고서 알림' })).toBeChecked()
  await expect(page.locator('.native-service-plan [role="alert"]')).toBeVisible()
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', 'en') })
  await expect(page.locator('.native-service-plan [role="alert"]')).toHaveText('Could not complete the request. Please try again.')
  await expect(page.getByRole('switch', { name: '보고서 알림' })).toBeChecked()
})

test('공급 알림·읽음·모두 읽음·필터·설정은 원본 벨과 6탭 밖에서 연결된다', async ({ page }) => {
  await mount(page)
  await expect(page.locator('.cat-heading-tools')).toContainText('공급된 이용 상태')
  await page.getByRole('button', { name: '알림, 1개 안읽음', exact: true }).click()
  const inbox = page.locator('[data-native-account-alerts]')
  await expect(inbox).toContainText('관측된 공개 알림 원문')
  await expect(page.locator('.ctt-bottom-tabs [role="tab"]')).toHaveCount(6)
  await page.evaluate(() => { Reflect.get(window, 'accountAudit').mode = 'reject' })
  await inbox.locator('.nf-item:not(.read)').first().click()
  await expect(page.locator('.ctt-notice [role="alert"]')).toBeVisible()
  await expect(inbox.locator('.nf-item:not(.read)')).toHaveCount(1)
  await page.evaluate(() => { Reflect.get(window, 'accountAudit').mode = 'hold'; const b = [...document.querySelectorAll<HTMLButtonElement>('[data-native-account-alerts] button')].find(b => b.textContent === '모두 읽음')!; b.click(); b.click() })
  expect(await page.evaluate(() => Reflect.get(window, 'accountAudit').calls)).toEqual([['read', 'notice-a'], ['readAll']])
  await expect(inbox.getByRole('button', { name: '모두 읽음' })).toBeDisabled()
  await page.evaluate(() => Reflect.get(window, 'accountAudit').resolve())
  await expect(inbox.locator('.nf-item:not(.read)')).toHaveCount(1)
  await inbox.locator('.nfxh-fchips button').filter({ hasText: '전략' }).click()
  await expect(inbox.locator('.nf-item')).toHaveCount(1)
  await expect(inbox).toContainText('공급된 전략 알림')
  await inbox.getByRole('button', { name: '수신 설정', exact: true }).click()
  await expect(page.getByRole('switch', { name: '보고서 알림' })).toBeVisible()
})

test('알림 미공급은 안읽음 0으로 주장하지 않고 7언어 UI 이름을 유지한다', async ({ page }) => {
  await mount(page, false)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', language) }, language)
    await expect(page.locator('.client-account-bell .bd')).toHaveCount(0)
    const label = await page.locator('.client-account-bell').getAttribute('aria-label')
    expect(label).toContain(': ')
    if (language !== 'ko') expect(label).not.toMatch(/[가-힣]/)
  }
  await page.locator('.client-account-bell').click()
  await expect(page.locator('[data-native-account-alerts] [role="status"]')).toHaveText('Impossible de vérifier l’état du compte')
})

async function openBot(page: Page) {
  await panel(page, 'Agent')
  await page.getByRole('tab', { name: '대시보드', exact: true }).click()
  await page.locator('.cat-brain').getByRole('button', { name: '전략 상세', exact: true }).click()
}

test('원본 전략 상세 hero·점수링·곡선·주문·포지션·환경·공개 로그를 공급값으로 복원한다', async ({ page }, info) => {
  await mount(page, true, true)
  await page.evaluate(() => Reflect.set(window, 'accountChartNode', document.querySelector('.cp-surface')))
  await openBot(page)
  const bot = page.locator('.client-user-strategy')
  await expect(bot.locator('.nfxb-hero')).toContainText('확인된 실행 환경')
  await expect(bot.locator('.nfxb-ring')).toHaveText('83.125')
  await expect(bot.locator('.nfxb-mgrid')).toContainText('+99.777%')
  await expect(bot.locator('.nfxb-spark svg')).toHaveCount(1)
  await expect(bot.locator('.nfxb-posbox')).toContainText('확인된 조건 B')
  await expect(bot.locator('.nfxb-specs')).toContainText('미승인')
  await expect(bot.locator('.nfxl-ev')).toHaveCount(14)
  await bot.getByRole('button', { name: '이전 14개 보기' }).click()
  await expect(bot.locator('.nfxl-ev')).toHaveCount(28)
  await bot.getByRole('button', { name: '체결만', exact: true }).click()
  await expect(bot.locator('.nfxl-ev')).toHaveCount(14)
  await expect(bot.locator('.nfxl-ev.watch')).toHaveCount(0)
  await bot.getByRole('button', { name: '이전 14개 보기' }).click()
  await expect(bot.locator('.nfxl-ev')).toHaveCount(15)
  await expect(bot.getByRole('button', { name: '이전 14개 보기' })).toBeDisabled()
  await page.evaluate(() => { Reflect.get(window, 'accountAudit').mode = 'reject' })
  await bot.getByRole('button', { name: '실행 일시정지', exact: true }).click()
  await expect(bot.getByRole('alert')).toBeVisible()
  await expect(bot).not.toContainText('RAW_PRIVATE_DIAGNOSTIC')
  await page.evaluate(() => { Reflect.get(window, 'accountAudit').mode = 'hold'; const b = [...document.querySelectorAll<HTMLButtonElement>('.nfxb-actions button')].find(b => b.textContent === '전략 수정')!; b.click(); b.click() })
  expect(await page.evaluate(() => Reflect.get(window, 'accountAudit').calls)).toEqual([['documentAction', 'a', 'pause'], ['documentAction', 'a', 'edit']])
  await page.evaluate(() => Reflect.get(window, 'accountAudit').resolve())
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', language) }, language)
    if (language !== 'ko') await expect(bot.locator('.user-log h2')).not.toContainText(/[가-힣]/)
    await expect(bot.locator('.nfxb-bigval').first()).toHaveText('+99.777%')
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.screenshot({ path: info.outputPath('supplied-bot-source.png'), fullPage: true })
  await bot.locator('.nfx-bc button').click()
  await expect(page.locator('.native-trading-workspace')).toBeVisible()
  expect(await page.evaluate(() => Reflect.get(window, 'accountChartNode') === document.querySelector('.cp-surface'))).toBe(true)
})

test('복기 인과·chip·기간 링·통계·연결은 원본문서 구조와 정확한 표시값을 보존한다', async ({ page }, info) => {
  await mount(page, true, true)
  await openBot(page)
  await page.locator('.client-user-strategy .nfx-row.lk').click()
  const review = page.locator('[data-native-account-document="review-a"]')
  await expect(review.locator('.nfxr-hero.loss')).toContainText('-7.123456%')
  await expect(review.locator('.nfxr-chip')).toHaveCount(2)
  await expect(review.locator('.nfxr-step')).toHaveCount(2)
  await expect(review.locator('.nfxr-steps')).toContainText('공개 확정 청산 조건')
  await review.getByRole('button', { name: '기간 보고서', exact: true }).click()
  const periodic = page.locator('[data-native-account-document="period-a"]')
  await expect(periodic.locator('.nfxr-ring')).toHaveText('42.125%')
  await expect(periodic.locator('.nfxr-stats')).toContainText('0.0177 TOKEN')
  await expect(periodic.locator('.nfx-hero')).toContainText('+17.123%')
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.screenshot({ path: info.outputPath('supplied-periodic-source.png'), fullPage: true })
  await periodic.locator('.nfx-row.lk').click()
  await expect(page.locator('[data-native-account-document="review-a"]')).toBeVisible()
})

test('원본 PLAN 상태·게이지·정산·채널과 비동기 실패·중복·owner 격리를 유지한다', async ({ page }, info) => {
  await mount(page, true, true)
  await page.getByRole('button', { name: 'PLAN', exact: true }).click()
  const plan = page.locator('.native-service-plan')
  await expect(plan.locator('.nfx-grid2 > .nfx-card')).toHaveCount(2)
  await expect(plan.locator('.nfx-hero')).toContainText('계약 표시값')
  await expect(plan.locator('.nfx-gfill')).toHaveAttribute('style', 'width: 37.125%;')
  await page.evaluate(() => { Reflect.get(window, 'accountAudit').mode = 'reject' })
  await plan.getByRole('button', { name: '연결 요청', exact: true }).click()
  await expect(plan.getByRole('alert')).toBeVisible()
  await expect(plan).not.toContainText('RAW_PRIVATE_DIAGNOSTIC')
  await page.evaluate(() => { Reflect.get(window, 'accountAudit').mode = 'hold'; const b = [...document.querySelectorAll<HTMLButtonElement>('.native-service-plan button')].find(b => b.textContent === '구독 요청')!; b.click(); b.click() })
  expect(await page.evaluate(() => Reflect.get(window, 'accountAudit').calls)).toEqual([['planAction', 'link'], ['planAction', 'upgrade']])
  await page.evaluate(() => Reflect.get(window, 'accountAudit').resolve())
  await expect(plan.locator('.nfx-hero')).toContainText('계약 표시값')
  await plan.locator('.nfx-tabs button').nth(1).click()
  await expect(plan.locator('.nfx-hero')).toContainText('123.456789 TOKEN')
  await expect(plan.locator('.nfx-metrics')).toContainText('0.123456%')
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.screenshot({ path: info.outputPath('supplied-plan-source.png'), fullPage: true })
  await plan.locator('.nfx-tabs button').nth(2).click()
  await expect(plan.locator('.nfx-preferences > section')).toHaveCount(2)
  await expect(plan.getByRole('switch', { name: '이메일 채널' })).not.toBeChecked()
  await page.evaluate(() => Reflect.get(window, 'setAccountOwner')('owner-b'))
  await expect(plan).not.toContainText('계약 표시값')
  await expect(plan.getByRole('switch')).toHaveCount(0)
})

test('미공급 전용본문도 구조를 유지하고 owner가 바뀐 늦은 읽음은 문서로 이동하지 않는다', async ({ page }) => {
  await mount(page)
  await page.locator('.client-account-bell').click()
  await page.evaluate(() => { Reflect.get(window, 'accountAudit').mode = 'hold' })
  await page.locator('[data-native-account-alerts] .nf-item:not(.read)').click()
  await page.evaluate(() => Reflect.get(window, 'setAccountOwner')('owner-b'))
  await expect(page.locator('.native-trading-workspace')).toHaveAttribute('data-account-identity', '')
  await page.evaluate(() => Reflect.get(window, 'accountAudit').resolve())
  await expect(page.locator('.native-service-plan')).toHaveCount(0)
  await page.getByRole('button', { name: 'PLAN', exact: true }).click()
  await expect(page.locator('.native-service-plan .nfx-grid2 > section')).toHaveCount(2)
  await expect(page.locator('.native-service-plan')).not.toContainText('PRO')
  await page.evaluate(() => Reflect.get(window, 'accountNavigate')({ kind: 'bot', id: 'a' }))
  await expect(page.locator('.nfxb-mcard')).toHaveCount(3)
  await expect(page.locator('.nfxb-chart')).toBeVisible()
  await expect(page.locator('.nfxb-spark')).toHaveCount(0)
  await expect(page.locator('.nfxl-ev')).toHaveCount(0)
})
