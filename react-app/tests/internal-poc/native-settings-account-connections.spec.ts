import { expect, test, type Page } from '@playwright/test'


test.use({ trace: 'off', video: 'off' })

async function mount(page: Page, mode: 'unprovided' | 'zero' | 'one' | 'many' = 'one') {
  await page.route('**/settings-account-connections.html', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div></body></html>',
  }))
  await page.goto(`/settings-account-connections.html#/settings/account`)
  await page.evaluate(async initialMode => {
    const refreshPath = '/@react-refresh'
    const refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const componentPath = '/src/internal-poc/ClientServiceExperience.tsx'
    const source = await (await fetch(componentPath)).text()
    const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const ReactModule = await import(/* @vite-ignore */ reactPath)
    const DOM = await import('/@id/react-dom/client')
    const { ClientServiceExperience } = await import(/* @vite-ignore */ componentPath)
    const React = ReactModule.default ?? ReactModule
    const createRoot = DOM.createRoot ?? DOM.default.createRoot
    const calls: string[] = []
    const controls: { throwId: string | null } = { throwId: null }
    const pending: { id: string; resolve: () => void; resolveDeferred: () => void; resolveSame: () => void; reject: () => void }[] = []
    const baseState = {
      phase: 'ready' as const, sessionState: 'AUTHENTICATED' as const,
      messages: [], input: '', busy: false, inputDisabled: false, source: 'service' as const,
      recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
      onInput: () => undefined, onSend: async () => undefined, onReset: () => undefined,
      onRecover: undefined, onLogout: undefined,
    }
    function Host() {
      const [owner, setOwner] = React.useState('owner-a')
      const [sessionState, setSessionState] = React.useState<'AUTHENTICATED' | 'ANONYMOUS'>('AUTHENTICATED')
      const [sourceOwner, setSourceOwner] = React.useState('owner-a')
      const [connectionIdentity, setConnectionIdentity] = React.useState('exchange:owner-a')
      const [accountIdentity, setAccountIdentity] = React.useState('account:owner-a')
      const [mode, setMode] = React.useState(initialMode)
      const [revision, setRevision] = React.useState(1)
      const account = (id: string, exchangeId: string, maskedAccountLabel: string,
        access?: 'invitation' | 'subscription' | 'subscription-ended') => ({
        id, exchangeId, maskedAccountLabel, ...(access ? { access } : {}),
        onDisconnect: () => {
          calls.push(`disconnect:${owner}:${id}`)
          if (controls.throwId === id) throw new Error('synthetic disconnect failure')
          return new Promise<void>((resolve, reject) => {
            pending.push({ id,
              resolve: () => { setMode(id === 'connection-b' ? 'one' : 'zero'); setRevision(value => value + 1); resolve() },
              resolveDeferred: () => { resolve(); requestAnimationFrame(() => { setMode(id === 'connection-b' ? 'one' : 'zero'); setRevision(value => value + 1) }) },
              resolveSame: () => { setRevision(value => value + 1); resolve() }, reject })
          })
        },
      })
      const accounts = mode === 'many'
        ? [account('connection-a', 'bitget', '12••••34', 'invitation'), account('connection-b', 'gate', '56****78', 'subscription-ended')]
        : [account('connection-a', 'bitget', '12••••34', 'subscription')]
      const presentation = mode === 'unprovided' ? undefined : {
        scope: sourceOwner, identity: connectionIdentity, requestId: `request:${sourceOwner}`,
        status: 'ready' as const, sourceLabel: 'TETH',
        state: mode === 'zero'
          ? { id: `exchanges:${revision}`, kind: 'exchange' as const, title: '거래소 연결', description: '공급된 빈 연결 상태', exchanges: [] }
          : { id: `connections:${revision}`, kind: 'complete' as const, title: '연결되었습니다', description: '공급된 연결 상태', rows: [], actions: [], connectionList: { accounts: accounts as [typeof accounts[number], ...typeof accounts[number][]] } },
      }
      Object.assign(window, { settingsConnections: {
        calls, setOwner, setSessionState, setSourceOwner, setConnectionIdentity, setAccountIdentity, setMode,
        advanceRevision: () => setRevision(value => value + 1),
        setThrowId: (id: string | null) => { controls.throwId = id },
        resolve: (index = 0) => pending[index]?.resolve(),
        resolveDeferred: (index = 0) => pending[index]?.resolveDeferred(),
        resolveSame: (index = 0) => pending[index]?.resolveSame(),
        reject: (index = 0) => pending[index]?.reject(),
      } })
      return React.createElement(ClientServiceExperience, {
        nativeAccounts: true, accountScope: owner, connectionPresentation: presentation,
        accountPresentation: { scope: owner, identity: accountIdentity, sourceLabel: '합성 계정 표시', strategies: null, accounts: null,
          ledger: { pos: null, open: null, orders: null, fills: null, closed: null, assets: null } },
        state: { ...baseState, sessionState },
      })
    }
    createRoot(document.getElementById('root')!).render(React.createElement(Host))
  }, mode)
  if (mode !== 'unprovided') {
    const journey = page.locator('.native-connection-onboarding')
    await expect(journey).toBeVisible()
    await journey.locator('.nsp-back, .bk').click()
    await expect(journey).toHaveCount(0)
  }
  await expect(page.locator('.client-settings-page')).toBeVisible()
}

