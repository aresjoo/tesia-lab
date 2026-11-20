/* 생성 파일: tools/extract-from-html.mjs 가 원본 site-config.js 의 TETH_CONFIG 를 그대로 꺼낸다. 손으로 고치지 않는다. */
export type SitePlan = { id: string; name: string; price: string; tagline: string; features: string[]; cta: string; highlight: boolean };
export const TETH_CONFIG: { appUrl: string; iosStoreUrl: string; androidStoreUrl: string; zendeskKey: string; social: Record<string, string>; aiProxy: string; pricing: SitePlan[] } = {
 "appUrl": "../",
 "iosStoreUrl": "https://apps.apple.com/kr/app/teth-ai/id6740000000",
 "androidStoreUrl": "https://play.google.com/store/apps/details?id=ai.teth.app",
 "zendeskKey": "",
 "social": {
  "x": "https://x.com/teth_ai",
  "instagram": "https://www.instagram.com/teth.ai",
  "youtube": "https://www.youtube.com/@teth_ai",
  "telegram": "https://t.me/teth_ai"
 },
 "aiProxy": "",
 "pricing": [
  {
   "id": "partner",
   "name": "TETH 초대 계정",
   "price": "월 $0",
   "tagline": "거래하는 사람을 위해",
   "features": [
    "전략 자동 실행",
    "연결 가능한 거래소 7곳",
    "영원히 무료, 카드 등록 없음",
    "24시간 고객 지원"
   ],
   "cta": "무료로 시작하기",
   "highlight": true
  },
  {
   "id": "direct",
   "name": "TETH 구독",
   "price": "월 $280",
   "tagline": "지금 쓰는 계정 그대로",
   "features": [
    "전략 자동 실행",
    "연결 가능한 거래소 7곳",
    "초대 가입 없이 계정 연결",
    "24시간 고객 지원"
   ],
   "cta": "구독으로 시작하기",
   "highlight": false
  }
 ]
};
