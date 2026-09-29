# Codex task: independent replication and attack of 10 long/short futures strategies

The founder wants 10 futures strategies (long and short, leverage allowed) at the top of the strategy list, computed on real market data, that beat "그냥 들고 있었다면" (equal weight spot hold of the same assets). Claude built a futures engine, searched about 70,000 parameter sets and picked 10. Your job is to find out whether these numbers are real.

You may write ONLY inside `qa/fut/codex/`. Do not edit any other file. Korean, compact, tables. Ignore compliance and disclaimer concerns (founder rule). Your final message is saved unedited.

## Material
- Data: `data/fut-daily.js` (`window.TETH_FUT.sym[name] = {o,h,l,c,f}`, Bybit USDT perpetual daily candles, `f` = sum of that UTC day's funding rates in basis points). `data/px-daily.js` (`window.TETH_PX.fng` fear and greed). Index 0 = 2023-01-01, last = 2026-09-28, one slot per UTC day. Built by `data/build-fut.mjs`, `data/build-px.mjs`.
- Engine: `artifacts/teth-redesign/tools/fut-core.js` (`mkFutRun`). Stats come from `mkStatsOf` in `artifacts/teth-redesign/tools/agent-core.js`.
- Candidates and Claude's numbers: `qa/fut/CANDIDATES.json`. Search outputs: `qa/fut/search-1.json`, `qa/fut/search-2.json`. Neighbor check of an earlier pick: `qa/fut/neighbors-first-pick.json`.

## Engine rules as Claude states them (verify in code)
Per day i: (1) orders decided at the close of day i-1 fill at the open of day i with 0.05% slippage, closes before opens; (2) intraday, with the day's high and low: stop loss and trailing stop (from the best close so far) fill at the stop price, or at the open if the open gapped through; forced liquidation at the isolated-margin liquidation price with the whole margin lost (maintenance margin 0.5% of notional); take profit at the limit price; when stop and take profit are both inside the same day the stop wins; (3) funding accrues on notional at the day's close using that day's summed rate, longs pay positive funding; (4) signals are computed from the close of day i. Fee 0.055% of notional per side. One position uses the whole equity as margin (rule, mix) or 1/top of equity (agent).

## What to do
1. Write your OWN independent implementation (Node script in `qa/fut/codex/`) from the rules above and the data only. Do not import `fut-core.js`. Reproduce the 10 candidates over the full period (start index 101), last 730 days and last 365 days. Report your return and max drawdown next to Claude's. Explain every difference larger than 2 percentage points.
2. Attack the engine: look-ahead (does any signal use information from day i+1 or the fill day?), same-day stop logic, gap handling, funding sign and timing, liquidation price formula, fee base, equity marking, the benchmark definition, off-by-one in channel windows (`fuMax(D.h,i-c.n,i-1)`), the agent's use of `above`/`score` on the decision day, reuse of `pickL`/`pickS` after regime changes.
3. Overfitting: for each candidate run the neighbors (each numeric parameter one step up and down) and a walk-forward split (choose on 2023-04 to 2024-12, test on 2025-01 to 2026-09). Say which candidates survive out of sample and which are curve-fit. If you find parameter sets in the same families that are more robust, list them.
4. Realism limits the founder should know (daily bars hide intraday liquidation paths, capacity, funding spikes), in a short list.
5. Verdict per candidate: KEEP, KEEP WITH LOWER LEVERAGE, REPLACE. For REPLACE give the replacement config and its numbers.
