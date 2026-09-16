/* ═══════════════════════════════════════════════════════════════
   TETH 전략 위임 플로우 — 카피 + 설정
   문구는 전부 이 파일에서 교체할 수 있다. index.html은 키로만 참조.
   ═══════════════════════════════════════════════════════════════ */

/* ── 설정 (산식/가격/파트너) ── */
window.TFC = {
  /* TETH 점수 산식: 0~100. 각 항목을 0~1로 정규화한 뒤 가중 합산 */
  score: {
    wWin: 0.30,      /* 승률 (40%→0, 75%→1) */
    wRet: 0.28,      /* 연환산 수익률 (0%→0, 40%→1) */
    wMdd: 0.27,      /* 최대 낙폭 (-30%→0, -5%→1) */
    wVol: 0.15,      /* 거래당 변동성 (8%→0, 2%→1) */
    winLo: 35, winHi: 60,
    retLo: 0, retHi: 6,
    mddLo: -25, mddHi: -6,
    volLo: 9, volHi: 4,
    pass: 80,        /* 실행 게이트 점수 */
    maxTries: 5      /* 미달 반복 상한 */
  },
  /* 실행 요금 (KRW) */
  price: { month: 599000, year: 5000000 },
  /* 파트너 거래소: 추천 뱃지는 rank 1이 받는다 (정산 우선순위에 따라 조정) */
  exchanges: [
    { id: 'binance', name: 'Binance', rank: 1, ref: 'https://accounts.binance.com/register?ref=TETH_AI', uidLabel: 'Binance UID', apiGuide: [
      '바이낸스 로그인 후 프로필 아이콘, 계정 설정으로 이동',
      'API 관리(API Management) 메뉴에서 Create API 선택',
      '라벨에 TETH 입력 후 생성, 보안 인증 완료',
      'Enable Reading과 Enable Spot Trading만 체크 (출금 권한은 켜지 마세요)',
      'API Key와 Secret Key를 복사해 아래에 붙여넣기' ] },
    { id: 'bybit', name: 'Bybit', rank: 4, ref: 'https://www.bybit.com/invite?ref=TETHAI', uidLabel: 'Bybit UID', apiGuide: [
      'Bybit 로그인 후 프로필, API 메뉴로 이동',
      'API 키 생성 선택, 이름에 TETH 입력',
      '권한은 읽기와 거래(현물, 파생)만 선택 (출금 제외)',
      'API Key와 Secret Key를 복사해 아래에 붙여넣기' ] },
    { id: 'bitget', name: 'Bitget', rank: 5, ref: 'https://www.bitget.com/referral/register?from=TETHAI', uidLabel: 'Bitget UID', apiGuide: [
      'Bitget 로그인 후 프로필, API 관리로 이동',
      'API 키 생성, 이름에 TETH 입력, 패스프레이즈 설정',
      '권한은 읽기 전용과 거래만 선택 (출금 제외)',
      'API Key와 Secret Key를 복사해 아래에 붙여넣기' ] },
    { id: 'mexc', name: 'MEXC', rank: 6, ref: 'https://www.mexc.com/register?inviteCode=TETHAI', uidLabel: 'MEXC UID', apiGuide: [
      'MEXC 로그인 후 계정, API 관리로 이동',
      'API 키 생성, 메모에 TETH 입력',
      '권한은 시세 조회와 거래만 선택 (출금 제외)',
      'API Key와 Secret Key를 복사해 아래에 붙여넣기' ] },
    { id: 'okx', name: 'OKX', rank: 2, ref: 'https://www.okx.com/join/TETHAI', uidLabel: 'OKX UID', apiGuide: [
      'OKX 로그인 후 프로필, API 메뉴로 이동',
      'API 키 생성 선택, 이름에 TETH 입력',
      '권한은 읽기와 거래만 선택 (출금 제외)',
      '패스프레이즈 설정 후 생성',
      'API Key와 Secret Key를 복사해 아래에 붙여넣기' ] },
    { id: 'woox', name: 'WOO X', rank: 3, ref: 'https://x.woo.org/register?ref=TETHAI', uidLabel: 'WOO X UID', apiGuide: [
      'WOO X 로그인 후 계정, API 관리로 이동',
      'Create API Key 선택',
      '권한은 Read와 Trade만 허용 (Withdraw 제외)',
      'API Key와 Secret Key를 복사해 아래에 붙여넣기' ] }
  ],
  /* 커뮤니티 보상: 내 전략을 누가 따라할 때 제작자가 받는 보상률(월 요금 대비) */
  community: { rewardRate: 0.10, currency: 'KRW' },
  /* nf: AI 티어링 크레딧 정책 (phase6 계약 — 버전 관리) */
  credit: { version: 1, uidGrant: 1000, costHigh: 10, warnRatio: 0.8, activityDays: 30, freeQuota: 10 },
  /* ── 크레딧 과금 시스템 config (확정 스펙 2026-09-16) — 값은 전부 추후 확정, 엔진은 이 블록만 참조 ── */
  billing: {
    version: 1,
    WELCOME_CREDIT: 100,            /* FREE 웰컴 1회 (값 미확정) */
    UID_CREDIT_CAP: 2000,           /* UID 거래량 충전 상한 (질문 2: 초과분 임시 소멸) */
    CARD_CREDIT_MONTHLY: 3000,      /* CARD 월 충전 (이월 없음) */
    AI_CALL_COST: 10,               /* 자유형 AI 1회 차감 (값 미확정) */
    THRESHOLD_WARN: 0.20,           /* 잔량 비율 경고 (질문 6: 모수는 당월 총 유입, 임시) */
    THRESHOLD_STOP: 0,
    VOLUME_TO_CREDIT_RATE: {        /* 거래소별 x 현물/선물 가중 (커미션 수익 비례, 값 미확정) */
      binance: { spot: 0.00040, futures: 0.00060 },
      okx:     { spot: 0.00040, futures: 0.00060 },
      woox:    { spot: 0.00050, futures: 0.00070 }
    },
    GRACE_HOURS: 24,                /* 경고 후 관망 전환 유예 */
    CARD_PLAN_PRICE_USD: 49,        /* CARD 월 플랜가 (값 미확정) — 청구액 = 플랜가 x (1-상쇄율), 하한 0 */
    DUNNING_RETRY_MAX: 3,           /* 결제 실패 재시도 상한 — 초과 시 관망 (성역 유지) */
    DISCOUNT_RESCUE: 0.90,          /* 임계점 카드 등록 할인 — 반복 수령 가능, 수령 이력 기록 (질문 8: 임시 다음 1회분) */
    PROMO_AI_CREDIT_USD: 100        /* CARD 유저 UID 연동 프로모 — 문구 고정 "AI 이용 크레딧 $100" */
  },
  /* ── 카피트레이딩 config (docs/bitget-copytrading-spec.md 재해석, 전 자산 USDT 표기) ── */
  copytrade: {
    version: 1,
    PROFIT_SHARE: 0.10,          /* 수익 분배율 */
    COPIER_CAP: 500,             /* 카피어 상한 */
    DELAY_HOURS: 1,              /* 비카피어 오픈 포지션 지연 공개 */
    LOSS_GUARD: -0.20,           /* 손실 중 추가 입금 보호 임계 (핵심 원칙 4) */
    MIN_COPY_USDT: 50,           /* 카피 금액 하한 */
    MARGIN_RANGE: [10, 100000],  /* Fixed margin 주문당 범위 */
    TRUST_MIN_DAYS: 90,          /* 신뢰도 코멘트: 검증 기간 짧음 판정 */
    TRUST_HI_ROI: 50             /* 신뢰도 코멘트: 고수익 판정 % */
  },
  rebate: { rate: 0.10 }
};

