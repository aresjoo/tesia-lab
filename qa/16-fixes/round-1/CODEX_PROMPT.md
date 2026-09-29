# TETH 16-fixes, Round 1 review (you are the independent reviewer)

You are reviewing a Korean AI trading product called TETH. The founder annotated 16 screenshots (S01 to S16, attached first, in order). Each annotation is a product requirement. The implementer (another agent) then changed the product. The remaining attached images are captures of the CURRENT product, taken from a real browser. File names start with the requirement id (R01 to R16).

You have read access to the working tree. Useful files:
- `qa/16-fixes/REQUIREMENTS.md`: the implementer's reading of the 16 requirements and the acceptance criteria.
- `qa/16-fixes/round-1/*.txt`: text logs from the capture runs (state values, extracted screen text).
- `qa/16-fixes/R11-conversions-full.txt`: the list of automatic sentence-ending conversions to the formal 합니다 style.
- `index.html`: the whole single-file app. Do NOT modify any file. Review only.

## What the founder asked for (short form)
- 01 Guest presses "backtest with my conditions": open the existing sign-up/login overlay, then resume THIS strategy's backtest after auth.
- 02 "TETH's interpretation" must come from a real AI call, with loading, generated, retry and failed states.
- 03 Decision history must work with 100+ decisions: summary first, filters, paging, plain language, chart sync.
- 04 Remove "skip to result". The replay must feel like an AI judging the market, using only point-in-time facts.
- 05 Remove the cheap chips from the activity timeline.
- 06 Remove category counts and the long taxonomy paragraph.
- 07 Language setting only. All money in USD. No currency setting.
- 08 Exchange connection page is a conversion page: TETH invite (free forever, fee rebate: Binance 20, OKX 20, Bybit 20, MEXC 20, Bitget 20, WOO X Pro 50, Gate 50) versus paid (about 280 USD per month). One-click authorization. No API key entry.
- 09 Complete activation state machine, including no-account guidance, 24/7 human support, invite-account check in plain words, card success and failure.
- 10 The activation modal must be state-aware: keep the chosen exchange, skip what is already satisfied.
- 11 Korean copy in the formal 합니다/입니다 style everywhere. Buttons without sentence endings.
- 12 A full Settings page modeled on ChatGPT settings. Account deletion needs a real confirmation.
- 13 Billing section: plan, payment methods, billing info, history, cancel. An invite (partner) user must not see a fake subscription.
- 14 AI Trading entry: landing, Start, auth, choose execution method, connect, terminal. No forced strategy choice.
- 15 Strategy list cards: remove "follow", prominent white "copy strategy" button, quiet "details".
- 16 Strategy detail: primary "copy strategy", strong secondary backtest with plainer wording.

Founder priorities, in order: visual completeness, user trust, desire to activate, conversion, beginner comprehension, information hierarchy, state consistency, implementation correctness.

Standing founder rules (do not flag these as problems): no regulatory disclaimers, no "example/simulation/demo" labels, no em dash, no middle dot, TETH's own commission structure is never shown.

## Your job
Judge the CURRENT pixels and the current flow. Be strict. Do not reward effort.

1. For each of the 16 requirements give a verdict: PASS, PARTIAL or FAIL, with the evidence (image file name, or file and line).
2. List defects as P0, P1, P2. For each: which image or code location, what is wrong, what the user would feel, and the concrete fix you recommend.
3. Look specifically for: states that contradict each other across screens, copy still in the casual 해요 style, any remaining KRW or currency selector, any place that still asks for an API key, any activation step that asks again for something already done, clipped or overlapping text, weak visual hierarchy, buttons that look cheap, and AI text that uses information from after the decision date.
4. Check the automatic sentence-ending conversion list for unnatural or wrong Korean and name the worst cases.
5. End with the five changes that would raise the quality most.

Write the answer in English or Korean. Be concrete and short. Do not soften.
