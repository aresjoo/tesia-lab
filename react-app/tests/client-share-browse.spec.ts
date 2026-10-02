import { expect, test, type Page } from '@playwright/test'
import type { ClientSession, ClientTurn } from '../src/client-experience-store'
import { shareBrowseLabel, shareBrowseTurnId } from '../src/client-share-browse'
import { inlineInput } from '../src/client-inline-backtest'

const key = 'teth-client-experience', draft = '보내지 않은 나의 질문', owner = 'share-browse@example.test'
function turn(id: string, question = '다른 사람 전략 추천해줘', status: ClientTurn['status'] = 'done'): ClientTurn {
  return { id, question, answer: status === 'done' ? '공유 전략에서 조건을 비교할 수 있어요.' : '', fullAnswer: '공유 전략에서 조건을 비교할 수 있어요.',
    status, phase: 'plan', suggestions: [], startedAt: 1700000000000, finishedAt: status === 'done' ? 1700000001000 : undefined }
}
function session(turns = [turn('first'), turn('second')]): ClientSession {
  return { id: 'share-conversation', title: '공유 탐색 검수', renamed: true, idea: '다른 전략 알아보기', draft, pair: 'BTC/USDT', mode: 'dip',
    timeframe: '1시간봉', risk: '-3%', takeProfit: '+8%', phase: 'plan', researchStatus: '초안', workspace: 'conversation', tradingReady: false,
    updatedAt: 1700000001000, turns }
}
async function setup(page: Page, initial = session(), controlledTime = false) {
  await page.clock.install({ time: new Date('2026-09-20T12:00:00Z') })
  // Let lazy imports/timers mount while wall time cannot finish the response.
  if (controlledTime) await page.clock.setFixedTime(new Date('2026-09-20T12:00:00Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ initial, key, owner }) => {
    if (sessionStorage.getItem('share-browse-seeded')) return
    sessionStorage.setItem('share-browse-seeded', 'true'); localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '공유 검수', email: owner }))
    localStorage.setItem(`teth-sharing-preferences:account:${encodeURIComponent(owner)}`, JSON.stringify({ tab: 'mine', sort: 'ret', dir: 'desc', asset: 'all' }))
    sessionStorage.setItem(key, JSON.stringify({ currentId: initial.id, sessions: [initial], homeDraft: '', sharedFollows: [] }))
  }, { initial, key, owner })
  await page.goto('/')
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  if (controlledTime) {
    await page.clock.pauseAt(new Date('2026-09-20T12:00:00.050Z'))
    await page.clock.setSystemTime(new Date('2026-09-20T12:00:00.050Z'))
  }
}
const chip = (page: Page) => page.locator('.client-share-browse')
const saved = (page: Page): Promise<ClientSession> => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).sessions[0], key)

test('원본 탐색 의도만 인식하며 최초 완료 턴 하나에만 결속한다', () => {
  for (const question of ['전략 추천해줘', '다른 사람들의 전략', '카피트레이딩 알아보기', '고수 전략 따라 해보고 싶어'])
    expect(shareBrowseTurnId([turn('first', question), turn('second', question)])).toBe('first')
  for (const question of ['오늘 비트코인 가격이 왜 올랐어?', '내 전략 손절을 3%로 수정', '전략. 다음에는 추천해줘'])
    expect(shareBrowseTurnId([turn('first', question)])).toBeUndefined()
  expect(shareBrowseTurnId([turn('stopped', undefined, 'stopped'), turn('failed', undefined, 'failed'), turn('running', undefined, 'running')])).toBeUndefined()
})

test('과거검증 입력은 원본 SETUP이 아니므로 공유 탐색 진입을 제거하지 않는다', () => {
  const initial = session([turn('first')]); initial.turns[0].inlineRequest = inlineInput(initial)
  expect(initial.turns[0].inlineRequest).toBeDefined()
  expect(shareBrowseTurnId(initial.turns)).toBe('first')
})

