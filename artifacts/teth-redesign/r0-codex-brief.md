# ROUND 0 (Codex, Astra): 독립 감사 + 독립 리서치

너는 Claude Code(FableD 5.1)의 독립적인 적대적 동료다. Claude 의 의견은 아직 보지 않는다(이 폴더의 `r0-claude.md` 가 있어도 열지 말 것). 합의가 아니라 최선의 렌더 결과를 목표로 한다.

## 과제 배경
TETH AI 의 "전략 찾기" 목록(MAIN)과 전략 상세(DETAIL)가 "가짜 AI 투자전략 여러 개에 수익률 붙여놓은 화면"처럼 느껴진다. 목표는 "서로 다른 판단 방식을 가진 실제 AI Trading System 을 비교하고 고르는 제품"으로 느껴지게 하는 것. 핵심 질문은 "어떤 판단 방식을 가진 AI 에게 거래를 맡길 것인가".

## 대상
- 저장소: 현재 폴더, 단일 파일 SPA `index.html`(CRLF, BOM). **이번 라운드는 코드 수정 금지.**
- MAIN: `tfShareHub('find')`. DETAIL: `tfSS3Go(tfSSNe('<전략명>'),'all','ov')`.
- 관련 코드: `MK_CAT`, `MK_PX_CFG`, `mkPx`, `runBacktest`/`runBacktestCore`, `tfRankSeeds`, `tfSSRows`, `tfSS3GridHtml`, `mkCard`, `mkSpark`, `mk30`, `tfSS3DetailRender`, `mkOvTab`, `mkStatusHtml`, `mkLogTab`, `mkInfoTab`, `mkFollowSheet`, `tfKindBadge`, `mkKindPick`.
- 기준 스크린샷(이 폴더): `baseline-main.png`, `baseline-main-full.png`, `baseline-main-1280.png`, `baseline-main-390.png`, `baseline-detail.png`, `baseline-detail-full.png`, `baseline-detail-390.png`. **평가 대상은 코드가 아니라 렌더된 화면이다.** 직접 다시 띄워 봐도 된다(정적 서버 8843 직접 실행, 헤드리스 Chrome 127.0.0.1:9333).
- 현재 엔진이 실제로 하는 일은 규칙 하나다: RSI 하락 뒤 반등 확인 매수, 익절, 손절, 25봉 상한, 선택적 방향 필터. 스스로 종목을 고르는 AI(Agentic)와 혼합(Hybrid)은 목록 데이터에 아직 없다.

## 할 일
1. **포렌식 감사**: 위 화면과 코드에서 신뢰를 깎는 요소를 찾는다. 카드, 이름, 아바타, 카피, 숫자 위계, 색(라임 CTA, 수익 초록, 상태 초록의 경쟁), 필터와 정렬, 상세의 정보 순서, "지금 뭘 하나"와 활동 기록의 설득력.
2. **독립 웹 리서치**(Google 과 Reddit 포함, 의미 있는 참고 10개 이상, URL 과 한 줄 교훈). 범위:
   - 에이전트형 제품 UX: 자율 에이전트 모니터링, 활동 타임라인, 현재 상태, 투명성, 사람의 감독.
   - 금융 인터페이스: 최신 트레이딩 터미널, 퀀트 전략 플랫폼, nof1 Alpha Arena 계열.
   - 신뢰: r/algotrading, r/UXDesign, r/AI_Agents, r/CryptoCurrency 등에서 무엇이 scam, fake AI, AI 가 만든 UI 처럼 보이는지, 아바타와 페르소나, 활동 로그, AI trader 마케팅에 대한 반응.
   - Binance, Bitget, OKX 카피트레이딩을 정답으로 취급하지 말 것(사람 트레이더를 따라가는 패러다임).
   웹 검색 도구를 쓸 수 없으면 그 사실을 첫 줄에 밝히고, 아는 범위의 근거를 출처 유형과 함께 적되 URL 을 지어내지 말 것.
3. **가설 판정** H1~H7 각각 SUPPORTED / PARTIAL / REJECTED 와 근거:
   - H1 사람형 아바타가 AI 전략을 인간 트레이더처럼 위장해 신뢰를 깎는다.
   - H2 "김대리", "애플 농부", "느림보", "야수의 심장", "골드핑거" 같은 이름은 기억에는 남지만 신뢰를 파괴한다.
   - H3 "BTC MEAN REVERSION #01" 같은 퀀트식 이름은 신뢰는 조금 올라도 초보에게 어렵고 매력이 없다.
   - H4 TETH 의 가장 강한 정체성은 "AI" 라는 단어가 아니라 이 AI 가 무엇을 보고, 판단하고, 하고 있는지를 보여주는 데서 나온다.
   - H5 토큰 수나 모델 공급사 이름을 크게 보여주는 것은 신뢰 연출일 가능성이 있다.
   - H6 성과 숫자가 가장 큰 시각 요소면 수익률 마케팅 제품처럼 보인다.
   - H7 Agentic, Rule, Hybrid 가 같은 카드 문법이면 능력 차이를 이해하지 못한다.
4. **구체 비판 최소 10개**. 형식 고정: `요소 → 문제 → 사용자가 하는 해석 → 제안`. "전반적으로", "조금 더 세련되게" 금지.
5. **재설계 제안**: (a) Agentic / Rule / Hybrid 를 3초 안에 구분시키는 카드 문법(배지와 칩 남발 금지), (b) 이름 체계 3안(A 행동 우선, B 제품화된 에이전트 이름, C 고유 이름 + 쉬운 설명) 각각 예시 8개와 약점, (c) 아바타 A(전문적으로 다시 정의한 사람형) 대 B(TETH 고유의 비인간 식별 기호) 각각의 위험, (d) 상세 페이지 정보 구조(정체성, 하는 일, 현재 상태, 최근 판단, 행동 방식, 성과)와 유형별 우선순위 차이, (e) 데이터 모델과 구현 위험(스스로 고르는 AI 의 판단 기록과 성과를 무엇으로 만들 것인가. 화면의 숫자와 기록이 서로 어긋나면 안 된다).

## 제약
- 새 고지, 면책, MOCK, DEMO, 프로토타입 라벨을 제안하지 말 것(내부 프로토타입 규칙).
- 토큰 수, 모델 공급사 이름을 신뢰 증거로 쓰지 말 것.
- 문장부호: em dash 와 가운뎃점 금지.
- 산출: `artifacts/teth-redesign/r0-codex.md` 한 파일, 350줄 이내, 표 위주.
