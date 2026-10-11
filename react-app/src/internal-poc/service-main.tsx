import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/noto-sans-kr'
import '@fontsource-variable/noto-sans-sc'
import { NativeServiceApp } from './NativeServiceApp'
import { SiteRouter } from '../components/SiteRouter'
import { loadCopyExecutionDeployment, type ServiceCopyInput } from '../copy-execution/use-copy-execution'

const root = document.getElementById('internal-poc-root')
if (root === null) throw new Error('SERVICE_ROOT_MISSING')

export function ServiceRoot() {
  const copyExecutionEnabled = import.meta.env.VITE_TETH_COPY_EXECUTION_SERVICE === 'true'
  const [copyExecutionInput, setCopyExecutionInput] = useState<ServiceCopyInput>()
  useEffect(() => {
    if (!copyExecutionEnabled) return
    const abort = new AbortController()
    void loadCopyExecutionDeployment(import.meta.env.VITE_TETH_COPY_DEPLOYMENT_SHA256 ?? '', {
      origin: () => window.location.origin, fetch: window.fetch.bind(window), signal: abort.signal,
    }).then(value => { if (!abort.signal.aborted) setCopyExecutionInput(value) })
    return () => abort.abort()
  }, [copyExecutionEnabled])
  // The service app mounts immediately. A verified deployment changes only its
  // optional props on this same React tree, preserving the live session.
  return <SiteRouter service><NativeServiceApp
    naturalLoginFlow
    bitgetCanaryEnabled={import.meta.env.VITE_TETH_BITGET_CANARY === 'true'}
    exchangeConnectionsEnabled={import.meta.env.VITE_TETH_EXCHANGE_CONNECT === 'true'}
    consultationEnabled={import.meta.env.VITE_TETH_CONSULTATION === 'true'}
    copyExecutionEnabled={copyExecutionEnabled}
    copyExecutionInput={copyExecutionInput}
  /></SiteRouter>
}

// The existing server serves this HTML at / and /auth/complete. Network and
// authority failures remain unavailable and never fall back to local fixtures.
createRoot(root).render(<StrictMode><ServiceRoot /></StrictMode>)
