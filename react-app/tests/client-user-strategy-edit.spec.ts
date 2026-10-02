import { expect, test, type Page } from '@playwright/test'
import { delegationRecommendedParameters, evaluateDelegation } from '../src/client-delegation-engine'

const parameters = delegationRecommendedParameters(), result = evaluateDelegation(parameters, 1)
const record = { id: '1000', createdAt: 1000, name: '편집 범위 검사', status: 'live', environment: 'paper', parameters,
  score: result.score, ret: result.result.ret, mdd: result.result.mdd, n: result.result.n, winRate: result.result.winRate }
async function mount(page: Page) {
  await page.route('**/user-edit-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="tesia-main" style="overflow-y:auto"><div id="fixture"></div></main></body></html>' }))
  await page.goto('/user-edit-test.html')
  await page.evaluate(async record => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientUserStrategy.tsx', dp = '/@id/react-dom/client', rp = '/@id/react', sp = '/src/client-user-strategy-store.ts'
    const react = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp)
    const { ClientUserStrategy } = await import(/* @vite-ignore */ cp), { SourceUserStrategyEditConflict } = await import(/* @vite-ignore */ sp)
    const skin = '/src/internal-poc/ClientServiceExperience.tsx'; await import(/* @vite-ignore */ skin)
    const React = react.default ?? react
    const calls: unknown[] = [], h = React.createElement
    const api = {
      onApplyEdit: (expected: unknown, parameters: unknown) => {
        calls.push({ expected, parameters })
        return new Promise<void>((resolve, reject) => Object.assign(window, {
          finishUserEdit: resolve, failUserEdit: () => reject(new Error('PRIVATE_FIXTURE_DETAIL')),
          conflictUserEdit: () => reject(new SourceUserStrategyEditConflict()),
        }))
      },
    }
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    const render = (current: typeof record | null) => root.render(h(ClientUserStrategy, { record: current, events: null, money: String, onNavigate: () => {}, ...api }))
    Object.assign(window, { userEditCalls: calls, unmountUserEdit: () => root.unmount(), replaceUserEditRecord: render })
    render(record)
  }, record)
  await page.getByRole('button', { name: '전략 수정', exact: true }).click({ timeout: 10000 })
  await page.getByRole('button', { name: '재검증', exact: true }).click()
  await expect(page.getByRole('button', { name: '이 전략에 적용', exact: true })).toBeEnabled()
}

test('적용 대기 중 중복·입력·닫기 차단, 실패 후 키보드 복귀와 같은 후보 재시도', async ({ page }) => {
  await mount(page)
  const apply = page.getByRole('button', { name: '이 전략에 적용', exact: true })
  await apply.focus(); await page.keyboard.press('Enter')
  await expect(apply).toBeDisabled()
  await expect(page.getByRole('button', { name: '닫기', exact: true })).toBeDisabled()
  for (const select of await page.locator('dialog select').all()) await expect(select).toBeDisabled()
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeVisible()
  await page.mouse.click(1, 1); await expect(page.getByRole('dialog')).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'failUserEdit')())
  await expect(page.getByRole('alert')).toBeFocused()
  await expect(page.getByRole('alert')).not.toContainText('PRIVATE_FIXTURE_DETAIL')
  await apply.click()
  const calls = await page.evaluate(() => Reflect.get(window, 'userEditCalls'))
  expect(calls).toHaveLength(2); expect(calls[0]).toEqual(calls[1])
  await page.evaluate(() => Reflect.get(window, 'finishUserEdit')())
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '전략 수정', exact: true })).toBeFocused()
  await expect(page.locator('#tesia-main')).toHaveCSS('overflow-y', 'auto')
})

test('적용 직전 충돌은 반복 적용을 막고 원본 상태 변경 안내를 표시한다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '이 전략에 적용', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'conflictUserEdit')())
  await expect(page.getByRole('alert')).toHaveText('전략 상태가 바뀌었어요. 현재 상태를 확인해주세요.')
  await expect(page.getByRole('button', { name: '재검증', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '이 전략에 적용', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
})

test('열린 편집의 기준 전략이 교체되면 자동 적용하지 않으며 삭제되면 복귀 조작에 초점을 둔다', async ({ page }) => {
  await mount(page)
  await page.getByLabel('손절선', { exact: true }).focus()
  await page.evaluate(record => Reflect.get(window, 'replaceUserEditRecord')({ ...record, status: 'off' }), record)
  await expect(page.getByRole('alert')).toContainText('전략 상태가 바뀌었어요')
  await expect(page.getByRole('button', { name: '이 전략에 적용', exact: true })).toBeDisabled()
  expect(await page.evaluate(() => Reflect.get(window, 'userEditCalls'))).toEqual([])
  await page.evaluate(() => Reflect.get(window, 'replaceUserEditRecord')(null))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'AI 트레이딩', exact: true })).toBeFocused()
  await page.evaluate(record => Reflect.get(window, 'replaceUserEditRecord')(record), record)
  await expect(page.getByRole('button', { name: '전략 수정', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: '전략 수정', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('한글 조합 Escape는 창을 닫지 않고 언마운트 뒤 늦은 완료는 화면을 되살리지 않는다', async ({ page }) => {
  await mount(page)
  await page.getByRole('dialog').dispatchEvent('keydown', { key: 'Escape', isComposing: true, keyCode: 229 })
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: '이 전략에 적용', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'unmountUserEdit')())
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'finishUserEdit')())
  await expect(page.locator('#fixture')).toBeEmpty()
  await expect(page.locator('#tesia-main')).toHaveCSS('overflow-y', 'auto')
})

test('수정 창 안에서 시작한 드래그는 바깥에서 끝나도 후보를 버리지 않고 의도적인 배경 클릭만 닫는다', async ({ page }) => {
  await mount(page)
  const dialog = page.getByRole('dialog'), rect = await dialog.boundingBox()
  await page.mouse.move(rect!.x + 8, rect!.y + 8)
  await page.mouse.down(); await page.mouse.move(1, 1, { steps: 6 }); await page.mouse.up()
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('button', { name: '이 전략에 적용', exact: true })).toBeEnabled()
  expect(await page.evaluate(() => Reflect.get(window, 'userEditCalls'))).toEqual([])
  await page.mouse.click(1, 1)
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: '전략 수정', exact: true })).toBeFocused()
})
