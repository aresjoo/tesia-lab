# Web 작업 지침

- 현재 화면은 Mock이며 거래·백테스트 의미론의 정본이 아니다.
- 제품 정본은 `beak1011/tesia-program`, API/schema는 `beak1011/tesia-contracts`의 생성 client로만 소비한다.
- PO가 승인한 유일한 예외는 `browser-session.ts`의 named `ensureBrowserSession` 최초 생성 POST transport다. Contracts 정책 `ba11ef0a3b7d01a6c01706f9b80e8b748d0fb829`의 BRS-01~10에 따라 실제 SDK GET 전체 검증·POST/GET data와 strong ETag exact 대조로만 확인한다. 가짜 Set-Cookie, SDK validator skip, 로컬 schema 복제, 다른 operation의 raw 소비는 허용하지 않는다.
- 프론트는 UI/UX 개선을 계속할 수 있으나 backend 계약을 추측해 로컬 type으로 확정하지 않는다.
- 공개 사이트는 법률 Gate 전 Mock only다. 실제 연결, 거래소 추천·레퍼럴·KYC·입금·자동주문 카피를 임의로 공개하지 않는다.
- 변경 전 영향받는 route/state/API contract/접근성/반응형 범위를 기록한다.
- secret과 거래소 API key를 브라우저 storage·로그·analytics에 저장하지 않는다.
- 완료 시 lint, build, 관련 Playwright 테스트와 Mock/실연결 feature flag를 검증한다.
- 폐기된 component, mock field, 문서는 같은 PR에서 제거한다.
