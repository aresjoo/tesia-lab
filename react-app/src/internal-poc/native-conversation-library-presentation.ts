import type { ResearchRecord } from '../research-library'

/** UI input, not an HTTP contract. The controller owns paging, authorization,
 * transcript restoration and durable metadata. Never read preview storage here. */
export type ConversationLibraryPresentation = {
  scope: string
  status: 'unavailable' | 'loading' | 'ready' | 'error'
  records: readonly ResearchRecord[]
  activeId?: string
  hasMore?: boolean
  pending?: boolean
  onLoad?: () => void | Promise<void>
  onLoadMore?: () => void | Promise<void>
  /** Resolve only after the controller has accepted/restored the transcript. */
  onSelect: (id: string) => void | Promise<void>
  onPin?: (id: string) => void | Promise<void>
  onRename?: (id: string, title: string) => void | Promise<void>
  /** Archive only; must not cancel jobs or delete a strategy/trade. */
  onArchive?: (id: string) => void | Promise<void>
}
