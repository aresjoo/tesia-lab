/** UI preview records only. Never an order schema, credential store, or transport. */
export const conditionalOrderSourceSha = '9fbff821df62cad11d026022fc7628c7fcebc431'
export type ConditionalOrderSide = 'buy' | 'sell' | 'long' | 'short'
export type ConditionalOrderStatus = 'draft' | 'wait' | 'cancel' | 'done'
export type ConditionalOrderTtl = 'gtc' | '7d' | '1d'
export type ConditionalOrderPreviewSpec = {
  asset: string
  symbol: string
  side: ConditionalOrderSide
  trigger: number | null
  triggerPct: number | null
  last: number | null
  qty: 'all' | 'half' | 'num'
  qtyNum: number | null
  lev: number | null
  ttl: ConditionalOrderTtl
  exchange: string | null
}
export type ConditionalOrderPreviewOrder = Readonly<ConditionalOrderPreviewSpec & {
  id: string
  sessionId: string
  namespace: string
  status: ConditionalOrderStatus
  createdAt: number
  placedAt?: number
  canceledAt?: number
  filledAt?: number
  fillPrice?: number
}>
export type ConditionalOrderPreviewState = Readonly<{
  orders: readonly ConditionalOrderPreviewOrder[]
  error: 'storage' | 'corrupt' | null
}>
type PreviewStorage = Pick<Storage, 'getItem' | 'setItem'>
const sides = ['buy', 'sell', 'long', 'short'] as const
const statuses = ['draft', 'wait', 'cancel', 'done'] as const
const specKeys = ['asset', 'symbol', 'side', 'trigger', 'triggerPct', 'last', 'qty', 'qtyNum', 'lev', 'ttl', 'exchange']
const orderKeys = [...specKeys, 'id', 'sessionId', 'namespace', 'status', 'createdAt', 'placedAt', 'canceledAt', 'filledAt', 'fillPrice']
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const label = (value: unknown, max = 120): value is string => typeof value === 'string' && !!value.trim() && value.length <= max && [...value].every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
const time = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

export function validConditionalOrderSpec(value: unknown): value is ConditionalOrderPreviewSpec {
  if (!object(value)) return false
  return label(value.asset) && label(value.symbol) && sides.some(side => side === value.side)
    && (value.trigger === null || positive(value.trigger))
    && (value.triggerPct === null || typeof value.triggerPct === 'number' && Number.isFinite(value.triggerPct) && value.triggerPct > -100)
    && (value.trigger !== null || value.triggerPct !== null)
    && (value.last === null || positive(value.last))
    && ['all', 'half', 'num'].includes(String(value.qty))
    && (value.qty === 'num' ? positive(value.qtyNum) : value.qtyNum === null)
    && (value.lev === null || positive(value.lev) && Number.isSafeInteger(value.lev) && value.lev > 1)
    && ['gtc', '7d', '1d'].includes(String(value.ttl))
    && (value.exchange === null || label(value.exchange))
}

export function validConditionalOrder(value: unknown): value is ConditionalOrderPreviewOrder {
  if (!object(value)) return false
  const record: Record<string, unknown> = value
  if (!validConditionalOrderSpec(value) || Object.keys(record).some(key => !orderKeys.includes(key))
    || !label(record.id) || !label(record.sessionId) || !label(record.namespace)
    || !statuses.some(status => status === record.status) || !time(record.createdAt)) return false
  if (record.status === 'draft') return record.placedAt === undefined && record.canceledAt === undefined && record.filledAt === undefined && record.fillPrice === undefined
  if (!time(record.placedAt) || record.placedAt < record.createdAt) return false
  if (record.status === 'wait') return record.canceledAt === undefined && record.filledAt === undefined && record.fillPrice === undefined
  if (record.status === 'cancel') return time(record.canceledAt) && record.canceledAt >= record.placedAt && record.filledAt === undefined && record.fillPrice === undefined
  return time(record.filledAt) && record.filledAt >= record.placedAt && positive(record.fillPrice) && record.canceledAt === undefined
}

