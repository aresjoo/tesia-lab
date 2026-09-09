import { Fragment } from 'react'
import { parseRichText, type RichSpan } from '../teth-rich-text'
import '../teth-rich-text.css'

/* say 본문 렌더러 — teth-rich-text 파서의 안전 서브셋만 그린다. HTML 주입 없음. */
const Spans = ({ spans }: { spans: RichSpan[] }) => <>{spans.map((span, index) => span.bold ? <strong key={index}>{span.text}</strong> : <Fragment key={index}>{span.text}</Fragment>)}</>

const Lines = ({ lines }: { lines: RichSpan[][] }) => <>{lines.map((line, index) => <Fragment key={index}>{index > 0 && <br />}<Spans spans={line} /></Fragment>)}</>

export function TethRichText({ text, caret = false }: { text: string; caret?: boolean }) {
  const blocks = parseRichText(text)
  const caretNode = caret ? <span className="client-stream-caret" aria-hidden="true" /> : null
  const last = blocks.at(-1)
  return <div className="teth-rich">
    {blocks.map((block, index) => {
      const isLast = index === blocks.length - 1
      switch (block.kind) {
        case 'p': return <p key={index}><Lines lines={block.lines} />{isLast && caretNode}</p>
        case 'h': return <h4 key={index}><Spans spans={block.spans} />{isLast && caretNode}</h4>
        case 'ul': return <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><Spans spans={item} />{isLast && itemIndex === block.items.length - 1 && caretNode}</li>)}</ul>
        case 'ol': return <ol key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><Spans spans={item} />{isLast && itemIndex === block.items.length - 1 && caretNode}</li>)}</ol>
        case 'quote': return <blockquote key={index}><Lines lines={block.lines} />{isLast && caretNode}</blockquote>
        case 'hr': return <hr key={index} />
        case 'table': return <div className="trt-table" key={index}><table>
          <thead><tr>{block.header.map((cell, cellIndex) => <th key={cellIndex}><Spans spans={cell} /></th>)}</tr></thead>
          <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}><Spans spans={cell} /></td>)}</tr>)}</tbody>
        </table></div>
      }
    })}
    {(!last || last.kind === 'table' || last.kind === 'hr') && caretNode && <p>{caretNode}</p>}
  </div>
}
