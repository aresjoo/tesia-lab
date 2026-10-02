import { useEffect, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { createSdk, TesiaApiClient } from '../internal-poc/contracts/generated/api-v0.1/index.js'
import { SameOriginApiTransport } from '../internal-poc/api-adapter'
import type { NativeConnectionPresentation } from '../internal-poc/native-connection-presentation'
import { TesiaExchangeConnectionsV12Client } from '../internal-poc/contracts/generated/api-v0.12/client.js'
import { createExchangeConnectionsTransport } from './transport'
import { createExchangeConnectionController, readExchangeTransactionLocator } from './controller'
import { exchangeText } from './copy'

/** Explicit service opt-in. An anonymous session never starts exchange OAuth. */
export function useExchangeConnectionPresentation(scope: string | null, authenticated: boolean, enabled: boolean) {
  const { language } = useClientPreferences()
  const [presentation, setPresentation] = useState<NativeConnectionPresentation & { requestId: string }>()
  // Preserve the locator across React StrictMode's setup/cleanup/setup cycle.
  // It is never an authentication receipt; each load verifies the server owner.
  const [locator] = useState(() => readExchangeTransactionLocator(window.location.href))
  useEffect(() => {
    if (!enabled || !scope || !authenticated) return
    const session = createSdk(new TesiaApiClient(new SameOriginApiTransport())).session
    const controller = createExchangeConnectionController(scope, {
      client: new TesiaExchangeConnectionsV12Client(createExchangeConnectionsTransport()),
      currentSession: async () => (await session.current()).body.data,
      csrf: async () => (await session.csrf()).body.data.csrfToken,
      navigateToExchange: href => window.location.assign(href),
      text: key => exchangeText(language, key), onChange: value => setPresentation({ ...value, requestId: value.identity }),
    })
    if (locator) window.history.replaceState(null, '', '/auth/complete')
    void controller.load(locator)
    return () => controller.dispose()
  }, [scope, authenticated, enabled, language, locator])
  return enabled && authenticated && presentation?.scope === scope ? presentation : undefined
}
