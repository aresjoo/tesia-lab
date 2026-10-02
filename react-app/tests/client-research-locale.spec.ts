import { expect, test, type Page } from '@playwright/test'
import { creatorCopy } from '../src/client-strategy-creator-copy'
import type { ClientLanguage } from '../src/client-preferences'
import { catalogueStrategies } from '../src/client-catalogue'
import strategyListCopy from '../src/client-strategy-list-copy.json' with { type: 'json' }
import { sharingCopy } from '../src/client-sharing-copy'
import { sharedHash, sourceSharedStrategies } from '../src/client-shared-strategies'

const originalTitle = '사용자가 작성한 연구 제목 그대로'
const locales = [
  { lang: 'ko', history: '연구 기록', search: "연구 기록 검색", today: '오늘', schedule: '예약된 검증', ranking: '전략 랭킹', sharing: '전략 공유', copy: '카피하기', off: '전략 공개를 껐어요' },
  { lang: 'en', history: 'Research history', search: "Search research history", today: 'today', schedule: 'Scheduled validations', ranking: 'Strategy rankings', sharing: 'Strategy sharing', copy: 'Copy', off: 'Public preview is off.' },
  { lang: 'ja', history: '研究履歴', search: "研究履歴を検索", today: '今日', schedule: '検証スケジュール', ranking: '戦略ランキング', sharing: '戦略の共有', copy: 'コピーする', off: '公開プレビューをオフにしました。' },
  { lang: 'zh-CN', history: '研究记录', search: "搜索研究记录", today: '今天', schedule: '验证计划', ranking: '策略排行', sharing: '策略分享', copy: '跟单', off: '已关闭公开预览。' },
  { lang: 'zh-TW', history: '研究紀錄', search: "搜尋研究記錄", today: '今天', schedule: '驗證排程', ranking: '策略排行', sharing: '策略分享', copy: '跟單', off: '已關閉公開預覽。' },
  { lang: 'es', history: 'Historial de investigación', search: "Buscar historial de investigación", today: 'hoy', schedule: 'Validaciones programadas', ranking: 'Clasificación de estrategias', sharing: 'Compartir estrategias', copy: 'Copiar', off: 'Vista previa pública desactivada.' },
  { lang: 'fr', history: 'Historique des recherches', search: "Rechercher dans l'historique de recherche", today: 'aujourd’hui', schedule: 'Validations planifiées', ranking: 'Classement des stratégies', sharing: 'Partage de stratégies', copy: 'Copier', off: 'Aperçu public désactivé.' },
]
const sharingLabels: Record<string, { find: string; mine: string; ask: string }> = {
  ko: { find: '전략 찾기', mine: '내 전략', ask: 'TETH에게 분석시키기' },
  en: { find: 'Explore strategies', mine: 'My strategies', ask: 'Ask TETH to analyze' },
  ja: { find: '戦略を探す', mine: 'マイ戦略', ask: 'TETHに分析を依頼' },
  'zh-CN': { find: '发现策略', mine: '我的策略', ask: '让TETH分析' },
  'zh-TW': { find: '探索策略', mine: '我的策略', ask: '讓TETH分析' },
  es: { find: 'Explorar estrategias', mine: 'Mis estrategias', ask: 'Pedir análisis a TETH' },
  fr: { find: 'Explorer les stratégies', mine: 'Mes stratégies', ask: 'Demander une analyse à TETH' },
}

async function seed(page: Page) {
  await page.addInitScript(title => {
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수 사용자', email: 'locale@example.test' }))
    // A research status is not publication eligibility. Seed an explicit saved
    // owner publication; no fake report/score is inferred from the chat below.
    const record = { id: '17001', name: title, asset: '비트코인', parameters: null, score: 81, ret: 7.1, mdd: -4.2, n: 23, winRate: 61.5, createdAt: 17001, status: 'ready', environment: 'paper', capital: 5000000, exchangeId: 'binance', exchangeName: 'Binance', version: 'v1.0' }
    sessionStorage.setItem(`teth-client-user-strategies:${encodeURIComponent('locale@example.test')}`, JSON.stringify([{ sessionId: 'locale-research', record }]))
    sessionStorage.setItem(`teth-client-strategy-creator:${encodeURIComponent('locale@example.test')}`, JSON.stringify({ visible: false, publication: { sourceId: record.id, name: title, asset: record.asset, parameters: null, score: record.score, ret: record.ret, mdd: record.mdd, n: record.n, winRate: record.winRate, description: '사용자가 입력한 소개', publishedAt: '2026-09-15' } }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: null, homeDraft: '', sessions: [{ id: 'locale-research', title, idea: '원문 전략', draft: '', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'conversation', researchStatus: '검토 필요', turns: [{ id: 'locale-turn', question: '원문 질문', answer: '원문 답변', fullAnswer: '원문 답변', startedAt: 1, status: 'done', suggestions: [], phase: 'plan' }], updatedAt: Date.now() }] }))
  }, originalTitle)
  await page.goto('/')
  await expect(page.locator('.client-source-app')).toBeVisible()
  await expect(page.locator('.client-research-navigation nav button')).toHaveCount(4)
}

