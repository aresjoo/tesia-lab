import { useClientPreferences, type ClientLanguage } from './client-preferences'

import { conversationCopy } from "./client-conversation-copy-data"
export { conversationCopy } from "./client-conversation-copy-data"

const languageColumn = { ko: 0, en: 1, ja: 2, "zh-CN": 3, "zh-TW": 4, es: 5, fr: 6 } as const satisfies Record<ClientLanguage, number>
export type ConversationCopyKey = keyof typeof conversationCopy
export function getConversationCopy(language: ClientLanguage, key: ConversationCopyKey): string {
  return conversationCopy[key][languageColumn[language]]
}
const statusKeys: Record<string, ConversationCopyKey> = {
  '초안': 'draft', '진행 중': 'inProgress', '검토 필요': 'reviewNeeded', '완료': 'done',
  'Paper 실행 중': 'paperRunning', '작업 중': 'working', '대기': 'pending',
}
export function useConversationCopy() {
  const { language } = useClientPreferences()
  return {
    language,
    c: (key: ConversationCopyKey) => getConversationCopy(language, key),
    statusLabel: (status: string) => Object.hasOwn(statusKeys, status) ? getConversationCopy(language, statusKeys[status]) : status,
  }
}
