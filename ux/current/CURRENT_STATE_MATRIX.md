# CURRENT STATE MATRIX — CODEX PHASE 1

- 기준: 2026-09-24 작업 트리. `index.html` 17,729줄(마지막 빈 줄 포함), 1,554,510 bytes, SHA-256 `38014c3867de7a9d8fb65567dff999c8081e39128476b0c03525d17f459c558d`.
- 행 번호는 별도 파일명이 없으면 `index.html` 기준이다. `L9271`은 해당 파일의 9271행을 뜻한다. 주석의 의도가 아니라 실행문을 기준으로 판정했다.
- 정적 추적 + 원본 함수의 Node VM 격리 실행을 수행했다. 브라우저 클릭·화면 렌더링은 미확인이다. 제품 코드, 저장된 사용자 상태, AGENTS.md는 수정하지 않았다.
- `t = S.tf = tfS()`, `b = t.bill = bcInit()`, `sx = G.sessions[]`. **미정의(undefined)를 false/null 기본값과 구분**한다. 아래의 저장 위치 `t`는 로그인 시 STORE가 직렬화하는 계정 상태다.
- 범위: 사용자 자격·연결·과금·전략·화면·복귀를 결정하는 상태. 차트 좌표, 애니메이션 프레임 등 표현 전용 지역 변수는 제외한다.

## 1. 저장 경계와 최상위 상태

| 변수 / 저장 위치 | 타입·기본값 | 대표 set | 대표 read / 의미 |
| --- | --- | --- | --- |
| `S.user` | null 또는 `{name,email?}`; null | 최초 L5045; 로그인 L7786; 복원 L8417; 로그아웃 L17629 | 라우트 L15049–15052, 자격 L12873, 새 대화 L7269 |
| `S.tf` | 미정의 → 객체 | `tfS` L9272; restore L8418; logout L17636 | `tfS` L9271–9274를 통해 모든 tf/cp/bc 화면 접근 |
| `S.view`, `S.stage` | `'home'`, null | L5045; `show` L5071. `setStage`는 DOM만 바꾸며 S.stage를 갱신하지 않음 L5087–5097 | classic 화면 선택 L5068–5085; 기본 UI의 `G.mode`와 별개 |
| `S.strategy` | null → `newStrategy()` 객체 | L5100–5101, L7272; 세션 선택 L7207 | 조건 질문·인라인 검증 L7596–7599; `sx.strategy` 미러 |
| `S.versions`, `S.activeVer` | `[]`, 0 | L5046, L7207, L7272 | 연구 문서·실행 확인 L7933–7945, L8119 |
| `S.liveOn`, `S.paused`, `S.liveMode` | false, false, 미정의 | classic `startLive` L5668, pause L5707, stop L5727 | classic 실행 UI L5691–5703; `t.strat[].status`와 별개 |
| `S.pendingBacktest` | false | classic 로그인 게이트 L5411; 완료 L5422 | 가입 후 classic 백테스트 재개 |
| `S.fbLog`, `S.alerts` | 미정의; snapshot에서는 `[]` 폴백 | restore L8419–8420; logout은 alerts만 비움 L17636 | 저장 L8361; 연구/알림 부가 기록. 상업 자격 입력 아님 |
| `G.mode` | `'home'` | L6617; 각 view 함수, 동적 `tfPageMode` L9423 / `tfNFView` L13095 | 화면별 재렌더 L15890–15896; 전체 화면은 FLOW_MAP 참조 |
| `G.sessions`, `G.cur` | `[]`, null | 새 세션 L7273–7276; 선택 L7204–7207; 복원 L8422–8426 | 연구 기록 L8248; 개인화 인사이트 L14241; 이전 대화 복귀 L15764–15771 |
| `G.tabs`, `G.activeTab`, `G.openDoc` | `[]`, null, 미정의 | L6617, L7209, L7289, L7948 | 아티팩트 문서/대화 탭. openDoc는 URL이 아님 |
| `G.pendingRun`, `G.pendingNew` | false, 미정의 | 연구 인증 L7779; 새 대화 인증 L7269 | 가입 후 소비 L7817–7819 |
| `sx.status`, `sx.live`, `sx.liveMode`, `sx.livePaused` | 생성 시 draft/false; 나머지 미정의 | L7273–7275; run L7828; live L8158; pause/stop L8179–8187 | 세션 선택 L7212–7215; 일정 L8286. `status=run` 복원 시 stopped로 변경 L8423 |
| `sx.strategy`, `versions`, `btHist`, `ai`, `step`, `pendingChips`, `rawIntent` | 기본 전략, `[]`, 나머지 지연 생성/null | L7273–7275; `taiAI` L8345–8348; 인라인 검증 L7601; step L7431 | 저장 L8370–8376; 세션 복원·분기 L7207, L16710–16733 |
| `sx.strategyAt`, `t.strat[].sessionId` | 미정의 → 전략 at / 세션 id | 연구→터미널 L8144–8150 | 중복 방지 L8136. `strategyAt`은 snapshot의 세션 필드 목록에 없음 L8370–8376 |

**영속화 규칙**: `STORE.save/flush/flushNow`는 S.user가 없으면 쓰지 않는다(L8358, L8381, L8387). `teth.state`에 user·tf 전체·최대 20개 연구 세션·lastSid 등을 저장한다(L8359–8393). localhost `/api/state` 경로가 있으면 POST/GET도 시도하며, 로컬과 서버 중 savedAt이 최신인 스냅샷을 택한다(L8392–8412, L16798–16800). 서버의 실제 실행 여부는 미확인이다. 따라서 “localStorage만 존재”로 단정할 수 없다. 기본 UI는 `ANTIGRAVITY_RESEARCH_UI=true`이며 classic shell을 숨긴다(L6542–6550, L16829–16836).

## 2. 계정 자격·연결·위임 작업 상태 전수 목록

