// 소개 페이지의 내용 표 (원본 about/index.html). 글과 숫자는 원본 그대로다.
import type { PageIcon } from './icon';

/** 아이콘 한 줄. logos 가 있으면 글 뒤에 거래소 로고 줄이 붙는다. */
export type AboutItem = { ic: PageIcon; t: string; logos?: boolean };

/** 연결 가능한 거래소 로고 (원본 EX): [이름, 확장자] → assets/logos/app-<이름>.<확장자> */
export const ABOUT_EXCHANGES: [string, string][] = [
  ['bitget', 'png'],
  ['binance', 'png'],
  ['okx', 'png'],
  ['bybit', 'png'],
  ['mexc', 'png'],
  ['woox', 'png'],
  ['gate', 'jpg'],
];
export const exchangeLogo = (e: [string, string]) => `assets/logos/app-${e[0]}.${e[1]}`;

export const ABOUT_HERO = {
  lb: 'TETH',
  h1: '거래하는 사람을 위한 AI 트레이딩',
  d: '말로 전략을 만들고, 실제 시장 데이터로 검증하고, 지금 쓰는 거래소 계정에서 실행합니다.',
  cta: '무료로 시작하기',
  link: '요금 보기',
  free: '영원히 무료, 카드 등록 없음',
  shot: { src: 'assets/shots/v2/about-live.webp', w: 1376, h: 900, alt: 'TETH 터미널, 차트와 판단 패널' },
};

export type AboutStep = { lb: string; h: string; d: string; items: AboutItem[]; link: string; shot: { src: string; w: number; h: number; alt: string; tall?: boolean } };
/** 「이렇게 씁니다」의 네 카드: 대화, 검증, 연결, 실행 */
export const ABOUT_STEPS: AboutStep[] = [
  {
    lb: '대화',
    h: '말로 만드는 전략',
    d: '아이디어를 말하면 TETH가 진입, 청산, 손절 조건이 정해진 전략으로 정리합니다.',
    items: [
      { ic: 'chat', t: '빠진 조건은 TETH가 먼저 묻습니다' },
      { ic: 'list', t: '진입, 청산, 손절 조건으로 정리' },
      { ic: 'layers', t: '차트 규칙, AI 판단, 혼합 전략' },
    ],
    link: '전략 만들기',
    shot: { src: 'assets/shots/v2/about-plan2.webp', w: 844, h: 517, alt: 'TETH 전략 카드, 자산과 사고파는 조건' },
  },
  {
    lb: '검증',
    h: '실제 데이터로 검증',
    d: '지난 시장 데이터로 전략을 돌려 수익과 위험을 숫자로 확인합니다.',
    items: [
      { ic: 'cal', t: '최근 3개월부터 전체 기간까지' },
      { ic: 'chart', t: '수익률과 가장 크게 내려간 폭' },
      { ic: 'doc', t: '매번의 판단 기록' },
    ],
    link: '결과 보기',
    shot: { src: 'assets/shots/v2/about-backtest2.webp', w: 1216, h: 700, alt: 'TETH 백테스트 결과, 잔고 차트와 판단 기록' },
  },
  {
    lb: '연결',
    h: '지금 쓰는 계정 그대로',
    d: '거래소를 고르고 한 번 승인하면, 전략이 그 계정에서 직접 주문합니다.',
    items: [
      { ic: 'grid', t: '연결 가능한 거래소 7곳', logos: true },
      { ic: 'check', t: '한 번 승인으로 연결' },
      { ic: 'lock', t: '연결 권한: 잔고 조회와 주문' },
    ],
    link: '거래소 연결하기',
    shot: { src: 'assets/shots/v2/about-connect.webp', w: 900, h: 640, alt: 'TETH 거래소 선택 화면' },
  },
  {
    lb: '실행',
    h: '판단 근거까지 기록',
    d: '전략이 24시간 시장을 보고, 사고판 이유를 문장으로 남깁니다.',
    items: [
      { ic: 'clock', t: '24시간 자동 실행' },
      { ic: 'bulb', t: 'TETH의 생각과 판단 기록' },
      { ic: 'pause', t: '언제든 일시정지와 긴급 정지' },
    ],
    link: '터미널 열기',
    shot: { src: 'assets/shots/v2/about-brain.webp', w: 392, h: 560, alt: 'TETH 터미널 판단 패널', tall: true },
  },
];

export type AboutPlan = {
  /** 강조 카드(TETH 초대 계정) */
  hi: boolean;
  lb: string;
  h: string;
  d: string;
  /** 달러 숫자 (앞의 $ 와 뒤의 '/ 월' 은 화면이 붙인다) */
  price: string;
  cta: string;
  sub: string;
  items: AboutItem[];
  foot: string;
};
/**
 * 요금 카드 둘. 원본 스크립트가 앱의 플랜 화면과 같은 내용으로 직접 그린다
 * (site-config.js 의 pricing 표는 이 카드에 쓰이지 않고, 단추가 가는 곳 appUrl 만 쓴다).
 */
