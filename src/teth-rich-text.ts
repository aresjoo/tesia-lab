/* say 본문용 미니 마크다운 파서 — 표·굵게·리스트·소제목·인용·구분선만 지원하는
 * 안전 서브셋. 외부 라이브러리·HTML 주입 없이 순수 데이터로 파싱하고 React 가
 * 노드를 만든다. 지원 밖 문법은 평문으로 그대로 흘려 내용을 잃지 않는다.
 * 스트리밍 부분 텍스트에도 절대 throw 하지 않는다. */

export type RichSpan = { text: string; bold?: true }
export type RichBlock =
  | { kind: 'p'; lines: RichSpan[][] }
  | { kind: 'h'; spans: RichSpan[] }
  | { kind: 'ul'; items: RichSpan[][] }
  | { kind: 'ol'; items: RichSpan[][] }
  | { kind: 'quote'; lines: RichSpan[][] }
  | { kind: 'hr' }
  | { kind: 'table'; header: RichSpan[][]; rows: RichSpan[][][] }

/** **굵게** 만 인식하는 스팬 분해. 홀수 개의 ** 는 평문으로 남긴다. */
export function parseSpans(line: string): RichSpan[] {
  const spans: RichSpan[] = []
  const parts = line.split(/\*\*/)
  if (parts.length % 2 === 0) return line ? [{ text: line }] : []
  parts.forEach((part, index) => {
    if (!part) return
    spans.push(index % 2 === 1 ? { text: part, bold: true } : { text: part })
  })
  return spans
}

const isTableLine = (line: string) => line.trimStart().startsWith('|')
const isTableSeparator = (line: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-')

function parseTableCells(line: string): RichSpan[][] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map(cell => parseSpans(cell.trim()))
}

export function parseRichText(text: string): RichBlock[] {
  const lines = text.split('\n')
  const blocks: RichBlock[] = []
  let paragraph: RichSpan[][] = []
  const flushParagraph = () => { if (paragraph.length) { blocks.push({ kind: 'p', lines: paragraph }); paragraph = [] } }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) { flushParagraph(); continue }
    if (/^-{3,}$/.test(trimmed)) { flushParagraph(); blocks.push({ kind: 'hr' }); continue }
    const heading = /^#{2,4}\s+(.*)$/.exec(trimmed)
    if (heading) { flushParagraph(); blocks.push({ kind: 'h', spans: parseSpans(heading[1]) }); continue }
    if (trimmed.startsWith('> ')) {
      flushParagraph()
      const quote: RichSpan[][] = []
      while (i < lines.length && lines[i].trim().startsWith('> ')) { quote.push(parseSpans(lines[i].trim().slice(2))); i++ }
      i--
      blocks.push({ kind: 'quote', lines: quote })
      continue
    }
    const bullet = /^[-*]\s+(.*)$/.exec(trimmed)
    if (bullet) {
      flushParagraph()
      const items: RichSpan[][] = []
      while (i < lines.length) {
        const item = /^[-*]\s+(.*)$/.exec(lines[i].trim())
        if (!item) break
        items.push(parseSpans(item[1])); i++
      }
      i--
      blocks.push({ kind: 'ul', items })
      continue
    }
    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed)
    if (numbered) {
      flushParagraph()
      const items: RichSpan[][] = []
      while (i < lines.length) {
        const item = /^\d+[.)]\s+(.*)$/.exec(lines[i].trim())
        if (!item) break
        items.push(parseSpans(item[1])); i++
      }
      i--
      blocks.push({ kind: 'ol', items })
      continue
    }
    // 표: | 헤더 | 다음 줄이 구분선일 때만 확정 — 아니면 평문으로 남긴다.
    if (isTableLine(line) && i + 1 < lines.length && isTableLine(lines[i + 1]) && isTableSeparator(lines[i + 1])) {
      flushParagraph()
      const header = parseTableCells(line)
      i += 2
      const rows: RichSpan[][][] = []
      while (i < lines.length && isTableLine(lines[i]) && lines[i].trim() !== '') { rows.push(parseTableCells(lines[i])); i++ }
      i--
      blocks.push({ kind: 'table', header, rows })
      continue
    }
    paragraph.push(parseSpans(line))
  }
  flushParagraph()
  return blocks
}
