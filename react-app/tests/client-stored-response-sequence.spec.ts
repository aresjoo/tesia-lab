import { expect, test } from '@playwright/test'
import { canAdvanceResponseSequence, readStoredResponseSequence, responseSequenceText,
  type StoredResponseSequence, type StoredResponseSequenceBlock } from '../src/client-stored-response-sequence'
import type { StoredMarketResponse } from '../src/client-stored-market-response'

// 순수 표시 디코더 검사다. 실제 Main 연결·저장 ACK·서비스 공급자 검사가 아니다.
const owner = 'sequence@example.test', sessionId = '대화-1', turnId = '답변-1'
type Work = Extract<StoredResponseSequenceBlock, { kind: 'work' }>
type Text = Extract<StoredResponseSequenceBlock, { kind: 'text' }>
const prose = (status: Text['status'] = 'streaming', text = '공급된 부분 본문'): Text => ({ id: 'text', kind: 'text', text, status })
const work = (status: Work['activity']['status'] = 'running'): Work => ({ id: 'work', kind: 'work', activity: {
  label: '공급된 공개 작업', status, startedAt: 0, ...(status === 'running' ? {} : { finishedAt: 1 }),
  steps: [{ id: 'step', title: '출처 확인', status, detail: '', publicSummary: '공급된 요약',
    sources: [{ id: 'source', title: '원문 출처', url: 'https://example.test/source', description: '설명' }] }],
} })
const sequence = (blocks: StoredResponseSequenceBlock[] = [work(), prose()]): StoredResponseSequence => ({
  version: 1, owner, sessionId, turnId, revision: 1, status: 'running', blocks,
})
const market = (): StoredMarketResponse => ({ version: 1, owner, blocks: [{ id: 'evidence', kind: 'market-evidence',
  presentation: { binding: { scopeId: JSON.stringify([owner, sessionId]), messageId: turnId, observationId: 'observation' },
    searches: 0, results: 0, pagesRead: 0, sources: [] } }] })
const ref = (): StoredResponseSequenceBlock => ({ id: 'evidence', kind: 'market-ref', blockId: 'evidence' })
const read = (value: unknown, suppliedMarket?: StoredMarketResponse) => readStoredResponseSequence(value, sessionId, turnId, suppliedMarket)
function next(previous: StoredResponseSequence): StoredResponseSequence {
  return { ...structuredClone(previous), revision: previous.revision + 1 }
}

test('원본 작업·본문·시장 참조 교차 순서와 모든 유효 상태를 보존한다', () => {
  for (const status of ['running', 'done', 'stopped', 'failed'] as const) {
    const value = { ...sequence([work(status), prose(status === 'running' ? 'streaming' : 'interrupted'), ref()]), status }
    expect(read(value, market())).toEqual(value)
  }
  expect(read({ ...sequence([work('failed'), prose('interrupted'), { ...work('done'), id: 'recovered' }]), status: 'done' })).not.toBeNull()
  expect(read({ ...sequence([prose('done', '')]), owner: null })).not.toBeNull()
  expect(read({ ...sequence(), revision: Number.MAX_SAFE_INTEGER })).not.toBeNull()
})

for (const [language, value] of Object.entries({ ko: '  한국어\n본문 👩🏽‍💻 ', en: 'English\nanswer', ja: '日本語の本文',
  'zh-CN': '简体中文内容', 'zh-TW': '繁體中文內容', es: 'Información y acción', fr: 'Réponse déjà reçue' })) {
  test(`${language} 문자열과 빈 부분본문을 수정 없이 복사 투영한다`, () => {
    const input = sequence([prose('done', value), work('done'), { ...prose('interrupted', ''), id: 'empty' },
      { ...prose('streaming', '<script>알려진 원문</script>'), id: 'tail' }])
    const result = read(input)!
    expect(result).toEqual(input)
    expect(responseSequenceText(result)).toBe(`${value}\n\n\n\n<script>알려진 원문</script>`)
    expect(responseSequenceText(sequence([work('done')]))).toBe('')
  })
}

test('잘못된 envelope·소유자·대화·revision·상태는 예외 없이 거절한다', () => {
  const invalid: unknown[] = [undefined, null, [], 'record', 1, true, {},
    ...[0, -1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null].map(revision => ({ ...sequence(), revision })),
    ...['', '  ', [], {}, 7, undefined].map(owner => ({ ...sequence(), owner })),
    ...[0, 2, '1', undefined].map(version => ({ ...sequence(), version })),
    ...['unknown', '', null, []].map(status => ({ ...sequence(), status })),
    { ...sequence(), sessionId: '다른 대화' }, { ...sequence(), turnId: '다른 답변' },
    { ...sequence(), sessionId: [sessionId] }, { ...sequence(), turnId: [turnId] },
    { get version() { throw new Error('손상 getter') } },
  ]
  for (const value of invalid) expect(read(value)).toBeNull()
  expect(readStoredResponseSequence(sequence(), '', turnId, undefined)).toBeNull()
  expect(readStoredResponseSequence(sequence(), sessionId, '', undefined)).toBeNull()
})

