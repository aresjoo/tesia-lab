import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientServiceExperience } from '../../src/internal-poc/ClientServiceExperience'
import type { NativeAccountPresentation } from '../../src/internal-poc/native-account-presentation'
import type { ClientBillingPresentation } from '../../src/client-settings-billing-presentation'
import '../../src/styles.css'
import '../../src/client-reference.css'
const calls: { kind: string; id?: string; signal: AbortSignal }[] = []
const pending: { resolve: () => void; reject: () => void }[] = []
export function App() {
  const [owner, setOwner] = useState('owner-a'), [identity, setIdentity] = useState('dataset-a')
  const [enabled, setEnabled] = useState(!location.search.includes('unavailable'))
  const [billing, setBilling] = useState<ClientBillingPresentation | undefined>(location.search.includes('unknown') ? undefined : {
    sourceLabel: 'SUPPLIED BILLING TEST',
    invoices: Array.from({ length: 6 }, (_, i) => ({ id: `receipt-${i}`, label: `SUPPLIED INVOICE ${i}`, amountLabel: i === 0 ? '100 USDT' : '₩139,000', dateLabel: '2026. 09. 01.', kind: i === 1 ? 'failed' : i === 2 ? 'refunded' : 'paid', statusLabel: `SUPPLIED STATUS ${i}`, paymentMethodLabel: 'TEST •••• 4242', recipient: 'HISTORICAL RECIPIENT' })),
    information: { name: 'CURRENT RECIPIENT', email: 'billing@example.invalid', address: 'SUPPLIED ADDRESS' },
    methods: [{ id: 'method-a', brand: 'TEST CARD A', last4: '4242', expiryLabel: '12 / 28', isDefault: true, removable: false, removalHint: 'HOST BLOCKED REMOVAL' }, { id: 'method-b', brand: 'TEST CARD B', last4: '5555', expiryLabel: '11 / 29', isDefault: false, removable: true }],
  })
  const request = (kind: string, signal: AbortSignal, id?: string) => {
    calls.push({ kind, signal, id })
    return new Promise<void>((resolve, reject) => pending.push({ resolve, reject: () => reject(new Error('PRIVATE_ERROR_NOT_FOR_UI')) }))
  }
  const data: NativeAccountPresentation = {
    scope: owner, identity, sourceLabel: 'SUPPLIED TEST', strategies: null, accounts: null, billing,
    plan: location.search.includes('legacy') ? { title: 'LEGACY PLAN', sourceLabel: 'LEGACY PLAN SOURCE', sections: { plan: [], alerts: [], rebates: [] } } : undefined,
    ledger: { pos: null, open: null, orders: null, fills: null, closed: null, assets: null },
    actions: { billing: enabled ? {
      subscription: (action, signal) => request(action, signal),
      updateInformation: (_information, signal) => request('information', signal),
      addMethod: signal => request('add', signal), makeDefault: (id, signal) => request('default', signal, id), removeMethod: (id, signal) => request('remove', signal, id),
    } : undefined },
  }
  Object.assign(window, {
    billingCalls: () => calls.map(({ signal, ...call }) => ({ ...call, aborted: signal.aborted })),
    billingResolve: (index = 0) => pending[index].resolve(), billingReject: (index = 0) => pending[index].reject(),
    billingSetOwner: setOwner, billingSetDataset: setIdentity, billingSetEnabled: setEnabled, billingSetData: setBilling,
  })
  return <ClientServiceExperience nativeAccounts accountScope={owner} accountPresentation={data} state={{
    phase: 'ready', sessionState: 'AUTHENTICATED', messages: [], input: '', busy: false, inputDisabled: false, source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
    onInput: () => {}, onSend: async () => {}, onReset: async () => {},
  }} />
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
