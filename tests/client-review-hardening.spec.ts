import { expect, test, type Page } from '@playwright/test'

const sessionId = 'hardening-review'
const documentsKey = `teth-client-research-documents:${sessionId}`
async function research(page: Page, documents: Record<string, unknown>, seconds = 95) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ documents, seconds, sessionId, documentsKey }) => {
    if (sessionStorage.getItem('teth-client-experience')) return
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: sessionId, homeDraft: '', sessions: [{
      id: sessionId, title: '검수 연구', renamed: true, idea: '비트코인 반등 전략', draft: '대화 초안 유지',
      pair: 'BTC/USDT', mode: 'dip', timeframe: '일봉', risk: '−3%', takeProfit: '+8%',
      researchStatus: seconds === 95 ? '검토 필요' : '초안', phase: 'plan', workspace: 'research', tradingReady: false, updatedAt: 1, turns: [],
    }] }))
    sessionStorage.setItem(documentsKey, JSON.stringify(documents))
    sessionStorage.setItem(`teth-research-preview:restored:${sessionId}`, JSON.stringify({ seconds, status: seconds === 95 ? 'completed' : seconds ? 'paused' : 'idle', view: 'plan', questions: [], clockVersion: 1 }))
  }, { documents, seconds, sessionId, documentsKey })
  await page.goto('/')
  await expect(page.locator('.client-restored-research')).toBeVisible()
}

async function expand(page: Page) {
  await page.locator('.client-home-content textarea').fill('유지할 투자 아이디어\n두 번째 줄')
  await page.getByRole('button', { name: '전체 화면', exact: true }).click()
  await expect(page.locator('dialog:modal')).toHaveCount(1)
}

test('전체 화면에서 로그인으로 넘기면 이메일을 입력하고 취소 후 초안을 이어 쓴다', async ({ page }) => {
  await page.goto('/')
  await expand(page)
  await page.locator('.client-home-plus').click()
  await page.locator('.client-plus-popover').getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.locator('dialog:modal')).toHaveCount(0)
  const email = page.getByRole('textbox', { name: '이메일 주소' })
  await expect(email).toBeFocused()
  await email.fill('review@example.test')
  await expect(email).toHaveValue('review@example.test')
  await page.keyboard.press('Escape')
  const input = page.locator('.client-home-content textarea')
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('유지할 투자 아이디어\n두 번째 줄')
  await input.fill('이어서 수정한 초안')
  await expect(page.locator('#root')).not.toHaveAttribute('inert', '')
})

