import { expect, test, type Page } from '@playwright/test'
import { sharedHash, sourceSharedStrategies } from '../src/client-shared-strategies'
import { copyPreviewStorageKey } from '../src/client-copy-preview-store'
import { calculateCopyPreview, flattenCopyPreview } from '../src/client-copy-preview-state'
import { installOpenCopyObservation, withOpenCopyObservation } from './fixtures/client-copy-open-observation'
import { copyActionError, copyActionText, copySummaryText } from '../src/client-copy-trading-copy'
import type { ClientLanguage } from '../src/client-preferences'
const owner = 'copy-recovery@example.test', key = copyPreviewStorageKey(owner), seed = sourceSharedStrategies()[0]
const openSeed = withOpenCopyObservation(seed)
const setup = sharedHash({ view: 'copy-setup', nick: seed.nick, period: 'all' })
async function open(page: Page, hash = setup) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(owner => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '복구 검수자', email: owner })), owner)
  await page.goto(`/${hash}`)
  await expect(page.locator('.client-strategy-sharing')).toBeVisible()
}
async function start(page: Page, withOpenPosition = false) {
  if (withOpenPosition) await installOpenCopyObservation(page, seed)
  await open(page)
  await page.getByRole('textbox', { name: '카피 금액', exact: true }).fill('200')
  await page.getByRole('button', { name: '카피 시작', exact: true }).click()
  await expect(page.locator('.cpd-card')).toHaveCount(1)
}
async function state(page: Page) { return page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? 'null'), key) }

