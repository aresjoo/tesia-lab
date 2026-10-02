import { expect, type Page } from '@playwright/test'

/** Keep the public / bootstrap, SiteRouter and stylesheet entry unchanged.
 * Only this test's compiled Main import receives an explicit Mock supplier. */
export async function installCommonResponseFixture(page: Page, owner: string) {
  await page.addInitScript(owner => Reflect.set(window, 'commonResponseFixtureOwner', owner), owner)
  // Observe one real compiled module before navigation or reload. A failed
  // transport/status/seam is fatal; no retry or alternate module is supplied.
  const response = await page.request.get('/src/client-bootstrap.tsx', { maxRetries: 0 })
  if (response.status() !== 200) throw new Error(`TEST_COMMON_SOURCE_BOOTSTRAP_HTTP_${response.status()}`)
  if (!/^(?:application|text)\/(?:javascript|ecmascript)(?:\s*;|$)/i.test(response.headers()['content-type'] ?? '')) throw new Error('TEST_COMMON_SOURCE_BOOTSTRAP_JAVASCRIPT_REQUIRED')
  const body = await response.text()
  const original = /(["'])\/src\/components\/ClientMainExperience\.tsx(?:\?[^"']*)?\1/g
  const matches = [...body.matchAll(original)]
  if (matches.length !== 1) throw new Error('TEST_COMMON_SOURCE_BOOTSTRAP_IMPORT_REQUIRED')
  const compiledBody = body.replace(original, '"/tests/fixtures/client-common-response-host.tsx"')
  const headers = { ...response.headers(), 'content-length': String(Buffer.byteLength(compiledBody)) }
  await page.route('**/src/client-bootstrap.tsx*', route => route.fulfill({ response, headers, body: compiledBody }))
}

/** Deliver through the mounted Main subscription; never modify the store. */
export async function publishCommonResponseFixture(page: Page, sl: -3 | -5 = -3) {
  const accepted = await page.evaluate(sl => {
    const publish = Reflect.get(window, 'publishCommonResponseFixture') as ((sl: number) => boolean) | undefined
    return publish?.(sl) ?? false
  }, sl)
  expect(accepted).toBe(true)
  const observed = await page.evaluate(() => {
    const saved = JSON.parse(sessionStorage.getItem('teth-client-experience')!)
    return saved.sessions.find((item: { id: string }) => item.id === saved.currentId).turns.at(-1)
  })
  expect(observed.responseSequence).toMatchObject({ owner: await page.evaluate(() => Reflect.get(window, 'commonResponseFixtureOwner')), revision: 1, status: 'done' })
  expect(observed.backtestFlow).toBe('common')
}
