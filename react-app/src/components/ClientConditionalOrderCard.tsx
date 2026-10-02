import { useId, useLayoutEffect, useRef, useState } from 'react'
import { conditionalOrderDistance, conditionalOrderLine, conditionalOrderSideText, conditionalOrderTtlShortText, conditionalOrderTtlText,
  conditionalOrderUsd, validConditionalOrder, type ConditionalOrderPreviewOrder } from '../client-conditional-order-preview'
import '../client-conditional-order.css'

export type ConditionalOrderActions = {
  onPlace?: (id: string) => unknown
  onCancel?: (id: string) => unknown
  onEdit?: (id: string) => unknown
  onTerminal?: (id: string) => unknown
}
type Props = ConditionalOrderActions & { order: ConditionalOrderPreviewOrder; source?: 'mock' | 'service'; binding?: string }

/** Controlled display: a callback's completion never creates a fill or changes status. */
function useOrderAction(order: ConditionalOrderPreviewOrder, binding: string, callbacks: ConditionalOrderActions) {
  const [operation, setOperation] = useState({ identity: '', pending: false, error: '' })
  const generation = useRef(0), active = useRef(false)
  const identity = JSON.stringify([binding, order, Boolean(callbacks.onPlace), Boolean(callbacks.onCancel), Boolean(callbacks.onEdit), Boolean(callbacks.onTerminal)])
  useLayoutEffect(() => {
    generation.current++; active.current = false
    const epoch = generation.current
    return () => { generation.current = epoch + 1; active.current = false }
  }, [identity])
  const run = async (callback: ConditionalOrderActions[keyof ConditionalOrderActions]) => {
    if (!callback || active.current) return
    active.current = true
    const epoch = generation.current
    setOperation({ identity, pending: true, error: '' })
    try { await callback(order.id) }
    catch { if (generation.current === epoch) setOperation({ identity, pending: true, error: '요청을 완료하지 못했어요. 다시 시도해주세요.' }) }
    finally { if (generation.current === epoch) { active.current = false; setOperation(previous => ({ ...previous, pending: false })) } }
  }
  return { pending: operation.identity === identity && operation.pending, error: operation.identity === identity ? operation.error : '', run }
}

export function ClientConditionalOrderCard({ order, source = 'mock', binding = '', ...actions }: Props) {
  const noticeId = useId(), { pending, error, run } = useOrderAction(order, `${source}:${binding}`, actions)
  if (!validConditionalOrder(order)) return <p role="alert">예약 조건을 확인해주세요.</p>
  const status = { draft: '', wait: '조건 대기', cancel: '취소됨', done: '체결 완료' }[order.status]
  const distance = conditionalOrderDistance(order)
  const missing = order.status === 'draft' ? !actions.onPlace : order.status === 'wait' ? !actions.onCancel : false
  return <section className={`tf-sum od-card client-conditional-order ${order.status}`} data-order-id={order.id} data-source={source} aria-label="예약 주문" aria-busy={pending}>
    {status && <div className="od-st" role="status"><i aria-hidden="true" />{status}</div>}
    <p className="od-line">{conditionalOrderLine(order)}.</p>
    <p className="od-sub">{distance && <>{distance} <b aria-hidden="true">|</b> </>}{conditionalOrderTtlText[order.ttl]}
      {order.status === 'done' && order.filledAt !== undefined && <> <b aria-hidden="true">|</b> {new Date(order.filledAt).toLocaleDateString('ko-KR', { timeZone: 'UTC' })}</>}</p>
    {order.status === 'draft' && <div className="od-acts">
      <button type="button" className="tf-btn p" disabled={pending || !actions.onPlace} aria-describedby={missing ? noticeId : undefined} onClick={() => { void run(actions.onPlace) }}>예약하기</button>
      <button type="button" className="od-lk" disabled={pending || !actions.onEdit} onClick={() => { void run(actions.onEdit) }}>조건 바꾸기</button>
    </div>}
    {order.status === 'wait' && <div className="od-acts">
      <button type="button" className="od-lk" disabled={pending || !actions.onCancel} aria-describedby={missing ? noticeId : undefined} onClick={() => { void run(actions.onCancel) }}>예약 취소</button>
      <button type="button" className="od-lk" disabled={pending || !actions.onTerminal} onClick={() => { void run(actions.onTerminal) }}>터미널에서 보기</button>
    </div>}
    {missing && <p id={noticeId} className="od-unavailable">{source === 'service' ? '예약 주문 연결이 아직 제공되지 않았어요.' : '예약 미리보기 동작이 아직 연결되지 않았어요.'}</p>}
    {error && <p className="od-error" role="alert">{error}</p>}
  </section>
}

function PendingRow({ order, source = 'mock', binding = '', ...actions }: Props) {
  const { pending, error, run } = useOrderAction(order, `${source}:${binding}`, actions)
  return <tr className="od-row client-conditional-order-row" data-order-id={order.id} data-source={source}>
    <td>{order.exchange ?? '—'}</td><td>예약 주문</td><td className="num">{order.symbol}</td>
    <td><span className="od-tag">{conditionalOrderSideText[order.side]}{order.lev ? ` ${order.lev}배` : ''}</span></td><td>조건 주문</td>
    <td className="r num">{order.trigger !== null ? conditionalOrderUsd(order.trigger) : `${order.triggerPct}%`}</td>
    <td className="r num">{order.qty === 'num' ? order.qtyNum : order.qty === 'half' ? '절반' : '전부'}</td>
    <td>조건 대기, {conditionalOrderTtlShortText[order.ttl]}</td><td className="r">
      <button type="button" className="od-cancel" disabled={pending || !actions.onCancel} onClick={() => { void run(actions.onCancel) }}>취소</button>
      {!actions.onCancel && <span className="od-unavailable">예약 취소 연결이 아직 제공되지 않았어요.</span>}
      {error && <span className="od-error" role="alert">{error}</span>}
    </td>
  </tr>
}

/** Insert inside the host's pending-order tbody; all rows retain the chat's ID. */
export function ClientConditionalOrderPendingRows({ orders, ...props }: ConditionalOrderActions & {
  orders: readonly ConditionalOrderPreviewOrder[]; source?: 'mock' | 'service'; binding?: string
}) {
  const valid = orders.filter(order => validConditionalOrder(order) && order.status === 'wait')
  const ids = new Set<string>()
  return <>{valid.filter(order => { if (ids.has(order.id)) return false; ids.add(order.id); return true }).map(order => <PendingRow key={JSON.stringify([order.namespace, order.sessionId, order.id])} order={order} {...props} />)}</>
}