test('질문 전송 없이 find로 이동하고 원문·초안·한 개의 진입점을 복원한다', async ({ page }, info) => {
  const posts: string[] = []; page.on('request', r => { if (r.method() === 'POST') posts.push(r.url()) })
  await setup(page)
  await expect(chip(page)).toHaveCount(1); await expect(chip(page)).toHaveAttribute('data-turn-id', 'first')
  const before = await saved(page)
  await chip(page).getByRole('button', { name: '공유 전략 둘러보기', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/share$/)
  await expect(page.locator('.ss3-tabs')).toHaveCount(0)
  await expect(page.locator('.strategy-list-card').first()).toBeVisible()
  await expect(page.locator('.client-sharing-hub')).toBeVisible()
  expect((await saved(page)).turns).toEqual(before.turns); expect((await saved(page)).draft).toBe(draft)
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await expect(chip(page)).toHaveCount(1)
  await page.reload()
  await expect(chip(page)).toHaveCount(1); await expect(chip(page)).toHaveAttribute('data-turn-id', 'first')
  expect((await saved(page)).turns).toEqual(before.turns)
  await page.screenshot({ path: info.outputPath('share-browse-restored.png'), fullPage: true })
  expect(posts).toEqual([])
})

test('응답 진행 중에는 보이지 않고 완료 후 나타나며 다음 질문에 중복되지 않는다', async ({ page }) => {
  const initial = session([turn('first', undefined, 'running')]); initial.turns[0].startedAt = new Date('2026-09-20T12:00:00Z').getTime()
  await setup(page, initial, true)
  await expect(chip(page)).toHaveCount(0)
  await page.clock.fastForward(10000)
  await expect(chip(page)).toHaveCount(1)
  const input = page.locator('.g-composer textarea')
  await input.fill('다른 사람 전략 찾아줘'); await input.press('Enter'); await page.clock.fastForward(10000)
  await expect(chip(page)).toHaveCount(1); await expect(chip(page)).toHaveAttribute('data-turn-id', 'first')
})

test('탐색 의도가 없는 일반 대화에는 진입점을 삽입하지 않는다', async ({ page }) => {
  await setup(page, session([turn('first', '오늘 시장은 어때?')]))
  await expect(chip(page)).toHaveCount(0)
})

test('긴 대화에서 공유 탐색 후 돌아와도 읽던 위치와 초안을 보존한다', async ({ page }) => {
  const turns = Array.from({ length: 16 }, (_, index) => {
    const item = turn(`turn-${index}`, index === 5 ? '공유 전략 찾아줘' : `시장 질문 ${index}`)
    item.answer = item.fullAnswer = `시장 관측 ${index}\n\n` + '제공된 자료의 시점과 위험을 함께 살펴봅니다.\n\n'.repeat(5)
    return item
  })
  await setup(page, session(turns))
  await chip(page).scrollIntoViewIfNeeded()
  await page.clock.runFor(300)
  const before = await page.locator('.g-scroll').evaluate(el => el.scrollTop)
  expect(before).toBeGreaterThan(100)
  await chip(page).getByRole('button').click()
  await expect(page.locator('.client-sharing-hub')).toBeVisible()
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await expect.poll(() => page.locator('.g-scroll').evaluate((el, before) => Math.abs(el.scrollTop - before), before)).toBeLessThanOrEqual(40)
  expect((await saved(page)).turns).toEqual(turns)
})

test('320px·7언어에서 원본 버튼과 화살표를 유지하고 초안·DOM을 바꾸지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 760 }); await setup(page, session([turn('first')]))
  await chip(page).getByRole('button').evaluate(el => Reflect.set(window, 'shareBrowseButton', el))
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
    }, language)
    const button = chip(page).getByRole('button', { name: shareBrowseLabel(language), exact: true })
    await expect(button).toBeVisible()
    expect(await button.evaluate(el => el === Reflect.get(window, 'shareBrowseButton'))).toBe(true)
    await expect(button.locator('.ar')).toHaveText('→')
    const box = await button.boundingBox(); expect(box!.width).toBeGreaterThan(100); expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(320)
    expect(await button.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  }
  await page.screenshot({ path: info.outputPath('share-browse-fr-320.png'), fullPage: true })
})
