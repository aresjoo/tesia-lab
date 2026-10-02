import { expect, test, type Page } from '@playwright/test'
import { revealSourceSharingCard } from './fixtures/source-sharing-page-helper'
import detailCopy from '../src/client-detail-skin-copy.json' with { type: 'json' }
import { sharedHash, sourceSharedStrategies } from '../src/client-shared-strategies'
import { sharingDetailCopy, type SharingDetailCopyKey } from '../src/client-sharing-detail-copy'
import type { ClientLanguage } from '../src/client-preferences'

const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
const owner = 'sharing-detail-locale@example.test'
const ownSource = sourceSharedStrategies().find(row => row.score >= 80)!
const oracle = {
  ko: ['검증 수익|TETH 점수|최대 낙폭 (MDD)|손익비 (Profit Factor)|평균 보유일|거래 수', '전체|최근 2년|최근 1년', '승률|수익 (CAGR)|낙폭 방어|거래 활동'],
  en: ['Validation return|TETH score|Maximum drawdown (MDD)|Profit Factor|Average holding days|Trade count', 'All|Past 2 years|Past 1 year', 'Win rate|Return (CAGR)|Drawdown defense|Trading activity'],
  ja: ['検証リターン|TETHスコア|最大ドローダウン (MDD)|損益比 (Profit Factor)|平均保有日数|取引数', '全て|過去2年|過去1年', '勝率|収益 (CAGR)|ドローダウン防御|取引活動'],
  'zh-CN': ['验证收益|TETH评分|最大回撤 (MDD)|盈亏比 (Profit Factor)|平均持仓天数|交易次数', '全部|近2年|近1年', '胜率|收益 (CAGR)|回撤防守|交易活跃度'],
  'zh-TW': ['驗證收益|TETH評分|最大回撤 (MDD)|盈虧比 (Profit Factor)|平均持倉天數|交易次數', '全部|近2年|近1年', '勝率|收益 (CAGR)|回撤防禦|交易活躍度'],
  es: ['Rentabilidad de validación|Puntuación TETH|Drawdown máximo (MDD)|Factor de beneficio (Profit Factor)|Días promedio de tenencia|Número de operaciones', 'Todo|Últimos 2 años|Último año', 'Tasa de acierto|Rendimiento (CAGR)|Defensa contra drawdown|Actividad operativa'],
  fr: ['Rendement de validation|Score TETH|Drawdown maximal (MDD)|Facteur de profit (Profit Factor)|Jours moyens de détention|Nombre de transactions', 'Tout|2 dernières années|Dernière année', 'Taux de réussite|Rendement (CAGR)|Défense contre le drawdown|Activité de trading'],
}
const definitionKeys: SharingDetailCopyKey[] = [
  '선택한 검증 구간에서 전략 규칙을 그대로 실행했을 때의 누적 수익률이에요. 수수료 0.2%가 반영돼요.',
  '승률, 수익, 낙폭, 거래 활동 4개 축을 가중 합산한 0~99점이에요. 축을 보면 이 점수가 어디서 왔는지 알 수 있어요. 전부 검증 시뮬레이션 실계산 값입니다.',
  '검증 구간에서 자산이 고점 대비 가장 많이 하락한 폭이에요. 보유 중 평가액 기준으로 계산해요.',
  '총이익을 총손실로 나눈 값이에요. 1.5:1 이면 1을 잃는 동안 1.5를 벌었다는 뜻이에요.',
  '진입부터 청산까지 평균 보유 기간이에요. 25봉이 넘으면 기간 청산 규칙이 실행돼요.',
  '검증 구간에서 발생한 체결 횟수예요. 표본이 적으면 점수에 페널티가 붙어요.',
]

async function language(page: Page, value: string) {
  await page.evaluate(async value => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(path)
    setClientPreference('language', value)
  }, value)
  await expect(page.locator('html')).toHaveAttribute('lang', value)
}

