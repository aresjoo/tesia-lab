// 이 조각의 화면들이 같이 쓰는 작은 것들.
import { useEffect, useSyncExternalStore } from 'react';
import { tfSubscribe, tfVersion } from '../../core/account/tf';
import { setState, toast } from '../../state/store';

/** S.tf 가 바뀌면(tfSave, tfBump) 다시 그린다. 값은 core 의 tfS(), acS() 로 읽는다. */
export const useTf = () => useSyncExternalStore(tfSubscribe, tfVersion);

/** tfTxHelp(): 상담원에게 묻기 = 24시간 고객지원 버튼의 창을 연다 */
export function tfTxHelp() {
  if (document.getElementById('teth-help')) setState({ helpOpen: true });
  else toast('support@teth.ai 로 문의해 주십시오');
}

/** gContent(html) 가 하던 일: 화면이 바뀌면 맨 위로 */
export function scrollTop() {
  const s = document.getElementById('g-scroll');
  if (s) s.scrollTop = 0;
  try {
    window.scrollTo(0, 0);
  } catch {
    /* 무시 */
  }
}
export function useScrollTop(key: unknown) {
  useEffect(() => {
    scrollTop();
  }, [key]);
}
