import { expect, test, type Page } from '@playwright/test'

async function seed(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    if (sessionStorage.getItem('teth-client-experience')) return
    const sessions = ['A', 'B'].map(id => ({ id, title: `${id} 연구 ${'장기 투자 전략 '.repeat(7)}`, renamed: true, idea: '비트코인 반등 전략', draft: `${id} 이어서 질문할 초안`, pair: 'BTC/USDT', mode: 'dip', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', researchStatus: '초안', phase: 'plan', workspace: 'conversation', tradingReady: false, updatedAt: 1,
      turns: Array.from({ length: 12 }, (_, i) => ({ id: `${id}-${i}`, question: `${i + 1}번째 질문: 하락 위험은 어떻게 검토하나요?`, answer: '원본 대화의 가독성과 읽던 위치를 검수하는 테스트 문장입니다.\n'.repeat(6), fullAnswer: '', startedAt: 1, finishedAt: 2, status: 'done', suggestions: [], phase: 'plan' })) }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ sessions, currentId: 'A', homeDraft: '', storageError: false }))
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '로컬 검수', email: 'review@example.test' }))
  })
  await page.goto('/')
  await expect(page.locator('.g-urow')).toHaveCount(12)
}

async function menu(page: Page) {
  const mobile = (page.viewportSize()?.width ?? 0) <= 860
  await page.locator(mobile ? '.client-hamburger' : '.client-rail-logo-row button').click()
}

test('긴 대화의 읽던 위치와 초안은 연구 기록 왕복·새로고침 후 유지된다', async ({ page }) => {
  await seed(page)
  await page.locator('.g-scroll').evaluate(el => { el.scrollTop = 400 })
  await expect.poll(() => page.locator('.g-scroll').evaluate(el => el.scrollTop)).toBe(400)
  await menu(page)
  await page.locator('.client-sidebar').getByRole('button', { name: '연구 기록', exact: true }).click()
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect.poll(() => page.locator('.g-scroll').evaluate(el => el.scrollTop)).toBe(400)
  await expect(page.getByLabel('TETH에게 물어보세요')).toHaveValue('A 이어서 질문할 초안')
  await page.reload()
  await expect.poll(() => page.locator('.g-scroll').evaluate(el => el.scrollTop)).toBe(400)
})

test('서로 다른 대화의 읽던 위치를 섞지 않는다', async ({ page }) => {
  await seed(page)
  await page.locator('.g-scroll').evaluate(el => { el.scrollTop = 500 })
  await menu(page)
  await page.locator('.client-session').filter({ hasText: /^B 연구/ }).click()
  await page.locator('.g-scroll').evaluate(el => { el.scrollTop = 900 })
  await menu(page)
  await page.locator('.client-session').filter({ hasText: /^A 연구/ }).click()
  await expect.poll(() => page.locator('.g-scroll').evaluate(el => el.scrollTop)).toBe(500)
  await menu(page)
  await page.locator('.client-session').filter({ hasText: /^B 연구/ }).click()
  await expect.poll(() => page.locator('.g-scroll').evaluate(el => el.scrollTop)).toBe(900)
})

test('두 제목 편집 경로는 120자 한도를 공유하고 Enter/Escape 후 호출 버튼으로 돌아온다', async ({ page }) => {
  await seed(page)
  const trigger = page.getByRole('button', { name: '대화 제목 수정' })
  const original = await trigger.innerText()
  await trigger.click()
  const input = page.getByRole('textbox', { name: '대화 제목 수정' })
  await expect(input).toHaveAttribute('maxlength', '120')
  await input.fill('취소할 제목')
  await input.press('Escape')
  await expect(trigger).toHaveText(original)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await input.fill('새로 저장한 제목')
  await input.press('Enter')
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveText('새로 저장한 제목')
})

