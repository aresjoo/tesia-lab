# Web 작업 지침

- 제품 본체는 ares 원본의 전체 UI·UX·사용 흐름이다. 일부 연결의 Mock은 내부 검증 수단이며 목표는 실제 AI·고객 계정 실거래다. 거래·백테스트의 실행 의미·권한은 서버 계약을 따른다.
- 화면·문구·SVG·대화·연구 UX는 ares 원본을 React로 계승한다. 기존 backend의 제한에 맞춰 원본 UX를 축소하지 않고 필요한 producer를 연결한다. 실제 wire·검증·주문 권한은 별도 계약을 따른다.
- 제품 정본은 `beak1011/tesia-program`, API/schema는 `beak1011/tesia-contracts`의 생성 client로만 소비한다.
- PO가 승인한 유일한 예외는 `browser-session.ts`의 named `ensureBrowserSession` 최초 생성 POST transport다. Contracts 정책 `ba11ef0a3b7d01a6c01706f9b80e8b748d0fb829`의 BRS-01~10에 따라 실제 SDK GET 전체 검증·POST/GET data와 strong ETag exact 대조로만 확인한다. 가짜 Set-Cookie, SDK validator skip, 로컬 schema 복제, 다른 operation의 raw 소비는 허용하지 않는다.
- 원본 UI·카피·SVG·폰트·기능·동선 변경은 대상·이유·영향·대안을 먼저 제시하고 사용자 승인 후 반영한다. backend 제약을 이유로 원본을 축소하지 않고 필요한 서버 연결을 구현한다. 계약을 추측해 로컬 type으로 확정하지 않는다.
- 공개 사이트는 법률 Gate 전 Mock only다. 실제 연결, 거래소 추천·레퍼럴·KYC·입금·자동주문 카피를 임의로 공개하지 않는다.
- 사용자가 명시 승인한 정적 테스트 화면의 원문 복원은 Program §0.4를 따른다. 승인된 소개·푸터 카피를 임의로 준비/연구 문구로 바꾸지 않는다. 문구 복원은 실제 provider·주문 활성화나 선정 사실 검증을 뜻하지 않는다.
- 변경 전 영향받는 route/state/API contract/접근성/반응형 범위를 기록한다.
- secret과 거래소 API key를 브라우저 storage·로그·analytics에 저장하지 않는다.
- 완료 시 lint, build, 관련 Playwright 테스트와 Mock/실연결 feature flag를 검증한다.
- 폐기된 component, mock field, 문서는 같은 PR에서 제거한다.
