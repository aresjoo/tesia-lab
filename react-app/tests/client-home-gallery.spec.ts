import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { CLIENT_HOME_ACTIONS, CLIENT_HOME_ASSETS, CLIENT_HOME_HEADLINES, CLIENT_HOME_SUBCOPY, composeTemplatePrompt, getTemplateText, normalizeTemplateSelection, toggleTemplateSelection, type HomeTemplateSelection } from '../src/client-home-gallery'

test('원본 5개 기능·50개 자산·로컬 로고·7개 언어 서브카피를 보존한다', () => {
  expect(CLIENT_HOME_ACTIONS.map(item => item.lb)).toEqual(['AI가 대신 거래', '지표 생성 후, 거래', '전략 랭킹', '시장/종목 분석', '포트폴리오 분석'])
  expect(CLIENT_HOME_ASSETS).toHaveLength(50)
  expect(new Set(CLIENT_HOME_ASSETS.map(item => item.id)).size).toBe(50)
  for (const item of CLIENT_HOME_ASSETS) expect(existsSync(`public${item.img}`)).toBe(true)
  expect(CLIENT_HOME_HEADLINES.ko).toHaveLength(6)
  expect(Object.keys(CLIENT_HOME_SUBCOPY).sort()).toEqual(['en', 'es', 'fr', 'ja', 'ko', 'zh-CN', 'zh-TW'])
  expect(CLIENT_HOME_SUBCOPY.ko).toBe('템플릿을 사용해 보거나 채팅으로 투자를 설명하십시오.\nTETH 모델로 만듭니다.')
  for (const lang of Object.keys(CLIENT_HOME_SUBCOPY)) expect(CLIENT_HOME_HEADLINES[lang]?.length).toBeGreaterThanOrEqual(6)
})

test('선택은 합계 10개 제한·개별 해제·중복과 알 수 없는 ID 방어를 지킨다', () => {
  let selection: HomeTemplateSelection = { acts: [], assets: [] }
  for (const item of CLIENT_HOME_ACTIONS) selection = toggleTemplateSelection(selection, 'acts', item.id)
  for (const item of CLIENT_HOME_ASSETS.slice(0, 5)) selection = toggleTemplateSelection(selection, 'assets', item.id)
  expect(selection.acts.length + selection.assets.length).toBe(10)
  expect(toggleTemplateSelection(selection, 'assets', 'aapl')).toEqual(selection)
  selection = toggleTemplateSelection(selection, 'assets', 'btc')
  expect(selection.assets).not.toContain('btc')
  expect(toggleTemplateSelection(selection, 'assets', 'aapl').assets).toContain('aapl')
  expect(normalizeTemplateSelection({ acts: ['auto', 'auto', '<script>'], assets: ['btc', 'btc', 'unknown'] })).toEqual({ acts: ['auto'], assets: ['btc'] })
})

test('템플릿 문장·한국어 조사·직접 입력을 원본 규칙으로 합성한다', () => {
  expect(getTemplateText({ acts: [], assets: [] })).toBeNull()
  expect(composeTemplatePrompt({ acts: [], assets: [] }, '  자유로운 질문  ')).toBe('자유로운 질문')
  expect(composeTemplatePrompt({ acts: [], assets: [] })).toBe('')
  expect(getTemplateText({ acts: ['anal'], assets: ['sec'] })).toEqual({ q: '삼성전자를 어떻게 분석해 드리면 되겠습니까?', cmd: '삼성전자 시장 상태를 분석해줘' })
  expect(getTemplateText({ acts: ['anal'], assets: ['nvr'] })?.q).toBe('NAVER를 어떻게 분석해 드리면 되겠습니까?')
  expect(composeTemplatePrompt({ acts: ['auto'], assets: ['btc'] }, '손실은 작게')).toBe('BTC 거래를 AI에게 맡기는 전략을 만들어줘. 손실은 작게')
  expect(composeTemplatePrompt({ acts: ['auto', 'rank'], assets: ['btc', 'eth'] })).toBe('BTC와 ETH 거래를 AI에게 맡기는 전략을 만들고, 인기 전략 랭킹도 보여줘')
  expect(composeTemplatePrompt({ acts: [], assets: ['hyx', 'sec'] })).toBe('SK하이닉스와 삼성전자 지금 상황을 비교 분석해줘')
})

