/** Source 501053b tfReportView/upFor. Presentation deduplication only;
 * neither a validation receipt nor connection/payment authority. */
export function reportUpgradeFingerprint(value: { ret: number; n: number; score: number }): string | null {
  if (!Number.isFinite(value.ret) || !Number.isSafeInteger(value.n) || value.n < 0
    || !Number.isInteger(value.score) || value.score < 0 || value.score > 100) return null
  return String(value.ret) + '|' + value.n + '|' + value.score
}

function validFingerprint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 160) return false
  const parts = value.split('|')
  if (parts.length !== 3 || parts.some(part => part.length === 0)) return false
  return reportUpgradeFingerprint({ ret: Number(parts[0]), n: Number(parts[1]), score: Number(parts[2]) }) === value
}

export function createClientReportUpgradeStore(owner: string | null, storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  const validOwner = owner === null || typeof owner === 'string' && owner.length > 0 && owner.length <= 320
    && owner.trim() === owner && !Array.from(owner).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  let key: string | null = null
  try { if (validOwner) key = `teth-client-report-upgrade:${owner === null ? 'guest' : `account:${encodeURIComponent(owner)}`}` }
  catch { /* Malformed Unicode owner cannot identify a storage namespace. */ }
  let current: string | null = null
  let persisted = false
  let writable = validOwner
  let target: Pick<Storage, 'getItem' | 'setItem'> | undefined
  if (key) {
    try {
      target = storage ?? sessionStorage
      const raw = target.getItem(key)
      if (raw !== null) {
        const decoded: unknown = JSON.parse(raw)
        if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)
          || !('fingerprint' in decoded) || !validFingerprint(decoded.fingerprint)) writable = false
        else { current = decoded.fingerprint; persisted = true }
      }
    } catch { writable = false }
  }
  return {
    read: (): string | null => current,
    claim: (fingerprint: string): { reserved: boolean; persisted: boolean } => {
      if (!key || !validFingerprint(fingerprint)) return { reserved: false, persisted: false }
      if (current === fingerprint) return { reserved: false, persisted }
      // Reserve before display, even if navigation cancels the later timer.
      // A single last value preserves source A -> B -> A behavior.
      current = fingerprint; persisted = false
      if (writable && target) {
        try { target.setItem(key, JSON.stringify({ fingerprint })); persisted = true }
        catch { /* Same-page dedup survives; existing bytes are not removed. */ }
      }
      return { reserved: true, persisted }
    },
  }
}

export type ClientReportUpgradeConfig = {
  owner: string | null
  store: ReturnType<typeof createClientReportUpgradeStore>
  enabled: boolean
}
