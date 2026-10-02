// Explicit owner-bound Mock supplier tests for the common response branch.
// Fresh supplier-free source intake is covered by offline source journey specs.
import { installCommonResponseFixture } from './fixtures/client-common-response-fixture'
import { expect, test, type Page } from '@playwright/test'
import { intakePercentage, intakeWithoutTake, namedIntakePercentages } from '../src/client-intake-input'

test.beforeEach(async ({ page }) => {
  await installCommonResponseFixture(page, 'intake-common@example.test')
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '입력 공급 검수', email: 'intake-common@example.test' })))
})

test('표시용 intake도 부분 숫자·비유한 값·명명 충돌을 임의 해석하지 않는다', () => {
  for (const [text, expected] of [
    ['BTC 반등 손절 12%, 익절 2.5%', { risk: 12, take: 2.5 }],
    ['2.5% 손절, 18% 익절', { risk: 2.5, take: 18 }],
    ['손절 2% 익절 8%', { risk: 2, take: 8 }],
    ['손절은 ２．５％', { risk: 2.5 }],
    ['BTC 반등 손절 12%인데 요즘 불안해서요', { risk: 12 }],
    ['편안하게 BTC 반등 익절 8%', { take: 8 }],
    ['익절은 안 할래요, 손절 12%', { risk: 12 }],
  ] as const) expect(namedIntakePercentages(text), text).toEqual(expected)
  for (const text of ['손절 3%에서 2%로', '손절 12%로 하지 마세요', '손절 2..5%', '손절 1,000%', '1,000% 손절', '손절 2%%', '손절 --2%', '손절 1e-999%', '손절 Infinity%', '손절 2%, 손절 5%', '비중 10% 손절 2%', '손절 2% 말고 익절 8%', '손절 2% 안함', '손절 2%에서 3으로']) {
    expect(namedIntakePercentages(text), text).toEqual({})
    expect(intakePercentage(text, 'risk'), text).toBeUndefined()
  }
  expect(intakePercentage('12%', 'risk')).toBe(12)
  expect(intakePercentage('2.5', 'risk')).toBe(2.5)
  expect(intakePercentage('손절 -2.5%로', 'risk')).toBe(2.5)
  expect(intakePercentage('익절 +18% 설정', 'take')).toBe(18)
  expect(intakePercentage('익절 8%', 'risk')).toBeUndefined()
  expect(intakePercentage('손절 2% 익절 8%', 'risk')).toBeUndefined()
  expect(intakeWithoutTake('익절 없이 진행')).toBe(true)
  expect(intakeWithoutTake('익절 없이 진행하지 마세요')).toBe(false)
  expect(namedIntakePercentages('익절 -8%')).toEqual({})
  expect(intakePercentage('익절 -8%', 'take')).toBeUndefined()
  expect(intakePercentage('-8', 'take')).toBeUndefined()
  // Explicit values remain draft intent; this parser must not invent risk limits.
  expect(namedIntakePercentages('손절 0%, 익절 1000%')).toEqual({ risk: 0, take: 1000 })
})

// Client-authored intake preview only. Native interpretation belongs to the SDK/server.
const read = (page: Page) => page.evaluate(() => {
  const state = JSON.parse(sessionStorage.getItem('teth-client-experience')!)
  return state.sessions.find((session: { id: string }) => session.id === state.currentId)
})
async function ask(page: Page, text: string, home = false) {
  if (!home) await expect.poll(async () => await page.locator('.gcl').isVisible() || await page.locator('.g-composer textarea').isVisible()).toBe(true)
  // The latest source question dock replaces the composer. Use its actual
  // direct-answer affordance instead of filling the hidden textarea.
  if (!home && await page.locator('.gcl').isVisible()) {
    await page.getByRole('button', { name: '직접 답변 작성', exact: true }).click()
    await page.locator('.gcl input').fill(text)
    await page.locator('.gcl input').press('Enter')
    await page.clock.fastForward(15_000)
    return
  }
  const input = page.locator(home ? '#strategy-idea' : '.g-composer textarea')
  await input.fill(text)
  await input.press('Enter')
  await page.clock.fastForward(15_000)
}

