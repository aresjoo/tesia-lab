/* TETH.AI 사이트 공용 설정
   가격, 스토어 URL 등 자주 바뀌는 값은 전부 여기서만 수정한다. */
window.TETH_CONFIG = {
  /* 앱(워크스페이스) 진입 경로 */
  appUrl: "../",

  /* 스토어 URL, 출시 가정 임의 URL. 실제 출시 시 여기만 바꾸면 /download의 QR, 링크가 자동 반영된다. */
  iosStoreUrl: "https://apps.apple.com/kr/app/teth-ai/id6740000000",
  androidStoreUrl: "https://play.google.com/store/apps/details?id=ai.teth.app",

  /* Zendesk Web Widget 키, TODO: Zendesk 가입 후 키 입력. 입력하면 우측 하단 고객센터 버튼이 실제 Zendesk 채팅을 연다. */
  zendeskKey: "",

  /* SNS 채널, 사이트 푸터의 팔로우 아이콘이 이 값을 쓴다. TODO: 실제 계정 주소로 교체 */
  social: {
    x: "https://x.com/teth_ai",
    instagram: "https://www.instagram.com/teth.ai",
    youtube: "https://www.youtube.com/@teth_ai",
    telegram: "https://t.me/teth_ai"
  },

  /* 배포용 AI 프록시(Cloudflare Workers) 오리진. 비어 있으면 배포 사이트는 스크립트 폴백으로 동작.
     로컬(localhost)은 이 값과 무관하게 항상 localhost:8799 프록시를 쓴다. */
  aiProxy: "",

  /* 요금제, /about Pricing 섹션이 이 데이터로 렌더링된다 */
  pricing: [
    { id: "partner", name: "TETH 초대 계정", price: "월 $0", tagline: "거래하는 사람을 위해", features: ["전략 자동 실행","연결 가능한 거래소 7곳","영원히 무료, 카드 등록 없음","24시간 고객 지원"], cta: "무료로 시작하기", highlight: true },
    { id: "direct", name: "TETH 구독", price: "월 $280", tagline: "지금 쓰는 계정 그대로", features: ["전략 자동 실행","연결 가능한 거래소 7곳","초대 가입 없이 계정 연결","24시간 고객 지원"], cta: "구독으로 시작하기", highlight: false }
  ]
};
