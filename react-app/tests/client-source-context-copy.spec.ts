import { expect, test } from '@playwright/test'
import { sourceContextCopy, sourceContextText } from '../src/client-source-context-copy'
import { initialSourceTerminalState, setSourceTerminalStatus, SourceTerminalStatusError, type SourceStatusFailure } from '../src/client-terminal-source-state'

const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
test('출처와 상태16문구는7언어·토큰·80점·own-property 경계를 유지한다', () => {
  expect(Object.keys(sourceContextCopy)).toHaveLength(16)
  for (const values of Object.values(sourceContextCopy)) {
    expect(values).toHaveLength(7)
    for (const value of values) expect((value.match(/\{\w+\}/g) ?? []).sort()).toEqual((values[0].match(/\{\w+\}/g) ?? []).sort())
  }
  for (const language of languages) {
    expect(sourceContextText(language, 'belowThreshold', { score: '68' })).toContain('68')
    expect(sourceContextText(language, 'belowThreshold')).toContain('80')
    expect(sourceContextText(language, 'belowThreshold', Object.create({ score: 'INHERITED' }))).toContain('{score}')
    expect(sourceContextText(language, 'belowThreshold', { score: '<script>{score}</script>$&' })).toContain('<script>{score}</script>$&')
  }
})

test('상태 실패 detail은 기존 한국어 Error.message와 같은 근거이며 상태를 바꾸지 않는다', () => {
  const state = initialSourceTerminalState(), before = structuredClone(state)
  for (const [id, detail] of [['missing', { kind: 'notFound' }], ['demo:d6', { kind: 'connectionRequired' }], ['demo:d2', { kind: 'belowThreshold', score: 68 }]] as const satisfies readonly (readonly [string, SourceStatusFailure])[]) {
    let failure: unknown
    try { setSourceTerminalStatus(state, id, 'live', { id: 'op', timeLabel: '12:00', label: '실행', text: '실행' }) } catch (error) { failure = error }
    expect(failure).toBeInstanceOf(SourceTerminalStatusError)
    expect(failure).toBeInstanceOf(Error)
    const error = failure as SourceTerminalStatusError
    expect(error.detail).toEqual(detail)
    expect(error.message).toBe(sourceContextText('ko', detail.kind, detail.kind === 'belowThreshold' ? { score: String(detail.score) } : undefined))
    expect(state).toEqual(before)
  }
})
