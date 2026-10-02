import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { ClientStrategySharing } from '../../src/components/ClientStrategySharing'
import { sourceSharedStrategies, type SharedLocation } from '../../src/client-shared-strategies'
import { sourceTerminalDate } from '../../src/client-terminal-source-fixture'
import type { SharingServicePresentation } from '../../src/client-sharing-presentation'

/** Retained supplied-follow consumer, not current public discovery or a real
 * provider. Source-derived observations only; no action/API/authority supplied. */
export function mountLegacySharingNumbers() {
  const rows = sourceSharedStrategies()
  const presentation: SharingServicePresentation = {
    state: 'ready', strategies: rows, watched: [rows[0].nick],
    periodResult: (row, period) => period === 'all' ? row.result : null,
    indexToDate: sourceTerminalDate,
  }
  function Host() {
    const [location, navigate] = useState<SharedLocation>({ period: 'all' })
    return <ClientStrategySharing location={location} onNavigate={navigate}
      onAsk={() => {}} onReturn={() => {}} signedIn={true} onLogin={() => {}}
      owner="retained-numbers@example.test" servicePresentation={presentation}/>
  }
  createRoot(document.getElementById('fixture')!).render(<Host/> )
}
