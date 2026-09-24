# 구현 에이전트 공통 브리프 (모든 표면 공통)

## 맥락
- 제품: TETH AI (암호화폐 AI 트레이딩 데모, 정적 단일 파일 SPA). 목업이므로 컴플라이언스·법률·투자 위험 고지 관점은 완전히 무시한다. 그런 문구를 새로 넣지 않는다.
- 정본 문서(반드시 먼저 읽기): `ux/spec/UX_PAGE_SPEC.md`(당신 섹션), `ux/spec/UX_DECISION_LOG.md`(전체, 특히 R1 갱신), `ux/spec/UX_COPY_SYSTEM.md`, `ux/spec/UX_STATE_MATRIX.md`. 배경은 `ux/spec/UX_MASTER_PLAN.md`.
- 토대(이미 구현됨, index.html의 "W1 토대" 블록): `tfDerive()` 파생 상태, `tfStratTitle(p,asset,opt)`/`tfStratSub(p)`/`tfSeedTitle(seed)`/`tfKindBadge(kind)`, QA 실험실(`tfQaPreset(id)`, 오버레이), 안전 셔틀 `tfXLaunchDemo/tfPreviewOpen/tfPreviewClose/tfAcSheet(kind)`. 이들의 시그니처는 바꾸지 말고 사용한다. `tfAcSheet(kind)`는 `tfAcSheetView`가 정의되면 그것을 호출하는 셔틀이다(활성화 담당 표면이 정의).

## 코드 규칙
- 파일: `index.html` 하나. 라우트 문자열·기존 전역 함수명은 유지하고 본문을 교체한다. 다른 표면의 함수는 건드리지 않는다(아래 "당신 범위" 밖 함수 수정 금지).
- 새 JS 함수는 index.html 안의 앵커 주석 `/* ==JS:<접두>== */` 바로 아래에 추가한다(당신 접두만). 새 CSS는 `</style>` 앞의 `/* ==CSS:<접두>== */` 앵커 바로 아래에 추가하며 당신 접두 클래스만 정의한다. 다른 앵커 블록은 절대 수정하지 않는다(병렬 작업 후 git merge 충돌 방지).
- ES5 스타일(var, function). 템플릿 리터럴·화살표 함수 사용 금지(기존 파일 관례). 문자열 HTML은 기존 함수들처럼 `'…'+`로.
- 디자인: 다크 토큰(`var(--gt)`, `--gt2`, `--gt3`, `--gg`, `--surface`, `--border`), 라임 `#c8f43c`는 1차 CTA에만. 카드·배지·그라데이션 남발 금지. 화면당 1차 CTA 1개. 반응형 390px에서 가로 스크롤 0.
- 카피: `ux/spec/UX_COPY_SYSTEM.md` 규칙. em dash(—)와 가운뎃점(·) 금지(쉼표 사용). 금지 어휘(UID·Fast API·PRO·플랜·크레딧·소진·업그레이드·위임·구독 멤버십·체험 모드·카피하기·복제하기) 사용 금지. 모델명은 스펙이 허용한 자리에서만.
- 데모 고지는 화면당 1곳 "시뮬레이션 데이터예요".

## 검증 (필수, 결과를 보고에 포함)
1. 문법: `node -e "const fs=require('fs'),vm=require('vm');const s=fs.readFileSync('index.html','utf8');const re=/<script>([\s\S]*?)<\/script>/g;let m,i=0;while((m=re.exec(s))){i++;try{new vm.Script(m[1],{filename:'s'+i});console.log('ok',i)}catch(e){console.log('ERR',i,e.message)}}"`
2. 헤드리스 크롬(포트 9333에 이미 실행 중)과 정적 서버: `node "C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/srv/serve.mjs" "<당신 작업 디렉터리 절대경로>" <포트>` 를 백그라운드로 띄운다(포트는 브리프에서 지정). CDP 드라이버: `C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs` (export: newPage, closePage, goto, evala, viewport, shot, clickSel, sleep). 예시 스크립트: 같은 폴더의 `verify-w1.mjs`, `crawl.mjs`.
3. 각 상태에서 스크린샷(1440x900, 390x844)을 `ux/shots/<접두>/`에 저장하고 직접 열어(Read) 픽셀을 확인한다. `Runtime.exceptionThrown` 0건이어야 한다.
4. 상태 재현: `tfQaPreset('01'|'02'|'03'|…)`, 오버레이 `tfQaOverlay('strat')` 등으로 QA 프리셋을 걸고 확인한다.
5. 완료 후 `git add -A && git commit -m "<접두>: <요약>"` (커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`). 푸시 금지.

## 보고 형식
변경한 함수 목록(행 범위), 새 함수, 삭제한 문구, 스크린샷 경로, 검증 결과(문법/예외/뷰포트), 스펙과 다르게 한 결정과 이유, 남은 문제.