| 변수 (`t.*`) | 타입·기본값 | 대표 set | 대표 read |
| --- | --- | --- | --- |
| `uidLinked` | boolean, NF 초기화 false | L12585; UID 확인 L9863; Fast API L13329; QA L15845 | `tfEnt` L12876–12877, `bcTier` L12846, 거래소 L15445 |
| `uid` | string/null, null | L9272; UID 확인 L9861; QA L15845 | 비즈니스 게이트는 uid 자체를 검사하지 않음. `uidLinked` 판정과 분리 |
| `api` | object/null, null | API 확인 `{ex,last4}` L9917; QA `{ex,uid}` L15847 | 완료 L9925; 터미널 하단 L10780; 거래소 상태 L15444 |
| `conn` | boolean, 미정의 | 연결 후 재개 L9704; 나중에 L9953; 시작 L9962; QA 해제 L15848 | 실행 허용 L13452; 업그레이드 유도 L9595, L12246 |
| `ex` | null/string, null | 초기 L9272; 정규 연결 경로는 `ob.ex`, `api.ex`를 씀 | 봇 상세 거래소 폴백 L13376. 실사용 setter는 확인 못 함 |
| `ob.st` | string/null, `'idle'` | 초기 L9273; 새 작업 L9300; plan_free L9732; exchange_selected L9842; referral_opened L9848; uid_pending L9851; uid_verified L9861; api_pending L9843; api_verified L9916; completed L9928 | `tfCnStep` L9678–9682, `tfFreeHtml` L9812–9824 |
| `ob.ex`, `ob.uid`, `ob.err` | null, `''`, null | 선택 L9841; 입력 L9855; 오류 L9860/L9914–9915; 거래소 프리셋 L15463 | 가입·UID·API 화면 L9814, L9826–9827, L9881–9889 |
| `payDone` | boolean, **미정의** | 승인 L9805; QA L15846; reset false L15922 | PRO L12874; 연결 단계 L9681; 거래소 L15445 |
| `plan` | null / `'paid'` / `'partner'`; null | 초기 L9272; 새 작업 null L9299; 선택 L9730; back L9776; 거래소 정규화 L15460 | 결제·파트너 분기 L9681, L9699–9700, L9842; 완료 가격 L9942 |
| `cycle` | `'year'` 또는 `'month'`; year | L9272; L9774 | 결제 초기값 L9731 / L13313. `bill.cycleAt`과 독립 |
| `pay` | 미정의/null 또는 `{step,cycle,num?,exp?,nm?,err?}` | L9731, L9775, L9781, L9804–9805 | 결제 페이지 L9737–9771. step=plan/card/confirm/done |
| `creditBal` | number, NF 초기 0 | L12577; 지급 L12914; 차감 L12931; QA reset L15924 | PRO 자격 L12877; PLAN L13156; 새 `bcBalance`와 별도 값 |
| `creditGrants` | map, `{}` | L12578; 지급 키→timestamp L12914 | 지급 중복 방지 L12913; 경고 모수 L12932 |
| `creditSeen` | map, `{}` | L12588; free L12889 / credit L12928 | 요청별 중복 소비 방지 L12888/L12927 |
| `creditReqs` | string[], `[]` | L12579; 차감 때 push, 최근 60개 L12929 | 구형 차감 기록. creditSeen은 별도라 60개 캡과 무관 |
| `freeUsed` | number, 0 | L12586; free 소비 L12890; QA L15850 | L12880; 소진 시트 L13272; QA L15819. 기간 초기화 없음 |
| `tradeActiveUntil` | epoch ms, 미정의 | live 신규 fill 시 현재+30일 L13685–13687; reset 0 L15924 | L12875–12876, L13177. **거래량 아님** |
| `intake` | object, `{}` | L9272, L9299; 응답 L9334–9342; 연구 변환 L7731; 공유 복제 L12319 | asset/style/budget/period/stop 각각 `{i,label,rec?}`, assetInfo는 자산 메타. 파라미터 L9401–9410; 라우트 L15752 |
| `qi` | number, 0 | L9272; L9306/L9342; 공유 완료 L12320 | 다음 질문 L9319–9324; 작업 충돌 L12227 |
| `ctxAsset`, `sell` | 미정의 → object/null, boolean | 차트 자산·매도 의도 L9301–9306 | ctxAsset L9313/L9341; sell은 이 구간에서 저장 외 판정 read 확인 못 함 |
| `stage` | 미정의 → intake/ready/verify/improve/verified/report/connect/pay/done/live | L9299, L9356, L9392, L9535, L9591, L9694, L9731, L9928, L9962 | 재진입 L9397; 공유 상태 L12345–12355 |
| `cur` | null 또는 검증 결과 | L9272, L9475–9476, L7732–7734, QA L15857 | 리포트·연결 L9590/L9693; 현재 전략과 개별 봇은 별개 |
| `score` | number, 0 | L9272; `tfScore` 결과 L9477 | 실행 기준 L9590/L9693/L9960; 실제 설정은 TFC.score.pass=80 |
| `tries` | number[], `[]` | 초기/재검증 reset L9299/L9392; push L9477 | 개선 상한·이력 L9497/L9528; maxTries=5 (`teth-copy.js` L19) |
| `workDone` | boolean, 미정의 | false L9299/L9392/L9554; true L9477 | 재계산 여부 L9455–9456 |
| `pendingP` | 파라미터 object/null, 미정의 | 작업 시작 L9460; 추천 L9554; 복제 L12320; 편집복귀 null L9560 | **`t.pendingP \|\| tfParams()`** L9456 |
| `cloneFrom`, `followId` | string/null, number/null/undefined | 독립 작업 null L9297; 공유 L12321/L12328–12329; 보관 L12428 | 원본 연결 L9965–9967; 공유 상태 L12343–12351. undefined에는 레거시 닉네임 폴백 |
| `upFor` | string/null, 미정의 | 결과 지문 L9594–9596; 인라인 L7735; QA L15858 | 동일 결과의 업그레이드 시트 반복 방지 L9595 |
| `strat` | bot[], `[]` | 즉시 시작 L9967–9969; 나중에 L13698; 연구 L8144–8149; 삭제 L10760 | 터미널 L10015; 봇 상세 L13340; 인트로 L14610; 공유 L12444 |
| `strat[].status`, `.env` | live/off/ready 등; 생성 경로별 상이 | `tfBotCtl` L13457–13472; 연구 paper L8145–8146; 시작 L13664 | 터미널 상태 L10021; 상세 L13349; 거래 활성 L13685 |
| `strat[]` 나머지 필드 | at/name/p/score/ret/mdd/n/winRate; 선택적 asset/ex/tv/cap/src/fid/key/sym/ver/verHist/sessionId | L8144–8148, L9967–9969, L13698; 수정 L10662–10664 | VM 변환 L10019–10026. 경로별 스키마 차이는 FLOW_MAP |
| `fills`, `fillLog` | fill[], `[]` | 현재 시작 fills 덮어쓰기 L9971; 누적 fillLog L13667–13673 | 봇별 조회 L13346–13347; 거래복기/정산 L13675–13683 |
| `termDemo`, `termDel`, `termClones`, `termLog` | map / string[] / clone[] / map; 지연 `{}`/`[]` | L10003–10005/L10095; 상태 L10115; 복제 L10730–10731; 삭제 L10758–10761 | VM 합성 L10028–10041; 인트로는 termClones만 읽음 L14610 |
| `ss` | `{tab:'find',sort:'ret',asset:'all',dir?}` | L10999; 탭 L11143; 정렬 L11188–11194 | 허브 L11153–11164, 목록 L11179–11183 |
| `follows` | follow[], `[]` | L10999; `{id,nick,asset,p,budget,at,archived?}` L12327–12329; 보관/삭제 L12424–12435 | 따라가는 중 L12337–12411. 실행 봇 자체가 아님 |
| `watch` | 닉네임 string[], 지연 `[]` | 관심 토글 L12170–12173 | 프로필 L11274; 관심 섹션 L12360. **과금 watch와 무관** |
| `shared`, `sharedName`, `sharedSnap` | false, 미정의, 미정의 | 초기 L9272; 마이그레이션 L11000–11008; 공개 L12555–12560; 비공개 L12571 | 공개 목록 L11015–11018; 내 전략 관리 L12443. snap={name,asset,score,ret,mdd,n,winRate,p,srcAt,desc,at} |
| `followers`, `reward` | number, 0 | 초기 L9272 | 내 전략 센터 L12460–12464. 실제 팔로워 증가·보상 적립 setter 미확인 |
| `cp` | `{v:1,spot:1000,copies:[]}` 지연 생성 | L11374–11379 | 카피 설정·대시보드 L11760/L11689 |
| `cp.spot`, `cp.copies[]` | number / copy[] | 시작 L11868–11873; 충전 L11832; 조정 L11468–11472; 종료 L11497–11499 | 카피 잔액 게이트 L11819–11824; cpCalc L11384–11412 |
| `cp.copies[]` 필드 | id/nick/mode/amount/pairs/simStartI/adv/at/status/ledger; 선택적 flatI/closedAt/settle | 생성 L11868–11871; 청산 L11589; 종료 L11497 | `cpCalc` L11385–11411; 상세 L11527–11546. 실행 파라미터 p 스냅샷 없음 |
| `notifs`, `notifKeys` | array/map, `[]`/`{}` | L12580/L12589; notify L12941–12947; 읽음 L13020–13022 | 벨 L12984; 알림 pane L10905–10929; 표시 최대 100개 |
| `notifPrefs` | object, pos/loss/review/rebate/watch/chW=true, chK/chT/chM=false | 초기 L12584; 설정 L13134/L13247–13249 | 발생 시 L13042/L13066/L13676–13678; 설정 화면 L13225 |
| `rebates` | rebate[], `[]` | L12581; `{fid,botId,amt,at,sim}` L13035 | PLAN 정산 L13202–13203; 봇 L13351 |
| `reviews`, `reviewKeys` | array/map, `[]`/`{}` | L12582/L12590; 커밋 L13049–13065 | 복기 L13585; 기간 보고서 L13080; reviews 최대 60개 |
| `periodics` | report[], `[]` | L12583; 생성 L13078–13089 | 기간 상세 L13619–13622; 알림/보고서 pane L10931 |
| `bkSort`, `bkFilter` | 지연 `'order'`, `'all'` | L15385–15386; `tfBkSet(k,v)` L15435 | 거래소 목록 L15388–15409 |
| `bkTab`, `bkCat`, `bkSortR`, `bkPg` | overview, all, rating, page 1의 지연 폴백 | L15467–15470; L15543/L15549; L15316/L15584 | 거래소 상세 리뷰 정렬·페이지 L15546–15559 |
| `bkRev` | 사업자 id→내 리뷰, 미정의 → `{}` | L15705–15707; reset L15923 | 목록 L15420; 상세 L15476. 계정 자격 입력 아님 |

