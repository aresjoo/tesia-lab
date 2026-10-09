import { useEffect, useRef, useState } from 'react'
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
  const callbackIntent = useRef<{ owner: string | null; replayOpen: boolean }>({ owner: null, replayOpen: Boolean(locator) })
  useEffect(() => {
    if (!enabled || !scope || !authenticated) return
    // Only the verified callback location carries visible-entry intent. Normal
    // background refreshes still project owner-bound data into account settings.
    const currentUrl = new URL(window.location.href)
    const currentLocator = readExchangeTransactionLocator(currentUrl.href)
    const intent = callbackIntent.current
    const callbackRoute = locator && currentUrl.pathname === '/auth/complete' && !currentUrl.search
      && (currentLocator === locator || !currentUrl.hash && intent.owner === scope)
    if (callbackRoute && currentLocator === locator && intent.owner === null) intent.owner = scope
    const callbackLocator = callbackRoute && intent.replayOpen && intent.owner === scope ? locator : null
    if (callbackLocator) queueMicrotask(() => {
      // React StrictMode replays setup before this microtask. Any later locale,
      // auth or owner rerun is a background read and cannot recreate intent.
      if (callbackIntent.current === intent && intent.owner === scope) intent.replayOpen = false
    })
    const session = createSdk(new TesiaApiClient(new SameOriginApiTransport())).session
    const controller = createExchangeConnectionController(scope, {
      client: new TesiaExchangeConnectionsV12Client(createExchangeConnectionsTransport()),
      currentSession: async () => (await session.current()).body.data,
      csrf: async () => (await session.csrf()).body.data.csrfToken,
      navigateToExchange: href => window.location.assign(href),
      // Callback endpoints are not workspace routes. The canonical source hash
      // route remains valid when the customer reloads after exchange return.
      onOpenTerminal: () => pushSiteLocation('/#/trade'),
      text: key => exchangeText(language, key), onChange: value => setPresentation({ ...value, requestId: callbackLocator ? 'oauth-callback' : '' }),
    })
    // StrictMode may replay setup after the first setup removed the locator
    // hash. Only the first consuming owner shares that same-turn replay.
    if (currentLocator && currentLocator === locator) window.history.replaceState(null, '', '/auth/complete')
    void controller.load(callbackLocator)
    return () => controller.dispose()
  }, [scope, authenticated, enabled, language, locator])
  return enabled && authenticated && presentation?.scope === scope ? presentation : undefined
}
