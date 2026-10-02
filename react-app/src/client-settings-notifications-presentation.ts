import type { AccountPlanPresentation } from './client-account-presentation'
export const clientNotificationTopics = ['fill', 'state', 'risk', 'copy', 'bill', 'news'] as const
export type ClientNotificationTopic = typeof clientNotificationTopics[number]
export type ClientNotificationChannel = 'push' | 'email'
export type ClientNotificationGroups = AccountPlanPresentation['preferences']
export type ClientNotificationRow = NonNullable<ClientNotificationGroups>[number]['rows'][number]
export type ClientNotificationRequest = (rowId: string, checked: boolean, signal: AbortSignal) => Promise<void>
/** Only explicitly marked observations enter the source's six two-channel rows.
 * Unmarked supplied groups retain their facts and legacy actions. */
export function readClientNotificationPreferences(groups: ClientNotificationGroups | undefined) {
  const topics = clientNotificationTopics.map(topic => ({ topic, push: null as ClientNotificationRow | null, email: null as ClientNotificationRow | null }))
  const legacyGroups: NonNullable<ClientNotificationGroups>[number][] = []
  const ids = new Map<string, number>()
  for (const group of groups ?? []) for (const row of group.rows) ids.set(row.id, (ids.get(row.id) ?? 0) + 1)
  let invalid = false, observed = false
  for (const group of groups ?? []) {
    const unmarked: ClientNotificationRow[] = []
    for (const row of group.rows) {
      if (!Object.hasOwn(row, 'sourceNotification')) { unmarked.push(row); continue }
      observed = true
      const marker = row.sourceNotification
      if (!marker || typeof marker !== 'object' || Array.isArray(marker) || Object.keys(marker).some(key => key !== 'topic' && key !== 'channel')
        || !clientNotificationTopics.includes(marker.topic) || !['push', 'email'].includes(marker.channel)
        || typeof row.id !== 'string' || !row.id || row.id.length > 320 || row.id.trim() !== row.id
        || [...row.id].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
        || ids.get(row.id) !== 1 || row.checked !== null && typeof row.checked !== 'boolean') { invalid = true; continue }
      const target = topics.find(item => item.topic === marker.topic)!
      if (target[marker.channel] !== null) { invalid = true; continue }
      target[marker.channel] = row
    }
    if (unmarked.length) legacyGroups.push({ ...group, rows: unmarked })
  }
  if (invalid) for (const topic of topics) { topic.push = null; topic.email = null }
  return { topics, legacyGroups, invalid, observed }
}