const languages: ClientLanguage[] = ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']
async function setLanguage(page: Page, language: ClientLanguage) {
  await page.evaluate(async language => { const path = '/src/client-preferences.ts'; const { setClientPreference } = await import(/* @vite-ignore */ path); setClientPreference('language', language); setClientPreference('currency', 'KRW') }, language)
}
async function checkDialogWidth(page: Page) {
  const bounds = await page.getByRole('dialog').evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, right: r.right, width: innerWidth, scroll: el.scrollWidth, client: el.clientWidth } })
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.right).toBeLessThanOrEqual(bounds.width + 1); expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1)
}
for (const width of [320, 1440]) test(`${width}px 조정·설정·종료·정리 확인창의7언어는 원장·입력·초점·단계를 유지한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  await start(page, true)
  await page.getByRole('button', { name: '상세', exact: true }).click()
  const before = await state(page)
  for (const kind of ['adjust', 'settings', 'close', 'flat'] as const) {
    const name = { adjust: '잔고 조정', settings: '설정', close: '카피 종료', flat: '포지션 전체 정리' }[kind]
    const trigger = page.locator('.cpx').getByRole('button', { name, exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog'), element = await dialog.elementHandle()
    if (kind === 'adjust') { await dialog.getByRole('textbox').fill('25.50'); await dialog.getByRole('textbox').focus() }
    for (const lang of languages) {
      await setLanguage(page, lang)
      const titleKey = kind === 'adjust' ? '잔고 조정, {nick}' : kind === 'settings' ? '카피 설정, {nick}' : kind === 'flat' ? '포지션 전체 정리' : '카피 종료'
      await expect(dialog).toHaveAccessibleName(copyActionText(lang, titleKey, { nick: seed.nick }))
      expect(await element!.evaluate(node => node.isConnected)).toBe(true)
      expect(await state(page)).toEqual(before)
      if (lang !== 'ko') expect((await dialog.innerText()).replaceAll(seed.nick, '')).not.toMatch(/[가-힣]|₩|\{\w+\}/)
      if (kind === 'adjust') {
        const input = dialog.getByRole('textbox', { name: copyActionText(lang, '조정 금액'), exact: true })
        await expect(input).toHaveValue('25.50'); await expect(input).toBeFocused()
        await expect(input).toHaveAttribute('placeholder', copyActionText(lang, '금액'))
        await expect(dialog.getByRole('button', { name: copyActionText(lang, '확인'), exact: true })).toBeEnabled()
        await expect(dialog.getByRole('group', { name: copyActionText(lang, '잔고 조정 방식') }).getByRole('button', { name: copyActionText(lang, '추가 입금'), exact: true })).toHaveAttribute('aria-pressed', 'true')
      }
      await checkDialogWidth(page)
      if (lang === 'fr') await page.screenshot({ path: `/tmp/teth-copy-dialog-${kind}-${width}.png` })
    }
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused()
  }
})

test('조정 유효성·최대·출금 전환·설정 복귀는7언어에서 같은 금액을 보존한다', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: '상세', exact: true }).click()
  const before = await state(page)
  for (const lang of languages) {
    await setLanguage(page, lang)
    await page.locator('.cpx').getByRole('button', { name: copySummaryText(lang, '설정'), exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: copyActionText(lang, '잔고 조정 열기'), exact: true }).click()
    await expect(dialog.getByRole('heading')).toBeFocused()
    const input = dialog.getByRole('textbox', { name: copyActionText(lang, '조정 금액'), exact: true }), confirm = dialog.getByRole('button', { name: copyActionText(lang, '확인'), exact: true })
    for (const invalid of ['0', '-1', '1e2', 'abc', '1,5']) {
      await input.fill(invalid); await expect(input).toHaveAttribute('aria-invalid', 'true'); await expect(confirm).toBeDisabled()
      await expect(dialog.getByRole('alert')).toHaveText(copyActionText(lang, '0보다 큰 금액을 입력해주세요'))
    }
    await input.fill('801'); await expect(dialog.getByRole('alert')).toHaveText(copyActionText(lang, '스팟 잔고보다 커요'))
    await dialog.getByRole('button', { name: copyActionText(lang, '최대'), exact: true }).click()
    await expect(input).toHaveValue('800'); await expect(confirm).toBeEnabled()
    await dialog.getByRole('button', { name: copyActionText(lang, '출금'), exact: true }).click()
    await expect(input).toHaveValue(''); await expect(confirm).toBeDisabled()
    await input.fill('999999'); await expect(dialog.getByRole('alert')).toHaveText(copyActionText(lang, '출금 가능 금액을 넘었어요'))
    await dialog.getByRole('button', { name: copyActionText(lang, '취소'), exact: true }).click()
    expect(await state(page)).toEqual(before)
  }
})

test('손실 확인 중 언어를 바꿔도 추가입금은 명시 확인 전까지 실행되지 않는다', async ({ page }) => {
  const losing = structuredClone(seed), last = losing.result.eq.at(-1)!
  last.v *= .5
  await installOpenCopyObservation(page, losing)
  await start(page)
  const before = await state(page)
  await page.getByRole('button', { name: '잔고 조정', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill('25.50')
  await dialog.getByRole('button', { name: '확인', exact: true }).click()
  await expect(dialog).toHaveAccessibleName('잠깐, 손실 구간이에요')
  await expect(dialog.getByRole('heading')).toBeFocused()
  for (const lang of languages) {
    await setLanguage(page, lang)
    await expect(dialog).toHaveAccessibleName(copyActionText(lang, '잠깐, 손실 구간이에요'))
    const amount = `${(25.5).toLocaleString(lang, { minimumFractionDigits: 2 })} USDT`
    await expect(dialog.getByRole('button', { name: copyActionText(lang, '{amount} 추가할게요', { amount }), exact: true })).toBeEnabled()
    expect(await state(page)).toEqual(before)
    await dialog.getByRole('button', { name: copyActionText(lang, '다시 생각할게요'), exact: true }).click()
    await expect(dialog.getByRole('textbox')).toHaveValue('25.50')
    await dialog.getByRole('button', { name: copyActionText(lang, '확인'), exact: true }).click()
  }
  await dialog.getByRole('button', { name: '25.50 USDT 추가할게요', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const after = await state(page)
  expect(after.spot).toBe(before.spot - 25.5); expect(after.copies[0].ledger).toHaveLength(before.copies[0].ledger.length + 1)
})

test('명시 저장 실패 안내도7언어로 바뀌며 재확인 전 다시 차감하지 않는다', async ({ page }) => {
  await start(page)
  const before = await state(page)
  await page.getByRole('button', { name: '잔고 조정', exact: true }).click()
  const dialog = page.getByRole('dialog'); await dialog.getByRole('textbox').fill('25')
  await page.evaluate(key => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(k, value) { if (k === key) throw new Error('synthetic preview write failure'); original.call(this, k, value) } }, key)
  await dialog.getByRole('button', { name: '확인', exact: true }).click()
  for (const lang of languages) {
    await setLanguage(page, lang)
    await expect(dialog.getByRole('alert').locator('p')).toHaveText(copyActionError(lang, '카피 미리보기를 저장하지 못했어요. 다시 시도해주세요.'))
    await expect(dialog.getByRole('button', { name: copyActionText(lang, '확인'), exact: true })).toBeDisabled()
    await expect(dialog.getByRole('textbox')).toHaveValue('25')
    expect(await state(page)).toEqual(before)
  }
})

for (const failure of ['after-write', 'drop-write'] as const) test(`${failure}: 모호한 저장 뒤 무조건 재실행하지 않고 다시 읽어서 중복 차감을 막는다`, async ({ page }) => {
  await open(page)
  await page.evaluate(({ key, failure }) => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function(k, value) {
      if (k !== key) return original.call(this, k, value)
      if (failure === 'drop-write') return
      original.call(this, k, value)
      throw new Error('fixture setter threw after persistence')
    }
    Object.assign(window, { restoreCopyStorage: () => { Storage.prototype.setItem = original } })
  }, { key, failure })
  await page.getByRole('textbox', { name: '카피 금액', exact: true }).fill('200')
  await page.getByRole('button', { name: '카피 시작', exact: true }).click()
  await expect(page.locator('.copy-storage-error')).toBeVisible()
  await expect(page.getByRole('button', { name: '카피 시작', exact: true })).toBeDisabled()
  const uncertain = await state(page)
  if (failure === 'after-write') { expect(uncertain.spot).toBe(800); expect(uncertain.copies).toHaveLength(1) }
  else expect(uncertain).toBeNull()
  await page.evaluate(() => (window as unknown as { restoreCopyStorage: () => void }).restoreCopyStorage())
  await page.getByRole('button', { name: '저장 상태 다시 확인', exact: true }).click()
  await page.getByRole('button', { name: '카피 시작', exact: true }).click()
  await expect(page.locator('.cpd-card')).toHaveCount(1)
  const final = await state(page)
  expect(final.spot).toBe(800)
  expect(final.copies).toHaveLength(1)
  if (uncertain) expect(final).toEqual(uncertain)
})

test('수동 포지션 정리는 카피를 유지하고 고정된 손익으로 이후 증액·종료한다', async ({ page }) => {
  await start(page, true)
  await page.getByRole('button', { name: '상세', exact: true }).click()
  await page.getByRole('button', { name: '포지션 전체 정리', exact: true }).click()
  const before = await state(page)
  const projected = flattenCopyPreview(before, { owner, id: before.copies[0].id, at: Date.now() }, openSeed)
  expect(projected.ok).toBe(true)
  if (!projected.ok || !projected.copy) throw new Error('fixture flatten failed')
  const calculated = calculateCopyPreview(projected.copy, openSeed)!
  const amountText = (value: number) => `${value.toLocaleString('ko', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
  const confirmation = page.getByRole('dialog')
  await expect(confirmation.locator('.cpp-kpi').filter({ hasText: '정리 후 순손익' })).toContainText(amountText(calculated.net))
  await expect(confirmation.locator('.cpp-kpi').filter({ hasText: '정리 후 수익 분배 지급' })).toContainText(amountText(calculated.share))
  await expect(confirmation.locator('.cpp-kpi').filter({ hasText: '정리 후 평가 금액' })).toContainText(amountText(calculated.est))
  await page.getByRole('button', { name: '정리하기', exact: true }).click()
  await expect(page.locator('.cpp-empty')).toContainText('지금 열려 있는 카피 포지션이 없어요')
  await expect(page.locator('.cpp-nick')).toBeFocused()
  const flat = await state(page)
  expect(flat.copies[0].status).toBe('active')
  expect(flat.copies[0].flatSnapshot.unreal).toBe(0)
  expect(flat.copies[0].flatSnapshot.net).toBe(calculated.net)
  expect(flat.copies[0].flatSnapshot.share).toBe(calculated.share)
  expect(flat.copies[0].flatSnapshot.est).toBe(calculated.est)
  await page.getByRole('button', { name: '잔고 조정', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: '조정 금액', exact: true }).fill('50')
  await dialog.getByRole('button', { name: '확인', exact: true }).click()
  if (await page.getByRole('dialog', { name: '잠깐, 손실 구간이에요' }).isVisible()) await page.getByRole('button', { name: '50.00 USDT 추가할게요', exact: true }).click()
  await page.getByRole('button', { name: '카피 종료', exact: true }).click()
  await page.getByRole('button', { name: '종료하고 정산', exact: true }).click()
  await expect(page.locator('#research-title')).toBeFocused()
  await expect(page).toHaveURL(/#\/share\/library$/); await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  const closed = await state(page)
  expect(closed.copies[0].settle.net).toBe(flat.copies[0].flatSnapshot.net)
  expect(closed.copies[0].closedTrades).toEqual(flat.copies[0].flatTrades)
  await page.getByRole('button', { name: '종료 포함', exact: true }).click()
  await page.getByRole('button', { name: '기록 보기', exact: true }).click()
  await page.reload()
  await expect(page.locator('.cpp-meta')).toContainText('종료됨')
  expect(await state(page)).toEqual(closed)
})

test('열린 잔고 모달 중 같은 카피의 다른 딥링크로 이동하면 모달만 닫히고 잔고는 보존된다', async ({ page }) => {
  await start(page)
  const before = await state(page), id = before.copies[0].id
  await page.getByRole('button', { name: '상세', exact: true }).click()
  await page.getByRole('button', { name: '잔고 조정', exact: true }).click()
  await page.getByRole('textbox', { name: '조정 금액', exact: true }).fill('77')
  await page.evaluate(hash => { location.hash = hash }, sharedHash({ view: 'copy-detail', copyId: id, copyTab: 'bal', period: 'all' }))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('table', { name: '자금 이동', exact: true })).toBeVisible()
  expect(await state(page)).toEqual(before)
})

test('프로필 최하단 CTA에서 설정으로 진입하면 새 폼의 시작 위치가 보인다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 })
  await open(page, sharedHash({ view: 'trader', nick: seed.nick, period: 'all' }))
  await page.getByRole('button', { name: '카피 시작하기', exact: true }).click()
  await expect(page.locator('.cps-wrap')).toBeVisible()
  await expect.poll(() => page.locator('#research-main').evaluate(el => el.scrollTop)).toBe(0)
  await expect.poll(() => page.locator('.client-source-app.has-site-footer').evaluate(el => el.scrollTop)).toBe(0)
  await expect(page.locator('#research-title')).toBeFocused()
  await expect(page.getByRole('button', { name: '비율 따라가기', exact: true })).toBeInViewport()
})

