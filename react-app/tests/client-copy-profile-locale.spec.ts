import { expect, test, type Page } from '@playwright/test'
import { copyProfileAsset, copyProfileSourceText, copyProfileText } from '../src/client-copy-profile-copy'
import { copyProfileTabs, copyTraderLocation, sharedHash, sourceSharedStrategies } from '../src/client-shared-strategies'
import { copyTraderAiNote, projectCopyTraderProfile } from '../src/client-copy-trader-profile'
import { copyPreviewStorageKey } from '../src/client-copy-preview-store'
import { copyTradingLabel } from '../src/client-copy-trading-copy'
import { sharedNumber } from '../src/client-shared-number-format'
import type { ClientLanguage } from '../src/client-preferences'

const seed = sourceSharedStrategies()[0], owner = 'profile-locale@example.test', accountKey = copyPreviewStorageKey(owner)
const languages: ClientLanguage[] = ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']
const profileHash = sharedHash(copyTraderLocation(seed.nick))
async function open(page: Page, signedIn = true) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  if (signedIn) await page.addInitScript(owner => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '프로필 검수자', email: owner })), owner)
  await page.goto(`/${profileHash}`)
  await expect(page.locator('.cpp-nick')).toHaveText(seed.nick)
  await page.evaluate(() => document.fonts.ready)
}
async function setLanguage(page: Page, language: ClientLanguage) {
  await page.evaluate(language => {
    // Exercise the real cross-tab preference subscriber without a transient
    // dynamic-import promise on every iteration of this matrix.
    localStorage.setItem('tethLang', language); localStorage.setItem('tethCurrency', 'KRW')
    window.dispatchEvent(new StorageEvent('storage', { key: 'tethLang', newValue: language, storageArea: localStorage }))
  }, language)
}
const account = (page: Page) => page.evaluate(key => sessionStorage.getItem(key), accountKey)
async function noOverflow(page: Page) {
  const widths = await page.evaluate(() => [document.documentElement, document.body, document.getElementById('research-main'), document.querySelector('.cpp')].filter((node): node is HTMLElement => node instanceof HTMLElement).map(node => ({ width: node.clientWidth, scroll: node.scrollWidth, name: node.className || node.tagName })))
  for (const row of widths) expect(row.scroll, row.name).toBeLessThanOrEqual(row.width + 1)
}
async function geometry(page: Page) {
  return page.locator('.cpp').evaluate(node => ({
    points: node.querySelector('.cpp-curve polyline')?.getAttribute('points'),
    color: node.querySelector('.cpp-curve polyline')?.getAttribute('stroke'),
    donut: [...node.querySelectorAll('.cpp-dn circle')].map(circle => [circle.getAttribute('stroke-dasharray'), circle.getAttribute('stroke-dashoffset'), circle.getAttribute('stroke')]),
    bars: [...node.querySelectorAll('.cpp-wk i')].map(bar => [bar.getAttribute('style'), bar.className]),
    distribution: node.querySelector('.cpp-plbar .w')?.getAttribute('style'),
    tones: [...node.querySelectorAll('.cpp-grid b')].map(value => value.className),
  }))
}

