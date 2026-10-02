import { expect, type Page } from '@playwright/test'

/** Keep the public / bootstrap, SiteRouter and stylesheet entry unchanged.
 * Only this test's compiled Main import receives an explicit Mock supplier. */
export async function installCommonResponseFixture(page: Page, owner: string) {
  await page.addInitScript(owner => Reflect.set(window, 'commonResponseFixtureOwner', owner), owner)
  await page.route('**/src/client-bootstrap.tsx*', async route => {
    const response = await route.fetch()
    const body = await response.text()
    const original = /(["'])\/src\/components\/ClientMainExperience\.tsx(?:\?[^"']*)?\1/g
    const matches = [...body.matchAll(original)]
    if (matches.length !== 1) throw new Error('TEST_COMMON_SOURCE_BOOTSTRAP_IMPORT_REQUIRED')
    await route.fulfill({ response, body: body.replace(original, '"/tests/fixtures/client-common-response-host.tsx"') })
  })
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