function copySpec(spec: ConditionalOrderPreviewSpec): ConditionalOrderPreviewSpec {
  if (!validConditionalOrderSpec(spec) || Object.keys(spec).some(key => !specKeys.includes(key))) throw new Error('예약 조건을 확인해주세요.')
  return { asset: spec.asset, symbol: spec.symbol, side: spec.side, trigger: spec.trigger, triggerPct: spec.triggerPct,
    last: spec.last, qty: spec.qty, qtyNum: spec.qtyNum, lev: spec.lev, ttl: spec.ttl, exchange: spec.exchange }
}

const actionText = { buy: '한 번 매수합니다', sell: '한 번 매도합니다', long: '한 번 롱으로 진입합니다', short: '한 번 숏으로 진입합니다' } as const
export const conditionalOrderSideText = { buy: '매수', sell: '매도', long: '롱', short: '숏' } as const
export const conditionalOrderTtlText = { gtc: '취소하기 전까지 유지', '7d': '7일 동안 유지', '1d': '하루 동안 유지' } as const
export const conditionalOrderTtlShortText = { gtc: '취소 전까지', '7d': '7일', '1d': '하루' } as const
export function conditionalOrderUsd(value: number) {
  return '$' + Math.round(value).toLocaleString('en-US')
}
export function conditionalOrderQuantity(order: ConditionalOrderPreviewSpec) {
  if (order.qty === 'num') return `${order.qtyNum} ${order.symbol}를`
  if (order.qty === 'half') return `주문 시점 보유 ${order.symbol}의 절반을`
  return order.side === 'buy' || order.side === 'long' ? '정한 금액만큼' : `주문 시점 보유 ${order.symbol} 전부를`
}
export function conditionalOrderLine(order: ConditionalOrderPreviewSpec) {
  const up = order.trigger !== null && order.last !== null ? order.trigger >= order.last
    : order.triggerPct !== null ? order.triggerPct >= 0 : order.side === 'sell' || order.side === 'short'
  const when = order.trigger !== null ? `${order.symbol}가 ${conditionalOrderUsd(order.trigger)}${up ? ' 이상이 되면' : ' 이하가 되면'}`
    : `${order.symbol}가 지금보다 ${order.triggerPct! > 0 ? '+' : ''}${order.triggerPct}% 움직이면`
  return `${when} ${order.exchange ?? '연결한 거래소'}에서 ${conditionalOrderQuantity(order)} ${order.lev ? `${order.lev}배로 ` : ''}${actionText[order.side]}`
}
export function conditionalOrderDistance(order: ConditionalOrderPreviewSpec) {
  if (order.trigger === null || order.last === null) return ''
  const distance = (order.trigger / order.last - 1) * 100
  if (!Number.isFinite(distance)) return ''
  return `지금 ${conditionalOrderUsd(order.last)}, 목표까지 ${distance >= 0 ? '+' : ''}${distance.toFixed(1)}%`
}

