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
import { CLIENT_BROKERS } from '../client-broker-fixtures'
import type { BrokerServicePresentation } from '../client-broker-presentation'

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

/** Closed operating opt-in; generic API12 remains a separate host selection.
 * Only the server's current authenticated owner and Bitget catalog grant an
 * action. Preparatory broker metadata is not live fees, reviews or permissions. */
export function useBitgetCanaryPresentation(scope: string | null, authenticated: boolean, enabled = false) {
  const { language } = useClientPreferences()
  const [state, setState] = useState<{ scope: string; broker?: BrokerServicePresentation; connection?: NativeConnectionPresentation & { requestId: string }; close: () => void }>()
  const [locator] = useState(() => readExchangeTransactionLocator(window.location.href))
  const callbackIntent = useRef<{ owner: string | null; replayOpen: boolean }>({ owner: null, replayOpen: Boolean(locator) })
  useEffect(() => {
    if (!enabled || !scope || !authenticated) return
    let retired = false, requested = false, presentationRequest = 0, actionEpoch = 0, busy = false
    const currentUrl = new URL(window.location.href), intent = callbackIntent.current
    const currentLocator = readExchangeTransactionLocator(currentUrl.href)
    const callbackRoute = locator && currentUrl.pathname === '/auth/complete' && !currentUrl.search
      && (currentLocator === locator || !currentUrl.hash && intent.owner === scope)
    if (callbackRoute && currentLocator === locator && intent.owner === null) intent.owner = scope
    const callbackLocator = callbackRoute && intent.replayOpen && intent.owner === scope ? locator : null
    requested = Boolean(callbackLocator)
    if (callbackLocator) queueMicrotask(() => {
      if (callbackIntent.current === intent && intent.owner === scope) intent.replayOpen = false
    })
    const session = createSdk(new TesiaApiClient(new SameOriginApiTransport())).session
    const client = new TesiaExchangeConnectionsV12Client(createExchangeConnectionsTransport())
    const currentSession = async () => {
      const result = await session.current()
      if (retired || result.body.meta.resourceRevision !== result.body.data.revision
        || result.body.data.sessionId !== scope || result.body.data.state !== 'AUTHENTICATED') throw new Error('SESSION_CHANGED')
      return result.body.data
    }
    let controller: ReturnType<typeof createExchangeConnectionController> | undefined
    let connection: NativeConnectionPresentation | undefined
    let broker: BrokerServicePresentation | undefined
    const publish = () => {
      if (!retired) setState({ scope, broker, ...(requested && connection ? { connection: { ...connection,
        requestId: `${connection.identity}:presentation:${presentationRequest}` } } : {}), close })
    }
    const close = () => {
      requested = false; actionEpoch++; busy = false
      // Closing is not cancellation. Retire every captured action/read so an
      // in-flight result cannot reopen the closed surface or mutate later.
      controller?.dispose(); controller = undefined
      publish()
    }
    const allowed = async () => {
      await currentSession()
      const catalog = await client.catalog()
      await currentSession()
      if (!catalog.data.providers.some(item => item.exchangeId === 'bitget' && item.available)) throw new Error('PROVIDER_UNAVAILABLE')
    }
    const createController = () => {
      const value = createExchangeConnectionController(scope, {
        client, currentSession, csrf: async () => (await session.csrf()).body.data.csrfToken,
        navigateToExchange: href => window.location.assign(href),
        onOpenTerminal: () => pushSiteLocation('/#/trade'),
        text: key => exchangeText(language, key), automaticPolling: true, allowedExchangeId: 'bitget',
        onChange: next => {
          if (retired || controller !== value) return
          connection = next
          if (broker?.catalog && next.status !== 'loading') broker = { ...broker,
            catalog: broker.catalog.map(item => item.broker.id === 'bitget' ? { ...item,
              connectionState: next.status === 'ready' && next.state.kind === 'complete' ? 'CONNECTED' : 'NEEDS_LINK' } : item) }
          publish()
        },
      })
      return value
    }
    void (async () => {
      try {
        await allowed()
        // Presentation close retires transaction actions, not this owner's
        // background catalogue. A route transition must not erase entry.
        if (retired) return
        controller = createController()
        await controller.load(callbackLocator)
        if (retired) return
        broker = { scope, identity: `bitget-canary:${scope}`, catalog: CLIENT_BROKERS.map(item => ({
          broker: { ...item, conn: item.id === 'bitget', rating: null, traders: '—', rvN: undefined, traderN: undefined,
            promo: undefined, fees: undefined, lev: undefined, lev2: undefined },
          connectionState: item.id === 'bitget' ? connection?.status === 'ready' && connection.state.kind === 'complete' ? 'CONNECTED' : 'NEEDS_LINK' : 'SOON',
          info: null, reviews: null,
        })), actions: { onConnect: async id => {
          if (id !== 'bitget' || retired) throw new Error('PROVIDER_UNAVAILABLE')
          if (busy) return
          busy = true
          const request = ++actionEpoch
          try {
            await allowed()
            if (retired || request !== actionEpoch) return
            controller?.dispose(); controller = createController()
            requested = true; presentationRequest++
            // Reopen from the current server list, not a cached complete flag.
            await controller.load()
            if (retired || request !== actionEpoch || connection?.status !== 'ready') return
            if (connection.state.kind !== 'complete') await controller.connect('bitget')
          } finally { if (request === actionEpoch) busy = false }
        } } }
        if (requested && callbackLocator && controller?.hasObservedTransaction(callbackLocator) && intent.owner === scope
          && window.location.pathname === '/auth/complete' && !window.location.search
          && (!window.location.hash || readExchangeTransactionLocator(window.location.href) === callbackLocator))
          window.history.replaceState(null, '', '/')
        publish()
      } catch {
        if (retired) return
        controller?.dispose(); controller = undefined; setState(undefined)
      }
    })()
    const leave = () => close()
    window.addEventListener('popstate', leave)
    window.addEventListener('hashchange', leave)
    window.addEventListener('teth:navigate', leave)
    return () => {
      retired = true; actionEpoch++; controller?.dispose()
      window.removeEventListener('popstate', leave)
      window.removeEventListener('hashchange', leave)
      window.removeEventListener('teth:navigate', leave)
    }
  }, [scope, authenticated, enabled, language, locator])
  return enabled && authenticated && state?.scope === scope ? state : undefined
}
