import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown } from 'lucide-react'

/** Follows actual DOM updates, never manufactures messages or thinking states. */
export function ClientChartThread({ title, children }: { title: string; children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const hidden = useRef(false)
  const position = useRef(0)
  const manualScroll = useRef(false)
  const size = useRef({ width: 0, height: 0 })
  const [unread, setUnread] = useState(false)
  const latest = () => {
    manualScroll.current = false
    following.current = true
    const node = viewport.current
    if (node) { node.scrollTop = node.scrollHeight; position.current = node.scrollTop; node.focus({ preventScroll: true }) }
    setUnread(false)
  }
  useEffect(() => {
    const node = viewport.current, body = content.current
    if (!node || !body) return
    let frame = 0, changed = false
    const update = () => {
      if (!node.clientHeight) hidden.current = true
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!node.clientHeight) { hidden.current = true; return }
        if (manualScroll.current) { following.current = false; position.current = node.scrollTop }
        // User scrolling can reach the DOM before the scroll event is delivered.
        // Do not overwrite that newer position with a queued resize/follow frame.
        if (node.scrollTop > 0 && node.scrollTop < position.current && node.scrollHeight - node.clientHeight - node.scrollTop >= 40) {
          following.current = false
          position.current = node.scrollTop
        }
        if (following.current) node.scrollTop = node.scrollHeight
        else {
          if (hidden.current) node.scrollTop = position.current
          if (changed) setUnread(true)
        }
        changed = false
        hidden.current = false
        position.current = node.scrollTop
        size.current = { width: node.clientWidth, height: node.clientHeight }
      })
    }
    const mutations = new MutationObserver(() => { changed = true; update() })
    mutations.observe(body, { childList: true, subtree: true, characterData: true })
    const sizes = new ResizeObserver(update)
    sizes.observe(node); sizes.observe(body)
    update()
    return () => { cancelAnimationFrame(frame); mutations.disconnect(); sizes.disconnect() }
  }, [])
  return <div className="bw-thread-shell">
    <div ref={viewport} className="bw-thread" tabIndex={0} role="region" aria-label={`${title} 대화 기록`} onWheel={event => { if (event.deltaY < 0) manualScroll.current = true }} onTouchMove={() => { manualScroll.current = true }} onKeyDown={event => { if (['Home', 'PageUp', 'ArrowUp'].includes(event.key)) manualScroll.current = true }} onScroll={event => {
      const node = event.currentTarget
      if (!node.clientHeight || (!manualScroll.current && (hidden.current || node.clientWidth !== size.current.width || node.clientHeight !== size.current.height))) return
      position.current = node.scrollTop
      manualScroll.current = false
      following.current = node.scrollHeight - node.clientHeight - node.scrollTop < 40
      if (following.current) setUnread(false)
    }}><div ref={content}><p className="bw-thread-intro">문서를 읽으며 나누던 대화가 이어집니다. 거래를 선택해 함께 확인하세요.</p>{children}</div></div>
    {unread && <button type="button" className="bw-latest" onClick={latest}><ArrowDown size={15} />새 메시지 보기</button>}
  </div>
}
