import { expect, test } from '@playwright/test'
import { createClientSharingPreferencesStore, type SharingPreferences } from '../src/client-sharing-preferences'

const owner = 'sharing@example.test'
const key = (name = owner) => `teth-sharing-preferences:account:${encodeURIComponent(name)}`
const defaults: SharingPreferences = { tab: 'find', sort: 'pick', dir: 'desc', asset: 'all' }
const saved: SharingPreferences = { tab: 'follow', sort: 'score', dir: 'asc', asset: '이더리움' }
function fixture() {
  const data = new Map<string, string>(), gets: string[] = [], sets: [string, string][] = [], removes: string[] = []
  const fail = { get: false, set: false, remove: false }
  const storage = {
    getItem(name: string) { gets.push(name); if (fail.get) throw new Error('get blocked'); return data.get(name) ?? null },
    setItem(name: string, value: string) { sets.push([name, value]); if (fail.set) throw new Error('set blocked'); data.set(name, value) },
    removeItem(name: string) { removes.push(name); if (fail.remove) throw new Error('remove blocked'); data.delete(name) },
  }
  return { data, gets, sets, removes, fail, storage }
}

test('초기 기본값과 정상 복원은 mount/read 중 새 쓰기를 만들지 않는다', () => {
  const f = fixture(), store = createClientSharingPreferencesStore(owner, f.storage)
  expect(store.getSnapshot()).toEqual({ preferences: defaults, query: '', storageError: false })
  expect(store.getSnapshot()).toBe(store.getSnapshot())
  expect(store.retrySave()).toBe(true)
  expect(f.sets).toEqual([])
  f.data.set(key(), JSON.stringify(saved))
  expect(createClientSharingPreferencesStore(owner, f.storage).getSnapshot().preferences).toEqual(saved)
  expect(f.sets).toEqual([])
})

test('명시 변경은 네 enum만 저장하고 현재 snapshot과 재로드 결과가 같다', () => {
  const f = fixture(), store = createClientSharingPreferencesStore(owner, f.storage)
  expect(store.update({ tab: 'mine', sort: 'mdd', dir: 'asc', asset: '나스닥' })).toBe(true)
  expect(JSON.parse(f.data.get(key())!)).toEqual({ tab: 'mine', sort: 'mdd', dir: 'asc', asset: '나스닥' })
  expect(createClientSharingPreferencesStore(owner, f.storage).getSnapshot()).toEqual(store.getSnapshot())
  expect([...f.data.keys()]).toEqual([key()])
})

test('모든 tab·sort·dir·asset 선택지는 원문 enum 그대로 roundtrip한다', () => {
  const f = fixture(), store = createClientSharingPreferencesStore(owner, f.storage)
  const choices = { tab: ['find', 'follow', 'mine'], sort: ['pick', 'ret', 'score', 'mdd', 'winrate', 'fw'], dir: ['asc', 'desc'], asset: ['all', '비트코인', '이더리움', '나스닥'] }
  for (const [field, values] of Object.entries(choices)) for (const value of values) {
    expect(store.update({ [field]: value } as Partial<SharingPreferences>)).toBe(true)
    expect(Reflect.get(createClientSharingPreferencesStore(owner, f.storage).getSnapshot().preferences, field)).toBe(value)
  }
})

test('guest는 모든 조작이 메모리만 사용하며 저장소 getter에도 접근하지 않는다', () => {
  const f = fixture(), store = createClientSharingPreferencesStore(null, f.storage)
  expect(store.update(saved)).toBe(true)
  store.setQuery('  한글 조합  ')
  expect(store.getSnapshot()).toEqual({ preferences: saved, query: '  한글 조합  ', storageError: false })
  expect(store.retrySave()).toBe(true)
  expect(store.clear()).toBe(true)
  expect(store.getSnapshot()).toEqual({ preferences: defaults, query: '', storageError: false })
  expect([f.gets, f.sets, f.removes]).toEqual([[], [], []])
})

