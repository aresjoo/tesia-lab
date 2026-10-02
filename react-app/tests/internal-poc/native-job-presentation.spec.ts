import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { expect, test } from '@playwright/test'
import fixture from './fixtures/native-service-contracts.json' with { type: 'json' }
import { describeNativeJob } from '../../src/internal-poc/native-job-presentation'
import { nativeJobCopy, nativeJobText } from '../../src/internal-poc/native-job-copy'
import type { ApiV070NativeJobNativeJob } from '../../src/internal-poc/contracts/generated/api-v0.7/types'

// Recorded contract snapshots only; no worker, provider, API or server authority.
const jobs = fixture.sources[3].fixture.cases!.map(row => row.response.data) as ApiV070NativeJobNativeJob[]
const expected = [
  ['QUEUED', '백테스트 대기 중', 'running'], ['PREPARING_DATA', '데이터 준비 중', 'running'],
  ['VALIDATING', '백테스트 입력 검증 중', 'running'], ['REPLAYING', '전략 재생 중', 'running'],
  ['VERIFYING', '결과 검증 중', 'running'], ['TERMINAL_READY', '결과 게시 대기', 'running'],
  ['COMPLETED', '백테스트 완료', 'done'], ['FAILED', '백테스트 처리 실패', 'failed'], ['INVALID', '백테스트 결과 무효', 'failed'],
] as const
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

for (const [state, label, status] of expected) {
  test(`${state}: 현재 서버 상태만 ${label}로 표시한다`, () => {
    const job = freeze(structuredClone(jobs.find(value => value.state === state)!))
    const before = JSON.stringify(job)
    const result = describeNativeJob(job)
    expect(result).toMatchObject({ label, status })
    expect(result.description.length).toBeGreaterThan(0)
    if (state !== 'INVALID') expect(result).not.toHaveProperty('invalidReason')
    expect(Object.keys(result).sort()).toEqual(state === 'INVALID' ? ['description', 'invalidReason', 'label', 'status'] : ['description', 'label', 'status'])
    expect(JSON.stringify(job)).toBe(before)
    expect(JSON.stringify(result)).not.toMatch(/%|[0-9]+초|[0-9]+봉|Critic|매수|주문 완료/)
  })
}

for (const [code, label] of [
  ['DATA_CONTRACT_INVALID', '데이터 확인 필요'], ['STRATEGY_CONTRACT_INVALID', '전략 조건 확인 필요'],
  ['ASSUMPTION_CONTRACT_INVALID', '백테스트 가정 확인 필요'], ['RUNTIME_RESULT_INVALID', '실행 결과 확인 필요'], ['VERIFICATION_FAILED', '결과 검증 실패'],
] as const) {
  test(`INVALID ${code}: 원코드와 분류만 표시한다`, () => {
    const original = jobs.find(value => value.state === 'INVALID')!
    const job: ApiV070NativeJobNativeJob = { ...original, state: 'INVALID', resultAvailable: false, invalidReason: code }
    const before = JSON.stringify(job)
    expect(describeNativeJob(freeze(job)).invalidReason).toEqual({ code, label })
    expect(JSON.stringify(job)).toBe(before)
  })
}

test('VALIDATING은 시장 데이터만 검사한다고 좁히지 않는다', () => {
  const result = describeNativeJob(jobs.find(job => job.state === 'VALIDATING')!)
  expect(result.label).toBe('백테스트 입력 검증 중')
  expect(result.description).toBe('서버가 백테스트 실행 전 검증 상태를 반환했습니다.')
})

test('TERMINAL_READY는 결과 사용 가능/완료로 승격하지 않는다', () => {
  const result = describeNativeJob(jobs.find(job => job.state === 'TERMINAL_READY')!)
  expect(result.status).toBe('running')
  expect(result.description).toBe('서버가 결과 게시 대기 상태를 반환했습니다. 아직 결과를 조회할 수 없습니다.')
  expect(result.label).not.toContain('완료')
})

test('COMPLETED는 보고서/차트 로딩 성공이나 실거래 성공이 아니다', () => {
  const result = describeNativeJob(jobs.find(job => job.state === 'COMPLETED')!)
  expect(result.description).toContain('보고서와 차트의 조회 상태는 별도로 확인합니다.')
  expect(result.description).not.toMatch(/실거래|실행 성공|차트 준비됨/)
})

test('FAILED는 구체적인 사유를 만들지 않는다', () => {
  const result = describeNativeJob(jobs.find(job => job.state === 'FAILED')!)
  expect(result.description).toContain('구체적인 실패 사유가 제공되지 않습니다.')
  expect(result).not.toHaveProperty('invalidReason')
  expect(result.description).not.toMatch(/데이터 누락|권한 부족|네트워크|시간 초과/)
})

