import { expect, test } from '@playwright/test'
import { createClientAccountEventStore, CLIENT_ACCOUNT_PREFERENCES_KEY, clientAccountPreferencesKey } from '../src/client-account-event-store'
import { clientAccountHash, isClientAccountEntry, readClientAccountLocation, safeClientAccountHash } from '../src/client-account-navigation'

function memory() {
  const values = new Map<string, string>()
  let failRead = false, failWrite = false
  return { values, readError: (value: boolean) => { failRead = value }, writeError: (value: boolean) => { failWrite = value },
    port: { getItem: (key: string) => { if (failRead) throw new Error('blocked'); return values.get(key) ?? null }, setItem: (key: string, value: string) => { if (failWrite) throw new Error('blocked'); values.set(key, value) } } }
}

test('수신 설정만 저장·복원하고 같은 계정 이외에는 공유하지 않는다', () => {
  const m = memory(), a = createClientAccountEventStore('a@example.test', m.port)
  a.preference('pos', false); a.preference('chM', true)
  const saved = JSON.parse(m.values.get(clientAccountPreferencesKey('a@example.test'))!)
  expect(Object.keys(saved).sort()).toEqual(['owner', 'prefs'])
  expect(createClientAccountEventStore('a@example.test', m.port).getSnapshot().state.notifPrefs).toMatchObject({ pos: false, chM: true, chW: true })
  expect(createClientAccountEventStore('b@example.test', m.port).getSnapshot().state.notifPrefs).toMatchObject({ pos: true, chM: false })
  expect(createClientAccountEventStore(null, m.port).getSnapshot().state.notifs).toEqual([])
})

test('A→B 설정 변경→A 복귀에도 각 계정의 선택이 보존된다', () => {
  const m = memory()
  createClientAccountEventStore('a', m.port).preference('loss', false)
  createClientAccountEventStore('b', m.port).preference('chM', true)
  expect(createClientAccountEventStore('a', m.port).getSnapshot().state.notifPrefs).toMatchObject({ loss: false, chM: false })
  expect(createClientAccountEventStore('b', m.port).getSnapshot().state.notifPrefs).toMatchObject({ loss: true, chM: true })
})

test('읽기 실패 후 재시도는 기존 설정을 복원하고 장애 중 명시 변경만 합친다', () => {
  for (const edit of [false, true]) {
    const m = memory()
    createClientAccountEventStore('a', m.port).preference('loss', false)
    const before = m.values.get(clientAccountPreferencesKey('a'))
    m.readError(true)
    const store = createClientAccountEventStore('a', m.port)
    if (edit) store.preference('chM', true)
    store.retrySave()
    expect(m.values.get(clientAccountPreferencesKey('a'))).toBe(before)
    m.readError(false); store.retrySave()
    expect(store.getSnapshot().storageError).toBe(false)
    expect(store.getSnapshot().state.notifPrefs).toMatchObject({ loss: false, chM: edit })
    expect(createClientAccountEventStore('a', m.port).getSnapshot().state.notifPrefs).toMatchObject({ loss: false, chM: edit })
  }
})

test('불법 복원 필드의 원장·자격·chW 끄기를 실제 상태로 수용하지 않는다', () => {
  const m = memory(), defaults = createClientAccountEventStore('a', m.port).getSnapshot().state
  m.values.set(CLIENT_ACCOUNT_PREFERENCES_KEY, JSON.stringify({ owner: 'a', prefs: { ...defaults.notifPrefs, chW: false }, creditBal: 99999, payDone: true, notifs: [{ id: 'fake' }] }))
  const state = createClientAccountEventStore('a', m.port).getSnapshot().state
  expect(state.notifPrefs.chW).toBe(true)
  expect(state.creditBal).toBe(defaults.creditBal)
  expect(state.payDone).toBe(defaults.payDone)
  expect(state.notifs).toEqual([])
})

