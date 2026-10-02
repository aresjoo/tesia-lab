// Explicit, owner-bound Mock supplier used only by common-flow browser tests.
// Real Main still owns the composer, response admission, persistence and routes.
import { flushSync } from 'react-dom'
import { ClientMainExperience as Main } from '../../src/components/ClientMainExperience'
import type { ClientResponseSource, ClientResponseUpdate } from '../../src/components/ClientResponseSourceBridge'
import type { ClientSession } from '../../src/client-experience-store'
import { sourceTerminalPrices } from '../../src/client-terminal-source-fixture'

const owner: string = Reflect.get(window, 'commonResponseFixtureOwner')
if (typeof owner !== 'string' || !owner.endsWith('@example.test')) throw new Error('TEST_COMMON_SOURCE_OWNER_REQUIRED')
const subscriptions: { receive: (update: ClientResponseUpdate) => boolean; signal: AbortSignal; disposed: boolean }[] = []
const source: ClientResponseSource = {
  id: 'explicit-common-response-mock', owner,
  subscribe(receive, signal) {
    const subscription = { receive, signal, disposed: false }
    subscriptions.push(subscription)
    return () => { subscription.disposed = true }
  },
}

// Read only generated session/turn identities. The supplied proposal below is
// an independent fixed Mock observation, never an archive or backtestFlow seed.
Reflect.set(window, 'publishCommonResponseFixture', (sl = -3) => {
  const profile = JSON.parse(sessionStorage.getItem('teth-client-profile-preview') ?? 'null')
  const state = JSON.parse(sessionStorage.getItem('teth-client-experience') ?? 'null')
  const session = state?.sessions.find((item: ClientSession) => item.id === state.currentId) as ClientSession | undefined
  const turn = session?.turns.at(-1)
  const subscription = subscriptions.at(-1)
  if (profile?.email !== owner || !session || !turn || turn.responseSequence || !subscription
    || subscription.disposed || subscription.signal.aborted || ![-3, -5].includes(sl)) return false
  const update: ClientResponseUpdate = { sessionId: session.id, turnId: turn.id, expectedRevision: 0,
    sequence: { version: 1, owner, sessionId: session.id, turnId: turn.id, revision: 1, status: 'done',
      blocks: [{ id: 'common-observed-text', kind: 'text', status: 'done', text: '명시적인 Mock 공급 응답으로 확인한 조건입니다.' }],
      strategyProposal: { input: { pair: 'BTC/USDT', timeframe: '일봉', parameters: {
        sl, tp: 8, rsiTh: 44, trendFilter: false, startI: 61, endI: sourceTerminalPrices.length - 1,
      } }, period: 730, excludedConditions: [] },
    } }
  let accepted = false
  flushSync(() => { accepted = subscription.receive(update) })
  return accepted
})

export function ClientMainExperience() {
  return <Main responseSource={source} />
}
