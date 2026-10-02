import { expect, test, type Locator, type Page } from '@playwright/test'
import { evaluateDelegation } from '../src/client-delegation-engine'
import { clientUserStrategyKey } from '../src/client-user-strategy-store'
import type { SourceUserStrategyRecord } from '../src/client-user-strategy'
import { clientStrategyCreatorKey } from '../src/client-strategy-creator-store'

const owner = 'creator-a@example.test', otherOwner = 'creator-b@example.test'
const parameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: 1334 }
const evaluation = evaluateDelegation(parameters, 5000000)
const base = { parameters, score: evaluation.score, ret: evaluation.result.ret, mdd: evaluation.result.mdd, n: evaluation.result.n, winRate: evaluation.result.winRate, status: 'ready' as const, environment: 'paper' as const, capital: 5000000, exchangeId: 'binance', exchangeName: 'Binance', version: 'v1.0' }
const records: SourceUserStrategyRecord[] = [
  { ...base, id: '17001', createdAt: 17001, name: '같은 이름 전략', asset: '비트코인' },
  { ...base, id: '17002', createdAt: 17002, name: '같은 이름 전략', asset: '이더리움' },
  { ...base, id: '17003', createdAt: 17003, name: '기준 미달 전략', asset: '나스닥', parameters: null, score: 79 },
  { ...base, id: '17004', createdAt: 17004, name: '이전 기록 <보존 & 확인>', asset: '비트코인', parameters: null, score: 81, ret: 7.125, mdd: -4.25, n: 23, winRate: 61.5 },
]
const entries = records.map(record => ({ sessionId: `creator-session-${record.id}`, record }))
const registrationBytes = JSON.stringify(entries)
const original = { id: 'creator-prior-chat', title: '기존 대화', renamed: true, idea: '기존 질문', draft: '전송하지 않은 초안', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'conversation', researchStatus: '초안', tradingReady: false, turns: [], updatedAt: 1 }
test.beforeEach(({ page }) => { page.setDefaultTimeout(15000) })

async function setup(page: Page, signed = true) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, otherOwner, original, signed, entries }) => {
    if (sessionStorage.getItem('creator-fixture-initialized')) return
    sessionStorage.setItem('creator-fixture-initialized', '1')
    if (signed) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '제작자 검수자', email: owner }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: original.id, homeDraft: '보존할 홈 초안', sessions: [original], sharedFollows: [] }))
    sessionStorage.setItem(`teth-client-user-strategies:${encodeURIComponent(owner)}`, JSON.stringify(entries))
    sessionStorage.setItem(`teth-client-user-strategies:${encodeURIComponent(otherOwner)}`, JSON.stringify([{ sessionId: 'other-creator-session', record: { ...entries[0].record, id: '18001', createdAt: 18001, name: '다른 계정 전용 전략' } }]))
  }, { owner, otherOwner, original, signed, entries })
}

async function mine(page: Page) {
  await page.goto('/#/share')
  await page.evaluate(() => { location.hash = '#/share/publishing' }); await expect(page.locator('#research-title')).toHaveText('내 전략')
}

async function wizard(page: Page) {
  await mine(page)
  await page.getByRole('button', { name: '내 전략 공유하기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '내 전략 공유하기', exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

async function intactRegistrations(page: Page) {
  expect(await page.evaluate(key => sessionStorage.getItem(key), clientUserStrategyKey(owner))).toBe(registrationBytes)
  const experience = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!))
  expect(experience.sessions).toEqual([original])
  expect(experience.homeDraft).toBe('보존할 홈 초안')
}

async function publication(page: Page, identity = owner) {
  return page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? 'null'), clientStrategyCreatorKey(identity))
}

async function review(page: Page, sourceId = '17002', description = '내가 확인한 원본 규칙의 소개') {
  const dialog = await wizard(page)
  await dialog.locator(`[data-source-id="${sourceId}"]`).click()
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click()
  await dialog.getByRole('textbox', { name: '전략 소개 (선택, 100자)', exact: true }).fill(description)
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click()
  return dialog
}

