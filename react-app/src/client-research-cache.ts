// Presentation-only document state. Never pass credentials or execution data.
// Memory lasts for this page lifetime, not a reload, new tab, or another device.
type DocumentEntry = { raw?: string }
const documents = new Map<string, DocumentEntry>()
const key = (id: string) => `teth-client-research-documents:${id}`

export function readResearchDocumentCache(id: string): unknown {
  const raw = documents.get(id)?.raw ?? sessionStorage.getItem(key(id))
  return raw ? JSON.parse(raw) : null
}

export function writeResearchDocumentCache(id: string, value: unknown): boolean {
  return createResearchDocumentWriter(id)(value)
}

/** A mounted document may save on pagehide/unmount, but not after deletion.
 * Entry identity also rejects an old writer if the same id is later reopened;
 * deleting the entry retains no tombstone or per-deleted-session allocation. */
export function createResearchDocumentWriter(id: string): (value: unknown) => boolean {
  const entry = documents.get(id) ?? {}
  documents.set(id, entry)
  return value => {
    if (documents.get(id) !== entry) return false
    try {
      const raw = JSON.stringify(value)
      entry.raw = raw
      sessionStorage.setItem(key(id), raw)
      return true
    } catch { return false }
  }
}

export function forgetResearchDocumentMemory(id: string) {
  documents.delete(id)
}