test('첫 문장의 손절·익절 숫자를 절삭하지 않고 중복 질문 없이 계획으로 이어진다', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await ask(page, 'BTC 반등 1시간봉 손절 12%, 익절 2.5%', true)
  expect(await read(page)).toMatchObject({ pair: 'BTC/USDT', timeframe: '1시간봉', risk: '−12%', takeProfit: '+2.5%', phase: 'plan' })
  await expect(page.locator('.g-umsg')).toHaveText('BTC 반등 1시간봉 손절 12%, 익절 2.5%')
})

for (const start of ['반등할 때 사고 싶어', 'BTC 반등 1시간봉']) {
  test(`후속 문장의 명명된 두 수치는 질문 순서와 무관하게 보존한다: ${start}`, async ({ page }) => {
    await page.clock.install()
    await page.goto('/')
    await ask(page, start, true)
    await ask(page, 'BTC 1시간봉 손절 12%, 익절 2.5%')
    expect(await read(page)).toMatchObject({ risk: '−12%', takeProfit: '+2.5%', phase: 'plan' })
    await expect(page.locator('.g-amsg[data-response-state]').last()).toContainText('말씀하신 손절 -12%와 익절 +2.5%는 그대로 반영해두겠습니다.')
  })
}

for (const value of ['12%', '2.5%']) {
  test(`자유 입력 ${value}는 수치를 보존하고 익절 자유 입력도 같은 단계로 이어진다`, async ({ page }) => {
    await page.clock.install()
    await page.goto('/')
    await ask(page, 'BTC 반등 1시간봉', true)
    await ask(page, value)
    expect(await read(page)).toMatchObject({ risk: `−${value}`, phase: 'take' })
    await ask(page, '익절 +18% 설정')
    expect(await read(page)).toMatchObject({ risk: `−${value}`, takeProfit: '+18%', phase: 'plan' })
  })
}

for (const method of ['chip', 'text'] as const) {
  test(`추천 ${method}는 자산·주기의 현재 단계를 구별하고 reload 후에도 이어진다`, async ({ page }) => {
    await page.clock.install()
    await page.goto('/')
    await ask(page, '반등할 때 사고 싶어', true)
    const recommend = async () => {
      if (method === 'text') await ask(page, '추천')
      else {
        await expect(page.getByRole('button', { name: '이 질문 건너뛰기 (추천값으로 진행)', exact: true })).toBeVisible()
        await page.getByRole('button', { name: '이 질문 건너뛰기 (추천값으로 진행)', exact: true }).click()
        await page.clock.fastForward(15_000)
      }
    }
    await page.reload()
    await recommend()
    expect(await read(page)).toMatchObject({ pair: 'BTC/USDT', timeframe: '', phase: 'timeframe' })
    await page.reload()
    await recommend()
    expect(await read(page)).toMatchObject({ pair: 'BTC/USDT', timeframe: '1시간봉', phase: 'risk' })
    const labels = method === 'chip'
      ? ['이 질문 건너뛰기 (추천값으로 진행): AI 추천으로', '이 질문 건너뛰기 (추천값으로 진행): AI 추천으로']
      : ['추천', '추천']
    await expect(page.locator('.g-umsg')).toHaveText(['반등할 때 사고 싶어', ...labels])
    await expect(page.locator('.g-amsg').last()).toContainText('반등형 조건에는 1시간봉이 균형점입니다.')
  })
}

test('모호한 수치·부정문은 원 수치와 단계를 유지하며 선택지를 다시 안내한다', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await ask(page, 'BTC 반등 1시간봉 손절 3%에서 2%로 바꾸지 마세요', true)
  expect(await read(page)).toMatchObject({ risk: '', phase: 'risk' })
  for (const text of ['손절 12%로 하지 마세요', '2..5%', '3%에서 2%로 변경해주세요', '손절 1e-999%']) {
    await ask(page, text)
    expect(await read(page)).toMatchObject({ risk: '', takeProfit: '', phase: 'risk' })
    await expect(page.locator('.g-amsg').last()).toContainText('아래에서 골라주세요.')
  }
  await ask(page, '익절 8%')
  expect(await read(page)).toMatchObject({ risk: '', takeProfit: '+8%', phase: 'risk' })
})