async function publish(page: Page, sourceId = '17002', description?: string) {
  const dialog = await review(page, sourceId, description)
  await dialog.getByRole('button', { name: '공개하고 랭킹 등록하기', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const center = page.locator(`.client-strategy-creator[data-publication-source-id="${sourceId}"]`)
  await expect(center).toBeVisible()
  return center
}

async function visibleControls(page: Page, dialog: Locator) {
  const viewport = page.viewportSize()!
  for (const element of await dialog.locator('header h2, header button, .acts3 button').all()) {
    const box = await element.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
    if (await element.evaluate(el => el.tagName === 'BUTTON')) {
      expect(box!.height).toBeGreaterThanOrEqual(44)
      expect(await element.evaluate(el => { const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === el || el.contains(hit) })).toBe(true)
    }
  }
}

test('등록된 동명 전략은 이름 대신 ID로 선택하고 80점 미달은 선택하지 못한다', async ({ page }) => {
  await setup(page)
  const dialog = await wizard(page)
  await expect(dialog.locator('[data-source-id]')).toHaveCount(4)
  const first = dialog.locator('[data-source-id="17001"]'), second = dialog.locator('[data-source-id="17002"]'), below = dialog.locator('[data-source-id="17003"]')
  await expect(first).toContainText('같은 이름 전략')
  await expect(second).toContainText('같은 이름 전략')
  await expect(below).toBeDisabled()
  await below.evaluate(el => (el as HTMLButtonElement).click())
  await second.click()
  await expect(second).toHaveAttribute('aria-pressed', 'true')
  await expect(first).toHaveAttribute('aria-pressed', 'false')
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: '전략 소개 (선택, 100자)', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: '이전', exact: true }).click()
  await expect(second).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '내 전략 공유하기', exact: true })).toBeFocused()
  await intactRegistrations(page)
})

test('100자 소개는 이전 단계 왕복으로 보존되며 취소는 공개 데이터를 저장하지 않는다', async ({ page }) => {
  await setup(page)
  const dialog = await wizard(page)
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click()
  const input = dialog.getByRole('textbox', { name: '전략 소개 (선택, 100자)', exact: true })
  await expect(input).toHaveAttribute('maxlength', '100')
  const description = '원문 <그대로> & 소개 '.repeat(8).slice(0, 100)
  await input.fill(description)
  await input.press('End')
  await page.keyboard.insertText('초과 입력')
  await expect(input).toHaveValue(description)
  await dialog.getByRole('button', { name: '이전', exact: true }).click()
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click()
  await expect(input).toHaveValue(description)
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click()
  await expect(dialog).toContainText(description)
  await dialog.getByRole('button', { name: '이전', exact: true }).click()
  await expect(input).toHaveValue(description)
  await page.keyboard.press('Escape')
  expect(await publication(page)).toBeNull()
  await intactRegistrations(page)
  await page.reload()
  await page.evaluate(() => { location.hash = '#/share/publishing' }); await expect(page.locator('#research-title')).toHaveText('내 전략')
  await expect(page.getByRole('button', { name: '내 전략 공유하기', exact: true })).toBeVisible()
})

test('최종 공개는 현재 owner의 같은 ID와 조건을 다시 검사하며 경합 실패에 저장·emit이 없다', async ({ page }) => {
  await page.route('**/creator-store.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Creator confirmation fixture</body></html>' }))
  await page.goto('/creator-store.html')
  const result = await page.evaluate(async ({ owner, records }) => {
    const path = '/src/client-strategy-creator-store.ts'
    const { createClientStrategyCreatorStore, getCreatorCandidate } = await import(/* @vite-ignore */ path)
    let current = structuredClone(records), writes = 0, emits = 0
    const memory = new Map<string, string>()
    const store = createClientStrategyCreatorStore(owner, () => current, { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { writes++; memory.set(key, value) } })
    const expected = getCreatorCandidate(current[1]), before = store.getSnapshot()
    store.subscribe(() => { emits++ })
    const failures = []
    for (const changed of [{ ...records[1], name: '확인 뒤 이름 변경' }, { ...records[1], version: 'v1.1' }, { ...records[1], score: 79, parameters: null }]) {
      current = [records[0], changed, ...records.slice(2)]
      let error = ''
      try { store.publish({ sourceId: records[1].id, description: '확인한 소개', expected }, 1700000000000) } catch (cause) { error = (cause as Error).message }
      failures.push({ error, same: store.getSnapshot() === before, writes, emits, size: memory.size })
    }
    current = structuredClone(records)
    const value = store.publish({ sourceId: records[1].id, description: '확인한 소개', expected }, 1700000000000)
    return { failures, value, current, writes, emits }
  }, { owner, records })
  for (const value of result.failures) {
    expect(value.error.length).toBeGreaterThan(0)
    expect(value).toMatchObject({ same: true, writes: 0, emits: 0, size: 0 })
  }
  expect(result.value).toMatchObject({ sourceId: records[1].id, asset: '이더리움', parameters, publishedAt: '2023-11-14' })
  expect(result.current).toEqual(records)
  expect(result.writes).toBe(1)
  expect(result.emits).toBe(1)
})

