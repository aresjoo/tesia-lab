import { expect, test } from '@playwright/test'

test('위임 계산 스냅샷은 적용/대기 설정을 분리하고 손상 구간은 검증으로 복귀한다', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const path = '/src/client-delegation-fixtures.ts'
    const store = await import(path)
    const p = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: 1334 }
    const base = { page: 'connect', answers: Object.fromEntries(['asset', 'style', 'budget', 'period', 'stop'].map(key => [key, { index: 1 }])), questionIndex: 5, attempt: 0, workStep: 5, workStartedAt: 10, expert: false, chartInterval: '1D', parameters: p }
    const read = (id: string, snapshot: unknown) => {
      sessionStorage.setItem(`teth:client-delegation:${id}`, JSON.stringify(snapshot))
      return store.readDelegationUi(id)
    }
    const firstPass = read('first-pass', base)
    const pending = read('pending', { ...base, workStep: 2, pendingParameters: { ...p, sl: -3 }, parameters: { ...p, privateField: 'must-not-copy' } })
    const invalid = [-1, 60, 1335, 999999, 61.5].map((bound, i) => read(`invalid-${i}`, { ...base, parameters: { ...p, [i < 2 ? 'startI' : 'endI']: bound } }))
    invalid.push(read('reverse', { ...base, parameters: { ...p, startI: 600, endI: 400 } }))
    invalid.push(read('invalid-pending', { ...base, pendingParameters: { ...p, endI: 999999 } }))
    const oldRaw = sessionStorage.getItem('teth:client-delegation:invalid-3')
    const saved = store.saveDelegationUi('roundtrip', { ...base, pendingParameters: { ...p, sl: -3 } })
    const roundtrip = store.readDelegationUi('roundtrip')
    const before = sessionStorage.getItem('teth:client-delegation:roundtrip')
    const rejected = store.saveDelegationUi('roundtrip', { ...base, parameters: { ...p, endI: 999999 } })
    return { firstPass, pending, invalid, oldRaw, saved, roundtrip, rejected, preserved: before === sessionStorage.getItem('teth:client-delegation:roundtrip') }
  })
  expect(result.firstPass).toMatchObject({ page: 'connect', attempt: 0, workStep: 5 })
  expect(result.pending).toMatchObject({ parameters: { sl: -5 }, pendingParameters: { sl: -3 }, workStep: 2 })
  expect(JSON.stringify(result.pending)).not.toContain('must-not-copy')
  for (const [index, snapshot] of result.invalid.entries()) {
    expect(snapshot).toMatchObject({ page: 'intake', workStep: 0, questionIndex: 5, recoveryRequired: true })
    if (index < result.invalid.length - 1) expect(snapshot.parameters).toBeUndefined()
    else expect(snapshot.parameters).toMatchObject({ startI: 61, endI: 1334 })
    expect(snapshot.pendingParameters).toBeUndefined()
    expect(snapshot.workStartedAt).toBeUndefined()
  }
  expect(result.oldRaw).toContain('999999')
  expect(result.saved).toBe(true)
  expect(result.roundtrip).toMatchObject({ parameters: { sl: -5 }, pendingParameters: { sl: -3 } })
  expect(result.rejected).toBe(false)
  expect(result.preserved).toBe(true)
})

test('범위 밖 저장 구간으로 앱에 복귀해도 실패 화면 대신 같은 답변을 재검증한다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(() => {
    const id = 'damaged-source-window'
    const turn = { id: 'turn', question: '반등 전략', answer: '계획', fullAnswer: '계획', startedAt: 1, status: 'done', suggestions: [], phase: 'plan' }
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{ id, title: '저장 구간 복구', idea: '비트코인 반등', draft: '', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'delegation', researchStatus: '초안', turns: [turn], updatedAt: 1 }] }))
    sessionStorage.setItem(`teth:client-delegation:${id}`, JSON.stringify({ page: 'connect', answers: Object.fromEntries(['asset', 'style', 'budget', 'period', 'stop'].map(key => [key, { index: 1 }])), attempt: 1, workStep: 5, chartInterval: '1D', parameters: { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: 999999 } }))
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '전략 계약서', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('기존 기록은 보존')
  await page.getByRole('button', { name: '전략 검증 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '추천 설정으로 다시 검증', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '무료로 시작', exact: true })).toHaveCount(0)
  expect(errors).toEqual([])
})