const section = (page: Page) => page.locator('.client-settings-page .stg-sec').filter({ has: page.getByRole('heading', { name: '연결된 거래소' }) })

async function installFocusFrameQueue(page: Page) {
  await page.evaluate(() => {
    let nextId = 0
    const frames = new Map<number, FrameRequestCallback>()
    const controls = {
      install: () => {
        window.requestAnimationFrame = callback => {
          const id = ++nextId
          frames.set(id, callback)
          return id
        }
        window.cancelAnimationFrame = id => { frames.delete(id) }
      },
      flushOne: () => {
        const next = frames.entries().next().value as [number, FrameRequestCallback] | undefined
        if (!next) return false
        frames.delete(next[0])
        next[1](performance.now())
        return true
      },
      flushAll: () => {
        const focused: string[] = []
        let remaining = 32
        while (frames.size && remaining-- > 0) {
          controls.flushOne()
          const active = document.activeElement
          focused.push(active instanceof HTMLElement ? active.textContent?.trim() ?? '' : '')
        }
        return { focused, pending: frames.size }
      },
      pending: () => frames.size,
    }
    Object.assign(window, { settingsFocusFrames: controls })
    controls.install()
  })
}

test('미공급과 확인된 0개 상태는 기존 unavailable과 연결 CTA를 유지한다', async ({ page }) => {
  for (const mode of ['unprovided', 'zero'] as const) {
    await mount(page, mode)
    const connections = section(page)
    await expect(connections.locator('[data-settings-connection]')).toHaveCount(0)
    await expect(connections.locator('.stg-empty')).toHaveText('아직 정보를 받아오지 못했습니다')
    await expect(connections.getByRole('button', { name: '거래소 연결' })).toBeEnabled()
  }
})

test('owner-bound 1개와 복수 연결은 공급 mask·exchange·access만 그대로 표시한다', async ({ page }) => {
  await mount(page, 'one')
  let connections = section(page)
  await expect(connections.locator('[data-settings-connection="connection-a"]')).toContainText('Bitget')
  await expect(connections.locator('[data-settings-connection="connection-a"]')).toContainText('12••••34')
  await expect(connections.locator('[data-settings-connection="connection-a"]')).toContainText('구독')

  await page.evaluate(() => Reflect.get(window, 'settingsConnections').setMode('many'))
  connections = section(page)
  await expect(connections.locator('[data-settings-connection]')).toHaveCount(2)
  await expect(connections.locator('[data-settings-connection="connection-b"]')).toContainText('Gate')
  await expect(connections.locator('[data-settings-connection="connection-b"]')).toContainText('56****78')
  await expect(connections.locator('[data-settings-connection="connection-b"]')).toContainText('구독이 끝나 새 주문이 멈췄습니다')
})

test('owner scope가 바뀌면 이전 연결 행을 즉시 폐기한다', async ({ page }) => {
  await mount(page, 'one')
  await expect(section(page).locator('[data-settings-connection]')).toHaveCount(1)
  await page.evaluate(() => Reflect.get(window, 'settingsConnections').setOwner('owner-b'))
  await expect(section(page).locator('[data-settings-connection]')).toHaveCount(0)
  await expect(section(page).locator('.stg-empty')).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'settingsConnections').setOwner('owner-a'))
  await expect(section(page).locator('[data-settings-connection]')).toHaveCount(1)
})

