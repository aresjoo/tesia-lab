import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { expect, test } from '@playwright/test'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import { captureTurnObservation, captureValidationObservation, observationResponseBlocks, turnResponseBlocks, validationResponseBlocks } from '../../src/internal-poc/native-research-observations'
import { nativeObservationCopy } from '../../src/internal-poc/native-observation-copy'
import type { ClientLanguage } from '../../src/client-preferences'
import type { ClientResponseBlock } from '../../src/components/ClientResponseSequence'
import type { CompilerTurnResult, ConversationSnapshot, ConversationTurn, DraftMergeResult, DraftValidationFailure, DraftValidationReceipt } from '../../src/internal-poc/contracts/generated/api-v0.3/types'

// Pure presentation tests. The recorded snapshot supplies shape, not a new
// compiler/validation approval. Native SDK and owner checks remain caller-owned.
const snapshot = fixture.snapshots.ready as ConversationSnapshot
const receipt = fixture.documents.find(item => item.name === 'validation-receipt')!.value as DraftValidationReceipt
const source = { turnId: 'turn_observation_001', textSha256: 'd'.repeat(64), normalization: 'unicode_nfc_codepoint_v1' as const }
const evidence = '  레버리지 3배 🧪\n<script>doNotExecute()</script>  '
const compiler: Record<CompilerTurnResult['status'], CompilerTurnResult> = {
  PATCH_PROPOSED: { contractVersion: '0.1.0', status: 'PATCH_PROPOSED', source,
    draftPatch: { contractVersion: '0.1.0', baseDraftVersion: 1, atomic: true, patches: [
      { op: 'set', target: { entity: 'execution', field: 'leverage' }, precondition: { expectedState: 'absent' }, value: 3,
        evidenceSpan: { text: evidence, start: 0, end: Array.from(evidence).length, offsetUnit: 'unicode_code_point' }, reasonCode: 'user_correction' },
      { op: 'set', target: { entity: 'market', field: 'symbol' }, precondition: { expectedState: 'absent' }, value: 'BTCUSDT',
        evidenceSpan: { text: '비트코인', start: 0, end: 4, offsetUnit: 'unicode_code_point' }, reasonCode: 'user_addition' },
    ] } },
  CLARIFICATION_REQUIRED: { contractVersion: '0.1.0', status: 'CLARIFICATION_REQUIRED', source,
    question: { questionId: 'question_observation_001', targetField: 'position_sizing', reasonCode: 'AMBIGUOUS_NOTIONAL_OR_MARGIN',
      prompt: '  주문 금액인가요?\n증거금인가요?  ', options: ['주문 금액 <100>', '증거금 & 10'] } },
  UNSUPPORTED: { contractVersion: '0.1.0', status: 'UNSUPPORTED', source, reasonCode: 'SUBJECTIVE_SIGNAL',
    message: '  좋은 분위기는 판단할 수 없어요.\n<상승> & 하락  ' },
}
const applied: DraftMergeResult = { contractVersion: '0.2.0', status: 'APPLIED', sourceTurnId: source.turnId,
  baseDraftRevision: 1, resultDraftRevision: 2, beforeProjectionHash: 'a'.repeat(64), afterProjectionHash: snapshot.projectionHash,
  appliedPatchCount: 1, draftState: snapshot.draftState, issues: [] }
const rejected: DraftMergeResult = { ...applied, status: 'REJECTED', resultDraftRevision: 1, appliedPatchCount: 0,
  issues: [{ code: 'PRECONDITION_FAILED', instancePath: '/patches/0/value', patchIndex: 0 }, { code: 'REFERENCE_UNKNOWN', instancePath: '/features' }] }
const invalid: DraftValidationFailure = { conversationId: snapshot.conversationId, conversationStateRevision: snapshot.conversationStateRevision,
  conversationStateHash: snapshot.conversationStateHash, draftId: snapshot.draftId, draftRevision: snapshot.draftRevision,
  projectionHash: snapshot.projectionHash, status: 'INVALID', issues: [{ code: 'REQUIRED_FIELD', path: '/positionSizing' }, { code: '<INVALID>', path: '/entryRules/0/condition' }] }
const makeTurn = (status: CompilerTurnResult['status'] = 'PATCH_PROPOSED', mergeResult: DraftMergeResult | null = applied): ConversationTurn =>
  ({ turnId: source.turnId, conversation: snapshot, compilerTurnResult: compiler[status], mergeResult })
const work = (blocks: readonly ClientResponseBlock[]) => {
  const block = blocks[0]
  expect(block.kind).toBe('work')
  if (block.kind !== 'work') throw new Error('Expected work block')
  return block.activity
}
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

