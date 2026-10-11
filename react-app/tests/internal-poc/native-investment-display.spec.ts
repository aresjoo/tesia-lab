import { expect, test } from '@playwright/test'
import {
  nativeInvestmentQuestionUserText,
  projectNativeInvestmentDisplay,
} from '../../src/internal-poc/native-investment-display'

const scopeId = JSON.stringify(['session_display_owner_01', 'ANONYMOUS'])
const messageId = 'turn_display_synthetic_01_reply'
const ask = {
  steps: [{
    title: 'Which risk limit? 🤔', multi: false,
    options: [
      { t: '계좌의 2%', d: 'Account equity 기준 📉' },
      { t: '진입가의 2%', d: 'Entry price 기준' },
    ],
  }],
}

test('cumulative Unicode answer holds every split display suffix and emits ASK only after COMPLETED', () => {
  const body = `${'가'.repeat(4_096)}\n설명 ✅`
  const tag = `[ASK ${JSON.stringify(ask)}]`
  const title = '[TITLE "Risk 기준 📌"]'
  const raw = `${body}\n${tag}\n${title}`
  const splitPoints = [body.length + 2, raw.indexOf('{') + 17, raw.indexOf('Account') + 3, raw.length - 1]
  for (const end of splitPoints) {
    const projection = projectNativeInvestmentDisplay({ text: raw.slice(0, end), state: 'STREAMING', scopeId, messageId, allowTitle: true })
    expect(projection.blocks.filter(block => block.kind !== 'text')).toEqual([])
    expect(projection.text).not.toMatch(/\[(?:ASK|TITLE)/)
    expect(projection.titleSuggestion).toBeNull()
  }

  const completed = projectNativeInvestmentDisplay({ text: raw, state: 'COMPLETED', scopeId, messageId, allowTitle: true })
  expect(completed.valid).toBe(true)
  expect(completed.text).toBe(body)
  expect(completed.titleSuggestion).toEqual({ messageId, value: 'Risk 기준 📌' })
  expect(completed.blocks).toEqual([
    { id: `${messageId}_text`, kind: 'text', text: body, status: 'done' },
    { id: `${messageId}:display:ASK:0`, kind: 'market-question', presentation: {
      binding: { scopeId, messageId, observationId: `${messageId}:display:ASK:0` },
      steps: [{ id: `${messageId}:display:ASK:0:step:0`, title: ask.steps[0].title, multi: false, options: [
        { id: `${messageId}:display:ASK:0:option:0`, label: ask.steps[0].options[0].t, description: ask.steps[0].options[0].d },
        { id: `${messageId}:display:ASK:0:option:1`, label: ask.steps[0].options[1].t, description: ask.steps[0].options[1].d },
      ] }],
    } },
  ])
})

test('NEXT is display-only with deterministic ids while CHART has no synthetic series state', () => {
  const next = '[NEXT ["왜 그런가요? 🤔","What changes next?"]]'
  const chart = '[CHART {"tv":"BINANCE:BTCUSDT","data":"binance:BTCUSDT","label":"비트코인"}]'
  const projection = projectNativeInvestmentDisplay({ text: `본문\n${chart}\n${next}`, state: 'COMPLETED', scopeId, messageId, allowTitle: true })
  expect(projection.valid).toBe(true)
  expect(projection.blocks).toEqual([
    { id: `${messageId}_text`, kind: 'text', text: '본문', status: 'done' },
    { id: `${messageId}:display:NEXT:0`, kind: 'followups', presentation: {
      binding: { scopeId, messageId, observationId: `${messageId}:display:NEXT:0` },
      actions: [], showFreeBadge: false,
      questions: [
        { id: `${messageId}:display:NEXT:0:question:0`, label: '왜 그런가요? 🤔', text: '왜 그런가요? 🤔' },
        { id: `${messageId}:display:NEXT:0:question:1`, label: 'What changes next?', text: 'What changes next?' },
      ],
    } },
  ])
  expect(projection.blocks.some(block => block.kind === 'market-chart')).toBe(false)
})

test('non-completed terminals never produce display blocks and never expose tag suffixes', () => {
  for (const state of ['FAILED', 'CANCELLED', 'AMBIGUOUS'] as const) {
    const projection = projectNativeInvestmentDisplay({ text: `부분 답변\n[NEXT ["계속할까요?"]]`, state, scopeId, messageId, allowTitle: true })
    expect(projection.blocks).toEqual([{ id: `${messageId}_text`, kind: 'text', text: '부분 답변', status: 'interrupted' }])
    expect(projection.titleSuggestion).toBeNull()
  }
})

test('malformed, duplicate, ASK plus NEXT, and later TITLE fail closed without partial cards', () => {
  const values = [
    `[ASK ${JSON.stringify(ask)}][ASK ${JSON.stringify(ask)}]`,
    `[ASK ${JSON.stringify(ask)}][NEXT ["후속 질문"]]`,
    '[ASK {"steps":',
    '[TITLE "첫 답변이 아닌 제목"]',
  ]
  values.forEach((text, index) => {
    const projection = projectNativeInvestmentDisplay({ text: `안전 본문 ${index}\n${text}`, state: 'COMPLETED', scopeId, messageId, allowTitle: index !== 3 })
    expect(projection.valid).toBe(false)
    expect(projection.blocks.filter(block => block.kind !== 'text')).toEqual([])
    expect(projection.text).toBe(`안전 본문 ${index}`)
    expect(projection.titleSuggestion).toBeNull()
  })
})

test('ordinary Markdown labels that resemble display names remain complete prose', () => {
  const text = '검토할 [Next steps](https://example.test/next)와 [Title] 안내를 그대로 보여줘.'
  const projection = projectNativeInvestmentDisplay({ text, state: 'COMPLETED', scopeId, messageId, allowTitle: true })
  expect(projection).toEqual({
    text,
    blocks: [{ id: `${messageId}_text`, kind: 'text', text, status: 'done' }],
    titleSuggestion: null,
    valid: true,
  })
})

test('ASK selections preserve original title, option descriptions and plain user-text semantics', () => {
  const projection = projectNativeInvestmentDisplay({ text: `[ASK ${JSON.stringify(ask)}]`, state: 'COMPLETED', scopeId, messageId, allowTitle: true })
  const block = projection.blocks.find(item => item.kind === 'market-question')
  if (!block || block.kind !== 'market-question') throw new Error('missing question block')
  const step = block.presentation.steps[0]
  expect(nativeInvestmentQuestionUserText(block.presentation, {
    binding: block.presentation.binding, mode: 'selection',
    rows: [{ stepId: step.id, title: 'ignored', optionIds: [step.options[0].id], labels: ['ignored'] }], text: 'localized text must not be sent',
  })).toBe('Which risk limit: 계좌의 2% (Account equity 기준 📉) 기준으로 진행해줘')
  expect(nativeInvestmentQuestionUserText(block.presentation, {
    binding: block.presentation.binding, mode: 'selection',
    rows: [{ stepId: step.id, title: 'ignored', optionIds: [], labels: ['ignored'], directText: '직접 답변 🚀' }], text: 'ignored',
  })).toBe('Which risk limit: 직접 답변 🚀 기준으로 진행해줘')
  expect(nativeInvestmentQuestionUserText(block.presentation, {
    binding: block.presentation.binding, mode: 'delegate', rows: [], text: 'ignored',
  })).toBe('지금은 이 질문을 건너뛰겠습니다. 확인된 정보로 설명 가능한 부분만 이어서 알려주세요. 미확인 조건을 임의로 정하거나 실행하지 마세요.')
})
