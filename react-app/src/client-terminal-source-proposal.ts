/**
 * SOURCE PREVIEW ONLY. aresjoo/tesia-lab 42a0d81: tfTmSay/tfTmSnap/tfScore,
 * TF_STOP and teth-copy.js TFC.score. Not an LLM, service validator, API
 * contract or execution approval. Creating a proposal does not mutate a seed.
 */
import {
  evaluateSourceTerminal, normalizeSourceTerminalParameters, sourceTerminalPrices,
  type NormalizedSourceTerminalParameters, type SourceTerminalParameters,
  type SourceTerminalSeed, type SourceTerminalEvaluation,
  sourceTerminalRsi, sourceTerminalSma,
} from './client-terminal-source-fixture'
import { projectSourceQuestion, type SourceQuestionView } from './client-source-question-view'

type Summary = { ret: number; mdd: number; n: number; winRate: number }
export type SourceTerminalProposal = {
  strategyId: string; baseVersion: string; baseFingerprint: string; request: string
  parameters: NormalizedSourceTerminalParameters
  rows: readonly { label: string; current: string; proposed: string; delta: string }[]
  notes: readonly string[]; unsupported: readonly string[]
  before: Summary; after: Summary; score: number; passes: boolean
}
export type SourceProposalResponse =
  | { kind: 'explanation'; title: string; text: string; followup: string }
  | { kind: 'unsupported' | 'unchanged'; title: string; text: string; followup: string }
  | { kind: 'proposal'; proposal: SourceTerminalProposal }

/** Display-only snapshots. Never attach these to a candidate or apply payload. */
export type SourceProposalRow =
  | { field: 'sl' | 'rsiTh'; current: number; proposed: number }
  | { field: 'tp'; current: number | null; proposed: number }
  | { field: 'trendFilter'; current: boolean; proposed: boolean }
export type SourceProposalNote =
  | { kind: 'stopSnap' | 'targetSnap' | 'rsiSnap' | 'riskLower' | 'riskHigher'; from: number; to: number }
  | { kind: 'stopTight'; value: number }
  | { kind: 'riskTrend' }
export type SourceUnsupportedField = 'unsupportedEma' | 'unsupportedPartial' | 'unsupportedLeverage' | 'unsupportedTimeframe'
export type SourceDiscussionDisplay =
  | { kind: 'question'; view: SourceQuestionView }
  | { kind: 'tooLong' | 'invalid' | 'unchanged' }
  | { kind: 'snappedUnchanged'; notes: readonly SourceProposalNote[] }
  | { kind: 'unsupported'; fields: readonly SourceUnsupportedField[]; notes?: readonly SourceProposalNote[] }
  | { kind: 'stop'; stop: number; mdd: number; count: number }
  | { kind: 'recent'; last: string | null; rsi: number; stop: number; target: number | null; ret: number; mdd: number; winRate: number }
  | { kind: 'proposal'; rows: readonly SourceProposalRow[]; notes: readonly SourceProposalNote[]; unsupported: readonly SourceUnsupportedField[] }
export type SourceTerminalDiscussion = { response: SourceProposalResponse; display: SourceDiscussionDisplay }

const stops = [-3, -5, -8, -12] as const
const summary = (r: SourceTerminalEvaluation['r']): Summary => ({ ret: r.ret, mdd: r.mdd, n: r.n, winRate: r.winRate })
const percent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
const snap = (value: number, allowed: readonly number[]) => {
  let best = allowed[0]
  for (const candidate of allowed) if (Math.abs(candidate - value) < Math.abs(best - value)) best = candidate
  return best
}

/** Canonical, ordered six-field source fingerprint. Not a security hash. */
export function sourceParameterFingerprint(parameters: SourceTerminalParameters): string {
  const p = normalizeSourceTerminalParameters(parameters)
  if (![p.sl, p.rsiTh, p.startI, p.endI].every(Number.isFinite) || (p.tp !== null && !Number.isFinite(p.tp))
    || !Number.isInteger(p.startI) || !Number.isInteger(p.endI) || p.startI < 61 || p.endI < p.startI || p.endI >= sourceTerminalPrices.length) throw new RangeError('Invalid source preview fingerprint parameters')
  return [p.sl, p.tp, p.rsiTh, p.trendFilter ? 1 : 0, p.startI, p.endI].join('|')
}

