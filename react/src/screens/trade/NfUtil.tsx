// 오른쪽 위 알림 묶음 (원본 tfNFBar, #nf-util). 크레딧 표시는 원본에서 빠졌고 종 단추만 남았는데,
// 원본은 이 묶음을 모든 화면에서 숨겨 둔다(hidden). 자리와 안 읽은 수만 같은 모양으로 둔다.
import { useApp } from '../../state/store';
import { useTf } from './store';
import { tfNFGoAlerts } from './term/tm';

export function NfUtil() {
  const user = useApp((s) => s.user);
  const t = useTf();
  if (!user) return null;
  const un = t.notifs.filter((n) => !n.read).length;
  return (
    <div id="nf-util" hidden>
      <button
        className="nf-bell"
        id="nf-bell"
        onClick={(e) => {
          e.stopPropagation();
          tfNFGoAlerts();
        }}
        aria-label="알림"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        <span className="bd" id="nf-bell-bd" hidden={!un}>
          {un > 9 ? '9+' : String(un)}
        </span>
      </button>
    </div>
  );
}