test('빈·희소·중복·미지 종류·크기 초과 블록을 거절하고 정확한 상한을 허용한다', () => {
  for (const blocks of [null, {}, 'text', [], [null], Array(1), [prose(), prose()],
    [{ ...prose(), id: ' ' }], [{ ...prose(), id: ['text'] }], [{ ...prose(), kind: 'execute' }],
    [{ ...prose(), text: ['본문'] }], [{ ...prose(), status: 'running' }],
    [{ ...prose(), text: '가'.repeat(1_000_001) }],
    Array.from({ length: 257 }, (_, i) => ({ ...prose(), id: String(i) }))]) expect(read({ ...sequence(), blocks })).toBeNull()
  expect(read(sequence([prose('streaming', '가'.repeat(1_000_000))]))?.blocks).toHaveLength(1)
  expect(read(sequence(Array.from({ length: 256 }, (_, i) => ({ ...prose(), id: String(i) }))))?.blocks).toHaveLength(256)
})

test('작업의 필수 문자열·상태·시각·중복 단계·출처 손상을 거절한다', () => {
  const original = work().activity, step = original.steps[0], source = step.sources![0]
  const activities: unknown[] = [null, [], {}, { ...original, label: ['작업'] }, { ...original, label: ' ' },
    { ...original, status: 'success' }, { ...original, steps: [step, step] }, { ...original, steps: Array(1) },
    ...[-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null].flatMap(value => [
      { ...original, startedAt: value }, { ...original, finishedAt: value }]),
    { ...original, startedAt: 2, finishedAt: 1 },
    ...[{ ...step, id: '' }, { ...step, title: [] }, { ...step, title: ' ' }, { ...step, status: 'success' },
      { ...step, detail: null }, { ...step, publicSummary: [] }, { ...step, sources: [source, source] },
      { ...step, sources: Array(1) }, { ...step, sources: [{ ...source, description: {} }] },
      { ...step, sources: [{ ...source, url: [] }] }, { ...step, sources: [{ ...source, title: '' }] },
    ].map(step => ({ ...original, steps: [step] })),
  ]
  for (const activity of activities) expect(read({ ...sequence(), blocks: [{ ...work(), activity }] })).toBeNull()
  expect(read(sequence([{ ...work(), activity: { label: '시작', status: 'running', steps: [] } }]))).not.toBeNull()
})

test('시장 참조는 소유자와 유일한 실제 ID만 허용하며 일반 블록과 충돌할 수 없다', () => {
  const input = sequence([ref()]), supplied = market()
  expect(read(input, supplied)).toEqual(input)
  expect(read(input)).toBeNull()
  expect(read(input, { ...supplied, owner: '다른 계정' })).toBeNull()
  expect(read(input, { ...supplied, blocks: [] })).toBeNull()
  expect(read(input, { ...supplied, blocks: [...supplied.blocks, ...supplied.blocks] })).toBeNull()
  expect(read(sequence([{ id: '별도 ID', kind: 'market-ref', blockId: 'evidence' }]), supplied)).toBeNull()
  expect(read(sequence([{ id: 'missing', kind: 'market-ref', blockId: 'missing' }]), supplied)).toBeNull()
  expect(read(sequence([{ ...prose(), id: 'evidence' }]), supplied)).toBeNull()
  expect(read(sequence([{ ...work(), id: 'evidence' }]), supplied)).toBeNull()
})

test('알려진 필드만 깊게 분리하고 위험 URL과 HTML도 실행 아닌 원문 데이터로 남긴다', () => {
  const item = work(), source = item.activity.steps[0].sources![0]
  const decorated = { ...item, privateReasoning: '버릴 값', activity: { ...item.activity, secret: '버릴 값',
    steps: [{ ...item.activity.steps[0], privateReasoning: '버릴 값', sources: [{ ...source, url: 'javascript:alert(1)', extra: '버릴 값' }] }] } }
  const input = { ...sequence([decorated]), ignored: '버릴 값' }
  const result = read(input)!, decoded = result.blocks[0] as Work
  expect(result).not.toHaveProperty('ignored')
  expect(decoded).not.toHaveProperty('privateReasoning')
  expect(decoded.activity).not.toHaveProperty('secret')
  expect(decoded.activity.steps[0]).not.toHaveProperty('privateReasoning')
  expect(decoded.activity.steps[0].sources![0]).toEqual({ ...source, url: 'javascript:alert(1)' })
  expect(result).not.toBe(input); expect(result.blocks).not.toBe(input.blocks)
  expect(decoded.activity).not.toBe(item.activity)
  const snapshot = structuredClone(result)
  const suppliedWork = input.blocks[0] as Work
  suppliedWork.activity.steps[0].sources![0].title = '이후 입력 변경'
  suppliedWork.activity.steps[0].title = '이후 단계 변경'
  suppliedWork.activity.label = '이후 작업 변경'
  expect(result).toEqual(snapshot)
  decoded.activity.steps[0].sources![0].description = '복원 결과 변경'
  expect(suppliedWork.activity.steps[0].sources![0].description).toBe('설명')
})

