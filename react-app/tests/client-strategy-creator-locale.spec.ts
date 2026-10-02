import { expect, test, type Page } from '@playwright/test'
import { creatorCopy, creatorCopyKeys, creatorDate, isCreatorCopyKey } from '../src/client-strategy-creator-copy'
import type { ClientLanguage } from '../src/client-preferences'
import sourceCopy from '../src/client-reference-copy.json' with { type: 'json' }

const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
const owner = 'creator-locale@example.test'
const record = { id: '17001', createdAt: 17001, name: '사용자 원문 <전략> {nick} $&', asset: '원문 자산', parameters: null,
  score: 81.12345, ret: 7.125, mdd: -4.25, n: 23, winRate: 61.5, status: 'ready', environment: 'paper', capital: 5000000, version: 'v1.0' }
const description = '사용자가 쓴 소개 <원문> {score} $&'
const saved = { sourceId: record.id, name: record.name, asset: record.asset, description, publishedAt: '2026-09-15', parameters: null,
  score: record.score, ret: record.ret, mdd: record.mdd, n: record.n, winRate: record.winRate }
const creatorKey = `teth-client-strategy-creator:${encodeURIComponent(owner)}`
const c = (language: ClientLanguage, key: Parameters<typeof creatorCopy>[1]) => creatorCopy(language, key)
test.use({ trace: 'off', video: 'off' })
test.beforeEach(({ page }) => page.setDefaultTimeout(15_000))

async function locale(page: Page, language: ClientLanguage) {
  await page.evaluate(async language => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', language)
  }, language)
  await expect(page.locator('html')).toHaveAttribute('lang', language)
}
async function setup(page: Page, published = false, corrupted = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, record, saved, creatorKey, published, corrupted }) => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '원문 닉네임', email: owner }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: null, homeDraft: '기존 미전송 초안', sessions: [], sharedFollows: [] }))
    sessionStorage.setItem(`teth-client-user-strategies:${encodeURIComponent(owner)}`, JSON.stringify([
      { sessionId: 'locale-creator-valid', record }, { sessionId: 'locale-creator-invalid', record: { ...record, id: '17002', createdAt: 17002, score: 79 } },
    ]))
    if (published) sessionStorage.setItem(creatorKey, JSON.stringify({ publication: saved, visible: true }))
    if (corrupted) sessionStorage.setItem(creatorKey, '{broken source bytes')
  }, { owner, record, saved, creatorKey, published, corrupted })
  await page.goto('/#/share')
  await page.evaluate(() => { location.hash = '#/share/publishing' }); await expect(page.locator('#research-title')).toHaveText('내 전략')
}
const storage = (page: Page) => page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))

test('74개 원문 키·7언어·치환은 숫자0과 사용자 문자열을 보존한다', () => {
  expect(sourceCopy.GLC_LANGS.map(item => item.c)).toEqual(languages)
  expect(Object.keys(sourceCopy.PH_ROT.list)).toEqual(languages)
  expect(creatorCopyKeys).toHaveLength(74)
  for (const key of creatorCopyKeys) {
    expect(creatorCopy('ko', key)).toBe(key)
    for (const language of languages) {
      const value = creatorCopy(language, key)
      expect(value.trim()).not.toBe('')
      expect(value.match(/\{\w+\}/g)?.sort() ?? []).toEqual(key.match(/\{\w+\}/g)?.sort() ?? [])
      expect(value.match(/\d+/g) ?? []).toEqual(key.match(/\d+/g) ?? [])
      if (language !== 'ko') expect(value).not.toMatch(/[가-힣]/)
    }
  }
  expect(creatorCopy('en', '{score}점', { score: 0 })).toContain('0')
  expect(creatorCopy('en', '{nick} 크리에이터 센터', { nick: '$& {nick} <raw>' })).toContain('$& {nick} <raw>')
  expect(isCreatorCopyKey('__proto__')).toBe(false)
  expect(isCreatorCopyKey('toString')).toBe(false)
})

test('날짜는 UTC civil date를 보존하고 잘못된 날짜를 보정하지 않는다', () => {
  expect(creatorDate('2026-09-15', 'ko')).toBe('2026-09-15')
  expect(creatorDate('2026-09-15', 'en')).toBe('Sep 15, 2026')
  expect(creatorDate('2026-09-15', 'fr')).toBe('15 sept. 2026')
  for (const value of ['2026-02-30', 'invalid', '0000-01-01', '2026-09-15T23:00:00Z']) expect(creatorDate(value, 'en')).toBe(value)
})

