// The entry separates design assets from the upstream chart/fixture bundle.
// It does not navigate away from an ongoing conversation.
const legacyFixture = import.meta.env.DEV
  && new URLSearchParams(window.location.search).get('legacy-fixture') === '1'
const mockJourney = window.location.hash === '#/mock-strategy-flow'
const chartPreview = import.meta.env.DEV
  && new URLSearchParams(window.location.search).get('chart-workspace-preview') === '1'
const bootstrap = chartPreview
  ? import('./dev/chart-workspace-preview')
  : legacyFixture || mockJourney
  ? import('./main')
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
