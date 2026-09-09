import { expect, test } from '@playwright/test'

test('원본 진입은 최신 퍼널 코드나 실제 API를 요청하지 않는다', async ({ page }) => {
  const requests: string[] = []
  const errors: string[] = []
  page.on('request', request => requests.push(new URL(request.url()).pathname))
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.client-source-app')).toBeVisible()
  await expect(page.locator('.conversation-cosmos')).toHaveCSS('position', 'absolute')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.png')
  expect(requests).not.toContain('/src/main.tsx')
  expect(requests).not.toContain('/src/components/SignalCanvas.tsx')
  expect(requests).not.toContain('/src/dev/chart-workspace-preview.tsx')
  expect(requests).not.toContain('/src/dev/chart-workspace-fixture.ts')
  expect(requests.filter(path => path.startsWith('/api/'))).toEqual([])
  expect(errors).toEqual([])
})

test('최신 퍼널 회귀는 명시적인 개발용 진입점에 격리한다', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => requests.push(new URL(request.url()).pathname))
  await page.goto('/?legacy-fixture=1')
  await expect(page.locator('.tesia-header')).toBeVisible()
  await expect(page.locator('.client-source-app')).toHaveCount(0)
  expect(requests).not.toContain('/src/client-bootstrap.tsx')
  expect(requests).not.toContain('/src/components/ClientMainExperience.tsx')
})
