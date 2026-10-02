/** Frontend display inputs only: these are not HTTP schemas, execution commands,
 * or an authorization contract. Amounts/results are supplied, never simulated. */
export type CopyDataSet<T> = { state: 'unavailable' | 'loading' | 'ready' | 'error'; rows: T[]; message?: string }
export type CopyServiceMetrics = { est: number | null; avail: number | null; net: number | null; unreal: number | null; realized: number | null; share: number | null }
export type CopyServicePosition = { id: string; pair: string; direction: string; size: number | null; entryPrice: number | null; currentPrice: number | null; liquidationRisk: string | null; stopTarget: string | null; unrealized: number | null; returnPercent: number | null }
export type CopyServiceTrade = { id: string; pair: string; direction: string; entryPrice: number | null; exitPrice: number | null; pnl: number | null; returnPercent: number | null; reason: string; exitedAt: number | null }
export type CopyServiceShare = { id: string; from: number | null; to: number | null; realized: number | null; settled: number | null; pending: number | null; ratioPercent: number | null; amount: number | null }
export type CopyServiceTransfer = { id: string; at: number | null; kind: 'deposit' | 'withdraw'; amount: number | null; asset: string; direction: string }
export type CopyServiceTransaction = { id: string; at: number | null; category: string; pair: string; quantity: string | null; fee: number | null; balanceChange: number | null }
export type CopyServiceCopier = { id: string; rank: number | null; nick: string; investment: number | null; pnl: number | null; returnPercent: number | null; startedAt: number | null }
export type CopyServiceCalendar = { state: CopyDataSet<never>['state']; months: { month: string; days: { date: string; pnl: number | null; returnPercent: number | null; trades: number | null }[] }[]; message?: string }
export type CopyServiceProfileData = {
  asset: string
  positions?: CopyDataSet<CopyServicePosition>
  calendar?: CopyServiceCalendar
  transfers?: CopyDataSet<CopyServiceTransfer>
  copiers?: CopyDataSet<CopyServiceCopier>
}
export type CopyServiceAccount = {
  id: string; nick: string; status: 'active' | 'closed'; startedAt: number | null; asset: string; pairs: string[]
  sharePercent: number | null; metrics: CopyServiceMetrics | null; invested: number | null; recovered: number | null
  returnPercent: number | null
  positions?: CopyDataSet<CopyServicePosition>; trades?: CopyDataSet<CopyServiceTrade>
  shares?: CopyDataSet<CopyServiceShare>; transfers?: CopyDataSet<CopyServiceTransfer>; transactions?: CopyDataSet<CopyServiceTransaction>
  historySummary?: { count: number | null; wins: number | null; pnl: number | null }
  transactionSummary?: { fills: number | null; fee: number | null; funding: number | null }
  transferWarning?: string
  /** Supplied limits, confirmations and settlement estimates. No client risk decision. */
  actions?: {
    availableDeposit: number | null; availableWithdrawal: number | null; depositNeedsConfirmation: boolean
    closeSettlement?: { net: number | null; share: number | null; recovered: number | null }
    flattenSettlement?: { net: number | null; share: number | null; recovered: number | null }
    onAdjust?: (input: { amount: number; direction: 'add' | 'out'; confirmLoss: boolean }) => Promise<void>
    onClose?: () => Promise<void>; onFlatten?: () => Promise<void>
  }
}
export type CopyServiceDashboard = {
  accounts: CopyDataSet<CopyServiceAccount>; asset: string; metrics: CopyServiceMetrics | null; activeCount: number | null
}
export type CopyServiceFollow = {
  id: string; nick: string; status: { label: string; active: boolean; running: boolean }
  stopPercent: number | null; targetPercent: number | null; budget: string | null; startedAt: number | null
}
export type CopyServiceFollows = CopyDataSet<CopyServiceFollow> & {
  onResume?: (id: string) => Promise<void>
  /** Load existing editable values; the original copy/revalidation dialog follows. */
  onEdit?: (id: string) => Promise<CopyServiceFollowDraft>
  onArchive?: (id: string) => Promise<void>; onRemove?: (id: string) => Promise<void>
}
export type CopyServiceFollowDraft = { id: string; budgetIndex: number; sl: number; tp: number | null }
