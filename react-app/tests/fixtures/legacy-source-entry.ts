import type { Page } from '@playwright/test'

/** Restore an explicitly saved compatibility conversation. Fresh public
 * requests use the current source flow and are tested separately; this fixture
 * neither creates an approved strategy nor fabricates a completed result. */
export async function restoreLegacyDelegationEntry(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('teth-client-experience')) return
    const now = Date.now(), id = 'saved-delegation-compatibility'
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sharedFollows: [], sessions: [{
      id, title: '보존된 위임 대화', renamed: false, idea: '비트코인 전략 만들어줘', draft: '',
      pair: 'BTC/USDT', mode: '', timeframe: '', risk: '', takeProfit: '', phase: 'plan',
      workspace: 'delegation', researchStatus: '초안', tradingReady: false, updatedAt: now,
      turns: [{ id: 'saved-delegation-turn', question: '비트코인 전략 만들어줘', answer: '보존된 위임 대화입니다.',
        fullAnswer: '보존된 위임 대화입니다.', suggestions: [], phase: 'plan', status: 'done', startedAt: now, finishedAt: now }],
    }] }))
  })
}

/** Explicit archive host. Its reusable callbacks are not a current Main entry. */
export async function openLegacySourceConsumer(page: Page, kind: 'brokers' | 'delegation' = 'brokers', hash = '') {
  await page.addInitScript(kind => Reflect.set(window, 'legacyConsumerKind', kind), kind)
  await page.route('**/legacy-source-consumer.html*', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;await import("/tests/fixtures/legacy-source-consumer.tsx");</script></body></html>' }))
  await page.goto(`/legacy-source-consumer.html${hash}`)
}
