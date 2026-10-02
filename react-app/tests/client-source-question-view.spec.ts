import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { evaluateSourceTerminal, sourceTerminalPrices, sourceTerminalRsi, sourceTerminalSeeds, sourceTerminalSma } from '../src/client-terminal-source-fixture'
import { createSourceTerminalDiscussion } from '../src/client-terminal-source-proposal'
import { projectSourceQuestion, sourceQuestionCopy, sourceQuestionText, type SourceQuestionView } from '../src/client-source-question-view'

test('질문 표시 모듈은 계산기나 브라우저를 가져오지 않고 모든 언어의 토큰을 보존한다', () => {
  const source = readFileSync(new URL('../src/client-source-question-view.ts', import.meta.url), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
  const ast = ts.createSourceFile('view.js', output, ts.ScriptTarget.Latest, true)
  expect(ast.statements.filter(ts.isImportDeclaration).map(n => (n.moduleSpecifier as ts.StringLiteral).text)).toEqual(['./client-shared-number-format'])
  expect(output).not.toMatch(/\b(window|document|localStorage|fetch|evaluateSourceTerminal)\b/)
  for (const row of Object.values(sourceQuestionCopy)) {
    expect(row).toHaveLength(7)
    for (const text of row) expect((text.match(/\{\w+\}/g) ?? []).sort()).toEqual((row[0].match(/\{\w+\}/g) ?? []).sort())
  }
  expect(sourceQuestionText('ko', 'budget', Object.create({ value: 'INHERITED' }))).toBe('예산 {value}')
})

test('원본6전략의 질문3종은 검증 마지막 봉의 실제 계산값을 표시하고 전략을 변경하지 않는다', () => {
  for (const original of sourceTerminalSeeds) for (const request of ['왜 아직 진입 안 했어?', '지금 가장 큰 리스크는?', '다음 진입 조건은?']) {
    const seed = structuredClone(original), before = JSON.stringify(seed)
    const result = evaluateSourceTerminal(seed.parameters, seed.capital), p = result.r.params
    const discussion = createSourceTerminalDiscussion(seed, request)
    expect(discussion.response.kind).toBe('explanation')
    if (discussion.display.kind !== 'question') throw new Error('Missing question snapshot')
    const view = discussion.display.view, end = p.endI
    expect(view).toMatchObject({ rsi: sourceTerminalRsi(end - 1), threshold: p.rsiTh,
      rebound: (sourceTerminalPrices[end] / sourceTerminalPrices[end - 1] - 1) * 100,
      gap: Math.abs(sourceTerminalSma(end, 20)! - sourceTerminalSma(end, 60)!) / sourceTerminalPrices[end] * 100,
      trend: p.trendFilter, stop: p.sl, target: p.tp, mdd: result.r.mdd,
      worstTrade: Math.min(0, ...result.trades.map(t => t.pnl * 100)),
      position: result.pos ? { change: result.pos.chg * 100, distanceToStop: (result.pos.curP / result.pos.stopP - 1) * 100 } : null,
    })
    expect(JSON.stringify(seed)).toBe(before)
    const snapshot = JSON.stringify(view)
    Object.freeze(view)
    for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
      const answer = projectSourceQuestion(view, language)
      expect(answer.text).toContain(sourceQuestionText(language, 'scope'))
      expect(answer.text).not.toMatch(/NaN|Infinity|undefined/)
    }
    expect(JSON.stringify(view)).toBe(snapshot)
    seed.status = seed.status === 'off' ? 'live' : 'off'
    expect(createSourceTerminalDiscussion(seed, request).display).toEqual(discussion.display)
  }
})

test('경계값은 엄격한 미만·초과로 구분하고 결측은 미확인, 보유 설명은 진입 지시가 아니다', () => {
  const view: SourceQuestionView = { question: 'nextEntry', rsi: 40, threshold: 40, rebound: .5, gap: 3, trend: true, position: null, stop: -5, target: null, mdd: -10, worstTrade: -5 }
  expect(projectSourceQuestion(view, 'ko').text.match(/미충족/g)).toHaveLength(3)
  expect(projectSourceQuestion({ ...view, gap: null }, 'ko').text).toContain('미확인')
  expect(projectSourceQuestion({ ...view, trend: false }, 'ko').text).not.toContain('60일')
  expect(projectSourceQuestion({ ...view, question: 'whyEntry', position: { change: 1, distanceToStop: 6 } }, 'ko').text).toContain('새 진입 대신 청산 조건')
  expect(projectSourceQuestion({ ...view, question: 'largestRisk' }, 'ko').text).toContain('보장하지는 않습니다')
  for (const [alias, canonical] of [['아직 진입하지 않은 이유', '왜 아직 진입 안 했어?'], ['가장 큰 위험', '지금 가장 큰 리스크는?'], ['다음 진입 조건', '다음 진입 조건은?'], ['위험 낮추기', '리스크 낮춰줘'], ['더 보수적으로 바꿔줘', '리스크 낮춰줘']]) {
    expect(createSourceTerminalDiscussion(sourceTerminalSeeds[0], alias).display).toEqual(createSourceTerminalDiscussion(sourceTerminalSeeds[0], canonical).display)
  }
})