test('종료 envelope에는 진행 중 작업·단계·본문이 남을 수 없다', () => {
  for (const status of ['done', 'stopped', 'failed'] as const) {
    for (const blocks of [[work()], [prose()], [{ ...work('done'), activity: { ...work('done').activity, steps: work().activity.steps } }]]) {
      expect(read({ ...sequence(blocks), status })).toBeNull()
    }
    expect(read({ ...sequence([work('stopped'), prose('interrupted')]), status })).not.toBeNull()
  }
})

test('종료된 작업에 진행 중 단계가 남은 모순은 envelope가 running이어도 거절한다', () => {
  for (const status of ['done', 'stopped', 'failed'] as const) {
    const item = work(status)
    item.activity.steps = work().activity.steps
    expect(read(sequence([item]))).toBeNull()
  }
})

test('진행 중 본문은 접두 원문을 유지해 추가하고 작업은 명시 관측으로 전이한다', () => {
  for (const state of ['streaming', 'done', 'interrupted'] as const) {
    const previous = sequence(), updated = next(previous)
    updated.blocks = [work('done'), prose(state, '공급된 부분 본문\n다음 원문'), { ...work(), id: 'next-work' }]
    expect(canAdvanceResponseSequence(previous, updated)).toBe(true)
  }
  const previous = sequence([work()]), updated = next(previous)
  updated.blocks = [{ ...work('failed'), activity: { ...work('failed').activity, label: '실제 공급된 실패 설명' } }]
  updated.status = 'failed'
  expect(canAdvanceResponseSequence(previous, updated)).toBe(true)
  expect(canAdvanceResponseSequence(sequence([prose('streaming', '')]), { ...sequence([prose('done', '새 원문')]), revision: 2, status: 'done' })).toBe(true)
})

test('과거 revision·다른 소유자·대화·순서·종류·ID·접두 원문 변경은 수락하지 않는다', () => {
  const previous = sequence(), valid = next(previous)
  const invalid = [
    ...[1, 3, 0, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map(revision => ({ ...valid, revision })),
    { ...valid, owner: null }, { ...valid, owner: '다른 계정' }, { ...valid, sessionId: '다른 대화' }, { ...valid, turnId: '다른 답변' },
    { ...valid, blocks: [prose(), work()] }, { ...valid, blocks: [work()] },
    { ...valid, blocks: [work(), { ...prose(), id: '다른 ID' }] },
    { ...valid, blocks: [work(), { ...work(), id: 'text' }] },
    ...['공급된 부분', '변경된 부분 본문', ' 공급된 부분 본문'].map(text => ({ ...valid, blocks: [work(), prose('streaming', text)] })),
  ]
  for (const value of invalid) expect(canAdvanceResponseSequence(previous, value)).toBe(false)
  for (const status of ['done', 'failed', 'stopped'] as const) expect(canAdvanceResponseSequence(previous, { ...valid, status })).toBe(false)
})

test('완료·중단 본문과 종료 작업·시장 참조는 이후 revision에서도 불변이다', () => {
  for (const status of ['done', 'interrupted'] as const) {
    const previous = sequence([prose(status)]), updated = next(previous)
    expect(canAdvanceResponseSequence(previous, updated)).toBe(true)
    expect(canAdvanceResponseSequence(previous, { ...updated, blocks: [prose(status, '교체 원문')] })).toBe(false)
    expect(canAdvanceResponseSequence(previous, { ...updated, blocks: [prose('streaming')] })).toBe(false)
  }
  for (const status of ['done', 'stopped', 'failed'] as const) {
    const previous = sequence([work(status)]), updated = next(previous)
    expect(canAdvanceResponseSequence(previous, updated)).toBe(true)
    const changed = structuredClone(updated)
    ;(changed.blocks[0] as Work).activity.steps[0].sources![0].url = 'https://example.test/changed'
    expect(canAdvanceResponseSequence(previous, changed)).toBe(false)
    expect(canAdvanceResponseSequence({ ...previous, status }, { ...updated, status })).toBe(false)
  }
  const previous = sequence([ref()]), updated = next(previous)
  expect(canAdvanceResponseSequence(previous, updated)).toBe(true)
  expect(canAdvanceResponseSequence(previous, { ...updated, blocks: [{ id: 'evidence', kind: 'market-ref', blockId: 'different' }] })).toBe(false)
})
