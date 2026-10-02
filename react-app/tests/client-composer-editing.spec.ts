import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
})

test('확대·축소 후에도 편집 중인 선택 범위와 방향을 보존한다', async ({ page }) => {
  const input = page.locator('#strategy-idea')
  await input.fill('비트코인과 이더리움의 흐름을 비교해주세요\n중간 조건도 편집할게요')
  await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(7, 11, 'backward'))
  await page.getByRole('button', { name: '전체 화면', exact: true }).click()
  await expect(input).toBeFocused()
  await expect.poll(() => input.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd, el.selectionDirection])).toEqual([7, 11, 'backward'])
  await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(2, 5, 'forward'))
  await page.getByRole('button', { name: '입력창 축소', exact: true }).click()
  await expect(input).toBeFocused()
  await expect.poll(() => input.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd, el.selectionDirection])).toEqual([2, 5, 'forward'])
  await page.keyboard.insertText('수정')
  await expect(input).toHaveValue('비트수정 이더리움의 흐름을 비교해주세요\n중간 조건도 편집할게요')
})

test('전체 화면에서 Escape로 접어도 커서 위치를 보존한다', async ({ page }) => {
  const input = page.locator('#strategy-idea')
  await input.fill('투자 아이디어를 정리하고 있어요\n다음 조건을 추가할게요')
  await page.getByRole('button', { name: '전체 화면', exact: true }).click()
  await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(3, 3))
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-composer-dialog')).toHaveCount(0)
  await expect(input).toBeFocused()
  await expect.poll(() => input.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd])).toEqual([3, 3])
})

test('추가 메뉴가 열려도 한글 조합 취소는 입력 포커스를 빼앗지 않는다', async ({ page }) => {
  const input = page.locator('#strategy-idea')
  await input.fill('작성 중인 질문')
  await page.locator('.client-home-plus').click()
  await input.focus()
  await input.dispatchEvent('compositionstart', { data: '가' })
  await input.dispatchEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, cancelable: true })
  await expect(page.locator('.client-plus-popover')).toBeVisible()
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('작성 중인 질문')
  await input.dispatchEvent('compositionend')
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-plus-popover')).toHaveCount(0)
  await expect(page.locator('.client-home-plus')).toBeFocused()
})

test('브라우저 IME 조합 중 Escape는 확대창을 닫지 않고 조합 종료 후에는 닫는다', async ({ page }) => {
  const input = page.locator('#strategy-idea')
  await input.fill('검토할 질문\n추가 조건')
  await page.getByRole('button', { name: '전체 화면', exact: true }).click()
  const cdp = await page.context().newCDPSession(page)
  // Drive Chromium's composition state, not just an untrusted KeyboardEvent.
  // This still does not substitute for native OS/phone IME testing.
  await cdp.send('Input.imeSetComposition', { text: '가', selectionStart: 1, selectionEnd: 1 })
  const composed = await input.inputValue()
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-composer-dialog')).toBeVisible()
  await expect(input).toBeFocused()
  await expect(input).toHaveValue(composed)
  await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 })
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-composer-dialog')).toHaveCount(0)
  await expect(input).toBeFocused()
  await cdp.detach()
})
