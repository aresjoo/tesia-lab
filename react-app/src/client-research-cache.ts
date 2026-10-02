// Presentation-only document state. Never pass credentials or execution data.
// Memory lasts for this page lifetime, not a reload, new tab, or another device.
const documents = new Map<string, string>()
const key = (id: string) => `teth-client-research-documents:${id}`

export function readResearchDocumentCache(id: string): unknown {
  const raw = documents.get(id) ?? sessionStorage.getItem(key(id))
  return raw ? JSON.parse(raw) : null
}

export function writeResearchDocumentCache(id: string, value: unknown): boolean {
  try {
    const raw = JSON.stringify(value)
    documents.set(id, raw)
    sessionStorage.setItem(key(id), raw)
    return true
  } catch { return false }
}

export function forgetResearchDocumentMemory(id: string) {
  documents.delete(id)
}
