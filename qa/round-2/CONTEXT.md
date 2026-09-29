# Round 2 context for the Codex review

This is a fresh review. Follow `qa/CODEX_REVIEW_PROMPT.md` exactly, including the section "Round 2 only". You are read-only: do not edit any product file, do not write any file. Your final message is the review and it is saved unedited.

## How to judge this round
- Treat the current implementation as a fresh product. Do not assume Round 1 changes are improvements. Re-evaluate them from evidence.
- Assume the Round 1 fixes may have made the product worse. Look specifically for: overcorrection, new clutter, hierarchy regressions, inconsistent spacing, excessive explanations, weaker emotional momentum, disconnected processing and result states, activation becoming too long, loss of beginner readability, visual quality mismatch between sections, and fixes that technically close an issue while making the full flow worse.
- Judge the JOURNEY, not whether Round 1 tickets were closed. This round is meant to be harder than Round 1.
- Compare the QuantPilot video with the TETH experience on: perceived effort, perceived depth, evidence density, process visibility, interaction cadence, analytical seriousness, waiting experience, result presentation. Not on pixel similarity.
- For every major screenshot answer: DOES THIS LOOK SHIPPED OR PROTOTYPED, and the two benchmark questions.

## Round 1 material (read it, then distrust it)
- `qa/round-1/CODEX_RAW_REVIEW.md`: the Round 1 review (22 issues, verdict not accepted, chain verdicts: visible intelligence FAIL, desire FAIL).
- `qa/round-1/CLAUDE_RESPONSE_TO_CODEX.md`: Claude's accept, modify, reject decision for each issue and what was implemented.
- `qa/round-1/*.png`: the Round 1 screenshots, for before and after comparison.

## What changed since Round 1 (claims by Claude, verify them)
1. The floating callout on the chart is gone. A fixed decision panel sits directly under the chart with three cells: 기회 발견, AI 확인, 결정 (two cells for rule strategies). It fills left to right and keeps the last finished decision until the next one.
2. Pacing: the first buy and the first skip are read fully (duration derived from text length, about 2.2 s each). Later decisions appear already complete for 0.44 s. Quiet days pass at constant speed. Measured total for the main scenario: 12.2 s from click to result. A rule strategy with 5 buys takes 6.5 s.
3. Before a decision is revealed the line, the cursor and the balance stay on the previous day.
4. The counter row under the panel has the same cells in the same order during the run and in the result. In the result the cells are buttons that open the matching evidence.
5. Marker language: filled triangle buy, outlined triangle sell coloured by result, outlined diamond skip, with a legend. Grouped skips show a count and open the skip list. Markers are focusable.
6. Result rail: profit in USDT, comparison with buy and hold in USDT, three facts, reading in three paragraphs whose first sentence is the comparison, CTA, one line record of the finished work.
7. Evidence is inside the main column, so the rail with the CTA stays beside it while scrolling. Filters: 기회 (buys and skips only), 매수, AI 보류, 매도, 전체 활동.
8. Decision detail lists which assets were counted as rising that day. Trade detail splits price change, fees and result, and shades the holding period.
9. Tooltip shows the event with its own date. Clicking the chart there opens that decision.
10. Ready screen: the big number is the start amount, the benchmark return is in the legend, the rail has 돌려 볼 조건 with the start button first, then 이 전략의 규칙, then 백테스트 조건.
11. Activation: options are named by account condition. Own account path order is now 실행할 곳, 거래 연결, 결제 카드 등록. Partner path is 실행할 곳, 제휴 계정 확인, 거래 연결. Header says how many steps remain until the account is connected. API guide is visible above the inputs. Checks carry a run id, inputs lock while checking, the button shows the running state. Failure attaches to the input and offers recovery actions.
12. Mobile: settings and start button come before the chart on the ready screen, a pinned CTA bar on the result, a compact strategy row in activation.
13. Primary scenario changed from `h1` to `h3` (지수와 금 짧게, same hybrid type with AI veto). Engine result for the last year: +19.0% against +13.0% for holding the same three assets, largest drop -3.8% against -5.3%, 15 opportunities of which 7 entered and 8 skipped, 7 closed trades of which 4 won. `h1`, which loses to buy and hold, is still captured in `qa/round-2/h1-w1440/`.