## 3. 새 과금 원장 상태

| 변수 (`b.*`) | 타입·기본값 | 대표 set | 대표 read |
| --- | --- | --- | --- |
| `v` | number, 1 | L12607 | 데이터 버전 표식; 버전별 마이그레이션 분기는 해당 초기화에 없음 |
| `ledger` | entry[], `[]` | `bcAppend` L12854–12858 | 잔액 L12850; 월거래유입 L12700; 월소비 L12704; 청구 L12763 |
| `ledger[]` | `{id,at,type,reason,amt,ref}` | L12857 | type=grant/charge/debit/reset/adjust; reason=welcome/volume/ai/promo/card/cycle/qa/recon-* |
| `seen` | idempotency map, `{}` | L12856; 일 재대사 L12818 | 동일 요청·체결·월 지급 중복 방지. ledger 2,000개 제거 후에도 seen은 남음 |
| `coupons` | array, `[]` | grant L12735–12736; usedAt L12798 | quote L12769–12773; `{id,kind,rate,at,usedAt}` |
| `events` | array, `[]` | `{at,key,data}` L12863; 최대 500개 L12864 | 과금 전이 기록. commercialState를 만드는 정식 집계는 없음 |
| `mode` | active/grace/watch, active | 초기 L12613; 임계 L12668–12680/L12690; 실패 L12807 | AI 게이트 L12901; PLAN 표시 L13173 |
| `graceAt` | epoch ms/null, null | 경고 L12679; 회복 L12670/L12674; 실패 null L12807 | `bcTick` L12689; QA 경과 주입 L15882 |
| `cardOn` | boolean, false | 초기 L12615; 카드 등록/해지 L12744; QA L15863–15864 | 등급 L12846; 결제 사이클 L12793. 일반 Checkout은 안 씀 L9805 |
| `cycleAt` | epoch ms/null, null | 카드 등록 시 +30일 L12745; 성공 +30일 L12800 | 집계 시작일 L12701/L12705; 청구 시점 L12793 |
| `cardFails` | number, 0 | 실패 L12804; 성공 0 L12800 | 3회 이상 watch L12806 (`TFC.billing.DUNNING_RETRY_MAX`) |
| `simPayFail` | boolean, 미정의 | 일반 화면 setter 미확인; 주입용 입력 | `bcPayAttempt` L12776. QA 패널 행에도 없음 L15801–15811 |

