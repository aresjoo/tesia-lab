# Round 1 context for the Codex review

You are reviewing implementation V1 of the TETH backtest to activation journey. Follow `qa/CODEX_REVIEW_PROMPT.md` exactly. You are read-only: do not edit any product file, do not write any file. Your final message is the review and it is saved unedited.

## Attached images (in this order)
1. S01-backtest-ready
2. S02a-preparing (0.4 s after start)
3. S02-early-processing (first opportunity, AI review stage)
4. S02b-first-decision
5. S03-mid-processing (an opportunity the AI skipped)
6. S03b-between-events
7. S04-final-processing
8. S05-results-above-fold
9. S05b-results-hover (pointer on the chart)
10. S06-results-evidence
11. S07-decision-detail (a skipped decision expanded)
12. S08-trade-detail (a losing trade expanded)
13. S08b-result-full-page (whole page, tall)
14. S09-activation-choice
15. S10-card-path
16. S11-exchange-connection (own exchange, checks running)
17. S12-partner-exchange (partner path, exchange and account step)
18. S13-uid-verification (checks running)
19. S14a-api-form
20. S14-api-connection (checks running)
21. S15-success
22. S15b-success-own-exchange
23. X01-uid-not-found (failure state)
24 to 29. Six frames of the replay sequence taken about 1.8 s apart: seq f002, f006, f010, f014, f018, f022 (file names carry the elapsed milliseconds).

All main screenshots are 1440 x 900, Korean UI, dark theme. More files are on disk: `qa/round-1/seq/` holds 24 frames of the replay at about 0.45 s spacing, `qa/round-1/w1280/` and `qa/round-1/w390/` hold the same walk at 1280 and 390 px wide, `qa/round-1/d1-w1440/` and `qa/round-1/r1-w1440/` hold the walk for an AI decision strategy and a rule strategy. `qa/baseline/` holds the old flow for comparison.

## Route and state sequence (implemented)
| State | Where | How it is reached |
|---|---|---|
| S01 ready | `#/share/bt/h1`, phase ready | strategy detail page, button "내 조건으로 백테스트" |
| S02 to S04 replay | same page, phase run | button "과거를 다시 돌려 보기" |
| S05 result | same page, phase result | replay ends or "바로 결과 보기" |
| S06 to S08 evidence | same page, below the fold | scroll, or click a summary number under the chart, or click a marker on the chart |
| S09 to S15 activation | `#/share/bt/h1/go`, one page | button "이 전략 실행하기". Steps expand in place: 실행할 곳, then 이용료 결제 or 내 계정 확인, then 거래 연결, then the success state |
| after S15 | existing follow setup sheet | button "운용 금액 정하러 가기" (out of scope, not built here) |

Strategy used: `h1` 기술주 회복 기다리기. Hybrid: the AI picks one of 8 US tech stocks every 20 days, a rule buys after a dip and a one-day bounce, and the AI holds the entry back when fewer than 4 of 8 stocks are in an uptrend. Period: last 1 year. Start amount 1,000 USDT. All numbers are computed by the product's engine for that period (`mkRunCfg`): +34.6%, largest drop -22.7%, 12 closed trades, 7 wins, 18 opportunities of which 12 entered and 6 skipped by the AI. Buy and hold of the same 8 stocks: +49.7% (shown as the dotted line). The strategy lost to buy and hold in this period and the product shows that.

## Replay timing (measured in the browser, this run)
- Total from click to result: 11.3 s. Preparation 0.8 s, replay 9.9 s, wrap 0.6 s.
- The duration is not fixed. It is computed from the content: quiet days pass at a constant speed (about 2.6 s for the whole period), and the replay stops at opportunities (1.0 s for the first three with AI review, 0.43 s for later ones, 0 for repeats that are merged). A strategy with fewer decisions takes less time.
- A skip control is always present ("바로 결과 보기").
- With reduced motion the replay is skipped and the result is shown directly.

## Live app
Static server: `http://127.0.0.1:8765/index.html`. Headless Chrome with CDP on port 9333 is running. To reach the flow: load the page, run `tfQaPreset('02')` (logged-in test user), then set `location.hash='#/share/bt/h1'`, then call `btStart()`. Activation: `btUse()`. The walk script is `qa/walk.mjs` (do not run it with the output folder of this round; if you want your own captures write them outside the repository).

## Source
- `artifacts/teth-redesign/tools/bt-a.js` (computation, replay plan, chart), `bt-b.js` (page, ready, replay, result), `bt-c.js` (evidence, routing), `bt-go.js` (activation), `bt.css`. They are assembled into `index.html` between `/*BT_CORE_BEGIN*/` and `/*BT_CORE_END*/`, and `/*BT_CSS_BEGIN*/` and `/*BT_CSS_END*/`.
- `docs/TETH_BACKTEST_BASELINE.md`: what existed before and the target experience.
- `docs/QUANTPILOT_FORENSICS.md`: Part 1 timeline, Part 2 adopt, adapt, reject table, Part 4 motion rhythm and its translation. Key frames of the video are in `docs/qp-frames/`.

## What Claude already suspects is weak (attack these first, and find what Claude missed)
1. S03: when the opportunity is late in the period the callout has no room on the right and is moved above the chart, over the legend and the strategy meta line.
2. S02a: the first 0.8 s shows only the dotted reference line and a counter in the step list.
3. The rail changes its whole content twice (settings, then steps and feed, then summary).
4. Monthly bars in S06 are small and their labels are tiny.
5. S10 card form is plain.
6. The summary numbers under the chart in S05 may read as a second KPI strip competing with the rail.