async function selectLanguage(page: Page, language: string) {
  await page.evaluate(async value => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(path)
    setClientPreference('language', value)
  }, language)
  await expect(page.locator('html')).toHaveAttribute('lang', language)
}

async function navigate(page: Page, index: number) {
  const button = page.locator('.client-research-navigation nav button').nth(index === 3 ? 2 : index)
  if (!(await button.isVisible())) {
    const trigger = (page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button'
    await page.locator(trigger).click()
  }
  await button.click()
}

test('연구 메뉴 7언어 전환은 검색·날짜·빈 상태·랭킹·공유 UI와 원문 제목을 보존한다', async ({ page }) => {
  await seed(page)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const locale of locales) {
    await selectLanguage(page, locale.lang)
    await navigate(page, 0)
    await expect(page.locator('#research-title')).toHaveText(locale.history)
    const search = page.getByRole('searchbox', { name: locale.search, exact: true })
    await expect(search).toBeVisible()
    await expect(page.locator('.g-hist-row .t')).toHaveText(originalTitle)
    await expect(page.locator('.g-hist-row time')).toHaveText(locale.today)
    await search.fill(originalTitle)
    await expect(page.locator('.g-hist-row')).toHaveCount(1)
    await search.fill('missing-unmatched-query')
    await expect(page.locator('.hub-empty')).toBeVisible()
    await expect(page.locator('.g-hist-announcement')).toContainText('0')
    if (locale.lang !== 'ko') await expect(page.locator('.hub-empty')).not.toContainText('검색 결과')
    await search.fill('')
    await navigate(page, 2)
    // Latest source lists the 31-strategy catalogue without find/mine tabs.
    await expect(page.locator('#research-title')).toHaveText(strategyListCopy[locale.lang as ClientLanguage].title)
    await expect(page.locator('.strategy-list-grid article h3')).toHaveText(catalogueStrategies.slice(0, 10).map(strategy => strategy.name))
    await page.evaluate(() => { history.pushState(null, '', '#/share/publishing'); dispatchEvent(new Event('teth:navigate')) })
    await expect(page.locator('#research-title')).toHaveText(sharingCopy(locale.lang as ClientLanguage, '내 전략'))
    await expect(page.locator('.ss3-creator-name')).toHaveText(originalTitle)
    await expect(page.getByRole('switch')).toHaveAccessibleName(creatorCopy(locale.lang as ClientLanguage, '랭킹 공개'))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  }
  expect(errors).toEqual([])
})

test('사이드바에서제거된예약소비자의7언어빈상태는독립표시경계에서보존된다', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    const runtimeHelperPath = '/tests/fixtures/client-react-runtime.ts'
    const { testClientReactRuntimePaths } = await import(/* @vite-ignore */ runtimeHelperPath)
    const runtimePaths = await testClientReactRuntimePaths()
    const hubPath = '/src/components/ClientResearchHub.tsx', reactPath = runtimePaths.reactPath, domPath = runtimePaths.rootPath
    const { createElement } = (await import(reactPath)).default, { createRoot } = (await import(domPath)).default
    const { ClientResearchHub } = await import(hubPath)
    document.getElementById('root')!.style.display = 'none'
    const host = document.createElement('div'); document.body.append(host)
    createRoot(host).render(createElement(ClientResearchHub, { page: 'schedule', records: [], onSelect() {}, onNew() {}, onFollow() {}, onReturn() {} }))
  })
  for (const locale of locales) {
    await selectLanguage(page, locale.lang)
    await expect(page.locator('#research-title')).toHaveText(locale.schedule)
    await expect(page.locator('.hub-empty p')).toBeVisible()
    if (locale.lang !== 'ko') await expect(page.locator('.hub-empty p')).not.toContainText('예약된 검증')
  }
})

