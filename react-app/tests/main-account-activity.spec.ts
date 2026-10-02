import { expect, test, type Page } from '@playwright/test'
import { createClientUserStrategyStore, clientUserStrategyKey } from '../src/client-user-strategy-store'
import { delegationRecommendedParameters, evaluateDelegation } from '../src/client-delegation-engine'

async function profile(page: Page, email = 'account@example.test') {
  await page.addInitScript(value => {
    if (!sessionStorage.getItem('teth-client-profile-preview')) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '계정 검수', email: value }))
  }, email)
}
async function route(page: Page, hash: string) {
  await page.evaluate(value => { history.pushState(null, '', value); window.dispatchEvent(new Event('teth:navigate')) }, hash)
}
async function ownedStrategy(page: Page) {
  // Explicit owned Mock record consumed by the real Main terminal, not a live fill.
  const owner = 'account@example.test', data = new Map<string, string>()
  const store = createClientUserStrategyStore(owner, { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } })
  const result = evaluateDelegation(delegationRecommendedParameters(), 1)
  store.register('account-alerts-owned', { name: '알림 동선 Mock 전략', parameters: result.parameters, score: result.score,
    ret: result.result.ret, mdd: result.result.mdd, n: result.result.n, winRate: result.result.winRate,
    environment: 'paper', exchangeName: 'Binance', status: 'ready' }, 1000)
  await page.addInitScript(({ key, raw }) => { if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, raw) },
    { key: clientUserStrategyKey(owner), raw: data.get(clientUserStrategyKey(owner))! })
}

test('게스트 PLAN 딥링크는 원래 로그인 후 해당 탭으로 돌아오며 홈 초안을 보내지 않는다', async ({ page }) => {
  await page.goto('/#/plan/alerts')
  await expect(page.locator('.ca-auth')).toBeVisible()
  await page.locator('.au-btns button').first().click()
  await expect(page.getByRole('heading', { name: 'PLAN 및 크레딧', exact: true })).toBeVisible()
  await expect(page.getByRole('switch', { name: '앱 내 수신함', exact: true })).toBeChecked()
  await expect(page.locator('.g-urow')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/plan\/alerts$/)
  await expect(page.locator('#root')).not.toHaveAttribute('inert')
})

test('현재 owned Mock 터미널에서 알림→수신 설정→뒤로가기까지 같은 터미널과 초안을 유지한다', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await profile(page); await ownedStrategy(page); await page.goto('/')
  const draft = page.locator('#strategy-idea')
  await draft.fill('알림을 확인해도 보존할 미전송 초안')
  await expect(page.locator('.client-account-utility')).toHaveCount(0)
  await route(page, '#/trade')
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:1000')
  await page.locator('.cat-heading-tools').getByRole('button', { name: '알림', exact: true }).click()
  await expect(page).toHaveURL(/#\/trade$/)
  await expect(page.getByText('아직 알림이 없어요', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '알림', exact: true })).toHaveCount(1)
  const chart = page.locator('.client-account-terminal canvas').first()
  const canvas = await chart.count() ? await chart.elementHandle() : null
  const terminal = await page.locator('.client-account-terminal').elementHandle()
  await page.getByRole('button', { name: '수신 설정', exact: true }).click()
  await expect(page).toHaveURL(/#\/plan\/alerts$/)
  await expect(page.getByRole('switch', { name: '앱 내 수신함', exact: true })).toBeDisabled()
  const position = page.getByRole('switch', { name: '포지션 진입/청산', exact: true })
  await position.focus(); await page.keyboard.press('Space'); await expect(position).not.toBeChecked()
  await page.goBack()
  await expect(page.getByText('아직 알림이 없어요', { exact: true })).toBeVisible()
  if (canvas) expect(await canvas.evaluate(node => node.isConnected)).toBe(true)
  expect(await terminal!.evaluate(node => node.isConnected)).toBe(true)
  if (info.project.name === 'mobile') await expect(page.locator('.ctt-terminal')).toHaveAttribute('data-panel', 'bottom')
  await route(page, '#/')
  await expect(draft).toHaveValue('알림을 확인해도 보존할 미전송 초안')
  expect(errors).toEqual([])
})