/** Preserve the actual config literals, not its outdated explanatory comments. */
export function scoreSourceTerminal(result: SourceTerminalEvaluation['r']): number {
  if (![result.winRate, result.cagr, result.mdd, result.tradeVol, result.n].every(Number.isFinite) || result.n < 0) throw new RangeError('Invalid source preview score metrics')
  const normalize = (value: number, lo: number, hi: number) => Math.max(0, Math.min(1, (value - lo) / (hi - lo)))
  let score = (normalize(result.winRate, 35, 60) * .30
    + normalize(result.cagr, 0, 6) * .28
    + normalize(result.mdd, -25, -6) * .27
    + normalize(result.tradeVol, 9, 4) * .15) * 100
  if (result.n < 4) score *= .65
  if (result.n < 6) score = Math.min(score, 79)
  return Math.max(5, Math.min(99, Math.round(score)))
}

export function sourceVersionIncrement(version: string): string {
  const parsed = parseFloat(version.replace('v', '')) || 1
  const next = Math.round(parsed * 10 + 1) / 10
  if (!Number.isFinite(next)) throw new RangeError('Invalid source preview version')
  return `v${next.toFixed(1)}`
}

export function createSourceTerminalProposal(seed: SourceTerminalSeed, request: string): SourceProposalResponse {
  return createSourceTerminalDiscussion(seed, request).response
}