test('표시 중인 공유 알림은 언어와 함께 바뀌고 따라하기의 전략 원문은 변하지 않는다', async ({ page }) => {
  await seed(page)
  await page.evaluate(() => { history.pushState(null, '', '#/share/publishing'); dispatchEvent(new Event('teth:navigate')) })
  await page.getByRole('switch').click()
  await expect(page.getByRole('switch')).toBeChecked()
  await page.getByRole('switch').click()
  for (const locale of locales) {
    await selectLanguage(page, locale.lang)
    await expect(page.locator('.client-strategy-sharing [role="status"]')).toHaveText(creatorCopy(locale.lang as ClientLanguage, '전략 공개를 껐어요'))
    await expect(page.getByRole('switch')).not.toBeChecked()
    await expect(page.locator('.ss3-creator-name')).toHaveText(originalTitle)
  }
  const currentLanguage = (await page.locator('html').getAttribute('lang'))!
  // Existing saved strategies keep their exact legacy detail/analysis source.
  const nick = sourceSharedStrategies()[0].nick
  await page.evaluate(hash => { history.pushState(null, '', hash); dispatchEvent(new Event('teth:navigate')) }, sharedHash({ nick, period: 'all' }))
  await page.getByRole('button', { name: sharingLabels[currentLanguage].ask, exact: true }).click()
  // Latest source starts a new conversation; the original Korean strategy
  // request is not translated into the current French interface language.
  await expect(page.locator('.g-urow')).toHaveCount(1)
  await expect(page.locator('.g-umsg')).toContainText(`공유 전략 분석 요청: "${nick}"`)
  await expect(page.locator('.g-umsg')).toContainText(/규칙: RSI .*검증 결과:.*강점과 약점/)
  await expect(page.locator('.g-composer textarea')).toHaveValue('')
})

test('독립 기존 공유 소비자의 명시 Mock 보상도 USD를 유지한다', async ({ page }) => {
  // The new catalogue has no reward ledger. Exercise the old preview consumer in isolation.
  await page.goto('/')
  await page.evaluate(async () => {
    const runtimeHelperPath = '/tests/fixtures/client-react-runtime.ts'
    const { testClientReactRuntimePaths } = await import(/* @vite-ignore */ runtimeHelperPath)
    const runtimePaths = await testClientReactRuntimePaths()
    const reactPath = runtimePaths.reactPath, domPath = runtimePaths.rootPath, hubPath = '/src/components/ClientResearchHub.tsx'
    const { createElement } = (await import(reactPath)).default
    const { createRoot } = (await import(domPath)).default
    const { ClientResearchHub } = await import(hubPath)
    document.getElementById('root')!.style.display = 'none'
    const host = document.createElement('div')
    document.body.append(host)
    createRoot(host).render(createElement(ClientResearchHub, {
      page: 'sharing', records: [], previewMoney: true,
      shareable: { id: 'money-fixture', title: '원문 제목', returnRate: 0 },
      onSelect() {}, onNew() {}, onFollow() {}, onReturn() {},
    }))
  })
  for (const [currency, amount] of [['USD', '$0'], ['KRW', '$0'], ['BTC', '$0']]) {
    await page.evaluate(async value => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(path)
      setClientPreference('currency', value)
    }, currency)
    await expect(page.locator('.share-reward')).toHaveText(`팔로워 0명, 누적 보상 ${amount}`)
  }
})

test('명시된 미리보기 금액 출처만 환산하고 레이아웃 경계와 실제 서비스 기본값은 독립된다', async ({ page }) => {
  await page.goto('/')
  await selectLanguage(page, 'en')
  await page.evaluate(async () => {
    const runtimeHelperPath = '/tests/fixtures/client-react-runtime.ts'
    const { testClientReactRuntimePaths } = await import(/* @vite-ignore */ runtimeHelperPath)
    const runtimePaths = await testClientReactRuntimePaths()
    const reactPath = runtimePaths.reactPath
    const domPath = runtimePaths.rootPath
    const hubPath = '/src/components/ClientResearchHub.tsx'
    const { createElement } = (await import(reactPath)).default
    const { createRoot } = (await import(domPath)).default
    const { ClientResearchHub } = await import(hubPath)
    document.getElementById('root')!.style.display = 'none'
    for (const externalBoundary of [false, true]) {
      for (const previewMoney of [false, true]) {
        const host = document.createElement('div')
        host.id = `money-${externalBoundary}-${previewMoney}`
        document.body.append(host)
        createRoot(host).render(createElement(ClientResearchHub, {
          page: 'sharing', records: [], externalBoundary, previewMoney,
          shareable: { id: 'money-fixture', title: '원문 제목', returnRate: 0 },
          onSelect() {}, onNew() {}, onFollow() {}, onReturn() {},
        }))
      }
    }
  })
  for (const externalBoundary of [false, true]) {
    await expect(page.locator(`#money-${externalBoundary}-false .share-reward`)).toHaveText('0 followers, total rewards ₩0')
    await expect(page.locator(`#money-${externalBoundary}-true .share-reward`)).toHaveText('0 followers, total rewards $0')
  }
})
