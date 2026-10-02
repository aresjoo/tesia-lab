/** Source index.html:23991–24002, local display direction before a proposal.
 * Never a Strategy Version, model recommendation, approval, or service job. */
import type { ClientSession, ClientTurn } from './client-experience-store'
import { commonAmounts, commonPeriods, commonBacktestInput, commonPreviewProgress, commonPreviewResult, readCommonBacktest, type CommonBacktestPreview } from './client-common-backtest-preview'
import { COMMON_PREVIEW_REVISION, exampleCommonProposal, onePreviewChange, samePreviewInput } from './client-common-revision'
import { decodeInlineInput, type InlineBacktestInput } from './client-inline-backtest'
import { commonSelectionVisible } from './client-response-strategy'
import type { ClientLanguage } from './client-preferences'

export type CommonRevisionDirection = Readonly<{ owner: string | null; base: CommonBacktestPreview; before: InlineBacktestInput; dataRevision: string }>
export type CommonRevisionDirectionChange = 'sl' | 'tp' | 'rsiTh' | 'trendFilter'
export type CommonRevisionDirectionReply = Readonly<{ proposal: InlineBacktestInput; change: CommonRevisionDirectionChange; description: string }>
const plain = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value)) && Object.values(Object.getOwnPropertyDescriptors(value)).every(property => 'value' in property)
const known = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => plain(value) && Object.keys(value).every(key => keys.includes(key))
const ownerValid = (value: unknown): value is string | null => value === null || typeof value === 'string' && value.trim().length > 0 && value.length <= 512
const safeInput = (value: unknown): InlineBacktestInput | undefined => {
  if (!known(value, ['parameters', 'pair', 'timeframe', 'requestedRsi']) || typeof value.pair !== 'string' || typeof value.timeframe !== 'string'
    || !known(value.parameters, ['sl', 'tp', 'rsiTh', 'trendFilter', 'startI', 'endI'])) return
  return decodeInlineInput(value)
}
function freezeDirection(value: CommonRevisionDirection): CommonRevisionDirection {
  return Object.freeze({ ...value, base: Object.freeze({ ...value.base }), before: value.before })
}
export function readCommonRevisionDirection(value: unknown, priorTurns: ClientTurn[]): CommonRevisionDirection | undefined {
  if (!known(value, ['owner', 'base', 'before', 'dataRevision']) || !ownerValid(value.owner) || value.dataRevision !== COMMON_PREVIEW_REVISION
    || !known(value.base, ['turnId', 'period', 'amount', 'startedAt', 'skipped'])) return
  const base = readCommonBacktest(value.base, priorTurns), before = safeInput(value.before)
  const turn = base && priorTurns.find(turn => turn.id === base.turnId), original = safeInput(turn?.inlineRequest)
  const parent = turn?.commonRevisionOf && priorTurns.find(item => item.id === turn.commonRevisionOf)
  if (!base || !before || !original || !samePreviewInput(before, original) || commonPreviewProgress(base, Date.now()) < 1
    || turn?.responseSequence && turn.responseSequence.owner !== value.owner
    || turn?.commonResultContext && turn.commonResultContext.owner !== value.owner
    || turn?.commonRevisionOf && (!parent || parent.commonRevision?.owner !== value.owner)) return
  return freezeDirection({ owner: value.owner, base, before, dataRevision: COMMON_PREVIEW_REVISION })
}
export function createCommonRevisionDirection(session: ClientSession, expected: CommonBacktestPreview, owner: string | null): CommonRevisionDirection | undefined {
  const current = commonBacktestInput(session)
  if (!current || session.sharedCopy || !commonSelectionVisible(session, owner) || !ownerValid(owner)
    || JSON.stringify(current.state) !== JSON.stringify(expected) || commonPreviewProgress(current.state, Date.now()) < 1) return
  const before = safeInput(session.turns.find(turn => turn.id === expected.turnId)?.inlineRequest)
  return before && readCommonRevisionDirection({ owner, base: current.state, before, dataRevision: COMMON_PREVIEW_REVISION }, session.turns)
}

