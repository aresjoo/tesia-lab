import { useId, type ReactNode } from 'react'
import type { ResearchRecord } from '../research-library'
import { useClientPreferences } from '../client-preferences'
import { useConversationCopy } from '../client-conversation-copy'
import { shellText } from '../client-shell-copy'
import { ClientResearchRow } from './ClientResearchRow'
import '../client-sidebar-records.css'

export type ClientSidebarRecordsProps = {
  records: readonly ResearchRecord[]
  activeResearchId?: string
  active: boolean
  preview?: boolean
  onSelect: (id: string) => void | Promise<void>
  onPin?: (id: string) => void | Promise<void>
  onRename?: (id: string, title: string) => void | Promise<void>
  onDelete?: (id: string) => void | Promise<void>
  unavailable?: ReactNode
  footer?: ReactNode
  archiveLabel?: string
  archiveDetail?: string
  errorLabel?: string
}

/** Source 501053b gSideRender groups. A live flag alone is never execution evidence. */
export function ClientSidebarRecords({ records, activeResearchId, active, preview = false, onSelect, onPin, onRename, onDelete, unavailable, footer, archiveLabel, archiveDetail, errorLabel }: ClientSidebarRecordsProps) {
  const { language } = useClientPreferences()
  const { statusLabel } = useConversationCopy()
  const id = useId()
  // Source gSideRender partitions pinned records first, preserving session order
  // within both groups. Renaming a record must not move it by updatedAt.
  const nonLive = records.filter(record => !record.live)
  const recent = nonLive.filter(record => record.pinned === true).concat(nonLive.filter(record => record.pinned !== true))
  const live = records.filter(record => record.live)
  const row = (record: ResearchRecord, statusBadge?: string) => <ClientResearchRow key={record.id} record={record}
    archiveLabel={archiveLabel} archiveDetail={archiveDetail} errorLabel={errorLabel}
    active={active && activeResearchId === record.id} statusBadge={statusBadge}
    onSelect={() => onSelect(record.id)}
    onPin={onPin ? () => onPin(record.id) : undefined}
    onRename={onRename ? title => onRename(record.id, title) : undefined}
    onDelete={onDelete ? () => onDelete(record.id) : undefined} />

  return <div className="client-sidebar-records" data-preview={preview ? 'true' : undefined}>
    <section className="client-sidebar-record-group" aria-labelledby={`${id}-recent`} data-sidebar-group="recent">
      <h2 className="client-sidebar-record-heading" id={`${id}-recent`}>{shellText(language, 'recent')}</h2>
      {unavailable || (recent.length ? <ul className="client-research-list" aria-label={shellText(language, 'researchList')}>{recent.map(record => row(record))}</ul>
        : <p className="client-sidebar-record-empty">{shellText(language, 'recentEmpty')}</p>)}
      {footer}
    </section>
    {live.length > 0 && <section className="client-sidebar-record-group" aria-labelledby={`${id}-live`} data-sidebar-group="live">
      <h2 className="client-sidebar-record-heading" id={`${id}-live`}>Live</h2>
      <ul className="client-research-list" aria-label={shellText(language, 'liveList')}>{live.map(record => row(record, preview ? 'Paper' : statusLabel(record.status)))}</ul>
    </section>}
  </div>
}
