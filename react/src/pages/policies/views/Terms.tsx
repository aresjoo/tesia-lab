// 약관 페이지의 「서비스 약관」 (원본 #v-terms). 글은 원본 그대로다.
import type { MouseEvent, ReactNode } from 'react';
import { PageIco } from '../../shared/PageIcons';

export function Terms({ toc, go }: { toc: ReactNode; go: (e: MouseEvent, t: string) => void }) {
  return (
    <div className="doc">
      {toc}
      <div className="docmain">
        <div className="inner">
          <div className="sum">
            <div className="sum-row">
              <PageIco k="check" />
              <div>
                <b>시작은 직접 승인합니다</b>
                <span>전략은 승인한 경우에만 연결한 거래소에서 실행합니다.</span>
              </div>
            </div>
            <div className="sum-row">
              <PageIco k="pause" />
              <div>
                <b>언제든 멈춥니다</b>
                <span>실행 중에도 일시정지와 종료를 바로 할 수 있습니다.</span>
              </div>
            </div>
            <div className="sum-row">
              <PageIco k="doc" />
              <div>
                <b>판단 근거를 남깁니다</b>
                <span>거래마다 판단 근거를 기록해 다시 볼 수 있습니다.</span>
              </div>
            </div>
          </div>
          <div className="label" id="t-intro">TETH 서비스 약관</div>
          <p className="meta" style={{ marginTop: 16 }}>발효일: 2026년 9월 4일</p>
          <p>국가 버전: 대한민국</p>
          <h2 id="t-scope">본 약관에서 다루는 내용</h2>
          <p className="intro">본 서비스 약관을 확인하는 것이 번거로울 수 있다는 점은 이해하지만, 귀하가 TETH 서비스를 사용하면서 TETH에 기대할 수 있는 부분과 TETH가 귀하에게 기대하는 부분을 명확히 해 두는 것은 중요합니다.</p>
          <p>본 서비스 약관에는 TETH의 사업 운영 방식, TETH에 적용되는 법률이 반영되어 있습니다. 귀하가 TETH 서비스와 상호작용하면 본 서비스 약관을 근거로 TETH와의 관계가 정의됩니다. 약관에는 다음과 같은 제목의 주제들이 포함됩니다.</p>
          <ul>
            <li>
              <b>TETH에 기대할 수 있는 사항</b>
              . TETH가 서비스를 제공 및 개발하는 방법을 설명합니다.
            </li>
            <li>
              <b>TETH가 귀하에게 기대하는 사항</b>
              . TETH 서비스 사용과 관련된 일정한 규칙들을 정합니다.
            </li>
            <li>
              <a className="lnk" href="#terms" data-t="t-risk" onClick={(e) => go(e, 't-risk')}>투자 위험 고지</a>
              . 투자 손실 가능성과 백테스트의 한계, AI 판단의 한계를 설명합니다.
            </li>
            <li>
              <a className="lnk" href="#terms" data-t="t-about" onClick={(e) => go(e, 't-about')}>본 약관에 대하여</a>
              . 약관의 수정과 공지, 동의하지 않는 경우의 선택지를 설명합니다.
            </li>
          </ul>
          <p>TETH 서비스에 액세스하거나 서비스를 이용함으로써 귀하는 본 약관에 동의하게 되므로 본 약관을 숙지하는 것이 중요합니다.</p>
          <h2 id="t-risk">투자 위험 고지</h2>
          <p>모든 투자에는 원금 손실 위험이 있습니다. TETH가 제공하는 전략, 백테스트 결과, 시장 해설은 정보 제공을 위한 것이며 투자 조언이 아닙니다. 과거 성과는 미래 수익을 보장하지 않습니다. TETH는 AI이며 실수를 할 수 있습니다. 투자 결정과 그 결과에 대한 최종 책임은 사용자 본인에게 있습니다.</p>
          <h2 id="t-auto">자동매매와 승인</h2>
          <p>검증을 통과한 전략은 사용자가 직접 승인한 경우에만 실행됩니다. 실행 중에도 1회 손실 한도가 적용되며, 사용자는 언제든 일시 정지하거나 종료할 수 있습니다. TETH는 조회, 주문 권한만 사용하며 출금 권한을 요청하지 않습니다.</p>
          <h2 id="t-use">TETH 서비스 사용</h2>
          <p>귀하는 관련 법령과 본 약관을 준수하는 범위에서 서비스를 이용할 수 있습니다. 서비스의 오남용, 시스템에 대한 무단 접근, 타인의 계정 사용은 금지됩니다.</p>
          <h2 id="t-about">본 약관에 대하여</h2>
          <p>TETH는 서비스 개선이나 법령 변경에 따라 본 약관을 수정할 수 있으며, 중대한 변경은 시행 전에 공지합니다. 변경에 동의하지 않는 경우 서비스 이용을 중단하고 계정을 삭제할 수 있습니다.</p>
        </div>
      </div>
    </div>
  );
}
