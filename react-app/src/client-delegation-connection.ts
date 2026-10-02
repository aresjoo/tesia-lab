/** Source UI navigation only. A locator or preview score is never API authority. */
import type { DelegationUiSnapshot } from './client-delegation-fixtures'
import { delegationBudgets } from './client-delegation-fixtures'
import { evaluateDelegation } from './client-delegation-engine'
import { SOURCE_USER_STRATEGY_PASS_SCORE } from './client-user-strategy'

export function canResumeDelegationConnection(snapshot: DelegationUiSnapshot | undefined): boolean {
  if (!snapshot || snapshot.recoveryRequired || snapshot.questionIndex !== 5 || snapshot.workStep !== 5) return false
  const parameters = snapshot.pendingParameters ?? snapshot.parameters
  const budget = delegationBudgets[snapshot.answers.budget?.index ?? -1]
  if (!parameters || budget === undefined) return false
  try { return evaluateDelegation(parameters, budget).score >= SOURCE_USER_STRATEGY_PASS_SCORE }
  catch { return false }
}

export function createDelegationConnectionLocator(owner: string | null, storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  const key = `teth-client-delegation-location:${owner === null ? 'guest' : `account:${encodeURIComponent(owner)}`}`
  let current: string | null = null
  const valid = (value: unknown): value is string => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 200
  try {
    const saved: unknown = JSON.parse((storage ?? sessionStorage).getItem(key) ?? 'null')
    if (saved && typeof saved === 'object' && 'sessionId' in saved && valid(saved.sessionId)) current = saved.sessionId
  } catch { /* Missing/unavailable navigation storage grants nothing. */ }
  return {
    read: () => current,
    remember: (sessionId: string): boolean => {
      if (!valid(sessionId)) return false
      current = sessionId
      try { (storage ?? sessionStorage).setItem(key, JSON.stringify({ sessionId })); return true }
      catch { return false }
    },
  }
}
