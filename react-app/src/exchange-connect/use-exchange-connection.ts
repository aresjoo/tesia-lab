import { useEffect, useRef, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { ApiResponseError, createSdk, TesiaApiClient } from '../internal-poc/contracts/generated/api-v0.1/index.js'
import { SameOriginApiTransport } from '../internal-poc/api-adapter'
import type { NativeConnectionPresentation } from '../internal-poc/native-connection-presentation'
import { ApiV12Error, TesiaExchangeConnectionsV12Client } from '../internal-poc/contracts/generated/api-v0.12/client.js'
import { createExchangeConnectionsTransport } from './transport'
import { createExchangeConnectionController, readExchangeTransactionLocator } from './controller'
import { exchangeText } from './copy'
import { pushSiteLocation } from '../site-navigation'
import { CLIENT_BROKERS } from '../client-broker-fixtures'
import type { BrokerServicePresentation } from '../client-broker-presentation'
import type { NativeAccountPresentation } from '../internal-poc/native-account-presentation'
import { connectedAccountPresentation, observedAccountPresentation } from './account-presentation'
import { ApiV17Error, TesiaBitgetAccountV17Client } from '../internal-poc/contracts/generated/api-v0.17/client.js'
import { accountConnectionBinding, createBitgetAccountTransport } from './account-read'

class SessionBindingError extends Error {}

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
  const [state, setState] = useState<{ scope: string; broker?: BrokerServicePresentation; account?: NativeAccountPresentation; connection?: NativeConnectionPresentation & { requestId: string }; close: () => void }>()
  const [locator] = useState(() => readExchangeTransactionLocator(window.location.href))
  const callbackIntent = useRef<{ owner: string | null; replayOpen: boolean }>({ owner: null, replayOpen: Boolean(locator) })
  // A confirmed mutation belongs to the owner, not the modal or locale effect
  // that initiated it. The current owner receives invalidation after retirement.
  const connectionChanges = useRef<{ scope: string | null; localRemovalOnly?: boolean; notify?: (id: string, localRemovalOnly: boolean) => void }>({ scope: null })
  useEffect(() => {
    if (!enabled || !scope || !authenticated) return
    let retired = false, unavailable = false, catalogConfirmed = false, requested = false, presentationRequest = 0, actionEpoch = 0, accountRead = 0, busy = false
    if (connectionChanges.current.scope !== scope) connectionChanges.current = { scope }
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
    const accountClient = new TesiaBitgetAccountV17Client(createBitgetAccountTransport())
    let financialGeneration = 0, financialPending = false, financialStopped = false, financialFailures = 0, financialRebinds = 0, metadataRefreshes = 0
    let financialAbort: AbortController | undefined, financialTimer: number | undefined
    let snapshots: Awaited<ReturnType<typeof accountClient.account>>[] = []
    const retireFinancial = (clear: boolean) => {
      financialGeneration++; financialAbort?.abort()
      if (financialTimer !== undefined) window.clearTimeout(financialTimer)
      financialTimer = undefined
      if (clear) snapshots = []
    }
    const currentSession = async () => {
      try {
        const result = await session.current()
        if (retired || result.body.meta.resourceRevision !== result.body.data.revision
          || result.body.data.sessionId !== scope || result.body.data.state !== 'AUTHENTICATED') throw new SessionBindingError('SESSION_CHANGED')
        return result.body.data
      } catch (error) {
        if (!retired) {
          retireFinancial(true); accountRead++
          if (error instanceof SessionBindingError || error instanceof ApiResponseError && error.status === 401) {
            financialStopped = true; account = undefined
          } else { financialFailures++; projectAccounts(); scheduleFinancial() }
          publish()
        }
        throw error
      }
    }
    let controller: ReturnType<typeof createExchangeConnectionController> | undefined
    let connection: NativeConnectionPresentation | undefined
    let broker: BrokerServicePresentation | undefined
    let account: NativeAccountPresentation | undefined
    let confirmedConnections: Awaited<ReturnType<typeof client.connections>>['data']['connections'] | null = null
    const readableConnections = () => confirmedConnections?.filter(item => item.exchangeId === 'bitget' && item.status === 'connected'
      && item.permissionsVerified && item.permissions.read) ?? []
    const accountMetadata = () => confirmedConnections === null ? undefined : connectedAccountPresentation(scope, [...confirmedConnections],
      key => exchangeText(language, key), async () => {
        const current = broker?.catalog?.find(item => item.broker.id === 'bitget')?.connectionState
        if (retired || !broker?.actions?.onConnect || !current) throw new Error('PROVIDER_UNAVAILABLE')
        await broker.actions.onConnect('bitget', current)
      })
    const projectAccounts = () => {
      const metadata = accountMetadata()
      account = !financialStopped && metadata ? observedAccountPresentation(metadata, snapshots) : undefined
    }
    const scheduleFinancial = () => {
      if (retired || unavailable || financialStopped || financialPending || metadataRefreshes || document.hidden
        || financialTimer !== undefined || !readableConnections().length) return
      // Bounded backoff for transient failures; each attempt still revalidates
      // session/metadata and only one read may be pending. No OAuth is retried.
      const delay = 15_000 * 2 ** Math.min(Math.max(financialFailures - 1, 0), 2)
      financialTimer = window.setTimeout(() => { financialTimer = undefined; void refreshFinancial() }, delay)
    }
    const setAccounts = (connections: Awaited<ReturnType<typeof client.connections>>['data']['connections'] | null) => {
      accountRead++
      if (accountConnectionBinding(connections) !== accountConnectionBinding(confirmedConnections)) retireFinancial(true)
      confirmedConnections = connections
      financialStopped = connections === null
      projectAccounts()
      if (broker?.catalog) broker = { ...broker, catalog: broker.catalog.map(item => item.broker.id === 'bitget'
        ? { ...item, connectionState: account?.accounts?.length ? 'CONNECTED' : 'NEEDS_LINK' } : item) }
      publish()
      if (!financialPending && financialTimer === undefined) void refreshFinancial()
    }
    const publish = () => {
      if (!retired && !unavailable) setState({ scope, broker, account, ...(requested && connection ? { connection: { ...connection,
        requestId: `${connection.identity}:presentation:${presentationRequest}` } } : {}), close })
    }
    const close = () => {
      if (retired || unavailable) return
      requested = false; actionEpoch++; busy = false
      // Closing is not cancellation. Retire every captured action/read so an
      // in-flight result cannot reopen the closed surface or mutate later.
      controller?.dispose(); controller = undefined
      retireFinancial(true); projectAccounts()
      publish()
      // This finite metadata refresh survives visible retirement without OAuth
      // mutation, and cannot replace a newer read or another owner's data.
      void refreshAccounts()
    }
    const refreshAccounts = async () => {
      if (retired || unavailable || !catalogConfirmed) return
      const request = ++accountRead
      metadataRefreshes++
      let confirmed = false
      try {
        await currentSession()
        const result = await client.connections()
        await currentSession()
        if (!retired && request === accountRead) { setAccounts(result.data.connections); confirmed = true }
      } catch (error) {
        // A transport outage does not revoke previously verified metadata.
        // Invalid/unauthorized responses do; unknown financial data stays null.
        if (!retired && request === accountRead) {
          if (error instanceof ApiV12Error && error.code === 'TRANSPORT_FAILED') {
            retireFinancial(true); financialFailures++; projectAccounts(); publish()
          } else setAccounts(null)
        }
      } finally {
        metadataRefreshes--
        if (confirmed && !financialFailures) void refreshFinancial()
        else scheduleFinancial()
      }
    }
    const refreshFinancial = async () => {
      if (retired || unavailable || financialStopped || financialPending || metadataRefreshes || document.hidden || !catalogConfirmed) return
      const connections = readableConnections()
      if (!connections.length) return
      const generation = financialGeneration, binding = accountConnectionBinding(confirmedConnections)
      const abort = new AbortController()
      financialAbort = abort; financialPending = true
      // A pending owner/metadata check cannot keep an older financial snapshot
      // visible. Only completion of this freshly bound read can publish facts.
      snapshots = []; projectAccounts(); publish()
      const rebind = () => {
        financialRebinds++
        if (financialRebinds > 1) financialFailures = Math.max(financialFailures, financialRebinds - 1)
      }
      const current = () => !retired && !financialStopped && !abort.signal.aborted && generation === financialGeneration
        && binding === accountConnectionBinding(confirmedConnections)
      try {
        const before = await currentSession()
        if (!current()) return
        const observations: Awaited<ReturnType<typeof accountClient.account>>[] = []
        for (const item of connections) {
          observations.push(await accountClient.account(item.connectionId, { signal: abort.signal }))
          if (!current()) return
        }
        // Re-read metadata after provider I/O: external revocation, permission
        // changes or replacement of the connection cannot retain older facts.
        const latest = await client.connections()
        const after = await currentSession()
        if (!current()) return
        if (before.revision !== after.revision) { rebind(); retireFinancial(true); projectAccounts(); publish(); return }
        if (binding !== accountConnectionBinding(latest.data.connections)) { rebind(); setAccounts(latest.data.connections); return }
        financialFailures = 0; financialRebinds = 0; snapshots = observations; projectAccounts(); publish()
      } catch (error) {
        if (!current()) return
        snapshots = []
        if (error instanceof ApiV17Error && error.status === 401 || error instanceof ApiV12Error && [401, 403].includes(error.status)) {
          retireFinancial(true); financialStopped = true; account = undefined
        } else {
          financialFailures++; projectAccounts()
          // Permission rejection or an externally removed connection needs an
          // authoritative metadata refresh, never a cached connected flag.
          if (error instanceof ApiV17Error && [403, 404].includes(error.status)) void refreshAccounts()
        }
        publish()
      } finally {
        financialPending = false
        if (financialAbort === abort) financialAbort = undefined
        if (!retired && !unavailable && !financialStopped && readableConnections().length) {
          if (generation !== financialGeneration && !financialFailures && financialRebinds <= 1) void refreshFinancial()
          else scheduleFinancial()
        }
      }
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
        onConnections: connections => {
          if (retired || controller !== value) return
          setAccounts(connections)
        },
        onConnectionsChanged: (id, localRemovalOnly) => {
          if (connectionChanges.current.scope === scope) {
            connectionChanges.current.localRemovalOnly = localRemovalOnly
            connectionChanges.current.notify?.(id, localRemovalOnly)
          }
        },
        onChange: next => {
          if (retired || controller !== value) return
          connection = next
          if (broker?.catalog && next.status !== 'loading') broker = { ...broker,
            catalog: broker.catalog.map(item => item.broker.id === 'bitget' ? { ...item,
              connectionState: account?.accounts?.length ? 'CONNECTED' : 'NEEDS_LINK' } : item) }
          publish()
        },
      })
      return value
    }
    const invalidateConnection = (id: string, localRemovalOnly: boolean) => {
      if (retired || unavailable) return
      // Dispose all readers that could have captured a pre-DELETE snapshot,
      // including a newly reopened modal. Reads after this point see the commit.
      controller?.dispose(); controller = undefined
      actionEpoch++; busy = false
      connection = undefined
      setAccounts(confirmedConnections?.filter(item => item.connectionId !== id) ?? null)
      if (requested) { controller = createController(); void controller.load(null, localRemovalOnly) }
      else void refreshAccounts()
    }
    connectionChanges.current.notify = invalidateConnection
    void (async () => {
      try {
        await allowed()
        // Presentation close retires transaction actions, not this owner's
        // background catalogue. A route transition must not erase entry.
        if (retired) return
        catalogConfirmed = true
        controller = createController()
        await controller.load(requested ? callbackLocator : null, connectionChanges.current.localRemovalOnly)
        if (retired) return
        broker = { scope, identity: `bitget-canary:${scope}`, catalog: CLIENT_BROKERS.map(item => ({
          broker: { ...item, conn: item.id === 'bitget', rating: null, traders: '—', rvN: undefined, traderN: undefined,
            promo: undefined, fees: undefined, lev: undefined, lev2: undefined },
          connectionState: item.id === 'bitget' ? account?.accounts?.length ? 'CONNECTED' : 'NEEDS_LINK' : 'SOON',
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
            await controller.load(null, connectionChanges.current.localRemovalOnly)
            if (retired || request !== actionEpoch || connection?.status !== 'ready') return
            // A prior local-only removal needs its existing warning surface,
            // not an immediate redirect that would erase it. The list's
            // explicit onChoose action still permits a new consent flow.
            if (connection.state.kind !== 'complete' && !connectionChanges.current.localRemovalOnly) await controller.connect('bitget')
          } catch (error) {
            if (!retired && error instanceof ApiV12Error && [401, 403].includes(error.status)) setAccounts(null)
            throw error
          } finally { if (request === actionEpoch) busy = false }
        } } }
        if (requested && callbackLocator && controller?.hasObservedTransaction(callbackLocator) && intent.owner === scope
          && window.location.pathname === '/auth/complete' && !window.location.search
          && (!window.location.hash || readExchangeTransactionLocator(window.location.href) === callbackLocator))
          window.history.replaceState(null, '', '/')
        publish()
      } catch {
        if (retired) return
        unavailable = true
        controller?.dispose(); controller = undefined; setState(undefined)
      }
    })()
    const leave = () => close()
    const visibility = () => {
      retireFinancial(true); projectAccounts(); publish()
      if (!document.hidden) { financialFailures = 0; void refreshAccounts() }
    }
    window.addEventListener('popstate', leave)
    window.addEventListener('hashchange', leave)
    window.addEventListener('teth:navigate', leave)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      retired = true; actionEpoch++; controller?.dispose()
      retireFinancial(true)
      // Effect retirement may retain verified connection metadata, but a same-
      // owner reactivation or language change must not re-expose its old facts.
      setState(value => value?.scope === scope && value.account ? { ...value, account: { ...value.account,
        ledger: { pos: null, open: null, orders: null, fills: null, closed: null, assets: null } } } : value)
      if (connectionChanges.current.notify === invalidateConnection) connectionChanges.current.notify = undefined
      window.removeEventListener('popstate', leave)
      window.removeEventListener('hashchange', leave)
      window.removeEventListener('teth:navigate', leave)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [scope, authenticated, enabled, language, locator])
  return enabled && authenticated && state?.scope === scope ? state : undefined
}
