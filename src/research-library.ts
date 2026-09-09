export type ResearchPage = 'history' | 'schedule' | 'ranking' | 'sharing'
export type ResearchRecord<T = unknown> = {
  id: string
  title: string
  market: string
  status: '초안' | '진행 중' | '검토 필요' | '완료' | 'Paper 실행 중'
  live?: boolean
  updatedAt: number
  snapshot: T
}

export const RESEARCH_PAGES: { id: ResearchPage; label: string }[] = [
  { id: 'history', label: '연구 기록' }, { id: 'schedule', label: '예약된 검증' },
  { id: 'ranking', label: '랭킹' }, { id: 'sharing', label: '전략 공유' },
]
const STORAGE_KEY = 'teth-research-library'

export function readResearchRecords<T>(validate: (value: unknown) => value is T): ResearchRecord<T>[] {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((entry): entry is ResearchRecord<T> => entry && typeof entry.id === 'string' && entry.id.length <= 80
      && typeof entry.title === 'string' && entry.title.length <= 500 && typeof entry.market === 'string'
      && ['초안', '검토 필요', '완료'].includes(entry.status) && Number.isFinite(entry.updatedAt) && validate(entry.snapshot))
  } catch { return [] }
}

export function writeResearchRecords(records: ResearchRecord[]) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(records)); return true }
  catch { return false }
}

/** One tab-local store. React subscribes to it instead of mirroring effect state. */
export function createResearchStore<T>(validate: (value: unknown) => value is T) {
  let state = { records: readResearchRecords(validate), persistenceError: false }
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    upsert: (record: ResearchRecord<T>) => {
      const records = [record, ...state.records.filter(item => item.id !== record.id)]
      state = { records, persistenceError: !writeResearchRecords(records) }
      listeners.forEach(listener => listener())
    },
  }
}

// Read-only values captured from the original tfRankSeeds() implementation.
// These are client demo fixtures, not real trader returns or our rating engine.
export const CLIENT_RANKING = [
  { id: 'salary', nick: '월급두배', asset: '비트코인', followers: 640, score: 96, returnRate: 23.900395465537528, stop: 5, take: 8, rsi: 38 },
  { id: 'seventeen', nick: '세븐틴층', asset: '비트코인', followers: 1284, score: 82, returnRate: 14.68500011381595, stop: 5, take: 12, rsi: 44 },
  { id: 'compound', nick: '조용한복리', asset: '나스닥', followers: 377, score: 73, returnRate: 7.846113185049597, stop: 3, take: 10, rsi: 41 },
] as const