// Generated SDK additionally forbids PATCH_PROPOSED + null, and non-patch
// compiler results + merge. These matrix cells test defensive display behavior
// of the broader generated TypeScript shape, not accepted network responses.
for (const status of ['PATCH_PROPOSED', 'CLARIFICATION_REQUIRED', 'UNSUPPORTED'] as const) {
  for (const merge of [applied, rejected, null]) {
    test(`${status} / ${merge?.status ?? 'null'}: 관측한 compiler와 merge를 독립적으로 표시한다`, () => {
      const blocks = turnResponseBlocks(makeTurn(status, merge), '원문 응답')
      const activity = work(blocks)
      expect(blocks.map(block => block.kind)).toEqual(['work', 'text'])
      expect(activity.steps).toHaveLength(merge ? 2 : 1)
      expect(activity.status).toBe(status === 'UNSUPPORTED' || merge?.status === 'REJECTED' ? 'failed' : 'done')
      expect(activity.label).toBe(merge?.status === 'REJECTED' ? '초안 변경 적용 거절' : status === 'UNSUPPORTED' ? '미지원 조건 확인'
        : status === 'CLARIFICATION_REQUIRED' ? '추가 확인 필요' : merge?.status === 'APPLIED' ? '전략 초안 반영 확인' : '전략 변경 제안 확인')
      expect(activity.steps[0].title).toBe({ PATCH_PROPOSED: '전략 변경 제안 확인', CLARIFICATION_REQUIRED: '추가 확인 질문', UNSUPPORTED: '지원 범위 확인' }[status])
      if (merge) {
        expect(activity.steps[1].status).toBe(merge.status === 'APPLIED' ? 'done' : 'failed')
        expect(activity.steps[1].title).toBe(merge.status === 'APPLIED' ? '초안 반영 1개 확인' : '초안 반영 거절')
        expect(activity.steps[1].detail).toContain(`초안 revision 1 → ${merge.resultDraftRevision}`)
      } else {
        expect(activity.steps.some(step => step.title.includes('반영'))).toBe(false)
      }
      expect(activity).not.toHaveProperty('startedAt')
      expect(activity).not.toHaveProperty('finishedAt')
      expect(activity).not.toHaveProperty('source')
    })
  }
}

test('제안 2개와 실제 적용 1개/0개를 혼동하지 않고 사용자의 근거를 그대로 보존한다', () => {
  const activity = work(turnResponseBlocks(makeTurn(), ''))
  expect(activity.steps[0].detail).toContain('제안 2개')
  expect(activity.steps[0].publicSummary).toContain(`사용자 근거: ${evidence}`)
  expect(activity.steps[0].publicSummary).toContain('set · execution / leverage · user_correction')
  expect(activity.steps[1].detail).toContain('서버 보고 적용 수: 1개')
  expect(work(turnResponseBlocks(makeTurn('PATCH_PROPOSED', { ...applied, appliedPatchCount: 0 }), '')).steps[1].title).toBe('초안 반영 0개 확인')
  expect(work(turnResponseBlocks(makeTurn('PATCH_PROPOSED', null), '')).steps[0].detail).toContain('서버가 초안 적용 결과를 제공하지 않았습니다.')
})

test('거절 issue의 code/path와 0-based patchIndex를 빠뜨리거나 발명하지 않는다', () => {
  const detail = work(turnResponseBlocks(makeTurn('PATCH_PROPOSED', rejected), '')).steps[1].detail!
  expect(detail).toContain('PRECONDITION_FAILED · 경로: /patches/0/value · patchIndex: 0')
  expect(detail).toContain('REFERENCE_UNKNOWN · 경로: /features')
  expect(detail.match(/patchIndex:/g)).toHaveLength(1)
  expect(detail).not.toContain('undefined')
})

test('추가 질문/options 및 unsupported reason/message를 서버 원문 그대로 보존한다', () => {
  const question = work(turnResponseBlocks(makeTurn('CLARIFICATION_REQUIRED', null), '')).steps[0]
  const unsupported = work(turnResponseBlocks(makeTurn('UNSUPPORTED', null), '')).steps[0]
  expect(question.publicSummary).toBe('  주문 금액인가요?\n증거금인가요?  \n주문 금액 <100>\n증거금 & 10')
  expect(question.detail).toContain('AMBIGUOUS_NOTIONAL_OR_MARGIN')
  expect(unsupported.publicSummary).toBe('  좋은 분위기는 판단할 수 없어요.\n<상승> & 하락  ')
  expect(unsupported.detail).toContain('SUBJECTIVE_SIGNAL')
})

