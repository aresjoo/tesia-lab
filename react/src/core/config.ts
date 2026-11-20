// 원본 site-config.js 의 공용 값과, 아직 React 로 옮기지 않은 화면이 가는 곳.
export const SOCIAL = {
  x: 'https://x.com/teth_ai',
  instagram: 'https://www.instagram.com/teth.ai',
  youtube: 'https://www.youtube.com/@teth_ai',
  telegram: 'https://t.me/teth_ai',
};

/** 원본(HTML 판) 주소. 아직 옮기지 않은 화면은 같은 경로의 원본을 연다. */
// 배포본(react.html)은 원본과 같은 폴더에 놓이므로 './' 가 원본이다. 개발 서버에서는 떠 있는 사이트를 연다.
export const LEGACY_URL: string = (import.meta.env.VITE_LEGACY_URL as string | undefined) || (import.meta.env.DEV ? 'https://aresjoo.github.io/tesia-lab/' : './');
export const legacy = (path = '') => LEGACY_URL + path;

/**
 * React 로 옮긴 문서들의 주소 표(한 곳). 앱과 독립 페이지(소개, 앱 다운로드, 약관)는 같은 폴더에 나란히 놓인다:
 * 개발 서버는 index.html, about.html 식이고 배포본은 저장소 최상위의 react.html, react-about.html 식이다(tools/publish.mjs).
 * 그래서 어느 문서에서든 같은 폴더 기준 상대 주소로 서로를 연다. 원본의 '../', '../about/', '../download/', '../policies/#terms' 자리다.
 */
const doc = (name: string) => (import.meta.env.DEV ? (name ? `${name}.html` : './') : name ? `react-${name}.html` : 'react.html');
export const PAGES = {
  /** 앱(원본 '../', site-config.js 의 appUrl) */
  app: doc(''),
  about: doc('about'),
  download: doc('download'),
  policies: doc('policies'),
  terms: doc('policies') + '#terms',
  privacy: doc('policies') + '#privacy',
};
/** 앱의 해시 경로를 독립 페이지에서 여는 주소 (원본 푸터의 '../index.html#/trade' 자리) */
export const appAt = (hash = '') => PAGES.app + hash;