test('잘못된 owner는 IO와 선호 변경을 거절하며 정규화로 다른 계정과 합치지 않는다', () => {
  for (const invalid of ['', ' ', ' a', 'a ', 'x'.repeat(321), 'a\u0000b', 'a\u007fb', '\ud800', '\udc00', 1, {}]) {
    const f = fixture(), store = createClientSharingPreferencesStore(invalid as string, f.storage)
    expect(store.update(saved)).toBe(false)
    expect(store.clear()).toBe(false)
    expect(store.retrySave()).toBe(false)
    expect(store.getSnapshot().preferences).toEqual(defaults)
    expect(store.getSnapshot().storageError).toBe(true)
    expect([f.gets, f.sets, f.removes]).toEqual([[], [], []])
  }
})

test('계정·Unicode·인코딩 경계는 서로 분리되며 최대 320자 owner를 지원한다', () => {
  const f = fixture(), owners = ['a/b', 'a%2Fb', 'é', 'e\u0301', '검수👩‍💻', 'x'.repeat(320)]
  for (const name of owners) {
    const store = createClientSharingPreferencesStore(name, f.storage)
    expect(store.getSnapshot().preferences).toEqual(defaults)
    expect(store.update(saved)).toBe(true)
  }
  expect(f.data.size).toBe(owners.length)
  expect(createClientSharingPreferencesStore('other', f.storage).getSnapshot().preferences).toEqual(defaults)
})

test('query는 공백·조합·긴 입력을 그대로 보존하고 IO하지 않으며 재로드에는 없다', () => {
  const f = fixture(), store = createClientSharingPreferencesStore(owner, f.storage)
  for (const query of ['  비트  ', 'e\u0301', 'ㄱ', '한'.repeat(2000), '']) {
    store.setQuery(query)
    expect(store.getSnapshot().query).toBe(query)
  }
  store.setQuery('메모리만')
  expect(f.gets).toHaveLength(1)
  expect([f.sets, f.removes]).toEqual([[], []])
  expect(createClientSharingPreferencesStore(owner, f.storage).getSnapshot().query).toBe('')
})

test('invalid patch와 unknown 키는 전체 patch를 원자적으로 거절한다', () => {
  const f = fixture(), store = createClientSharingPreferencesStore(owner, f.storage), before = store.getSnapshot()
  const patches: unknown[] = [null, [], 'ret', { tab: 'FIND' }, { sort: 'ret ' }, { dir: 'up' }, { asset: 'ETH' }, { query: 'x' }, { paid: true }, { tab: 'mine', secret: 'unused-fixture' }, { tab: undefined }, { [Symbol('unknown')]: true }, new Date(0), Object.create({ tab: 'mine' })]
  const accessor = Object.defineProperty({}, 'sort', { get() { throw new Error('must not read'); }, enumerable: true })
  for (const patch of [...patches, accessor]) {
    expect(store.update(patch as Partial<SharingPreferences>)).toBe(false)
    expect(store.getSnapshot()).toBe(before)
  }
  expect(store.update({})).toBe(true)
  expect(f.sets).toEqual([])
})

test('snapshot과 preferences는 immutable이며 동일 상태와 query는 참조를 유지한다', () => {
  const f = fixture(), store = createClientSharingPreferencesStore(owner, f.storage), before = store.getSnapshot()
  expect(Object.isFrozen(before)).toBe(true)
  expect(Object.isFrozen(before.preferences)).toBe(true)
  expect(Reflect.set(before, 'query', 'mutated')).toBe(false)
  expect(Reflect.set(before.preferences, 'sort', 'fw')).toBe(false)
  store.setQuery(''); store.update({ sort: 'pick' })
  expect(store.getSnapshot()).toBe(before)
  store.setQuery('new')
  expect(store.getSnapshot()).not.toBe(before)
  expect(store.getSnapshot().preferences).toBe(before.preferences)
  expect(before.query).toBe('')
})

test('extra raw 필드는 역소비하지 않고 다음 저장에서는 네 enum만 남는다', () => {
  const f = fixture(); f.data.set(key(), JSON.stringify({ ...saved, query: 'secret-query-fixture', paid: true, uidLinked: true, owner: 'other' }))
  const store = createClientSharingPreferencesStore(owner, f.storage)
  expect(store.getSnapshot()).toEqual({ preferences: saved, query: '', storageError: false })
  store.update({ sort: 'fw' })
  expect(JSON.parse(f.data.get(key())!)).toEqual({ ...saved, sort: 'fw' })
})

