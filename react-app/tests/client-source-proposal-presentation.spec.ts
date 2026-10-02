import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { sourceTerminalSeeds } from '../src/client-terminal-source-fixture'
import { createSourceTerminalDiscussion, createSourceTerminalProposal, type SourceDiscussionDisplay } from '../src/client-terminal-source-proposal'
import { projectSourceDiscussion } from '../src/client-source-proposal-presentation'
import { sourceAgentPresets, sourceProposalCopy, sourceProposalText } from '../src/client-source-proposal-copy'

const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const

test('표시 projection은 파서·계산기·브라우저 상태를 런타임에 가져오지 않는다', () => {
  const source = readFileSync(new URL('../src/client-source-proposal-presentation.ts', import.meta.url), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
  const compiled = ts.createSourceFile('presentation.js', output, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const imports = compiled.statements.filter(ts.isImportDeclaration).map(node => (node.moduleSpecifier as ts.StringLiteral).text)
  expect(imports.sort()).toEqual(['./client-shared-number-format', './client-source-proposal-copy', './client-source-question-view'])
  const dynamicLoads: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) dynamicLoads.push(node.getText(compiled))
    ts.forEachChild(node, visit)
  }
  visit(compiled)
  expect(dynamicLoads).toEqual([])
})

test('영문 미지원 설명은 원문 명령 의미와 문장 사이 공백을 보존한다', () => {
  expect(projectSourceDiscussion({ kind: 'unsupported', fields: ['unsupportedLeverage'] }, 'en')).toEqual({
    kind: 'answer', title: "This request isn't supported for automatic conversion yet",
    text: "Supported: stop-loss (%), take-profit (%), entry RSI threshold, trend filter on/off, lower/raise risk. The Leverage you requested is not supported by the rule engine yet, so it can't be applied.",
  })
  expect(projectSourceDiscussion({ kind: 'unsupported', fields: [] }, 'en')).toMatchObject({
    text: 'Supported: stop-loss (%), take-profit (%), entry RSI threshold, trend filter on/off, lower/raise risk.',
  })
})

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

test('55개 source 표시 문구는7언어·토큰·원문 명령과 own-property 경계를 지킨다', () => {
  expect(Object.keys(sourceProposalCopy)).toHaveLength(55)
  expect(sourceAgentPresets.map(preset => preset.request)).toEqual(['왜 아직 진입 안 했어?', '지금 가장 큰 리스크는?', '다음 진입 조건은?', '리스크 낮춰줘'])
  expect(sourceAgentPresets.map(preset => sourceProposalText('ko', preset.key))).toEqual(['아직 진입하지 않은 이유', '가장 큰 위험', '다음 진입 조건', '위험 낮추기'])
  for (const row of Object.values(sourceProposalCopy)) {
    expect(row).toHaveLength(7)
    for (const value of row) expect((value.match(/\{\w+\}/g) ?? []).sort()).toEqual((row[0].match(/\{\w+\}/g) ?? []).sort())
  }
  for (const language of languages) {
    expect(sourceProposalText(language, 'stopText')).toContain('손절 -3%로 바꿔줘')
    expect(sourceProposalText(language, 'inputPlaceholder')).toContain('손절을 -3%로 바꿔 주십시오')
    expect(sourceProposalText(language, 'recentText', Object.create({ last: 'INHERITED' }))).toContain('{last}')
    expect(sourceProposalText(language, 'recentText', { last: '<script>{stop}</script>$&' })).toContain('<script>{stop}</script>$&')
  }
})

test('6개 원본 전략의 응답 필드/수치/한국어는 표시 분리 뒤에도 그대로다', () => {
  const requests = ['', '손절 기준 설명', '이번 판단 다시 분석', '리스크 낮춰줘', '리스크 높여줘', '손절 -4% 익절 11% RSI 43 추세 필터 끄기', '익절 15% RSI 44 추세 필터 켜기', '손절 -5% 그대로 레버리지 3배', '손절 -3% EMA20 부분 청산 레버리지 시간대', `RSI ${'9'.repeat(400)}`, 'a'.repeat(4001)]
  for (const seed of sourceTerminalSeeds) for (const request of requests) {
    const frozen = freeze(structuredClone(seed))
    const discussion = freeze(createSourceTerminalDiscussion(frozen, request))
    const before = JSON.stringify(discussion)
    expect(discussion.response).toEqual(createSourceTerminalProposal(frozen, request))
    const ko = projectSourceDiscussion(discussion.display, 'ko')
    if (discussion.response.kind === 'proposal') {
      expect(ko.kind).toBe('proposal')
      if (ko.kind !== 'proposal') throw new Error('Wrong display kind')
      expect({ rows: ko.rows, notes: ko.notes, unsupported: ko.unsupported }).toEqual({ rows: discussion.response.proposal.rows, notes: discussion.response.proposal.notes, unsupported: discussion.response.proposal.unsupported })
      expect(Object.keys(discussion.response.proposal).sort()).toEqual(['strategyId', 'baseVersion', 'baseFingerprint', 'request', 'parameters', 'rows', 'notes', 'unsupported', 'before', 'after', 'score', 'passes'].sort())
    } else {
      expect(ko).toEqual({ kind: 'answer', title: discussion.response.title, text: discussion.response.text })
      expect(Object.keys(discussion.response).sort()).toEqual(['kind', 'title', 'text', 'followup'].sort())
    }
    for (const language of languages) {
      const view = projectSourceDiscussion(discussion.display, language)
      if (view.kind === 'proposal' && discussion.response.kind === 'proposal') {
        expect(view.rows).toHaveLength(discussion.response.proposal.rows.length)
        expect(view.notes).toHaveLength(discussion.response.proposal.notes.length)
        expect(view.unsupported).toHaveLength(discussion.response.proposal.unsupported.length)
      }
    }
    expect(JSON.stringify(discussion)).toBe(before)
  }
})

