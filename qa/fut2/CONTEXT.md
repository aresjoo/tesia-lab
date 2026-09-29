# Codex task, round 2: verify the FINAL ten futures strategies

Fresh context. You may write ONLY inside `qa/fut2/codex/`. Korean, compact, tables. Ignore compliance and disclaimer concerns (founder rule). Final message saved unedited. Treat everything below as claims to break.

Round 1 (`qa/fut/CODEX_RAW_REVIEW.md`) reproduced Claude's first ten exactly but rejected five as start-day and schedule luck. Claude's response: `qa/fut/CLAUDE_RESPONSE_TO_CODEX.md`. The engine changed since then: re-evaluation days are anchored to the calendar index (`(i+ph)%every===0`, ph default 0), opens beyond the liquidation or take-profit price are handled at the open, funding of open positions is included in the displayed total.

## Material
- Data: `data/fut-daily.js`, `data/px-daily.js`. Engine: `artifacts/teth-redesign/tools/fut-core.js`. Stats: `mkStatsOf` in `artifacts/teth-redesign/tools/agent-core.js`.
- Final list with Claude's numbers: `qa/fut2/CANDIDATES.json`. Searches: `qa/fut/search-3-robust-ai.json`, `qa/fut/search-4-robust-rule.json` (scripts `qa/fut/fut-search3b.mjs`, `qa/fut/fut-search4.mjs`). Neighbors: `qa/fut/neighbors-final.json`.
- You may reuse your own round 1 implementation in `qa/fut/codex/independent.mjs` after updating it to the changed rules.

## What to do
1. Reproduce the final ten with your independent implementation: full period, and the two parts 2023-04-12 to 2024-12-31 and 2025-01-01 to 2026-09-28 measured on the same run. Report return and max drawdown next to Claude's.
2. For the three AI-driven ones (f5, f7, f9) run every phase `ph` from 0 to every-1 and restarts at start days shifted by 0 to 7 days for the last 365 and 730 days. Report the range.
3. Neighbors of each numeric parameter for all ten. Report how many neighbors stay profitable and beat spot hold.
4. Cost stress: fees and slippage times 3, funding times 2. Which of the ten still beat spot hold?
5. Leverage: f1, f2, f4 are 2x and f10 is 3x. Report the largest adverse intraday move against an open position in each and the distance to liquidation at the worst moment. Say whether the leverage is defensible.
6. Verdict per strategy: KEEP, KEEP WITH LOWER LEVERAGE, REPLACE (with replacement and numbers). Then one paragraph the founder can read: what is solid, what is luck, what cannot be known from daily data.