for (const reply of ['', '  기존 답변\n<script>alert(1)</script> & 🧪  ']) {
  test(`replyText 원문 보존: ${reply ? '공백·줄바꿈·태그' : '빈 문자열'}`, () => {
    const block = turnResponseBlocks(makeTurn(), reply)[1]
    expect(block).toMatchObject({ kind: 'text', text: reply, status: 'done' })
  })
}

test('VALID 영수증의 revision/발급/만료를 표시하되 승인과 실행으로 승격하지 않는다', () => {
  const blocks = validationResponseBlocks(receipt)
  expect(work(blocks)).toMatchObject({ label: '전략 검증 완료', status: 'done' })
  expect(work(blocks)).not.toHaveProperty('startedAt')
  expect(work(blocks).steps[0].detail).toContain(`초안 revision ${receipt.draftRevision}`)
  expect(work(blocks).steps[0].detail).toContain(receipt.issuedAt)
  expect(work(blocks).steps[0].detail).toContain(receipt.expiresAt)
  expect(work(blocks).steps[0].detail).toContain(receipt.validationReceiptId)
  expect(blocks[1]).toMatchObject({ kind: 'text', text: '해당 초안의 서버 검증을 확인했습니다. 사용자 승인이나 실행 완료를 뜻하지 않습니다.' })
  expect(work(blocks)).not.toHaveProperty('finishedAt')
})

test('INVALID issue code/path를 보존하며 통과·receipt 발급 시각을 만들지 않는다', () => {
  const activity = work(validationResponseBlocks(invalid))
  expect(activity).toMatchObject({ label: '전략 검증 확인 필요', status: 'failed' })
  expect(activity).not.toHaveProperty('startedAt')
  expect(activity.steps[0].detail).toContain('REQUIRED_FIELD · 경로: /positionSizing')
  expect(activity.steps[0].detail).toContain('<INVALID> · 경로: /entryRules/0/condition')
  expect(activity.steps[0].detail).not.toContain('발급:')
  expect(activity.steps[0].title).not.toContain('통과')
  expect(activity).not.toHaveProperty('finishedAt')
})

test('stable ID는 turn/대화/초안/revision/결과 종류와 receipt를 구별한다', () => {
  const base = makeTurn()
  const initial = turnResponseBlocks(base, 'a').map(block => block.id)
  expect(turnResponseBlocks(base, 'b').map(block => block.id)).toEqual(initial)
  for (const changed of [
    { ...base, turnId: `${base.turnId}:new` },
    { ...base, conversation: { ...snapshot, conversationId: 'other' } },
    { ...base, conversation: { ...snapshot, draftId: 'other' } },
    { ...base, conversation: { ...snapshot, draftRevision: '99' } },
    { ...base, conversation: { ...snapshot, conversationStateRevision: '99' } },
    makeTurn('UNSUPPORTED'), makeTurn('PATCH_PROPOSED', rejected), makeTurn('PATCH_PROPOSED', null),
  ]) expect(turnResponseBlocks(changed, 'a')[0].id).not.toBe(initial[0])
  expect(new Set(initial).size).toBe(initial.length)
  const ids = [receipt, { ...receipt, validationReceiptId: 'new_receipt' }, { ...receipt, draftRevision: '99' }, invalid].map(value => validationResponseBlocks(value)[0].id)
  expect(new Set(ids).size).toBe(ids.length)
})

test('deep-frozen 입력을 변형하지 않고 결과 변경도 원본에 역전파되지 않는다', () => {
  const turn = freeze(structuredClone(makeTurn()))
  const valid = freeze(structuredClone(receipt))
  const failure = freeze(structuredClone(invalid))
  const before = JSON.stringify([turn, valid, failure])
  const outputs = [turnResponseBlocks(turn, '원문'), validationResponseBlocks(valid), validationResponseBlocks(failure)]
  work(outputs[0]).steps[0].title = '시험 출력 변경'
  expect(JSON.stringify([turn, valid, failure])).toBe(before)
  expect(turnResponseBlocks(turn, '원문')).not.toEqual(outputs[0])
})

test('hash/전체 projection/모델 사고를 기본 상세로 쏟아내지 않는다', () => {
  const output = JSON.stringify([turnResponseBlocks(makeTurn(), ''), validationResponseBlocks(receipt)])
  for (const hash of [snapshot.projectionHash, snapshot.conversationStateHash, source.textSha256]) expect(output).not.toContain(hash)
  expect(output).not.toContain('riskLimits')
  expect(output).not.toContain('Critic')
  expect(output).not.toContain('생각하는 중')
})