## 4. 비영속 화면·복귀 상태와 설정

| 변수 | 기본값·setter | 주요 reader / 영향 |
| --- | --- | --- |
| `location.hash`, `TF_ONSTRAT`, `TF_ONNF`, `TF_ONSHARE`, `TF_RENDERING`, `TF_BOOTED`, `TF_STATE_READY` | 해시; 플래그 false/미정의. L15733–15775, L16819 | 라우팅/복원 L15735–15761; gContent의 hash 제거 L6791–6792 |
| `TF_SS_PREV`, `TF_INS_PREV` | null/미정의; L11144, L14356 | 복귀할 연구 세션 L15766–15771 |
| `TF_INTRO_PEEK` | 미정의; 현재 email/name 키 L14612 | L14610. reload에서 소멸; 게스트 `#/trade`는 별도 인트로 분기 L15049 |
| `TF_NF_RESUME`, `TF_NF_ENV` | 미정의; 실패한 봇 액션 L13461/L13464; paper CTA L9945 | 연결 완료 L9704; 시작 env L9972. 계정 원장에 포함 안 됨 |
| `TF_UP_CTX`, `TF_UP_SKIP`, `TF_UP_FOLLOW_SEEN` | null / 미정의; 시트 L13257; later L13298 | 공유 소프트 게이트 L12246; 완료 후 복귀 L13300–13314 |
| `TF_INS_RESUME`, `TF_BK_RESUME`, `AUTH.draft` | authOpen에서 초기화/입력 캡처 L16864–16867; 각 게이트 L14515/L15452 | signupDone의 서로 다른 분기 L7793–7819 |
| `AUTH.mode,email,doneName,pwDone,cool,rt` | signup/빈 문자열/false, cooldown 지연 생성 L16861–16870 | 인증 단계 L16909–17007; 최종 S.user만 저장 |
| `TF_TM` | sel=null, tab=agent, bot=pos, scope=cur, q='', fst/fex=all, gen=0, tvSym=null, feedN=14, exp={} L10001 | 선택/필터/범위 L10135/L10187/L10768; 동적 fmode L10372–10373 |
| `TF_TM_C`, `TF_TM_CAND`, `TF_EDIT_CAND`, `TF_LOG_MODE` | cache {}, 후보 null, 로그 all L10002/L10570/L13528/L13509 | 재계산·수정 확정 L10054/L10652/L13564 |
| `TF_SS_Q`, `TF_SS_CACHE`, `TF_SS_TOKEN`, `TF_SS3_CP_BUSY`, `TF_CP_DRAFT`, `TF_SS3_OB` | 검색 '', cache null, token 0, busy false; draft 미정의; `{step:1,sel:null,desc:''}` | 검증 콜백 L9461/L9472; 복제 L12248–12323; 공개 L12484–12560 |
| `TF_CPP`, `TF_CPS`, `TF_CPA`, `TF_CPD` | pd=30 / mode=ratio,pairs=null / dir=add / flt=active L11251/L11733/L11415/L11687 | cp 프로필·설정·조정·대시보드. 조정에는 confirmed도 동적으로 사용 L11457–11473 |
| `TFBK_CUR`, `TF_BK2W`, `TF_INS2_ASTQ`, `TF_INS2_PASK` | 거래소/리뷰/질문 임시 컨텍스트 | L15470/L15637, L14483–14502. 상업 엔진 입력 아님 |
| `TAI.ok`, `TAI.req`, `TAI.busy`, `TAI.busyAt` | ok=null; 나머지 지연 생성 L8343 | mock 예외 L12906; 요청 중복 차단 L16333/L16689; logout 취소 L17634–17635 |
| `RESEARCH_V2`, `ANTIGRAVITY_RESEARCH_UI` | 둘 다 기본 true; query/localStorage L6089–6099/L6542–6551 | classic/V2/기본 G 화면 선택 L16813/L16829 |
| `GLC.lang`, `GLC.cur` | ko/USD, localStorage `tethLang/tethCurrency` L17058–17059 | 표시만 변경 L17115–17116. help-widget는 별도 언어 read (`help-widget.js` L14) |
| `TFC.credit`, `TFC.billing`, `TFC.price`, `TFC.score` | 정적 설정 (`teth-copy.js` L9–22/L61–80) | 자격·과금·실행점수. `site-config.js` pricing과 별개 |
| `TETH_CONFIG.aiProxy`, `.pricing`, `.zendeskKey` | 빈 proxy/key; Direct/Partner 가격 (`site-config.js` L12–47) | proxy L16804; 고객지원 `help-widget.js` L72–86. 사용자 플랜 자격을 set하지 않음 |

