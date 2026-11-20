// 약관 페이지의 「개인정보처리방침」 (원본 #v-privacy). 글은 원본 그대로다.
import type { ReactNode } from 'react';
import { PAGES } from '../../../core/config';
import { PageIco } from '../../shared/PageIcons';

export function Privacy({ toc }: { toc: ReactNode }) {
  return (
    <div className="doc">
      {toc}
      <div className="docmain">
        <div className="inner">
          <div className="sum">
            <div className="sum-row">
              <PageIco k="lock" />
              <div>
                <b>출금 권한은 요청하지 않습니다</b>
                <span>잔고 조회와 주문 권한으로만 거래소에 연결합니다.</span>
              </div>
            </div>
            <div className="sum-row">
              <PageIco k="unlink" />
              <div>
                <b>연결은 언제든 해제합니다</b>
                <span>해제하면 저장된 연결 정보를 바로 파기합니다.</span>
              </div>
            </div>
            <div className="sum-row">
              <PageIco k="doc" />
              <div>
                <b>기록은 직접 관리합니다</b>
                <span>전략, 백테스트, 거래 기록을 언제든 내보내고 삭제합니다.</span>
              </div>
            </div>
            <div className="sum-row">
              <PageIco k="ban" />
              <div>
                <b>광고 목적으로 판매하지 않습니다</b>
                <span>수집한 정보는 서비스를 제공하는 데만 씁니다.</span>
              </div>
            </div>
          </div>
          <div className="label" id="p-intro">TETH 개인정보처리방침</div>
          <p className="intro">TETH는 사용자들이 신뢰를 바탕으로 정보를 제공한다는 것을 잘 알고 있습니다. TETH는 사용자의 신뢰에 대한 막중한 책임을 인지하며 최선을 다해 개인정보를 보호하고 사용자가 직접 제어할 수 있도록 노력하고 있습니다.</p>
          <p>이 개인정보처리방침은 TETH에서 수집하는 정보의 유형, 정보를 수집하는 이유, 정보를 업데이트, 관리, 내보내기, 삭제하는 방식에 대한 이해를 돕기 위한 것입니다.</p>
          <div className="callout">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l9 5v6c0 5-4 8-9 9-5-1-9-4-9-9V7z" />
              <circle cx="12" cy="10" r="2.4" />
              <path d="M8.4 15.6c.9-1.8 2.1-2.6 3.6-2.6s2.7.8 3.6 2.6" />
            </svg>
            <div>
              <b>연결 권한 진단</b>
              거래소 연결 권한을 확인하려고 합니까?
              <div>
                <a className="lnk" href={PAGES.app}>연결 권한 확인하기</a>
              </div>
            </div>
          </div>
          <p className="meta">발효일: 2026년 9월 4일</p>
          <div className="hr" />
          <h2 id="p-collect">TETH에서 수집하는 정보</h2>
          <p>TETH는 서비스를 제공하기 위해 필요한 최소한의 정보를 수집합니다.</p>
          <ul>
            <li>
              <b>계정 정보</b>
              , 이메일 주소, 로그인 방식(Google, Apple, 이메일), 프로필 이름.
            </li>
            <li>
              <b>거래소 연결 정보</b>
              {', 사용자가 직접 등록한 API 키. 키는 암호화되어 저장되며, 조회, 주문 권한만 사용합니다. '}
              <b>출금 권한은 어떤 경우에도 요청하거나 저장하지 않습니다.</b>
            </li>
            <li>
              <b>이용 기록</b>
              , 생성한 전략, 백테스트 결과, 실행, 모니터링 기록. 서비스 제공과 복기 기능을 위해 보관됩니다.
            </li>
            <li>
              <b>기기 및 로그 정보</b>
              , 접속 기기 유형, 브라우저, IP 주소, 오류 로그. 보안과 품질 개선에 사용됩니다.
            </li>
          </ul>
          <h2 id="p-why">TETH에서 데이터를 수집하는 이유</h2>
          <p>수집한 정보는 다음 목적에만 사용됩니다: 전략 연구, 검증, 실행 서비스 제공, 계정 보호와 이상 접근 탐지, 서비스 품질 개선, 법적 의무 이행. TETH는 사용자의 데이터를 광고 목적으로 제3자에게 판매하지 않습니다.</p>
          <h2 id="p-settings">개인정보 보호 설정</h2>
          <p>계정 설정에서 프로필 정보 수정, 거래소 연결 해제, 알림 수신 여부를 언제든 변경할 수 있습니다. 거래소 연결을 해제하면 저장된 API 키는 즉시 파기됩니다.</p>
          <h2 id="p-share">정보 공유</h2>
          <p>TETH는 다음 경우를 제외하고 개인정보를 외부에 공유하지 않습니다: 사용자가 직접 동의한 경우, 주문 실행을 위해 연결된 거래소에 요청을 전달하는 경우, 법령에 따라 요구되는 경우.</p>
          <h2 id="p-secure">정보 보안 유지</h2>
          <p>모든 데이터는 전송 구간과 저장 시 암호화됩니다. API 키는 별도의 암호화 저장소에 보관되며 내부 직원도 원문에 접근할 수 없습니다. 비정상적인 접근이 감지되면 자동으로 실행이 일시 정지되고 사용자에게 알립니다.</p>
          <h2 id="p-export">정보 내보내기 및 삭제</h2>
          <p>사용자는 언제든 자신의 전략, 백테스트, 거래 기록을 내보낼 수 있으며, 계정 삭제를 요청하면 법적 보관 의무가 있는 정보를 제외한 모든 데이터가 30일 이내에 파기됩니다.</p>
          <h2 id="p-retain">정보 유지</h2>
          <p>계정이 활성 상태인 동안 서비스 제공에 필요한 정보를 보관합니다. 거래 관련 기록은 관련 법령이 정한 기간 동안 보관될 수 있습니다.</p>
          <h2 id="p-comply">규정 준수</h2>
          <p>TETH는 개인정보 보호 관련 법령을 준수하며, 규제 당국의 적법한 요청에 협력합니다. 방침이 변경되는 경우 시행 전에 공지합니다.</p>
        </div>
      </div>
    </div>
  );
}
