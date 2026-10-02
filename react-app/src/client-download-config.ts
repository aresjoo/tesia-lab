export type DownloadStore = 'ios' | 'android'
export interface DownloadConfig { iosStoreUrl: string | null; androidStoreUrl: string | null }
type PublicDownloadInput = { iosStoreUrl?: unknown; androidStoreUrl?: unknown }

/** Public app-store links only. Never put credentials, tokens or private data in
 * TETH_CONFIG or VITE_*: both are delivered to every browser. No source-preview
 * store IDs are defaults, and a valid URL is not proof that an app is published.
 */
export function validateStoreUrl(store: DownloadStore, input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 512 || /[^\x21-\x7e]/.test(input) || /[\\#]/.test(input)) return null
  const host = store === 'ios' ? 'apps.apple.com' : 'play.google.com'
  // No userinfo, ports, host suffixes or URL-parser repairs.
  if (!input.startsWith(`https://${host}/`)) return null
  try {
    const url = new URL(input)
    const rawPath = input.slice(`https://${host}`.length).split('?')[0]
    if (url.pathname !== rawPath) return null
    const keys = [...url.searchParams.keys()]
    if (new Set(keys).size !== keys.length) return null
    if (store === 'ios') {
      if (!/^\/(?:[a-z]{2}\/)?app\/(?:[A-Za-z0-9._~%-]+\/)?id[1-9][0-9]{0,19}$/.test(rawPath)) return null
      const decoded = decodeURIComponent(rawPath)
      if (/[\p{Cc}\p{Cf}\\?#]/u.test(decoded) || decoded.split('/').length !== rawPath.split('/').length) return null
      if (keys.some(key => key !== 'l') || (url.searchParams.has('l') && !/^[a-z]{2,3}(?:-[A-Za-z]{2,8})?$/.test(url.searchParams.get('l')!))) return null
    } else {
      if (rawPath !== '/store/apps/details' || keys.some(key => !['id', 'hl', 'gl'].includes(key))) return null
      if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(url.searchParams.get('id') ?? '')) return null
      if (url.searchParams.has('hl') && !/^[a-z]{2,3}(?:[-_][A-Za-z]{2,8})?$/.test(url.searchParams.get('hl')!)) return null
      if (url.searchParams.has('gl') && !/^[A-Za-z]{2}$/.test(url.searchParams.get('gl')!)) return null
    }
    // Preserve the validated supplied bytes in both QR and link.
    return input
  } catch { return null }
}

/** Runtime own-properties override build configuration, even when blank/invalid.
 * Supply runtime config before mounting; no remote config fetch or persistence.
 */
export function resolveDownloadConfig(runtime: unknown, build: PublicDownloadInput = {}): DownloadConfig {
  const config = runtime && typeof runtime === 'object' && !Array.isArray(runtime) ? runtime as PublicDownloadInput : {}
  const read = (key: keyof PublicDownloadInput) => Object.prototype.hasOwnProperty.call(config, key) ? config[key] : build[key]
  return { iosStoreUrl: validateStoreUrl('ios', read('iosStoreUrl')), androidStoreUrl: validateStoreUrl('android', read('androidStoreUrl')) }
}

export function readDownloadConfig(): DownloadConfig {
  return resolveDownloadConfig(typeof window === 'undefined' ? undefined : Reflect.get(window, 'TETH_CONFIG'), {
    iosStoreUrl: import.meta.env.VITE_TETH_IOS_STORE_URL,
    androidStoreUrl: import.meta.env.VITE_TETH_ANDROID_STORE_URL,
  })
}