## 5. 파생 판정 함수

| 함수·행 | 입력 | 출력·정확한 우선순위 |
| --- | --- | --- |
| `tfEnt` L12871–12882 | user, payDone, uidLinked, tradeActiveUntil, creditBal, freeUsed, TFC.credit | guest → paid → trade → credit → free → free-out. high=paid/trade/credit/free; low=guest/free-out. **bill/cardOn을 읽지 않음** |
| `tfAiGate` L12897–12909 | user, bill mode/time, TAI.ok, tfEnt | 게스트 true; welcome 보장→bcTick; watch false(토스트·알림); mock false상태인 TAI.ok이면 true; 나머지는 free-out만 quota sheet 후 false |
| `bcTier` L12844–12848 | uidLinked, cardOn | FREE / UID / CARD / CARD_UID. **user·payDone·api 검사 없음** |
| `bcBalance` L12850–12852 | ledger | amt 전체 합; opening balance 별도 없음 |
| `bcMonthVol` L12700–12703 | ledger, cycleAt | 기간 내 `reason=volume && amt>0` 합. 거래 명목금액이 아니라 **적립 크레딧** |
| `bcMonthSpend` L12704–12707 | ledger, cycleAt | 기간 내 type=debit 음수 금액의 절댓값. ai 외 qa도 포함 |
| `bcMonthInflow`, `bcWarnBase` L12867–12869/L12663 | 양수 ledger, cycleAt, WELCOME_CREDIT | 기간 내 모든 양수 유입; max(유입,100). 집계에 종료 시각 상한 없음 |
| `bcBranch` L12708–12716 | tier, monthVol, monthSpend | FREE→free.out; CARD→card.out; v≤0→uid.novol; CARD_UID→carduid.out; u≥1500→uid.heavy; 나머지 uid.small. **v의 高低 비교 없음** |
| `bcAfterChange` / `bcTick` L12664–12695 | balance, mode, graceAt, src, warn 20%, grace 24h | active→grace는 잔액≤경고선; grace→watch는 잔액≤0이고 24h 경과; watch 회복은 ai 외 src이고 잔액>0. 시간 조건은 함수 호출 때 평가 |
| `bcBillQuote` L12763–12774 | monthVol, monthly=3000, price=$49, 미사용 쿠폰 | offset=min(1,v/3000); net=49×(1-offset)×쿠폰 보정; gross/offset/net/coupon 반환 |
| `bcCycleTick`, `bcPayAttempt` L12776/L12791–12814 | cardOn, cycleAt, simPayFail, cardFails | 만기 성공 시 이전 잔여 reset·다음 주기·충전; 실패 3회 watch. payDone은 갱신 안 함 |
| `tfIntroNeed` L14608–14611 | user, strat.length, termClones.length, TF_INTRO_PEEK, email/name | `!!S.user && !strat.length && !termClones.length && PEEK!==tfIntroUk()`. api/uid/plan/cp/demo 모두 무관 |
| `tfCnStep` L9678–9682 | ob.st, plan, payDone | api_verified/completed=4; uid_verified/api_pending=3; partner 또는 paid+payDone=2; 나머지=1 |
| `tfNFCanRun` L13450–13456 | conn, cur, score | conn이면 true. 아니면 토스트; 현재 cur가 통과했을 때만 connect 이동; false |
| `tfBkConnSt` L15440–15447 | 사업자 conn, user, api.ex, payDone, uidLinked | SOON → GUEST → CONNECTED → NEEDS_PLAN → NEEDS_LINK |
| `tfBk2Conn` L15376 | user, 사업자 conn, api.ex | 사업자별 boolean. tfNFCanRun과 검사 기준 다름 |
| `tfScore` L9564–9574 | winRate,cagr,mdd,tradeVol,n + TFC.score | 가중 점수 5–99; n<4 감소; n<6 최대79; pass는 각 액션이 80과 비교 |
| `tfSSBusy` L12223–12228 | cur, stage, qi, intake.asset | 현재 검증/작업 교체 경고 여부 |
| `tfSSFollowStatus` L12337–12357 | archived, followId/cloneFrom, stage, strat.status/fid/src | label/live/running. 최신 활성 작업이 아니면 보관됨; 봇 전체 상태에서 독립적으로 도출하지 않음 |
| `tfTmAll` / `tfTmCalc` L10013–10086 | strat, demo+overlay, clones / p,cap | VM 합성 목록 / 백테스트·포지션·손익. cp.copies는 제외 |
| `cpCalc` L11384–11412 | copy ledger/amount/flatI/simStartI + 현재 닉네임의 seed 결과 | inv,pnlPct,total,realized,unreal,share,net,est,avail,posOpen 등 |
| `tfIns2PInfo` / `tfIns2PTok` L14232–14247 | user, strat, fills/reviews, intake, sessions / UTC 날짜 | a=관심만, b=live/ready, c=과거/휴면, null=근거 없음/알 수 없는 상태. cp/clones 제외 |

## 6. 모순·중복 플래그