test('명시 공개 미리보기는 한 번만 저장하며 센터·목록·내 상세·reload에 같은 snapshot을 사용한다', async ({ page }) => {
  const externalWrites: string[] = []
  page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) externalWrites.push(request.url()) })
  await setup(page)
  const description = '소개 <그대로> & 소유한 전략의 기록'
  const dialog = await review(page, '17002', description)
  await page.evaluate(key => {
    const write = Storage.prototype.setItem
    Object.assign(window, { creatorWriteCount: 0 })
    Storage.prototype.setItem = function (target, value) {
      if (target === key) Reflect.set(window, 'creatorWriteCount', Reflect.get(window, 'creatorWriteCount') + 1)
      return write.call(this, target, value)
    }
  }, clientStrategyCreatorKey(owner))
  await dialog.getByRole('button', { name: '공개하고 랭킹 등록하기', exact: true }).evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'creatorWriteCount'))).toBe(1)
  const center = page.locator('.client-strategy-creator[data-publication-source-id="17002"]')
  await expect(center).toBeVisible()
  await expect(center.locator('.ss3-creator-name')).toBeFocused()
  await expect(center.getByRole('switch', { name: '랭킹 공개', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(center.getByLabel('팔로워 정보 미제공', { exact: true })).toHaveText('—')
  await expect(center.getByLabel('누적 정산 보상 정보 미제공', { exact: true })).toHaveText('—')
  const saved = await publication(page)
  expect(saved).toMatchObject({ visible: true, publication: { sourceId: '17002', asset: '이더리움', name: '같은 이름 전략', parameters, description, score: evaluation.score } })
  await page.getByRole('button', { name: '전략 찾기', exact: true }).click()
  // Source discovery shows ten rows per page; find the exact published name rather than requiring every strategy on page one.
  await page.getByRole('searchbox', { name: '전략 검색', exact: true }).fill('같은 이름 전략')
  await expect(page.locator('[data-creator-card]')).toHaveCount(1)
  await page.locator('[data-creator-card]').getByRole('link').click()
  await expect(page).toHaveURL(/#\/share\/s\/me$/)
  await expect(page.locator('.client-strategy-sharing')).toContainText(description)
  await expect(page.locator('.client-strategy-sharing')).toContainText('이더리움')
  await page.reload()
  await expect(page.locator('.client-strategy-sharing')).toContainText(description)
  expect(await publication(page)).toEqual(saved)
  await intactRegistrations(page)
  expect(externalWrites).toEqual([])
})

test('비공개 후에도 센터와 소유한 me 상세를 유지하며 다른 owner에는 노출하지 않는다', async ({ page }) => {
  await setup(page)
  const center = await publish(page, '17004', '비공개로 보존할 소개')
  const original = await publication(page)
  await center.getByRole('button', { name: '비공개로 전환', exact: true }).click()
  await expect(center).toContainText('비공개 상태')
  await expect(center.getByRole('switch', { name: '랭킹 공개', exact: true })).toBeFocused()
  await expect(center.getByRole('button', { name: '설정 수정', exact: true })).toBeVisible()
  expect(await publication(page)).toEqual({ ...original, visible: false })
  await page.getByRole('button', { name: '전략 찾기', exact: true }).click()
  await expect(page.locator('[data-creator-card]')).toHaveCount(0)
  await page.goto('/#/share/s/me')
  await expect(page.locator('.client-strategy-sharing')).toContainText('비공개로 보존할 소개')
  await page.reload()
  await expect(page.locator('.client-strategy-sharing')).toContainText('비공개로 보존할 소개')
  await mine(page)
  await expect(center).toContainText('비공개 상태')
  await center.getByRole('switch', { name: '랭킹 공개', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(center.getByRole('switch', { name: '랭킹 공개', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(center.getByRole('switch', { name: '랭킹 공개', exact: true })).toBeFocused()
  await page.evaluate(otherOwner => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '다른 제작자', email: otherOwner })), otherOwner)
  await page.goto('/#/share/s/me')
  await page.reload()
  await expect(page.locator('.client-strategy-sharing')).not.toContainText('비공개로 보존할 소개')
  await mine(page)
  await expect(page.locator('.client-strategy-creator')).not.toHaveAttribute('data-publication-source-id', '17004')
  expect(await publication(page, otherOwner)).toBeNull()
  expect((await publication(page)).publication).toEqual(original.publication)
  await intactRegistrations(page)
})

test('파라미터 없는 legacy 전략은 제공된 요약만 공개하며 가짜 곡선·파생 성과를 만들지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await setup(page)
  const center = await publish(page, '17004', '과거에 기록된 요약만 제공합니다')
  await expect(center).toContainText('81점')
  expect((await publication(page)).publication).toMatchObject({ sourceId: '17004', parameters: null, ret: 7.125, mdd: -4.25, n: 23, winRate: 61.5 })
  await page.screenshot({ path: info.outputPath('creator-legacy-center-320.png') })
  await page.goto('/#/share/s/me')
  await expect(page.locator('.client-strategy-sharing')).toContainText('과거에 기록된 요약만 제공합니다')
  await expect(page.locator('.client-shared-equity-chart')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '최근 검증 시뮬레이션 체결', exact: true })).toHaveCount(0)
  await expect(page.locator('.client-strategy-sharing')).not.toContainText('Profit Factor')
  await page.screenshot({ path: info.outputPath('creator-legacy-detail-320.png') })
  await intactRegistrations(page)
})

test('공개 저장 실패는 최종 검토 모달·소개·기존 등록을 유지하고 재시도만 저장한다', async ({ page }) => {
  await setup(page)
  const dialog = await review(page, '17002', '실패해도 남아 있어야 하는 소개')
  await page.evaluate(key => {
    const write = Storage.prototype.setItem
    Object.assign(window, { creatorWriteBlocked: true })
    Storage.prototype.setItem = function (target, value) {
      if (Reflect.get(window, 'creatorWriteBlocked') && target === key) throw new Error('creator fixture write failure')
      return write.call(this, target, value)
    }
  }, clientStrategyCreatorKey(owner))
  await dialog.getByRole('button', { name: '공개하고 랭킹 등록하기', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('공개 설정을 저장하지 못했어요')
  await expect(dialog).toContainText('실패해도 남아 있어야 하는 소개')
  expect(await publication(page)).toBeNull()
  await intactRegistrations(page)
  await page.evaluate(() => Reflect.set(window, 'creatorWriteBlocked', false))
  await dialog.getByRole('button', { name: '공개하고 랭킹 등록하기', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect((await publication(page)).publication.description).toBe('실패해도 남아 있어야 하는 소개')
})

test('설정 재진입은 동명의 정확한 ID와 소개를 보존하고 공개 범위 저장 실패는 기존 상태를 유지한다', async ({ page }) => {
  await setup(page)
  const center = await publish(page, '17002', '재진입해도 유지할 소개')
  const saved = await publication(page)
  await center.getByRole('button', { name: '설정 수정', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '내 전략 공유하기', exact: true })
  await dialog.getByRole('button', { name: '이전', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: '전략 소개 (선택, 100자)', exact: true })).toHaveValue('재진입해도 유지할 소개')
  await dialog.getByRole('button', { name: '이전', exact: true }).click()
  await expect(dialog.locator('[data-source-id="17002"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.locator('[data-source-id="17001"]')).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Escape')
  await expect(center.getByRole('button', { name: '설정 수정', exact: true })).toBeFocused()
  await page.evaluate(key => {
    const write = Storage.prototype.setItem
    Storage.prototype.setItem = function (target, value) {
      if (target === key) throw new Error('creator visibility fixture failure')
      return write.call(this, target, value)
    }
  }, clientStrategyCreatorKey(owner))
  await center.getByRole('switch', { name: '랭킹 공개', exact: true }).click()
  await expect(center.getByRole('status')).toContainText('공개 설정을 저장하지 못했어요')
  await expect(center.getByRole('switch', { name: '랭킹 공개', exact: true })).toHaveAttribute('aria-checked', 'true')
  expect(await publication(page)).toEqual(saved)
  await intactRegistrations(page)
})

test('320x640 최종 미리보기는 본문 스크롤과 키보드로 공개 CTA에 도달한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await setup(page)
  const dialog = await review(page, '17002', '긴 소개가 있는 작은 화면 최종 미리보기입니다. '.repeat(3).slice(0, 100))
  await page.evaluate(() => document.fonts.ready)
  const body = dialog.locator('.ss3-dialog-body')
  const dimensions = await body.evaluate(el => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, overflowY: getComputedStyle(el).overflowY }))
  await info.attach('creator-small-body.json', { body: JSON.stringify(dimensions), contentType: 'application/json' })
  expect(dimensions.overflowY).toMatch(/auto|scroll/)
  await page.screenshot({ path: info.outputPath('creator-review-320x640-top.png') })
  const final = dialog.getByRole('button', { name: '공개하고 랭킹 등록하기', exact: true })
  await dialog.getByRole('button', { name: '닫기', exact: true }).focus()
  for (let i = 0; i < 25 && !await final.evaluate(el => el === document.activeElement); i++) await page.keyboard.press('Tab')
  await expect(final).toBeFocused()
  await visibleControls(page, dialog)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await page.screenshot({ path: info.outputPath('creator-review-320x640-cta.png') })
  await page.keyboard.press('Enter')
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.ss3-creator-name')).toBeFocused()
  expect((await publication(page)).publication.sourceId).toBe('17002')
  await intactRegistrations(page)
})

test('손상된 공개 설정은 조용히 덮어쓰지 않고 명시 다시 불러오기로만 복구한다', async ({ page }) => {
  await setup(page)
  await page.addInitScript(key => sessionStorage.setItem(key, '{broken creator record'), clientStrategyCreatorKey(owner))
  await mine(page)
  const creator = page.locator('.client-strategy-creator')
  await expect(creator.getByRole('alert')).toContainText('공개 기록을 불러오지 못했어요')
  await expect(creator.getByRole('button', { name: '내 전략 공유하기', exact: true })).toHaveCount(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), clientStrategyCreatorKey(owner))).toBe('{broken creator record')
  await page.evaluate(key => sessionStorage.removeItem(key), clientStrategyCreatorKey(owner))
  await creator.getByRole('button', { name: '다시 불러오기', exact: true }).click()
  await expect(creator.getByRole('alert')).toHaveCount(0)
  await expect(creator.getByRole('button', { name: '내 전략 공유하기', exact: true })).toBeVisible()
  expect(await publication(page)).toBeNull()
  await intactRegistrations(page)
})

