import type { TesiaExchangeConnectionsV12Client } from '../internal-poc/contracts/generated/api-v0.12/client.js'
import type { ConnectionListAccount, NativeConnectionPresentation } from '../internal-poc/native-connection-presentation'
import type { ExchangeCopyKey } from './copy'
import { ApiV12Error } from '../internal-poc/contracts/generated/api-v0.12/client.js'
import { ApiResponseError } from '../internal-poc/contracts/generated/api-v0.1/client.js'

type Client = Pick<TesiaExchangeConnectionsV12Client, 'catalog' | 'start' | 'transaction' | 'connections' | 'cancel' | 'disconnect'>
type Provider = Awaited<ReturnType<Client['catalog']>>['data']['providers'][number]
type Connection = Awaited<ReturnType<Client['connections']>>['data']['connections'][number]
type Transaction = Awaited<ReturnType<Client['transaction']>>['data']
export type ExchangeControllerPorts = {
  client: Client
  /** Reads existing normative session SDK; never bootstraps or accepts a user ID. */
  currentSession: () => Promise<{ sessionId: string; state: string }>
  csrf: () => Promise<string>
  navigateToExchange: (authorizationUrl: string) => void
  /** Internal navigation only; it grants neither trading nor plan eligibility. */
  onOpenTerminal?: () => void | Promise<void>
  text: (key: ExchangeCopyKey) => string
  onChange: (presentation: NativeConnectionPresentation) => void
  /** Validated, owner-confirmed connection metadata only; never account balances. */
  onConnections?: (connections: readonly Connection[] | null) => void
  /** Confirmed mutation invalidation survives visible controller disposal. */
  onConnectionsChanged?: (connectionId: string, localRemovalOnly: boolean) => void
  automaticPolling?: boolean
  allowedExchangeId?: Provider['exchangeId']
}
const names: Record<Provider['exchangeId'], string> = { bybit: 'Bybit', bitget: 'Bitget', bingx: 'BingX', gate: 'Gate', mexc: 'MEXC', htx: 'HTX' }
const ID = /^[A-Za-z0-9_-]{16,128}$/
/** Only transport refusals and known server failures may retry an observation. */
export const isTransientExchangeReadFailure = (error: unknown) => error instanceof ApiV12Error
  && (error.code === 'TRANSPORT_FAILED' || ['RATE_LIMITED', 'INTERNAL_ERROR', 'PROVIDER_FAILED', 'PROVIDER_UNAVAILABLE'].includes(error.code))
  || error instanceof ApiResponseError && [429, 500, 502, 503, 504].includes(error.status)
  || error instanceof TypeError || error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name)

/** An untrusted, non-authorizing locator. Server still verifies owner/session. */
export function readExchangeTransactionLocator(href: string): string | null {
  const url = new URL(href)
  if (url.pathname !== '/auth/complete' || url.search) return null
  const match = /^#exchange-transaction=([A-Za-z0-9_-]{16,128})$/.exec(url.hash)
  return match?.[1] ?? null
}

