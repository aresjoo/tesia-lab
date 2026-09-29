# Round 1: Claude's response to the Codex review

Source: `qa/round-1/CODEX_RAW_REVIEW.md` (saved unedited from the real Codex CLI 0.153.4, model gpt-6-astra, 29 screenshots attached as image inputs, `index.html` checksum identical before and after the review).

Codex verdict: V1 not accepted. Chain verdicts: simple input partial, visible intelligence FAIL, earned result partial, understandable evidence partial, desire FAIL, natural activation partial. Weakest screen S03.

I agree with the verdict. The two failures are real and they are the two things this journey exists for.

## Decisions

| Issue | Decision | Reasoning and what is implemented |
|---|---|---|
| I01 ready screen leads with the benchmark number; "TETH가 채운 것" mixes strategy rules with assumptions | ACCEPT | Before the run the large number is the start amount. The benchmark result moves to a label at the end of the dotted line. The rail is split into "이 전략의 규칙" and "백테스트 조건". |
| I02 decisions cannot be read (AI review visible for about 0.1 s in later stops) and five places change at once | MODIFY | Codex proposes 2 to 3 s for one representative buy and one representative skip. I accept the principle (few decisions read fully, the rest pass complete and short) but not a fixed number: the first buy and the first skip get a full read, sized by the amount of text (about 2.2 s), every other decision appears already complete for 0.5 s. The on-chart callout is removed. A fixed decision panel directly under the chart shows signal, AI review, decision in three columns. The status sentence is merged into that panel so one place explains the event. The feed receives the decision only when it is final. |
| I03 balance shows 999 USDT before the buy | ACCEPT | Real causality bug. Until the decision is revealed the cursor, the line and the balance stay on the previous day. |
| I04 callout leaves the chart and covers the legend, on mobile the balance | ACCEPT | Solved by the fixed panel of I02. Nothing floats over the chart during the replay except a small pulse on the point. |
| I05 feed cards fade to 0.3 opacity, skip button moves | ACCEPT | Cards keep full contrast. The feed has a fixed height and shows the last three decisions. The skip control is pinned in the header of the rail. |
| I06 buy and winning sell share a colour, no marker legend, grouped skips open only one item | ACCEPT | Buy is a filled triangle, sell is an outlined triangle coloured by result, skip is an outlined diamond. The legend names all three. A grouped marker opens the skip filter and selects the first decision of the group. Markers are focusable and react to Enter. |
| I07 the counter row changes meaning between run and result, the rail is replaced, the final balance is repeated | ACCEPT | The counter row has the same four cells in the same order during the run and in the result. The day counter lives in the panel and in the step list. The result rail keeps a one-line record of the finished work. The rail no longer repeats the balance: it states the profit and the comparison. |
| I08 the interpretation ignores that the strategy lost to buy and hold | ACCEPT | This is the most important honesty gap. The first sentence of the reading is the comparison in USDT, the second gives a factual reason that can be checked (share of days invested, and both largest drops). No claim is made about what the AI skips would have earned. |
| I09 tooltip shows an event from another day without its date | ACCEPT | The tooltip prints the event with its own date, and clicking the chart at that position opens that decision. |
| I10 monthly bars small, partial months counted as full | ACCEPT | Bars are taller, values are 12 px, partial first and last months are labelled, the sentence counts only what it shows. On mobile the row scrolls horizontally with values visible. |
| I11 "기회 18번" opens a list that also contains picks and sells; evidence column leaves the right side empty | ACCEPT | New filter "기회" shows exactly buys and skips. "전체 활동" is separate. The evidence moves into the main column so the sticky rail (summary and CTA) stays beside it while reading. |
| I12 "되돌림 점수" unexplained, the uptrend count cannot be inspected | ACCEPT | The label gets the glossary underline. The detail lists the stocks that were counted as rising on that day (computed from prices with the engine's rule: price above its 60 day average). "당시 확인한 조건" and "그 뒤 가격" are separate blocks. |
| I13 same buy and sell price but -0.2%, chart title does not match its range | ACCEPT | The trade detail splits price change, fees and final result. The holding period is shaded, the title is "매수 전후 가격". Prices of tokenized assets are shown in USDT like the balance. |
| I14 partner versus own account is ambiguous for someone who already has a Bitget account | ACCEPT | Options are named by account condition: "TETH 제휴 계정으로" and "지금 쓰는 계정 그대로", each with one line saying who it is for. Both logo lists come from the same table. |
| I15 card step called payment, payDone set at registration, exchange support checked after the card | ACCEPT | Step is "결제 카드 등록", summary "등록됨". No paid flag is set. In the own-account path the exchange connection now comes before the card, so the user confirms their exchange works before typing a card. |
| I16 clipped permission badge (CSS selector collision) | ACCEPT | Rendering defect. Badge classes renamed, step number selector scoped. |
| I17 API help hidden in a small link, button says "연결하기" while checking, green checks before verification | ACCEPT | Three short steps are visible above the inputs and follow the chosen exchange (OKX lists three values). Required permissions are neutral before verification. The button reads "연결 확인 중" and is really disabled. |
| I18 failure leaves the user alone, join link opens the exchange home page | MODIFY | The error is attached to the input, the field keeps its value and gets focus, and two recovery actions appear (try another number, create a new account). The real partner sign-up address is outside this repository, so the link still opens the exchange site. Listed as an external blocker. |
| I19 mobile and 1280 px: primary action below the fold | ACCEPT | Mobile ready screen: settings and start button before the chart. Mobile result: CTA pinned at the bottom of the viewport. Mobile activation: strategy summary is one compact row. At 1280 x 800 the rail is tightened so the CTA is inside the first viewport. |
| I20 stale check callbacks after a selection change | ACCEPT | Checks carry a run id and stop when it changes. Inputs and tiles are disabled while checking. |
| I21 "남은 단계" scope unclear, success adds three more steps | ACCEPT | The header says "계정 연결까지 N단계". The success state names one next action (운용 금액) and mentions the rest in one line. |
| I22 "AI 판단 52번" mixes re-evaluations and per-stock buys | ACCEPT | AI strategies count re-evaluation days, stocks bought, and evaluations that bought nothing. Rule strategies show buys, winning trades and losing trades instead of three identical numbers. |
| S08b is not a full page capture | ACCEPT | The walk script now captures the whole scroll area. |

## One decision that goes beyond the review
Codex marked DESIRE as failed because the demo strategy lost to buy and hold and the product did not say what to make of it. I08 fixes the explanation. In addition the primary QA scenario changes from `h1` to `h3` (지수와 금 짧게, same hybrid type with AI veto). For the last year the engine gives +19.0% against +13.0% for holding, and a largest drop of -3.8% against -5.3%, with 15 opportunities of which 8 were skipped. Nothing is tuned: both strategies run through the same engine and `h1` stays in the capture set as the losing case, because the losing case is where the honesty of the reading is tested.

## Rejected
None of the 22 issues is rejected. Two proposals inside them are not followed as written:
- Fixed 2 to 3 s for representative decisions (I02): the duration is derived from the amount of text instead.
- Exact partner sign-up link (I18): needs data that is not in the repository.
