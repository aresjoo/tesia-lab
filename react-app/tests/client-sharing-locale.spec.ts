import { expect, test, type Page } from '@playwright/test'
import listCopy from '../src/client-strategy-list-copy.json' with { type: 'json' }
import { sourceSharedStrategies } from '../src/client-shared-strategies'
import { sharedHash } from '../src/client-shared-navigation'
import { sharingCopy } from '../src/client-sharing-copy'
import type { ClientLanguage } from '../src/client-preferences'
import { revealSourceSharingCard } from './fixtures/source-sharing-page-helper'

const owner = 'sharing-locale@example.test'
const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
const userTitle = '사용자 원문 <전략> №7'
const preferencesKey = `teth-sharing-preferences:account:${encodeURIComponent(owner)}`

test('확정사전33키7언어는한국어원문·0·사용자치환문자와기존따라하기번역을보존한다', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const path = '/src/client-sharing-copy.ts', existing = '/src/client-research-copy.ts'
    const { CLIENT_SHARING_COPY: dictionary, sharingCopy } = await import(path), { researchCopy } = await import(existing)
    const keys = Object.keys(dictionary.ko), languages = Object.keys(dictionary)
    return { count: keys.length, languages, koExact: keys.every(key => dictionary.ko[key] === key),
      rows: languages.map(language => ({ language, keys: Object.keys(dictionary[language]), allStrings: keys.every(key => typeof dictionary[language][key] === 'string' && dictionary[language][key].length > 0),
        zero: sharingCopy(language, '승률 ({count}회)', { count: 0 }),
        raw: sharingCopy(language, '{nick} 검증 구간 누적 수익 곡선', { nick: '{count}<tag>', count: 99 }),
        follow: sharingCopy(language, '따라하기'), priorFollow: researchCopy(language, 'follow') })), keys }
  })
  expect(result.count).toBe(33)
  expect(result.languages).toEqual(languages)
  expect(result.koExact).toBe(true)
  for (const row of result.rows) {
    expect(row.keys).toEqual(result.keys)
    expect(row.allStrings).toBe(true)
    expect(row.zero).toContain('0'); expect(row.zero).not.toContain('{count}')
    expect(row.raw).toContain('{count}<tag>'); expect(row.raw).not.toContain('99')
    expect(row.follow).toBe(row.priorFollow)
  }
})

async function language(page: Page, value: string) {
  // Keep the exact Promise awaited by CDP alive until Node receives its result.
  // The real preference setter and every UI assertion remain unchanged.
  try {
    await page.evaluate(value => {
      const path = '/src/client-preferences.ts'
      const pending = import(path).then(({ setClientPreference }) => setClientPreference('language', value))
      Reflect.set(window, '__tethSharingLocaleSetupPromise', pending)
      return pending
    }, value)
  } finally {
    await page.evaluate(() => { Reflect.deleteProperty(window, '__tethSharingLocaleSetupPromise') })
  }
  await expect(page.locator('html')).toHaveAttribute('lang', value)
}

async function open(page: Page, own = false, score = 81) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, own, userTitle, score }) => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '공유 언어 검수자', email: owner }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: null, homeDraft: '원문 초안 <keep>', sessions: [], sharedFollows: [] }))
    sessionStorage.setItem(`teth-client-subscription-intent:account:${encodeURIComponent(owner)}`, JSON.stringify({ sessionId: 'unchanged-session', cycle: 'month' }))
    if (own) {
      const record = { id: '17001', name: userTitle, asset: '이더리움', parameters: null, score, ret: 7.1, mdd: -4.2, n: 23, winRate: 61.5, createdAt: 17001, status: 'ready', environment: 'paper', capital: 5000000, exchangeId: 'binance', exchangeName: 'Binance', version: 'v1.0' }
      sessionStorage.setItem(`teth-client-user-strategies:${encodeURIComponent(owner)}`, JSON.stringify([{ sessionId: 'own-source-session', record }]))
      sessionStorage.setItem(`teth-client-strategy-creator:${encodeURIComponent(owner)}`, JSON.stringify({ visible: true, publication: { sourceId: record.id, name: userTitle, asset: record.asset, parameters: null, score: record.score, ret: record.ret, mdd: record.mdd, n: record.n, winRate: record.winRate, description: '사용자가 작성한 설명 <원문>', publishedAt: '2026-09-15' } }))
    }
  }, { owner, own, userTitle, score })
  await page.goto('/#/share')
  await expect(page.locator('.client-strategy-sharing')).toBeVisible()
  // A published owned card follows the 31 source definitions; reach its real
  // page rather than assuming the entire catalogue is mounted at once.
  if (own) await revealSourceSharingCard(page, '[data-creator-card]')
}