| 비교 | 같은 뜻인가? | 어긋날 수 있는 조합·발생 경로 | 영향을 받는 화면 |
| --- | --- | --- | --- |
| `api` / `conn` / `ob.st` | API 결과 / 실행 허용 / 마법사 진행이므로 다름 | QA api ON은 conn을 켜지 않음(L15847); API 성공 뒤 done만 방문하면 conn 미정의(L9916–9928) | 거래소는 CONNECTED(L15444), 터미널 계좌 표시(L10780), 재개는 차단(L13452) |
| `payDone` / `plan` | 결제 이력과 이번 실행 경로 | 새 전략은 plan=null, payDone 유지(L9299); 이후 partner도 선택 가능(L9730) | PLAN 구독 중(L12874)인데 실행 선택부터 다시 진행(L9681) |
| `payDone` / `bill.cardOn` | 두 독립 과금 체계 | checkout은 payDone만(L9805), QA 카드 등록은 cardOn만(L15864) | PRO 무제한/FREE tier 동시 가능; CARD 잔액 보유/free-out 동시 가능 |
| `uidLinked` / `uid` / `ob.uid` / `api.uid` | 연동 여부 / 입력값 / 초안 / QA API 필드 | Fast API는 uidLinked만 true(L13329); QA api.uid는 uidLinked를 안 켬(L15847) | UID 연동됨 표시는 있으나 거래소 계좌는 미연결; 실제 API 결과에는 uid가 없음(L9917) |
| `creditGrants.uid` / `TFC.credit.uidGrant` | 지급 이력 timestamp / 지급량 설정(1000) | **`t.uidGrant`라는 boolean은 없음**. 지급 후 uidLinked 해제 가능(QA L15845) | 잔액·이력 존재와 현재 자격 분리(L12877) |
| `creditBal` / `bcBalance()` | 구형 잔액 / 새 원장 잔액 | UID는 구형 +1000, 새 원장에는 CARD_UID만 +100 프로모(L13330–13332/L12655–12659) | PLAN PRO/AI watch가 동시 발생(L13162/L12901) |
| `freeUsed` / `bill` AI debit | 무료 횟수 / 금액 소비 | free는 횟수만 증가(L12884–12894); paid/trade는 둘 다 무소비 | 월 사용량으로 free·paid·trade의 AI 사용량 복원 불가 |
| `tradeActiveUntil` / `bcMonthVol()` | 1회 체결 후 만료 시각 / 적립액 누계 | paper도 적립 호출(L13683), tradeActive는 paper 제외(L13685) | 새 원장 거래 유입은 있으나 “파트너 거래 활성 없음” 가능 |
| `stage='live'` / `strat[].status` | 전역 작업 상태 / 개별 실행 상태 | pause는 bot만 off(L13460); stage는 live 유지 | 공유 배지에는 추가 running 보정 필요(L12348–12355) |
| `sx.live/livePaused` / 연구 출처 bot.status | 연구 화면 실행 플래그 / 터미널 실행 상태 | `gLivePause/Stop`은 sx만 변경(L8177–8190); 봇 제어는 bot만(L13457–13475) | 연구에서는 종료, 터미널에서는 실행 중 가능 |
| `t.watch[]` / `bill.mode='watch'` / 로그 watch | 관심 목록 / AI 제한 / 진입 신호 없음 | 동음이지만 서로 다른 데이터 L12170/L12690/L10298 | “관망” 문구만으로 상업 제한 원인 판단 불가 |
| `strat.length` / `termClones.length` / `cp.copies.length` | 모두 전략처럼 보이나 다른 엔티티 | 카피만 active여도 인트로 조건 true(L14610); clone만 있으면 false | AI 트레이딩 첫 화면·개인화 인사이트·공유 대상 불일치 |

## 7. 게이트 검사 지점 목록

로그인·연결·과금 관련 직접 검사와 그 호출 경계를 함께 적었다. 점수/입력 검사도 실행 흐름을 막는 지점을 포함한다. 함수 호출에 검사가 없는 경우를 임의로 “보호됨”으로 표시하지 않았다.