export function createExchangeConnectionController(scope: string, ports: ExchangeControllerPorts) {
  const identity = `exchange:${scope}`
  let generation = 0, disposed = false, locked = false, pollFailures = 0
  let cancelInFlight: { id: string; promise: Promise<void> } | undefined
  let pendingReadFailed = false
  let cancelIntent: { id: string; epoch: number; promise: Promise<void>; resolve: () => void } | undefined
  let providers: readonly Provider[] = [], connections: readonly Connection[] = []
  let transaction: Transaction | undefined
  let disconnectNotice = ''
  let pollTimer: ReturnType<typeof setTimeout> | undefined, pollDeadline = 0, pollStopped = false
  const stopPolling = () => { if (pollTimer !== undefined) clearTimeout(pollTimer); pollTimer = undefined; pollStopped = true }
  let revision = 0
  const t = ports.text
  const alive = (epoch: number) => !disposed && epoch === generation
  const emit = (status: NativeConnectionPresentation['status'], state: NativeConnectionPresentation['state']) => {
    if (!disposed) ports.onChange({ scope, identity, status, state, sourceLabel: 'TETH' })
  }
  const ensureSession = async (epoch: number) => {
    const current = await ports.currentSession()
    if (!alive(epoch) || current.sessionId !== scope || current.state !== 'AUTHENTICATED') throw new Error('SESSION_CHANGED')
  }
  const guard = async (operation: (epoch: number) => Promise<void>) => {
    if (disposed || locked) return
    locked = true
    const epoch = generation
    try { await ensureSession(epoch); await operation(epoch) }
    catch (error) {
      stopPolling()
      if (alive(epoch)) {
        if (error instanceof Error && error.message === 'SESSION_CHANGED'
          || error instanceof ApiV12Error && [401, 403].includes(error.status)) {
          providers = []; connections = []; transaction = undefined
          ports.onConnections?.(null)
          emit('error', { id: `retired:${++revision}`, kind: 'exchange', title: t('title'), description: t('failed'), exchanges: null })
        } else if (transaction && ['pending', 'processing'].includes(transaction.status) && isTransientExchangeReadFailure(error)) {
          // A failed observation neither retires the server request nor starts
          // replacement OAuth. Keep its actions and bounded GET recovery.
          pollFailures++; pendingReadFailed = true
          showPending('ready', t('pendingReadFailed'))
          if (!cancelIntent && ports.automaticPolling) {
            pollStopped = false
            schedulePolling(transaction.transactionId, epoch, Math.min(15_000, 1_000 * 2 ** Math.min(pollFailures - 1, 4)))
          }
        } else if (connections.length) showConnected(t('failed'))
        else showExchanges('error', [t('failed'), disconnectNotice].filter(Boolean).join(' '))
      }
    }
    finally {
      locked = false
      const intent = cancelIntent
      cancelIntent = undefined
      if (intent) {
        // Observation can already have advanced the request to processing or
        // connected. Only the still-current pending request may be cancelled.
        try {
          if (alive(intent.epoch) && transaction?.transactionId === intent.id) {
            if (transaction.status === 'pending') await cancelTransaction(intent.id)
            else if (transaction.status === 'processing' && ports.automaticPolling) {
              pollStopped = false; showPending(); schedulePolling(intent.id, intent.epoch)
            }
          }
        }
        finally { intent.resolve() }
      }
    }
  }
  const mutationToken = async (epoch: number) => {
    const csrf = await ports.csrf()
    await ensureSession(epoch)
    return csrf
  }
  const terminalCleanup = (value: Transaction) => ['failed', 'expired', 'cancelled'].includes(value.status) ? t('cleanup') : ''
  const connect = (exchangeId: string) => guard(async epoch => {
    if (ports.allowedExchangeId) {
      if (exchangeId !== ports.allowedExchangeId) throw new Error('PROVIDER_UNAVAILABLE')
      const catalog = await ports.client.catalog()
      await ensureSession(epoch)
      providers = catalog.data.providers.filter(item => item.exchangeId === ports.allowedExchangeId)
    }
    const provider = providers.find(item => item.exchangeId === exchangeId && item.available)
    if (!provider) throw new Error('PROVIDER_UNAVAILABLE')
    const result = await ports.client.start({ exchangeId: provider.exchangeId }, await mutationToken(epoch))
    if (!alive(epoch)) return
    await ensureSession(epoch)
    const candidate = result.data
    if (candidate.exchangeId !== exchangeId || candidate.status !== 'pending' || !candidate.authorizationUrl) throw new Error('INVALID_TRANSACTION')
    if (ports.allowedExchangeId === 'bitget') {
      const url = new URL(candidate.authorizationUrl)
      // Do not normalize an explicit port, credentials, a fragment or another
      // vendor path into the operating Bitget consent destination.
      if (!/^https:\/\/www\.bitget\.com\//.test(candidate.authorizationUrl) || candidate.authorizationUrl.includes('#')
        || url.protocol !== 'https:' || url.hostname !== 'www.bitget.com' || url.username || url.password || url.port || url.hash
        || url.pathname !== '/account/oauth') throw new Error('INVALID_TRANSACTION')
    }
    transaction = candidate; pendingReadFailed = false
    pollStopped = false; pollDeadline = 0
    showPending()
    ports.navigateToExchange(candidate.authorizationUrl)
  })
  const showExchanges = (status: NativeConnectionPresentation['status'] = 'ready', description = t('intro')) => {
    emit(status === 'ready' && !providers.some(provider => provider.available) ? 'unavailable' : status, {
      id: `exchanges:${++revision}`, kind: 'exchange', title: t('title'), description,
      exchanges: providers.filter(provider => provider.available).map(provider => ({ id: provider.exchangeId, title: names[provider.exchangeId] })),
      onChoose: connect,
    })
  }
  const cancelTransaction = (id: string): Promise<void> => {
    // Repeated explicit clicks share the issued mutation, including failures.
    if (cancelInFlight?.id === id) return cancelInFlight.promise
    if (disposed || transaction?.transactionId !== id || transaction.status !== 'pending') return Promise.resolve()
    stopPolling()
    if (locked) {
      if (cancelIntent) return cancelIntent.promise
      let resolve!: () => void
      const promise = new Promise<void>(done => { resolve = done })
      cancelIntent = { id, epoch: generation, promise, resolve }
      return promise
    }
    const promise = guard(async epoch => {
      try {
        const result = await ports.client.cancel(id, await mutationToken(epoch))
        if (!alive(epoch)) return
        transaction = undefined; pendingReadFailed = false; showExchanges('ready', [t('intro'), terminalCleanup(result.data)].filter(Boolean).join(' '))
      } catch (error) {
        if (!(error instanceof ApiV12Error) || !['TRANSACTION_REPLAYED', 'TRANSACTION_EXPIRED', 'ACCOUNT_CONFLICT'].includes(error.code)) throw error
        // The callback may have claimed pending immediately before DELETE.
        // Observe the same owner-bound request once; never repeat the mutation.
        if (!alive(epoch)) return
        await ensureSession(epoch)
        if (ports.automaticPolling) pollStopped = false
        await observeTransaction(id, epoch)
      }
    }).finally(() => { if (cancelInFlight?.promise === promise) cancelInFlight = undefined })
    cancelInFlight = { id, promise }
    return promise
  }
  const showPending = (status: NativeConnectionPresentation['status'] = 'ready', description = t(pendingReadFailed ? 'pendingReadFailed' : 'pending')) => {
    if (!transaction) return
    const id = transaction.transactionId
    emit(status, { id: `pending:${++revision}`, kind: 'exchange', title: names[transaction.exchangeId], description,
      exchanges: [
        ...(!ports.automaticPolling || pollStopped ? [{ id: 'refresh', title: t('refresh') }] : []),
        ...(transaction.status === 'pending' ? [{ id: 'cancel', title: t('cancel') }] : []),
      ],
      onChoose: action => action === 'refresh' ? guard(epoch => observeTransaction(id, epoch)) : action === 'cancel' ? cancelTransaction(id) : Promise.resolve(),
    })
  }
  const addExchange = () => guard(async () => { showExchanges() })
  const disconnectAccount = (connectionId: string) => guard(async epoch => {
    // Retired row callbacks cannot disconnect an account absent from this list.
    if (!connections.some(connection => connection.connectionId === connectionId)) return
    const result = await ports.client.disconnect(connectionId, await mutationToken(epoch))
    // Closing/navigation cancels observation, never the server mutation. Notify
    // the owner-data supplier even if this visible controller was retired.
    ports.onConnectionsChanged?.(connectionId, result.data.revocation === 'local_only')
    if (!alive(epoch)) return
    // DELETE is already confirmed: a failed refresh cannot restore this row.
    connections = connections.filter(connection => connection.connectionId !== connectionId)
    ports.onConnections?.(connections)
    disconnectNotice = result.data.revocation === 'local_only' ? t('localRemoved') : ''
    await loadConnections(epoch)
    if (connections.length) showConnected(); else showExchanges('ready', disconnectNotice || t('intro'))
  })
  const showConnected = (description = t('connected')) => {
    const accounts = connections.map(connection => ({
      id: connection.connectionId, exchangeId: connection.exchangeId,
      maskedAccountLabel: connection.maskedAccountLabel,
      onDisconnect: () => disconnectAccount(connection.connectionId),
    }))
    if (!accounts.length) { showExchanges(); return }
    emit('ready', { id: `connections:${++revision}`, kind: 'complete', title: t('connectedTitle'), description: [description, disconnectNotice].filter(Boolean).join(' '),
    connectionList: {
      accounts: accounts as [ConnectionListAccount, ...ConnectionListAccount[]],
      onAddExchange: addExchange,
      onOpenTerminal: ports.onOpenTerminal ? () => guard(async () => { await ports.onOpenTerminal!() }) : undefined,
    },
    rows: connections.flatMap(connection => [
      { id: `${connection.connectionId}:exchange`, label: t('exchange'), value: names[connection.exchangeId] },
      { id: `${connection.connectionId}:account`, label: t('account'), value: connection.maskedAccountLabel },
      { id: `${connection.connectionId}:permissions`, label: t('access'), value: connection.permissionsVerified
        ? [t('read'), ...(connection.permissions.spotTrade ? [t('spot')] : []), ...(connection.permissions.futuresTrade ? [t('futures')] : [])].join(' · ') : t('permissions') },
      { id: `${connection.connectionId}:withdrawal`, label: t('withdrawLabel'), value: connection.permissionsVerified ? t('withdrawal') : t('unverifiedWithdrawal') },
    ]),
    actions: [
      { id: 'add', label: t('add'), primary: true, onRun: addExchange },
      ...connections.map(connection => ({ id: connection.connectionId, label: `${names[connection.exchangeId]} · ${t('disconnect')}`,
        onRun: () => disconnectAccount(connection.connectionId),
      })),
    ],
  })
  }
  const loadConnections = async (epoch: number) => {
    const result = await ports.client.connections()
    await ensureSession(epoch)
    if (alive(epoch)) {
      connections = result.data.connections.filter(connection => connection.status === 'connected'
        && (!ports.allowedExchangeId || connection.exchangeId === ports.allowedExchangeId))
      ports.onConnections?.(connections)
    }
  }
  const observeTransaction = async (id: string, epoch: number) => {
    if (!ID.test(id)) throw new Error('INVALID_LOCATOR')
    const result = await ports.client.transaction(id)
    await ensureSession(epoch)
    if (!alive(epoch)) return
    if (result.data.transactionId !== id || ports.allowedExchangeId && result.data.exchangeId !== ports.allowedExchangeId) throw new Error('INVALID_TRANSACTION')
    transaction = result.data
    pollFailures = 0; pendingReadFailed = false
    if (transaction.status === 'connected') {
      stopPolling()
      await loadConnections(epoch)
      if (!connections.some(connection => connection.connectionId === transaction?.connectionId && connection.exchangeId === transaction.exchangeId)) throw new Error('CONNECTION_NOT_CONFIRMED')
      disconnectNotice = ''
      showConnected()
    } else if (['pending', 'processing'].includes(transaction.status)) { showPending(); schedulePolling(id, epoch) }
    else {
      stopPolling()
      const cleanup = terminalCleanup(transaction)
      transaction = undefined; showExchanges('ready', [t('failed'), cleanup].filter(Boolean).join(' '))
    }
  }
  const schedulePolling = (id: string, epoch: number, delay = 1_000) => {
    if (!ports.automaticPolling || pollStopped || !alive(epoch)) return
    pollDeadline ||= Date.now() + 300_000
    if (Date.now() >= pollDeadline) { stopPolling(); showPending(); return }
    if (pollTimer !== undefined) clearTimeout(pollTimer)
    pollTimer = setTimeout(() => {
      pollTimer = undefined
      if (!alive(epoch) || pollStopped) return
      if (locked) { schedulePolling(id, epoch); return }
      void guard(current => observeTransaction(id, current))
    }, Math.min(delay, pollDeadline - Date.now()))
  }
  return {
    connect,
    hasObservedTransaction: (id: string) => transaction?.transactionId === id,
    stopPolling: () => { stopPolling(); generation++ },
    load: (locator: string | null = null, localRemovalOnly = false) => guard(async epoch => {
      if (localRemovalOnly) disconnectNotice = t('localRemoved')
      emit('loading', { id: `loading:${++revision}`, kind: 'exchange', title: t('title'), exchanges: null })
      const catalog = await ports.client.catalog()
      await ensureSession(epoch)
      if (!alive(epoch)) return
      providers = catalog.data.providers.filter(provider => !ports.allowedExchangeId || provider.exchangeId === ports.allowedExchangeId)
      await loadConnections(epoch)
      if (locator) await observeTransaction(locator, epoch)
      else { if (connections.length) showConnected(); else showExchanges('ready', disconnectNotice || t('intro')) }
    }),
    dispose: () => { stopPolling(); disposed = true; generation++; cancelIntent?.resolve(); cancelIntent = undefined; providers = []; connections = []; transaction = undefined },
  }
}