/* ── 카피 ── */
window.TFCOPY = {
  /* §1 인테이크 */
  intakeHello: '좋아요, 맡겨주세요. 언제, 어떻게 살지 전략을 만들어서 과거 시장에 검증해볼게요. 몇 가지만 편하게 답해주세요!',
  intakeHelloSell: '좋아요, 맡겨주세요. 언제, 어떻게 정리할지 전략을 만들어서 과거 시장에 검증해볼게요. 몇 가지만 편하게 답해주세요!',
  intakeDunno: '잘 모르겠어요, AI가 추천해주세요',
  intakeQ: {
    asset:  { t: '어떤 자산으로 할까요?', d: '대화하던 자산을 기본으로 잡았어요' },
    style:  { t: '어떤 성향이 편하세요?', d: '수익을 크게 노릴수록 흔들림도 커져요' },
    budget: { t: '어느 정도 예산으로 시작할까요?', d: '검증 리포트의 수익 시뮬레이션에 쓰여요' },
    period: { t: '어느 기간의 시장으로 검증할까요?', d: '길수록 더 다양한 장세를 겪은 전략이 돼요' },
    stop:   { t: '얼마까지 떨어지면 멈출까요?', d: '이 선에 닿으면 자동으로 정리하고 지켜드려요' }
  },
  intakeOpt: {
    style:  [ ['공격적으로','수익 우선, 흔들림 감수'], ['중립적으로','수익과 안정의 균형'], ['안전하게','작게 벌어도 잃지 않게'] ],
    budget: [ ['100만원','가볍게 시작'], ['500만원','표준'], ['1,000만원','본격적으로'], ['3,000만원 이상','크게'] ],
    period: [ ['최근 1년','최신 장세 위주'], ['최근 2년','상승과 하락 모두'], ['전체 기간','2023년부터 전부'] ],
    stop:   [ ['-3%까지','짧게 끊기'], ['-5%까지','표준'], ['-8%까지','여유있게'], ['-12%까지','길게 버티기'] ]
  },
  intakeDone: '다 됐어요. 이 조건으로 전략을 만들어서 바로 검증해볼게요.',

  /* §2 백테스트 */
  btRunning: '과거 데이터로 전략을 검증하고 있어요...',
  btSteps: ['데이터 수집', '시나리오 생성', '시뮬레이션', '점수 산출'],

  /* §3 점수 게이트 */
  gateTitle: 'TETH AI 점수',
  gateNotice: 'TETH 투자자 보호 기준에 따라 80점 이상의 전략만 실행할 수 있어요. 검증되지 않은 전략으로부터 당신을 지키기 위한 자체 기준입니다.',
  gatePass: '통과했어요! 이 전략은 TETH 기준을 넘는 검증된 전략이에요.',

  /* §4 개선 루프 */
  gateFailTone: [
    '아깝네요, {score}점이에요. 조금만 조정하면 넘을 수 있을 것 같아요.',
    '거의 다 왔어요, {score}점. 설정을 살짝 바꿔서 다시 검증해볼까요?',
    '{score}점이에요. 방향은 좋아요, 디테일만 다듬어볼게요.'
  ],
  gateFailCap: '이 조건에선 안전한 전략을 찾기 어려워요. 종목이나 기간을 바꿔서 다시 시작해볼까요?',
  improveChips: [
    { k: 'stop',   label: '멈추는 선을 조정해서 다시 검증' },
    { k: 'period', label: '기간을 바꿔서 다시 검증' },
    { k: 'ai',     label: 'AI 추천 설정으로 다시 검증' }
  ],

  /* §5 리포트 */
  reportTitle: '전략 검증 리포트',
  reportSim: '{budget}으로 시작했다면 {months}개월 뒤 약 {result}이었어요',
  reportRisk: '과거 수익이 미래 수익을 보장하지 않습니다. 모든 투자의 책임은 본인에게 있습니다.',
  reportCta: '이 전략, 지금 실행하기',
  easyToggle: ['쉬운 말 보기', '전문가 보기'],

  /* §6 실행 선택 */
  planTitle: '어떻게 실행할까요?',
  planA: { name: '내 거래소 바로 연결', desc: '이미 쓰는 거래소 계정을 그대로 연결해요' },
  planB: { name: '0원으로 시작', hero: '2분이면 1년에 500만원을 아낄 수 있어요',
    cond: 'TETH 파트너 링크로 거래소 1곳에 새로 가입하고 연결하면 요금이 0원이에요',
    steps: ['가입', 'UID 입력', 'API 연결'], time: '가입은 2분이면 끝나요',
    support: '막히면 24/7 고객센터가 실시간으로 도와드려요',
    tradeoff: '잃는 것: 2분 / 아끼는 것: ₩5,000,000' },
  yearSave: '연 결제 시 약 30% 할인',
  perMonth: '월 416,000원 꼴',

  /* §7 온보딩 */
  obPick: '어느 거래소로 시작할까요? 하나만 고르면 돼요.',
  obUid: '가입 완료 후 발급된 UID를 입력해주세요. 연동을 확인해드릴게요.',
  obVerifying: 'UID 연동을 확인하고 있어요...',
  obVerified: '연동 확인 완료! 이제 마지막 단계예요.',
  obApiBtn: 'FAST API KEY 연결',
  obNoWithdraw: '출금 권한은 받지 않아요. 당신 돈은 당신 거래소에 있습니다.',
  obDone: '모든 연결이 끝났어요! 이제 TETH가 당신 대신 시장을 지켜봅니다.',

  /* §8 대시보드 */
  dashTitle: '내 트레이딩',

  /* §9 커뮤니티 */
  rankTitle: '전략 랭킹',
  rankDesc: '검증을 통과한 공개 전략들이에요. 따라하기를 누르면 내 계정으로 같은 전략을 검증부터 다시 진행해요.',
  shareTitle: '전략 공유',
  followBtn: '따라하기',
  shareReward: '누가 내 전략을 따라하면 보상을 드려요'
};
