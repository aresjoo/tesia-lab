import { expect, test, type Page } from '@playwright/test'
import { CLIENT_RESEARCH_FIXTURE as fixture } from '../src/client-research-fixtures'
import { evaluateSourceTerminal } from '../src/client-terminal-source-fixture'
import { clientResearchRegistration } from '../src/client-research-registration'
import { createClientUserStrategyStore } from '../src/client-user-strategy-store'
import { MOCK_RESEARCH_ENTRIES } from '../src/mock-research-preview'

test('고정 연구 캡처·단계 로그·등록 수치는 최신 원본 MTM 계산 및 같은 봉 구간을 사용한다', () => {
  expect(fixture.source).toBe('aresjoo/tesia-lab@88d2043bad874d32025dfbb3c31419af86895945')
  for (const version of [0, 1] as const) {
    const result = evaluateSourceTerminal({ sl: -3, tp: 8, rsiTh: 40, trendFilter: version === 1, startI: 61, endI: 909 }, 1).r
    for (const key of ['ret', 'mdd', 'winRate', 'n', 'pf', 'byYear', 'cagr', 'trades', 'eq'] as const) expect(fixture.versions[version][key]).toEqual(result[key])
    expect(result.mdd).toBeCloseTo(version ? -7.4430310411 : -14.8439054175, 9)
  }
  expect(fixture.holdout.mdd).toBeCloseTo(-6.1403855349, 9)
  expect(MOCK_RESEARCH_ENTRIES.find(e => e.id === 'retest')!.summary).toContain('-14.8% → -7.4%')
  const input = clientResearchRegistration()
  expect(input).toMatchObject({ environment: 'paper', origin: 'research', version: 'v2.0', capital: 7000000, score: 94, parameters: { startI: 61, endI: 909 } })
  expect(input.mdd).toBe(fixture.versions[1].mdd)
})

test('연구 재진입은 중복·일시정지 해제·수정 상태 덮어쓰기를 하지 않고 계정을 분리한다', () => {
  const data = new Map<string, string>()
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
  const store = createClientUserStrategyStore('a', storage)
  const first = store.register('research', clientResearchRegistration(), 1000, { preserveExisting: true })
  const paused = store.control(first.id, 'pause')
  const repeated = store.register('research', { ...clientResearchRegistration(), name: '덮어쓰면 안 되는 이름' }, 2000, { preserveExisting: true })
  expect(repeated).toBe(paused)
  expect(store.getSnapshot().entries).toHaveLength(1)
  expect(createClientUserStrategyStore('a', storage).getSnapshot().entries[0].record).toEqual(paused)
  expect(createClientUserStrategyStore('b', storage).getSnapshot().entries).toHaveLength(0)
})

async function setup(page: Page, signed = true, active = 'run') {
  await page.addInitScript(({ signed, active }) => {
    const id = 'research-terminal'
    if (sessionStorage.getItem('research-terminal-seeded')) return
    sessionStorage.setItem('research-terminal-seeded', '1')
    localStorage.setItem('tethCurrency', 'KRW')
    if (signed) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '연구 검수', email: 'research@example.test' }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{ id, title: '연구 전략', idea: '비트코인 과매도 반등', draft: '대화 초안 보존', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'research', researchStatus: '검토 필요', turns: [], updatedAt: 1 }] }))
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({ seconds: 95, status: 'completed', view: 'activity', questions: [] }))
    sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({ active, tabs: ['report', active], drafts: { run: '실행 전 확인하던 질문' }, paper: active === 'live', paused: false }))
  }, { signed, active })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
}
async function registrations(page: Page) {
  return page.evaluate(() => {
    const key = Object.keys(sessionStorage).find(k => k.startsWith('teth-client-user-strategies:'))
    return key ? JSON.parse(sessionStorage.getItem(key)!) : []
  })
}
for (const signed of [true, false]) test(`연구 가상 시작→로그인 ${signed ? '유지' : '완료'}→AI 트레이딩, 뒤로가기·새로고침·재진입`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await setup(page, signed)
  await expect(page.locator('article')).toContainText('낙폭 -7.4%')
  await page.getByRole('button', { name: '실전 시작 (데모 잠금)', exact: true }).click()
  await expect(page.locator('.rw-notice')).toContainText('실제 자금 실행은 데모에서 잠겨 있어요')
  expect(await registrations(page)).toHaveLength(0)
  await page.getByRole('button', { name: '가상 검증으로 시작', exact: true }).click()
  if (!signed) {
    await expect(page.locator('.ca-auth')).toBeVisible()
    await page.locator('.au-btns button').first().click()
  }
  await expect(page).toHaveURL(/#\/trade$/)
  await expect(page.locator('#root')).not.toHaveAttribute('inert')
  const original = await registrations(page)
  expect(original).toHaveLength(1)
  expect(original[0].record).toMatchObject(clientResearchRegistration())
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', `user:${original[0].record.id}`)
  await expect(page.locator('.cst-close-chart')).toHaveAttribute('data-first-time', String(Date.parse('2023-03-04T00:00:00Z') / 1000))
  await expect(page.locator('.cst-close-chart')).toHaveAttribute('data-last-time', String(Date.parse('2025-06-29T00:00:00Z') / 1000))
  await expect(page.locator('.cst-close-chart')).toHaveAttribute('data-marker-count', '20')
  await expect(page.locator('.cat-context')).toContainText('BTC/USDT')
  await page.goBack()
  await expect(page.getByLabel('실행 확인에 질문')).toHaveValue('실행 전 확인하던 질문')
  await expect(page.getByRole('button', { name: 'AI 트레이딩에서 열기', exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'AI 트레이딩에서 열기', exact: true }).click()
  await expect(page).toHaveURL(/#\/trade$/)
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', `user:${original[0].record.id}`)
  expect(await registrations(page)).toEqual(original)
  expect(errors).toEqual([])
})

test('게스트 로그인 취소는 등록하지 않고 연구 문서와 작성 중 질문을 보존한다', async ({ page }) => {
  await setup(page, false)
  await page.getByRole('button', { name: '가상 검증으로 시작', exact: true }).click()
  await expect(page.locator('.ca-auth')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(page.getByLabel('실행 확인에 질문')).toHaveValue('실행 전 확인하던 질문')
  expect(await registrations(page)).toHaveLength(0)
  await page.reload()
  await expect(page.getByRole('button', { name: '가상 검증으로 시작', exact: true })).toBeVisible()
})

test('연구 전략 저장 실패는 알리고 메모리의 한 기록을 재시도해 보존한다', async ({ page }) => {
  await setup(page)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('teth-client-user-strategies:')) throw new Error('Injected storage write failure')
      original.call(this, key, value)
    }
    Object.assign(window, { restoreResearchStorage: () => { Storage.prototype.setItem = original } })
  })
  await page.getByRole('button', { name: '가상 검증으로 시작', exact: true }).click()
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  const warning = page.locator('.client-global-notice').filter({ hasText: '전략 기록을 이 브라우저에 저장하거나 불러오지 못했어요.' })
  await expect(warning).toBeVisible()
  expect(await registrations(page)).toHaveLength(0)
  await page.evaluate(() => (window as unknown as { restoreResearchStorage: () => void }).restoreResearchStorage())
  await warning.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(warning).toHaveCount(0)
  expect(await registrations(page)).toHaveLength(1)
  await page.reload()
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  expect(await registrations(page)).toHaveLength(1)
})

