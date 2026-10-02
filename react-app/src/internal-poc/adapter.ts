import type { createSdk } from './contracts/generated/api-v0.1/sdk.js'
import type { EnsureBrowserSession } from './browser-session'

export type InternalPocSdk = ReturnType<typeof createSdk>

export type AdapterKind = 'local-api' | 'fixture'

export interface InternalPocAdapter {
  readonly kind: AdapterKind
  readonly label: '실제 엔진 실행·합성 시장 데이터' | 'Mock fixture'
  readonly sdk: InternalPocSdk
  readonly canReadResults: boolean
  readonly ensureBrowserSession?: EnsureBrowserSession
}