test('공개 검토 중 등록 조건이 바뀌면 실제 Creator와 store는 모달·소개를 유지한 채 거절한다', async ({ page }) => {
  // Controlled getRecords seam: unlike Main's owner store, this host can deliver
  // an external registration revision while the same modal stays mounted.
  await page.route('**/creator-race.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#0f1012;color:#e3e3e3"><div id="fixture"></div></body></html>' }))
  await page.goto('/creator-race.html')
  await page.evaluate(async ({ owner, records }) => {
    const refresh = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientStrategyCreator.tsx', dp = '/@id/react-dom/client', sp = '/src/client-strategy-creator-store.ts'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp), { ClientStrategyCreator } = await import(/* @vite-ignore */ cp)
    const { createClientStrategyCreatorStore, getCreatorCandidate } = await import(/* @vite-ignore */ sp)
    for (const style of ['/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/node_modules/@fontsource-variable/noto-sans-sc/index.css', '/node_modules/@fontsource-variable/geist/index.css', '/src/client-reference.css', '/src/client-strategy-sharing.css']) await import(/* @vite-ignore */ style)
    document.body.style.fontFamily = '"Noto Sans KR Variable", "Noto Sans SC Variable", "Geist Variable", sans-serif'
    const react = rm.default ?? rm, h = react.createElement, state = { records: structuredClone(records), writes: 0, calls: 0, externalError: '' }
    const store = createClientStrategyCreatorStore(owner, () => state.records, { getItem: () => null, setItem: () => { state.writes++ } })
    const root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture'))
    function Dialog({ title, children, onClose }: { title: string; children: unknown; onClose: () => void }) {
      const ref = react.useRef(null)
      react.useEffect(() => { const element = ref.current as HTMLDialogElement; element.showModal(); return () => element.close() }, [])
      return h('dialog', { className: 'ss3-dialog', ref, 'aria-label': title, onCancel: (event: Event) => { event.preventDefault(); onClose() } }, h('header', null, h('h2', null, title), h('button', { 'aria-label': '닫기', onClick: onClose }, '닫기')), h('div', { className: 'ss3-dialog-body' }, children))
    }
    const render = () => root.render(h('div', { className: 'client-strategy-sharing' }, h(ClientStrategyCreator, {
      candidates: state.records.map(getCreatorCandidate), ...store.getSnapshot(), nick: '조건 경합 검수', loggedIn: true,
      onPublish: (request: unknown) => { state.calls++; if (state.externalError) throw new Error(state.externalError); store.publish(request, 1700000000000) }, onVisibility: store.setVisible, onNew: () => {}, Dialog,
      renderPreview: (_basis: unknown, description: string) => h('p', null, description),
    })))
    store.subscribe(render)
    Object.assign(window, { creatorRaceState: state, changeCreatorBasis: () => { state.records = state.records.map((record, index) => index === 0 ? { ...record, version: 'v1.1' } : record) }, renderCreatorRace: render })
    render()
  }, { owner, records })
  await page.getByRole('button', { name: '내 전략 공유하기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '내 전략 공유하기', exact: true })
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click()
  await dialog.getByRole('textbox', { name: '전략 소개 (선택, 100자)', exact: true }).fill('확인한 조건의 소개')
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'changeCreatorBasis')())
  await dialog.getByRole('button', { name: '공개하고 랭킹 등록하기', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('전략 조건이 바뀌었어요')
  await expect(dialog).toContainText('확인한 조건의 소개')
  expect(await page.evaluate(() => Reflect.get(window, 'creatorRaceState').writes)).toBe(0)
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', 'en')
  })
  await expect(page.getByRole('dialog').getByRole('alert')).not.toContainText('전략 조건이 바뀌었어요')
  await expect(page.getByRole('dialog')).toContainText('확인한 조건의 소개')
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', 'ko')
  })
  await dialog.getByRole('button', { name: '닫기', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'renderCreatorRace')())
  await page.getByRole('button', { name: '내 전략 공유하기', exact: true }).click()
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click()
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click()
  // An untyped callback exception is not trusted UI copy, even when it matches
  // a local message. Redact it and translate only our fixed fallback.
  await page.evaluate(() => { Reflect.get(window, 'creatorRaceState').externalError = '검증을 통과한 전략을 선택해주세요' })
  await dialog.getByRole('button', { name: '공개하고 랭킹 등록하기', exact: true }).click()
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', 'en')
  })
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText("We couldn't save the publishing settings. Please try again.")
  await expect(page.getByRole('dialog').getByRole('alert')).not.toContainText('검증을 통과한 전략을 선택해주세요')
  expect(await page.evaluate(() => Reflect.get(window, 'creatorRaceState').writes)).toBe(0)
  await page.evaluate(async () => {
    Reflect.get(window, 'creatorRaceState').externalError = ''
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', 'ko')
  })
  await dialog.getByRole('button', { name: '공개하고 랭킹 등록하기', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'creatorRaceState').writes)).toBe(1)
})

for (const width of [320, 1440]) test(`${width}px 공개 3단계는 헤더·CTA를 유지하며 키보드 취소 초점이 돌아온다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await setup(page)
  const dialog = await wizard(page)
  await page.evaluate(() => document.fonts.ready)
  await visibleControls(page, dialog)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await page.screenshot({ path: info.outputPath(`creator-select-${width}.png`) })
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click()
  await dialog.getByRole('textbox', { name: '전략 소개 (선택, 100자)', exact: true }).fill('긴 소개 문구가 원본 폼에서 읽히는지 확인하는 설명입니다. '.repeat(3).slice(0, 100))
  await visibleControls(page, dialog)
  await page.screenshot({ path: info.outputPath(`creator-description-${width}.png`) })
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click()
  await visibleControls(page, dialog)
  await page.screenshot({ path: info.outputPath(`creator-review-${width}.png`) })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '내 전략 공유하기', exact: true })).toBeFocused()
  expect(await publication(page)).toBeNull()
  await intactRegistrations(page)
})
