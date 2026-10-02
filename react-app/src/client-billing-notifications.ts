import type { ClientLanguage } from './client-preferences'
import type { BillingPreviewStoredNotification } from './client-billing-preview-store'
import { BILLING_COPY, billingText, type BillingCopyKey } from './client-billing-copy'
import type { SourceAccountEventState, SourceAccountNotification } from './client-account-event-state'

/** Source-preview notification projection, never a server notification decoder. */
export function withBillingPreviewNotifications(account: SourceAccountEventState, notifications: readonly BillingPreviewStoredNotification[], language: ClientLanguage): SourceAccountEventState {
  const projected: SourceAccountNotification[] = notifications.flatMap(record => {
    const { intent } = record
    if (!Object.hasOwn(BILLING_COPY[language], intent.titleKey) || !Object.hasOwn(BILLING_COPY[language], intent.bodyKey)) return []
    return [{ id: record.id, at: record.at, read: record.read, key: intent.key, type: 'bill' as const, link: intent.link,
      title: billingText(language, intent.titleKey as BillingCopyKey), body: billingText(language, intent.bodyKey as BillingCopyKey) }]
  })
  return { ...account, notifs: [...projected, ...account.notifs].sort((a, b) => b.at - a.at) }
}