async function detail(page: Page, own = false, seedNick?: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ own, ownSource, owner }) => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '상세 언어 검수자', email: owner }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: null, homeDraft: '보존할 원문 초안', sessions: [], sharedFollows: [] }))
    if (own) {
      const { parameters, asset, score, result } = ownSource
      const record = { id: '17001', name: '사용자 공개 원문', createdAt: 17001, parameters, asset, score, ret: result.ret, mdd: result.mdd, n: result.n, winRate: result.winRate, status: 'ready', environment: 'paper', capital: 5000000, version: 'v1.0' }
      sessionStorage.setItem(`teth-client-user-strategies:${encodeURIComponent(owner)}`, JSON.stringify([{ sessionId: 'own-source', record }]))
      // Publication is committed below through the existing owner-local store.
    }
  }, { own, ownSource, owner })
  await page.goto('/#/share')
  // The second publication fixture must cross a document load, not only a hash route.
  if (own) {
    await page.reload()
    await page.evaluate(async owner => {
      const path = '/src/client-strategy-creator-store.ts'
      const { createClientStrategyCreatorStore, getCreatorCandidate } = await import(/* @vite-ignore */ path)
      const entries = JSON.parse(sessionStorage.getItem(`teth-client-user-strategies:${encodeURIComponent(owner)}`)!)
      const record = entries[0].record
      const store = createClientStrategyCreatorStore(owner, () => entries.map((entry: { record: typeof record }) => entry.record))
      store.publish({ sourceId: record.id, description: '원문 설명', expected: getCreatorCandidate(record) }, Date.UTC(2026, 8, 15))
    }, owner)
    await page.reload()
  }
  if (own) {
    await expect(page.locator('.strategy-list-card').first()).toBeVisible()
    await expect(await revealSourceSharingCard(page, '[data-creator-card]')).toBeVisible()
  }
  // These six metrics and recomputed periods belong to saved legacy details,
  // not the new 31-strategy catalogue. Exercise the retained direct URL.
  const nick = seedNick ?? sourceSharedStrategies()[0].nick
  await page.evaluate(hash => { history.pushState(null, '', hash); dispatchEvent(new Event('teth:navigate')) }, sharedHash({ nick, period: 'all' }))
  await expect(page.locator('.ss3-dtitle')).toContainText(nick)
  await expect(page.locator('.ss3-matrix button.mx')).toHaveCount(6)
  return nick
}

test('영어상세의지표·단위·기간·작성자공통문구는한국어고정값이아니다', async ({ page }) => {
  const nick = await detail(page)
  await language(page, 'en')
  expect.soft(await page.locator('.ss3-matrix small').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringContaining('검증 수익')]))
  expect.soft((await page.locator('.ss3-matrix b').allTextContents()).join(' ')).not.toMatch(/점|일|회|이익|손실/)
  expect.soft(await page.locator('.ss3-pp').innerText()).not.toMatch(/전체|개월|년/)
  expect.soft(await page.locator('.ss3-pp').getAttribute('aria-label')).not.toBe('검증 기간')
  expect.soft(await page.locator('.ss3-dsub').innerText()).not.toMatch(/작성자|검증, 거래/)
  expect.soft(await page.locator('[data-metric="ret"] small').innerText()).not.toContain('검증 수익률')
  await expect(page.locator('.ss3-dtitle')).toContainText(nick)
})

const storage = (page: Page) => page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
const numbers = (texts: string[]) => texts.map(text => text.replace(/,/g, '.').match(/[-+]?\d+(?:\.\d+)?/g))

test('지표열은320·390한열768두열1440세열의기존반응형을유지한다', async ({ page }) => {
  await detail(page)
  for (const [width, columns] of [[320, 1], [390, 1], [768, 2], [1440, 3]]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.locator('.ss3-matrix').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(columns)
  }
})

test('프랑스어320px거래수의transactions는지표안에서한줄로읽힌다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await detail(page)
  await language(page, 'fr')
  await page.evaluate(() => document.fonts.ready)
  const metric = page.locator('.ss3-matrix button.mx').nth(5)
  await metric.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('sharing-detail-fr-320-word.png') })
  const measurements = await metric.locator('small, b').evaluateAll(elements => elements.map(el => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      const start = node.textContent!.indexOf('transactions')
      if (start >= 0) {
        const range = document.createRange()
        range.setStart(node, start); range.setEnd(node, start + 'transactions'.length)
        return { count: range.getClientRects().length, width: el.getBoundingClientRect().width }
      }
    }
    return null
  }))
  expect(measurements).toHaveLength(2)
  for (const measurement of measurements) {
    expect(measurement).not.toBeNull()
    expect(measurement!.count).toBe(1)
  }
})

