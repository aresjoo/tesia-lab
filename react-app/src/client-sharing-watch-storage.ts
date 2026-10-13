import type { ClientLanguage } from './client-preferences'

type StorageReader = Pick<Storage, 'getItem'>
export type WatchStorageRead = { records: string[]; error: boolean }

export function readSharingWatches(key: string, storage: () => StorageReader = () => sessionStorage): WatchStorageRead {
  try {
    const raw = storage().getItem(key)
    if (raw === null) return { records: [], error: false }
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value) || value.length > 1000 || !value.every((id): id is string => typeof id === 'string')) return { records: [], error: true }
    return { records: value, error: false }
  } catch { return { records: [], error: true } }
}

const copy = {
  ko: ['관심 전략을 읽지 못했어요.', '다시 시도'],
  en: ['Could not read your favorite strategies.', 'Retry'],
  ja: ['お気に入りの戦略を読み込めませんでした。', '再試行'],
  'zh-CN': ['无法读取收藏的策略。', '重试'],
  'zh-TW': ['無法讀取收藏的策略。', '重試'],
  es: ['No se pudieron leer tus estrategias favoritas.', 'Reintentar'],
  fr: ['Impossible de lire vos stratégies favorites.', 'Réessayer'],
} as const
export function sharingWatchStorageCopy(language: ClientLanguage) { return { error: copy[language][0], retry: copy[language][1] } }