/** A session-scoped simulation; no timers, automatic fills, network, or real commands. */
export function createConditionalOrderPreviewStore(options: {
  namespace: string
  sessionId: string
  storage?: PreviewStorage
  now?: () => number
  makeId?: () => string
}) {
  if (!label(options.namespace) || !label(options.sessionId)) throw new Error('예약 미리보기 범위를 확인해주세요.')
  const key = `teth:mock:conditional-orders:${encodeURIComponent(options.namespace)}:${encodeURIComponent(options.sessionId)}`
  const now = options.now ?? Date.now
  let nextId = 0
  const makeId = options.makeId ?? (() => `od-${now().toString(36)}-${++nextId}`)
  const listeners = new Set<() => void>()
  let storedBytes: string | null = null
  const frozenOrders = (orders: readonly ConditionalOrderPreviewOrder[]) => Object.freeze(orders.map(order => Object.freeze({ ...order })))
  let state: ConditionalOrderPreviewState = Object.freeze({ orders: frozenOrders([]), error: null })
  function publish(orders: readonly ConditionalOrderPreviewOrder[], error: ConditionalOrderPreviewState['error']) {
    state = Object.freeze({ orders: frozenOrders(orders), error })
    for (const listener of listeners) { try { listener() } catch { /* Consumers do not change commit outcome. */ } }
  }
  if (options.storage) {
    try {
      const raw = options.storage.getItem(key)
      storedBytes = raw
      if (raw !== null) {
        const data: unknown = JSON.parse(raw)
        if (!object(data) || data.version !== 1 || data.sourceSha !== conditionalOrderSourceSha
          || data.namespace !== options.namespace || data.sessionId !== options.sessionId || !Array.isArray(data.orders)
          || data.orders.length > 200 || !data.orders.every(order => validConditionalOrder(order)
            && order.namespace === options.namespace && order.sessionId === options.sessionId && order.status !== 'done')
          || new Set(data.orders.map(order => order.id)).size !== data.orders.length) throw new Error('Invalid preview')
        state = Object.freeze({ orders: frozenOrders(data.orders), error: null })
      }
    } catch { state = Object.freeze({ orders: frozenOrders([]), error: 'corrupt' }) }
  }
  function commit(orders: readonly ConditionalOrderPreviewOrder[]) {
    if (state.error === 'corrupt') throw new Error('저장된 예약 미리보기를 확인해주세요.')
    let conflict = false
    try {
      if (options.storage && options.storage.getItem(key) !== storedBytes) {
        conflict = true
        throw new Error('Preview changed outside this store')
      }
      const bytes = JSON.stringify({ version: 1, sourceSha: conditionalOrderSourceSha,
        namespace: options.namespace, sessionId: options.sessionId, orders })
      options.storage?.setItem(key, bytes)
      if (options.storage && options.storage.getItem(key) !== bytes) throw new Error('Preview readback failed')
      storedBytes = bytes
    } catch { publish(state.orders, conflict ? 'corrupt' : 'storage'); throw new Error('예약 미리보기를 저장하지 못했어요. 저장된 상태를 확인해주세요.') }
    publish(orders, null)
  }
  function clock() { const at = now(); if (!time(at)) throw new Error('예약 시각을 확인해주세요.'); return at }
  function requireOrder(id: string, status: 'draft' | 'wait') {
    const order = state.orders.find(item => item.id === id)
    if (!order || order.status !== status) throw new Error('현재 예약 상태를 다시 확인해주세요.')
    return order
  }
  function replace(order: ConditionalOrderPreviewOrder) { commit(state.orders.map(item => item.id === order.id ? order : item)); return order }
  nextId = state.orders.length
  return {
    storageKey: key,
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    create(spec: ConditionalOrderPreviewSpec) {
      if (state.orders.length >= 200) throw new Error('예약 미리보기 목록이 가득 찼어요.')
      const fields = copySpec(spec), id = makeId(), createdAt = clock()
      if (!label(id) || state.orders.some(order => order.id === id)) throw new Error('예약 식별자를 다시 확인해주세요.')
      const order: ConditionalOrderPreviewOrder = Object.freeze({ ...fields, id, namespace: options.namespace, sessionId: options.sessionId, status: 'draft', createdAt })
      commit([...state.orders, order]); return order
    },
    updateDraft(id: string, spec: ConditionalOrderPreviewSpec) {
      const order = requireOrder(id, 'draft')
      return replace(Object.freeze({ ...order, ...copySpec(spec) }))
    },
    place(id: string) {
      const order = requireOrder(id, 'draft'), placedAt = clock()
      if (placedAt < order.createdAt) throw new Error('예약 시각을 다시 확인해주세요.')
      return replace(Object.freeze({ ...order, status: 'wait', placedAt }))
    },
    cancel(id: string) {
      const order = requireOrder(id, 'wait'), canceledAt = clock()
      if (canceledAt < order.placedAt!) throw new Error('예약 시각을 다시 확인해주세요.')
      return replace(Object.freeze({ ...order, status: 'cancel', canceledAt }))
    },
  }
}
