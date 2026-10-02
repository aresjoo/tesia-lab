import { Component, createRef, type ReactNode } from 'react'

type Batch = { top: number; delta: number; remaining: number }
const batches = new WeakMap<HTMLElement, Batch>()
type Snapshot = { scroll: HTMLElement; height: number; batch: Batch } | null
/** Capture before React inserts/removes the late scenario, as the source
 * taiForecast does. The conversation still owns follow/unread/focus policy. */
export class ClientScenarioScrollAnchor extends Component<{ children: ReactNode }, Record<string, never>, Snapshot> {
  private node = createRef<HTMLDivElement>()
  getSnapshotBeforeUpdate(): Snapshot {
    const node = this.node.current, scroll = node?.closest<HTMLElement>('.g-scroll,.rw-scroll')
    if (!node || !scroll || !scroll.clientHeight || !node.getClientRects().length || scroll.scrollTop <= 0) return null
    if (node.getBoundingClientRect().top >= scroll.getBoundingClientRect().top + scroll.clientHeight * .5) return null
    // React snapshots all updating siblings before their layout callbacks.
    // Share one baseline so multiple cards do not overwrite each other's delta.
    const batch = batches.get(scroll) ?? { top: scroll.scrollTop, delta: 0, remaining: 0 }
    batch.remaining += 1
    batches.set(scroll, batch)
    return { scroll, height: node.getBoundingClientRect().height, batch }
  }
  componentDidUpdate(_previous: { children: ReactNode }, _state: Record<string, never>, snapshot: Snapshot) {
    if (!snapshot) return
    const { scroll, batch } = snapshot
    if (this.node.current && scroll.isConnected) batch.delta += this.node.current.getBoundingClientRect().height - snapshot.height
    batch.remaining -= 1
    if (batch.remaining === 0) {
      batches.delete(scroll)
      if (batch.delta && scroll.isConnected) scroll.scrollTop = batch.top + batch.delta
    }
  }
  render() { return <div ref={this.node} className="market-scenario-slot">{this.props.children}</div> }
}
