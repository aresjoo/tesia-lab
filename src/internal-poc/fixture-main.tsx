import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/noto-sans-kr'
import { InternalPocApp } from './InternalPocApp'
import { ServiceV03JourneyApp } from './ServiceV03JourneyApp'
import { createFixtureAdapter, resetFixtureAdapterState } from './fixture-adapter'
import {
  createRecordedPaperSessionAdapter,
  resetRecordedPaperSessionState,
} from './recorded-paper-session-adapter'
import { createServiceV03Adapter } from './service-v03-adapter'
import {
  createServiceV03FixtureTransport,
  SERVICE_V03_JOURNEY_CLOCK,
} from './service-v03-fixture-transport'
import './internal-poc.css'
import './service-v03-journey.css'
import { ClientServiceBoundary } from './ClientServiceBoundary'

const root = document.getElementById('internal-poc-root')
if (root === null) throw new Error('INTERNAL_POC_ROOT_MISSING')

const isServiceV03Journey = window.location.hash.startsWith('#/v03-journey')

if (isServiceV03Journey) {
  const hashQuery = window.location.hash.split('?')[1] ?? ''
  const scenario = new URLSearchParams(hashQuery).get('scenario')
  const fixtureTransport = createServiceV03FixtureTransport({
    delayMs: scenario === 'slow' ? 400 : 90,
    ...(scenario === 'error-once' ? { failOnceOperation: 'createConversationV3' as const } : {}),
    ...(scenario === 'turn-error-once' ? { failOnceOperation: 'createConversationTurnV3' as const } : {}),
  })
  const adapter = createServiceV03Adapter(fixtureTransport, () => SERVICE_V03_JOURNEY_CLOCK)
  createRoot(root).render(
    <StrictMode>
      <ServiceV03JourneyApp adapter={adapter} fixtureTransport={fixtureTransport} />
    </StrictMode>,
  )
} else {
  const adapterPromise = createFixtureAdapter()
  const paperAdapterPromise = createRecordedPaperSessionAdapter()
  void adapterPromise.catch(() => undefined)
  void paperAdapterPromise.catch(() => undefined)

  const resetFixtureState = () => {
    resetFixtureAdapterState()
    resetRecordedPaperSessionState()
  }

  createRoot(root).render(
    <StrictMode>
      <InternalPocApp
        adapterPromise={adapterPromise}
        paperAdapterPromise={paperAdapterPromise}
        onReset={resetFixtureState}
        presentation={location.hash === '#/client' ? ClientServiceBoundary : undefined}
      />
    </StrictMode>,
  )
}
