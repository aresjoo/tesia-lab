// 알림 원장 (원본 tfNotify). 화면 없는 부분만: 상태가 넘어갈 때 한 번만 만들고, 같은 키는 다시 만들지 않는다.
// 상단 종 단추(#nf-util)는 원본 CSS 가 통째로 숨기므로(rd.css `#nf-util{display:none!important}`) 흔들림 연출은 옮기지 않았다.
import { translate } from '../i18n';
import { tfNFInit, tfSave } from './tf';

export type Notif = { id: string; type: string; key: string; title: string; body: string; link: string | null; at: number; read: boolean };

/** 원본 L(k): 지금 고른 언어(저장값 tethLang)로 읽는다. core 는 앱 상태를 모르므로 저장값을 본다 */
export function L(k: string): string {
  let lang = 'ko';
  try {
    lang = localStorage.getItem('tethLang') || 'ko';
  } catch {
    /* 무시 */
  }
  return translate(lang, k);
}

/** tfNotify(type,key,title,body,link): 100개 상한, 처리 키 원장으로 다시 만들지 않는다 */
export function tfNotify(type: string, key: string, title: string, body?: string | null, link?: string | null): Notif | null {
  const t = tfNFInit();
  const keys = t.notifKeys as Record<string, unknown>;
  if (keys[key]) return null;
  keys[key] = 1;
  const n: Notif = { id: 'n' + Date.now() + Math.floor(Math.random() * 1e3), type, key, title, body: body || '', link: link || null, at: Date.now(), read: false };
  const list = t.notifs as Notif[];
  list.unshift(n);
  if (list.length > 100) t.notifs = list.slice(0, 100);
  tfSave();
  return n;
}
