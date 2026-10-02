import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, test } from '@playwright/test'
import ts from 'typescript'
import { archiveAndResetCopyPreview } from '../src/client-copy-preview-recovery'
import { createCopyPreviewState } from '../src/client-copy-preview-state'
import { copyPreviewStorageKey, readCopyPreviewState, saveCopyPreviewState } from '../src/client-copy-preview-store'

const owner = 'owner/한글', id = '11111111-2222-4333-8444-555555555555'
const primaryKey = copyPreviewStorageKey(owner), archiveKey = `teth-copy-preview-recovery:${encodeURIComponent(owner)}:${id}`
const damaged = ' {"v":1,"broken":"원문",  \n'
function fixture(raw: string | null = damaged) {
  const data = new Map<string, string>(), calls: { op: 'get' | 'set'; key: string; value?: string }[] = []
  if (raw !== null) data.set(primaryKey, raw)
  const hooks: { get?: (key: string) => string | null | undefined; beforeSet?: (key: string, value: string) => boolean | void; afterSet?: (key: string) => void } = {}
  const port = {
    getItem(key: string) { calls.push({ op: 'get', key }); const value = hooks.get?.(key); return value === undefined ? data.get(key) ?? null : value },
    setItem(key: string, value: string) { calls.push({ op: 'set', key, value }); if (hooks.beforeSet?.(key, value) === false) return; data.set(key, value); hooks.afterSet?.(key) },
  }
  return { data, calls, hooks, port, primaryWrites: () => calls.filter(call => call.op === 'set' && call.key === primaryKey) }
}

test('손상 원문을 별도 key에 exact 보관·재조회한 뒤 검증된 새 preview로 초기화한다', () => {
  const f = fixture(), result = archiveAndResetCopyPreview(owner, id, f.port)
  expect(result).toEqual({ ok: true, state: createCopyPreviewState(owner), archiveKey })
  expect(f.data.get(archiveKey)).toBe(damaged)
  expect(readCopyPreviewState(owner, f.port)).toEqual({ state: createCopyPreviewState(owner), error: null })
  expect(f.calls.slice(0, 7).map(call => [call.op, call.key])).toEqual([
    ['get', primaryKey], ['get', archiveKey], ['set', archiveKey], ['get', archiveKey],
    ['get', primaryKey], ['set', primaryKey], ['get', primaryKey],
  ])
})

test('원문이 없으면 보관함 없이 검증된 새상태를 저장하고 빈문자 원문도 정확히 보관한다', () => {
  for (const raw of [null, '']) {
    const f = fixture(raw)
    expect(archiveAndResetCopyPreview(owner, id, f.port)).toEqual({ ok: true, state: createCopyPreviewState(owner), archiveKey: raw === null ? null : archiveKey })
    expect(f.data.has(archiveKey)).toBe(raw !== null)
    if (raw !== null) expect(f.data.get(archiveKey)).toBe(raw)
  }
})

test('owner와 UUIDv4 recovery ID가 잘못되면 저장소 접근하지 않는다', () => {
  const f = fixture()
  for (const value of ['', ' owner', 'a\nb', 'a'.repeat(321), '\ud800', null]) {
    expect(archiveAndResetCopyPreview(value as string, id, f.port)).toMatchObject({ ok: false, error: 'invalid-owner', archiveKey: null })
  }
  for (const value of ['', '../other', 'one', id + ' ', '11111111-2222-3333-8444-555555555555', '11111111-2222-4333-1444-555555555555', null]) {
    expect(archiveAndResetCopyPreview(owner, value as string, f.port)).toMatchObject({ ok: false, error: 'invalid-recovery-id', archiveKey: null })
  }
  expect(f.calls).toEqual([])
})

test('동일 id 보관함이 있으면 현재 원문과 같아도 재사용하거나 덮어쓰지 않는다', () => {
  for (const previous of [damaged, 'older', '']) {
    const f = fixture(); f.data.set(archiveKey, previous)
    expect(archiveAndResetCopyPreview(owner, id, f.port)).toMatchObject({ ok: false, error: 'archive-exists', retryRead: true })
    expect(f.data.get(primaryKey)).toBe(damaged)
    expect(f.data.get(archiveKey)).toBe(previous)
    expect(f.calls.filter(call => call.op === 'set')).toEqual([])
  }
})

test('2MB를 넘는 원문은 UTF8 기준으로 거절하며 사본을 자르거나 원본을 변경하지 않는다', () => {
  for (const raw of ['a'.repeat(2_000_001), '가'.repeat(666_667)]) {
    const f = fixture(raw)
    expect(archiveAndResetCopyPreview(owner, id, f.port)).toMatchObject({ ok: false, error: 'archive-too-large', archiveKey: null })
    expect(f.data.get(primaryKey)).toBe(raw)
    expect(f.calls.filter(call => call.op === 'set')).toEqual([])
  }
  const f = fixture('a'.repeat(2_000_000))
  expect(archiveAndResetCopyPreview(owner, id, f.port).ok).toBe(true)
  expect(f.data.get(archiveKey)?.length).toBe(2_000_000)
})

test('원본/기존보관함 읽기 실패는 쓰기하지 않고 각 오류를 구분한다', () => {
  for (const failedKey of [primaryKey, archiveKey]) {
    const f = fixture(); f.hooks.get = key => { if (key === failedKey) throw new Error('read denied') }
    expect(archiveAndResetCopyPreview(owner, id, f.port)).toMatchObject({ ok: false, error: failedKey === primaryKey ? 'read-failed' : 'archive-read-failed' })
    expect(f.calls.filter(call => call.op === 'set')).toEqual([])
    expect(f.data.get(primaryKey)).toBe(damaged)
  }
})