test('get 실패 뒤 명시 retry는 새 정상 저장값과 dirty 필드만 병합하고 query를 보존한다', () => {
  const f = fixture(); f.data.set(key(), JSON.stringify(saved)); f.fail.get = true
  const store = createClientSharingPreferencesStore(owner, f.storage)
  store.setQuery('  유지할 초안  ')
  expect(store.update({ sort: 'mdd', asset: '비트코인' })).toBe(false)
  expect(f.sets).toEqual([])
  f.fail.get = false
  expect(store.retrySave()).toBe(true)
  expect(store.getSnapshot()).toEqual({ preferences: { ...saved, sort: 'mdd', asset: '비트코인' }, query: '  유지할 초안  ', storageError: false })
  expect(JSON.parse(f.data.get(key())!)).toEqual({ ...saved, sort: 'mdd', asset: '비트코인' })
})

test('읽기 재시도도 실패하면 기존 bytes·메모리 선택·query를 바꾸지 않는다', () => {
  const f = fixture(); f.data.set(key(), JSON.stringify(saved)); f.fail.get = true
  const store = createClientSharingPreferencesStore(owner, f.storage)
  store.update({ tab: 'mine' }); store.setQuery('입력')
  const before = store.getSnapshot()
  expect(store.retrySave()).toBe(false)
  expect(store.getSnapshot()).toBe(before)
  expect(f.data.get(key())).toBe(JSON.stringify(saved))
  expect(f.sets).toEqual([])
})

test('읽기 전 명시한 기본값도 dirty 선택이며 복구된 다른 저장값보다 우선한다', () => {
  const f = fixture(); f.data.set(key(), JSON.stringify(saved)); f.fail.get = true
  const store = createClientSharingPreferencesStore(owner, f.storage)
  const patch = Object.freeze({ sort: 'ret' as const, asset: 'all' as const })
  expect(store.update(patch)).toBe(false)
  f.fail.get = false; f.fail.set = true
  expect(store.retrySave()).toBe(false)
  expect(store.getSnapshot().preferences).toEqual({ ...saved, ...patch })
  expect(f.data.get(key())).toBe(JSON.stringify(saved))
  f.fail.set = false
  expect(store.retrySave()).toBe(true)
  expect(JSON.parse(f.data.get(key())!)).toEqual({ ...saved, ...patch })
  expect(patch).toEqual({ sort: 'ret', asset: 'all' })
})

test('손상 raw는 자동 덮지 않으며 여전히 손상이면 retry도 쓰지 않는다', () => {
  for (const raw of ['{', 'null', '[]', '{}', JSON.stringify({ ...saved, dir: 'bad' }), JSON.stringify({ ...saved, sort: null })]) {
    const f = fixture(); f.data.set(key(), raw)
    const store = createClientSharingPreferencesStore(owner, f.storage)
    expect(store.getSnapshot().storageError).toBe(true)
    expect(store.update({ tab: 'mine' })).toBe(false)
    expect(store.retrySave()).toBe(false)
    expect(store.getSnapshot().preferences.tab).toBe('mine')
    expect(f.data.get(key())).toBe(raw)
    expect([f.sets, f.removes]).toEqual([[], []])
    f.data.set(key(), JSON.stringify(saved))
    expect(store.retrySave()).toBe(true)
    expect(store.getSnapshot().preferences).toEqual({ ...saved, tab: 'mine' })
  }
})

test('읽기 복구만 필요하면 정상값을 재조회하되 기본값을 덮어쓰지 않는다', () => {
  const f = fixture(); f.fail.get = true
  const store = createClientSharingPreferencesStore(owner, f.storage)
  store.setQuery('보존'); f.fail.get = false; f.data.set(key(), JSON.stringify(saved))
  expect(store.retrySave()).toBe(true)
  expect(store.getSnapshot()).toEqual({ preferences: saved, query: '보존', storageError: false })
  expect(f.sets).toEqual([])
})

