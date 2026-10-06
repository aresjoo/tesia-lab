import { clientEntryCopy, storedEntryLanguage } from './client-entry-copy'

// The source UI owns every public app entry, including historical bookmarks.
// Only the explicit DEV chart preview loads a separate verification surface.
const chartPreview = import.meta.env.DEV
  && new URLSearchParams(window.location.search).get('chart-workspace-preview') === '1'
const bootstrap = chartPreview
  ? import('./dev/chart-workspace-preview')
  : import('./client-bootstrap')

void bootstrap.catch(() => {
  const root = document.getElementById('root')
  if (!root) return
  const language = storedEntryLanguage()
  const copy = clientEntryCopy[language]
  root.lang = language
  const message = document.createElement('p')
  message.setAttribute('role', 'alert')
  message.textContent = copy.failure
  const retry = document.createElement('button')
  retry.type = 'button'
  retry.textContent = copy.reload
  retry.addEventListener('click', () => window.location.reload())
  root.replaceChildren(message, retry)
})
