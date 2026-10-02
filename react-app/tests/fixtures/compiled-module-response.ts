import type { Page } from '@playwright/test'

/** Test transport only: instrument one observed dev module, never synthesize it. */
export async function installCompiledModuleResponse(
  page: Page,
  modulePath: string,
  transform: (original: string) => string,
  seams: readonly (string | { text: string; all: true })[],
): Promise<void> {
  if (!modulePath.startsWith('/src/') || !modulePath.endsWith('.tsx')) throw new Error('TEST_COMPILED_MODULE_PATH_REQUIRED')
  const response = await page.request.get(modulePath, { maxRetries: 0 })
  if (response.status() !== 200) throw new Error(`TEST_COMPILED_MODULE_HTTP_${response.status()}`)
  if (!/^(?:application|text)\/(?:javascript|ecmascript)(?:\s*;|$)/i.test(response.headers()['content-type'] ?? '')) throw new Error('TEST_COMPILED_MODULE_JAVASCRIPT_REQUIRED')
  const original = await response.text()
  for (const seam of seams) {
    const text = typeof seam === 'string' ? seam : seam.text
    const count = original.split(text).length - 1
    // replaceAll deliberately instruments every cleanup site; never collapse
    // several timer retirements into a single-match contract.
    if (!text || (typeof seam === 'string' ? count !== 1 : count < 1)) throw new Error('TEST_COMPILED_MODULE_SEAM_REQUIRED')
  }
  const body = transform(original)
  const headers = { ...response.headers(), 'content-length': String(Buffer.byteLength(body)) }
  await page.route(`**${modulePath}*`, route => route.fulfill({ response, headers, body }))
}
