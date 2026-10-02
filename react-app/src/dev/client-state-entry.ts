// Explicit local entry only. Neither service nor public build includes this HTML.
if (import.meta.env.DEV) {
  void import('./client-state-preview').catch(() => {
    const root = document.getElementById('root')
    if (root) root.textContent = '화면을 불러오지 못했습니다. 다시 시도해주세요.'
  })
}