test('실제 ANONYMOUS 전환은 settings를 숨기고 login entry를 복구한다', async ({ page }) => {
  await mount(page, 'one')
  await page.evaluate(() => Reflect.get(window, 'settingsConnections').setSessionState('ANONYMOUS'))
  await expect(page.locator('.client-settings-page')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '로그인', exact: true }).first()).toBeVisible()
})

test('해제 callback은 pending을 잠그고 새 owner-bound failure/confirmed-delete 목록을 그대로 따른다', async ({ page }) => {
  await mount(page, 'many')
  const connections = section(page)
  await connections.locator('[data-settings-connection="connection-a"]').getByRole('button', { name: '연결 끊기' }).click()
  await expect(connections.locator('[data-settings-connection="connection-a"]').getByRole('button', { name: '연결 끊기' })).toBeDisabled()
  expect(await page.evaluate(() => Reflect.get(window, 'settingsConnections').calls)).toEqual(['disconnect:owner-a:connection-a'])
  await page.evaluate(() => Reflect.get(window, 'settingsConnections').reject(0))
  await expect(connections.locator('[data-settings-connection]')).toHaveCount(2)
  await expect(connections.locator('[data-settings-connection="connection-a"]')).toBeVisible()
  await expect(connections.getByRole('alert')).toHaveText('아직 정보를 받아오지 못했습니다')

  await connections.locator('[data-settings-connection="connection-b"]').getByRole('button', { name: '연결 끊기' }).click()
  await page.evaluate(() => Reflect.get(window, 'settingsConnections').resolve(1))
  await expect(connections.locator('[data-settings-connection="connection-b"]')).toHaveCount(0)
  await expect(connections.locator('[data-settings-connection="connection-a"]')).toBeVisible()
})

test('실제 guard의 resolve와 같은 계정 fresh revision은 실패 feedback과 원버튼 focus를 보존한다', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await mount(page, 'many')
  const connections = section(page)
  const first = connections.locator('[data-settings-connection="connection-a"]').getByRole('button', { name: '연결 끊기' })
  await first.focus()
  await page.keyboard.press('Enter')
  await page.evaluate(() => Reflect.get(window, 'settingsConnections').resolveSame(0))
  await expect(connections.locator('[data-settings-connection]')).toHaveCount(2)
  await expect(connections.getByRole('alert')).toHaveText('아직 정보를 받아오지 못했습니다')
  await expect(first).toBeFocused()
  expect(pageErrors).toEqual([])
})

test('DELETE 확인 뒤 refresh 실패의 filtered 목록은 행을 복원하지 않고 CTA로 focus한다', async ({ page }) => {
  await mount(page, 'many')
  const connections = section(page)
  const second = connections.locator('[data-settings-connection="connection-b"]').getByRole('button', { name: '연결 끊기' })
  await second.focus()
  await page.keyboard.press('Enter')
  await page.evaluate(() => Reflect.get(window, 'settingsConnections').resolve(0))
  await expect(connections.locator('[data-settings-connection="connection-b"]')).toHaveCount(0)
  await expect(connections.getByRole('alert')).toHaveCount(0)
  await expect(connections.getByRole('button', { name: '거래소 연결' })).toBeFocused()
})

test('pending은 계정 tab과 revision을 넘어 같은 owner를 잠그고 stale 완료를 격리한다', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await mount(page, 'many')
  let connections = section(page)
  const first = connections.locator('[data-settings-connection="connection-a"]').getByRole('button', { name: '연결 끊기' })
  await first.click()
  await page.locator('a[href="#/settings/usage"]').click()
  await expect(page.getByRole('heading', { name: '사용량' })).toBeVisible()
  await page.locator('a[href="#/settings/account"]').click()
  connections = section(page)
  await expect(connections.locator('[data-settings-connection="connection-a"]').getByRole('button', { name: '연결 끊기' })).toBeDisabled()
  await page.evaluate(() => Reflect.get(window, 'settingsConnections').advanceRevision())
  const second = connections.locator('[data-settings-connection="connection-b"]').getByRole('button', { name: '연결 끊기' })
  await expect(second).toBeDisabled()
  await second.evaluate(button => (button as HTMLButtonElement).click())
  expect(await page.evaluate(() => Reflect.get(window, 'settingsConnections').calls)).toEqual(['disconnect:owner-a:connection-a'])
  await page.evaluate(() => Reflect.get(window, 'settingsConnections').resolveSame(0))
  await expect(second).toBeEnabled()

  await page.evaluate(() => Reflect.get(window, 'settingsConnections').setThrowId('connection-b'))
  await second.click()
  await expect(second).toBeEnabled()
  await expect(connections.getByRole('alert')).toHaveText('아직 정보를 받아오지 못했습니다')
  expect(pageErrors).toEqual([])
})

