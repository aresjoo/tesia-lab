# Review context: old strategy validation page retired

You are an adversarial reviewer. Read-only: do not edit any product file and do not write inside the repository. Your final message is saved unedited. Write in Korean, compact, tables where possible. Ignore compliance and disclaimer concerns (founder rule).

## What changed (claims by Claude, verify them)
The founder decided to remove the old strategy validation page (`#/strategy/backtest`: condition table, TETH SCORE with an 80 point gate, "추천 설정으로 다시 검증", a broken chart area saying "이 자산은 차트 미리보기를 지원하지 않아요", the word 시뮬레이션). The founder also removed the 80 point execution gate.

1. A strategy built in chat (asset, style, budget, period, allowed drop) now becomes a rule strategy `mine` and runs in the common backtest screen `#/share/bt/mine`. The period chosen in chat becomes the default period.
2. Old routes `#/strategy/backtest`, `#/strategy/report` redirect to `#/share/bt/mine`, `#/strategy/connect` to `#/share/bt/mine/go` when a validated result exists. `#/strategy/done` (start page) stays.
3. When the backtest result appears, the validation record used by the rest of the product (`t.cur`, `t.score`) is filled from that result, so the start page and the running bot use the same numbers the user saw.
4. Activation for `mine` ends with "다음은 전략 시작이에요" and goes to the start page instead of the copy setup.
5. The rule engine treated a missing take profit (style 공격적) as 0%, selling at any gain. It now means no take profit.
6. Gate: `TFC.score.pass` is 0, fallbacks that turned 0 into 80 are fixed, gate wording removed.
7. Assets without price data (삼성전자) show a message and go back instead of a fake result. 나스닥 종합 maps to 나스닥.
8. Back from the `mine` backtest goes to the chat, not to the strategy list.

## What to do
1. Verify each claim in the live app and in the code. Try to break it: change the chat conditions and come back (does the result recompute or show a stale one?), reload in the middle, go back and forward, open old bookmarks `#/strategy/backtest`, `#/strategy/report`, `#/strategy/connect`, `#/strategy/done` in different states (no result yet, result, connected), copy another user's strategy (tfSS3Copy path) and see where it lands.
2. Find other places where the 80 point gate or score wording still blocks or appears to the user.
3. Check that numbers stay consistent from the backtest result to the start page and the running strategy.
4. For each attached screenshot: SHIPPED OR PROTOTYPED, one sentence. The start page (M06) is the old design; judge it anyway.
5. Verdict: accept or not. List P0 and P1 blockers, then P2.

## Material
- `qa/mine/verify-mine-log.txt` (desktop) and `qa/mine/w390/verify-mine-log.txt` (mobile): output of `qa/verify-mine.mjs`.
- Source: `artifacts/teth-redesign/tools/bt-c.js` (btMine, btMineDone, btRoute), `bt-go.js` (btGoNext, btFinal), `bt-b.js`, `rd-ui.js` (tfSSFind, tfSS3Rid), `agent-core.js` (engine). Base code in `index.html`: `tfRoute`, `tfVerifyGo`, `tfIntakeDone`, `tfDoneView`, `tfStartStrategy`. Gate constant in `teth-copy.js`.
- Diff: `git show c792e84` and `git show e1fc869`.

## Attached images (in this order)
Desktop 1440: 1 M01 ready, 2 M02 replay, 3 M03 result, 4 M04 activation, 5 M05 connected, 6 M06 start page. Mobile 390: 7 M01, 8 M03, 9 M05, 10 M06.

## Live app
Static server `http://127.0.0.1:8765/index.html`, headless Chrome with CDP on port 9333. Load the page, `localStorage.clear()`, reload, run `tfQaPreset('02')`. To set chat conditions: `var t=tfS(); t.intake={asset:{i:0,label:'비트코인'},assetInfo:tfAssetLookup('비트코인'),style:{i:0,label:'공격적으로'},budget:{i:1,label:'500만원'},period:{i:0,label:'최근 1년'},stop:{i:0,label:'-3%까지'}}; t.qi=TF_QS.length; t.stage='ready'; tfSave();` then `tfVerifyGo('x')`. Write captures outside the repository.
