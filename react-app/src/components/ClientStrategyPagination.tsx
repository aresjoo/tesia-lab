import { useClientPreferences } from '../client-preferences'

const labels = {
  ko: ['페이지', '이전 페이지', '다음 페이지', (page: number) => `${page}페이지`],
  en: ['Pages', 'Previous page', 'Next page', (page: number) => `Page ${page}`],
  ja: ['ページ', '前のページ', '次のページ', (page: number) => `${page}ページ`],
  'zh-CN': ['分页', '上一页', '下一页', (page: number) => `第${page}页`],
  'zh-TW': ['分頁', '上一頁', '下一頁', (page: number) => `第${page}頁`],
  es: ['Páginas', 'Página anterior', 'Página siguiente', (page: number) => `Página ${page}`],
  fr: ['Pages', 'Page précédente', 'Page suivante', (page: number) => `Page ${page}`],
} as const

export function ClientStrategyPagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  const { language } = useClientPreferences(), [label, previous, next, pageLabel] = labels[language]
  if (pages <= 1) return null
  return <nav className="mk-pager" aria-label={label}>
    <button type="button" className="mk-pg nav" aria-label={previous} disabled={page <= 1} onClick={() => onChange(page - 1)}>‹</button>
    {Array.from({ length: pages }, (_, index) => index + 1).map(value => <button key={value} type="button" className="mk-pg" aria-label={pageLabel(value)} aria-current={value === page ? 'page' : undefined} onClick={() => onChange(value)}>{value}</button>)}
    <button type="button" className="mk-pg nav" aria-label={next} disabled={page >= pages} onClick={() => onChange(page + 1)}>›</button>
  </nav>
}
