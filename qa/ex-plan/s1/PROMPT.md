# TETH exchange connection redesign: design critique before build

You are reviewing a brief before it is built. Do not write code. Do not modify any file. Read only.

Read `qa/ex-plan/BRIEF.md` first (Korean). It specifies a redesign of TETH's exchange connection into a ChatGPT-style "plan" page with two cards (free via TETH invite account, or $280/month subscription), a ChatGPT-style checkout, one-click exchange authorization, invite-account check, and a KYC check.

Attached, in order:
- ref-A: ChatGPT plan upgrade, desktop (the visual and copy reference)
- ref-B: ChatGPT plan configuration and checkout (reference for the paid path)
- ref-C: ChatGPT plan upgrade, mobile
- current-brokers-desktop: TETH's current exchange connection page
- current-brokers-mobile: the same on mobile
- current-backtest-good: TETH's backtest result screen that would feed the plan page (case 1 and 5 in the brief)

Context you can read: `qa/16-fixes/FLOWS.md` (flow matrix), `qa/16-fixes/REQUIREMENTS.md` section on R08 to R10, `index.html` (search `acStep`, `acSteps`, `acPageView`, `acBRoute`, `acBPay`, `AC_CFG`) for the existing activation state model that the new screens must keep using.

Answer in Korean, short and concrete:
1. What in the brief will fail for a first-time user? Name the exact screen and moment.
2. The brief highlights the free card with the gradient (ref-A highlights the paid one). Right call or not, and why, given that the free path needs a new exchange account for many users?
3. Copy: rewrite the free card and the paid card in ChatGPT's Korean tone (label, title, description, price, CTA, 5 to 6 items, footnote). Then the checkout right-side card and the auto-renew sentence. Formal 합니다체, no jargon, no em dash, no middle dot, no disclaimers.
4. KYC: where in the flow should the check sit so the user is never told "connected" and then blocked? Propose the exact step order and the wording when KYC is missing.
5. The backtest result card placed left of the two plan cards (cases 1 and 5): does it help conversion or distract? If it stays, what must it contain and what must it not.
6. Mobile: order of the cards and what collapses.
7. Anything in the brief that contradicts the existing activation state model or FLOWS.md.
8. The one cheaper version that gets 80% of the value.

Standing founder rules (do not flag): no regulatory disclaimers, no "demo/example" labels, no em dash, no middle dot, TETH's commission structure is never shown, buttons never end with a sentence ending.