test('영어로바꾸면새목록의판단방식·시장·정렬·검색접근성라벨에한국어가남지않는다', async ({ page }) => {
  await open(page)
  await language(page, 'en')
  await expect(page.locator('.ss3-tabs')).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Decision method' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Market: All markets', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Sort by', exact: true })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: '전략 검색', exact: true })).toHaveCount(0)
})

const domainState = (page: Page) => page.evaluate(key => ({
  preference: localStorage.getItem(key),
  session: Object.fromEntries(Object.entries(sessionStorage).filter(([name]) => name === 'teth-client-profile-preview' || name === 'teth-client-experience' || name.startsWith('teth-client-user-strategies:') || name.startsWith('teth-client-strategy-creator:') || name.startsWith('teth-client-subscription-intent:'))),
}), preferencesKey)

async function selectOption(page: Page, dropdown: number, option: number) {
  if (dropdown === 0) { await page.locator('.strategy-list-sort select').selectOption({ index: option }); return }
  await page.locator('.tfbk-drop').first().click()
  await page.getByRole('listbox').getByRole('option').nth(option).click()
}

test('언어전환은목록·관리주소와정렬·시장·검색입력DOM·owner저장을초기화하지않는다', async ({ page }) => {
  await open(page)
  await selectOption(page, 0, 1)
  await selectOption(page, 0, 1)
  await selectOption(page, 1, 1)
  const search = page.getByRole('searchbox')
  await search.fill('BTC')
  const handle = await search.elementHandle()
  const before = await domainState(page), href = page.url()
  const titles = await page.locator('article.tfbk-card .skf-nm h3').allTextContents()
  expect(titles.length).toBeGreaterThan(0)
  for (const value of languages) {
    await language(page, value)
    await expect(search).toHaveValue('BTC')
    expect(await search.evaluate((node, original) => node === original, handle)).toBe(true)
    expect(await domainState(page)).toEqual(before)
    expect(page.url()).toBe(href)
    expect(await page.locator('article.tfbk-card .skf-nm h3').allTextContents()).toEqual(titles)
    await expect(page.locator('.ss3-tabs')).toHaveCount(0)
  }
  await page.evaluate(() => { location.hash = '#/share/library' })
  await expect(page.locator('#research-title')).toHaveText(sharingCopy('fr', '따라가는 중'))
  await expect(page.locator('.ss3-empty')).toBeVisible()
  const followed = await domainState(page)
  for (const value of languages) {
    await language(page, value)
    await expect(page).toHaveURL(/#\/share\/library$/)
    await expect(page.locator('#research-title')).toHaveText(sharingCopy(value, '따라가는 중'))
    expect(await domainState(page)).toEqual(followed)
  }
})

test('보존된기존상세의기간route·누적수익·차트DOM은언어변경에보존된다', async ({ page }) => {
  await open(page)
  const nick = sourceSharedStrategies()[0].nick
  await page.evaluate(hash => { location.hash = hash }, sharedHash({ nick, period: 'all' }))
  await page.locator('.ss3-pp button').last().click()
  const href = page.url(), before = await domainState(page), amount = await page.locator('[data-metric="ret"] b').innerText()
  const chart = page.locator('.client-shared-equity-chart .ss3-chart').first()
  // Actual source chart root, not a synthetic replacement fixture.
  await expect(chart).toBeVisible()
  const chartHandle = await chart.elementHandle()
  for (const value of languages) {
    await language(page, value)
    expect(page.url()).toBe(href)
    await expect(page.locator('.ss3-dtitle')).toContainText(nick)
    expect((await page.locator('[data-metric="ret"] b').innerText()).replace(',', '.')).toBe(amount.replace(',', '.'))
    expect(await domainState(page)).toEqual(before)
    expect(await chart.evaluate((node, original) => node === original, chartHandle)).toBe(true)
  }
})

test('새카탈로그의표시기간·누적수익·차트초점과관측지점은7언어에보존된다', async ({ page }) => {
  await open(page)
  const first = page.locator('article.tfbk-card').first(), title = await first.locator('.skf-nm h3').innerText()
  await first.getByRole('link').click()
  const period = page.locator('.catalogue-chart-controls select')
  await period.selectOption('365')
  const chart = page.locator('.catalogue-overview-svg')
  await chart.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight')
  const handle = await chart.elementHandle(), before = await domainState(page), href = page.url()
  const selected = await chart.locator('[data-selected-index]').getAttribute('data-selected-index')
  const amount = await page.locator('[data-catalogue-metric="ret"] b').innerText()
  for (const value of languages) {
    await language(page, value)
    await expect(page.locator('.ss3-dtitle')).toHaveText(title)
    await expect(period).toHaveValue('365')
    await expect(chart).toBeFocused()
    await expect(chart.locator('[data-selected-index]')).toHaveAttribute('data-selected-index', selected!)
    expect(await chart.evaluate((node, original) => node === original, handle)).toBe(true)
    expect((await page.locator('[data-catalogue-metric="ret"] b').innerText()).replace(',', '.')).toBe(amount.replace(',', '.'))
    expect(await domainState(page)).toEqual(before)
    expect(page.url()).toBe(href)
  }
})

test('요약전용 소수 점수도 7언어 표시만 바꾸고 정밀도·저장값을 보존한다', async ({ page }) => {
  await open(page, true, 81.12345)
  const before = await domainState(page), card = page.locator('[data-creator-card]')
  for (const value of languages) {
    await language(page, value)
    const score = value === 'es' || value === 'fr' ? '81,12345' : '81.12345'
    await expect(card.locator('.rtrow')).toHaveCount(0)
    await card.getByRole('link').click()
    await expect(page.locator('.ss3-matrix b').nth(1)).toContainText(score)
    expect(await domainState(page)).toEqual(before)
    await page.locator('.tfbk-bc button').click()
  }
})

test('내공개원문제목·설명·저장원금과요약성과는7언어에서변하지않는다', async ({ page }) => {
  await open(page, true)
  await page.locator('[data-creator-card]').getByRole('link').click()
  await expect(page).toHaveURL(/#\/share\/s\/me$/)
  const before = await domainState(page)
  const numbers = await page.locator('.ss3-matrix b').allTextContents()
  for (const value of languages) {
    await language(page, value)
    await expect(page.locator('.ss3-dtitle')).toContainText(userTitle)
    await expect(page.locator('.client-strategy-sharing')).toContainText('사용자가 작성한 설명 <원문>')
    expect(await domainState(page)).toEqual(before)
    expect((await page.locator('.ss3-matrix b').allTextContents()).map(text => text.replace(/,/g, '.').match(/[-+]?\d+(?:\.\d+)?/g))).toEqual(numbers.map(text => text.replace(/,/g, '.').match(/[-+]?\d+(?:\.\d+)?/g)))
    await expect(page.locator('.client-shared-equity-chart')).toHaveCount(0)
  }
})

const copies = [
  { lang: 'ko', tabs: ['전략 찾기', '따라가는 중', '내 전략'], sort: '정렬 기준', byReturn: '검증 수익순', search: '전략 검색', placeholder: '전략 또는 작성자 검색', details: '자세히', actions: ['따라하기', 'TETH에게 분석시키기', '관심 전략', '전략 링크 복사'] },
  { lang: 'en', tabs: ['Explore strategies', 'Following', 'My strategies'], sort: 'Sort by', byReturn: 'By validation return', search: 'Search strategies', placeholder: 'Search strategy or author', details: 'Details', actions: ['Follow', 'Ask TETH to analyze', 'Watchlist', 'Copy strategy link'] },
  { lang: 'ja', tabs: ['戦略を探す', 'フォロー中', 'マイ戦略'], sort: '並び替え', byReturn: '検証リターン順', search: '戦略を検索', placeholder: '戦略または作成者を検索', details: '詳細', actions: ['フォロー', 'TETHに分析を依頼', 'お気に入り戦略', '戦略リンクをコピー'] },
  { lang: 'zh-CN', tabs: ['发现策略', '正在跟随', '我的策略'], sort: '排序方式', byReturn: '按验证收益', search: '搜索策略', placeholder: '搜索策略或作者', details: '详情', actions: ['跟随', '让TETH分析', '关注策略', '复制策略链接'] },
  { lang: 'zh-TW', tabs: ['探索策略', '正在跟隨', '我的策略'], sort: '排序依據', byReturn: '依驗證收益', search: '搜尋策略', placeholder: '搜尋策略或作者', details: '詳細資訊', actions: ['跟隨', '讓TETH分析', '關注策略', '複製策略連結'] },
  { lang: 'es', tabs: ['Explorar estrategias', 'Siguiendo', 'Mis estrategias'], sort: 'Ordenar por', byReturn: 'Por rentabilidad de validación', search: 'Buscar estrategias', placeholder: 'Buscar estrategia o autor', details: 'Detalles', actions: ['Seguir', 'Pedir análisis a TETH', 'Estrategias favoritas', 'Copiar enlace de la estrategia'] },
  { lang: 'fr', tabs: ['Explorer les stratégies', 'Suivis', 'Mes stratégies'], sort: 'Trier par', byReturn: 'Par rendement de validation', search: 'Rechercher des stratégies', placeholder: 'Rechercher une stratégie ou un auteur', details: 'Détails', actions: ['Suivre', 'Demander une analyse à TETH', 'Stratégies favorites', 'Copier le lien de la stratégie'] },
]
const catalogueHeaders: Record<string, string[]> = {
  ko: ['전략 복사하기', '직접 검증하기', '즐겨찾기', '링크 복사'],
  en: ['Copy strategy', 'Backtest it yourself', 'Favorite', 'Copy link'],
  ja: ['戦略をコピー', '自分で検証', 'お気に入り', 'リンクをコピー'],
  'zh-CN': ['复制策略', '自行回测', '收藏', '复制链接'],
  'zh-TW': ['複製策略', '自行回測', '收藏', '複製連結'],
  es: ['Copiar estrategia', 'Probar personalmente', 'Favorito', 'Copiar enlace'],
  fr: ['Copier la stratégie', 'Tester soi-même', 'Favori', 'Copier le lien'],
}

for (const copy of copies) test(`${copy.lang}현재카탈로그원문header와보존legacy공통라벨을각근거에표시한다`, async ({ page }) => {
  await open(page)
  const first = page.locator('article.tfbk-card').first(), nick = await first.locator('.skf-nm h3').innerText()
  await language(page, copy.lang)
  await expect(page.locator('.ss3-tabs')).toHaveCount(0)
  const select = page.getByRole('combobox', { name: copy.sort, exact: true })
  await expect(select).toHaveValue('pick')
  await expect(select.locator('option').first()).toHaveText(listCopy[copy.lang as keyof typeof listCopy].recommended)
  await expect(page.getByRole('searchbox', { name: copy.search, exact: true })).toHaveAttribute('placeholder', copy.search)
  await expect(first.getByRole('button')).toHaveCount(0)
  await first.getByRole('link').click()
  await expect(page.locator('.ss3-dtitle')).toContainText(nick)
  const currentCopy = catalogueHeaders[copy.lang]
  await expect(page.locator('.catalogue-source-header .shared-detail-actions > button')).toHaveText(currentCopy.slice(0, 2))
  await expect(page.locator('.shared-detail-watch')).toHaveText(currentCopy[2])
  await expect(page.locator('.shared-detail-share')).toHaveAttribute('aria-label', currentCopy[3])
  // These original labels still belong to the preserved shared-strategy
  // consumer; they must not be assigned to a current catalogue definition.
  const legacy = sourceSharedStrategies()[0]
  await page.evaluate(hash => { location.hash = hash }, sharedHash({ nick: legacy.nick, period: 'all' }))
  await expect(page.locator('.ss3-dtitle')).toHaveText(legacy.nick)
  await expect(page.locator('.shared-detail-actions button')).toHaveText(copy.actions.slice(0, 2))
  await expect(page.locator('.shared-detail-watch')).toHaveText(copy.actions[2])
  await expect(page.locator('.shared-detail-share')).toHaveAttribute('aria-label', copy.actions[3])
})

test('스페인어·프랑스어원본즐겨찾기는전략복사와구별되며watch키만변경한다', async ({ page }) => {
  await open(page, true)
  const first = page.locator('article.tfbk-card').first()
  const href = await first.getByRole('link').getAttribute('href')
  const id = decodeURIComponent(href!.split('/').at(-1)!)
  await first.getByRole('link').click()
  const watchKey = `teth-sharing-watch:account:${encodeURIComponent(owner)}`
  for (const [value, add, remove, follow] of [
    ['es', 'Favorito', 'Quitar favorito', 'Copiar estrategia'],
    ['fr', 'Favori', 'Retirer le favori', 'Copier la stratégie'],
  ]) {
    await language(page, value)
    const before = await domainState(page), route = page.url()
    const bytes = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
    const actions = page.locator('.shared-detail-head')
    await actions.getByRole('button', { name: add, exact: true }).click()
    await expect(actions.getByRole('button', { name: remove, exact: true })).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), watchKey)).toEqual([id])
    expect(await domainState(page)).toEqual(before)
    const after = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
    expect([...new Set([...Object.keys(bytes), ...Object.keys(after)])].filter(key => bytes[key] !== after[key])).toEqual([watchKey])
    expect(page.url()).toBe(route)
    await expect(actions.getByRole('button', { name: follow, exact: true })).toBeEnabled()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await actions.getByRole('button', { name: remove, exact: true }).click()
    await expect(actions.getByRole('button', { name: add, exact: true })).toHaveAttribute('aria-pressed', 'false')
    expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), watchKey)).toEqual([])
    expect(await domainState(page)).toEqual(before)
    expect(page.url()).toBe(route)
    await expect(actions.getByRole('button', { name: follow, exact: true })).toBeEnabled()
  }
})

