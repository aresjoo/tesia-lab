import { expect, test } from '@playwright/test'
import { seedOwnedStrategyEdit, ownedEditOwner } from './fixtures/client-main-owned-strategy-edit'

test('actual public Main owned Mock: explicit edit apply preserves same ID/period/version and pauses the stored strategy through reload', async ({ page }) => {
  const writes: string[] = []; page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method()) || new URL(r.url()).pathname.startsWith('/api/')) writes.push(r.url()) })
  const { key, raw } = await seedOwnedStrategyEdit(page)
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/#/trade/bot/1000')
  await expect(page.getByRole('heading', { name: 'Owned edit explicit Mock', exact: true })).toBeVisible()
  const trigger = page.getByRole('button', { name: '전략 수정', exact: true })
  await trigger.click(); const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('적용 시 실행이 일시정지돼요.')
  await expect(dialog.getByRole('button', { name: '이 전략에 적용', exact: true })).toHaveCount(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(raw)
  // A fresh pure preview computation chooses an actually passing edited value.
  // This consumes the existing engine, never changes Main state or its callbacks.
  const variant = await page.evaluate(async () => {
    const path = '/src/client-delegation-engine.ts', engine = await import(/* @vite-ignore */ path)
    const original = engine.delegationRecommendedParameters()
    const choices = [{ label: '익절 목표', value: '15', parameters: { ...original, tp: 15 } },
      { label: '진입 RSI 임계', value: '42', parameters: { ...original, rsiTh: 42 } },
      { label: '진입 RSI 임계', value: '46', parameters: { ...original, rsiTh: 46 } }]
    for (const choice of choices) { const result = engine.evaluateDelegation(choice.parameters, 1); if (result.score >= 80) return { ...choice, result } }
    throw Error('No passing edited source fixture')
  })
  await dialog.getByLabel(variant.label, { exact: true }).selectOption(variant.value)
  // The current stored version is preserved: this Mock store has no version producer.
  await dialog.getByRole('button', { name: '재검증', exact: true }).click()
  await expect(dialog.getByRole('button', { name: '이 전략에 적용', exact: true })).toBeEnabled()
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(raw)
  await dialog.getByRole('button', { name: '이 전략에 적용', exact: true }).click()
  await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused()
  const saved = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), key), before = JSON.parse(raw)
  expect(key).toContain(encodeURIComponent(ownedEditOwner)); expect(saved).toHaveLength(1)
  expect(saved[0].record).toEqual({ ...before[0].record, status: 'off', parameters: variant.result.parameters,
    score: variant.result.score, ret: variant.result.result.ret, mdd: variant.result.result.mdd, n: variant.result.result.n, winRate: variant.result.result.winRate })
  expect(saved[0].record.parameters).not.toEqual(before[0].record.parameters)
  expect(saved[0].sessionId).toBe('owned-edit-source')
  await page.reload(); await expect(page.getByRole('heading', { name: 'Owned edit explicit Mock', exact: true })).toBeVisible()
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), key)).toEqual(saved)
  await expect(page.getByRole('button', { name: '전략 수정', exact: true })).toBeEnabled()
  expect(writes).toEqual([])
})
test('actual public Main owned Mock: cancelling an edit preserves exact bytes and a different account cannot edit the record', async ({ page }) => {
  const { key, raw } = await seedOwnedStrategyEdit(page); await page.goto('/#/trade/bot/1000')
  await page.getByRole('button', { name: '전략 수정', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click()
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(raw)
  await page.evaluate(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: 'Other Mock', email: 'other-owned-edit@example.test' })))
  await page.reload(); await expect(page.getByRole('button', { name: '전략 수정', exact: true })).toHaveCount(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(raw)
})
