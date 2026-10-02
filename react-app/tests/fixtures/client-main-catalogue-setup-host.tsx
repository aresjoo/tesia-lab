import { useEffect, useState } from 'react'
import { ClientMainExperience as Main } from '../../src/components/ClientMainExperience'
import { catalogueSourceSha } from '../../src/client-catalogue'
import { createCatalogueCopyAccountController } from '../../src/client-catalogue-copy-account'
import type { CatalogueCopySetup } from '../../src/client-catalogue-copy-setup'

const owner = 'main-copy-setup@example.test'
const mode: string = Reflect.get(window, 'mainCatalogueSetupMode')
let account: ReturnType<typeof createCatalogueCopyAccountController> | null = null
const calls: { signal: AbortSignal; resolve: () => void }[] = []

/** Explicit local preview balance/settings supplier. No Main state or handler replacement. */
export function ClientMainExperience() {
  const [supply, setSupply] = useState({ owner: mode === 'foreign' ? 'foreign@example.test' : owner, sourceSha: catalogueSourceSha, strategyId: 'f1', revision: 'observed-mock-1', available: 1000 })
  useEffect(() => {
    const current = createCatalogueCopyAccountController(owner)
    account = current
    Reflect.set(window, 'mainCatalogueSetupFixture', {
      patch: (patch: Partial<typeof supply>) => setSupply(before => ({ ...before, ...patch })),
      settle: (index: number) => calls[index].resolve(),
      calls: () => calls.map(call => ({ aborted: call.signal.aborted })),
      account: () => current.getSnapshot().state,
    })
    return () => { Reflect.deleteProperty(window, 'mainCatalogueSetupFixture'); current.dispose(); if (account === current) account = null }
  }, [])
  const setup: CatalogueCopySetup = { ...supply, onConfirm: async (settings, signal) => {
    if (mode === 'deferred') await new Promise<void>(resolve => calls.push({ signal, resolve }))
    if (signal.aborted) throw Error('cancelled')
    const current = account
    if (!current) throw Error('unmounted')
    const result = await current.start({ id: crypto.randomUUID(), strategyId: supply.strategyId, settings, at: Date.now() }, signal)
    if (!result.ok) throw Error(result.error)
    const observed = current.getSnapshot().state!
    setSupply(before => ({ ...before, available: observed.spot, revision: String(observed.revision) }))
  } }
  return <Main catalogueCopySetup={mode === 'unsupplied' ? undefined : setup} />
}
