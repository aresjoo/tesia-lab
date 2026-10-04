import type { ReactNode } from 'react'

// Paths from aresjoo/tesia-lab acccc7f. Decorative SVGs inherit button color.
const icons = {
  document: <><path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v5h5" /></>,
  new: <><path d="M12 3a9 9 0 1 0 9 9" /><path d="M17.8 2.8l3.4 3.4L13 14.4l-4 .6.6-4z" /></>,
  // Frozen source 9fbff821, sidebar history/connection navigation.
  history: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  brokers: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>,
  insight: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
  schedule: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9.5h16M8 3v4M16 3v4" /></>,
  trading: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M7 15l3-4 2.5 2.5L17 9" /></>,
  ranking: <><path d="M8 21h8M12 17v4M5 4h14v4a7 7 0 0 1-14 0z" /><path d="M5 6H3v2a4 4 0 0 0 3 3.9M19 6h2v2a4 4 0 0 1-3 3.9" /></>,
  sharing: <><circle cx="6" cy="12" r="2.5" /><circle cx="17" cy="6" r="2.5" /><circle cx="17" cy="18" r="2.5" /><path d="M8.3 10.8l6.4-3.6M8.3 13.2l6.4 3.6" /></>,
  // Source 501053b sidebar “전략들”, index.html:4238.
  strategies: <><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8-.7-.7-2-.8-3-.2z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 21.5 2c0 2.7-.9 7.5-6 10.6a22.4 22.4 0 0 1-3.5 2.4z" /><path d="M9 12H4s.5-3.6 2-5c1.6-1.5 5 0 5 0" /><path d="M12 15v5s3.6-.5 5-2c1.5-1.6 0-5 0-5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M5 20h14" /></>,
  open: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9.5 4v16M13.5 9.5l2.5 2.5-2.5 2.5" /></>,
  close: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9.5 4v16M16 9.5L13.5 12l2.5 2.5" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3H9.8L9.4 5.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></>,
  profile: <><circle cx="12" cy="12" r="9.2" /><circle cx="12" cy="9.6" r="3" /><path d="M6.4 18.4c1.2-2.6 3.2-3.9 5.6-3.9s4.4 1.3 5.6 3.9" /></>,
} satisfies Record<string, ReactNode>

export function ClientIcon({ name, size = 16, className }: { name: keyof typeof icons; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'profile' ? 1.5 : name === 'open' || name === 'close' || name === 'history' ? 1.7 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{icons[name]}</svg>
}
