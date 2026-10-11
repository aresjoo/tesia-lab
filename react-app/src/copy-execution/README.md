# API18 개발 연결 경계

이 디렉터리는 Contracts 후보 `2b664c07286991fb438f8f2b537ca6a586f45742`의 생성된 SDK를 byte 그대로 소비한다. `fixtures/api-v0.18`의 manifest·hash와 117개 규범 wire case를 전용 시험에서 확인한다. 공식 dependency 0.20 또는 SDK의 정식 공개 발행 권위를 변경하지 않는다.

`mountCandidateCopyDevelopment`는 localhost의 Vite 개발 실행에서만 명시적으로 호출한다. 공개 service entry는 주입하지 않으며 기본값은 꺼져 있다. 실패·404·Mock 계좌·preview Worker로 실행을 대체하지 않는다.

`NativeServiceApp`의 기존 session SDK가 HttpOnly 서버 세션을 재확인하고 CSRF를 공급한다. UI scope는 기존 sessionId 수명만 나타내며 서버 owner ID나 주문 권한이 아니다. API12는 지정한 connectionId의 연결·Bitget·검증된 읽기/선물/출금 금지 권한을 확인한다. API12가 제공하지 않는 environment와 USDT 잔고는 추론하지 않는다.

`CandidateCopyInput`에는 신뢰된 환경, 정확 connectionId, 원본 source SHA/ID에 서버 발급 version/policy를 결속하는 `readIssuedBinding`, 서버가 확인한 `availableUsdt`/revision/최대 10초 expiry를 공급하는 `readAvailableBudget`가 필요하다. 해당 producer는 이 UI 구현의 제공 범위에 없다. 발급 binding이 없으면 f1/eval ID를 임의 매핑하지 않고 실행할 수 없다. 이미 알려진 구독의 관리는 신규 예산 producer 부재와 독립적으로 허용한다.

원본 공개 카탈로그 renderer·설정창·관리 필드와 CSS를 사용한다. 실제 경로의 금액만 USDT이며 preview 기본 USD는 유지한다. 미확정 PnL/수익률/분배/잔고/완전한 종료 거래·예산 이력은 정보 미제공으로 남긴다. 실제 원장임이 확인되지 않은 상태를 ‘복사 중’으로 표시하지 않는다.

응답 유실은 미확정 intent로 남긴다. 같은 입력/intent/key의 명시 재확인과 list/get 조회만 허용하며 자동 재시도·다른 신규 create/start를 하지 않는다. 알려진 자기 구독 pause/stop/close와 update의 서버 위험 판정은 유지한다. 세션·actor 교체, 취소, 이전 revision의 지연 응답을 실행 성공으로 반영하지 않는다.

전용 시험은 합성 wire/HTTP fixture다. 실제 backend factory 주입, source 발급·환경·잔고 producer, 공식 SDK 발행, 운영 배포, 실고객 주문 성공은 별도 미완료다.

API18 close는 ACTIVE의 신규 진입을 중지한다. 카피를 ACTIVE로 유지하는 전체 포지션 정리 계약이 없으므로 해당 원본 버튼은 ACTIVE 상태에서 비활성화한다. 이미 PAUSED/STOPPING일 때만 서버 close capability를 그대로 소비한다. 원 preview의 동작과 문구는 유지한다.

원본 provenance는 Git SHA40, artifact fingerprint는 SHA256 64자이며 둘을 바꾸거나 재해시하지 않는다. 포트가 발급한 sourceSha/sourceId/version/policy binding을 원문 그대로 검증한다.

예산의 최대 10초 expiry는 계좌 근거의 신선도이며 사용자의 설정 입력 제한이 아니다. 미전송 확인에는 신선한 예산을 다시 조회하고 같은 입력과 intent를 유지한다. 이미 응답이 유실된 create의 재확인은 예산 조회 없이 같은 key/body로 서버 멱등 판정을 소비한다.

정산된 intent cache는 32개에서 오래된 항목을 제거한다. caller의 검증된 opaque intentId를 서버 Idempotency-Key로 그대로 사용하여 eviction 이후 새 key를 발급하지 않는다. 미확정 intent는 긴급 제어를 막지 않도록 32개를 넘더라도 보존하며 create/start fence를 유지한다. pause/stop은 서버 계약대로 화면의 오래된 revision 때문에 전송을 차단하지 않고, update/start/close의 revision 검증은 유지한다.

같은 owner/session/connection/environment에서 검증해 보관한 자기 구독의 pause/stop은 projection GET 성공에 의존하지 않는다. 보관한 exact binding으로 전송하며 서버가 현재 소유권·제어 가능 상태를 판정한다. 이전 관측 capability는 긴급 제어 권한의 대체물이 아니다. scope 교체 시 보관 사실을 폐기하며 CSRF·세션·취소·응답 binding 검증은 유지한다. 모르는 ID와 close/update/start는 기존 GET·capability·revision 검증을 그대로 거친다.

실제 관리 금융값은 origin=exchange와 actualExecutionVerified가 모두 확인된 경우에만 표시하며 PnL은 accountingComplete도 필요하다. 미검증/synthetic의 포지션·손익은 미제공으로 남겨도 알려진 구독의 긴급 제어는 유지한다. owner 또는 copyId가 바뀌면 열린 action/입력/intent를 폐기한다.

create/start 신청 완료는 SDK가 exact binding을 검증한 서버 ACTIVE commit으로 판정한다. 실제 Backend mutation renderer의 origin=unconnected/actualExecutionVerified=false 응답도 정상 신청 완료이며 설정창을 닫고 관리로 이동한다. 이것은 체결·포지션·손익의 확인이 아니며 관리 GET의 후속 projection과 분리한다. GET 불가 시 금융값은 미제공으로 남고 이미 검증한 자기 구독의 pause/stop은 유지한다.

비차단 검수 잔여: API18에는 종료 시각·완전한 종료 거래/예산 이력이 없다. 관리의 날짜 표시 일부는 joinedAt 소비 단계이며 실제 종료 시각을 완성한 증거가 아니다. list/get에 의한 미확정 intent 해소·재시작 후 fence 연속성 등은 서버 소유 증거와 별도 통합 인수에 남긴다.
