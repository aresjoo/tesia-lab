export type InvestmentDisplayName = 'CHART' | 'ASK' | 'NEXT' | 'TITLE'

export type InvestmentDisplayRead =
  | { start: number; invalid: true }
  | { start: number; incomplete: true }
  | { start: number; end: number; name: string; value: unknown }

export function validInvestmentDisplay(name: string, value: unknown, options?: { allowTitle?: boolean }): boolean
export function readInvestmentDisplay(text: string): InvestmentDisplayRead | null
