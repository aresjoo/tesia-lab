/* eslint-disable react-refresh/only-export-components -- browser-only owner transition fixture */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientStrategySharing } from '../../src/components/ClientStrategySharing'
import type { SharedLocation } from '../../src/client-shared-strategies'

export type EvaluatedWatchOwnerFixture = { owner: string | null; location?: SharedLocation }
function Harness({ fixture }: { fixture: EvaluatedWatchOwnerFixture }) {
  const [location, setLocation] = useState<SharedLocation>({ section: 'library', period: 'all' })
  const [previousLocation, setPreviousLocation] = useState(fixture.location)
  if (previousLocation !== fixture.location) { setPreviousLocation(fixture.location); if (fixture.location) setLocation(fixture.location) }
  return <ClientStrategySharing owner={fixture.owner} signedIn={fixture.owner !== null} location={location} routeSections
    onNavigate={setLocation} onAsk={() => {}} onReturn={() => {}}
    onLogin={intent => { Reflect.set(window, 'ownerFixtureAuthIntent', intent) }}/>
}
export function mountEvaluatedWatchOwner(fixture: EvaluatedWatchOwnerFixture) {
  document.getElementById('root')?.remove()
  const host = document.createElement('main'); host.id = 'evaluated-owner-test-root'; document.body.append(host)
  const root = createRoot(host)
  root.render(<Harness fixture={fixture}/>)
  // A single React root and component instance are kept across every update.
  return { update: (next: EvaluatedWatchOwnerFixture) => root.render(<Harness fixture={next}/>) }
}
