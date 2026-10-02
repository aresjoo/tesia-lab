import type { ClientResponseBlock } from './components/ClientResponseSequence'
import type { ResearchActivityProps, ResearchActivityStep } from './components/ClientResearchActivity'
import type { StoredMarketResponse } from './client-stored-market-response'
import type { MarketSource } from './client-market-response-presentation'
import { readResponseStrategy, type ResponseStrategyProposal } from './client-response-strategy'

/** Public local display records only. Not a wire schema, provider event stream,
 * private reasoning record, or permission to execute anything. */
export type StoredResponseSequenceBlock = Extract<ClientResponseBlock, { kind: 'work' | 'text' }>
  | { id: string; kind: 'market-ref'; blockId: string }
export type StoredResponseSequence = {
  version: 1
  owner: string | null
  sessionId: string
  turnId: string
  revision: number
  status: 'running' | 'done' | 'stopped' | 'failed'
  blocks: StoredResponseSequenceBlock[]
  /** Explicit final local-preview proposal, never inferred from text blocks. */
  strategyProposal?: ResponseStrategyProposal
}

type RecordValue = Record<string, unknown>
const statuses = ['running', 'done', 'stopped', 'failed'] as const
function invalid(): never { throw new Error('Invalid stored response sequence') }
function record(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as RecordValue
}
function text(value: unknown, required = false): string {
  if (typeof value !== 'string' || required && !value.trim()) return invalid()
  return value
}
function integer(value: unknown, minimum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) return invalid()
  return value
}
function choice<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) return invalid()
  return value as T
}
function denseArray(value: unknown, maximum?: number): unknown[] {
  if (!Array.isArray(value) || maximum !== undefined && value.length > maximum) return invalid()
  for (let index = 0; index < value.length; index++) if (!(index in value)) return invalid()
  return value
}
function unique<T extends { id: string }>(items: T[]): T[] {
  if (new Set(items.map(item => item.id)).size !== items.length) return invalid()
  return items
}

function sources(value: unknown): MarketSource[] {
  return unique(denseArray(value).map(value => {
    const item = record(value)
    // The existing renderer keeps unsafe URLs inert; never normalize URLs here.
    return { id: text(item.id, true), title: text(item.title, true), url: text(item.url, true),
      ...(item.description === undefined ? {} : { description: text(item.description) }) }
  }))
}
function activity(value: unknown): Omit<ResearchActivityProps, 'source'> {
  const item = record(value)
  const status = choice(item.status, statuses)
  const startedAt = item.startedAt === undefined ? undefined : integer(item.startedAt, 0)
  const finishedAt = item.finishedAt === undefined ? undefined : integer(item.finishedAt, 0)
  if (startedAt !== undefined && finishedAt !== undefined && finishedAt < startedAt) return invalid()
  const steps: ResearchActivityStep[] = unique(denseArray(item.steps).map(value => {
    const step = record(value)
    return { id: text(step.id, true), title: text(step.title, true), status: choice(step.status, statuses),
      ...(step.detail === undefined ? {} : { detail: text(step.detail) }),
      ...(step.publicSummary === undefined ? {} : { publicSummary: text(step.publicSummary) }),
      ...(step.sources === undefined ? {} : { sources: sources(step.sources) }) }
  }))
  if (status !== 'running' && steps.some(step => step.status === 'running')) return invalid()
  return { label: text(item.label, true), status, steps,
    ...(startedAt === undefined ? {} : { startedAt }), ...(finishedAt === undefined ? {} : { finishedAt }) }
}

function hasPending(block: StoredResponseSequenceBlock): boolean {
  return block.kind === 'text' ? block.status === 'streaming'
    : block.kind === 'work' && (block.activity.status === 'running' || block.activity.steps.some(step => step.status === 'running'))
}

/** Select known display fields into detached values. The caller keeps the
 * original transcript when a malformed envelope or reference is rejected.
 * No final-answer splitting, tool inference, timestamps or prices are created. */
export function readStoredResponseSequence(
  value: unknown,
  sessionId: string,
  turnId: string,
  market: StoredMarketResponse | undefined,
): StoredResponseSequence | null {
  try {
    text(sessionId, true); text(turnId, true)
    const item = record(value)
    if (item.version !== 1 || item.sessionId !== sessionId || item.turnId !== turnId) return null
    const owner = item.owner === null ? null : text(item.owner, true)
    const status = choice(item.status, statuses)
    const revision = integer(item.revision, 1)
    const marketIds = new Set(market?.blocks.map(block => block.id) ?? [])
    const blocks = unique(denseArray(item.blocks, 256).map((value): StoredResponseSequenceBlock => {
      const block = record(value), id = text(block.id, true)
      if (block.kind === 'market-ref') {
        const blockId = text(block.blockId, true)
        if (id !== blockId || !market || market.owner !== owner
          || market.blocks.filter(item => item.id === blockId).length !== 1) return invalid()
        return { id, kind: 'market-ref', blockId }
      }
      if (marketIds.has(id)) return invalid()
      if (block.kind === 'text') {
        const value = text(block.text)
        if (value.length > 1_000_000) return invalid()
        return { id, kind: 'text', text: value, status: choice(block.status, ['streaming', 'done', 'interrupted'] as const) }
      }
      if (block.kind === 'work') return { id, kind: 'work', activity: activity(block.activity) }
      return invalid()
    }))
    if (!blocks.length || status !== 'running' && blocks.some(hasPending)) return null
    const strategyProposal = item.strategyProposal === undefined ? undefined : readResponseStrategy(item.strategyProposal)
    if (item.strategyProposal !== undefined && (!strategyProposal || status !== 'done')) return null
    return { version: 1, owner, sessionId, turnId, revision, status, blocks,
      ...(strategyProposal ? { strategyProposal } : {}) }
  } catch { return null }
}

/** Display/copy projection only; never an executable prompt or provider input. */
export function responseSequenceText(sequence: StoredResponseSequence): string {
  return sequence.blocks.flatMap(block => block.kind === 'text' ? [block.text] : []).join('\n\n')
}

// Decoder outputs are plain detached trees. Property insertion order is not
// meaningful, but array order and every supplied value remain significant.
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => equal(item, b[index]))
  }
  const left = a as RecordValue, right = b as RecordValue, keys = Object.keys(left)
  return keys.length === Object.keys(right).length
    && keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && equal(left[key], right[key]))
}

/** Both arguments must first pass the decoder. Initial revision 1 admission
 * and persistence belong to the store; this checks only an observed advance. */
export function canAdvanceResponseSequence(previous: StoredResponseSequence, next: StoredResponseSequence): boolean {
  try {
    if (previous.version !== 1 || next.version !== 1 || previous.status !== 'running'
      || previous.owner !== next.owner || previous.sessionId !== next.sessionId || previous.turnId !== next.turnId
      || !Number.isSafeInteger(previous.revision) || previous.revision < 1 || !Number.isSafeInteger(next.revision)
      || next.revision !== previous.revision + 1 || next.blocks.length < previous.blocks.length
      || next.status !== 'running' && next.blocks.some(hasPending)) return false
    return previous.blocks.every((block, index) => {
      const updated = next.blocks[index]
      if (!updated || updated.kind !== block.kind || updated.id !== block.id) return false
      if (block.kind === 'text' && block.status === 'streaming') {
        return updated.kind === 'text' && updated.text.startsWith(block.text)
          && ['streaming', 'done', 'interrupted'].includes(updated.status)
      }
      if (block.kind === 'work' && block.activity.status === 'running') return true
      return equal(block, updated)
    })
  } catch { return false }
}