test('native 정렬의 값과 초점은 언어 전환에도 같은 노드에 남는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await open(page); await selectOption(page, 0, 1)
  const select = page.locator('.strategy-list-sort select')
  await select.focus()
  const handle = await select.elementHandle(), before = await domainState(page)
  for (const value of languages) {
    await language(page, value)
    await expect(select).toHaveAccessibleName(copies.find(copy => copy.lang === value)!.sort)
    await expect(select).toBeFocused(); await expect(select).toHaveValue('ret')
    expect(await select.evaluate((node, original) => node === original, handle)).toBe(true)
    expect(await domainState(page)).toEqual(before)
    const bounds = (await select.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(320)
  }
})

for (const value of languages) for (const width of [320, 375, 390, 480, 481, 1440, ...(value === 'en' ? [383, 384, 385] : []), ...(['es', 'fr'].includes(value) ? [520, 521] : [])]) test(value + ' ' + width + 'px 긴 정렬 라벨은 선택상자와 이웃 경계를 보존한다', async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await open(page); await language(page, value)
  await page.evaluate(() => document.fonts.ready)
  const select = page.locator('.strategy-list-sort select')
  await select.scrollIntoViewIfNeeded()
  const original = await select.elementHandle()
  // Measure each actual selection: the row may legitimately expand only for
  // long selected values while retaining the source's short default layout.
  for (const selected of ['pick', 'ret', 'fw', 'pick']) {
    await select.selectOption(selected)
    await select.focus()
    await expect(select).toBeFocused(); await expect(select).toHaveValue(selected)
    expect(await select.evaluate((node, before) => node === before, original)).toBe(true)
    const geometry = await select.evaluate(el => {
      const s = getComputedStyle(el), box = el.getBoundingClientRect()
      const context = document.createElement('canvas').getContext('2d')!
      // CSS font shorthand can be empty with variable-font longhands. An empty
      // assignment silently leaves canvas at 10px and falsely passes clipping.
      context.font = s.font || `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`
      return { needed: context.measureText((el as HTMLSelectElement).selectedOptions[0].text).width,
        available: el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight),
        fontSize: s.fontSize, measuredFont: context.font,
        hit: el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) }
    })
    expect.soft(geometry.needed, `${value}/${width}/${selected}: ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(geometry.available + 1)
    expect(Number(geometry.measuredFont.match(/(?:^|\s)([\d.]+)px(?:\s|\/)/)?.[1])).toBe(parseFloat(geometry.fontSize))
    expect(geometry.hit).toBe(true)
    // Check the actual select decoration without substituting a DOM text mock.
    const options = await select.evaluate(el => {
      const style = getComputedStyle(el), canvas = document.createElement('canvas').getContext('2d')!
      canvas.font = style.font || `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      return { appearance: style.appearance, arrow: style.backgroundImage, measuredFont: canvas.font, fontSize: style.fontSize,
        available: el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        width: canvas.measureText((el as HTMLSelectElement).selectedOptions[0].text).width }
    })
    expect(options.appearance).toBe('none')
    expect(Number(options.measuredFont.match(/(?:^|\s)([\d.]+)px(?:\s|\/)/)?.[1])).toBe(parseFloat(options.fontSize))
    expect(options.arrow).toContain('data:image/svg+xml')
    expect.soft(options.width).toBeLessThanOrEqual(options.available + 1)
    const market = page.locator('.tfbk-drop')
    const marketText = await market.locator('span').first().evaluate(el => {
      const range = document.createRange(); range.selectNodeContents(el)
      const text = range.getBoundingClientRect(), box = el.getBoundingClientRect()
      return { fits: text.left >= box.left - 1 && text.right <= box.right + 1,
        unclipped: el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1 }
    })
    expect(marketText).toEqual({ fits: true, unclipped: true })
    if (width === 375 || geometry.needed > geometry.available + 1) await page.screenshot({ path: info.outputPath(`sharing-${value}-${width}-${selected}.png`) })
    const a = (await select.boundingBox())!, b = (await page.locator('.tfbk-drop').boundingBox())!
    expect(a.x + a.width <= b.x + 1 || a.y + a.height <= b.y + 1).toBe(true)
    const stacked = width <= 480 && (selected !== 'pick' || ['es', 'fr'].includes(value))
      || width <= 384 && value === 'en'
      || width <= 520 && selected === 'ret' && ['es', 'fr'].includes(value)
    if (stacked) {
      expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1)
      expect(Math.abs(b.y - (a.y + a.height) - 8)).toBeLessThanOrEqual(1)
    }
    if (selected === 'pick' && ['ko', 'ja', 'zh-CN', 'zh-TW'].includes(value) && width <= 480) {
      expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1)
    }
    if (selected === 'pick' && value === 'en' && width >= 385 && width <= 640) {
      expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1)
    }
    if (width >= 481 && width <= 640 && !(selected === 'ret' && ['es', 'fr'].includes(value) && width <= 520)) {
      expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1)
    }
    expect(await page.evaluate(() => document.documentElement.lang)).toBe(value)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  }
  await select.focus(); await page.keyboard.press('End')
  await expect(select).toHaveValue('fw'); await expect(select).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await page.screenshot({ path: info.outputPath('sharing-' + value + '-' + width + '-selected.png') })
})

