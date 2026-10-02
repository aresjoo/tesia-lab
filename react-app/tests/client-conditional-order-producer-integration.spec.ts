import { expect, test, type Page } from '@playwright/test'
import { delegationRecommendedParameters, evaluateDelegation } from '../src/client-delegation-engine'

const owner = 'producer-entry@example.test'
const strategyKey = `teth-client-user-strategies:${encodeURIComponent(owner)}`
const parameters = delegationRecommendedParameters(), verified = evaluateDelegation(parameters, 10000000)
const record = { id: '1000', createdAt: 1000, name: '기존 사용자 연구', status: 'ready', environment: 'paper', parameters,
  score: verified.score, ret: verified.result.ret, mdd: verified.result.mdd, n: verified.result.n, winRate: verified.result.winRate,
  asset: '이더리움', exchangeId: 'okx', exchangeName: 'OKX', chartSymbol: 'BINANCE:ETHUSDT', capital: 10000000, version: 'v1.0' }

async function open(page: Page) {
  await page.addInitScript(({ owner, strategyKey, record }) => {
    if (sessionStorage.getItem('producer-entry-seeded')) return
    sessionStorage.setItem('producer-entry-seeded', '1')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '원본 입력 검수', email: owner }))
    // No completed answer, ORDER tag or pending question is seeded. Both turns
    // below must come from the real Main composer and its local Mock producer.
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: null, sessions: [], homeDraft: '', sharedFollows: [] }))
    sessionStorage.setItem(strategyKey, JSON.stringify([{ sessionId: 'retained-research', record }]))
    sessionStorage.setItem('teth-app-banner-dismissed', '1'); localStorage.setItem('tethLang', 'ko')
  }, { owner, strategyKey, record })
  await page.goto('/')
  await expect(page.locator('#strategy-idea')).toBeVisible()
  expect(await page.evaluate(async owner => {
    const path = '/src/client-user-strategy-store.ts', module = await import(/* @vite-ignore */ path)
    const snapshot = module.createClientUserStrategyStore(owner).getSnapshot()
    return { entries: snapshot.entries.length, storageError: snapshot.storageError }
  }, owner)).toEqual({ entries: 1, storageError: false })
}
const card = (page: Page) => page.locator('.client-conditional-order')
const experience = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!))

test('실제 composer 자연어→TTL 질문→7일→원본 한 문장과 카드→대기→reload이며 기존 전략을 보존한다', async ({ page }) => {
  const writes: string[] = []
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.method()) })
  await open(page)
  const before = await page.evaluate(key => sessionStorage.getItem(key), strategyKey)
  const question = '비트코인 9만 달러 되면 전부 팔아줘'
  await page.locator('#strategy-idea').fill(question)
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.locator('.g-scroll')).toContainText('예약을 언제까지 유지할까요?')
  await expect(card(page)).toHaveCount(0)
  const first = (await experience(page)).sessions[0]
  expect(first.turns.at(-1).conditionalOrderPending.asking).toBe('ttl')
  expect(first.turns.at(-1).question).toBe(question)
  await page.getByRole('button', { name: '7일', exact: true }).click()
  await expect(card(page)).toHaveCount(1)
  await expect(page.locator('.g-scroll')).toContainText('조건을 확인했습니다. 아래에서 예약합니다.')
  await expect(page.locator('.g-scroll')).not.toContainText('[ORDER')
  await expect(card(page)).toContainText('BTC가 $90,000')
  await expect(card(page)).toContainText('7일 동안')
  const completed = (await experience(page)).sessions[0].turns.at(-1)
  expect(completed.status).toBe('done'); expect(completed.conditionalOrderOwner).toBe(owner)
  expect(completed.fullAnswer.split('\n')[0]).toBe('조건을 확인했습니다. 아래에서 예약합니다.')
  expect(completed.fullAnswer).toContain('[ORDER ')
  const id = await card(page).getAttribute('data-order-id')
  await card(page).getByRole('button', { name: '예약하기', exact: true }).click()
  await expect(card(page)).toHaveClass(/wait/)
  await page.reload()
  await expect(card(page)).toHaveCount(1)
  await expect(card(page)).toHaveAttribute('data-order-id', id!)
  await expect(card(page)).toHaveClass(/wait/)
  expect(await page.evaluate(key => sessionStorage.getItem(key), strategyKey)).toBe(before)
  expect(writes).toEqual([])
})

test('지원하지 않는 예약 조건은 원 사용자 문장을 유지하며 카드·예약 저장·실제 요청을 만들지 않는다', async ({ page }) => {
  const writes: string[] = []
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.method()) })
  await open(page)
  const before = await page.evaluate(key => sessionStorage.getItem(key), strategyKey)
  const question = '비트코인 원화 9만 원 되면 전부 팔아줘, 7일'
  await page.locator('#strategy-idea').fill(question)
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.locator('.g-umsg')).toContainText(question)
  await expect(page.locator('.g-scroll')).toContainText('현재 예약 미리보기에서 지원하지 않습니다.')
  await expect(card(page)).toHaveCount(0)
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('teth:mock:conditional-orders:'))
    .flatMap(key => JSON.parse(sessionStorage.getItem(key)!).orders))).toEqual([])
  expect(await page.evaluate(key => sessionStorage.getItem(key), strategyKey)).toBe(before)
  expect(writes).toEqual([])
})
