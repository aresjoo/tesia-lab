import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/noto-sans-kr'
import './internal-poc.css'
import { NativeServiceApp } from './NativeServiceApp'
import { SiteRouter } from '../components/SiteRouter'

const root = document.getElementById('internal-poc-root')
if (root === null) throw new Error('SERVICE_ROOT_MISSING')

// The existing server serves this HTML at / and /auth/complete. Start with the
// SDK-owned conversation controller even without a presentation fragment.
// Network/authentication failures stay failures, never local mock fallback.
createRoot(root).render(<StrictMode><SiteRouter service><NativeServiceApp exchangeConnectionsEnabled={import.meta.env.VITE_TETH_EXCHANGE_CONNECT === 'true'} /></SiteRouter></StrictMode>)
