/* TETH.AI 사이트 공용 설정
   가격·스토어 URL 등 자주 바뀌는 값은 전부 여기서만 수정한다. */
window.TETH_CONFIG = {
  /* 앱(워크스페이스) 진입 경로 */
  appUrl: "../",

  /* 스토어 URL — 출시 가정 임의 URL. 실제 출시 시 여기만 바꾸면 /download의 QR·링크가 자동 반영된다. */
  iosStoreUrl: "https://apps.apple.com/kr/app/teth-ai/id6740000000",
  androidStoreUrl: "https://play.google.com/store/apps/details?id=ai.teth.app",

  /* Zendesk Web Widget 키 — TODO: Zendesk 가입 후 키 입력. 입력하면 우측 하단 고객센터 버튼이 실제 Zendesk 채팅을 연다. */
  zendeskKey: "",

  /* 요금제 — /about Pricing 섹션이 이 데이터로 렌더링된다 */
  pricing: [
    {
      id: "direct",
      name: "TETH Direct",
      price: "월 599,000원",
      tagline: "쓰던 거래소 그대로, 바로 시작",
      features: [
        "무제한 전략 연구·백테스트",
        "실전 실행·모니터링",
        "모든 검증 엔진(리스크·비판·홀드아웃)",
        "우선 지원"
      ],
      cta: "Direct로 시작하기",
      highlight: false
    },
    {
      id: "partner",
      name: "TETH Partner",
      price: "0원",
      tagline: "파트너 거래소로 시작하면 이용료 무료",
      features: [
        "Direct의 모든 기능 동일",
        "파트너 거래소 가입 즉시 자동 연결",
        "이용료 파트너 혜택으로 전액 무료",
        "언제든 Direct로 전환 가능"
      ],
      cta: "Partner로 무료 시작",
      highlight: true
    }
  ]
};
