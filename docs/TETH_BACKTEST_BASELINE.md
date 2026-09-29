# TETH backtest baseline (working memory)

Date 2026-09-29. Product is a single file SPA, `index.html` (about 18,800 lines, CRLF), dark theme, Korean copy. Baseline screenshots: `qa/baseline/b01..b10`.

## Relevant routes
| Route | Function | Note |
|---|---|---|
| `#/strategy/backtest` | `tfWorkView` 10135, `tfWorkRun` 10165 | chat funnel verification. Needs login and intake |
| `#/strategy/report` | `tfReportView` 10294 | only reachable when TETH SCORE is 80 or more |
| `#/strategy/connect` | `tfConnectView` 10396, `TF_AC` sheet 15922 | activation choice, UID + API on one form, card form |
| `#/strategy/done` | `tfDoneView` 10505 | start, paper start, later |
| `#/share/s/<id>` | `tfSS3Route` 12236 | strategy detail (overview, info, full trade list) |
| `#/share/copy/<id>` | `cpSetupRoute` | follow sheet |
| new: `#/share/bt/<id>[/<stage>]` | `btRoute` | this work |

Router: `tfRoute` 15427 on `hashchange`. `gContent` clears unknown hashes, but keeps `#/share/`, so the new flow lives under `#/share/bt/`.

## Worth preserving
- Tokens: dark surfaces `--g0..3`, text `--gt, --gt2, --gt3`, borders `--gb`, green `#2fb98a`, red `#f0566a`, lime CTA `#c8f43c`, number font `.num` (Geist Mono).
- Page chrome: `tfPageMode`, `tfHead` (back button + title), left icon rail.
- Chart language of the strategy detail: thin line, green above base and red below, soft gradient fill, white Max and Min labels, hover cursor with dashed line (`mkdChartHtml` 16333).
- Glossary underline and popover (`mkGloss`), term tooltip (`mkdTerm`).
- Engines with events: `mkRunCfg(cfg,startI)` returns `{eq, trades, events, state, ret, mdd, winRate, n, pf, sharpe, mddStartI, mddEndI, avgHold, exposure, costImpact}`. Events: `enter`, `exit{why}`, `veto{a, up, of, rsi, bounce}`, `pick{top}`, `unpick`, `skip`, `hold`.
- Mock verification rules: UID of all zeros is not found, API key starting with BAD is invalid.
- Strategy identity: glyph (`mkGlyph`), name (`mkHook`), one-liner (`mkOne`), kind label (`MK_KIND`).

## Current visual hierarchy and interaction (baseline)
- b01 to b03 (verification): a TradingView widget of the live market fills the left 60%. It has nothing to do with the backtest: no trades, no equity, no period. Right rail: strategy conditions, then a five-row checklist that ticks every 0.5 s, then TETH SCORE.
- b04, b05 (report): small canvas chart with triangles, four KPIs of equal weight, text blocks, one blue CTA.
- b06 to b08 (connect): four-step stepper, recommended Bitget card, card alternative with price, then one form asking UID, API key and secret together.
- b09 (done): summary rows and three buttons.

## Obvious UX problems
1. The wait is a checklist. Nothing on screen shows the strategy being replayed. The big chart is decoration.
2. Process and result are different objects. The checklist is replaced by a score card.
3. A score gate (80 of 100) blocks the user from the report. The first thing a user sees can be "기준 미달".
4. The result leads with a synthetic score instead of what happened to the money.
5. No decision evidence. Vetoes, skipped entries and reasons exist in the engine but are not shown in this flow.
6. Four KPIs have equal weight. No worst period on the chart.
7. Activation starts with "TETH 활성화 ... 둘 중 하나가 필요해요" which reads as a paywall. The choice is framed by price and by payment mechanics.
8. UID and API are requested on one form. The reason for each is a small caption.
9. The card form carries a label that the founder banned ("시뮬레이션 데이터예요").
10. Strategy context is lost in the connect screens.
11. Only rule strategies of the old engine can enter this flow. AI and hybrid strategies cannot be backtested by the user.

## Architectural constraints
- One HTML file. New code is added as its own block (`BT_CORE`, `BT_CSS`) generated from `artifacts/teth-redesign/tools/bt.js` and `bt.css` by `apply2.cjs`, so the flow has clear module boundaries without a build system.
- No lint, typecheck or build exists in the repo. Verification is syntax check of the script blocks, the regression script, and browser runs through CDP.
- State is saved with `tfS()` and `tfSave()`. The new flow keeps its state under `tfS().bt`.
- Korean only for new strings (same as all recent code).

## Target experience (decided after the forensics)
One page, one chart. The chart is drawn while the user waits and stays as the result.

1. S01 ready: strategy identity, "내가 정한 것" (period, amount) and "TETH가 채운 것" (rules in plain words), one button.
2. S02 to S04 replay, about 14 s, skippable: equity line drawn day by day with a moving date cursor, buy, sell and skipped-signal markers, live counters, a pinned status sentence, a six-row step list that keeps a number as evidence, and a decision feed. For hybrid strategies with a gate the feed shows the chain 규칙 신호, AI 확인, 보류 with the numbers that caused it.
3. After the replay: metrics settle, the worst period is shaded on the same chart, the rail turns into the result.
4. S05 result: money sentence first, then largest drop, wins, trade count. TETH's read in three sentences including one weakness.
5. S06 to S08 evidence: monthly bars, decision list with expandable detail linked to the chart, trade list with expandable detail, closed drawer for technical metrics.
6. S09 activation choice: "검증은 끝났어요. 어떻게 실행할지 골라 주세요." Two cards: keep my exchange, or a TETH partner exchange. Strategy summary stays on screen.
7. S10, S11 card path: card, then pick the exchange and connect it.
8. S12 to S14 partner path: exchange, account check (UID), trading connection (API), each on its own screen with one sentence of purpose.
9. S15 success and preview of the final setup. The flow ends here.

Primary scenario for screenshots: `h1` 기술주 회복 기다리기 (hybrid with gate), 최근 1년, 1,000 USDT. Engine result: +34.6%, largest drop -22.7%, 12 trades, 7 wins, 6 entries held back by the AI.