for (const value of languages) test(`${value}의6지표·3기간·설명·4축과정확한배점은확정사전으로연결된다`, async ({ page }) => {
  const nick = await detail(page)
  const row = sourceSharedStrategies().find(row => row.nick === nick)!
  await language(page, value)
  const [labels, periods, axes] = oracle[value].map(text => text.split('|'))
  expect((await page.locator('.ss3-matrix small').allTextContents()).map(text => text.replace('ⓘ', '').trim())).toEqual(labels)
  await expect(page.locator('.ss3-pp button')).toHaveText(periods)
  await expect(page.locator('.ss3-dsub')).toContainText(`${detailCopy[value].registeredBy} ${nick}`)
  for (let index = 0; index < 6; index++) {
    await page.locator('.ss3-matrix button.mx').nth(index).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('header h2')).toHaveText(index === 1 ? sharingDetailCopy(value, 'TETH 점수 {score}점 산출 근거', { score: row.score }) : labels[index])
    await expect(dialog.locator('.ss3-dialog-body > p').first()).toHaveText(sharingDetailCopy(value, definitionKeys[index]))
    if (index === 1) for (let axis = 0; axis < 4; axis++) {
      const item = dialog.locator('.ss3-score-axis').nth(axis)
      await expect(item.locator('div > span').first()).toContainText(axes[axis])
      await expect(item.locator('div > span').nth(1)).toContainText(`/ ${sharingDetailCopy(value, '{points}점', { points: [30, 28, 27, 15][axis] })}`)
      expect(await item.innerText()).not.toContain('000000000000')
    }
    await page.keyboard.press('Escape')
  }
})

test('각실제기간에서언어만바꾸면route·선택·결과수치·차트SVG·세션저장은유지된다', async ({ page }) => {
  const nick = await detail(page)
  for (let period = 0; period < 3; period++) {
    await page.locator('.ss3-pp button').nth(period).click()
    await expect(page.locator('.ss3-pp button').nth(period)).toHaveAttribute('aria-pressed', 'true')
    const chart = page.locator('.client-shared-equity-chart .ss3-chart')
    await expect(chart).toBeVisible()
    const handle = await chart.elementHandle(), href = page.url(), before = await storage(page)
    const metrics = numbers(await page.locator('.ss3-matrix b').allTextContents()), ret = await page.locator('[data-metric="ret"] b').innerText()
    const path = await chart.locator('path').evaluateAll(nodes => nodes.map(node => node.getAttribute('d')))
    for (const value of languages) {
      await language(page, value)
      expect(page.url()).toBe(href)
      await expect(page.locator('.ss3-pp button').nth(period)).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('.ss3-dtitle')).toContainText(nick)
      expect((await page.locator('[data-metric="ret"] b').innerText()).replace(',', '.')).toBe(ret.replace(',', '.'))
      expect(numbers(await page.locator('.ss3-matrix b').allTextContents())).toEqual(metrics)
      expect(await chart.evaluate((node, original) => node === original, handle)).toBe(true)
      expect(await chart.locator('path').evaluateAll(nodes => nodes.map(node => node.getAttribute('d')))).toEqual(path)
      expect(await storage(page)).toEqual(before)
    }
  }
})

test('열린6지표설명은언어변경으로닫기초점이나스크롤을제목으로되돌리지않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await detail(page)
  for (let index = 0; index < 6; index++) {
    await language(page, 'ko')
    const trigger = page.locator('.ss3-matrix button.mx').nth(index)
    await trigger.click()
    const dialog = page.getByRole('dialog'), close = dialog.locator('header button'), body = dialog.locator('.ss3-dialog-body')
    await expect(dialog).toBeVisible()
    await close.focus()
    const handle = await close.elementHandle()
    const top = await body.evaluate(el => { el.scrollTop = Math.min(24, el.scrollHeight - el.clientHeight); return el.scrollTop })
    for (const value of ['en', 'fr', 'ko']) {
      await language(page, value)
      await expect(close).toBeFocused()
      expect(await close.evaluate((node, original) => node === original, handle)).toBe(true)
      expect(await body.evaluate(el => el.scrollTop)).toBe(top)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  }
})