test('note만 있는 동일값 분기와 base 시점 표시값은 현재 seed 변경과 분리된다', () => {
  const seed = structuredClone(sourceTerminalSeeds[0])
  seed.parameters.sl = -3; seed.parameters.trendFilter = true
  const same = createSourceTerminalDiscussion(seed, '리스크 낮춰줘')
  expect(same.response.kind).toBe('unchanged')
  expect(same.display).toEqual({ kind: 'snappedUnchanged', notes: [{ kind: 'stopTight', value: -3 }] })
  seed.parameters.trendFilter = false
  const withFilter = createSourceTerminalDiscussion(seed, '리스크 낮춰줘')
  expect(withFilter.response.kind).toBe('proposal')
  expect(withFilter.display).toMatchObject({ kind: 'proposal', notes: [{ kind: 'stopTight', value: -3 }, { kind: 'riskTrend' }] })
  const snapshot = JSON.stringify(withFilter)
  seed.parameters.sl = -12; seed.parameters.rsiTh = 46
  expect(JSON.stringify(withFilter)).toBe(snapshot)
  const view = projectSourceDiscussion(withFilter.display, 'en')
  if (view.kind !== 'proposal') throw new Error('Missing proposal')
  expect(view.rows).toEqual([{ label: sourceProposalText('en', 'rowTrend'), current: sourceProposalText('en', 'disabled'), proposed: sourceProposalText('en', 'enabled'), delta: sourceProposalText('en', 'added') }])
})

test('표시 descriptor만으로 소수점·증감·없음·추가를 표현하고 설명의 마지막 판단은 원문이다', () => {
  const display: SourceDiscussionDisplay = freeze({ kind: 'proposal', rows: [
    { field: 'sl', current: -5.5, proposed: -3 }, { field: 'tp', current: null, proposed: 12 },
    { field: 'tp', current: 15, proposed: 8 }, { field: 'rsiTh', current: 46, proposed: 38 },
    { field: 'trendFilter', current: true, proposed: false },
  ], notes: [{ kind: 'stopSnap', from: -2.5, to: -3 }], unsupported: ['unsupportedEma', 'unsupportedLeverage'] })
  const fr = projectSourceDiscussion(display, 'fr')
  if (fr.kind !== 'proposal') throw new Error('Missing proposal')
  expect(fr.rows.map(row => [row.current, row.proposed, row.delta])).toEqual([
    ['-5,5%', '-3%', '▲ 2,5%p'], [sourceProposalText('fr', 'none'), '+12%', sourceProposalText('fr', 'new')],
    ['+15%', '+8%', '▼ -7%p'], ['46', '38', '▼ -8'],
    [sourceProposalText('fr', 'enabled'), sourceProposalText('fr', 'disabled'), sourceProposalText('fr', 'removed')],
  ])
  expect(fr.notes).toEqual([sourceProposalText('fr', 'stopSnap', { from: '-2,5', to: '-3' })])
  for (const language of languages) for (const target of [null, 8]) {
    const last = '<script>원문 {stop} $&</script>'
    const view = projectSourceDiscussion({ kind: 'recent', last, rsi: 40, stop: -5, target, ret: 12.5, mdd: -8.1, winRate: 61 }, language)
    if (view.kind !== 'answer') throw new Error('Missing answer')
    expect(view.text).toContain(last)
    if (target !== null) expect(view.text).toContain(sourceProposalText(language, 'targetClause', { target: '8' }))
  }
  expect(projectSourceDiscussion({ kind: 'recent', last: null, rsi: 40, stop: -5, target: null, ret: 0, mdd: 0, winRate: 0 }, 'ko')).toMatchObject({ text: expect.stringContaining('마지막 평가: 기록 없음.') })
})
