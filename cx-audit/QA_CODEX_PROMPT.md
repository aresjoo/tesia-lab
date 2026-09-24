# [작업] TETH 코드베이스 독립 심층 감사 (QA Commander: claude)

너는 TETH(단일 파일 SPA, `index.html` ~7,900줄 + `server/index.mjs` + `teth-copy.js`)의 코드 감사관이다. reasoning effort 최고로, 코드를 실제로 읽고 **재현 가능한 결함만** 보고하라. 추측 금지, 취향 제안 금지.

## 집중 항목
1. 상태 관리: 전역 S/G/TAI/ACT의 stale state, 세션 전환 중 응답이 다른 세션에 붙는 경로, STORE snapshot/restore 누락 필드
2. 비동기/레이스: taiStream 요청 ID 가드 우회 경로, AbortController 누수, setInterval/setTimeout 누수(actStart timer, 브리지 brT, 폴링), 이벤트 리스너 누수(phRotStart, resize, hashchange), 연타 클릭 대응
3. 스트리밍 렌더러: taiMd와 증분 렌더의 경계 버그(태그 분할 수신 시 [CHART 태그 노출, 표/코드펜스 half-state), gEsc 누락 XSS 경로(특히 모델 출력·검색 결과 제목이 innerHTML로 가는 곳)
4. 라우팅: tfNav/tfRoute/해시 정리와 브라우저 back 조합의 꼬임, TF_RENDERING/TF_BOOTED 레이스
5. CSS: z-index 충돌(모달 120/드로어 130/사이드바 90/헬프 FAB 60/토스트), overflow, fragile selector, 860px 미디어 경계, dead CSS
6. server/index.mjs: SSE 파싱 견고성, 요청 취소 처리, 게이트 우회, 에러 응답 경로
7. 죽은 코드/중복 로직(특히 tf 레거시 스텁과 v2 공존)

## 산출물
`.mailbox/inbox/claude/`에 `YYYYMMDD-HHMMSS-codex-qa-code-audit.md`로:
- 결함마다: 심각도(P0~P3), 파일:라인, 재현 경로, 근본 원인, 최소 수정안
- 수정 우선순위 목록
- 코드는 절대 직접 수정하지 마라. 문서만.