| 함수·행 | 검사 조건 | 실패 동작 / 범위 |
| --- | --- | --- |
| `requestBacktest` L5409–5412 | 버튼 disabled / !user | 반환 / pendingBacktest+signup. classic |
| `gNew` L7269–7270 | !user / !tfAiGate() | pendingNew+signup / 세션 생성 전 반환 |
| `gStartRun` L7779 | !user | pendingRun+signup. bc watch 직접 검사 없음 |
| `gStartRunGo` L7825–7827 | cur 없음 / 다른 session.status=run | 반환 / 토스트. 로그인 이후 연구 실행 경계 |
| `gRptExec` L7722–7724 | 검증 기록 없음 / score<pass | 토스트 후 반환 |
| `gOpen` L7931–7933 | cur 없음 / 버전 없는 결과 문서 | 반환 / 연구 먼저 실행 토스트 |
| `gGoLive` L8155–8157 | cur 없음 / real / 결과 없음 | 반환 / 데모 잠금 토스트 / gToTerminal false. paper는 conn 검사 없음 |
| `tfRoute` L15752–15755 | !user 또는 intake.asset 없음 | 복원 완료면 hash 제거 후 반환. **인증 모달 없음** |
| `tfReportView`, `tfConnectView` L9590/L9693 | !cur 또는 score<pass | `#/strategy/backtest` |
| `tfReportView` L9595–9597 | !conn && !payDone && 새 결과지문 && !TF_EDIT_BOT | 700ms 후 backtest 업그레이드 시트. 소프트 게이트 |
| `tfCnStep` L9678–9682 | ob/plan/payDone | 부족 상태에 맞는 마법사 단계 렌더. 정식 결제 게이트 역할 |
| `tfPayCardNext`, `tfPayConfirm` L9787–9807 | 입력 형식 / confirm 단계 / adapter 오류 | 필드 오류 / 반환 / 카드 단계+오류. 성공은 payDone만 set |
| `tfCnUid` L9853–9869 | UID 5–12자리 / adapter not_found | 필드 오류 / UID 화면 오류 |
| `tfCnApi` L9900–9919 | key/secret 길이, OKX passphrase / ex 변경 / adapter 오류 | 필드 오류 / 늦은 응답 폐기 / API 오류 화면 |
| `tfDoneView` L9925–9927 | !api / 검증 미통과 | connect / 토스트+backtest |
| `tfStartStrategy` L9958–9960 | 검증 미통과 | 토스트+backtest. **로그인/API/conn/bill 최종 검사 없음** |
| `tfNFCanRun` L13450–13455 | !conn | 토스트; 현재 cur 통과 시에만 connect |
| `tfBotCtl` L13461–13471 | resume/start/paper→live에서 !tfNFCanRun | resume/start는 TF_NF_RESUME 저장; 반환. bill/score 직접 검사 없음 |
| `tfStratToggle` L10960 | off→live에서 !tfNFCanRun | 복귀 대상 저장 후 반환 |
| `tfTmSetStatus` L10105–10113 | err→live / demo·clone 점수 미달 / user 실행 실패 | 토스트 / 토스트 / false. demo·clone은 conn 검사 없음 |
| `tfTmPane` L10780–10783 | !api | 6개 계좌성 탭 모두 연결 빈 상태+CTA |
| `tfTmConnGo`, `tfNFHUnlock` L15585/L10952–10956 | 현재 cur·score 통과 여부 | 통과면 connect; 미통과면 각각 거래소 목록 / 토스트+채팅 |
| `tfTmApply`, `tfBotEditApply` L10653–10655/L13565–13569 | 후보 없음/대상·버전·입력 변경 | 반환/후보 무효화. UI 적용 버튼은 score pass일 때만 L10647/L13551 |
| `tfSS3Copy` L12241/L12246 | !user / !conn&&!payDone 및 스킵·노출 이력 없음 | login / follow 업그레이드 시트. later로 진행 가능 |
| `tfSS3CopyGo` L12306–12308 | 원본 없음/내 전략 / 작업 상태 변경 | 반환 / 재확인. **AI 과금 게이트 호출 없음** |
| `tfSS3Ask` L12182 | !user | login; 그 외 gNew에서 과금 게이트 |
| `tfSS3ObNext`, `tfSS3Publish` L12499/L12552–12553 | 선택 없음/점수 미달 | 토스트. 로그인·과금 검사 없음 |
| `cpSetupGo`, `cpStart` L11736–11737/L11855–11862 | !user / !tfAiGate / 입력 실패 / 동일 trader active | signup / 반환 / 토스트 / follow 허브. `cpSetupRoute/View`는 열람 게이트 없음 |
| `cpFormSync` L11819–11824 | 최소50 USDT/스팟 잔고/유효 숫자 | 오류 표시·시작 버튼 disabled |
| `cpAdjGo/Commit`, `cpClose` L11453–11470/L11494 | 조정 입력 / 손실 -20% / 스팟 잔고 / active 여부 | 반환 / 추가 확인 모달 / 토스트 / 반환. bc watch여도 수동 조정·종료를 막지 않음 |
| `tfAiGate` L12898–12909 | watch / 실제AI 모드 free-out | 토스트+bcRoute / quota sheet; guest true, mock free-out true |
| `gSend` L16689–16692 | 요청 중 / conv의 pair·risk 외에서 tfAiGate | 토스트 / 입력 보존 후 반환 |
| `taiMarket` L16331–16336 | 세션 없음/요청 중/!tfAiGate | 반환/토스트/선택적 fallback 실행 후 반환; 통과 시 tfAiSpend |
| `bcEnsureWelcome`, `bcVolumeCharge`, `bcPromoCardUid` L12622/L12630/L12656 | !user / !uidLinked / tier≠CARD_UID | 지급 없음. UI 진입 게이트와는 다른 원장 경계 |
| `bcCycleTick` L12793/L12806 | 카드·만기 없음 / 실패 상한 | 처리 없음 / watch 및 알림 |
| `tfNFRoute` L15043–15056 | 복원 미완료 / guest | insight 판단 유보; guest trade는 인트로; 나머지 login+home |
| `tfBotView`, `tfReviewView`, `tfPeriodicView` L13343/L13586/L13620 | id 없음 | 복원 전 대기; 완료 뒤 토스트+trade |
| `tfIns2View` L14355–14364 | 글 없음 / guest | insight 홈 / 본문 2개 섹션까지만 표시 |
| `tfIns2AssetDlg`, `tfIns2Ask`, `tfIns2PView`, `tfIns2Email` L14481/L14504/L14522/L14565 | !user; 개인화 없음·만료·token 오류 | login; 개인화/메일은 insight 홈; 만료는 최신 생성 CTA |
| `tfIntroStart` L14614 | !user | signup; 로그인은 전략 선택 섹션으로 스크롤 |
| `tfBkConnect` L15451–15455 | SOON/GUEST/CONNECTED/NEEDS_PLAN/NEEDS_LINK | 무동작/login+복귀 컨텍스트/trade/시트/연결 준비 |
| `tfBkGoLink` L15459 | 현재 cur 미통과 | 토스트 후 **현 화면 유지** |
| `tfNFUpgrade` L13319–13321 | 현재 cur 미통과 | 토스트+이전 채팅. 검증 없이 구독 checkout으로 직접 갈 수 없음 |
| `tfNFLinkUid` L13326 | 이미 uidLinked | 토스트+callback. 로그인 검사 없음; 일반 CTA의 상위 진입에 의존 |
| `tfBk2Write`, `gProfileClick` L15639/L17622 | !user | login |
| `gSetMenu`, `authSyncUI` L17453–17454/L17607–17615 | user 여부 | PLAN/로그아웃/고객센터 등 노출 변경; authSyncUI는 bcBoot까지 실행 |

## 8. 11개 상업 상태 표현 가능성

