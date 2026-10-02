// Test-only observation harness. No real account, provider, credential or order authority.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import ClientCatalogueBacktest from '../../src/components/ClientCatalogueBacktest'
import { createCatalogueBacktestClient, type CatalogueBacktestSelection, type CatalogueBacktestUseBinding } from '../../src/client-catalogue-backtest'
import '../../src/client-catalogue.css'
import '../../src/client-reference.css'
import '@fontsource-variable/noto-sans-kr'

export function mount() {
  document.body.style.fontFamily='"Noto Sans KR Variable",sans-serif'
  const root = createRoot(document.getElementById('fixture')!)
  let owner: string | null = 'bt-owner-a', strategyId = 'r1', supplied = false
  const calls: { binding: Readonly<CatalogueBacktestUseBinding>; signal: AbortSignal; resolve: () => void; reject: () => void }[] = []
  let backs = 0, browses = 0
  const render = () => flushSync(() => root.render(<StrictMode><ClientCatalogueBacktest owner={owner} strategyId={strategyId}
    onBack={() => backs++} onBrowse={() => browses++} onUse={supplied ? (signal,binding) => new Promise<void>((resolve,reject) => calls.push({signal,binding,resolve,reject:() => reject(Error('fixture rejection'))})) : undefined}/></StrictMode>))
  render()
  return { calls, render, owner(value:string|null) {owner=value;render()}, strategy(value:string) {strategyId=value;render()}, supply(value:boolean) {supplied=value;render()},
    counts:()=>({backs,browses}), dispose:()=>root.unmount(),
    async run(selection:CatalogueBacktestSelection) { const client=createCatalogueBacktestClient();try{return await client.run(selection)}finally{client.dispose()} },
  }
}