test('정상 set 실패 후 retry는 원 선택과 query를 유지하고 실패 bytes를 보존한다', () => {
  const f = fixture(); f.data.set(key(), JSON.stringify(saved))
  const store = createClientSharingPreferencesStore(owner, f.storage); f.fail.set = true
  store.setQuery('keep')
  expect(store.update({ sort: 'fw' })).toBe(false)
  expect(store.getSnapshot().preferences).toEqual({ ...saved, sort: 'fw' })
  expect(store.getSnapshot().storageError).toBe(true)
  expect(f.data.get(key())).toBe(JSON.stringify(saved))
  expect(store.retrySave()).toBe(false)
  f.fail.set = false
  expect(store.retrySave()).toBe(true)
  expect(store.getSnapshot()).toEqual({ preferences: { ...saved, sort: 'fw' }, query: 'keep', storageError: false })
})

test('clear는 손상 상태에서도 본인 key만 명시 삭제하고 query와 선호를 초기화한다', () => {
  const f = fixture(); f.data.set(key(), '{'); f.data.set(key('other'), JSON.stringify(saved))
  const store = createClientSharingPreferencesStore(owner, f.storage)
  store.setQuery('입력'); store.update({ tab: 'mine' })
  expect(store.clear()).toBe(true)
  expect(store.getSnapshot()).toEqual({ preferences: defaults, query: '', storageError: false })
  expect(f.data.has(key())).toBe(false)
  expect(f.data.get(key('other'))).toBe(JSON.stringify(saved))
  expect(f.sets).toEqual([])
})

test('clear 실패는 메모리만 초기화하고 clear 또는 retrySave로 삭제를 재시도한다', () => {
  for (const retry of ['clear', 'retrySave'] as const) {
    const f = fixture(); f.data.set(key(), JSON.stringify(saved))
    const store = createClientSharingPreferencesStore(owner, f.storage)
    store.setQuery('초안'); f.fail.remove = true
    expect(store.clear()).toBe(false)
    expect(store.getSnapshot()).toEqual({ preferences: defaults, query: '', storageError: true })
    expect(f.data.get(key())).toBe(JSON.stringify(saved))
    expect(store[retry]()).toBe(false)
    f.fail.remove = false
    expect(store[retry]()).toBe(true)
    expect(f.data.has(key())).toBe(false)
    expect(f.sets).toEqual([])
    expect(f.removes).toHaveLength(3)
  }
})

test('subscriber 예외는 저장·나머지 subscriber·unsubscribe를 방해하지 않는다', () => {
  const f = fixture(), store = createClientSharingPreferencesStore(owner, f.storage), observed: unknown[] = []
  store.subscribe(() => { throw new Error('view failed') })
  const unsubscribe = store.subscribe(() => { observed.push({ tab: store.getSnapshot().preferences.tab, raw: f.data.get(key()) }) })
  expect(store.update({ tab: 'follow' })).toBe(true)
  expect(observed).toEqual([{ tab: 'follow', raw: JSON.stringify({ ...defaults, tab: 'follow' }) }])
  unsubscribe(); store.update({ tab: 'mine' })
  expect(observed).toHaveLength(1)
  expect(JSON.parse(f.data.get(key())!).tab).toBe('mine')
})

test('실패한 clear 뒤 새 명시 선택은 삭제 재시도를 대체하고 기본값 기준으로 저장한다', () => {
  const f = fixture(); f.data.set(key(), JSON.stringify(saved))
  const store = createClientSharingPreferencesStore(owner, f.storage); f.fail.remove = true
  expect(store.clear()).toBe(false)
  f.fail.set = true
  expect(store.update({ asset: '나스닥' })).toBe(false)
  f.fail.set = false
  expect(store.retrySave()).toBe(true)
  expect(JSON.parse(f.data.get(key())!)).toEqual({ ...defaults, asset: '나스닥' })
  expect(f.removes).toHaveLength(1)
})

test('저장소 없는 환경은 예외 없이 메모리 UI만 유지하고 실패를 표시한다', () => {
  const store = createClientSharingPreferencesStore(owner)
  expect(store.update({ sort: 'score' })).toBe(false)
  store.setQuery('keep')
  expect(store.getSnapshot()).toEqual({ preferences: { ...defaults, sort: 'score' }, query: 'keep', storageError: true })
  expect(store.retrySave()).toBe(false)
  expect(store.clear()).toBe(false)
})