test('보관함 쓰기 전 예외·쓰기 후 예외는 primary를 덮지 않고 시도한 archiveKey를 반환한다', () => {
  for (const after of [false, true]) {
    const f = fixture()
    if (after) f.hooks.afterSet = key => { if (key === archiveKey) throw new Error('write then throw') }
    else f.hooks.beforeSet = key => { if (key === archiveKey) throw new Error('quota') }
    expect(archiveAndResetCopyPreview(owner, id, f.port)).toMatchObject({ ok: false, error: 'archive-write-failed', archiveKey })
    expect(f.data.get(primaryKey)).toBe(damaged)
    expect(f.primaryWrites()).toEqual([])
    expect(f.data.has(archiveKey)).toBe(after)
  }
})

test('사본 재읽기 실패·무시된 쓰기·다른bytes 모두 primary 덮기 전에 멈춘다', () => {
  for (const mode of ['read-throw', 'discard', 'different']) {
    const f = fixture()
    if (mode === 'discard') f.hooks.beforeSet = key => key !== archiveKey
    if (mode === 'different') f.hooks.afterSet = key => { if (key === archiveKey) f.data.set(key, 'changed') }
    if (mode === 'read-throw') f.hooks.get = key => { if (key === archiveKey && f.data.has(key)) throw new Error('readback') }
    expect(archiveAndResetCopyPreview(owner, id, f.port)).toMatchObject({ ok: false, error: 'archive-readback-failed', archiveKey })
    expect(f.primaryWrites()).toEqual([])
    expect(f.data.get(primaryKey)).toBe(damaged)
  }
})

test('원본이 보관 중 변경되거나 확인 읽기에 실패하면 더 최신 원본을 초기화하지 않는다', () => {
  const changed = fixture()
  changed.hooks.afterSet = key => { if (key === archiveKey) changed.data.set(primaryKey, 'newer') }
  expect(archiveAndResetCopyPreview(owner, id, changed.port)).toMatchObject({ ok: false, error: 'source-changed', archiveKey, retryRead: true })
  expect(changed.data.get(primaryKey)).toBe('newer'); expect(changed.data.get(archiveKey)).toBe(damaged)
  expect(changed.primaryWrites()).toEqual([])
  const unreadable = fixture()
  unreadable.hooks.get = key => { if (key === primaryKey && unreadable.data.has(archiveKey)) throw new Error('reread') }
  expect(archiveAndResetCopyPreview(owner, id, unreadable.port)).toMatchObject({ ok: false, error: 'read-failed', archiveKey, retryRead: true })
  expect(unreadable.primaryWrites()).toEqual([])
})

test('새상태 저장 전/후 예외·재읽기 실패는 보관함 유지와 재조회 요구를 반환한다', () => {
  for (const mode of ['write-before', 'write-after', 'readback']) {
    const f = fixture()
    if (mode === 'write-before') f.hooks.beforeSet = key => { if (key === primaryKey) throw new Error('write') }
    if (mode === 'write-after') f.hooks.afterSet = key => { if (key === primaryKey) throw new Error('written') }
    if (mode === 'readback') f.hooks.get = key => { if (key === primaryKey && f.primaryWrites().length) throw new Error('reread') }
    expect(archiveAndResetCopyPreview(owner, id, f.port)).toMatchObject({ ok: false, error: 'reset-failed', archiveKey, retryRead: true,
      saveError: mode === 'readback' ? 'readback-failed' : 'write-failed' })
    expect(f.data.get(archiveKey)).toBe(damaged)
    expect(f.data.get(primaryKey)).toBe(mode === 'write-before' ? damaged : JSON.stringify(createCopyPreviewState(owner)))
  }
})

test('다른 owner와 인코딩유사 owner의 원본·보관함은 조회하거나 변경하지 않는다', () => {
  const f = fixture(), other = encodeURIComponent(owner), otherKey = copyPreviewStorageKey(other)
  f.data.set(otherKey, 'another owner')
  expect(archiveAndResetCopyPreview(owner, id, f.port).ok).toBe(true)
  expect(f.data.get(otherKey)).toBe('another owner')
  expect(f.calls.every(call => call.key === primaryKey || call.key === archiveKey)).toBe(true)
})

test('선언은 무부작용이며 명시 port는 브라우저·시계·무작위·네트워크를 접근하지 않는다', () => {
  const exports: Record<string, typeof archiveAndResetCopyPreview> = {}, touches: string[] = []
  const forbidden = (name: string) => () => { touches.push(name); throw new Error(name) }
  const context = { exports, TextEncoder, require: (name: string) => name.includes('state') ? { createCopyPreviewState } : { copyPreviewStorageKey, saveCopyPreviewState },
    fetch: forbidden('fetch'), setTimeout: forbidden('setTimeout'), Date: forbidden('Date'), crypto: { randomUUID: forbidden('randomUUID') } }
  for (const name of ['window', 'document', 'sessionStorage']) Object.defineProperty(context, name, { get: forbidden(name) })
  const compiled = ts.transpileModule(readFileSync('src/client-copy-preview-recovery.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  runInNewContext(compiled, context, { timeout: 1000 })
  expect(touches).toEqual([])
  expect(exports.archiveAndResetCopyPreview(owner, id, fixture().port).ok).toBe(true)
  expect(touches).toEqual([])
  expect(exports.archiveAndResetCopyPreview(owner, id)).toMatchObject({ ok: false, error: 'storage-unavailable' })
  expect(touches).toEqual(['sessionStorage'])
})