export const ABOUT_PLANS: AboutPlan[] = [
  {
    hi: true,
    lb: 'TETH 초대 계정',
    h: '거래하는 사람을 위해',
    d: 'TETH 초대로 가입한 거래소 계정으로 이용합니다. 초대 계정이 없다면 거래소에 새로 가입합니다.',
    price: '0',
    cta: '무료로 시작하기',
    sub: '포함된 기능',
    items: [
      { ic: 'bolt', t: '전략 자동 실행' },
      { ic: 'grid', t: '연결 가능한 거래소 7곳', logos: true },
      { ic: 'coin', t: '거래 수수료 환급' },
      { ic: 'trophy', t: '전략 대회 참가' },
      { ic: 'card', t: '카드 등록 없이 이용' },
      { ic: 'lock', t: '연결 권한: 잔고 조회와 주문' },
      { ic: 'head', t: '24시간 고객 지원' },
    ],
    foot: 'Bitget, Binance, OKX, Bybit, MEXC는 거래 수수료의 20%, WOO X과 Gate는 50%를 환급합니다. 연결 과정에서 TETH 초대 계정 여부를 확인합니다.',
  },
  {
    hi: false,
    lb: 'TETH 구독',
    h: '지금 쓰는 계정 그대로',
    d: 'TETH 초대로 가입하지 않은 거래소 계정도 연결합니다. 기존 계정을 유지하며 전략을 실행합니다.',
    price: '280',
    cta: '구독으로 시작하기',
    sub: '구독 혜택',
    items: [
      { ic: 'bolt', t: '전략 자동 실행' },
      { ic: 'grid', t: '연결 가능한 거래소 7곳', logos: true },
      { ic: 'swap', t: '초대 가입 없이 계정 연결' },
      { ic: 'cal', t: '거래소 7곳 모두 연결' },
      { ic: 'lock', t: '연결 권한: 잔고 조회와 주문' },
      { ic: 'head', t: '24시간 고객 지원' },
    ],
    foot: '매월 자동 결제됩니다. 설정의 결제에서 언제든 해지할 수 있으며, 해지 후에도 남은 구독 기간 동안 이용할 수 있습니다.',
  },
];
export const ABOUT_PRICE_UNIT = '/ 월';

/** 「이용 전에 확인합니다」의 네 줄 */
export const ABOUT_CHECKS: { ic: PageIcon; b: string; s: string }[] = [
  { ic: 'wallet', b: '거래 한도', s: '전략마다 쓸 금액과 손실 중단 기준을 직접 정합니다.' },
  { ic: 'cal', b: '검증 기간', s: '백테스트는 고른 기간의 실제 시장 데이터로 돌리고, 결과 화면에 기간을 함께 보여 줍니다.' },
  { ic: 'lock', b: '연결 권한', s: '잔고 조회와 주문 권한으로 연결합니다. 연결은 언제든 해제할 수 있습니다.' },
  { ic: 'doc', b: '판단 기록', s: '거래마다 판단 근거를 기록해 언제든 다시 볼 수 있습니다.' },
];

/** 답의 조각: 글, 또는 앱 다운로드 페이지로 가는 링크 */
export type AboutFaqPart = string | { download: string };
export const ABOUT_FAQ: { q: string; a: AboutFaqPart[] }[] = [
  { q: 'TETH는 어떤 서비스입니까?', a: ['말로 투자 전략을 만들고, 실제 시장 데이터로 검증하고, 연결한 거래소에서 실행하는 AI 트레이딩 서비스입니다.'] },
  { q: '전략은 어떻게 실행합니까?', a: ['검증을 마친 전략은 연결한 거래소 계정에서 자동으로 실행합니다. 시작 전에 직접 승인합니다.'] },
  { q: '어떤 거래소를 연결합니까?', a: ['Bitget, Binance, OKX, Bybit, MEXC, WOO X, Gate 7곳을 연결합니다.'] },
  { q: '백테스트 결과는 어디서 확인합니까?', a: ['전략을 만들면 바로 검증하고, 결과 화면에서 수익률, 가장 크게 내려간 폭, 판단 기록을 보여 줍니다.'] },
  { q: '연결 권한은 무엇입니까?', a: ['잔고 조회와 주문 권한으로 연결합니다. 연결은 언제든 해제할 수 있습니다.'] },
  { q: '무료로 쓸 수 있습니까?', a: ['TETH 초대로 가입한 거래소 계정이면 TETH 초대 계정으로 씁니다. 영원히 무료, 카드 등록 없음입니다.'] },
  { q: '모바일 앱이 있습니까?', a: ['iOS, Android 앱을 준비하고 있습니다. ', { download: '앱 다운로드 페이지' }, '에서 소식을 확인합니다.'] },
];

export const ABOUT_FINAL = {
  lb: 'TETH 초대 계정',
  h: '거래하는 사람을 위해',
  d: '아이디어 하나로 시작합니다. 전략을 만들고 검증한 뒤, 지금 쓰는 거래소에서 실행합니다.',
  cta: '무료로 시작하기',
  free: '영원히 무료, 카드 등록 없음',
  help: '막히면 상담원이 24시간 답합니다.',
  helpLink: '상담원에게 묻기',
};
