import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientLocalePanel } from '../../src/components/ClientLocalePanel'

/** Explicit retained consumer beside the real SDK-backed service host.
 * The former conversation settings→language entry is absent from fresh source.
 * This fixture adds no service handler, authentication, approval or write port.
 */
export function installNativeLocaleCompatibility() {
  if (document.querySelector('[data-scope="native-locale-compatibility"]')) return
  const service = document.querySelector('.client-service-app, .client-source-app')
  if (!service) throw new Error('Compatibility requires the actual source host')
  const container = document.createElement('aside')
  container.dataset.scope = 'native-locale-compatibility'
  Object.assign(container.style, { position: 'fixed', top: '112px', left: '12px', zIndex: '100' })
  document.body.append(container)
  const root = createRoot(container)
  function Consumer() {
    const [open, setOpen] = useState(false)
    const trigger = useRef<HTMLButtonElement>(null)
    return <><button ref={trigger} type="button" className="fixture-locale-compatibility" onClick={() => setOpen(true)}>명시 호환 소비자 언어 열기</button><ClientLocalePanel open={open} returnFocus={trigger} onClose={() => setOpen(false)} /></>
  }
  root.render(<Consumer />)
  // Retire the companion with its observed service host; preserve the real
  // host's unmount/owner behavior instead of replacing its state or callbacks.
  const retirement = new MutationObserver(() => {
    if (service.isConnected) return
    retirement.disconnect(); root.unmount(); container.remove()
  })
  retirement.observe(document.body, { childList: true, subtree: true })
}
