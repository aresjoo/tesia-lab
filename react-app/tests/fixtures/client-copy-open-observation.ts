import type { Page } from '@playwright/test'
import type { SharedStrategy } from '../../src/client-shared-strategies'

/** Explicit test-only market observation after the seed's final closed trade.
 * The source's current catalog has no open position under f209bdf arithmetic.
 * Keep testing flatten UI without restoring the old phantom-position formula.
 */
export function withOpenCopyObservation(source: SharedStrategy): SharedStrategy {
  const last = source.result.eq.at(-1)!
  return { ...source, result: { ...source.result, eq: [...source.result.eq, { i: last.i + 1, v: last.v * .99 }] } }
}

export async function installOpenCopyObservation(page: Page, source: SharedStrategy) {
  await page.route('**/src/client-shared-strategies.ts', async route => {
    const response = await route.fetch(), body = await response.text()
    if (!body.includes('function sourceSharedStrategies(')) throw new Error('Vite source fixture seam unavailable')
    // Supply data at the module boundary only. Rendering, state, persistence,
    // input validation, confirmation and calculation remain real components.
    await route.fulfill({ response, body: `${body}\nconst fixtureOriginalSeeds = sourceSharedStrategies;\nsourceSharedStrategies = () => fixtureOriginalSeeds().map(row => row.nick === ${JSON.stringify(source.nick)} ? ${JSON.stringify(withOpenCopyObservation(source))} : row);\n` })
  })
}