for (const failArchive of [false, true]) test(`손상 기록의 명시 복구: 사본 저장 ${failArchive ? '실패 시 원본 보존' : '확인 후에만 초기화'}`, async ({ page }) => {
  const raw = '{corrupt original bytes 한글'
  await page.addInitScript(({ key, raw }) => sessionStorage.setItem(key, raw), { key, raw })
  await open(page)
  await page.getByRole('button', { name: '사본 보관 후 새로 시작', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('탭을 닫으면 사라질 수 있어요')
  await page.getByRole('button', { name: '취소', exact: true }).click()
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(raw)
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('teth-copy-preview-recovery:')))).toHaveLength(0)
  if (failArchive) await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('teth-copy-preview-recovery:')) throw new Error('fixture archive denied')
      return original.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: '사본 보관 후 새로 시작', exact: true }).click()
  await page.getByRole('button', { name: '사본 보관하고 초기화', exact: true }).click()
  if (failArchive) {
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('초기화하지 않았어요')
    expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(raw)
    await expect(page.getByRole('button', { name: '카피 시작', exact: true })).toBeDisabled()
  } else {
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.copy-storage-error')).toHaveCount(0)
    await expect(page.locator('#research-title')).toBeFocused()
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('teth-copy-preview-recovery:')).map(key => sessionStorage.getItem(key)))).toEqual([raw])
    expect(await state(page)).toEqual({ v: 1, owner, spot: 1000, copies: [] })
    await page.getByRole('textbox', { name: '카피 금액', exact: true }).fill('200')
    await expect(page.getByRole('button', { name: '카피 시작', exact: true })).toBeEnabled()
  }
})

