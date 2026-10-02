/** Modified display inputs only; never an accepted report or receipt. */
export const displayOnlyRates = [
  { netReturnRate: '-0.00000001', buyAndHoldReturnRate: '0.00000001', maxDrawdownRate: '0' },
  { netReturnRate: '0.01234999999999999999', buyAndHoldReturnRate: '0.01235', maxDrawdownRate: '0' },
] as const
