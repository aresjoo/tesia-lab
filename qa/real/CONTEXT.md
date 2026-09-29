# Review: real prices, AI strategy sheet, free following

Adversarial, read-only. Do not edit product files or write in the repository. Korean, compact, tables. Ignore compliance and disclaimer concerns (founder rule). Final message saved unedited.

## Claims (verify, do not trust)
1. Backtests now use real daily closes (Yahoo) for 19 assets and alternative.me fear and greed, 2023-01-01 to 2026-09-28, in `data/px-daily.js` built by `data/build-px.mjs`. Non-trading days of stocks, indices and gold carry the previous close. Seeded prices are only a fallback.
2. The chat AI writes a `[STRATEGY {...}]` tag (asset, depth, tp, sl, fng, trend, period, name). The client validates it (`tfAiStrategy` in index.html), shows a sheet card, and "과거로 돌려 보기" opens the common backtest `#/share/bt/mine`. The AI is told to disclose what it had to change to fit the engine and not to invent numbers.
3. Fear and greed cap: a buy happens only when that day's index is at or below the cap.
4. Codex P1s from `qa/mine/CODEX_RAW_REVIEW.md` are fixed: re-answered conditions recompute; stale results cannot start a bot; the terminal uses the same engine and asset prices (`tfMkBt`, `tfSPx`); win rate and pnl units; copied period.
5. Following is free (`PROFIT_SHARE` 0, share UI hidden when 0). Before an exchange is connected, the follow dialog does not ask for a budget or show a balance; it shows three steps and "거래소 연결하기".

## What to do
- Spot-check prices in `data/px-daily.js` against the real market for a few dates you can verify (BTC, ETH, S&P 500, gold). Check alignment: index 0 is 2023-01-01, last is 2026-09-28, `idxToDate`.
- Look for look-ahead bias or unit errors in the engine with real data (fees, stop fills at close, fear and greed timing, carried prices for stocks on weekends: can the rule buy or sell on a carried price?).
- Try to break the AI tag path: malformed JSON, unknown asset, extreme values, a tag plus SETUP, a stock with fng.
- Check the follow dialog both states and every place a profit share or fee still appears.
- Verdict: P0 and P1 blockers, then P2. Keep it short.

## Live app
`http://127.0.0.1:8765/index.html`, CDP 9333. `localStorage.clear()`, reload, `tfQaPreset('02')`. AI tag path without the network: `tfAiStrategy({asset:'비트코인',depth:'deep',tp:15,sl:-7,fng:25,period:'1y',name:'x'})` then click the card button. Follow dialog: `mkFollowSheet(encodeURIComponent('코인 셋 나눠 담기'))`; connected state needs `tfS().api={ex:'bitget',last4:'abcd'}`.

## Attached images
1 chat with AI sheet card, 2 backtest ready, 3 backtest result (real BTC, fear and greed cap 25).
