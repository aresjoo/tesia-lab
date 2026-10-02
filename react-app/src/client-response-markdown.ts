/** The client's small taiMd dialect, not a service schema or executable markup.
 * Keep source offsets stable as a response grows. Never interpret AI action tags.
 * Parsing has no DOM, storage, network, clock, or execution side effects.
 */
export type ResponseInline = { kind: 'text' | 'bold' | 'code'; text: string }
  | { kind: 'link'; text: string; href: string }
export type ResponseMarkdownBlock = { at: number } & (
  | { kind: 'paragraph' | 'heading' | 'quote' | 'plain'; text: string }
  | { kind: 'space' }
  | { kind: 'list'; numbered: boolean; items: { text: string; number?: string }[] }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'code'; language: string; text: string }
)

function webHref(value: string): string | null {
  // Only deliberate HTTP(S) source links. No relative routes, HTML entities,
  // controls, credentials, scheme-relative links or executable protocols.
  if (!/^https?:\/\//.test(value) || /[\s\\<>"]/u.test(value)
    || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null
  try {
    const url = new URL(value)
    return url.hostname && !url.username && !url.password && ['http:', 'https:'].includes(url.protocol) ? value : null
  } catch { return null }
}

export function responseInline(text: string): ResponseInline[] {
  const result: ResponseInline[] = []
  // Code wins at its opening backtick: content inside never becomes a link.
  const tokens = /`([^`]+)`|\[([^\]\n]{1,80})\]\((https?:[^)\s]{1,300})\)|\*\*([^*]+)\*\*/g
  let offset = 0
  for (const match of text.matchAll(tokens)) {
    if (match.index > offset) result.push({ kind: 'text', text: text.slice(offset, match.index) })
    if (match[1] !== undefined) result.push({ kind: 'code', text: match[1] })
    else if (match[2] !== undefined) {
      const href = webHref(match[3])
      result.push(href ? { kind: 'link', text: match[2], href } : { kind: 'text', text: match[0] })
    } else result.push({ kind: 'bold', text: match[4] })
    offset = match.index + match[0].length
  }
  if (offset < text.length) result.push({ kind: 'text', text: text.slice(offset) })
  return result
}

export function responseMarkdown(text: string): ResponseMarkdownBlock[] {
  const blocks: ResponseMarkdownBlock[] = []
  // Bound DOM expansion without dropping any content. Long responses remain
  // readable/copyable as plain text instead of allocating thousands of nodes.
  if (text.length > 100_000 || text.split('\n', 3001).length > 3000) return [{ kind: 'plain', at: 0, text }]
  let markers = 0
  const markerPattern = /\||`|\*\*/g
  while (markerPattern.exec(text)) {
    if (++markers > 4000) return [{ kind: 'plain', at: 0, text }]
  }
  const sections = text.split('```')
  let at = 0, tableCells = 0
  for (const [index, section] of sections.entries()) {
    if (index % 2) {
      const newline = section.indexOf('\n'), candidate = section.slice(0, newline).trim()
      const hasLanguage = newline >= 0 && newline < 24 && /^[a-zA-Z0-9+#._-]*$/.test(candidate)
      blocks.push({ kind: 'code', at, language: hasLanguage ? candidate : '', text: (hasLanguage ? section.slice(newline + 1) : section).replace(/\n+$/, '') })
    } else {
      let group: Extract<ResponseMarkdownBlock, { kind: 'list' | 'table' }> | undefined
      for (const line of section.split('\n')) {
        const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line)
        if (/^\s*\|.+\|\s*$/.test(line)) {
          const cells = line.replace(/^\s*\||\|\s*$/g, '').split('|').map(cell => cell.trim())
          tableCells += cells.length
          if (cells.length > 128 || tableCells > 2000) return [{ kind: 'plain', at: 0, text }]
          if (!group || group.kind !== 'table') { group = { kind: 'table', at, rows: [] }; blocks.push(group) }
          if (!cells.every(cell => /^:?-{2,}:?$/.test(cell) || cell === '')) group.rows.push(cells)
        } else if (/^\s*[-*•]\s+/.test(line) || numbered) {
          const isNumbered = Boolean(numbered)
          if (!group || group.kind !== 'list' || group.numbered !== isNumbered) { group = { kind: 'list', at, numbered: isNumbered, items: [] }; blocks.push(group) }
          group.items.push(numbered ? { number: numbered[1], text: numbered[2] } : { text: line.replace(/^\s*[-*•]\s+/, '') })
        } else {
          group = undefined
          if (/^#{2,4}\s+/.test(line)) blocks.push({ kind: 'heading', at, text: line.replace(/^#{2,4}\s+/, '') })
          else if (/^>\s?/.test(line)) blocks.push({ kind: 'quote', at, text: line.replace(/^>\s?/, '') })
          else blocks.push(line.trim() ? { kind: 'paragraph', at, text: line } : { kind: 'space', at })
        }
        at += line.length + 1
      }
      at--
    }
    if (index % 2) at += section.length
    at += 3
  }
  return blocks.filter(block => block.kind !== 'table' || block.rows.length)
}
