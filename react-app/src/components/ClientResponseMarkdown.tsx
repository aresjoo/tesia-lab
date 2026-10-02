import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { responseInline, responseMarkdown } from '../client-response-markdown'
import { useConversationCopy } from '../client-conversation-copy'
import '../client-response-markdown.css'

function Inline({ text, depth = 0, links = true }: { text: string; depth?: number; links?: boolean }) {
  if (depth >= 4) return text
  return responseInline(text).map((token, index) => <Fragment key={index}>
    {token.kind === 'bold' ? <b><Inline text={token.text} depth={depth + 1} links={links} /></b> : token.kind === 'code' ? <code>{token.text}</code>
      : token.kind === 'link' && links ? <a href={token.href} target="_blank" rel="noopener noreferrer"><Inline text={token.text} depth={depth + 1} links={false} /></a> : token.text}
  </Fragment>)
}

function ResponseCode({ language, text }: { language: string; text: string }) {
  const { c } = useConversationCopy()
  const [result, setResult] = useState<{ text: string; state: 'copied' | 'failed' | null }>({ text, state: null })
  // Reset by content identity during render so A → B → A cannot revive a
  // cancelled success/error status; keep the code DOM and focus intact.
  if (result.text !== text) setResult({ text, state: null })
  const lifecycle = useRef({ generation: 0, attempt: 0 })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const current = lifecycle.current; current.generation++
    return () => { current.generation++; if (timer.current) clearTimeout(timer.current); timer.current = null }
  }, [text])
  const status = result.text === text ? result.state : null
  const copy = async () => {
    if (!text) return
    const current = lifecycle.current, attempt = ++current.attempt, generation = current.generation
    if (timer.current) clearTimeout(timer.current)
    setResult({ text, state: null })
    try {
      await navigator.clipboard.writeText(text)
      if (generation !== current.generation || attempt !== current.attempt) return
      setResult({ text, state: 'copied' })
      timer.current = setTimeout(() => { setResult({ text, state: null }); timer.current = null }, 1500)
    } catch {
      if (generation === current.generation && attempt === current.attempt) setResult({ text, state: 'failed' })
    }
  }
  return <div className="codeblk">
    <div className="ch"><span>{language || 'code'}</span><button type="button" disabled={!text} aria-label={c('copyCode')} onClick={() => { void copy() }}>{c(status === 'copied' ? 'codeCopied' : 'copyCodeShort')}</button></div>
    <pre tabIndex={0} aria-label={c('codeBlock')}><code>{text}</code></pre>
    <span className={`response-code-status${status === 'failed' ? ' error' : ''}`} role="status">{status === 'failed' ? c('copyError') : status === 'copied' ? c('codeCopied') : ''}</span>
  </div>
}

/** Faithful source taiMd presentation using escaped React text, never HTML. */
export const ClientResponseMarkdown = memo(function ClientResponseMarkdown({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const { c } = useConversationCopy()
  const blocks = useMemo(() => responseMarkdown(text), [text])
  const caret = streaming ? <span className="client-stream-caret" aria-hidden="true" /> : null
  const inlineCaret = ['plain', 'paragraph', 'heading', 'quote'].includes(blocks.at(-1)?.kind ?? '')
  return <div className="tai-txt client-response-markdown">{blocks.map((block, index) => {
    const key = `${block.at}:${block.kind}`
    const tail = index === blocks.length - 1 ? caret : null
    if (block.kind === 'plain') return <p key={key}>{block.text}{tail}</p>
    if (block.kind === 'space') return <div key={key} className="sp8" aria-hidden="true" />
    if (block.kind === 'code') return <ResponseCode key={key} text={block.text} language={block.language} />
    if (block.kind === 'list') return <ul key={key} className={block.numbered ? 'nl' : undefined}>{block.items.map((item, index) => <li key={index}>{block.numbered && <em className="no">{item.number}.</em>}<span><Inline text={item.text} /></span></li>)}</ul>
    if (block.kind === 'table') return <div key={key} className="tblwrap" tabIndex={0} role="region" aria-label={c('responseTable')}><table>
      <thead><tr>{block.rows[0].map((cell, index) => <th key={index} scope="col"><Inline text={cell} /></th>)}</tr></thead>
      <tbody>{block.rows.slice(1).map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}><Inline text={cell} /></td>)}</tr>)}</tbody>
    </table></div>
    if (block.kind === 'heading') return <h4 key={key}><Inline text={block.text} />{tail}</h4>
    if (block.kind === 'quote') return <blockquote key={key}><Info size={15} aria-hidden="true" /><span><Inline text={block.text} />{tail}</span></blockquote>
    return <p key={key}><Inline text={block.text} />{tail}</p>
  })}{!inlineCaret && caret}</div>
})