test('자산 로고에 외부 실행 콘텐츠와 네트워크 URL을 넣지 않는다', () => {
  for (const item of CLIENT_HOME_ASSETS.filter(asset => asset.img.endsWith('.svg'))) {
    const svg = readFileSync(`public${item.img}`, 'utf8')
    expect(svg).not.toMatch(/<script\b|<foreignObject\b|\son\w+\s*=|(?:href|src)=["'](?:https?:|\/\/)/i)
  }
})

test('홈 카드·모바일 1열·선택 상태·원본 문구를 화면에 제공한다', async ({ page }) => {
  await page.goto('/')
  const gallery = page.getByRole('region', { name: '투자 템플릿' })
  await expect(gallery.locator('.g-tpl')).toHaveCount(55)
  await expect(page.locator('.client-hero-subtitle')).toContainText('템플릿을 사용해 보거나 채팅으로 투자를 설명하십시오.')
  await gallery.getByRole('button', { name: 'AI가 대신 거래', exact: true }).click()
  await expect(gallery.getByRole('button', { name: 'AI가 대신 거래', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await gallery.getByRole('button', { name: 'BTC', exact: true }).click()
  await expect(page.getByRole('button', { name: 'BTC 선택 해제' })).toBeVisible()
  await expect(page.locator('.client-home-band textarea')).toHaveAttribute('placeholder', 'AI가 어떻게 BTC 거래를 해드리면 되겠습니까?')
  await page.getByRole('button', { name: 'BTC 선택 해제' }).click()
  await expect(gallery.getByRole('button', { name: 'BTC', exact: true })).toHaveAttribute('aria-pressed', 'false')
  const columns = await gallery.locator('.g-tpls').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)
  // Source 42a0d81: phones <=600, tablets <=1100, desktop >1100.
  const width = page.viewportSize()?.width ?? 1280
  expect(columns).toBe(width <= 600 ? 1 : width <= 1100 ? 2 : 3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('키보드 선택·제거 후 포커스·SVG gradient ID 격리를 지킨다', async ({ page }) => {
  await page.goto('/')
  const gallery = page.getByRole('region', { name: '투자 템플릿' })
  const first = gallery.getByRole('button', { name: 'AI가 대신 거래', exact: true })
  await first.focus(); await page.keyboard.press('Space')
  await expect(first).toBeFocused()
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  const remove = page.getByRole('button', { name: 'AI가 대신 거래 선택 해제' })
  await remove.focus(); await page.keyboard.press('Enter')
  await expect(page.locator('.client-home-band textarea')).toBeFocused()
  await expect(first).toHaveAttribute('aria-pressed', 'false')
  await first.click()
  const ids = await page.locator('.client-home-gallery linearGradient, .client-template-selection linearGradient').evaluateAll(elements => elements.map(element => element.id))
  expect(ids.length).toBe(6)
  expect(new Set(ids).size).toBe(ids.length)
})

test('화면 선택 한도는 안내 후 자동 닫히며 기존 선택을 보존한다', async ({ page }) => {
  await page.goto('/')
  const gallery = page.getByRole('region', { name: '투자 템플릿' })
  for (const item of [...CLIENT_HOME_ACTIONS, ...CLIENT_HOME_ASSETS.slice(0, 5)]) {
    await gallery.getByRole('button', { name: item.lb, exact: true }).click()
  }
  await expect(gallery.locator('[aria-pressed="true"]')).toHaveCount(10)
  await gallery.getByRole('button', { name: 'SK하이닉스', exact: true }).click()
  await expect(gallery.getByRole('status')).toHaveText('최대 10개까지 선택할 수 있어요')
  await expect(gallery.getByRole('button', { name: 'SK하이닉스', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.client-template-selection .tchip')).toHaveCount(10)
  await expect(gallery.getByRole('status')).toBeEmpty({ timeout: 6500 })
  await page.getByRole('button', { name: 'BTC 선택 해제' }).click()
  await gallery.getByRole('button', { name: 'SK하이닉스', exact: true }).click()
  await expect(gallery.getByRole('button', { name: 'SK하이닉스', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(gallery.locator('[aria-pressed="true"]')).toHaveCount(10)
})
