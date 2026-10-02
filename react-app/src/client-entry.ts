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
  const message = document.createElement('p')
  message.setAttribute('role', 'alert')
  message.textContent = '화면을 불러오지 못했습니다. 다시 시도해주세요.'
  const retry = document.createElement('button')
  retry.type = 'button'
  retry.textContent = '다시 불러오기'
  retry.addEventListener('click', () => window.location.reload())
  root.replaceChildren(message, retry)
})