test('대화 메뉴는 키보드로 진입·탐색·취소하고 삭제를 실행하지 않는다', async ({ page }) => {
  await seed(page)
  const trigger = page.getByRole('button', { name: '대화 메뉴', exact: true })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const rename = page.getByRole('button', { name: '이름 변경', exact: true })
  await expect(rename).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('button', { name: '삭제', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await expect(page.locator('.g-urow')).toHaveCount(12)
})

test('연구 헤더의 메뉴와 뒤로가기는 태블릿 경계에서도 겹치지 않는다', async ({ page }) => {
  await seed(page)
  await page.getByRole('button', { name: /Research Plan.*연구 계획 확인/ }).click()
  for (const width of [320, 600, 601, 640, 768, 860]) {
    await page.setViewportSize({ width, height: 820 })
    const back = await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).boundingBox()
    const hamburger = await page.locator('.client-hamburger').boundingBox()
    expect(back!.x).toBeGreaterThanOrEqual(hamburger!.x + hamburger!.width + 2)
  }
})

test('짧은 화면에서도 설정 전체와 하위 메뉴에 접근할 수 있다', async ({ page }) => {
  await seed(page)
  await page.setViewportSize({ width: 768, height: 280 })
  await menu(page)
  await page.locator('.client-sidebar-bottom').getByRole('button', { name: '설정', exact: true }).click()
  const panel = page.locator('.ca-settings')
  await expect(panel).toBeVisible()
  const rect = await panel.boundingBox()
  expect(rect!.y).toBeGreaterThanOrEqual(0)
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(280)
  await panel.getByRole('button', { name: '도움말', exact: true }).click()
  const privacy = page.locator('#ca-sub-help').getByRole('link', { name: '개인정보처리방침', exact: true })
  await privacy.focus()
  const link = await privacy.boundingBox()
  expect(link!.y).toBeGreaterThanOrEqual(0)
  expect(link!.y + link!.height).toBeLessThanOrEqual(280)
})

test('연구 문서 읽기 위치는 직접 새로고침해도 유지되고 입력창은 회전 시 다시 맞춰진다', async ({ page }) => {
  await seed(page)
  await page.setViewportSize({ width: 390, height: 650 })
  await page.getByRole('button', { name: /Research Plan.*연구 계획 확인/ }).click()
  const input = page.getByLabel('Research Plan에 질문')
  await input.fill('거래 비용과 손절 조건 사이의 관계를 다시 설명해주세요. 과거 시장에서 위험이 커지는 구간이 궁금합니다.')
  await page.locator('.rw-scroll').evaluate(el => { el.scrollTop = 120 })
  await expect.poll(() => page.locator('.rw-scroll').evaluate(el => el.scrollTop)).toBe(120)
  await page.reload()
  await expect.poll(() => page.locator('.rw-scroll').evaluate(el => el.scrollTop)).toBe(120)
  const narrow = await input.evaluate(el => el.getBoundingClientRect().height)
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect.poll(() => input.evaluate(el => el.getBoundingClientRect().height)).toBeLessThan(narrow)
  await expect(input).toHaveValue('거래 비용과 손절 조건 사이의 관계를 다시 설명해주세요. 과거 시장에서 위험이 커지는 구간이 궁금합니다.')
})

test('응답을 읽다가 위로 이동하면 초안 편집은 위치를 빼앗거나 새 응답을 만들지 않는다', async ({ page }) => {
  await seed(page)
  await page.locator('.g-scroll').evaluate(el => { el.scrollTop = 300 })
  await page.getByLabel('TETH에게 물어보세요').fill('이전 내용을 읽으면서 작성하는 후속 질문')
  await expect(page.locator('.g-newmsg')).toHaveCount(0)
  await expect.poll(() => page.locator('.g-scroll').evaluate(el => el.scrollTop)).toBe(300)
})

test('연구의 필수 설명은 4.5:1 대비로 읽히고 모바일 문서 선택 후 포커스가 유지된다', async ({ page }) => {
  await seed(page)
  await page.setViewportSize({ width: 390, height: 820 })
  await page.getByRole('button', { name: /Research Plan.*연구 계획 확인/ }).click()
  const contrasts = await page.locator('.rw-scroll .meta,.rw-scroll .g-note,.rw-scroll .g-row .k').evaluateAll(elements => {
    const luminance = (rgb: number[]) => rgb.map(n => { const s = n / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }).reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0)
    const backdrop = luminance([15, 16, 18])
    return elements.map(el => { const rgb = getComputedStyle(el).color.match(/[\d.]+/g)!.slice(0, 3).map(Number); return (luminance(rgb) + 0.05) / (backdrop + 0.05) })
  })
  expect(Math.min(...contrasts)).toBeGreaterThanOrEqual(4.5)
  await page.getByRole('button', { name: 'Artifacts 열기', exact: true }).click()
  await page.locator('.rw-artifact').filter({ hasText: /^Research Plan$/ }).click()
  await expect(page.getByRole('tab', { name: 'Research Plan', exact: true })).toBeFocused()
})

test('설정에서 의견 보내기로 이동했다 닫아도 보이는 조작부로 포커스가 돌아온다', async ({ page }) => {
  await seed(page)
  if ((page.viewportSize()?.width ?? 0) <= 860) await menu(page)
  await page.locator('.client-sidebar-bottom').getByRole('button', { name: '설정', exact: true }).click()
  await page.getByRole('button', { name: '의견 보내기', exact: true }).click()
  await expect(page.locator('.ca-feedback textarea')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ca-feedback')).toHaveCount(0)
  const target = (page.viewportSize()?.width ?? 0) <= 860 ? page.locator('.client-hamburger') : page.locator('.client-sidebar-bottom button').first()
  await expect(target).toBeFocused()
  await expect(page.locator('#root')).not.toHaveAttribute('inert', '')
})
