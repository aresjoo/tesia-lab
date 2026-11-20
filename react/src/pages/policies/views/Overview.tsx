// 약관 페이지의 「개요」 (원본 policies/index.html 의 #v-overview). 글은 원본 그대로다.
import { PAGES } from '../../../core/config';

export function Overview() {
  return (
    <div className="ov">
      <div className="cell">
        <h2>개인정보처리방침</h2>
        <p>TETH가 수집하는 정보, 수집 이유, 정보 사용 방법, 정보 검토 및 업데이트 방법에 대해 설명합니다.</p>
        <div className="lnk-row">
          <a className="lnk" href="#privacy">TETH 개인정보처리방침 읽기</a>
        </div>
      </div>
      <div className="cell">
        <h2>서비스 약관</h2>
        <p>TETH 서비스를 이용할 때 사용자가 동의하는 규정을 설명합니다.</p>
        <div className="lnk-row">
          <a className="lnk" href="#terms">TETH 서비스 약관 읽기</a>
        </div>
      </div>
      <div className="cell">
        <h2>TETH 안전 센터</h2>
        <div className="ico-row">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l9 5v6c0 5-4 8-9 9-5-1-9-4-9-9V7z" />
            <path d="M8.5 12l2.5 2.5 4.5-4.5" />
          </svg>
          <div>
            <p style={{ marginTop: 0 }}>모두를 위한 제품을 만든다는 것은 제품을 사용하는 모든 사람을 보호한다는 의미입니다. 거래소 API 키 암호화, 출금 권한 미요청, 1회 손실 한도 등 TETH에 내장된 보안 기능과 개인정보 보호 설정, 도구에 관해 자세히 알아봅니다.</p>
            <div className="lnk-row">
              <a className="lnk" href="#technologies">보안을 위한 TETH의 노력 알아보기</a>
            </div>
          </div>
        </div>
      </div>
      <div className="cell">
        <h2>TETH 계정</h2>
        <div className="ico-row">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9.2" />
            <circle cx="12" cy="9.6" r="3" />
            <path d="M6.4 18.4c1.2-2.6 3.2-3.9 5.6-3.9s4.4 1.3 5.6 3.9" />
          </svg>
          <div>
            <p style={{ marginTop: 0 }}>계정을 한 곳에서 관리하고 안전하게 보호합니다. TETH 계정에서 데이터와 개인정보, 거래소 연결을 보호하는 데 필요한 설정 및 도구에 쉽게 액세스할 수 있습니다.</p>
            <div className="lnk-row">
              <a className="lnk" href={PAGES.app}>TETH 계정 확인하기</a>
            </div>
          </div>
        </div>
      </div>
      <div className="cell">
        <h2>TETH의 개인정보 보호 및 보안 원칙</h2>
        <div className="ico-row">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          <div>
            <p style={{ marginTop: 0 }}>TETH는 모두를 지켜 주는 투자 연구 환경을 구축합니다. TETH의 제품, 프로세스, 직원은 다음 원칙을 바탕으로 사용자의 데이터와 자산 접근 권한을 비공개로 안전하게 유지합니다.</p>
            <div className="lnk-row">
              <a className="lnk" href="#privacy">TETH의 개인정보 보호 및 보안 원칙 살펴보기</a>
            </div>
          </div>
        </div>
      </div>
      <div className="cell">
        <h2>TETH 제품 개인정보 보호 가이드</h2>
        <div className="ico-row">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14" />
            <path d="M4 19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2" />
            <path d="M8 8h8M8 12h5" />
          </svg>
          <div>
            <p style={{ marginTop: 0 }}>
              {'전략 연구, 백테스트, 실행 및 모니터링을 사용할 때 개인정보와 사용 기록을 제어하고 보호할 권한은 사용자 자신에게 있습니다. '}
              <a className="lnk" href="#privacy">TETH 제품 개인정보 보호 가이드</a>
              를 이용하면 TETH 제품에서 제공하는 개인정보 보호 기능을 관리하는 방법을 알아볼 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
