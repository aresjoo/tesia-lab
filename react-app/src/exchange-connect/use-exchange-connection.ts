import { useEffect, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { createSdk, TesiaApiClient } from '../internal-poc/contracts/generated/api-v0.1/index.js'
import { SameOriginApiTransport } from '../internal-poc/api-adapter'
import type { NativeConnectionPresentation } from '../internal-poc/native-connection-presentation'
import { TesiaExchangeConnectionsV12Client } from '../internal-poc/contracts/generated/api-v0.12/client.js'
import { createExchangeConnectionsTransport } from './transport'
import { createExchangeConnectionController, readExchangeTransactionLocator } from './controller'
import { exchangeText } from './copy'
import { pushSiteLocation } from '../site-navigation'

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
      // Callback endpoints are not workspace routes. The canonical source hash
      // route remains valid when the customer reloads after exchange return.
      onOpenTerminal: () => pushSiteLocation('/#/trade'),
      text: key => exchangeText(language, key), onChange: value => setPresentation({ ...value, requestId: value.identity }),
    })
    // StrictMode may replay setup after the first setup removed the locator
    // hash. Retain it only while still on the clean callback endpoint. Later
    // locale/auth rerenders must not rewrite a workspace route or poll the
    // already-consumed callback locator again.
    const currentUrl = new URL(window.location.href)
    const currentLocator = readExchangeTransactionLocator(currentUrl.href)
    const callbackLocator = locator && currentUrl.pathname === '/auth/complete' && !currentUrl.search
      && (!currentUrl.hash || currentLocator === locator) ? locator : null
    if (currentLocator && currentLocator === locator) window.history.replaceState(null, '', '/auth/complete')
    void controller.load(callbackLocator)
    return () => controller.dispose()
  }, [scope, authenticated, enabled, language, locator])
  return enabled && authenticated && presentation?.scope === scope ? presentation : undefined
}
