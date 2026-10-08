import type { TesiaExchangeConnectionsV12Client } from '../internal-poc/contracts/generated/api-v0.12/client.js'
import type { NativeConnectionPresentation } from '../internal-poc/native-connection-presentation'
import type { ExchangeCopyKey } from './copy'

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
  text: (key: ExchangeCopyKey) => string
  onChange: (presentation: NativeConnectionPresentation) => void
}
const names: Record<Provider['exchangeId'], string> = { bybit: 'Bybit', bitget: 'Bitget', bingx: 'BingX', gate: 'Gate', mexc: 'MEXC', htx: 'HTX' }
const ID = /^[A-Za-z0-9_-]{16,128}$/

/** An untrusted, non-authorizing locator. Server still verifies owner/session. */
export function readExchangeTransactionLocator(href: string): string | null {
  const url = new URL(href)
  if (url.pathname !== '/auth/complete' || url.search) return null
  const match = /^#exchange-transaction=([A-Za-z0-9_-]{16,128})$/.exec(url.hash)
  return match?.[1] ?? null
}

export function createExchangeConnectionController(scope: string, ports: ExchangeControllerPorts) {
  const identity = `exchange:${scope}`
  let generation = 0, disposed = false, locked = false
  let providers: readonly Provider[] = [], connections: readonly Connection[] = []
  let transaction: Transaction | undefined
  let disconnectNotice = ''
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
    catch { if (alive(epoch)) showExchanges('ready', t('failed')) }
    finally { locked = false }
  }
  const mutationToken = async (epoch: number) => {
    const csrf = await ports.csrf()
    await ensureSession(epoch)
    return csrf
  }
  const terminalCleanup = (value: Transaction) => ['failed', 'expired', 'cancelled'].includes(value.status) ? t('cleanup') : ''
  const showExchanges = (status: NativeConnectionPresentation['status'] = 'ready', description = t('intro')) => {
    emit(status === 'ready' && !providers.some(provider => provider.available) ? 'unavailable' : status, {
      id: `exchanges:${++revision}`, kind: 'exchange', title: t('title'), description,
      exchanges: providers.filter(provider => provider.available).map(provider => ({ id: provider.exchangeId, title: names[provider.exchangeId] })),
      onChoose: exchangeId => guard(async epoch => {
        const provider = providers.find(item => item.exchangeId === exchangeId && item.available)
        if (!provider) throw new Error('PROVIDER_UNAVAILABLE')
        const token = await mutationToken(epoch)
        const result = await ports.client.start({ exchangeId: provider.exchangeId }, token)
        if (!alive(epoch)) return
        await ensureSession(epoch)
        transaction = result.data
        if (transaction.exchangeId !== exchangeId || transaction.status !== 'pending' || !transaction.authorizationUrl) throw new Error('INVALID_TRANSACTION')
        showPending()
        ports.navigateToExchange(transaction.authorizationUrl)
      }),
    })
  }
  const showPending = () => {
    if (!transaction) return
    const id = transaction.transactionId
    emit('ready', { id: `pending:${++revision}`, kind: 'exchange', title: names[transaction.exchangeId], description: t('pending'),
      exchanges: [
        { id: 'refresh', title: t('refresh') },
        { id: 'cancel', title: t('cancel') },
      ],
      onChoose: action => action === 'refresh' ? guard(epoch => observeTransaction(id, epoch)) : action === 'cancel' ? guard(async epoch => {
        const result = await ports.client.cancel(id, await mutationToken(epoch))
        if (!alive(epoch)) return
        transaction = undefined; showExchanges('ready', [t('intro'), terminalCleanup(result.data)].filter(Boolean).join(' '))
      }) : Promise.resolve(),
    })
  }
  const showConnected = () => emit('ready', { id: `connections:${++revision}`, kind: 'complete', title: t('connectedTitle'), description: [t('connected'), disconnectNotice].filter(Boolean).join(' '),
    rows: connections.flatMap(connection => [
      { id: `${connection.connectionId}:exchange`, label: t('exchange'), value: names[connection.exchangeId] },
      { id: `${connection.connectionId}:account`, label: t('account'), value: connection.maskedAccountLabel },
      { id: `${connection.connectionId}:permissions`, label: t('access'), value: connection.permissionsVerified
        ? [t('read'), ...(connection.permissions.spotTrade ? [t('spot')] : []), ...(connection.permissions.futuresTrade ? [t('futures')] : [])].join(' · ') : t('permissions') },
      { id: `${connection.connectionId}:withdrawal`, label: t('withdrawLabel'), value: connection.permissionsVerified ? t('withdrawal') : t('unverifiedWithdrawal') },
    ]),
    actions: [
      { id: 'add', label: t('add'), primary: true, onRun: async () => { if (!locked && !disposed) showExchanges() } },
      ...connections.map(connection => ({ id: connection.connectionId, label: `${names[connection.exchangeId]} · ${t('disconnect')}`,
        onRun: () => guard(async epoch => {
          const result = await ports.client.disconnect(connection.connectionId, await mutationToken(epoch))
          if (!alive(epoch)) return
          disconnectNotice = result.data.revocation === 'local_only' ? t('localRemoved') : ''
          await loadConnections(epoch)
          if (connections.length) showConnected(); else showExchanges('ready', disconnectNotice || t('intro'))
        }),
      })),
    ],
  })
  const loadConnections = async (epoch: number) => {
    const result = await ports.client.connections()
    await ensureSession(epoch)
    if (alive(epoch)) connections = result.data.connections.filter(connection => connection.status === 'connected')
  }
  const observeTransaction = async (id: string, epoch: number) => {
    if (!ID.test(id)) throw new Error('INVALID_LOCATOR')
    const result = await ports.client.transaction(id)
    await ensureSession(epoch)
    if (!alive(epoch)) return
    if (result.data.transactionId !== id) throw new Error('INVALID_TRANSACTION')
    transaction = result.data
    if (transaction.status === 'connected') {
      await loadConnections(epoch)
      if (!connections.some(connection => connection.connectionId === transaction?.connectionId && connection.exchangeId === transaction.exchangeId)) throw new Error('CONNECTION_NOT_CONFIRMED')
      showConnected()
    } else if (['pending', 'processing'].includes(transaction.status)) showPending()
    else {
      const cleanup = terminalCleanup(transaction)
      transaction = undefined; showExchanges('ready', [t('failed'), cleanup].filter(Boolean).join(' '))
    }
  }
  return {
    load: (locator: string | null = null) => guard(async epoch => {
      emit('loading', { id: `loading:${++revision}`, kind: 'exchange', title: t('title'), exchanges: null })
      const catalog = await ports.client.catalog()
      await ensureSession(epoch)
      if (!alive(epoch)) return
      providers = catalog.data.providers
      if (locator) await observeTransaction(locator, epoch)
      else { await loadConnections(epoch); if (connections.length) showConnected(); else showExchanges() }
    }),
    dispose: () => { disposed = true; generation++; providers = []; connections = []; transaction = undefined },
  }
}