test('출금 이력 뒤 음수 평가액도 정리 확인창과 적용 snapshot에 그대로 일치한다', async ({ page }) => {
  await start(page, true)
  // A supplied preview history after withdrawal and subsequent market decline.
  // This does not relax UI withdrawal limits or claim actual financial authority.
  await page.evaluate(key => {
    const value = JSON.parse(sessionStorage.getItem(key)!)
    value.copies[0].ledger.push({ at: Date.now(), type: 'out', amt: 200 })
    value.spot += 200
    sessionStorage.setItem(key, JSON.stringify(value))
  }, key)
  await page.reload()
  await expect(page.locator('.copy-storage-error')).toHaveCount(0)
  const before = await state(page), copy = before.copies[0]
  const projected = flattenCopyPreview(before, { owner, id: copy.id, at: Date.now() }, openSeed)
  if (!projected.ok || !projected.copy) throw new Error('fixture flatten failed')
  const expected = calculateCopyPreview(projected.copy, openSeed)!
  expect(expected.est).toBeLessThan(0)
  await page.getByRole('button', { name: '상세', exact: true }).click()
  await page.getByRole('button', { name: '포지션 전체 정리', exact: true }).click()
  await expect(page.getByRole('dialog').locator('.cpp-kpi').filter({ hasText: '정리 후 평가 금액' })).toContainText(`${expected.est.toFixed(2)} USDT`)
  await page.getByRole('button', { name: '정리하기', exact: true }).click()
  expect((await state(page)).copies[0].flatSnapshot.est).toBe(expected.est)
  await expect(page.locator('.cpd-sum .cpp-kpi').filter({ hasText: '평가 금액' })).toContainText(`${expected.est.toFixed(2)} USDT`)
})

