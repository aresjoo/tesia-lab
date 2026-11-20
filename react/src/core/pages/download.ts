// 앱 다운로드 페이지의 내용과 규칙 (원본 download/index.html).
import { TETH_CONFIG } from '../siteConfig.data';

export type DlStore = { id: 'android' | 'ios'; name: string; url: string };
/** 스토어 주소는 site-config.js 의 값. 비어 있으면 QR 자리에 '출시 준비 중입니다' 가 뜬다. */
export const DL_STORES: DlStore[] = [
  { id: 'android', name: 'Google Play', url: TETH_CONFIG.androidStoreUrl },
  { id: 'ios', name: 'App Store', url: TETH_CONFIG.iosStoreUrl },
];
export const DL_STORE_PC = '휴대전화 카메라로 스캔해 설치합니다';
export const DL_STORE_MO = '스토어에서 바로 설치합니다';
export const DL_QR_TODO = '출시 준비 중입니다';

/** QR 그림 주소 */
export const qrSrc = (url: string) => 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=' + encodeURIComponent(url);

export type DlSlide = { tab: string; img: string; alt: string; p: string };
export const DL_SLIDES: DlSlide[] = [
  { tab: '대화', img: 'assets/shots/v2/dl-chat.webp', alt: 'TETH 모바일 대화 화면, 전략 카드', p: '말하면 진입, 청산, 손절 조건이 정해진 전략 카드로 정리합니다.' },
  { tab: '검증', img: 'assets/shots/v2/dl-report.webp', alt: 'TETH 모바일 백테스트 결과 화면', p: '실제 시장 데이터로 돌린 결과를 수익률과 내려간 폭으로 봅니다.' },
  { tab: '실행', img: 'assets/shots/v2/dl-live.webp', alt: 'TETH 모바일 터미널 판단 패널', p: '보유 종목과 TETH의 생각, 판단 기록을 24시간 남깁니다.' },
];
/** 자동 넘김 간격(ms). 탭을 누르면 멈춘다. */
export const DL_AUTO_MS = 6000;
/** show(i) 의 색인: 양 끝에서 돌아간다 */
export const wrapSlide = (i: number, n: number) => (i + n) % n;
