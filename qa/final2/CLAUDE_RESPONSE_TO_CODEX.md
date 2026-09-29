# Claude response to the Codex re-inspection (qa/final2)

Source: `qa/final2/CODEX_RAW_REVIEW.md`, unedited output of the Codex CLI. Verdict received: not accepted, one P1 (F01-R). F02, F03, R03, R09, mobile bell FIXED.

| Issue | Decision | Why | What changed | Evidence after the fix |
|---|---|---|---|---|
| F01-R reload brings back the previous verified UID | ACCEPT | The invalidation lived only in memory for up to 700 ms because the shared save function is delayed. | Every state change of the activation flow is written to local storage at once (`btSave`). | `qa/verify-reload.mjs`, log in `qa/final3/verify-reload-log.txt`: reload 60, 150, 400 and 1100 ms after confirming a changed UID, four different numbers, all return to the UID step with the typed number and no verification. Reload after a full connection keeps the done state. Reload 80 ms after an exchange change keeps nothing verified. FAILS 0. |
| 1280 px support button covers the last sentence of the reading | ACCEPT | Moving it away from the button put it over text. | The button now avoids text, numbers, fields and actions of this journey. When no free place exists at that width it steps back instead of covering content. | `qa/final3/w1280/S05-results-above-fold.png`. |
| R11 dense markers for d1 | ACCEPT as direction, not done in this pass | Grouping in the result state only is compatible with R02. It needs its own design for mixed buy and sell groups. | No change. | Reported as remaining, P2. |
| Replacing an API key fails and the old key stays without explanation | ACCEPT as P2, not done | The state is correct, the wording is missing. | No change. | Reported as remaining. |