for (const language of languages) test(`${language}: 작성자 세 단계와 센터 전체 표시·원문·저장 조건이 이어진다`, async ({ page }, info) => {
  await setup(page)
  await locale(page, language)
  const creator = page.locator('.client-strategy-creator')
  await expect(creator.getByRole('heading')).toHaveText(c(language, '내 전략을 공유해보세요'))
  await creator.getByRole('button', { name: c(language, '내 전략 공유하기'), exact: true }).click()
  const dialog = page.getByRole('dialog', { name: c(language, '내 전략 공유하기'), exact: true })
  await expect(dialog.locator('.stp')).toHaveCount(3)
  await expect(dialog.locator('[data-source-id="17001"]')).toContainText(record.name)
  const usesDecimalComma = language === 'fr' || language === 'es'
  await expect(dialog.locator('[data-source-id="17001"] .rs')).toContainText(usesDecimalComma ? '81,12345' : '81.12345')
  await expect(dialog.locator('[data-source-id="17001"] .rs')).toContainText(usesDecimalComma ? '+7,1%' : '+7.1%')
  await expect(dialog.locator('[data-source-id="17001"] .rs')).toContainText(usesDecimalComma ? '-4,3%' : '-4.3%')
  await expect(dialog.locator('[data-source-id="17002"]')).toBeDisabled()
  await expect(dialog.locator('[data-source-id="17002"]')).toContainText(c(language, 'TETH 80점 이상 전략만 공개할 수 있어요.'))
  await dialog.getByRole('button', { name: c(language, '다음 단계'), exact: true }).click()
  const input = dialog.getByRole('textbox', { name: c(language, '전략 소개 (선택, 100자)'), exact: true })
  await expect(input).toHaveAttribute('maxlength', '100')
  await input.fill(description)
  await expect(dialog).toContainText(c(language, '전략 파라미터 원본은 공개되지 않아요. 검증 성과 지표(수익률, 점수, 낙폭, 승률)와 에쿼티 곡선만 닉네임으로 공개됩니다.'))
  await dialog.getByRole('button', { name: c(language, '다음 단계'), exact: true }).click()
  await expect(dialog).toContainText(description)
  await dialog.getByRole('button', { name: c(language, '공개하고 랭킹 등록하기'), exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(creator.locator('.ss3-notice')).toHaveText(c(language, '전략이 공개됐어요. 전략 찾기에서 확인할 수 있어요'))
  await expect(creator.locator('.ss3-creator-name')).toHaveText(record.name)
  await expect(creator.locator('.tl dd').nth(2)).toHaveText(usesDecimalComma ? '+7,1%' : '+7.1%')
  await expect(creator.locator('.tl dd').nth(3)).toHaveText(creatorCopy(language, '{score}점', { score: usesDecimalComma ? '81,12345' : '81.12345' }))
  await expect(creator).toContainText(description)
  const snapshot = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), creatorKey)
  expect(snapshot.publication).toMatchObject({ ...saved, publishedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
  await expect(creator.getByRole('switch')).toHaveAccessibleName(c(language, '랭킹 공개'))
  await creator.getByRole('button', { name: c(language, '비공개로 전환'), exact: true }).click()
  await expect(creator.locator('.ss3-notice')).toHaveText(c(language, '비공개로 전환했어요. 스냅샷은 보관돼요'))
  await expect(creator.getByRole('switch')).toBeFocused()
  await page.screenshot({ path: info.outputPath(`creator-center-${language}.png`) })
})

test('열린 소개 입력의 언어·통화 변경은 DOM·커서·초안·저장값을 바꾸지 않는다', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: '내 전략 공유하기', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click()
  const input = dialog.locator('input[type=text]')
  await input.fill(description)
  await input.evaluate((element: HTMLInputElement) => { element.setSelectionRange(3, 8); Reflect.set(window, 'creatorInputNode', element) })
  const before = await storage(page)
  for (const language of languages) {
    await locale(page, language)
    await expect(input).toBeFocused()
    await expect(input).toHaveValue(description)
    expect(await input.evaluate((element: HTMLInputElement) => [element === Reflect.get(window, 'creatorInputNode'), element.selectionStart, element.selectionEnd])).toEqual([true, 3, 8])
    expect(await storage(page)).toEqual(before)
  }
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('currency', 'EUR')
  })
  await expect(input).toHaveValue(description)
  expect(await storage(page)).toEqual(before)
})