## Attached images (in this order)
1. S01-backtest-ready
2. S02a-preparing
3. S02-early-processing (first opportunity, AI review cell active)
4. S02b-first-decision
5. S03a-skip-signal
6. S03b-skip-review
7. S03-mid-processing (first skip, decision revealed)
8. S03c-between-events
9. S04-final-processing
10. S05-results-above-fold
11. S05b-results-hover
12. S06-results-evidence (after clicking the first counter)
13. S07-decision-detail
14. S08-trade-detail
15. S08b-result-full-page (whole page, tall image)
16. S09-activation-choice
17. S11a-exchange-form (own account path, step 2)
18. S11-exchange-connection (checks running)
19. S10-card-path (own account path, step 3)
20. S15b-success-own-account
21. S12-partner-exchange (partner path, step 2)
22. S12b-partner-new-account
23. S13-uid-verification (checks running)
24. S14a-api-form
25. S14-api-connection (checks running)
26. S15-success
27. X01-uid-not-found
28. w390 S01, 29. w390 S03, 30. w390 S05, 31. w390 S13, 32. w390 S15 (narrow viewport)
33. w1280 S05 (1280 x 800)
34. h1 S05 (strategy that lost to buy and hold)
35. d1 S05 (AI decision strategy), 36. r1 S05 (rule strategy)
37 to 42. Six frames of the replay sequence: seq frames in time order (file names carry elapsed milliseconds).

More on disk: `qa/round-2/seq/` (all sequence frames at about 0.42 s spacing), `qa/round-2/w1280/`, `qa/round-2/w390/`, `qa/round-2/h1-w1440/`, `qa/round-2/d1-w1440/`, `qa/round-2/r1-w1440/`, `qa/round-2/walk-log.txt` (texts read from the DOM at each state and the timeline of the replay).

## Route and state sequence
| State | Where | How it is reached |
|---|---|---|
| S01 ready | `#/share/bt/h3`, phase ready | strategy detail page, button "내 조건으로 백테스트" |
| S02 to S04 replay | same page, phase run | button "과거를 다시 돌려 보기" |
| S05 result | same page, phase result | replay ends or "바로 결과 보기" |
| S06 to S08 evidence | same page | scroll, click a counter under the chart, or click a marker or the chart |
| S09 to S15 activation | `#/share/bt/h3/go`, one page | button "이 전략 실행하기". Steps expand in place |
| after S15 | existing follow setup sheet | button "운용 금액 정하기" (out of scope) |

## Live app
Static server `http://127.0.0.1:8765/index.html`, headless Chrome with CDP on port 9333. To reach the flow: load the page, run `tfQaPreset('02')`, set `location.hash='#/share/bt/h3'`, call `btStart()`. Activation: `btUse()`. If you capture anything, write outside the repository.

## Source
`artifacts/teth-redesign/tools/bt-a.js`, `bt-b.js`, `bt-c.js`, `bt-go.js`, `bt.css`, assembled into `index.html` between the `BT_CORE` and `BT_CSS` markers. `docs/QUANTPILOT_FORENSICS.md` (Part 2 and Part 4), `docs/TETH_BACKTEST_BASELINE.md`.

## Known external limits (not defects of this round)
- The real partner sign-up address is not in the repository. The button opens the exchange site.
- Card, UID and API checks are mock checks with fixed failure inputs (UID of zeros, UID of nines, API key starting with BAD, NOTRADE, WD).
- The repository has no lint, typecheck or build. Verification is a syntax check of the four source files, the regression script and the browser walk.