for (const width of [320, 1440]) test(`카피 상세 ${width}px 지표 행과 확인 버튼 폭이 정렬된다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await start(page, true)
  await page.getByRole('button', { name: '상세', exact: true }).click()
  await expect(page.locator('.cpd-sum .cpp-kpi')).toHaveCount(6)
  const boxes = await page.locator('.cpd-sum .cpp-kpi').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { top: Math.round(r.top), width: r.width } }))
  expect(boxes.filter(box => box.top === boxes[0].top)).toHaveLength(width === 320 ? 2 : 6)
  await page.screenshot({ path: info.outputPath(`copy-detail-${width}.png`) })
  await page.getByRole('button', { name: '포지션 전체 정리', exact: true }).click()
  const dialog = page.getByRole('dialog'), cancel = await dialog.getByRole('button', { name: '취소', exact: true }).boundingBox(), confirm = await dialog.getByRole('button', { name: '정리하기', exact: true }).boundingBox()
  expect(cancel!.height).toBeGreaterThanOrEqual(44)
  expect(confirm!.height).toBeGreaterThanOrEqual(44)
  if (width === 320) expect(Math.abs(cancel!.width - confirm!.width)).toBeLessThanOrEqual(1)
  expect(await dialog.evaluate(node => node.scrollWidth > node.clientWidth + 1)).toBe(false)
  await page.screenshot({ path: info.outputPath(`copy-flat-${width}.png`) })
})
