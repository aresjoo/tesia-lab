/** Client-owned account page locations, not service endpoints. */
export type ClientAccountLocation =
  | { kind: 'plan'; tab: 'plan' | 'rebates' | 'alerts' }
  | { kind: 'review' | 'periodic'; id: string }
  | { kind: 'bot'; id: string }

export function readClientAccountLocation(hash = location.hash): ClientAccountLocation | null {
  const plan = /^#\/plan(?:\/(rebates|alerts))?$/.exec(hash)
  if (plan) return { kind: 'plan', tab: plan[1] === 'rebates' ? 'rebates' : plan[1] === 'alerts' ? 'alerts' : 'plan' }
  // Local view segments accept opaque identifier characters without treating
  // them as paths, query strings or an API resource/permission declaration.
  const bot = /^#\/trade\/bot\/([A-Za-z0-9_-]+)$/.exec(hash)
  if (bot) return { kind: 'bot', id: bot[1] }
  const record = /^#\/(review|periodic)\/([A-Za-z0-9_:-]+)$/.exec(hash)
  if (!record || record[1] === 'review' && record[2].includes(':')) return null
  return { kind: record[1] as 'review' | 'periodic', id: record[2] }
}

export function clientAccountHash(value: ClientAccountLocation): string {
  const hash = value.kind === 'plan' ? `#/plan${value.tab === 'plan' ? '' : `/${value.tab}`}` : value.kind === 'bot' ? `#/trade/bot/${value.id}` : `#/${value.kind}/${value.id}`
  if (!readClientAccountLocation(hash)) throw new RangeError('Invalid client account location')
  return hash
}

/** Supplied presentation destinations must not throw during a React render. */
export function safeClientAccountHash(value: ClientAccountLocation): string | null {
  try { return clientAccountHash(value) } catch { return null }
}

export function isClientAccountEntry(hash = location.hash): boolean {
  return hash === '#/trade' || readClientAccountLocation(hash) !== null
}
