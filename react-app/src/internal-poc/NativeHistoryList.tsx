import { useId } from 'react'
import { useClientPreferences } from '../client-preferences'
import { nativeJobText, type NativeJobTextKey } from './native-job-copy'
import type { ApiV080NativeConversationHistoryNativeConversationHistoryRow } from './contracts/generated/api-v0.8/types'
import { describeNativeJob } from './native-job-presentation'
import '../client-source-shell.css'
import './native-history-list.css'

type HistoryRow = ApiV080NativeConversationHistoryNativeConversationHistoryRow
export type NativeHistoryListProps = {
  rows: readonly HistoryRow[]
  selectedRow?: { strategyVersionId: string; backtestId: string | null }
  getSelectionDisabled: (row: HistoryRow) => boolean
  getSelectionNotice: (row: HistoryRow) => string | undefined
  onSelect: (row: HistoryRow) => void
}

/** Source g-hist list, scoped to the supplied current-conversation history page.
 * No history search, fabricated title/return, polling or execution authority.
 * Selection and its owner/snapshot/approval guards remain caller-owned.
 */
export function NativeHistoryList({ rows, selectedRow, getSelectionDisabled, getSelectionNotice, onSelect }: NativeHistoryListProps) {
  const id = useId()
  const { language } = useClientPreferences()
  const text = (key: NativeJobTextKey) => nativeJobText(language, key)
  if (rows.length === 0) return <p>{text('historyEmpty')}</p>
  return <ul className="g-hist-list native-history-list" aria-label={text('historyListAriaLabel')}>
    {rows.map((row, index) => {
      const backtestId = row.job?.backtestId ?? null
      const selected = selectedRow?.strategyVersionId === row.approval.strategyVersionId && selectedRow.backtestId === backtestId
      const disabled = getSelectionDisabled(row)
      const notice = getSelectionNotice(row)
      const titleId = `${id}-${index}-summary`
      const metaId = `${id}-${index}-metadata`
      const noticeId = `${id}-${index}-notice`
      const action = text(row.job ? 'historyViewJobAction' : 'historySelectApprovalAction')
      return <li key={JSON.stringify([row.approval.strategyVersionId, backtestId])} className="native-history-item">
        <button type="button" className="g-hist-row" aria-label={action}
          aria-describedby={`${titleId} ${metaId}${notice ? ` ${noticeId}` : ''}`} aria-current={selected ? 'true' : undefined}
          aria-disabled={disabled} onClick={() => { if (!disabled) onSelect(row) }}>
          <span className="t" id={titleId}>
            <span className="native-history-title">{nativeJobText(language, 'historyApprovedDraftTitle', { revision: row.approval.sourceDraftRevision })}</span>
            <span className="native-history-state">{row.job ? describeNativeJob(row.job, language).label : text('historyNotRunState')}</span>
            <span className="native-history-id">{text('historyStrategyVersionIdLabel')} {row.approval.strategyVersionId}</span>
            {row.job && <span className="native-history-id">{text('historyJobIdLabel')} {row.job.backtestId}</span>}
          </span>
          <span className="native-history-meta" id={metaId}>
            <span className="native-history-time-label">{text('historyApprovedAtLabel')}</span>
            <time className="d" dateTime={row.approval.issuedAt}>{row.approval.issuedAt.replace('T', ' ').replace('Z', ' UTC')}</time>
            <span className="native-history-action">{action}</span>
            {selected && <span className="native-history-selected">{text('historySelectedBadge')}</span>}
          </span>
        </button>
        {notice && <p className="native-history-notice" id={noticeId}>{notice}</p>}
      </li>
    })}
  </ul>
}