test('공개 센터의 날짜·알림은 언어에 반응하고 정산·팔로워 없는 값과 원문은 그대로다', async ({ page }) => {
  await setup(page, true)
  const creator = page.locator('.client-strategy-creator')
  await creator.getByRole('button', { name: '비공개로 전환', exact: true }).click()
  const before = await storage(page)
  for (const language of languages) {
    await locale(page, language)
    await expect(creator.locator('time')).toHaveText(creatorDate(saved.publishedAt, language))
    await expect(creator.locator('time')).toHaveAttribute('datetime', saved.publishedAt)
    await expect(creator.locator('.ss3-notice')).toHaveText(c(language, '비공개로 전환했어요. 스냅샷은 보관돼요'))
    expect((await creator.locator('.tl dd').allTextContents()).slice(0, 2)).toEqual(['—', '—'])
    await expect(creator.locator('.ss3-creator-name')).toHaveText(record.name)
    expect(await storage(page)).toEqual(before)
  }
})

test('공개 범위 저장 실패는 언어 변경 뒤에도 안내되고 원 공개 바이트와 소개는 보존한다', async ({ page }) => {
  await setup(page, true)
  await page.evaluate(key => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new Error('INJECTED_STORAGE_FAILURE'); return original.call(this, name, value) }
  }, creatorKey)
  const before = await storage(page)
  await page.locator('.client-strategy-creator').getByRole('switch').click()
  for (const language of languages) {
    await locale(page, language)
    await expect(page.locator('.ss3-notice')).toHaveText(c(language, '공개 설정을 저장하지 못했어요. 입력한 내용을 확인하고 다시 시도해주세요.'))
    await expect(page.locator('.client-strategy-creator').getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(await storage(page)).toEqual(before)
  }
})

test('손상된 공개 기록 안내는 7언어로 읽히고 자동 덮어쓰기하지 않는다', async ({ page }) => {
  await setup(page, false, true)
  const before = await storage(page)
  for (const language of languages) {
    await locale(page, language)
    await expect(page.locator('.ss3-creator-storage')).toContainText(c(language, '공개 기록을 불러오지 못했어요. 기존 기록은 덮어쓰지 않습니다.'))
    await expect(page.locator('.ss3-creator-storage button')).toHaveText(c(language, '다시 불러오기'))
    expect(await storage(page)).toEqual(before)
  }
})

test('긴 번역의 320·390·768·1440px 단계·입력·버튼은 화면 안에서 조작할 수 있다', async ({ page }, info) => {
  await setup(page)
  await page.getByRole('button', { name: '내 전략 공유하기', exact: true }).click()
  const dialog = page.getByRole('dialog')
  for (const step of [1, 2, 3]) {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width < 400 ? 568 : 900 })
      for (const language of ['fr', 'es', 'ja'] as const) {
        await locale(page, language)
        await expect(dialog.locator('.stp[aria-current=step]')).toHaveText(new RegExp(`^${step}`))
        await expect.poll(() => dialog.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1)
        for (const button of await dialog.locator('header button,.acts3 button').all()) {
          await button.scrollIntoViewIfNeeded()
          const box = await button.boundingBox()
          expect(box!.width).toBeGreaterThanOrEqual(44)
          expect(box!.height).toBeGreaterThanOrEqual(44)
          expect(box!.x).toBeGreaterThanOrEqual(0)
          expect(box!.x + box!.width).toBeLessThanOrEqual(width)
          expect(await button.evaluate(node => { const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === node || node.contains(hit) })).toBe(true)
        }
        if (step === 2) {
          const input = dialog.getByRole('textbox')
          await input.scrollIntoViewIfNeeded()
          await input.fill(description)
          await expect(input).toHaveValue(description)
        }
        await page.screenshot({ path: info.outputPath(`creator-wizard-${step}-${language}-${width}.png`) })
      }
    }
    if (step < 3) await dialog.getByRole('button', { name: c('ja', '다음 단계'), exact: true }).click()
  }
})