const labels = { loosen: '파는 조건 넓히기', strict: '사는 조건 까다롭게', add: '오르면 파는 조건 추가', stop: '내리면 파는 조건 넓히기', trendOn: '방향 확인 켜기', trendOff: '방향 확인 끄기', example: 'Mock 예시로 비교하기' } as const
export function commonRevisionDirectionQuestion(direction: CommonRevisionDirection, language: ClientLanguage = 'ko') {
  const { before, base } = direction, p = before.parameters
  const startI = base.period ? Math.max(p.startI, p.endI - base.period + 1) : p.startI
  const result = commonPreviewResult({ state: base, input: { ...before, parameters: { ...p, startI } } })
  const drawdown = new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(Math.abs(result.evaluation.r.mdd))
  const evidence = `이 결과에서 가장 크게 내려간 폭은 ${drawdown}%입니다.`
  const options = [
    { label: labels.loosen, value: labels.loosen, description: `${drawdown}% 내려간 결과에서 파는 조건 하나를 넓혀 비교합니다. (추천)` },
    { label: labels.strict, value: labels.strict, description: '사는 조건의 RSI 값 하나를 낮춰 진입을 더 까다롭게 비교합니다.', disabled: p.rsiTh <= 0 },
    { label: p.tp === null ? labels.add : labels.stop, value: p.tp === null ? labels.add : labels.stop, description: p.tp === null ? '산 가격보다 오르면 파는 조건 하나를 넣어 비교합니다.' : '산 가격보다 내리면 파는 조건 하나를 넓혀 비교합니다.' },
    { label: p.trendFilter ? labels.trendOff : labels.trendOn, value: p.trendFilter ? labels.trendOff : labels.trendOn, description: p.trendFilter ? '방향 확인 조건 하나를 꺼서 비교합니다.' : '방향 확인 조건 하나를 켜서 비교합니다.' },
  ]
  return Object.freeze({ answer: `${evidence} 어느 쪽을 바꿔 보겠습니까? 아래에서 고르시거나 원하는 방향을 적어 주십시오.`, title: '어느 조건을 바꿔 보겠습니까?',
    options: Object.freeze(options.map(option => Object.freeze(option))) })
}

/** One explicit scalar, or an explicitly labelled deterministic example.
 * No improvement search, recommendation authority, prices or external calls. */