test('정적 사전 외 runtime import/Date/타이머/브라우저/네트워크 없이 순수 실행된다', () => {
  const input = readFileSync('src/internal-poc/native-research-observations.ts', 'utf8')
  const compiled = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports: Record<string, unknown> = {}
  const dictionary: Record<string, unknown> = {}
  runInNewContext(ts.transpileModule(readFileSync('src/internal-poc/native-observation-copy.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: dictionary, Date: undefined, require: () => { throw new Error('Dictionary runtime import') } }, { timeout: 100 })
  runInNewContext(compiled, { exports, Date: undefined, require: (path: string) => {
    if (path === './native-observation-copy') return dictionary
    throw new Error(`Runtime import: ${path}`)
  } }, { timeout: 100 })
  const runTurn = exports.turnResponseBlocks as typeof turnResponseBlocks
  const runValidation = exports.validationResponseBlocks as typeof validationResponseBlocks
  expect(JSON.parse(JSON.stringify(runTurn(makeTurn(), '원문')))).toEqual(turnResponseBlocks(makeTurn(), '원문'))
  expect(JSON.parse(JSON.stringify(runValidation(receipt)))).toEqual(validationResponseBlocks(receipt))
})

for (const language of Object.keys(nativeObservationCopy) as ClientLanguage[]) test(`${language}: 모든 상태의 언어 투영은 ID·상태·원문과 원 관측을 보존한다`, () => {
  for (const status of ['PATCH_PROPOSED', 'CLARIFICATION_REQUIRED', 'UNSUPPORTED'] as const) {
    const observation = freeze(captureTurnObservation(makeTurn(status, status === 'PATCH_PROPOSED' ? rejected : null), { text: '  원문 {0} $& <script> 🧪\n  ' }))
    const before = JSON.stringify(observation)
    const blocks = observationResponseBlocks(observation, language)
    const original = observationResponseBlocks(observation, 'ko')
    expect(blocks.map(block => block.id)).toEqual(original.map(block => block.id))
    expect(work(blocks).steps.map(step => [step.id, step.status])).toEqual(work(original).steps.map(step => [step.id, step.status]))
    expect(blocks[1]).toEqual(original[1])
    expect(work(blocks)).not.toHaveProperty('finishedAt')
    if (status === 'PATCH_PROPOSED') {
      expect(work(blocks).steps[0].publicSummary).toContain(evidence)
      expect(work(blocks).steps[1].detail).toContain('/patches/0/value · patchIndex: 0')
      expect(work(blocks).steps[1].detail).toContain('PRECONDITION_FAILED')
    } else expect(work(blocks).steps[0].publicSummary).toBe(work(original).steps[0].publicSummary)
    expect(JSON.stringify(observation)).toBe(before)
    expect(JSON.stringify(blocks)).not.toContain('undefined')
  }
  for (const value of [receipt, invalid]) {
    const observation = freeze(captureValidationObservation(value))
    const blocks = observationResponseBlocks(observation, language)
    expect(blocks[1]).toMatchObject({ text: nativeObservationCopy[language][value.status === 'VALID' ? 'validNote' : 'invalidNote'] })
    const detail = work(blocks).steps[0].detail!
    for (const raw of value.status === 'VALID' ? [value.validationReceiptId, value.issuedAt, value.expiresAt] : value.issues.flatMap(issue => [issue.code, issue.path])) expect(detail).toContain(raw)
  }
  for (const key of ['readyReply', 'draftReply'] as const) expect(observationResponseBlocks(captureTurnObservation(makeTurn(), { key }), language)[1]).toMatchObject({ text: nativeObservationCopy[language][key] })
  const koKeys = Object.keys(nativeObservationCopy.ko).sort()
  expect(Object.keys(nativeObservationCopy[language]).sort()).toEqual(koKeys)
  for (const key of koKeys as (keyof typeof nativeObservationCopy.ko)[]) {
    expect(nativeObservationCopy[language][key].match(/\{\d+\}/g) ?? []).toEqual(nativeObservationCopy.ko[key].match(/\{\d+\}/g) ?? [])
  }
})

test('관측 스냅샷은 원 response의 후속 변형·전체 AST·번역된 문장 사본을 보관하지 않는다', () => {
  const turn = structuredClone(makeTurn())
  const observation = captureTurnObservation(turn, { text: '서버 원문' })
  const before = JSON.stringify(observation)
  turn.conversation.draftRevision = '999'
  turn.mergeResult!.issues.push({ code: 'LATER', instancePath: '/later' })
  expect(JSON.stringify(observation)).toBe(before)
  expect(before).not.toContain('riskLimits')
  expect(before).not.toContain(snapshot.projectionHash)
  expect(before).not.toContain(nativeObservationCopy.en.validNote)
})