test('owner 교체 뒤 이전 owner의 완료는 새 설정 상태를 갱신하지 않는다', async ({ page }) => {
  await mount(page, 'many')
  await section(page).locator('[data-settings-connection="connection-a"]').getByRole('button', { name: '연결 끊기' }).click()
  await page.evaluate(() => {
    const controls = Reflect.get(window, 'settingsConnections')
    controls.setOwner('owner-b')
    controls.setSourceOwner('owner-b')
  })
  const journey = page.locator('.native-connection-onboarding')
  await expect(journey).toBeVisible()
  await journey.locator('.nsp-back, .bk').click()
  const current = section(page)
  await expect(current.locator('[data-settings-connection]')).toHaveCount(2)
  await page.evaluate(() => Reflect.get(window, 'settingsConnections').resolveSame(0))
  await expect(current.getByRole('alert')).toHaveCount(0)
  await expect(current.locator('[data-settings-connection="connection-a"]').getByRole('button', { name: '연결 끊기' })).toBeEnabled()
})

test('settlement보다 한 frame 늦은 authoritative filtered prop을 기다린다', async ({ page }) => {
  await mount(page, 'many')
  const connections = section(page)
  await connections.locator('[data-settings-connection="connection-b"]').getByRole('button', { name: '연결 끊기' }).click()
  await page.evaluate(() => Reflect.get(window, 'settingsConnections').resolveDeferred(0))
  await expect(connections.locator('[data-settings-connection="connection-b"]')).toHaveCount(0)
  await expect(connections.locator('[data-settings-connection="connection-a"]')).toBeVisible()
  await expect(connections.getByRole('alert')).toHaveCount(0)
})

test('같은 connection owner의 account dataset remount에도 pending을 유지한다', async ({ page }) => {
  await mount(page, 'many')
  let connections = section(page)
  await connections.locator('[data-settings-connection="connection-a"]').getByRole('button', { name: '연결 끊기' }).click()
  await page.evaluate(() => Reflect.get(window, 'settingsConnections').setAccountIdentity('account:replacement'))
  connections = section(page)
  await expect(connections.locator('[data-settings-connection="connection-a"]').getByRole('button', { name: '연결 끊기' })).toBeDisabled()
  expect(await page.evaluate(() => Reflect.get(window, 'settingsConnections').calls)).toEqual(['disconnect:owner-a:connection-a'])
  await page.evaluate(() => Reflect.get(window, 'settingsConnections').resolveSame(0))
  await expect(connections.locator('[data-settings-connection="connection-a"]').getByRole('button', { name: '연결 끊기' })).toBeEnabled()
  await expect(connections.getByRole('alert')).toHaveText('아직 정보를 받아오지 못했습니다')
})

test('focus frame은 교체된 connection owner를 다시 확인한다', async ({ page }) => {
  await mount(page, 'many')
  await page.evaluate(() => {
    const queue: FrameRequestCallback[] = []
    Object.assign(window, { settingsFocusFrames: {
      install: () => { window.requestAnimationFrame = callback => { queue.push(callback); return queue.length } },
      flushOne: () => queue.shift()?.(performance.now()),
    } })
    Reflect.get(window, 'settingsFocusFrames').install()
  })
  let connections = section(page)
  const first = connections.locator('[data-settings-connection="connection-a"]').getByRole('button', { name: '연결 끊기' })
  await first.focus()
  await page.keyboard.press('Enter')
  await page.evaluate(() => Reflect.get(window, 'settingsConnections').resolveSame(0))
  await expect(connections.getByRole('alert')).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'settingsConnections').setConnectionIdentity('exchange:replacement'))
  const journey = page.locator('.native-connection-onboarding')
  await expect(journey).toBeVisible()
  await journey.locator('.nsp-back, .bk').click()
  connections = section(page)
  await page.evaluate(() => Reflect.get(window, 'settingsFocusFrames').flushOne())
  await expect(connections.locator('[data-settings-connection="connection-a"]').getByRole('button', { name: '연결 끊기' })).not.toBeFocused()
  await expect(connections.getByRole('button', { name: '거래소 연결' })).not.toBeFocused()
})