/** One parse/evaluation, with presentation captured at the same base version. */
export function createSourceTerminalDiscussion(seed: SourceTerminalSeed, request: string): SourceTerminalDiscussion {
  const followup = `${request}. 이 전략 변경이 가능한지 알려줘`
  // The input component has the same 4,000-character budget. Reject rather than
  // truncate or parse non-finite numbers into the first allowed value.
  if (request.length > 4000) return { response: { kind: 'unsupported', title: '요청을 조금 짧게 입력해주세요', text: '전략 변경 요청은 4,000자까지 입력할 수 있어요.', followup: '' }, display: { kind: 'tooLong' } }
  const current = evaluateSourceTerminal(seed.parameters, seed.capital), p = current.r.params
  const question = /^(왜 아직 진입 안 했어\?|아직 진입하지 않은 이유)$/.test(request) ? 'whyEntry'
    : /^(지금 가장 큰 리스크는\?|지금 가장 큰 위험|가장 큰 위험)$/.test(request) ? 'largestRisk'
      : /^(다음 진입 조건은\?|다음 진입 조건)$/.test(request) ? 'nextEntry' : null
  if (question) {
    const end = p.endI, price = sourceTerminalPrices[end], ma20 = sourceTerminalSma(end, 20), ma60 = sourceTerminalSma(end, 60)
    const view: SourceQuestionView = { question, rsi: sourceTerminalRsi(end - 1), threshold: p.rsiTh,
      rebound: (price / sourceTerminalPrices[end - 1] - 1) * 100,
      gap: ma20 === null || ma60 === null ? null : Math.abs(ma20 - ma60) / price * 100, trend: p.trendFilter,
      position: current.pos ? { change: current.pos.chg * 100, distanceToStop: (current.pos.curP / current.pos.stopP - 1) * 100 } : null,
      stop: p.sl, target: p.tp, mdd: current.r.mdd, worstTrade: current.trades.reduce((worst, trade) => Math.min(worst, trade.pnl * 100), 0) }
    const answer = projectSourceQuestion(view, 'ko')
    return { response: { kind: 'explanation', title: answer.title, text: answer.text, followup: `${seed.name} 전략의 ${answer.title}에 대해 더 깊게 분석해줘` }, display: { kind: 'question', view } }
  }
  if (/설명|분석|왜|어떻게/.test(request) && !/바꿔|수정|변경|으로|낮춰|높여|올려|내려/.test(request)) {
    const stop = /손절/.test(request)
    return { response: { kind: 'explanation', title: stop ? '손절 기준' : '최근 판단',
      text: stop
        ? `이 전략의 손절선은 진입가 대비 ${p.sl}%예요. 검증 구간에서 이 규칙이 최대 낙폭을 ${current.r.mdd.toFixed(1)}% 안에서 관리했고, 손절 청산은 총 ${current.trades.filter(tr => tr.kind === 'sl').length}회 실행됐어요. 손절 폭을 좁히면 낙폭은 줄지만 거래가 짧게 끊길 수 있어요. "손절 -3%로 바꿔줘"라고 하면 실제 재검증 수치로 비교해드려요.`
        : `마지막 평가: ${current.L.evs.at(-1)?.txt ?? '기록 없음'}. 현재 설정은 전봉 RSI ${p.rsiTh} 미만 + 반등 확인 진입, 손절 ${p.sl}%${p.tp != null ? `, 익절 +${p.tp}%` : ''} 규칙이에요. 검증 성과는 수익 ${percent(current.r.ret)}, MDD ${current.r.mdd.toFixed(1)}%, 승률 ${Math.round(current.r.winRate || 0)}%입니다.`,
      followup: `${seed.name} 전략(${seed.symbol}, 검증 수익 ${current.r.ret.toFixed(1)}%, MDD ${current.r.mdd.toFixed(1)}%)에 대해 더 깊게 분석해줘` },
      display: stop ? { kind: 'stop', stop: p.sl, mdd: current.r.mdd, count: current.trades.filter(tr => tr.kind === 'sl').length }
        : { kind: 'recent', last: current.L.evs.at(-1)?.txt ?? null, rsi: p.rsiTh, stop: p.sl, target: p.tp, ret: current.r.ret, mdd: current.r.mdd, winRate: Math.round(current.r.winRate || 0) } }
  }
  const changes: Partial<Pick<NormalizedSourceTerminalParameters, 'sl' | 'tp' | 'rsiTh' | 'trendFilter'>> = {}
  const notes: string[] = [], unsupported: string[] = []
  const displayNotes: SourceProposalNote[] = [], displayUnsupported: SourceUnsupportedField[] = []
  const note = (text: string, display: SourceProposalNote) => { notes.push(text); displayNotes.push(display) }
  const stopMatch = request.match(/손절[^0-9\-+]*(-?\d+(?:\.\d+)?)\s*%/)
  const targetMatch = request.match(/(?:익절|목표)[^0-9]*\+?(\d+(?:\.\d+)?)\s*%/)
  const rsiMatch = request.match(/RSI\s*(\d+)/i)
  if ([stopMatch, targetMatch, rsiMatch].some(match => match && !Number.isFinite(Number(match[1])))) {
    return { response: { kind: 'unsupported', title: '입력한 수치를 확인해주세요', text: '해석 가능한 유한한 숫자로 손절, 익절 또는 RSI 조건을 입력해주세요. 전략은 변경하지 않았어요.', followup }, display: { kind: 'invalid' } }
  }
  if (stopMatch) {
    const value = -Math.abs(parseFloat(stopMatch[1])), allowed = snap(value, stops)
    changes.sl = allowed
    if (allowed !== value) note(`손절 ${value}% → 허용값 ${allowed}%로 조정`, { kind: 'stopSnap', from: value, to: allowed })
  }
  if (targetMatch) {
    const value = parseFloat(targetMatch[1]), allowed = snap(value, [8, 10, 12, 15])
    changes.tp = allowed
    if (allowed !== value) note(`익절 +${value}% → 허용값 +${allowed}%로 조정`, { kind: 'targetSnap', from: value, to: allowed })
  }
  if (rsiMatch) {
    const value = parseInt(rsiMatch[1], 10), allowed = snap(value, [38, 40, 42, 44, 46])
    changes.rsiTh = allowed
    if (allowed !== value) note(`RSI ${value} → 허용값 ${allowed}으로 조정`, { kind: 'rsiSnap', from: value, to: allowed })
  }
  if (/추세\s*필터/.test(request)) {
    if (/(꺼|끄|제거|해제|빼)/.test(request)) changes.trendFilter = false
    else if (/(켜|사용|추가|넣)/.test(request)) changes.trendFilter = true
  }
  if (/리스크/.test(request) && /(낮|줄)/.test(request) || request === '위험 낮추기' || request === '더 보수적으로 바꿔줘') {
    const index = stops.indexOf(p.sl as typeof stops[number])
    if (index > 0) { changes.sl = stops[index - 1]; note(`리스크 축소 → 손절 ${p.sl}% → ${changes.sl}%`, { kind: 'riskLower', from: p.sl, to: changes.sl }) }
    else note(`손절이 이미 가장 타이트한 값(${p.sl}%)이에요`, { kind: 'stopTight', value: p.sl })
    if (!changes.trendFilter && !p.trendFilter) { changes.trendFilter = true; note('리스크 축소 → 추세 필터 추가', { kind: 'riskTrend' }) }
  }
  if (/리스크/.test(request) && /(높|키|올)/.test(request)) {
    const index = stops.indexOf(p.sl as typeof stops[number])
    if (index >= 0 && index < stops.length - 1) { changes.sl = stops[index + 1]; note(`리스크 확대 → 손절 ${p.sl}% → ${changes.sl}%`, { kind: 'riskHigher', from: p.sl, to: changes.sl }) }
  }
  const recognized = Object.keys(changes).length > 0 || notes.length > 0
  for (const key of Object.keys(changes) as (keyof typeof changes)[]) if (changes[key] === p[key]) delete changes[key]
  const detectors: readonly [RegExp, string, SourceUnsupportedField][] = [[/EMA|이평.*마감|이동평균\s*\d+/i, 'EMA 조건', 'unsupportedEma'], [/절반|50%\s*축소|부분\s*청산/, '부분 청산 규칙', 'unsupportedPartial'], [/레버리지|배율/, '레버리지', 'unsupportedLeverage'], [/시간대|봉\s*주기|타임프레임/i, '타임프레임 변경', 'unsupportedTimeframe']]
  for (const [pattern, label, field] of detectors) if (pattern.test(request)) { unsupported.push(label); displayUnsupported.push(field) }
  if (!Object.keys(changes).length) {
    if (notes.length && !unsupported.length) return {
      response: { kind: 'unchanged', title: '조정하면 지금 설정과 같아져요', text: `${notes.join('\n')}\n현재 설정이 요청값에 가장 가까운 허용값이라 바꿀 것이 없어요.`, followup: '' },
      display: { kind: 'snappedUnchanged', notes: displayNotes },
    }
    // Source deleted equal fields before its no-change branch, making that
    // branch unreachable. Preserve its intended no-change copy explicitly.
    if (recognized && !unsupported.length) return { response: { kind: 'unchanged', title: '변경 사항이 없어요', text: '요청한 값이 현재 설정과 같아요. 버전을 만들지 않았어요.', followup }, display: { kind: 'unchanged' } }
    return { response: { kind: 'unsupported', title: '이 요청은 아직 자동 변환을 지원하지 않아요',
      text: [...notes, `지원: 손절(%), 익절(%), 진입 RSI 임계, 추세 필터 켜기/끄기, 리스크 낮춰/높여.${unsupported.length ? ` 요청하신 ${unsupported.join(', ')}은 아직 규칙 엔진이 지원하지 않아 적용할 수 없어요.` : ''}`].join('\n'), followup }, display: { kind: 'unsupported', fields: displayUnsupported, ...(displayNotes.length ? { notes: displayNotes } : {}) } }
  }
  const parameters: NormalizedSourceTerminalParameters = { ...p, ...changes }
  const result = evaluateSourceTerminal(parameters, seed.capital).r, score = scoreSourceTerminal(result)
  const rows: { label: string; current: string; proposed: string; delta: string }[] = []
  const displayRows: SourceProposalRow[] = []
  if (changes.sl != null) rows.push({ label: '손절선', current: `${p.sl}%`, proposed: `${parameters.sl}%`, delta: `${parameters.sl > p.sl ? '▲' : '▼'} ${parameters.sl - p.sl}%p` })
  if (changes.tp != null) rows.push({ label: '익절 목표', current: p.tp != null ? `+${p.tp}%` : '없음', proposed: `+${parameters.tp}%`, delta: p.tp != null ? `${parameters.tp! > p.tp ? '▲' : '▼'} ${parameters.tp! - p.tp}%p` : '신설' })
  if (changes.rsiTh != null) rows.push({ label: '진입 RSI 임계', current: String(p.rsiTh), proposed: String(parameters.rsiTh), delta: `${parameters.rsiTh > p.rsiTh ? '▲' : '▼'} ${parameters.rsiTh - p.rsiTh}` })
  if (changes.trendFilter != null) rows.push({ label: '추세 필터', current: p.trendFilter ? '사용' : '미사용', proposed: parameters.trendFilter ? '사용' : '미사용', delta: parameters.trendFilter ? '추가' : '제거' })
  if (changes.sl != null) displayRows.push({ field: 'sl', current: p.sl, proposed: parameters.sl })
  if (changes.tp != null) displayRows.push({ field: 'tp', current: p.tp, proposed: parameters.tp! })
  if (changes.rsiTh != null) displayRows.push({ field: 'rsiTh', current: p.rsiTh, proposed: parameters.rsiTh })
  if (changes.trendFilter != null) displayRows.push({ field: 'trendFilter', current: p.trendFilter, proposed: parameters.trendFilter })
  return { response: { kind: 'proposal', proposal: { strategyId: seed.id, baseVersion: seed.version, baseFingerprint: sourceParameterFingerprint(p), request,
    parameters, rows, notes, unsupported, before: summary(current.r), after: summary(result), score, passes: score >= 80 } }, display: { kind: 'proposal', rows: displayRows, notes: displayNotes, unsupported: displayUnsupported } }
}
