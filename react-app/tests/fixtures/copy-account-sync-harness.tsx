import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useCopyPreviewAccount } from '../../src/use-copy-preview-account'
import { topUpCopyPreview } from '../../src/client-copy-preview-state'

export function mountCopyAccountSync(unavailable = false) {
  document.getElementById('root')?.remove()
  const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage')!
  if (unavailable) Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw Error('storage unavailable') } })
  const host = document.createElement('main'); document.body.append(host)
  function Consumer({ owner, id }: { owner: string; id: string }) {
    const account = useCopyPreviewAccount(owner)
    return <section id={id}><output>{JSON.stringify({ owner: account.state?.owner, spot: account.blocked ? null : account.state?.spot, blocked: account.blocked })}</output>
      <button onClick={() => account.commit(state => topUpCopyPreview(state, owner))}>add</button>
      <button onClick={account.retry}>retry</button></section>
  }
  let setOwner: (owner: string) => void
  let setSecond: (visible: boolean) => void
  function Harness() {
    const [owner, changeOwner] = useState('a'), [second, changeSecond] = useState(true)
    setOwner = changeOwner; setSecond = changeSecond
    return <><Consumer id="first" owner="a"/>{second && <Consumer id="second" owner={owner}/>}<Consumer id="foreign" owner="b"/></>
  }
  const root = createRoot(host); root.render(<Harness/> )
  return { owner: (value: string) => setOwner(value), second: (visible: boolean) => setSecond(visible), unmount: () => root.unmount(), restoreStorage: () => Object.defineProperty(window, 'sessionStorage', storageDescriptor) }
}
