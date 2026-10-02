import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-kr'
import '@fontsource-variable/noto-sans-sc'
import './styles.css'
import './funnel-v2.css'
import './conversation-shell.css'
import './client-reference.css'
import './client-workspace.css'
import './client-integration.css'
import { ClientMainExperience } from './components/ClientMainExperience'
import { SiteRouter } from './components/SiteRouter'

const appRoot: ReturnType<typeof createRoot> = import.meta.hot?.data.root
  ?? createRoot(document.getElementById('root')!)
if (import.meta.hot) import.meta.hot.data.root = appRoot
appRoot.render(<StrictMode><SiteRouter><ClientMainExperience /></SiteRouter></StrictMode>)