판정 기준: (a) 현 변수로 상태와 판정을 표현 가능, (b) 일부 축은 표현되나 나머지는 없거나 불완전, (c) 해당 상태의 핵심 축 전체를 표현할 수 없음. “부분 가능”이 현재 11개를 자동 분류한다는 뜻은 아니다. ③–⑤의 연동은 비교를 위해 UID 연동과 실행 API 연결을 모두 만족하는 것으로 적었다. 실제 코드는 두 축을 분리한다.

| # | 상업 상태 | 현재 변수 표현 | 판정·근거 |
| --- | --- | --- | --- |
| ① | 비로그인 | `S.user=null` | **(a)** guest는 tfEnt와 라우터에 명시 L12873/L15049–15051 |
| ② | 로그인만·무료 크레딧 | user 있음, uidLinked=false, api=null, payDone=false, cardOn=false, freeUsed=0, welcome=100 | **(a)** 무료 횟수와 welcome 양쪽 존재 L12621–12625/L12880. 두 소비계가 동기화되는 것은 아님 |
| ③ | API/UID 연동+거래0 | uidLinked=true, api 존재, conn=true, tradeActiveUntil 없음/0, volume 엔트리·체결 없음 | **(a)** 깨끗한 데모 fixture로 표현 가능 L9917/L9953/L12713. 기존 잔액·캡만 보고 평생 거래0을 증명하는 것은 불가 |
| ④ | 연동+저거래 | ③ + 일부 체결·volume>0 | **(b)** 체결/적립액은 존재하나 저거래 임계·기간·명목거래량 합계 없음. uid.small은 소비량 기반 L12712–12716 |
| ⑤ | 연동+고거래 | ③ + 더 많은 체결·volume | **(b)** 고거래 판정 없음. UID cap 2000 이후 적립은 잘려 원래 거래량 복원 불가 L12635–12643 |
| ⑥ | 플랜+AI 고사용+미연동 | payDone=true(및 새 카드 상태는 별도), uidLinked=false, api=null | **(b)** 플랜/미연동 가능; paid AI 호출은 tfAiSpend에서 즉시 반환하므로 실제 고사용 측정 불가 L12884–12887 |
| ⑦ | 플랜+AI 저사용+미연동 | ⑥과 동일 | **(b)** ⑥과 구별하는 전체 AI usage counter/band 없음. card.out도 소비량 구분 전 반환 L12711 |
| ⑧ | 플랜+연동+고사용+고거래 | payDone=true, uidLinked=true, api/conn 연결 + 기록 | **(b)** 연동/플랜만 확실. paid 소비 누락·고거래 임계 없음. CARD_UID는 carduid.out으로 합쳐짐 L12714 |
| ⑨ | 플랜+연동+고사용+저거래 | 위와 동일, 더 작은 volume fixture | **(b)** 실사용 高·低를 판정하지 못하며 거래 positive의 高低도 없음 |
| ⑩ | 플랜+연동+저사용+고거래 | 위와 동일 | **(b)** ⑧과 사용량으로 구분 불가; ⑤와 같은 거래량 한계 |
| ⑪ | 플랜+연동+저사용+저거래 | 위와 동일 | **(b)** ⑨와 사용량으로 구분 불가; 네 조합의 canonical stateId 없음 |

**高低 축의 결론**:

- `tradeActiveUntil`은 live 신규 체결 여부에 따른 30일 유효기간이다. 한 번의 소액 체결과 큰 거래량을 구분하지 않는다(L13685–13688).
- `creditBal`은 남은 구형 크레딧이며 사용량이 아니다. `freeUsed`는 무료 자격일 때만 증가하는 누적 횟수다(L12884–12890).
- `bcMonthSpend`는 사용량 근삿값을 만들 수 있으나, 현재 정상 호출 경로에서는 **credit 자격일 때만 새 debit에 도달**한다(L12886→L12922). paid/trade/free까지 아우르는 AI 高低는 **현재 판정 불가능**하다.
- `bcBranch`의 heavy는 거래량 高가 아니라 AI debit 합≥1500이다. `carduid.out`은 이를 평가하기 전에 반환한다(L12714–12715).
- 명목 거래량은 `bcVolumeCharge(...,notional)`의 인자에서만 금액을 받아 적립액으로 변환된다. 원장에는 notional/market/ex를 함께 저장하지 않는다(L12629–12643/L12857). **현 기준의 정확한 거래 高低 엔진은 없음**.
- 사용량 구간 임계, 거래량 구간 임계, 11개 commercialStateId, 완전한 billingCoverage는 **미구현**이다. 새 엔진·프리셋 제안은 FINDINGS에 별도로 기록했다.

## 9. 격리 실행으로 확인한 결과

원본 `tfS`, `tfNFInit`, `bc*`, `tfEnt`, `tfAiSpend`, `tfAiGate`, `tfIntroNeed`, `tfBkConnSt`, `tfNFCanRun`을 Node v24.20.0 VM에 읽어 넣고 DOM/저장/토스트 함수만 no-op으로 대체했다. 실제 브라우저 계정과 파일은 건드리지 않았다.

| 입력·호출 | 실제 출력 |
| --- | --- |
| 새 로그인 + welcome 후 free AI 1회 | freeUsed=1, bcBalance=100 |
| 새 로그인 + payDone=true, AI 200회 | why=paid, bcBalance=100, bcMonthSpend=0, bcTier=FREE |
| 카드 등록+월 충전, freeUsed=10 | bcTier=CARD, bcBalance=3100, tfEnt.why=free-out, tfAiGate=false |
| 잔액0·25h 경과 watch → UID 구형1000 지급+uid-link 훅 | old creditBal=1000, bcBalance=0, mode=watch, tfAiGate=false |
| api={ex:binance}, conn 미정의 | 거래소 CONNECTED, tfNFCanRun=false |
| cp.copies에 active 1개, strat/clones 없음 | tfIntroNeed=true |
| welcome 뒤 0 debit 2,000건 append | ledger.length=2000, bcBalance=0, welcomeSeen=true, welcome 재지급=false |
