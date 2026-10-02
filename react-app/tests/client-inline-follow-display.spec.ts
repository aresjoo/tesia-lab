import { expect, test, type Page } from '@playwright/test'
import { prepareSharedCopy } from '../src/client-shared-copy'
import { sourceSharedStrategies } from '../src/client-shared-strategies'

const owner = 'inline-follow-display@example.test'
const followId = 'legacy-inline-follow'
const sessionId = 'legacy-inline-follow-session'
const confirmedAt = 1_700_000_000_000
const source = sourceSharedStrategies()[0]
const originalRecord = {
  id: followId,
  owner,
  nick: source.nick,
  asset: source.asset,
  parameters: source.parameters,
  budgetIndex: 1,
  confirmedAt,
  sessionId,
  active: true,
}
const previous = {
  id: 'inline-follow-previous', title: '기존 대화', renamed: true, idea: '기존 질문', draft: '기존 초안',
  pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%',
  workspace: 'conversation', researchStatus: '초안', tradingReady: false, turns: [], inlineResults: [], updatedAt: 1,
}
const attached = {
  ...previous,
  id: sessionId,
  title: `${source.nick} · ${source.asset}`,
  idea: `${source.nick} (${source.asset}) 전략 따라하기`,
  draft: '',
  workspace: 'delegation',
  updatedAt: confirmedAt,
  sharedCopy: { owner, nick: source.nick, confirmedAt, active: true, followId, returnId: previous.id },
}
const prepared = prepareSharedCopy({ nick: source.nick, budgetIndex: 1, sl: source.parameters.sl, tp: source.parameters.tp }, confirmedAt).ui
const inlineParameters = {
  ...source.parameters,
  sl: source.parameters.sl === -12 ? -3 : -12,
  tp: source.parameters.tp === 15 ? 8 : 15,
  rsiTh: source.parameters.rsiTh === 38 ? 44 : 38,
  trendFilter: !source.parameters.trendFilter,
}
const legacyInlineUi = {
  ...prepared,
  page: 'connect',
  workStep: 5,
  workStartedAt: undefined,
  parameters: inlineParameters,
  pendingParameters: undefined,
  inlineResult: true,
  inlineTurnId: 'stale-inline-turn',
  answers: { ...prepared.answers, budget: { index: 3, label: '3,000만원 이상', recommended: false } },
}

test.beforeEach(({ page }) => page.setDefaultTimeout(15_000))

async function continueAfterIntro(page: Page) {
  const intro = page.getByRole('dialog', { name: '이 전략을 따라하려면 연결이 필요해요', exact: true })
  const settings = page.getByRole('dialog', { name: '전략 따라하기', exact: true })
  await expect(intro.or(settings).first()).toBeVisible()
  if (await intro.isVisible()) await intro.getByRole('button', { name: '나중에 하기', exact: true }).click()
  await expect(settings).toBeVisible()
  return settings
}

test('active follow의 legacy inline cache는 원본 조건 표시와 같은 record 재검증을 바꾸지 않는다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, previous, attached, originalRecord, sessionId, legacyInlineUi }) => {
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '인라인 팔로우 검수자', email: owner }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({
      currentId: previous.id,
      homeDraft: '홈 초안 보존',
      sessions: [previous, attached],
      sharedFollows: [originalRecord],
    }))
    sessionStorage.setItem(`teth:client-delegation:${sessionId}`, JSON.stringify(legacyInlineUi))
    localStorage.setItem('tethLang', 'ko')
  }, { owner, previous, attached, originalRecord, sessionId, legacyInlineUi })

  await page.goto('/#/share')
  await page.evaluate(() => { location.hash = '#/share/library' }); await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  const card = page.locator(`[data-follow-id="${followId}"]`)
  await expect(card).toBeVisible()
  await expect(card.locator('.ss3-follow-setting')).toHaveText([
    `손절 ${source.parameters.sl}%`,
    `익절 +${source.parameters.tp}%`,
    '예산 500만원',
  ])
  await expect(card).not.toContainText(`손절 ${inlineParameters.sl}%`)
  await expect(card).not.toContainText(`익절 +${inlineParameters.tp}%`)
  await expect(card).not.toContainText('예산 3,000만원 이상')

  await card.getByRole('button', { name: '설정 변경', exact: true }).click()
  const settings = await continueAfterIntro(page)
  await expect(settings.getByRole('combobox', { name: '시작 예산', exact: true })).toHaveValue('1')
  await expect(settings.getByRole('combobox', { name: '손절선', exact: true })).toHaveValue(String(source.parameters.sl))
  await expect(settings.getByRole('combobox', { name: '익절 목표', exact: true })).toHaveValue(String(source.parameters.tp))
  await settings.getByRole('button', { name: '다음: 예상 결과 보기', exact: true }).click()
  await page.getByRole('button', { name: '확정하고 검증 시작', exact: true }).click()

  await expect(page.getByRole('heading', { name: '검증 진행', exact: true })).toBeVisible()
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!))
  const next = saved.sharedFollows.find((record: { id: string }) => record.id === followId)
  expect(next).toMatchObject({ id: followId, owner, nick: source.nick, asset: source.asset, parameters: source.parameters, budgetIndex: 1, active: true })
  expect(next.sessionId).not.toBe(sessionId)
  expect(saved.currentId).toBe(next.sessionId)
  expect(saved.sessions.some((session: { id: string }) => session.id === sessionId)).toBe(true)
  expect(saved.sessions.find((session: { id: string }) => session.id === previous.id)?.draft).toBe(previous.draft)
})
