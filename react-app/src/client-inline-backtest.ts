/** 621cbed T9/T10 public SOURCE PREVIEW only. No service contract or authority.
 * Keep immutable input snapshots in the conversation; derive every displayed
 * metric from the existing deterministic source engine, never stored scores.
 */
import { decodeSourceUserStrategyParameters } from './client-user-strategy'
import { sourceTerminalPrices, type NormalizedSourceTerminalParameters } from './client-terminal-source-fixture'
import { readStoredPercentage } from './client-percentage-input'
import type { ClientSession } from './client-experience-store'
import type { DelegationUiSnapshot } from './client-delegation-fixtures'
import { normalizeSourceRsi } from './client-intake-input'

export type InlineBacktestInput = { parameters: NormalizedSourceTerminalParameters; pair: string; timeframe: string; requestedRsi?: number }
export type InlineBacktestRecord = InlineBacktestInput & { turnId: string; ordinal: number; completedAt: number }

export function decodeInlineInput(value: unknown): InlineBacktestInput | undefined {
  if (!value || typeof value !== 'object') return
  const x = value as Record<string, unknown>, p = decodeSourceUserStrategyParameters(x.parameters)
  if (!p || !Number.isSafeInteger(p.startI) || !Number.isSafeInteger(p.endI)
    || p.startI! < 61 || p.endI! < p.startI! || p.endI! >= sourceTerminalPrices.length
    || !['BTC/USDT', 'ETH/USDT'].includes(String(x.pair)) || !['1시간봉', '일봉'].includes(String(x.timeframe))) return
  if (x.requestedRsi !== undefined && (typeof x.requestedRsi !== 'number' || !Number.isFinite(x.requestedRsi) || normalizeSourceRsi(x.requestedRsi) !== p.rsiTh)) return
  return Object.freeze({ parameters: Object.freeze({ ...p, startI: p.startI!, endI: p.endI! }), pair: String(x.pair), timeframe: String(x.timeframe), ...(x.requestedRsi !== undefined ? { requestedRsi: x.requestedRsi as number } : {}) })
}

export function inlineInput(s: Pick<ClientSession, 'risk' | 'takeProfit' | 'mode' | 'pair' | 'timeframe' | 'requestedRsi' | 'rsiUnresolved'>): InlineBacktestInput | undefined {
  const risk = readStoredPercentage(s.risk), take = s.takeProfit === '미설정' ? null : readStoredPercentage(s.takeProfit)
  if (risk === null || take === null && s.takeProfit !== '미설정' || s.rsiUnresolved) return
  return decodeInlineInput({ pair: s.pair, timeframe: s.timeframe, requestedRsi: s.requestedRsi, parameters: {
    sl: -Math.abs(risk), tp: take, rsiTh: s.requestedRsi === undefined ? 44 : normalizeSourceRsi(s.requestedRsi), trendFilter: s.mode === 'trend', startI: 61, endI: sourceTerminalPrices.length - 1,
  } })
}

export function inlinePending(s: ClientSession): boolean {
  const turn = s.turns.at(-1)
  return Boolean(turn?.inlineRequest && turn.backtestFlow !== 'common' && !turn.responseSequence && !turn.responseSequenceInvalid && !turn.inlineStopped
    && (turn.status === 'running' || turn.status === 'done') && !s.inlineResults?.some(r => r.turnId === turn.id))
}

export function inlineConnectionMatches(s: ClientSession, ui: DelegationUiSnapshot | undefined): boolean {
  if (!ui?.inlineResult || !ui.inlineTurnId || ui.recoveryRequired || !ui.parameters || ui.pendingParameters || ui.workStep !== 5) return false
  const record = s.inlineResults?.find(r => r.turnId === ui.inlineTurnId)
  return Boolean(record && ui.answers.asset?.index === (record.pair === 'ETH/USDT' ? 1 : 0)
    && (['sl', 'tp', 'rsiTh', 'trendFilter', 'startI', 'endI'] as const).every(key => ui.parameters![key] === record.parameters[key]))
}

/** Project an authoritative inline-result selection into the legacy delegation UI.
 * Stored UI contributes presentation preferences only; it never overrides the
 * selected conversation result, its parameters, or its fixed preview budget. */
export function projectInlineConnectionUi(s: ClientSession, storedUi?: DelegationUiSnapshot): DelegationUiSnapshot | undefined {
  if (s.inlineConnectionRecovery) return
  const turnId = s.inlineConnectionTurnId
  if (turnId === undefined) return storedUi
  if (!turnId || s.sharedCopy?.active) return
  const record = readInlineRecords(s.inlineResults, s.turns).records.find(item => item.turnId === turnId)
  if (!record) return

  const canPreservePresentation = storedUi?.inlineTurnId === turnId && inlineConnectionMatches(s, storedUi)
  const page = canPreservePresentation && (storedUi.page === 'report' || storedUi.page === 'connect') ? storedUi.page : 'connect'
  const chartInterval = canPreservePresentation && ['1D', '1W', '1M'].includes(storedUi.chartInterval) ? storedUi.chartInterval : '1D'
  const assetIndex = record.pair === 'ETH/USDT' ? 1 : 0
  return {
    inlineResult: true,
    inlineTurnId: record.turnId,
    page,
    answers: {
      asset: { index: assetIndex, label: assetIndex === 1 ? '이더리움' : '비트코인', recommended: false },
      style: { index: 1, label: '중립적으로', recommended: false },
      budget: { index: 1, label: '500만원', recommended: false },
      period: { index: 2, label: '전체 기간', recommended: false },
      stop: { index: Math.max(0, [-3, -5, -8, -12].indexOf(record.parameters.sl)), label: `${record.parameters.sl}%까지`, recommended: false },
    },
    questionIndex: 5,
    attempt: record.ordinal,
    workStep: 5,
    expert: canPreservePresentation && storedUi.expert === true,
    chartInterval,
    parameters: { ...record.parameters },
  }
}

/** Reject corrupted/duplicate/unbound records individually, preserving the rest
 * of the user's conversation. This is a preview decoder, not server validation. */
export function readInlineRecords(value: unknown, turns: ClientSession['turns']): { records: InlineBacktestRecord[]; invalid: boolean } {
  if (value === undefined) return { records: [], invalid: false }
  if (!Array.isArray(value)) return { records: [], invalid: true }
  const records: InlineBacktestRecord[] = [], ids = new Set<string>(), ordinals = new Set<number>()
  let invalid = false
  for (const raw of value) {
    const input = decodeInlineInput(raw)
    const turn = raw && turns.find(t => t.id === raw.turnId)
    if (!input || !turn || turn.backtestFlow === 'common' || turn.status !== 'done' || !turn.inlineRequest || turn.inlineStopped
      || JSON.stringify(input) !== JSON.stringify(decodeInlineInput(turn.inlineRequest))
      || !Number.isSafeInteger(raw.ordinal) || raw.ordinal < 1 || ordinals.has(raw.ordinal) || ids.has(raw.turnId)
      || !Number.isSafeInteger(turn.finishedAt) || turn.finishedAt! < turn.startedAt
      || !Number.isSafeInteger(raw.completedAt) || raw.completedAt !== turn.finishedAt! + 1100) { invalid = true; continue }
    ids.add(raw.turnId); ordinals.add(raw.ordinal)
    records.push({ ...input, turnId: raw.turnId, ordinal: raw.ordinal, completedAt: raw.completedAt })
  }
  return { records, invalid }
}
