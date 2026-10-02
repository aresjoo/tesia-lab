import '../client-account-bell.css'

/** Source nf-util: inbox navigation, not a fabricated live-event producer. */
export function ClientAccountBell({ unread, onOpen, ariaLabel }: { unread: number | null; onOpen: () => void; ariaLabel?: string }) {
  const count = unread !== null && Number.isSafeInteger(unread) && unread > 0 ? unread : 0
  return <button type="button" className="client-account-bell" aria-label={ariaLabel ?? (count ? `알림, ${count}개 안읽음` : '알림')} onClick={onOpen}>
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
    {count > 0 && <span className="bd" aria-hidden="true">{count > 9 ? '9+' : count}</span>}
  </button>
}
