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
  await page.route('**/src/client-bootstrap.tsx*', async route => {
    const response = await route.fetch(), body = await response.text()
    const original = /(["'])\/src\/components\/ClientMainExperience\.tsx(?:\?[^"']*)?\1/g
    if ([...body.matchAll(original)].length !== 1) throw Error('TEST_MAIN_CATALOGUE_SETUP_BOOTSTRAP_REQUIRED')
    await route.fulfill({ response, body: body.replace(original, '"/tests/fixtures/client-main-catalogue-setup-host.tsx"') })
  })
}
