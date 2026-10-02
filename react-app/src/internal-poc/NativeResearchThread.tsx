import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { NativeResearchThreadEntry } from './native-research-workspace-model'
import { NativeResearchThreadContext } from './NativeResearchThreadContext'

type LocalEntry = { kind: 'whatif'; id: number; lifetime: object; content: ReactNode }
type Entry = { kind: 'message'; id: string } | LocalEntry
type Timeline = { ids: readonly string[]; entries: readonly Entry[] }

/** Document-local presentation order, not a server clock or persistence contract.
 * New supplied message IDs append in producer order. Updates keep their position
 * and keyed DOM; removed IDs disappear. A successful what-if appends when observed.
 * Owner/document lifetime belongs to the keyed workspace/article, while retiring
 * a typed document revision removes only results registered by that instance.
 */
export function NativeResearchThread({ documentId, entries = [], legacy, children, onWhatIfActivity }: {
  documentId: string; entries?: readonly NativeResearchThreadEntry[]; legacy?: ReactNode; children: ReactNode
  onWhatIfActivity?: (documentId: string, eventId: string, present: boolean) => void
}) {
  const ids = entries.map(entry => entry.id)
  const [timeline, setTimeline] = useState<Timeline>(() => ({ ids, entries: ids.map(id => ({ kind: 'message', id })) }))
  let ordered = timeline.entries
  if (ids.length !== timeline.ids.length || ids.some((id, index) => id !== timeline.ids[index])) {
    const supplied = new Set(ids), previous = new Set(timeline.ids)
    ordered = [...timeline.entries.filter(entry => entry.kind !== 'message' || supplied.has(entry.id)),
      ...ids.filter(id => !previous.has(id)).map(id => ({ kind: 'message' as const, id }))]
    // Reconcile before committing children so new messages are observed before
    // subsequent success callbacks. Content-only updates never touch this order.
    setTimeline({ ids, entries: ordered })
  }
  const sequence = useRef(0)
  const append = useCallback((lifetime: object, content: ReactNode) => {
    const entry: LocalEntry = { kind: 'whatif', id: ++sequence.current, lifetime, content }
    setTimeline(current => ({ ...current, entries: [...current.entries, entry] }))
  }, [])
  const discard = useCallback((lifetime: object) => {
    setTimeline(current => {
      const retained = current.entries.filter(entry => entry.kind !== 'whatif' || entry.lifetime !== lifetime)
      return retained.length === current.entries.length ? current : { ...current, entries: retained }
    })
  }, [])
  const port = useMemo(() => ({ append, discard }), [append, discard])
  const reported = useRef(new Set<string>())
  useLayoutEffect(() => {
    const current = new Set(ordered.filter(entry => entry.kind === 'whatif').map(entry => JSON.stringify(['whatif', documentId, entry.id])))
    for (const id of reported.current) if (!current.has(id)) onWhatIfActivity?.(documentId, id, false)
    for (const id of current) if (!reported.current.has(id)) onWhatIfActivity?.(documentId, id, true)
    reported.current = current
  }, [documentId, onWhatIfActivity, ordered])
  const content = new Map(entries.map(entry => [entry.id, entry.content]))
  return <NativeResearchThreadContext.Provider value={port}>
    {children}
    <div className="rw-thread native-research-thread client-lab-conversation" data-document-id={documentId}>
      {ordered.map(entry => <Fragment key={JSON.stringify([entry.kind, entry.id])}>{entry.kind === 'message' ? content.get(entry.id) : entry.content}</Fragment>)}
      {legacy}
    </div>
  </NativeResearchThreadContext.Provider>
}
