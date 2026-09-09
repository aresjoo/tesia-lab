import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/noto-sans-kr'
import { InternalPocApp } from './InternalPocApp'
import { createApiAdapter, readApiAdapterConfig } from './api-adapter'
import { createLocalPaperApiAdapter } from './local-paper-api-adapter'
import { createLocalMarketArtifactApiAdapter } from './local-market-artifact-api-adapter'
import './internal-poc.css'
import { ClientServiceBoundary } from './ClientServiceBoundary'

const root = document.getElementById('internal-poc-root')
if (root === null) throw new Error('INTERNAL_POC_ROOT_MISSING')

// Fragments are browser-only. The approved server rejects unexpected queries.
const useClientPresentation = location.hash === '#/client'

// The factory is retained only for an explicit in-app session retry. It never
// reads a remote base URL: api-adapter keeps all requests same-origin.
const createAdapter = () => Promise.resolve().then(() => createApiAdapter(readApiAdapterConfig(document)))
const adapterPromise = createAdapter()
const paperAdapterPromise = createLocalPaperApiAdapter()
const paperMarketArtifactAdapterPromise = Promise.resolve(createLocalMarketArtifactApiAdapter())
void adapterPromise.catch(() => undefined)
void paperAdapterPromise.catch(() => undefined)
void paperMarketArtifactAdapterPromise.catch(() => undefined)

createRoot(root).render(
  <StrictMode>
    <InternalPocApp
      adapterPromise={adapterPromise}
      createAdapter={createAdapter}
      paperAdapterPromise={paperAdapterPromise}
      paperMarketArtifactAdapterPromise={paperMarketArtifactAdapterPromise}
      presentation={useClientPresentation ? ClientServiceBoundary : undefined}
    />
  </StrictMode>,
)