test('focus frame은 뒤이어 시작한 pending operation을 침범하지 않는다', async ({ page }) => {
  await mount(page, 'many')
  await page.evaluate(() => {
    const queue: FrameRequestCallback[] = []
    Object.assign(window, { settingsFocusFrames: {
      install: () => { window.requestAnimationFrame = callback => { queue.push(callback); return queue.length } },
      flushOne: () => queue.shift()?.(performance.now()),
    } })
    Reflect.get(window, 'settingsFocusFrames').install()
  })
  const connections = section(page)
  const first = connections.locator('[data-settings-connection="connection-a"]').getByRole('button', { name: '연결 끊기' })
  const second = connections.locator('[data-settings-connection="connection-b"]').getByRole('button', { name: '연결 끊기' })
  await first.click()
  await page.evaluate(() => Reflect.get(window, 'settingsConnections').resolveSame(0))
  await expect(connections.getByRole('alert')).toBeVisible()
  await second.click()
  await expect(second).toBeDisabled()
  await page.evaluate(() => Reflect.get(window, 'settingsFocusFrames').flushOne())
  await expect(first).not.toBeFocused()
  await expect(connections.getByRole('button', { name: '거래소 연결' })).not.toBeFocused()
})

test('마지막 연결 해제는 owner 검증 뒤 기존 거래소 CTA로 focus한다', async ({ page }) => {
  await mount(page, 'one')
  await installFocusFrameQueue(page)
  const connections = section(page)
  const disconnect = connections.locator('[data-settings-connection="connection-a"]').getByRole('button', { name: '연결 끊기' })
  await disconnect.focus()
  await page.keyboard.press('Enter')
  await page.evaluate(() => Reflect.get(window, 'settingsConnections').resolve(0))
  await expect(connections.locator('[data-settings-connection]')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'settingsFocusFrames').pending())).toBe(1)
  expect(await page.evaluate(() => Reflect.get(window, 'settingsFocusFrames').flushOne())).toBe(true)
  await expect(connections.getByRole('button', { name: '거래소 연결' })).toBeFocused()
  expect(await page.evaluate(() => Reflect.get(window, 'settingsFocusFrames').pending())).toBe(0)
})

test('pending 중 settings 이탈 완료는 재진입 heading focus를 침범하지 않는다', async ({ page }) => {
  await mount(page, 'one')
  const connections = section(page)
  const disconnect = connections.locator('[data-settings-connection="connection-a"]').getByRole('button', { name: '연결 끊기' })
  await disconnect.focus()
  await page.keyboard.press('Enter')
  await page.evaluate(() => {
    history.pushState({ tethSite: true }, '', `${location.pathname}${location.search}#/native-client`)
    window.dispatchEvent(new Event('teth:navigate'))
  })
  await expect(page.locator('.client-settings-page')).toHaveCount(0)
  await page.evaluate(async () => {
    Reflect.get(window, 'settingsConnections').resolveSame(0)
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  })
  await installFocusFrameQueue(page)
  await page.evaluate(() => {
    history.pushState({ tethSite: true }, '', `${location.pathname}${location.search}#/settings/account`)
    window.dispatchEvent(new Event('teth:navigate'))
  })
  const heading = page.getByRole('heading', { name: '계정', level: 1 })
  await expect(heading).toBeVisible()
  const flushed = await page.evaluate(() => Reflect.get(window, 'settingsFocusFrames').flushAll())
  expect(flushed.pending).toBe(0)
  expect(flushed.focused).not.toContain('거래소 연결')
  await expect(heading).toBeFocused()
  await expect(section(page).getByRole('alert')).toHaveText('아직 정보를 받아오지 못했습니다')
  expect(await page.evaluate(() => Reflect.get(window, 'settingsFocusFrames').pending())).toBe(0)
})
