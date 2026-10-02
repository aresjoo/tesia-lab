import { expect, test } from '@playwright/test'
import { shellText, sourceSidebarNavigationLabel } from '../src/client-shell-copy'
import { accountActivityText } from '../src/client-account-activity-copy'
import { accountPlanText } from '../src/client-account-plan-copy'
import { researchDocumentCopy } from '../src/internal-poc/native-research-document-copy'
import { sharedFollowCopy } from '../src/client-shared-follow-copy'
import { createClientUserStrategyStore, clientUserStrategyKey } from '../src/client-user-strategy-store'
import { delegationRecommendedParameters, evaluateDelegation } from '../src/client-delegation-engine'

// Frozen9fb12008/12041/12050–51: the destination is AI 트레이딩.
// Translations are fixed UI copy oracles, independent of product lookups.
const names = [
  ['ko', 'AI 트레이딩', 'AI 트레이딩에서 열기', 'AI 트레이딩으로 이동'],
  ['en', 'AI trading', 'Open in AI trading', 'Go to AI trading'],
  ['ja', 'AIトレーディング', 'AIトレーディングで開く', 'AIトレーディングへ移動'],
  ['zh-CN', 'AI交易', '在AI交易中打开', '前往AI交易'],
  ['zh-TW', 'AI交易', '在AI交易中開啟', '前往AI交易'],
  ['es', 'Trading con IA', 'Abrir en Trading con IA', 'Ir a Trading con IA'],
  ['fr', 'Trading IA', 'Ouvrir dans Trading IA', 'Aller à Trading IA'],
] as const
const archiveKey = '항목은 보관 처리되고, 이미 실행 중인 전략은 AI 트레이딩에서 계속 관리할 수 있어요.'
const archiveCopy = [
  archiveKey,
  'The item will be archived, and already running strategies can still be managed in AI trading.',
  '項目はアーカイブされ、すでに実行中の戦略はAIトレーディングで引き続き管理できます。',
  '该项将被归档，已在运行中的策略仍可在AI交易中继续管理。',
  '該項將被封存，已在運行中的策略仍可在AI交易中繼續管理。',
  'El elemento se archivará y las estrategias ya en ejecución se podrán seguir gestionando en Trading con IA.',
  "L'élément sera archivé et les stratégies déjà en cours d'exécution pourront toujours être gérées dans Trading IA.",
] as const

for (const [index, [language, title, open, go]] of names.entries()) test(`${language} 고정원문목적지와제목·버튼·본문안내는같은AI트레이딩을가리킨다`, () => {
  expect(shellText(language, 'trading')).toBe(title)
  expect(sourceSidebarNavigationLabel(language, 'trading')).toBe(title)
  expect(accountActivityText(language, 'myTrading')).toBe(title)
  expect(accountPlanText(language, 'goTrading')).toBe(go)
  expect(accountPlanText(language, 'goTradingEmpty')).toContain(title)
  expect(researchDocumentCopy('openTrading', language)).toBe(open)
  expect(sharedFollowCopy(language, archiveKey)).toBe(archiveCopy[index])
})

for (const width of [320, 1440]) test(`${width}px 실제Main7언어메뉴·터미널제목·본문복귀버튼은같은명칭이며초안·권한을바꾸지않는다`, async ({ page }) => {
  const owner = 'trading-copy@example.test', data = new Map<string, string>()
  const store = createClientUserStrategyStore(owner, { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } })
  const preview = evaluateDelegation(delegationRecommendedParameters(), 1)
  store.register('copy-name-only', { name: '명칭 검수 Mock 전략', parameters: preview.parameters, score: preview.score,
    ret: preview.result.ret, mdd: preview.result.mdd, n: preview.result.n, winRate: preview.result.winRate,
    environment: 'paper', exchangeName: 'Binance', status: 'ready' }, 1000)
  await page.setViewportSize({ width, height: 740 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, key, raw }) => {
    if (sessionStorage.getItem('trading-copy-seeded')) return
    sessionStorage.setItem('trading-copy-seeded', 'true')
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '명칭 검수', email: owner }))
    sessionStorage.setItem(key, raw)
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: null, sessions: [], homeDraft: '명칭을 바꿔도 미전송인 초안', sharedFollows: [] }))
  }, { owner, key: clientUserStrategyKey(owner), raw: data.get(clientUserStrategyKey(owner))! })
  await page.goto('/#/trade')
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  const original = await page.evaluate(key => sessionStorage.getItem(key), clientUserStrategyKey(owner))
  for (const [language, title] of names) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
    }, language)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await expect(page.locator('.cat-heading h1')).toHaveText(title)
    await page.locator(width <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
    const nav = page.locator('.client-sidebar .client-research-navigation > nav')
    await expect(nav.getByRole('button', { name: title, exact: true })).toHaveAttribute('aria-current', 'page')
    await page.keyboard.press('Escape')
    // Actual Main route consumption. No replacement component handlers or SDK.
    await page.goto('/#/review/missing-copy-name')
    await expect(page.locator('.client-account-activity').getByRole('button', { name: title, exact: true })).toHaveText(title)
    await page.locator('.client-account-activity').getByRole('button', { name: title, exact: true }).click()
    await expect(page).toHaveURL(/#\/trade$/)
    await expect(page.locator('.cat-heading h1')).toHaveText(title)
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).homeDraft)).toBe('명칭을 바꿔도 미전송인 초안')
    expect(await page.evaluate(key => sessionStorage.getItem(key), clientUserStrategyKey(owner))).toBe(original)
  }
})