test('입력 확대의 Escape는 팝오버부터 닫고 입력창 축소 후 초안과 포커스를 유지한다', async ({ page }) => {
  await page.goto('/')
  await expand(page)
  await page.locator('.client-home-plus').click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-plus-popover')).toHaveCount(0)
  await expect(page.locator('dialog:modal')).toHaveCount(1)
  await expect(page.locator('.client-home-plus')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog:modal')).toHaveCount(0)
  await expect(page.locator('.client-home-content textarea')).toBeFocused()
  await expect(page.locator('.client-home-content textarea')).toHaveValue('유지할 투자 아이디어\n두 번째 줄')
})

for (const method of ['button', 'keyboard']) {
  test(`확대 입력 ${method} 전송은 한 번만 시작되고 native dialog를 남기지 않는다`, async ({ page }) => {
    await page.goto('/')
    await expand(page)
    if (method === 'button') await page.getByRole('button', { name: '대화 시작', exact: true }).click()
    else await page.locator('dialog textarea').press('Enter')
    await expect(page.locator('dialog:modal')).toHaveCount(0)
    await expect(page.locator('.g-urow')).toHaveCount(1)
    await expect(page.locator('.g-composer textarea')).toBeEditable()
  })
}

test('확대 입력 중 뒤로가기와 내부 탐색은 공개 페이지를 가리지 않고 초안을 보존한다', async ({ page }) => {
  await page.goto('/download/')
  await page.locator('a.web-start').click()
  await expand(page)
  await page.goBack()
  await expect(page).toHaveURL(/\/download\//)
  await expect(page.locator('dialog:modal')).toHaveCount(0)
  await expect(page.locator('a.web-start')).toBeVisible()
  await page.goForward()
  await expect(page.locator('.client-home-content textarea')).toHaveValue('유지할 투자 아이디어\n두 번째 줄')
  await page.getByRole('button', { name: '전체 화면', exact: true }).click()
  await page.evaluate(() => { history.pushState({}, '', '/download/'); window.dispatchEvent(new Event('teth:navigate')) })
  await expect(page.locator('dialog:modal')).toHaveCount(0)
  await page.locator('a.web-start').click()
  await expect(page.locator('.client-home-content textarea')).toHaveValue('유지할 투자 아이디어\n두 번째 줄')
})

for (const label of ['손절', '익절']) {
  test(`${label}의 비유한 숫자는 기존 값·입력을 보존하고 정정 후에만 적용한다`, async ({ page }) => {
    await research(page, { active: 'plan', tabs: ['plan'] }, 0)
    const trigger = page.getByRole('button', { name: `${label} 수정 요청` })
    const row = page.locator('.g-row').filter({ has: page.locator('.k', { hasText: new RegExp(`^${label}$`) }) })
    const original = await row.locator('.v').innerText()
    await trigger.click()
    await expect(page.getByRole('button', { name: '적용', exact: true })).toBeDisabled()
    const input = page.getByRole('textbox', { name: `${label} 코멘트` })
    for (const invalid of ['9'.repeat(400) + '%', '1e309%', 'Infinity%', 'NaN%']) {
      await input.fill(invalid)
      await input.press('Enter')
      await expect(input).toHaveValue(invalid)
      await expect(input).toBeFocused()
      await expect(input).toHaveAttribute('aria-invalid', 'true')
      const error = page.locator('.rw-input-error')
      await expect(error).toContainText('계산할 수 있는 숫자')
      await expect(input).toHaveAttribute('aria-describedby', (await error.getAttribute('id'))!)
      await expect(row.locator('.v')).toHaveText(original)
      await expect(page.locator('.rw-notice')).toHaveCount(0)
    }
    await input.fill('2.5%로 변경해주세요')
    await expect(input).toHaveAttribute('aria-invalid', 'false')
    await input.press('Enter')
    await expect(row.locator('.v')).toHaveText(`${label === '손절' ? '−' : '+'}2.5%`)
    await expect(trigger).toBeFocused()
    await trigger.click()
    await input.fill('취소할 코멘트')
    await input.press('Escape')
    await expect(trigger).toBeFocused()
    await expect(input).toHaveCount(0)
    await trigger.click()
    await expect(input).toHaveValue('취소할 코멘트')
    await input.press('Escape')
    await page.reload()
    await expect(row.locator('.v')).toHaveText(`${label === '손절' ? '−' : '+'}2.5%`)
  })
}

const caches = [
  { name: '활성 누락', active: 'bt2', tabs: ['plan'], expected: ['Research Plan', 'Backtest v2'], selected: 'Backtest v2', seconds: 95 },
  { name: '빈 목록', active: 'plan', tabs: [], expected: ['Research Plan'], selected: 'Research Plan', seconds: 95 },
  { name: '중복과 미등록 문서', active: 'bt2', tabs: ['plan', 'plan', 'bt2', 'bt2', 'unknown'], expected: ['Research Plan', 'Backtest v2'], selected: 'Backtest v2', seconds: 95 },
  { name: '다섯 개 초과', active: 'holdout', tabs: ['plan', 'hypo', 'bt1', 'strat1', 'critic', 'holdout'], expected: ['Research Plan', 'Hypothesis', 'Backtest v1', 'Strategy v1', 'Holdout Test'], selected: 'Holdout Test', seconds: 95 },
  { name: '미생성 문서', active: 'bt2', tabs: ['plan', 'bt1', 'bt2'], expected: ['Research Plan'], selected: 'Research Plan', seconds: 10 },
  { name: '미등록 활성 문서', active: 'unknown', tabs: ['plan', 'hypo'], expected: ['Research Plan', 'Hypothesis'], selected: 'Research Plan', seconds: 95 },
]
for (const cache of caches) {
  test(`문서 캐시 복원 (${cache.name})은 선택 탭과 본문·키보드 탐색을 일치시킨다`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await research(page, { active: cache.active, tabs: cache.tabs, drafts: { plan: '보존할 문서 질문' } }, cache.seconds)
    const tabs = page.getByRole('tablist', { name: '열린 연구 문서' })
    await expect(tabs.getByRole('tab')).toHaveText(cache.expected)
    await expect(tabs.locator('[aria-selected="true"]')).toHaveCount(1)
    const selected = tabs.getByRole('tab', { name: cache.selected, exact: true })
    await expect(selected).toHaveAttribute('tabindex', '0')
    await selected.focus()
    await selected.press('Home')
    await expect(tabs.getByRole('tab').first()).toBeFocused()
    await expect(tabs.getByRole('tab').first()).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('textbox', { name: 'Research Plan에 질문' })).toHaveValue('보존할 문서 질문')
    await page.keyboard.press('End')
    await expect(tabs.getByRole('tab').last()).toBeFocused()
    await expect(tabs.getByRole('tab').last()).toHaveAttribute('aria-selected', 'true')
    await page.reload()
    await expect(tabs.getByRole('tab')).toHaveText(cache.expected)
    await expect(tabs.getByRole('tab').last()).toHaveAttribute('aria-selected', 'true')
    expect(errors).toEqual([])
  })
}

test('이전에 저장된 비유한 수정값만 제거하고 다른 문서 초안과 정상 수치는 보존한다', async ({ page }) => {
  await research(page, { active: 'plan', tabs: ['plan'], edits: { 손절: '−Infinity%', 익절: '+2.5%' }, drafts: { plan: '보존할 질문' } }, 0)
  await expect(page.locator('.rw-rows')).not.toContainText('Infinity')
  await expect(page.locator('.rw-rows')).toContainText('−3%')
  await expect(page.locator('.rw-rows')).toContainText('+2.5%')
  await expect(page.getByRole('textbox', { name: 'Research Plan에 질문' })).toHaveValue('보존할 질문')
  const saved = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), documentsKey)
  expect(saved.edits).toEqual({ 익절: '+2.5%' })
})