test('프로필 표시 adapter는 MDD 경계·한국어 원문·알 수 없는 자산과 사용자 문구를 보존한다', () => {
  for (const mdd of [0, 0.1, 14.9, 15, 99.9]) {
    const note = copyTraderAiNote('mdd', { mdd }), before = JSON.stringify(note)
    for (const lang of languages) {
      const translated = copyProfileSourceText(lang, note.t)
      expect(translated).toContain(mdd.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
      expect(translated).not.toMatch(/\{\w+\}/)
      if (lang === 'ko') expect(translated).toBe(note.t)
      else expect(translated).not.toMatch(/[가-힣]/)
    }
    expect(JSON.stringify(note)).toBe(before)
  }
  for (const lang of languages) {
    for (const original of ['<사용자 소개>', '최대 낙폭이 15%인 내 전략', '기타 자산 전략']) expect(copyProfileSourceText(lang, original)).toBe(original)
    for (const asset of ['BTC/USDT', '<나만의 자산>', 'toString']) expect(copyProfileAsset(lang, asset)).toBe(asset)
    for (const asset of ['비트코인', '이더리움', '나스닥', '기타']) if (lang === 'ko') expect(copyProfileAsset(lang, asset)).toBe(asset); else expect(copyProfileAsset(lang, asset)).not.toMatch(/[가-힣]/)
  }
  expect(copyProfileText('ko', '수익 {wins}회, 손실 {losses}회 (기간 내 {total}회 청산)', { wins: 2, losses: 1, total: 3 })).toBe('수익 2회, 손실 1회 (기간 내 3회 청산)')
  expect(copyProfileText('fr', '기간 손익')).toContain('pertes')
  expect(copyProfileText('fr', '손익 캘린더')).toContain('pertes')
  expect(copyProfileText('zh-CN', '주간 순익 {count}주', { count: 13 })).toBe('每周净收益，共13周')
})

for (const width of [320, 1440]) test(`프로필 ${width}px 7언어·4기간: 지표/곡선/도넛/알림/DOM 보존`, async ({ page }) => {
  const errors: string[] = [], mutations: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.url()) })
  await page.setViewportSize({ width, height: 1000 }); await open(page)
  await page.locator('.cpp-acts').getByRole('button', { name: '알림받기', exact: true }).click()
  const before = await account(page), url = page.url(), curve = await page.locator('.cpp-curve svg').elementHandle()
  const donut = await page.locator('.cpp-dn svg').elementHandle(), periods = page.locator('.cpp-pd')
  for (const days of [7, 30, 90, 180] as const) {
    await periods.getByRole('button', { name: `${days}일`, exact: true }).click()
    const originalGeometry = await geometry(page), projection = projectCopyTraderProfile(seed, days), p = projection.performance
    for (const lang of languages) {
      await setLanguage(page, lang)
      await expect(periods.getByRole('button', { name: copyProfileText(lang, '{days}일', { days }), exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expect(periods.getByRole('button', { name: copyProfileText(lang, '{days}일', { days }), exact: true })).toBeFocused()
      await expect(page.locator('.cpp-acts').getByRole('button', { name: copyProfileText(lang, '알림 끄기'), exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('.cpp-grid .cpp-kpi')).toHaveCount(8)
      await expect(page.locator('.cpp-grid .cpp-kpi').first().locator('b')).toHaveText(`${p.roi >= 0 ? '+' : ''}${sharedNumber(p.roi, lang, 2)}%`)
      await expect(page.locator('.cpp-curve svg')).toHaveAccessibleName(copyProfileText(lang, '검증 구간 누적 수익 곡선'))
      await expect(page.locator('.cpp-curve svg')).toHaveAttribute('data-point-count', String(p.eq.length))
      await expect(page.locator('.cpp-ai').nth(1)).toContainText(copyProfileSourceText(lang, projection.mddNote.t))
      await expect(page.locator('.cpp-wk i').first()).toHaveAttribute('title', copyProfileText(lang, '{week}주: {amount}', { week: 1, amount: `${projection.weeklyBars.bars[0].value.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT` }))
      expect(await geometry(page)).toEqual(originalGeometry)
      expect(await curve!.evaluate(node => node.isConnected)).toBe(true)
      expect(await donut!.evaluate(node => node.isConnected)).toBe(true)
      expect(await account(page)).toBe(before); expect(page.url()).toBe(url)
      if (lang !== 'ko') expect(await page.locator('.cpp').evaluate(node => { const clone = node.cloneNode(true) as HTMLElement; clone.querySelectorAll('.cpp-nick,.cpp-ava').forEach(n => n.remove()); return clone.textContent })).not.toMatch(/[가-힣]|₩|\{\w+\}/)
      await noOverflow(page)
      if (lang === 'fr' && days === 180) await page.screenshot({ path: `/tmp/teth-copy-profile-fr-${width}.png`, fullPage: true })
    }
  }
  await page.locator('.cpp-dn').scrollIntoViewIfNeeded()
  await setLanguage(page, 'fr')
  await page.screenshot({ path: `/tmp/teth-copy-profile-charts-fr-${width}.png`, fullPage: true })
  expect(errors).toEqual([]); expect(mutations).toEqual([])
})

for (const width of [320, 1440]) test(`프로필 ${width}px 5탭·7언어·상세 캘린더·설정 연결`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); await open(page)
  const before = await account(page), history = await page.evaluate(() => window.history.length)
  await page.getByRole('group', { name: '기간 선택' }).getByRole('button', { name: '180일', exact: true }).click()
  for (const [tab, label] of Object.entries(copyProfileTabs)) {
    await page.locator('.cpp-tabs').getByRole('button', { name: label, exact: true }).click()
    const element = await page.locator('.cpp-tabs [aria-pressed=true]').elementHandle(), address = page.url()
    for (const lang of languages) {
      await setLanguage(page, lang)
      await expect(page.locator('.cpp-tabs').getByRole('button', { name: copyProfileText(lang, label), exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('.cpp-tabs')).toHaveAccessibleName(copyProfileText(lang, '트레이더 정보'))
      expect(await element!.evaluate(node => node.isConnected)).toBe(true)
      expect(await account(page)).toBe(before); expect(page.url()).toBe(address)
      expect(await page.evaluate(() => window.history.length)).toBe(history)
      if (lang !== 'ko') expect(await page.locator('.cpp').evaluate(node => { const clone = node.cloneNode(true) as HTMLElement; clone.querySelectorAll('.cpp-nick,.cpp-ava').forEach(n => n.remove()); return clone.textContent })).not.toMatch(/[가-힣]|₩|\{\w+\}/)
      if (tab === 'ov') await expect(page.locator('.cpp-pd [aria-pressed=true]')).toHaveText(copyProfileText(lang, '{days}일', { days: 180 }))
      else await expect(page.locator('.cpp-empty')).toBeVisible()
      await noOverflow(page)
      if (tab === 'cal' && lang === 'fr') {
        await page.locator('.cpp-empty').scrollIntoViewIfNeeded()
        await page.screenshot({ path: `/tmp/teth-copy-profile-calendar-fr-${width}.png`, fullPage: true })
      }
    }
  }
  await page.locator('.cpp-tabs').getByRole('button', { name: '손익 캘린더', exact: true }).click()
  await setLanguage(page, 'fr')
  await page.getByRole('button', { name: copyProfileText('fr', '전략 상세에서 캘린더 보기'), exact: true }).click()
  await expect(page.locator('.ss3-dtitle')).toContainText(seed.nick)
  await page.goBack()
  await expect(page.locator('.cpp-tabs [aria-pressed=true]')).toHaveText(copyProfileText('fr', '손익 캘린더'))
  await page.locator('.cpp-acts').getByRole('button', { name: copyTradingLabel('fr', '카피하기'), exact: true }).click()
  await expect(page.locator('.cps-in input')).toHaveAccessibleName(copyProfileText('fr', '카피 금액'))
  expect(await account(page)).toBe(before)
})

test('게스트의 지역화된 카피 시작은 기존 로그인 경계로 이어지고 계좌를 만들지 않는다', async ({ page }) => {
  await open(page, false); await setLanguage(page, 'en')
  await page.locator('.cpp-acts').getByRole('button', { name: copyTradingLabel('en', '카피하기'), exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await account(page)).toBeNull()
})
