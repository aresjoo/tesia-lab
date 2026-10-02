import type { Page } from '@playwright/test'

export const mainCatalogueSetupOwner = 'main-copy-setup@example.test'
/** Keep the actual public bootstrap and Main handlers; supply only its typed Mock UI port. */
export async function installMainCatalogueSetup(page: Page, mode: 'persist' | 'deferred' | 'foreign' | 'unsupplied' = 'persist') {
  await page.addInitScript(({ owner, mode }) => {
    Reflect.set(window, 'mainCatalogueSetupMode', mode)
    if (!sessionStorage.getItem('test:main-catalogue-profile-initialized')) {
      sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '복사 설정 검수', email: owner }))
      sessionStorage.setItem('test:main-catalogue-profile-initialized', 'true')
    }
  }, { owner: mainCatalogueSetupOwner, mode })
  // Acquire the real compiled bootstrap once before Main can load or reload.
  // Fail on transport/status/MIME/seam errors; never retry or invent a module.
  const response = await page.request.get('/src/client-bootstrap.tsx', { maxRetries: 0 })
  if (response.status() !== 200) throw Error('TEST_MAIN_CATALOGUE_SETUP_BOOTSTRAP_REQUIRED:HTTP_' + response.status())
  if (!/^(?:application|text)\/(?:javascript|ecmascript)(?:\s*;|$)/i.test(response.headers()['content-type'] ?? '')) {
    throw Error('TEST_MAIN_CATALOGUE_SETUP_BOOTSTRAP_REQUIRED:JAVASCRIPT_MIME')
  }
  const body = await response.text()
  const original = /(["'])\/src\/components\/ClientMainExperience\.tsx(?:\?[^"']*)?\1/g
  if ([...body.matchAll(original)].length !== 1) throw Error('TEST_MAIN_CATALOGUE_SETUP_BOOTSTRAP_REQUIRED')
  const compiledBody = body.replace(original, '"/tests/fixtures/client-main-catalogue-setup-host.tsx"')
  const headers = { ...response.headers(), 'content-length': String(Buffer.byteLength(compiledBody)) }
  await page.route('**/src/client-bootstrap.tsx*', route => route.fulfill({ response, headers, body: compiledBody }))
}