test('생성/갱신시각과 revision 변화로 phase·소요시간을 추정하지 않는다', () => {
  for (const job of jobs) {
    const changed = { ...job, revision: '18446744073709551615', createdAt: '1900-01-01T00:00:00Z', updatedAt: '9999-12-31T23:59:59Z' }
    expect(describeNativeJob(changed)).toEqual(describeNativeJob(job))
  }
})

test('뒤늦은 이전상태 입력도 역사·누적 단계 없이 해당 snapshot만 반환한다', () => {
  const queued = jobs.find(job => job.state === 'QUEUED')!
  const initial = describeNativeJob(queued)
  for (const job of [...jobs].reverse()) describeNativeJob(job)
  expect(describeNativeJob(queued)).toEqual(initial)
})

test('원 binding JSON을 변형하지 않고 반환값 변경도 다음 결과에 남지 않는다', () => {
  for (const original of jobs) {
    const job = freeze(structuredClone(original))
    const before = JSON.stringify(job)
    const result = describeNativeJob(job)
    result.label = '별도 표시'
    if (result.invalidReason) result.invalidReason.code = 'NOT_AUTHORITY'
    expect(JSON.stringify(job)).toBe(before)
    expect(describeNativeJob(job)).not.toEqual(result)
    expect(JSON.stringify(describeNativeJob(job))).not.toContain('NOT_AUTHORITY')
  }
})

test('정적 문구 외 runtime import/Date/타이머/브라우저 없이 순수 실행된다', () => {
  const source = readFileSync('src/internal-poc/native-job-presentation.ts', 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports: Record<string, unknown> = {}
  const copySource = readFileSync('src/internal-poc/native-job-copy.ts', 'utf8')
  const copyCompiled = ts.transpileModule(copySource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const copyExports: Record<string, unknown> = {}
  const forbidden = () => { throw new Error('Unexpected runtime dependency') }
  runInNewContext(copyCompiled, { exports: copyExports, Date: undefined, require: forbidden }, { timeout: 100 })
  runInNewContext(compiled, { exports, Date: undefined, require: (name: string) => name === './native-job-copy' ? copyExports : forbidden() }, { timeout: 100 })
  for (const job of jobs) expect(JSON.parse(JSON.stringify((exports.describeNativeJob as typeof describeNativeJob)(job)))).toEqual(describeNativeJob(job))
})

test('7언어 정적 문구는 빠짐없으며 placeholder와 원서버 상태 의미를 유지한다', () => {
  for (const row of Object.values(nativeJobCopy)) {
    expect(row).toHaveLength(7)
    const placeholders = row[0].match(/\{[a-z]+\}/g) ?? []
    for (const value of row) {
      expect(value.trim().length).toBeGreaterThan(0)
      expect(value.match(/\{[a-z]+\}/g) ?? []).toEqual(placeholders)
    }
  }
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    expect(nativeJobText(language, 'completedLabel')).toBe({ ko: '백테스트 완료', en: 'Backtest completed', ja: 'バックテスト完了', 'zh-CN': '回测完成', 'zh-TW': '回測完成', es: 'Backtest completado', fr: 'Backtest terminé' }[language])
    expect(nativeJobText(language, 'truncatedObservationsNotice', { count: 16 })).toContain('16')
    expect(nativeJobText(language, 'truncatedObservationsNotice', { count: 16 })).not.toContain('32')
    for (const job of jobs) {
      const before = JSON.stringify(job), result = describeNativeJob(job, language)
      expect(result.status).toBe(describeNativeJob(job).status)
      if (language !== 'ko') expect(result.label).not.toMatch(/[가-힣]/)
      if (job.state === 'INVALID') expect(result.invalidReason?.code).toBe(job.invalidReason)
      expect(JSON.stringify(job)).toBe(before)
    }
    const raw = '$&{count}<img>18446744073709551615'
    expect(nativeJobText(language, 'historyApprovedDraftTitle', { revision: raw })).toContain(raw)
  }
  expect(describeNativeJob(jobs.find(job => job.state === 'TERMINAL_READY')!, 'en').description).toContain('cannot be retrieved yet')
  expect(describeNativeJob(jobs.find(job => job.state === 'COMPLETED')!, 'en').description).toContain('checked separately')
  expect(describeNativeJob(jobs.find(job => job.state === 'FAILED')!, 'en').description).toContain('does not provide a specific failure reason')
})
