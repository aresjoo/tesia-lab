/** Local display destinations only. These never confer account permissions. */
export const clientSettingsTabs = ['general', 'account', 'notify', 'billing', 'usage', 'security'] as const
export type ClientSettingsTab = typeof clientSettingsTabs[number]

export function readClientSettingsLocation(hash = location.hash): ClientSettingsTab | null {
  const match = /^#\/settings(?:\/([a-z]+))?$/.exec(hash)
  if (!match) return null
  return clientSettingsTabs.find(tab => tab === match[1]) ?? 'general'
}

export function clientSettingsHash(tab: ClientSettingsTab) {
  if (!clientSettingsTabs.includes(tab)) throw new RangeError('Invalid settings destination')
  return `#/settings/${tab}`
}
