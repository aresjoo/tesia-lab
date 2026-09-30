# TETH: next actions after a backtest result. Screen review (fresh context)

Assume this feature may have made the product worse. Judge the pixels and the flow from scratch. Do not modify any file.

TETH is a Korean AI trading product. A user makes a strategy in chat, runs a backtest, and sees a result screen. When the result is bad (worse than simply holding, or a loss), the result screen now offers "규칙 수정하기" (edit rules) which returns to the chat that created the strategy; TETH proposes exactly one rule change with its trade-off; a proposal card shows the rule before and after; "수정한 규칙으로 다시 검증하기" re-runs the backtest and the new result shows a comparison with the previous run. Copied public strategies cannot have their rules edited, so they get "다른 전략 만들기" instead.

Attached in order:
- R0 the chat where the strategy was created (strategy sheet card)
- R2 result, bad, my own strategy (+25% versus +273% for holding)
- R4 the chat after pressing "규칙 수정하기": TETH's message and the proposal card
- R5 the backtest setup screen after "수정한 규칙으로 다시 검증하기"
- R6 the new result with the comparison block on the right
- R3 result, bad, a copied public strategy
- R1 result, good, a copied public strategy

You may read `index.html` (search `rvActs`, `rvCompare`, `rvProposal`, `rvFix`) and `qa/bt-next/DECISIONS_1.md`.

For each screen answer: does a beginner know what to do next within 3 seconds? What contradicts another screen? Then list defects as P0/P1/P2 with a concrete fix and exact Korean wording (formal 합니다체, no jargon such as 익절, no em dash, no middle dot). Check specifically: the comparison block claims "같은 기간, 같은 시작 금액, 같은 가격 자료" (is it true from the screens?), whether the proposal changes exactly one rule, whether the old link "조건을 바꿔 다시 돌리기" is gone, whether the good result screen still leads with running the strategy, and whether the copied strategy screen makes it clear why rules cannot be edited. End with: ready to show the founder, yes or no, and the three changes that matter most. Korean, short.
