# Re-inspection context for Codex (after the final verification)

You are a fresh reviewer. Follow `qa/CODEX_REVIEW_PROMPT.md`. You are read-only: do not edit any product file, do not write any file inside the repository. Your final message is the review and it is saved unedited.

The previous verification (`qa/final/CODEX_RAW_REVIEW.md`) did not accept the journey because of three P1 issues: F01, F02, F03. Claude says they are fixed (`qa/final/CLAUDE_RESPONSE_TO_CODEX.md`). Do not trust that. Treat the current implementation as a fresh product and do not assume the changes are improvements.

## What to do
1. F01, F02, F03: verify each in the rendered product. Reproduce F01 yourself in the live app if you can (UID 000000 fails, then 실행할 곳 바꾸기, same path, 계속). Try to break it in other ways: change the exchange, change the path and come back, change the UID while a check is running, reload the page in the middle. State FIXED, PARTLY, NOT FIXED or WORSE with what you saw.
2. The partial items: R03, R09, R11, the support button at 1280 px, the notification bell on mobile.
3. Regressions and new defects from these fixes.
4. Verdict for each link of the chain: SIMPLE INPUT, VISIBLE INTELLIGENCE AT WORK, EARNED RESULT, UNDERSTANDABLE EVIDENCE, DESIRE TO USE THE STRATEGY, NATURAL ACTIVATION.
5. For each attached main screenshot: SHIPPED OR PROTOTYPED, one sentence.
6. State clearly whether you accept the journey. If not, list only the remaining blockers (P0 and P1).
Keep it compact. Tables where possible. Write in Korean.

## Material
- `qa/final2/verify-log.txt`: output of `qa/verify-f.mjs` (the reproductions, read from the DOM and from the state).
- `qa/final2/walk-log.txt` and the same file under `w1280`, `w390`, `d1-w1440`, `r1-w1440`, `h1-w1440`.
- Source: `artifacts/teth-redesign/tools/bt-a.js`, `bt-b.js`, `bt-c.js`, `bt-go.js`, `bt.css`. The running page is `index.html`.

## Known facts about the walk script (not product behaviour)
- r1 runs on OKX. The walk does not type a passphrase, so its API step stays open ("after api api"). Its X02 check clicks the OKX tile, which is already selected, so nothing is cancelled there.
- The failure state X01 in the walk is prepared by setting the state directly. The honest reproduction of F01 is in `verify-f.mjs`.

## Attached images (in this order)
Reproductions: 1 F01-a-uid-failed, 2 F01-b-after-continue, 3 F01-c-changed-uid-needs-api, 4 F01-d-success-valid, 5 F02-pick-reason, 6 F03-travel-1, 7 F03-travel-2, 8 F03-travel-3, 9 F03-travel-4, 10 R09-all-activity-d1.
Main scenario h3, 1440 x 900: 11 S01, 12 S02, 13 S03, 14 S03c, 15 S04, 16 S05, 17 S06, 18 S07, 19 S08, 20 S09, 21 S11, 22 S10, 23 S12, 24 S13, 25 S14, 26 S15.
27 w1280 S05. Narrow 390 x 844: 28 S03, 29 S05, 30 S07, 31 S13, 32 S15.
33 d1 S05, 34 d1 S07. 35 h1 S05. 36 r1 S05.

## Live app
Static server `http://127.0.0.1:8765/index.html`, headless Chrome with CDP on port 9333. Load the page, run `tfQaPreset('02')`, set `location.hash='#/share/bt/h3'`, call `btStart()`. Activation: `btUse()`. Write any captures outside the repository.

## Known external limits
Real partner sign-up address, real card, UID and API verification, and the public API management addresses of the exchanges are outside this repository. Failures are triggered by test inputs: UID of all zeros, UID of all nines, API key starting with BAD, NOTRADE or WD, card starting with 0000.