test('저장 거부 시 UI 설정은 유지하고 명시 재시도로 같은 선택을 저장한다', () => {
  const m = memory(), store = createClientAccountEventStore('a', m.port)
  const notifications: boolean[] = [], off = store.subscribe(() => notifications.push(store.getSnapshot().storageError))
  m.writeError(true); store.preference('loss', false)
  expect(store.getSnapshot().storageError).toBe(true)
  expect(store.getSnapshot().state.notifPrefs.loss).toBe(false)
  m.writeError(false); store.retrySave()
  expect(store.getSnapshot().storageError).toBe(false)
  expect(createClientAccountEventStore('a', m.port).getSnapshot().state.notifPrefs.loss).toBe(false)
  off(); const count = notifications.length; store.preference('loss', true); expect(notifications).toHaveLength(count)
})

test('손상/차단 복원은 원본 기본값으로 격리하고 게스트는 저장하지 않는다', () => {
  const m = memory(); m.values.set(CLIENT_ACCOUNT_PREFERENCES_KEY, '{')
  expect(createClientAccountEventStore('a', m.port).getSnapshot().storageError).toBe(true)
  m.readError(true)
  expect(createClientAccountEventStore('a', m.port).getSnapshot().state.notifPrefs.pos).toBe(true)
  const guest = createClientAccountEventStore(null, m.port)
  guest.preference('pos', false); guest.retrySave(); guest.readAll(); guest.read('absent')
  expect(guest.getSnapshot().state.notifPrefs.pos).toBe(true)
  expect(guest.getSnapshot().storageError).toBe(false)
  expect(m.values.get(CLIENT_ACCOUNT_PREFERENCES_KEY)).toBe('{')
})

test('원본 계정 경로만 양방향 직렬화하며 외부 링크·잘못된 ID는 받지 않는다', () => {
  for (const hash of ['#/plan', '#/plan/rebates', '#/plan/alerts', '#/review/rv1-3', '#/periodic/W:2026-09-13', '#/trade/bot/b1', '#/trade/bot/1000', '#/trade/bot/strategy_abcdefgh-A']) {
    const route = readClientAccountLocation(hash)
    expect(route).not.toBeNull(); expect(clientAccountHash(route!)).toBe(hash); expect(isClientAccountEntry(hash)).toBe(true)
  }
  expect(isClientAccountEntry('#/trade')).toBe(true)
  for (const hash of ['https://example.test', '#/plan/unknown', '#/plan/', '#/review/', '#/review/rv:1', '#/periodic/<script>', '#/tradealerts', '#/trade/bot/', '#/trade/bot/../b1']) expect(readClientAccountLocation(hash)).toBeNull()
  expect(() => clientAccountHash({ kind: 'review', id: '../bad' })).toThrow()
  for (const id of ['../bad', 'a/b', 'a?x=1', 'a#fragment', 'a%2Fb', 'a b', '<script>']) {
    expect(readClientAccountLocation(`#/trade/bot/${id}`)).toBeNull()
    expect(() => clientAccountHash({ kind: 'bot', id })).toThrow()
    expect(safeClientAccountHash({ kind: 'bot', id })).toBeNull()
  }
  expect(safeClientAccountHash({ kind: 'bot', id: 'strategy_abcdefgh-A' })).toBe('#/trade/bot/strategy_abcdefgh-A')
})

test('공급 review·periodic ID의 밑줄은 보존하고 경로 조작은 계속 거부한다', () => {
  for (const kind of ['review', 'periodic'] as const) {
    const target = { kind, id: `${kind}_abcdefgh-A` }
    const hash = `#/${kind}/${target.id}`
    expect(readClientAccountLocation(hash)).toEqual(target)
    expect(safeClientAccountHash(target)).toBe(hash)
    for (const id of ['../bad', 'a/b', 'a?x=1', 'a#fragment', 'a%2Fb', 'a b', '<script>']) {
      expect(readClientAccountLocation(`#/${kind}/${id}`)).toBeNull()
      expect(safeClientAccountHash({ kind, id })).toBeNull()
    }
  }
  expect(readClientAccountLocation('#/review/rv:1')).toBeNull()
  expect(readClientAccountLocation('#/periodic/W:2026-09-13')).toEqual({ kind: 'periodic', id: 'W:2026-09-13' })
})
