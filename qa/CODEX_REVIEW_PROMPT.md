# Codex adversarial review prompt (TETH backtest to activation journey)

You are the adversarial product and implementation reviewer. Claude is the implementer. You are READ-ONLY: do not edit any product file. Your only output is your review (the final message). Neither model is automatically correct. The goal is critical acceptance, not agreement.

Review the ACTUAL RENDERED PRODUCT. The screenshots attached to this prompt as images are the primary evidence. Inspect the repository only where it helps explain what you see. You may also open the running app (address given in the round context) to watch the live transitions.

## Product scope under review
STRATEGY READY -> BACKTEST START -> BACKTEST PROCESS / WAITING -> BACKTEST RESULT -> "USE THIS STRATEGY" -> ACTIVATION METHOD -> A) pay by card and use the existing exchange, or B) connect or join a TETH partner exchange -> CONNECTION SUCCESS and next-step preview. Nothing after that is in scope (no live trading terminal).

## What TETH is (not a PineScript generator)
Four strategy types all use backtesting:
- Type A rule strategy: user picks assets, deterministic conditions trade.
- Type B AI decision strategy: AI decides asset, allocation, entry, exit, or to stay inactive.
- Type C hybrid: AI selects, rules trade.
- Type D hybrid: a rule triggers, AI has a veto. Skipped trades stay visible in the decision history.
The backtest is "replay this strategy through the past and show me what it would have done". The interface explains behaviour, not implementation.

## Target psychology
1. I understand what TETH is doing. 2. It looks like TETH is doing serious work. 3. I can see evidence instead of being told to trust AI. 4. It is sophisticated but I do not need to understand everything. 5. The result feels earned. 6. I want to continue. 7. Connecting my account feels like the natural next step, not a sales interruption.
Deep underneath, simple on the surface. Progressive disclosure: plain-language result, then evidence, then technical detail on request.

## Attack from these perspectives
A first-time beginner, B skeptical trader, C impatient user, D high-intent user who liked the backtest, E visual product designer, F conversion designer, G interaction designer, H frontend engineer, I information visualization designer.

## Look for
Unclear hierarchy, attention going to the wrong element, excessive cognitive load, jargon, fake-looking AI patterns, generic AI aesthetic, weak credibility, weak evidence, boring wait states, unjustified complexity, insufficient complexity, visual imbalance, poor spacing, alignment problems, awkward chart proportions, weak typography, low legibility, redundant content, CTA competition, conversion drop-off, abrupt commercial transitions, screens that feel cheap or templated or like a dashboard generator, animations that do not communicate state, anything QuantPilot does meaningfully better, anything TETH should intentionally do differently.

## Per-screenshot inspection (mandatory, every screenshot S01 to S15)
For each screenshot state:
1. FIRST VISUAL FOCUS
2. INTENDED FIRST FOCUS
3. HIERARCHY PROBLEMS
4. BEGINNER COMPREHENSION
5. PERCEIVED TRUST
6. PERCEIVED PRODUCT DEPTH
7. INFORMATION DENSITY
8. CONVERSION RISK
9. VISUAL QUALITY ISSUES
10. EXACT RECOMMENDED CHANGE

Screens: S01 Backtest Ready, S02 Early Processing, S03 Mid Processing, S04 Final Processing, S05 Results Above the Fold, S06 Results Evidence Section, S07 Decision Detail, S08 Trade Detail, S09 Activation Choice, S10 Card Path, S11 Exchange Connection, S12 Partner Exchange, S13 UID Verification, S14 API Connection, S15 Success.

## Processing sequence (judge as a sequence, not as stills)
EARLY: does something meaningful begin immediately? MIDDLE: does the user see accumulating evidence? LATE: does anticipation increase before the result? RESULT TRANSITION: does the final result feel like the conclusion of the work shown before it? The user should feel "I watched this result being built". If processing and results feel like two unrelated screens, the experience has failed.

