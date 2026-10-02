import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientPersistentRegion } from '../../src/components/ClientPersistentRegion'

export function mountPersistentFocus(container: HTMLElement) {
  function App() {
    const [visible, show] = useState(false), [away, move] = useState(false)
    const input = useRef<HTMLInputElement>(null)
    useEffect(() => {
      if (visible) { input.current?.focus(); input.current?.setSelectionRange(2, 5) }
    }, [visible])
    return <>
      <button id="show" onClick={() => show(!visible)}>Toggle</button>
      <button id="move" onClick={() => move(!away)}>Move</button>
      {visible && <ClientPersistentRegion target={away ? document.getElementById('destination') : null} contents>
        <input ref={input} aria-label="Persistent input" defaultValue="선택을 보존하세요" />
      </ClientPersistentRegion>}
    </>
  }
  const root = createRoot(container)
  root.render(<StrictMode><App /></StrictMode>)
  return () => root.unmount()
}
