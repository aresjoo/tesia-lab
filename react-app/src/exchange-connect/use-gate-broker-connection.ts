import { useEffect, useRef, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { createSdk, TesiaApiClient } from '../internal-poc/contracts/generated/api-v0.1/index.js'
import { SameOriginApiTransport } from '../internal-poc/api-adapter'
import { ApiV23Error, TesiaGateBrokerV23Client } from '../internal-poc/contracts/generated/api-v0.23/client.js'
import type { TransactionView, ConnectionView } from '../internal-poc/contracts/generated/api-v0.23/types.js'
import type { NativeConnectionPresentation } from '../internal-poc/native-connection-presentation'
import { createGateBrokerApi, createGateBrokerTransport, type GateBrokerEnvironment } from './gate-broker-api'
import { exchangeText, type ExchangeCopyKey } from './copy'

const STORAGE_KEY = 'tesia.native.gate-broker-transaction'
const TX = /^[0-9a-f]{32}$/
type Api = ReturnType<typeof createGateBrokerApi<TesiaGateBrokerV23Client>>
type Intent = { version: 1; scope: string; environment: GateBrokerEnvironment; transactionId: string | null;
  pollUntilMs: number; cancelRequested: boolean; visible: boolean }
export type GateBrokerSnapshot = { scope: string; available: boolean; connected: boolean;
  requested: boolean; connection?: NativeConnectionPresentation & { requestId: string } }
export type GateBrokerAuthorizationPort = Readonly<{
  scope: string; identity: string; environment: 'production'; authorize: () => Promise<void>
}>
export type GateBrokerControllerPorts = {
  api: Api
  currentSession: () => Promise<{ sessionId: string; state: string }>
  csrf: () => Promise<string>
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  navigate: (url: string) => void
  text: (key: ExchangeCopyKey) => string
  onChange: (snapshot: GateBrokerSnapshot | undefined) => void
  now?: () => number
  automaticPolling?: boolean
}

export function readGateBrokerTransactionLocator(href: string): string | null {
  const url = new URL(href)
  if (url.pathname !== '/auth/complete' || url.search) return null
  const match = /^#gate-broker-transaction=([0-9a-f]{32})$/.exec(url.hash)
  return match?.[1] ?? null
}

export function createGateBrokerConnectionController(scope: string, environment: GateBrokerEnvironment,
  ports: GateBrokerControllerPorts) {
  let disposed = false, generation = 0, available = false, requested = false, connected = false, revision = 0
  let intent: Intent | null = null, transaction: TransactionView | undefined
  let connections: readonly ConnectionView[] = [], busy = false, cancelPromise: Promise<void> | undefined
  let requestId = 'gate-broker-recovery'
  let timer: ReturnType<typeof setTimeout> | undefined, abort: AbortController | undefined
  const now = ports.now ?? Date.now
  const alive = (epoch: number) => !disposed && generation === epoch
  const stop = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined }
  const publish = (connection?: GateBrokerSnapshot['connection']) => {
    if (!disposed) ports.onChange({ scope, available, connected, requested, ...(connection ? { connection } : {}) })
  }
  const save = (value: Intent) => {
    const raw = JSON.stringify(value)
    ports.storage.setItem(STORAGE_KEY, raw)
    if (ports.storage.getItem(STORAGE_KEY) !== raw) throw new Error('GATE_INTENT_UNAVAILABLE')
    intent = value
  }
  const stored = (): Intent | null => {
    const raw = ports.storage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('GATE_INTENT_UNAVAILABLE')
    const item = value as Intent
    if (Object.keys(item).sort().join(',') !== 'cancelRequested,environment,pollUntilMs,scope,transactionId,version,visible'
      || item.version !== 1 || typeof item.scope !== 'string'
      || !['production', 'demo'].includes(item.environment)
      || item.transactionId !== null && (typeof item.transactionId !== 'string' || !TX.test(item.transactionId))
      || !Number.isSafeInteger(item.pollUntilMs) || item.pollUntilMs < 0
      || typeof item.cancelRequested !== 'boolean' || typeof item.visible !== 'boolean') throw new Error('GATE_INTENT_UNAVAILABLE')
    return item.scope === scope && item.environment === environment ? item : null
  }
  const ensure = async (epoch: number) => {
    const current = await ports.currentSession()
    if (!alive(epoch) || current.sessionId !== scope || current.state !== 'AUTHENTICATED') throw new Error('SESSION_CHANGED')
  }
  const pending = (description = ports.text('pending')) => {
    publish(requested ? { scope, identity: `exchange:gate-broker:${scope}`, status: 'ready', requestId, sourceLabel: 'TETH',
      state: { id: `gate-pending:${++revision}`, kind: 'exchange', title: 'Gate', description,
        exchanges: [
          { id: 'refresh', title: ports.text('refresh') },
          ...(intent?.transactionId && !intent.cancelRequested && (!transaction || ['AUTH_PENDING', 'TOKEN_RECEIVED'].includes(transaction.status))
            ? [{ id: 'cancel', title: ports.text('cancel') }] : []),
        ], onChoose: async id => { if (id === 'cancel') await cancel(); else if (id === 'refresh') await refresh() } } } : undefined)
  }
  const complete = () => {
    publish(requested ? { scope, identity: `exchange:gate-broker:${scope}`, status: 'ready', requestId, sourceLabel: 'TETH',
      state: { id: `gate-complete:${++revision}`, kind: 'complete', title: ports.text('connectedTitle'), description: ports.text('connected'),
        connectionList: { accounts: connections.map(value => ({ id: value.connectionId, exchangeId: 'gate' })) as
          [{ id: string; exchangeId: string }, ...{ id: string; exchangeId: string }[]] },
        rows: [{ id: 'gate-exchange', label: ports.text('exchange'), value: 'Gate' }], actions: [] } } : undefined)
  }
  const failed = () => {
    publish(requested ? { scope, identity: `exchange:gate-broker:${scope}`, status: 'ready', requestId, sourceLabel: 'TETH',
      state: { id: `gate-failed:${++revision}`, kind: 'exchange', title: 'Gate', description: ports.text('failed'),
        exchanges: intent?.transactionId ? [{ id: 'refresh', title: ports.text('refresh') }] : [],
        onChoose: async id => { if (id === 'refresh') await refresh() } } } : undefined)
  }
  const retire = () => { generation++; stop(); abort?.abort(); available = false; connected = false; ports.onChange(undefined) }
  const failure = (error: unknown, epoch: number) => {
    if (!alive(epoch)) return
    stop()
    if (error instanceof Error && error.message === 'SESSION_CHANGED'
      || error instanceof ApiV23Error && [401, 403].includes(error.status)) retire()
    else if (intent) pending(ports.text('pendingReadFailed'))
    else failed()
  }
  const list = async (epoch: number, signal: AbortSignal) => {
    const result = await ports.api.connections({ signal })
    await ensure(epoch)
    connections = result.data.connections.filter(value => value.environment === environment)
    connected = connections.length > 0; available = true
  }
  const observe = async (id: string, epoch: number, signal: AbortSignal) => {
    const result = await ports.api.transaction(id, { signal })
    await ensure(epoch)
    if (result.data.environment !== environment || result.data.transactionId !== id) throw new Error('GATE_BINDING_CHANGED')
    transaction = result.data
    if (!intent || intent.transactionId !== id) save({ version: 1, scope, environment, transactionId: id,
      pollUntilMs: now() + 300_000, cancelRequested: false, visible: requested })
    if (transaction.status === 'CONNECTED') {
      await list(epoch, signal)
      if (!connections.some(value => value.connectionId === transaction?.connectionId)) throw new Error('GATE_BINDING_CHANGED')
      stop(); ports.storage.removeItem(STORAGE_KEY); intent = null; complete()
    } else if (transaction.status === 'CANCELLED') {
      stop(); ports.storage.removeItem(STORAGE_KEY); intent = null; transaction = undefined; requested = false; publish()
    } else if (transaction.status === 'HOLD' || transaction.status === 'FAILED_NO_RETRY') { stop(); failed() }
    else {
      pending()
      if (ports.automaticPolling && transaction.status !== 'TOKEN_RECEIVED' && intent && now() < intent.pollUntilMs && requested) {
        stop(); timer = setTimeout(() => {
          timer = undefined
          if (alive(epoch) && intent && now() < intent.pollUntilMs) void refresh()
        }, 1_000)
      }
    }
  }
  const run = async (operation: (epoch: number, signal: AbortSignal) => Promise<void>) => {
    if (disposed || busy || cancelPromise) return false
    busy = true
    const epoch = generation, control = new AbortController(); abort = control
    try { await ensure(epoch); await operation(epoch, control.signal); return true }
    catch (error) { failure(error, epoch); return false }
    finally { if (abort === control) abort = undefined; busy = false }
  }
  const refresh = () => run(async (epoch, signal) => {
    if (intent?.transactionId) await observe(intent.transactionId, epoch, signal)
    else { await list(epoch, signal); if (connected) complete(); else if (intent) pending(); else publish() }
  })
  const cancel = (): Promise<void> => {
    if (cancelPromise) return cancelPromise
    if (disposed || !intent?.transactionId || intent.cancelRequested || transaction?.status === 'CONNECTED') return Promise.resolve()
    const id = intent.transactionId
    generation++; stop(); abort?.abort()
    const epoch = generation, control = new AbortController(); abort = control
    const operation = async () => {
      try {
        await ensure(epoch)
        const csrfToken = await ports.csrf()
        await ensure(epoch)
        if (!intent || intent.transactionId !== id) throw new Error('GATE_BINDING_CHANGED')
        save({ ...intent, cancelRequested: true })
        const result = await ports.api.cancel(id, { csrfToken, signal: control.signal })
        await ensure(epoch)
        if (result.data.environment !== environment || result.data.transactionId !== id) throw new Error('GATE_BINDING_CHANGED')
        transaction = result.data
        await observe(id, epoch, control.signal)
      } catch (error) { failure(error, epoch) }
      finally { if (abort === control) abort = undefined }
    }
    const promise = operation().finally(() => { if (cancelPromise === promise) cancelPromise = undefined })
    cancelPromise = promise
    return promise
  }
  return {
    load: (locator: string | null = null) => run(async (epoch, signal) => {
      intent = stored(); requested = Boolean(locator) || Boolean(intent?.visible)
      requestId = `gate-broker-recovery:${locator ?? intent?.transactionId ?? 'unknown'}`
      await list(epoch, signal)
      if (locator) {
        if (!TX.test(locator) || intent?.transactionId && intent.transactionId !== locator) throw new Error('GATE_BINDING_CHANGED')
        await observe(locator, epoch, signal)
      } else if (intent?.transactionId) await observe(intent.transactionId, epoch, signal)
      else if (intent) pending(); else publish()
    }),
    connect: () => run(async (epoch, signal) => {
      requested = true; requestId = `gate-broker:${crypto.randomUUID()}`; intent = stored()
      if (intent) { if (intent.transactionId) await observe(intent.transactionId, epoch, signal); else pending(); return }
      await list(epoch, signal)
      if (connected) { complete(); return }
      const csrfToken = await ports.csrf()
      await ensure(epoch)
      save({ version: 1, scope, environment, transactionId: null, pollUntilMs: now() + 300_000,
        cancelRequested: false, visible: true })
      pending()
      const result = await ports.api.start(environment, { csrfToken, signal })
      await ensure(epoch)
      if (result.data.environment !== environment) throw new Error('GATE_BINDING_CHANGED')
      intent = { version: 1, scope, environment, transactionId: result.data.transactionId,
        pollUntilMs: Math.min(result.data.expiresAtMs, now() + 300_000), cancelRequested: false, visible: true }
      save(intent); pending(); ports.navigate(result.data.authorizationUrl)
    }),
    refresh, cancel,
    close: () => {
      generation++; stop(); abort?.abort(); requested = false
      if (intent) { try { save({ ...intent, visible: false }) } catch { /* Keep the durable transaction; close cannot grant a new attempt. */ } }
      publish()
    },
    dispose: () => { disposed = true; generation++; stop(); abort?.abort() },
  }
}