export function replyCommonRevisionDirection(direction: CommonRevisionDirection, question: string): CommonRevisionDirectionReply | null {
  if (!known(direction, ['owner', 'base', 'before', 'dataRevision']) || !ownerValid(direction.owner) || direction.dataRevision !== COMMON_PREVIEW_REVISION || !safeInput(direction.before)
    || !known(direction.base, ['turnId', 'period', 'amount', 'startedAt', 'skipped']) || typeof direction.base.turnId !== 'string' || !direction.base.turnId.trim()
    || !commonPeriods.includes(direction.base.period) || !commonAmounts.includes(direction.base.amount)
    || !Number.isSafeInteger(direction.base.startedAt) || direction.base.startedAt! < 0 || direction.base.startedAt! > Date.now()
    || direction.base.skipped !== undefined && direction.base.skipped !== true || commonPreviewProgress(direction.base, Date.now()) < 1
    || typeof question !== 'string' || !question.trim() || question.length > 500
    || Array.from(question).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    || /\[|\]|secret|API\s*KEY|credential|token|cookie|비밀번호|인증키|백테스트|자동|보장|확실|무조건|기간|금액|자산|시간봉|일봉|레버리지|BTC|ETH|비트코인|이더리움|달러|USD|KRW|\$|원화|하지\s*마|않|말고|아니|제외|취소|[?？]|어때|어떨|될까|할까|없애|제거|(?<!\d)\d+[eE][+-]?\d+/i.test(question)) return null
  const before = safeInput(direction.before)!, p = before.parameters, text = question.trim()
  let change: CommonRevisionDirectionChange, proposed: InlineBacktestInput | undefined, example = false
  if (text === labels.loosen || text === labels.example) {
    example = true
    if (p.tp !== null) { if (p.tp >= 100) return null; change = 'tp'; proposed = exampleCommonProposal(before) }
    else { if (p.sl <= -99) return null; change = 'sl'; proposed = decodeInlineInput({ ...before, parameters: { ...p, sl: Math.max(-99, p.sl - 2) } }) }
  } else if (text === labels.strict) {
    if (p.rsiTh <= 0) return null
    example = true; change = 'rsiTh'
    proposed = decodeInlineInput({ ...before, requestedRsi: undefined, parameters: { ...p, rsiTh: Math.max(0, p.rsiTh - 5) } })
  } else if (text === labels.add && p.tp === null) {
    example = true; change = 'tp'; proposed = decodeInlineInput({ ...before, parameters: { ...p, tp: 8 } })
  } else if (text === labels.stop && p.tp !== null) {
    if (p.sl <= -99) return null
    example = true; change = 'sl'; proposed = decodeInlineInput({ ...before, parameters: { ...p, sl: Math.max(-99, p.sl - 2) } })
  } else if (text === (p.trendFilter ? labels.trendOff : labels.trendOn)) {
    example = true; change = 'trendFilter'; proposed = decodeInlineInput({ ...before, parameters: { ...p, trendFilter: !p.trendFilter } })
  } else {
    const mentions = [/(?:손절|내리면\s*파는|내리면\s*팔|내리면\s*매도)/.test(text) ? 'sl' : null,
      /(?:익절|오르면\s*파는|오르면\s*팔|오르면\s*매도)/.test(text) ? 'tp' : null,
      /RSI/i.test(text) ? 'rsiTh' : null, /(?:추세|방향\s*확인)/.test(text) ? 'trendFilter' : null].filter(Boolean)
    if (mentions.length !== 1) return null
    change = mentions[0] as CommonRevisionDirectionChange
    const numbers = [...text.matchAll(/[+-]?\d+(?:\.\d+)?/g)]
    if (change === 'trendFilter') {
      const on = /켜|활성/.test(text) && !/비활성/.test(text), off = /꺼|끄|비활성/.test(text)
      if (numbers.length || on === off) return null
      proposed = decodeInlineInput({ ...before, parameters: { ...p, trendFilter: on } })
    } else {
      if (numbers.length !== 1 || /,/.test(text) || change !== 'rsiTh' && !text.includes('%')) return null
      const n = Number(numbers[0][0])
      if (!Number.isFinite(n) || change === 'sl' && (n === 0 || Math.abs(n) >= 100)
        || change === 'tp' && (n <= 0 || n > 100) || change === 'rsiTh' && (n < 0 || n > 100)) return null
      proposed = decodeInlineInput({ ...before, ...(change === 'rsiTh' ? { requestedRsi: undefined } : {}), parameters: { ...p, [change]: change === 'sl' ? -Math.abs(n) : n } })
    }
  }
  if (!proposed || !onePreviewChange(before, proposed)) return null
  const next = proposed.parameters
  const condition = change === 'tp' ? `산 가격보다 ${next.tp}% 오르면 파는 조건` : change === 'sl' ? `산 가격보다 ${Math.abs(next.sl)}% 내리면 파는 조건`
    : change === 'rsiTh' ? `전날 RSI가 ${next.rsiTh} 아래일 때 사는 조건` : `방향 확인을 ${next.trendFilter ? '켜는' : '끄는'} 조건`
  const tradeoff = change === 'tp' || change === 'sl' ? '보유 시간이 달라지면 수익과 손실 폭이 함께 달라질 수 있습니다.' : '사는 횟수가 줄거나 늘어 기회를 놓치거나 손실이 달라질 수 있습니다.'
  return Object.freeze({ proposal: proposed, change, description: `${example ? 'Mock 예시의 비교해 볼 값으로' : '적어 주신 비교해 볼 값으로'} ${condition} 하나만 바꿉니다. ${tradeoff} 원인을 단정하거나 더 좋은 결과를 뜻하지 않습니다.` })
}
