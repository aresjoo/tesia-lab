/** Display routes only; never session IDs or API authority. */
export type ClientInsightLocation = { slug?: string; tag?: string }
/** Only explicit UI admission messages may be displayed by the question dialog. */
export class ClientInsightQuestionError extends Error {}
export function readClientInsightLocation(hash = window.location.hash): ClientInsightLocation | null {
  if (!/^#\/insight(?:\/|$)/.test(hash)) return null
  const path = hash.slice('#/insight'.length).replace(/^\//, '')
  if (!path) return {}
  try {
    if (path.startsWith('t/')) return { tag: decodeURIComponent(path.slice(2)).slice(0, 200) }
    return { slug: decodeURIComponent(path).slice(0, 200) }
  } catch { return { slug: 'invalid-route' } }
}
export function clientInsightHash(location: ClientInsightLocation) {
  return `#/insight${location.slug ? `/${encodeURIComponent(location.slug)}` : location.tag ? `/t/${encodeURIComponent(location.tag)}` : ''}`
}
