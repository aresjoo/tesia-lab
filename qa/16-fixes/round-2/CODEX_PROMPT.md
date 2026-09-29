# TETH 16-fixes, Round 2 review (fresh context)

You are an independent reviewer. You have no memory of any earlier review.

Assume the Round 1 fixes may have made the product worse. Do not reward effort. Judge the current pixels and current flow from scratch.

TETH is a Korean AI trading product. The founder annotated 16 screenshots (S01 to S16, attached first, in order). Each annotation is a product requirement. The remaining attached images are captures of the CURRENT product from a real browser (desktop 1440 wide, files ending in `-m` are 390 wide mobile). File names start with the requirement id.

You have read access to the working tree. Do NOT modify any file. Useful files:
- `qa/16-fixes/REQUIREMENTS.md`: requirement reading and acceptance criteria.
- `qa/16-fixes/round-2/*.txt`: logs from the capture runs (state values, extracted screen text).
- `index.html`: the whole single-file app. `site-config.js`, `teth-copy.js`, `help-widget.js`.

## Requirements (short form)
- 01 Guest presses "check performance with my conditions": open the existing sign-up/login overlay, then resume THIS strategy's backtest after auth.
- 02 "TETH's interpretation" must come from a real AI call, with loading, generated, retry and failed states.
- 03 Decision history must work with 100+ decisions: summary first, filters, paging, plain language, chart sync.
- 04 No "skip to result". The replay must feel like an AI judging the market, using only point-in-time facts.
- 05 No cheap chips in the activity timeline.
- 06 No category counts, no long taxonomy paragraph.
- 07 Language setting only. All money in USD. No currency setting.
- 08 Exchange connection page is a conversion page: TETH invite (free, fee rebate: Binance 20, OKX 20, Bybit 20, MEXC 20, Bitget 20, WOO X 50, Gate 50) versus paid (280 USD per month). One-click authorization. No API key entry.
- 09 Complete activation state machine, including no-account guidance, 24/7 human support, invite-account check in plain words, card success and failure.
- 10 State-aware activation: keep the chosen exchange, skip what is already satisfied, handle an expired subscription.
- 11 Korean copy in the formal 합니다/입니다 style everywhere. Buttons without sentence endings.
- 12 A full Settings page modeled on ChatGPT settings. Account deletion needs a real confirmation.
- 13 Billing: plan, payment methods, billing info, history, cancel. An invite (partner) user must not see a fake subscription.
- 14 AI Trading entry: landing, Start, auth, choose execution method, connect, terminal. No forced strategy choice.
- 15 Strategy list cards: no "follow", prominent white "copy strategy" button, quiet "details".
- 16 Strategy detail: primary "copy strategy", strong secondary backtest with plainer wording.

Founder priorities, in order: visual completeness, user trust, desire to activate, conversion, beginner comprehension, information hierarchy, state consistency, implementation correctness.

Standing founder rules (do not flag these): no regulatory disclaimers, no "example/simulation/demo" labels, no em dash, no middle dot, TETH's own commission structure is never shown.

Known and declared limits (already reported to the founder as open work, judge everything else): there is no exchange partner authorization API, no invite-account lookup API, no payment processor, no auth server and no live support channel behind this front end. Do not spend your review restating that. Do flag any screen whose wording or state contradicts another screen.

## Your job
1. For each of the 16 requirements give a verdict: PASS, PARTIAL or FAIL, with evidence (image file name, or file and line).
2. List defects as P0, P1, P2 with location, what is wrong, what the user feels, and a concrete fix.
3. Look specifically for: contradictions between screens, leftover casual 해요 style, leftover KRW or USDT money amounts, any API key entry, any activation step that asks again for something already done, clipped or overlapping text (check the mobile images), weak hierarchy, cheap-looking controls, unnatural Korean produced by automatic conversion, and replay screens that reveal information from after the replay date.
4. End with: is this ready to show to the founder as finished, yes or no, and the three changes that matter most.

Be concrete and short. Do not soften.
