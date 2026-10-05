export type ResearchPage = 'history' | 'schedule' | 'ranking' | 'sharing' | 'brokers' | 'insight'
export type ResearchRecord<T = unknown> = {
  id: string
  title: string
  market: string
  status: '초안' | '진행 중' | '검토 필요' | '완료' | 'Paper 실행 중'
  live?: boolean
  pinned?: boolean
  /** Already-visible conversation text only. Never index pending/model-private output. */
  searchText?: string
  updatedAt: number
  snapshot: T
}

export function researchDate(timestamp: number, now = new Date()) {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return ''
  const day = (value: Date) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())
  const elapsed = (day(now) - day(date)) / 86400000
  if (elapsed === 0) return '오늘'
  if (elapsed === 1) return '어제'
  return date.getFullYear() === now.getFullYear() ? `${date.getMonth() + 1}월 ${date.getDate()}일` : `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`
}

export function searchResearch(records: ResearchRecord[], query: string) {
  const terms = query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  return records.filter(record => {
    const text = `${record.title} ${record.searchText ?? ''}`.normalize('NFKC').toLocaleLowerCase()
    return terms.every(term => text.includes(term))
  }).sort((a, b) => b.updatedAt - a.updatedAt)
}

// Read-only values captured from the original tfRankSeeds() implementation.
// These are client demo fixtures, not real trader returns or our rating engine.
export const CLIENT_RANKING = [
  { id: 'salary', nick: '월급두배', asset: '비트코인', followers: 640, score: 96, returnRate: 23.900395465537528, stop: 5, take: 8, rsi: 38 },
  { id: 'seventeen', nick: '세븐틴층', asset: '비트코인', followers: 1284, score: 82, returnRate: 14.68500011381595, stop: 5, take: 12, rsi: 44 },
  { id: 'compound', nick: '조용한복리', asset: '나스닥', followers: 377, score: 73, returnRate: 7.846113185049597, stop: 3, take: 10, rsi: 41 },
] as const
