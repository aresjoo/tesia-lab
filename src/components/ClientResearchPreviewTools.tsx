/** Development controls are outside the client's product document and state header. */
export function ClientResearchPreviewTools({ seconds, status, onPause, onResume, onFinish }: {
  seconds: number
  status: 'idle' | 'playing' | 'paused' | 'completed'
  onPause: () => void
  onResume: () => void
  onFinish: () => void
}) {
  return <details className="client-preview-tools">
    <summary>개발 미리보기 · 샘플 데이터</summary>
    <div className="client-preview-panel">
      <p>클라이언트 화면 검수용입니다. 연구 수치와 문서 답변은 예시이며 실제 AI·백테스트·주문을 실행하지 않습니다.</p>
      {status !== 'idle' && <div className="client-preview-actions">
        <span role="status">{Math.floor(seconds)}초 / 95초 · {status === 'paused' ? '일시 정지' : status === 'completed' ? '재생 완료' : '재생 중'}</span>
        {status === 'playing' && <button type="button" onClick={onPause}>일시 정지</button>}
        {status === 'paused' && <button type="button" onClick={onResume}>계속 재생</button>}
        {status !== 'completed' && <button type="button" onClick={onFinish}>샘플 끝까지 보기</button>}
      </div>}
    </div>
  </details>
}
