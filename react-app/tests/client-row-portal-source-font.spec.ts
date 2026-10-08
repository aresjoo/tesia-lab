import { expect, test, type Locator, type Page } from '@playwright/test'

const sourcePortalFont = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans KR", "Apple SD Gothic Neo", "Noto Sans SC Variable", "TETH Bitcoin Glyph", sans-serif'
const originalTitle = '사용자 지정 제목'
const originalDraft = '원문 초안 보존'

const locales = [
  { code: 'ko', row: '연구 관리', rename: '이름 변경', cancel: '취소' },
  { code: 'en', row: 'Manage research', rename: 'Rename', cancel: 'Cancel' },
  { code: 'ja', row: '研究の管理', rename: '名前を変更', cancel: 'キャンセル' },
  { code: 'zh-CN', row: '管理研究', rename: '重命名', cancel: '取消' },
  { code: 'zh-TW', row: '管理研究', rename: '重新命名', cancel: '取消' },
  { code: 'es', row: 'Gestionar investigación', rename: 'Cambiar nombre', cancel: 'Cancelar' },
  { code: 'fr', row: 'Gérer la recherche', rename: 'Renommer', cancel: 'Annuler' },
] as const

type RequestAudit = { external: string[]; mutations: string[]; errors: string[] }

async function seed(page: Page, width: number, baseURL: string | undefined): Promise<RequestAudit> {
  if (!baseURL) throw new Error('Playwright baseURL is required')
  const allowedOrigin = new URL(baseURL).origin
  const audit: RequestAudit = { external: [], mutations: [], errors: [] }
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  page.on('pageerror', () => audit.errors.push('PAGE_ERROR'))
  await page.route('**/*', route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== allowedOrigin) {
      audit.external.push(`${request.method()} ${url.origin}`)
      return route.abort('blockedbyclient')
    }
    if (!['GET', 'HEAD'].includes(request.method())) {
      audit.mutations.push(`${request.method()} ${url.pathname}`)
      return route.abort('blockedbyclient')
    }
    return route.continue()
  })
  await page.addInitScript(({ title, draft }) => {
    const turn = { id: 'row-font-turn', question: '비트코인 조건 원문', answer: '응답 원문을 그대로 보존합니다.', fullAnswer: '응답 원문을 그대로 보존합니다.', status: 'done', startedAt: 1, finishedAt: 100, suggestions: [], phase: 'plan' }
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: 'Portal Font QA', email: 'portal-font@example.test' }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: 'row-font-session', homeDraft: '', sessions: [{ id: 'row-font-session', title, renamed: true, idea: turn.question, draft, pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'conversation', researchStatus: '초안', turns: [turn], updatedAt: 1 }] }))
  }, { title: originalTitle, draft: originalDraft })
  await page.goto('/')
  await expect(page.locator('.g-composer textarea')).toHaveValue(originalDraft)
  await page.evaluate(async () => {
    const { setClientPreference } = await import('/src/client-preferences.ts')
    Reflect.set(window, 'rowPortalLanguagePublisher', setClientPreference)
  })
  return audit
}

async function language(page: Page, code: string) {
  await page.evaluate(value => Reflect.get(window, 'rowPortalLanguagePublisher')('language', value), code)
  await expect(page.locator('html')).toHaveAttribute('lang', code)
}

async function expectSourceFont(target: Locator) {
  await expect(target).toHaveCSS('font-family', sourcePortalFont)
}

for (const width of [320, 1440]) {
  test(`연구 행 portal ${width}px은 7언어 source font와 취소 복귀를 보존한다`, async ({ page, baseURL }) => {
    const audit = await seed(page, width, baseURL)
    await page.locator(width <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
    const trigger = page.locator('.client-session-dots').first()
    const title = page.locator('.client-session').first()
    const composer = page.locator('.g-composer textarea')

    for (const item of locales) {
      await language(page, item.code)
      await trigger.click()
      const menu = page.getByRole('menu', { name: item.row, exact: true })
      const rename = menu.getByRole('menuitem', { name: item.rename, exact: true })
      await expect(menu).toBeVisible()
      await expect(menu.locator('[role="menuitem"]:not(:disabled)').first()).toBeFocused()
      await expectSourceFont(menu)
      await expectSourceFont(rename)
      const menuBox = await menu.boundingBox()
      expect(menuBox).not.toBeNull()
      expect(menuBox!.x).toBeGreaterThanOrEqual(0)
      expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(width + 1)
      expect(await menu.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)

      await rename.click()
      const dialog = page.locator('.client-rowdialog[open]')
      const input = dialog.locator('input')
      const cancel = dialog.getByRole('button', { name: item.cancel, exact: true })
      await expect(dialog).toBeVisible()
      await expect(input).toBeFocused()
      await expectSourceFont(dialog)
      await expectSourceFont(input)
      await expectSourceFont(cancel)
      await input.fill(`미저장 이름 ${item.code} 保持`)
      await expect(input).toHaveValue(`미저장 이름 ${item.code} 保持`)
      const dialogBox = await dialog.boundingBox()
      expect(dialogBox).not.toBeNull()
      expect(dialogBox!.x).toBeGreaterThanOrEqual(0)
      expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(width + 1)
      expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
      await cancel.click()
      await expect(dialog).toHaveCount(0)
      await expect(trigger).toBeFocused()
      await expect(title).toContainText(originalTitle)
      await expect(composer).toHaveValue(originalDraft)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    }

    expect(audit).toEqual({ external: [], mutations: [], errors: [] })
  })
}