export function useGateBrokerConnection(scope: string | null, authenticated: boolean, enabled: boolean) {
  const { language } = useClientPreferences()
  const [value, setValue] = useState<GateBrokerSnapshot & { connect: () => Promise<void>; close: () => void }>()
  const [locator] = useState(() => readGateBrokerTransactionLocator(window.location.href))
  const callbackIntent = useRef<{ owner: string | null; consumed: boolean }>({ owner: null, consumed: false })
  const controller = useRef<ReturnType<typeof createGateBrokerConnectionController> | null>(null)
  useEffect(() => {
    if (!scope || !authenticated || !enabled) return
    const callback = callbackIntent.current
    if (locator && callback.owner === null) callback.owner = scope
    const callbackLocator = locator && callback.owner === scope && !callback.consumed ? locator : null
    const session = createSdk(new TesiaApiClient(new SameOriginApiTransport())).session
    const owner = createGateBrokerConnectionController(scope, 'production', {
      api: createGateBrokerApi(new TesiaGateBrokerV23Client(createGateBrokerTransport())),
      currentSession: async () => (await session.current()).body.data,
      csrf: async () => (await session.csrf()).body.data.csrfToken,
      storage: window.sessionStorage, navigate: href => window.location.assign(href),
      text: key => exchangeText(language, key), automaticPolling: true,
      onChange: next => { if (controller.current === owner) setValue(next ? { ...next, connect, close } : undefined) },
    })
    const connect = async () => { if (controller.current === owner) await owner.connect() }
    const close = () => { if (controller.current === owner) owner.close() }
    controller.current = owner
    void owner.load(callbackLocator).then(observed => {
      if (!observed || controller.current !== owner || !callbackLocator) return
      callback.consumed = true
      if (readGateBrokerTransactionLocator(window.location.href) === callbackLocator)
        window.history.replaceState(null, '', '/')
    })
    return () => { owner.dispose(); if (controller.current === owner) controller.current = null }
  }, [scope, authenticated, enabled, language, locator])
  return enabled && authenticated && value?.scope === scope ? value : undefined
}
