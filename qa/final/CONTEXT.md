# Final verification context for Codex

Two adversarial rounds are done. This is the inspection of the final rendered product after the Round 2 fixes. Follow `qa/CODEX_REVIEW_PROMPT.md`. You are read-only: do not edit any product file, do not write any file. Your final message is the review and it is saved unedited.

## What to do
1. Verify from the rendered product (attached images, and the live app if you want) whether each Round 2 issue R01 to R18 is really fixed. For each: FIXED, PARTLY, NOT FIXED, or WORSE, with the evidence you saw. Do not trust the claims below.
2. Look for regressions and new defects introduced by the Round 2 fixes. Assume they may have made things worse.
3. Give the verdict for each link of the chain: SIMPLE INPUT, VISIBLE INTELLIGENCE AT WORK, EARNED RESULT, UNDERSTANDABLE EVIDENCE, DESIRE TO USE THE STRATEGY, NATURAL ACTIVATION.
4. For each major screenshot: SHIPPED OR PROTOTYPED, one sentence of reason.
5. State clearly whether you accept the journey, and if not, list only the blockers (P0 and P1) that remain.
Keep the review compact: tables where possible.

## Material
- `qa/round-2/CODEX_RAW_REVIEW.md` (your Round 2 review) and `qa/round-2/CLAUDE_RESPONSE_TO_CODEX.md` (decisions and what was implemented).
- `qa/round-2/*.png` for before and after comparison.
- `qa/final/walk-log.txt`: texts read from the DOM at each state, counts of revealed markers, the top feed record, and the measured widths on the result screen. Same files exist under `qa/final/w390/`, `qa/final/w1280/`, `qa/final/d1-w1440/`, `qa/final/r1-w1440/`, `qa/final/h1-w1440/`.
- Source: `artifacts/teth-redesign/tools/bt-a.js`, `bt-b.js`, `bt-c.js`, `bt-go.js`, `bt.css`.

## Claims by Claude (verify)
| Issue | Claim |
|---|---|
| R01 | Travel ends on the day before an opportunity. The opportunity day belongs to the stop. Feed, markers, counts and balance change only when the decision is revealed. A start state exists before day one. In the log, S03a and S03b show the previous record on top of the feed and an unchanged marker count, S03 shows the skip. |
| R02 | During the replay every skip is its own marker at its own date. Grouping exists only in the finished chart, positioned at the first date of the group. Clicking a group opens the skip list, selects the first decision of the group and tints the rows of the group. |
| R03 | The panel head is the present. While travelling the cells are dimmed and the head shows "마지막 판단" with its date. |
| R04 | The two representative decisions give each stage its own time (0.9 s, 1.0 s, 1.3 s). Later decisions appear complete for 0.42 s, at most seven of them, the rest only leave a marker. The separate counter row is removed. At the end the panel cells turn into the summary and stay in place in the result, where they are links to the evidence. The feed box is not reserved: it appears with the first decision as one-line records. Measured total for the main scenario 13.3 s, rule strategy 7.4 s. |
| R05 | Mobile result: chart, panel, evidence and rail all measure 358 px in a 390 px viewport (see widths in the log). Detail charts fit the column. |
| R06 | Mobile: rules and conditions are collapsed sections. The skip control is in the panel head. The re-run action is visible in the result. The activation summary row shows the return, the period and a link to the result. |
| R07 | The first cell says why this asset was the candidate ("AI가 고른 종목, 60일 상승률 1위 +14%"), and the detail has a row for it. |
| R08 | Reading is three sentences: verdict against holding including the drop, behaviour, caveat. h1 says it earned less and fell further. r1 says it earned much less but fell less. |
| R09 | AI strategy: 74 re-evaluations, one row per day with its outcome, 74 rows behind the link. Holds are counted (28). Rule strategy: winning and losing trades filter the trade list. |
| R10 | AI strategy skip reasons come from the event. A skip with 4 of 8 rising now reads "살 만한 종목 0개" and "살 종목이 없어 쉬었어요". |
| R11 | Worst period is a bar along the time axis with a label. Detail charts use a 400 unit view box with 12 px type. Same-day buys are merged, markers shrink when there are more than 60. |
| R12 | Rows: badge for the action, asset as title, comparable reason ("오름세 1 / 3, 기준 2"). Shortcuts to the first buy and the first skip. |
| R13 | Selecting an option updates the steps below and the label of the continue button. |
| R14 | "바꾸기" only opens the step. Data is cleared only when the choice really changes. |
| R15 | A link opens the API management page of the chosen exchange in a new tab. |
| R16 | While checking, the form collapses to the target line and the checks. On failure the form returns with values and the error on the field. |
| R17 | New account branch: the primary button opens the sign-up page, the UID field appears after "가입을 마쳤어요". No time promise. |
| R18 | Card step header: "Binance 연결을 마쳤어요". Next step wording: "계정에서 사용할 금액". |

## Attached images (in this order)
Main scenario h3, 1440 x 900: 1 S01, 2 S02a, 3 S02, 4 S02b, 5 S03a, 6 S03b, 7 S03, 8 S03c, 9 S04, 10 S05, 11 S05b, 12 S06, 13 S07, 14 S08, 15 S08b full page, 16 S09, 17 S11a, 18 S11, 19 S10, 20 S15b, 21 S12, 22 S12b, 23 S13, 24 S14a, 25 S14, 26 S15, 27 X01.
Narrow viewport 390 x 844: 28 S01, 29 S03, 30 S05, 31 S07, 32 S08, 33 S13, 34 S15.
35 w1280 S05. 36 h1 S05. 37 d1 S03, 38 d1 S05, 39 d1 S06. 40 r1 S05.

## Live app
Static server `http://127.0.0.1:8765/index.html`, headless Chrome with CDP on port 9333. Load the page, run `tfQaPreset('02')`, set `location.hash='#/share/bt/h3'`, call `btStart()`. Activation: `btUse()`. Write any captures outside the repository.

## Known external limits
Real partner sign-up address, real card, UID and API verification, and the public API management addresses of the exchanges are outside this repository. The repository has no lint, typecheck or build.