test('시장identity를보존하고선택라벨을번역해도열린메뉴는화면안에머문다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await open(page)
  await selectOption(page, 1, 1)
  const trigger = page.locator('.tfbk-drop').last()
  await trigger.click()
  const before = await domainState(page)
  await expect(trigger).toContainText('가상자산')
  expect(JSON.parse(before.preference!).market).toBe('crypto')
  for (const [value, label, selected] of [['en', 'Market', 'Crypto'], ['fr', 'Marché', 'Crypto-actifs']]) {
    // Direct preference update intentionally leaves the menu open; opening the
    // real Settings dialog would close it through the normal outside handler.
    await language(page, value)
    const menu = page.getByRole('listbox')
    await expect(menu).toHaveAccessibleName(label)
    // The saved market enum stays unchanged when its visible label translates.
    await expect(trigger).toContainText(selected)
    await expect(menu.getByRole('option', { name: selected, exact: true })).toHaveAttribute('aria-selected', 'true')
    const triggerBounds = await trigger.boundingBox()
    expect(triggerBounds!.x).toBeGreaterThanOrEqual(0)
    expect(triggerBounds!.x + triggerBounds!.width).toBeLessThanOrEqual(320)
    const sortBounds = await page.locator('.strategy-list-sort select').boundingBox()
    expect(sortBounds!.x + sortBounds!.width <= triggerBounds!.x + 1 || sortBounds!.y + sortBounds!.height <= triggerBounds!.y + 1).toBe(true)
    expect(await domainState(page)).toEqual(before)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: info.outputPath(`sharing-asset-open-${value}-320.png`) })
    const bounds = await menu.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640)
    const labelBounds = await menu.getByRole('option').first().evaluate(el => {
      const range = document.createRange(); range.selectNodeContents(el)
      const button = el.getBoundingClientRect()
      return { button: { left: button.left, right: button.right, top: button.top, bottom: button.bottom }, rects: [...range.getClientRects()].map(r => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })) }
    })
    for (const rect of labelBounds.rects) {
      expect(rect.left).toBeGreaterThanOrEqual(labelBounds.button.left - 1)
      expect(rect.right).toBeLessThanOrEqual(labelBounds.button.right + 1)
      expect(rect.top).toBeGreaterThanOrEqual(labelBounds.button.top - 1)
      expect(rect.bottom).toBeLessThanOrEqual(labelBounds.button.bottom + 1)
    }
    const scrollport = await page.locator('.client-sharing-hub').boundingBox()
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(scrollport!.y + scrollport!.height)
    const last = menu.getByRole('option').last()
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeInViewport({ ratio: 1 })
    expect(await last.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
    })).toBe(true)
  }
})

test('최신시장필터는desktop·mobile 모두44px조작높이를유지한다', async ({ page }) => {
  await open(page)
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const button of await page.locator('.tfbk-drop').all()) {
      await expect(button).toBeVisible()
      expect((await button.boundingBox())!.height).toBe(44)
    }
  }
})

test('영어상세공통동작은번역되지만전략작성자원문은유지된다', async ({ page }) => {
  await open(page)
  const card = page.locator('article.tfbk-card').first()
  const nick = await card.locator('.skf-nm h3').innerText()
  await card.getByRole('link').click()
  await expect(page.locator('.ss3-dtitle')).toContainText(nick)
  await language(page, 'en')
  expect(await page.locator('.ss3-dacts').innerText()).not.toMatch(/따라하기|분석시키기|관심 전략|전략 링크 복사/)
  await expect(page.locator('.ss3-dtitle')).toContainText(nick)
})
