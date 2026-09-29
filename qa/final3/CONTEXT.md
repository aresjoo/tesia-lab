# Third inspection context for Codex

You are a fresh reviewer. Follow `qa/CODEX_REVIEW_PROMPT.md`. Read-only: do not edit any product file and do not write inside the repository. Your final message is saved unedited. Write in Korean, compact, tables where possible.

The previous inspection (`qa/final2/CODEX_RAW_REVIEW.md`) left one P1 blocker, F01-R: after changing the UID and starting the check, a reload restored the previous UID as verified. It also reported the support button covering text at 1280 px. Claude says both are fixed (`qa/final2/CLAUDE_RESPONSE_TO_CODEX.md`). Do not trust that. Do not assume the changes are improvements.

## What to do
1. Reproduce F01-R yourself in the live app with the on-screen buttons: verify 38291042, press 바꾸기 on the account step, type another number, press the button, reload after about 150 ms. Repeat with other delays and numbers. Also try reloads after changing the exchange and after changing the path.
2. Try to break the account state in any other way you can think of.
3. Check the 1280 px result screen for anything covering content.
4. Look for regressions in the replay and the result (F02, F03 must still hold).
5. State clearly whether you accept the journey. If not, list only remaining P0 and P1 blockers. List P2 items separately.

## Material
- `qa/final3/verify-reload-log.txt`, `qa/final3/verify-log.txt`, `qa/final3/walk-log.txt` (and under `w1280`, `w390`, `d1-w1440`).
- Source: `artifacts/teth-redesign/tools/bt-go.js`, `bt-c.js`. Running page: `index.html`.

## Attached images (in this order)
1 F01R-reload-150ms, 2 F01R-reload-after-exchange-change, 3 F01-a-uid-failed, 4 F01-b-after-continue, 5 F01-c-changed-uid-needs-api, 6 F01-d-success-valid, 7 F02-pick-reason, 8 w1280 S05, 9 w1280 S09, 10 w1280 S13, 11 S04, 12 S05, 13 S13, 14 S15, 15 w390 S05, 16 w390 S13, 17 d1 S05.

## Live app
Static server `http://127.0.0.1:8765/index.html`, headless Chrome with CDP on port 9333. Load the page, run `tfQaPreset('02')`, set `location.hash='#/share/bt/h3'`, call `btStart()`. Activation: `btUse()`, address `#/share/bt/h3/go`. Write any captures outside the repository.

## Known external limits
Real sign-up, card, UID and API verification are outside this repository. Failures are triggered by test inputs: UID of all zeros or all nines, API key starting with BAD, NOTRADE or WD, card starting with 0000.