## QuantPilot reference
Read `docs/QUANTPILOT_FORENSICS.md`. For every important judgement ask: what evidence from the QuantPilot reference supports or contradicts this decision? Compare on perceived computation, visible effort, progressive evidence, waiting-state quality, analytical seriousness, result reveal, visualization quality, interaction cadence. Do NOT compare on number of controls, amount of jargon, number of parameters, or raw interface density. TETH should often be simpler than QuantPilot while feeling equally or more intentional.

## Issue format (mandatory for every meaningful issue)
ISSUE ID / SCREENSHOT / EXACT ELEMENT / WHAT IS WRONG / WHY A USER CARES / HOW IT AFFECTS TRUST, CLARITY, MOMENTUM, CONVERSION / PROPOSED CHANGE / EXPECTED EFFECT.
Generic comments such as "improve spacing", "make it cleaner", "add more polish" are not acceptable.

## Product constraints fixed by the founder (do not argue against these)
- Korean UI. No em dash and no middle dot character in copy.
- No legal, compliance, disclaimer or risk-warning copy. Do not ask for it.
- No labels such as demo, simulation, example, mock, prototype in the UI.
- Never expose how TETH is paid by partner exchanges (commission structure).
- Bitget is a confirmed partner. Partner path is "join or connect a TETH partner exchange".
- The order is backtest first, then the question of how to run it.
- Do not request a redesign of unrelated navigation or the live trading terminal.

## Final section of your review
- Top 10 issues by impact on the target psychology.
- The single weakest screen and why.
- What QuantPilot still does better, and what TETH now does better.
- A verdict on each link of the chain: SIMPLE INPUT -> VISIBLE INTELLIGENCE AT WORK -> EARNED RESULT -> UNDERSTANDABLE EVIDENCE -> DESIRE TO USE THE STRATEGY -> NATURAL ACTIVATION.

Round 2 only: treat the current implementation as a fresh product. Do not assume Round 1 changes are improvements. Re-evaluate them from evidence. Identify regressions, overcorrections, inconsistencies across the journey, and any screen that falls below the quality of the others.

## Visual quality is a first-class acceptance criterion
The customer only sees the pixels. A technically correct screen that looks like an AI-generated dashboard, a component library demo, a hackathon prototype, a generic crypto terminal, or a rough admin panel is a failure. Be harsh.

For every major screenshot answer explicitly: DOES THIS LOOK SHIPPED OR PROTOTYPED? and explain why, pointing at concrete pixels. "Looks clean" is not an answer.

Identify: generic-looking, cheap-looking, unfinished-looking or template-looking sections; inconsistent component quality between screens; weak typography; awkward proportions; low-quality chart styling (line weight, grid, axes, markers, annotations, tooltip, padding); poor motion; empty areas that break the premium feeling; visual regressions between steps; KPI blocks that look detached from the chart.

Two benchmark questions per major screenshot: if the logo disappeared, would this still look like a top-tier trading or AI product? Would the founder be comfortable putting this screenshot on the homepage as proof of product quality?

The activation flow must look like the same premium product as the backtest, not like account settings or KYC onboarding. The tested strategy must remain the narrative object through the whole activation.

## Notes on how to read the states
S01 to S15 are review states, not separate pages. The backtest (S01 to S08) is one page whose state evolves. The activation (S09 to S15) is one page where steps expand in place. Judge continuity accordingly: does the result look like the matured state of the processing screen, and does the activation keep the strategy in view?

The duration of the replay is not fixed. The requirement is the shortest duration that still makes the result feel earned. Flag any dead time, and flag any moment that passes too fast to be understood.

The differentiator that must be visible during the replay is: rule signal, then TETH AI review, then decision (enter or skip), with one human-readable reason, leaving a visible artifact on the chart. The final report must connect back to those decisions (counts that lead to clickable evidence). Judge whether a viewer would have SEEN decisions being constructed before the result appears.
