import { expect, test } from '@playwright/test'
import { createBillingPreviewStore } from '../src/client-billing-preview-store'
import { checkBillingPreview } from '../src/client-billing-preview-gate'
import { sharedHash, sourceSharedStrategies } from '../src/client-shared-strategies'

function fixture() {
  const data = new Map<string, string>()
  const store = createBillingPreviewStore('admission@example.test', {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value) },
  })
  return { store, data }
}
test('미리보기 gate는 정상·관망·조회불가를 구별하고 AI 사용량을 차감하지 않는다', () => {
  const { store, data } = fixture()
  expect(checkBillingPreview(store)).toBe('allowed')
  const before = JSON.stringify(store.getSnapshot().state?.ledger)
  expect(checkBillingPreview(store)).toBe('allowed')
  expect(JSON.stringify(store.getSnapshot().state?.ledger)).toBe(before)
  expect(store.dispatch({ kind: 'qa-watch' }, Date.now(), 'watch').ok).toBe(true)
  expect(checkBillingPreview(store)).toBe('watch')
  for (const key of data.keys()) data.set(key, '{broken')
  expect(checkBillingPreview(store)).toBe('unavailable')
  expect([...data.values()]).toEqual(['{broken'])
})
test('시계 역행은 크레딧 소진으로 오인하지 않고 신규 전송만 거절한다', () => {
  const { store } = fixture()
  expect(store.dispatch({ kind: 'boot' }, Date.now() + 60_000, 'future').ok).toBe(true)
  const before = JSON.stringify(store.getSnapshot())
  expect(checkBillingPreview(store)).toBe('clock-skew')
  expect(JSON.stringify(store.getSnapshot())).toBe(before)
})
test('차단 알림 저장이 실패하면 관망 확인 성공으로 처리하지 않는다', () => {
  const { store, data } = fixture(), beforeDay = Date.now() - 864e5
  expect(store.dispatch({ kind: 'boot' }, beforeDay, 'boot').ok).toBe(true)
  expect(store.dispatch({ kind: 'qa-watch' }, beforeDay, 'watch').ok).toBe(true)
  const before = [...data.entries()]
  const failing = createBillingPreviewStore('admission@example.test', {
    getItem: key => data.get(key) ?? null,
    setItem: () => { throw new Error('Storage unavailable') },
  })
  expect(checkBillingPreview(failing)).toBe('unavailable')
  expect(failing.getSnapshot().error).toBe('write-failed')
  expect([...data.entries()]).toEqual(before)
})
test('시계 역행에는 무효 재조회 버튼을 숨기고 정상 시각 이후 명시 전송만 허용한다', async ({ page }) => {
  const { store, data } = fixture(), now = Date.now()
  expect(store.dispatch({ kind: 'boot' }, now + 60_000, 'future').ok).toBe(true)
  await page.clock.install({ time: new Date(now) })
  await page.addInitScript(entries => {
    for (const [key, value] of entries) sessionStorage.setItem(key, value)
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '시계 검수', email: 'admission@example.test' }))
  }, [...data.entries()])
  await page.goto('/')
  const input = page.getByRole('textbox', { name: '시장이나 전략에 대해 물어보세요', exact: true })
  await input.fill('날짜 확인 후 직접 보낼 질문')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  const notice = page.locator('.client-global-notice').filter({ hasText: '기기 시간이 저장된 기록보다 이전' })
  await expect(notice).toBeVisible()
  await expect(notice.getByRole('button', { name: '저장 상태 다시 확인' })).toHaveCount(0)
  await expect(input).toHaveValue('날짜 확인 후 직접 보낼 질문')
  await expect(page.locator('.g-umsg')).toHaveCount(0)
  await page.clock.setSystemTime(new Date(now + 61_000))
  await expect(page.locator('.g-umsg')).toHaveCount(0)
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.locator('.g-umsg')).toHaveText('날짜 확인 후 직접 보낼 질문')
  await expect(notice).toHaveCount(0)
})
test('관망 중 카피 설정 직접 진입은 잔고 차감·신규 카피 없이 입력을 보존한다', async ({ page }) => {
  const { store, data } = fixture()
  expect(store.dispatch({ kind: 'boot' }, Date.now() - 2, 'start').ok).toBe(true)
  expect(store.dispatch({ kind: 'qa-watch' }, Date.now() - 1, 'watch').ok).toBe(true)
  await page.addInitScript(entries => {
    for (const [key, value] of entries) sessionStorage.setItem(key, value)
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '관망 검수', email: 'admission@example.test' }))
  }, [...data.entries()])
  const hash = sharedHash({ view: 'copy-setup', nick: sourceSharedStrategies()[0].nick, period: 'all' })
  await page.goto(`/${hash}`)
  const amount = page.getByRole('textbox', { name: '카피 금액', exact: true })
  await amount.fill('200')
  await page.getByRole('button', { name: '카피 시작', exact: true }).click()
  await expect(amount).toHaveValue('200')
  await expect(page).toHaveURL(new RegExp(hash + '$'))
  await expect(page.getByRole('region', { name: '카피 대시보드' })).toHaveCount(0)
  await expect(page.locator('.client-global-notice')).toContainText('이번 달 AI 사용량을 모두 써서 새 요청은 잠시 멈춥니다. 실행 중인 전략과 결과 보기는 그대로입니다.')
})
test('QA 관망 상태와 PLAN은 같은 상태를 표시하며 복귀·작은 화면 배치를 보존한다', async ({ page }, info) => {
  await page.goto('/client-state-preview.html')
  const qa = page.getByRole('button', { name: '데모 상태 조작 패널', exact: true })
  await qa.click()
  await page.locator('[data-qa-key="bwatch"]').click()
  await expect(page.locator('[data-qa-key="login"]')).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(page.getByText('관망 중', { exact: true })).toBeVisible()
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: info.outputPath(`watch-${width}.png`) })
  }
  await qa.click()
  await page.locator('[data-qa-key="bwatch"]').click()
  await expect(page.locator('[data-qa-key="bwatch"]')).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Escape')
  await expect(page.getByText('관망 중', { exact: true })).toHaveCount(0)
})
