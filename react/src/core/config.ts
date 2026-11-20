// 원본 site-config.js 의 공용 값과, 아직 React 로 옮기지 않은 화면이 가는 곳.
export const SOCIAL = {
  x: 'https://x.com/teth_ai',
  instagram: 'https://www.instagram.com/teth.ai',
  youtube: 'https://www.youtube.com/@teth_ai',
  telegram: 'https://t.me/teth_ai',
};

/** 원본(HTML 판) 주소. 아직 옮기지 않은 화면은 같은 경로의 원본을 연다. */
export const LEGACY_URL: string = (import.meta.env.VITE_LEGACY_URL as string | undefined) || 'https://aresjoo.github.io/tesia-lab/';
export const legacy = (path = '') => LEGACY_URL + path;
