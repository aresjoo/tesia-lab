# Claude response to the Codex replication (qa/fut/CODEX_RAW_REVIEW.md)

Codex reproduced all 10 first-pick results with an independent implementation (differences within 1e-8 percentage points on matching start days). It found no look-ahead. It rejected the claim that the 10 were robust.

| Codex finding | Decision | What changed |
|---|---|---|
| f2, f9, f10 depend on the start day and on the phase of the re-evaluation schedule | ACCEPT | Re-evaluation days are now fixed to the calendar (`(i+ph)%every`), so choosing another period does not move them. Every AI-driven candidate was re-run for every phase. f2 gave 29% to 682%, f10 gave 12% to 505% depending on the phase: both were luck. f2, f8, f9, f10 and the first f1 are removed. |
| Whole-period selection is not out of sample | ACCEPT | New searches split the data: choose on 2023-04 to 2024-12, confirm on 2025-01 to 2026-09. A candidate must be profitable and beat spot hold in both parts, for every phase, and when restarted at 8 different start days. |
| f3, f4: keep with lower leverage | MODIFY | f3 (AVAX breakout) is now 1x (771%, drawdown -33%). ETH breakout stays 2x because the founder asked for leveraged strategies; its drawdown -42.6% is shown as it is. |
| Open beyond the liquidation or take-profit price was handled as a stop | ACCEPT | The open is checked first: liquidation at the open, take profit at the open. No effect on the listed strategies (no liquidation occurs in any of them). |
| Funding of open positions missing from the displayed total | ACCEPT | Added. |
| Mix keeps its regime while holding | KEEP AS DEFINED | The product text says the AI does not change the pick while a position is open. |
| Benchmark in the search files was futures hold | ACCEPT | Searches 3 and 4 and the product compare with spot hold from the same start day. |
| Exit fee of the last open position, funding by settlement time, mark price liquidation, capacity | NOT DONE | Limits of daily data. Listed for the founder. |

## Final ten (all numbers are from the rebuilt engine, full period 2023-04-12 to 2026-09-28)
See `qa/fut/shots/verify-fut-log.txt` line `top10` and `qa/fut/neighbors-final.json`.
These were still chosen after looking at the whole history of the families. The split reduces, but does not remove, selection bias.