test('구 Live 캐시는 고정 수익과 별도 실행 제어를 복원하지 않으며 등록 없는 화면을 안내한다', async ({ page }) => {
  await setup(page, true, 'live')
  await expect(page.locator('article')).not.toContainText(/\+3\.2%|21일|Reality Check/)
  await expect(page.getByRole('button', { name: '일시 정지', exact: true })).toHaveCount(0)
  await expect(page.locator('article')).toContainText('연구 결과를 확인하고')
  await page.getByRole('button', { name: '실행 확인', exact: true }).click()
  await expect(page.getByRole('button', { name: '가상 검증으로 시작', exact: true })).toBeVisible()
  expect(await registrations(page)).toHaveLength(0)
})

test('사이드바 연구 재진입은 같은 문서와 질문으로 돌아오며 중지한 전략을 자동 재개하지 않는다', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: '가상 검증으로 시작', exact: true }).click()
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  await page.getByRole('button', { name: '중지', exact: true }).click()
  await expect(page.getByRole('button', { name: '재개', exact: true })).toBeVisible()
  await page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
  await page.locator('.client-session').filter({ hasText: '연구 전략' }).click()
  await expect(page.getByLabel('실행 확인에 질문')).toHaveValue('실행 전 확인하던 질문')
  await page.getByRole('button', { name: 'AI 트레이딩에서 열기', exact: true }).click()
  await expect(page.getByRole('button', { name: '재개', exact: true })).toBeVisible()
  expect((await registrations(page))[0].record.status).toBe('off')
})

test('재생 캐시 유실은 등록 상태를 초안으로 바꾸지 않고 Live에서 기존 터미널로 이어진다', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: '가상 검증으로 시작', exact: true }).click()
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  const record = (await registrations(page))[0].record
  await page.goBack()
  await page.evaluate(() => sessionStorage.removeItem('teth-research-preview:restored:research-terminal'))
  await page.reload()
  await expect(page.locator('.client-restored-research')).toBeVisible()
  const trigger = page.getByRole('button', { name: '연구 문서 열기', exact: true })
  if (await trigger.isVisible()) await trigger.click()
  await page.locator('.rw-artifact').filter({ hasText: /^LivePaper$/ }).click()
  await expect(page.locator('article')).toContainText('실행 상태와 성과는 터미널에서 확인하세요')
  await page.getByRole('button', { name: 'AI 트레이딩에서 열기', exact: true }).click()
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', `user:${record.id}`)
  const state = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions[0])
  expect(state.researchStatus).toBe('검토 필요')
  expect((await registrations(page))[0].record).toEqual(record)
})

test('연구 실행 확인과 자산 곡선은 좁은 화면에도 넘치거나 잘리지 않는다', async ({ page }) => {
  await setup(page)
  await expect(page.locator('.g-row').filter({ has: page.locator('.k', { hasText: /^검증$/ }) })).toContainText('Holdout 통과')
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  const trigger = page.getByRole('button', { name: '연구 문서 열기', exact: true })
  if (await trigger.isVisible()) await trigger.click()
  await page.locator('.rw-artifact').filter({ hasText: /^백테스트 v2$/ }).click()
  const svg = page.getByRole('img', { name: '백테스트 v2 자산 곡선' })
  await expect(svg).toHaveAttribute('data-first-bar', '61')
  await expect(svg).toHaveAttribute('data-last-bar', '909')
  const geometry = await svg.evaluate(element => {
    const height = (element as SVGSVGElement).viewBox.baseVal.height
    return { height, ys: [...element.querySelectorAll('path')].flatMap(path => [...path.getAttribute('d')!.matchAll(/[ML][\d.]+ ([\d.-]+)/g)].map(match => Number(match[1]))) }
  })
  expect(Math.min(...geometry.ys)).toBeGreaterThanOrEqual(0)
  expect(Math.max(...geometry.ys)).toBeLessThanOrEqual(geometry.height)
})