test('자기전략공개전후점수축의원본공유전략중앙값은변하지않는다', async ({ page }) => {
  const nick = await detail(page)
  await page.locator('.ss3-matrix button.mx').nth(1).click()
  const medians = await page.locator('.ss3-score-bar u').evaluateAll(nodes => nodes.map(node => ({ title: node.getAttribute('title'), left: (node as HTMLElement).style.left })))
  expect(medians).toHaveLength(4)
  await page.keyboard.press('Escape')
  await detail(page, true, nick)
  await page.locator('.ss3-matrix button.mx').nth(1).click()
  expect(await page.locator('.ss3-score-bar u').evaluateAll(nodes => nodes.map(node => ({ title: node.getAttribute('title'), left: (node as HTMLElement).style.left })))).toEqual(medians)
  const keys = ['winRate', 'cagr', 'mdd', 'tradeVol'] as const
  const displayedMedians = (rows: ReturnType<typeof sourceSharedStrategies>) => keys.map(key => {
    const values = rows.map(row => row.result[key]).sort((a, b) => a - b)
    const mid = Math.floor(values.length / 2)
    return (values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2).toFixed(1)
  })
  const seedRows = sourceSharedStrategies().filter(row => !row.me)
  const expected = displayedMedians(seedRows)
  // This publication must actually expose the old bug, even after display rounding.
  expect(displayedMedians([...seedRows, ownSource])).not.toEqual(expected)
  for (let index = 0; index < expected.length; index++) expect(medians[index].title).toContain(expected[index])
})

for (const width of [320, 1440]) test(`${width}px7언어지표행과설명문자는겹치거나화면을넘지않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width === 320 ? 640 : 900 })
  await detail(page)
  for (const value of languages) {
    await language(page, value)
    await page.evaluate(() => document.fonts.ready)
    const matrix = page.locator('.ss3-matrix')
    await matrix.scrollIntoViewIfNeeded()
    for (const metric of await matrix.locator('button.mx').all()) {
      const rects = await metric.evaluate(el => {
        const rect = el.getBoundingClientRect(), label = el.querySelector('small')!.getBoundingClientRect(), number = el.querySelector('b')!.getBoundingClientRect()
        return { bounds: { left: rect.left, right: rect.right }, label: { left: label.left, right: label.right, bottom: label.bottom }, number: { left: number.left, right: number.right, top: number.top } }
      })
      expect(rects.label.left).toBeGreaterThanOrEqual(rects.bounds.left - 1)
      expect(rects.label.right).toBeLessThanOrEqual(rects.bounds.right + 1)
      expect(rects.number.left).toBeGreaterThanOrEqual(rects.bounds.left - 1)
      expect(rects.number.right).toBeLessThanOrEqual(rects.bounds.right + 1)
      expect(rects.label.bottom).toBeLessThanOrEqual(rects.number.top + 1)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    if (value === 'en' || value === 'fr') await page.screenshot({ path: info.outputPath(`sharing-detail-${value}-${width}-metrics.png`) })
    await matrix.locator('button.mx').nth(1).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    const heading = await dialog.locator('header h2').boundingBox(), close = await dialog.locator('header button').boundingBox()
    expect(heading!.x + heading!.width).toBeLessThanOrEqual(close!.x)
    if (value === 'en' || value === 'fr') await page.screenshot({ path: info.outputPath(`sharing-detail-${value}-${width}-score.png`) })
    await page.keyboard.press('Escape')
  }
})

test('영어의여섯지표설명창과점수4축은한국어고정설명이아니다', async ({ page }) => {
  await detail(page)
  await language(page, 'en')
  for (let index = 0; index < 6; index++) {
    await page.locator('.ss3-matrix button.mx').nth(index).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    expect.soft(await dialog.locator('header h2').innerText()).not.toMatch(/[가-힣]/)
    expect.soft(await dialog.locator('.ss3-dialog-body > p').first().innerText()).not.toMatch(/[가-힣]/)
    if (index === 1) expect.soft(await dialog.locator('.ss3-score-axis').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringContaining('거래 활동')]))
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  }
})
