import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/noto-sans-kr'
import '@fontsource-variable/noto-sans-sc'
import { NativeServiceApp } from './NativeServiceApp'
import { SiteRouter } from '../components/SiteRouter'

const root = document.getElementById('internal-poc-root')
if (root === null) throw new Error('SERVICE_ROOT_MISSING')

// The existing server serves this HTML at / and /auth/complete. Start with the
// SDK-owned conversation controller even without a presentation fragment.
// Network/authentication failures stay failures, never local mock fallback.
// This opt-in selects the consultation adapter, not model or execution authority.
// The authenticated/anonymous server session and live capabilities still gate it.
createRoot(root).render(<StrictMode><SiteRouter service><NativeServiceApp
  naturalLoginFlow
  bitgetCanaryEnabled={import.meta.env.VITE_TETH_BITGET_CANARY === 'true'}
  exchangeConnectionsEnabled={import.meta.env.VITE_TETH_EXCHANGE_CONNECT === 'true'}
  consultationEnabled={import.meta.env.VITE_TETH_CONSULTATION === 'true'}
/></SiteRouter></StrictMode>)