test('수신 설정은 새로고침과 PLAN 탭 왕복에 남고 다른 미리보기 계정에는 전달되지 않는다', async ({ page }) => {
  await profile(page); await page.goto('/#/plan/alerts')
  const mail = page.getByRole('switch', { name: '이메일 리포트', exact: true })
  await mail.focus(); await page.keyboard.press('Space'); await expect(mail).toBeChecked()
  await page.getByRole('navigation', { name: 'PLAN 화면', exact: true }).getByRole('button', { name: '정산', exact: true }).click()
  await expect(page.getByText('아직 적립된 내역이 없어요', { exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'PLAN 화면', exact: true }).getByRole('button', { name: '알림 설정', exact: true }).click()
  await expect(mail).toBeChecked()
  await page.reload(); await expect(mail).toBeChecked()
  await page.evaluate(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '별도 계정', email: 'other@example.test' })))
  await page.reload(); await expect(mail).not.toBeChecked()
})

test('설정 저장 실패는 현재 선택을 지우지 않고 명시 재시도로 복구된다', async ({ page }) => {
  await profile(page); await page.goto('/#/plan/alerts')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Object.assign(window, { restoreAccountStorage: () => { Storage.prototype.setItem = original } })
    Storage.prototype.setItem = function (key, value) { if (key.startsWith('teth-client-account-preferences')) throw new DOMException('Blocked', 'QuotaExceededError'); return original.call(this, key, value) }
  })
  const toggle = page.getByRole('switch', { name: '수수료 적립', exact: true })
  await toggle.focus(); await page.keyboard.press('Space'); await expect(toggle).not.toBeChecked()
  await expect(page.locator('.client-account-storage-error')).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'restoreAccountStorage')())
  await page.getByRole('button', { name: '저장 다시 시도', exact: true }).click()
  await expect(page.locator('.client-account-storage-error')).toHaveCount(0)
  await page.reload(); await expect(toggle).not.toBeChecked()
})

test('PLAN 3탭과 보관되지 않은 기록은 320·390·1280px에서 읽고 복귀할 수 있다', async ({ page }, info) => {
  await profile(page); await page.goto('/#/plan')
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 640 })
    for (const hash of ['#/plan', '#/plan/alerts', '#/plan/rebates']) {
      await route(page, hash)
      const alias = hash === '#/plan'
      // Source18668: only the exact legacy PLAN URL aliases billing settings.
      const heading = page.getByRole('heading', { name: alias ? '결제' : 'PLAN 및 크레딧', exact: true })
      await expect(heading).toBeVisible()
      if (alias) await expect(page).toHaveURL(/#\/settings\/billing$/)
      if (width <= 860) {
        const title = await heading.boundingBox()
        // Current source hides nf-util here; legacy research retains its bell.
        await expect(page.locator('.client-account-utility')).toHaveCount(0)
        expect(title!.y).toBeGreaterThanOrEqual(0)
      }
      await page.evaluate(() => document.fonts.ready)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
      const root = page.locator(alias ? '.client-settings-page' : '.client-main-account')
      expect(await root.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
      await root.screenshot({ path: info.outputPath(`main-${width}-${hash.split('/').at(-1)}.png`) })
    }
  }
  await route(page, '#/review/missing')
  await expect(page.getByText('복기 리포트를 찾을 수 없어요', { exact: true })).toBeVisible()
  await page.locator('.client-main-account').getByRole('button', { name: 'AI 트레이딩', exact: true }).click()
  await expect(page).toHaveURL(/#\/trade$/)
  await route(page, '#/periodic/W:2000-01-01')
  await expect(page.getByText('보고서를 찾을 수 없어요', { exact: true })).toBeVisible()
})

test('현재 홈 푸터 이용 현황은 원본 PLAN alias 결제 설정으로 열고 모달 잠금을 남기지 않는다', async ({ page }) => {
  await profile(page); await page.goto('/')
  await page.locator('.client-site-footer').getByRole('button', { name: '이용 현황', exact: true }).click()
  await expect(page).toHaveURL(/#\/settings\/billing$/)
  await expect(page.locator('.ca-settings')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '결제', exact: true })).toBeVisible()
  await expect(page.locator('#root')).not.toHaveAttribute('inert')
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[hidden],[inert]')))).toBe(false)
})


test('소유 전략 없는 현재 Main은 터미널 소개로 이동하며 홈 벨·가짜 알림 터미널을 만들지 않는다', async ({ page }) => {
  await profile(page); await page.goto('/')
  await expect(page.locator('.client-account-utility')).toHaveCount(0)
  await route(page, '#/trade')
  await expect(page.locator('.txh')).toBeVisible()
  await expect(page.locator('.client-account-terminal')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '알림', exact: true })).toHaveCount(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), clientUserStrategyKey('account@example.test'))).toBeNull()
})
