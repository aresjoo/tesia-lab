import type { Page } from '@playwright/test'
import { createClientUserStrategyStore, clientUserStrategyKey } from '../../src/client-user-strategy-store'
import { delegationRecommendedParameters, evaluateDelegation } from '../../src/client-delegation-engine'
export const ownedEditOwner = 'main-owned-edit@example.test'
export async function seedOwnedStrategyEdit(page: Page) {
  // Existing exported store only. No Main mount/state/handler replacement.
  const data = new Map<string, string>(), store = createClientUserStrategyStore(ownedEditOwner, { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } })
  const parameters = delegationRecommendedParameters(), result = evaluateDelegation(parameters, 1)
  store.register('owned-edit-source', { name: 'Owned edit explicit Mock', parameters, score: result.score, ret: result.result.ret, mdd: result.result.mdd, n: result.result.n, winRate: result.result.winRate, environment: 'paper', exchangeName: 'Binance', status: 'live', version: 'source-version' }, 1000)
  const key = clientUserStrategyKey(ownedEditOwner), raw = data.get(key)!
  await page.addInitScript(({ owner, key, raw }) => {
    if (!sessionStorage.getItem('owned-edit-seeded')) {
      sessionStorage.setItem('owned-edit-seeded', '1')
      localStorage.setItem('tethLang', 'ko')
      sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: 'Owned Mock', email: owner }))
      sessionStorage.setItem(key, raw)
    }
  }, { owner: ownedEditOwner, key, raw })
  return { key, raw }
}
