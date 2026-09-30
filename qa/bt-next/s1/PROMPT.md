# TETH: next actions after a bad backtest result. Design critique before build

You are reviewing a product decision before it is built. Do not write code. Do not modify any file. Read only.

## Context
TETH is a Korean AI trading product. A user makes a strategy in chat (natural language) or copies a public one, then runs a backtest. Attached, in order:
- S1: the current result screen for a bitcoin strategy. The strategy made +11.8% while simply holding made +95.7% ("그냥 들고 있었다면"). The only next actions today are "이 전략 실행하기" (lime, primary) and "조건을 바꿔 다시 돌리기" (a small link that only lets the user change the period and the starting amount, which are already chosen on the setup screen before running).
- S1b: the bottom of the same screen.
The founder's own case was a user-made strategy ("새 전략" chat) with +47.1% versus +273.4% for holding; pressing the link and getting only a period and amount dialog felt wrong, since the user wanted to change the strategy rules.

Read `qa/16-fixes/FLOWS.md` sections 2 and 3 for how this fits the flow matrix. You may read `index.html` to understand what exists (search for `btFinish`, `btResultRail`, `mkFollowSheet`, `gNew`), but the question is product design, not code.

## Proposal to criticize
When the result is bad (worse than holding, or negative return):
- Primary: "규칙 고치기". Returns to the chat that created the strategy. TETH speaks first with 2 to 3 concrete rule changes grounded in the result (for the founder's case: the take profit at 8% sold too early and the position was held only 25% of the days). The user answers in words or taps a chip. Changed rules save as a new version and re-run. The result screen then shows "이전 +47.1% → 이번 +N%".
- Secondary: "새로 만들기". Starts a new chat with this result attached as context and TETH suggesting different approaches.
- "이 전략 실행하기" moves to third, visually quiet.
- The period and amount link is removed from the result screen.
- For a copied public strategy the rules cannot be edited, so the primary becomes "이 전략을 바탕으로 새로 만들기" (its settings carried into my chat).
When the result is good, "이 전략 실행하기" stays primary and the two actions above become small links.

## Answer these, short and concrete
1. What is wrong or missing in this proposal? Name the failure the user would hit.
2. "Bad" threshold: worse than holding, negative return, both, or something else (max drawdown, too few trades)? Argue for one rule a beginner can understand.
3. Should TETH speak first with proposals, or first ask what the user wants to keep? Pick one and say why, for a beginner.
4. Versioning: a new version each time versus overwrite. What must the user see to trust the before and after comparison?
5. Wording: give the exact Korean labels for the buttons and TETH's opening line for the founder's case, in formal 합니다체, no jargon (do not say "익절"; say "산 가격보다 8% 오르면 파는 조건").
6. One cheaper alternative that gets 80% of the value.

Standing founder rules (do not flag these): no regulatory disclaimers, no "example/simulation/demo" labels, no em dash, no middle dot, TETH's own commission structure is never shown.

Answer in Korean. Be direct.
