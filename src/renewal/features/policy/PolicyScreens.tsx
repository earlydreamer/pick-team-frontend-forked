import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { POLICY_VERSION } from '@/renewal/domain/policy';
import { data } from '@/renewal/data';
import { Badge } from '@/renewal/ui';
import { BrandLockup } from '@/renewal/shell/BrandMark';

/**
 * 정책 문서 틀. 로그인하지 않아도 열리고(가입 화면에서 연결), 앱 셸 없이 읽기 좋은 폭으로 보여 준다.
 * 17-D3에 따라 법률 검토 전 표준 템플릿 기반 초안이며, 그 사실을 문서 맨 위에 밝힌다.
 */
const PolicyLayout: React.FC<{ title: string; other: { to: string; label: string }; children: React.ReactNode }> = ({ title, other, children }) => {
  useEffect(() => {
    document.title = `${title} · Pick Team`;
  }, [title]);
  return (
    <div className="min-h-screen bg-surface-low">
      <header className="border-b border-outline-soft bg-surface">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4 sm:px-6">
          <Link to="/" aria-label="Pick Team 첫 화면">
            <BrandLockup className="text-base" />
          </Link>
          {data.kind === 'mock' && <Badge tone="warning">목업 데이터</Badge>}
          <Link to={other.to} className="ml-auto inline-flex min-h-touch items-center text-sm font-semibold text-primary underline-offset-2 hover:underline">
            {other.label}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold leading-8">{title}</h1>
        <p className="mt-1 text-sm text-muted">시행일 {POLICY_VERSION}</p>
        <div role="note" className="mt-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-warning ring-1 ring-inset ring-amber-200">
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>법률 검토 전 표준 양식으로 쓴 초안이에요. 정식 서비스 전에 검토를 거쳐 바뀔 수 있어요.</p>
        </div>
        <div className="mt-6 space-y-6 rounded-card border border-outline-soft bg-surface p-5 text-[0.9375rem] leading-7 sm:p-8">{children}</div>
      </main>
    </div>
  );
};

const Article: React.FC<{ id: string; title: string; children: React.ReactNode }> = ({ id, title, children }) => (
  <section aria-labelledby={id}>
    <h2 id={id} className="mb-2 text-lg font-bold">
      {title}
    </h2>
    <div className="space-y-2">{children}</div>
  </section>
);

/** 좁은 화면에서는 표가 가로로 스크롤된다. 키보드로도 스크롤할 수 있게 영역에 포커스와 이름을 준다. */
const Table: React.FC<{ head: string[]; rows: string[][]; caption: string }> = ({ head, rows, caption }) => (
  <div className="overflow-x-auto rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" tabIndex={0} role="region" aria-label={`${caption} 표`}>
    <table className="w-full min-w-[32rem] border-collapse text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {head.map((cell) => (
            <th key={cell} scope="col" className="border-b border-outline-soft bg-surface-low px-3 py-2 text-left font-semibold">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            {row.map((cell, index) =>
              index === 0 ? (
                <th key={cell} scope="row" className="border-b border-outline-soft px-3 py-2 text-left font-medium">
                  {cell}
                </th>
              ) : (
                <td key={`${row[0]}-${index}`} className="border-b border-outline-soft px-3 py-2">
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** 17 §6.1 수집 항목 인벤토리. 내 데이터 열람(마이페이지)과 같은 항목이다. */
const COLLECTED = [
  ['이메일', '필수', '가입', '나만(로그인용)'],
  ['비밀번호(암호화해 저장)', '필수(이메일 가입)', '가입', '나만'],
  ['이름', '필수', '가입', '소속 워크스페이스 멤버'],
  ['프로필 사진', '선택', '가입·카드 편집', '소속 워크스페이스 멤버'],
  ['Google·카카오 계정 식별자', '필수(소셜 가입)', '소셜 로그인', '나만'],
  ['희망 역할, 가용 시간, 해시태그, 자기소개, 포트폴리오', '선택', 'PR 카드 작성', '카드를 공개하면 워크스페이스 멤버'],
  ['협업 성향(선호·기피 방식)', '선택(별도 동의)', 'PR 카드 작성', '카드를 공개하면 워크스페이스 멤버'],
  ['MBTI', '선택', 'PR 카드 작성', '카드를 공개하면 워크스페이스 멤버'],
];

/** 17 §6.4 계정 삭제 시 처리 */
const RETENTION = [
  ['이메일, 비밀번호, 소셜 계정 식별자', '삭제 요청 즉시 삭제'],
  ['PR 카드(협업 성향, MBTI 포함)', '삭제 요청 즉시 비공개, 30일 뒤 완전 삭제'],
  ['프로필 사진', '삭제 요청 즉시 삭제'],
  ['워크스페이스·팀 멤버십, 칸반 담당 기록', '30일 뒤 계정과의 연결을 끊고 익명으로 보존'],
  ['채팅 메시지, 게시글, 댓글', '30일 뒤 작성자를 "탈퇴한 사용자"로 바꾸고 내용 보존'],
  ['알림 기록', '30일 뒤 삭제'],
];

/** 개인정보 처리방침(17 §6.7 목차). */
export const PrivacyScreen: React.FC = () => (
  <PolicyLayout title="개인정보 처리방침" other={{ to: '/terms', label: '이용약관' }}>
    <p>Pick Team(이하 "서비스")은 부트캠프·스터디의 팀 빌딩과 협업을 돕기 위해 필요한 만큼만 개인정보를 모으고, 이용자가 직접 확인하고 지울 수 있게 해요.</p>
    <Article id="privacy-1" title="1. 수집하는 개인정보 항목">
      <Table caption="수집 항목" head={['항목', '필수 여부', '수집 시점', '공개 범위']} rows={COLLECTED} />
      <p>모든 성향 정보는 소속 워크스페이스 안에서만 보이고, 서비스 전체에 공개되지 않아요. 추천은 카드를 공개한 사람만 대상으로 해요.</p>
    </Article>
    <Article id="privacy-2" title="2. 수집 및 이용 목적">
      <p>회원 식별과 로그인, 워크스페이스 초대와 합류, PR 카드를 통한 팀원 탐색과 추천, 팀 협업 기능(칸반, 일정, 게시판, 채팅, 화상회의), 서비스 알림 제공에 써요. 광고나 마케팅에는 쓰지 않아요.</p>
    </Article>
    <Article id="privacy-3" title="3. 보유 및 이용 기간">
      <p>회원 탈퇴(계정 삭제)를 요청할 때까지 보유해요. 삭제를 요청하면 아래와 같이 처리해요.</p>
      <Table caption="계정 삭제 시 처리" head={['데이터', '처리']} rows={RETENTION} />
    </Article>
    <Article id="privacy-4" title="4. 제3자 제공">
      <p>개인정보를 제3자에게 제공하지 않아요. 법령에 따라 수사기관이 요청하는 경우는 예외예요.</p>
    </Article>
    <Article id="privacy-5" title="5. 처리 위탁과 외부 서비스">
      <ul className="list-disc space-y-1 pl-5">
        <li>Google(Gmail): 가입·비밀번호 재설정 인증 코드 메일 발송</li>
        <li>Google, 카카오: 소셜 로그인을 고른 경우 계정 확인</li>
        <li>데이터 백업 보관을 위한 클라우드 스토리지(백업 파일만 보관)</li>
      </ul>
      <p>서비스 서버와 화상회의 서버는 운영자가 직접 운영해요.</p>
    </Article>
    <Article id="privacy-6" title="6. 이용자의 권리와 행사 방법">
      <ul className="list-disc space-y-1 pl-5">
        <li>
          열람·내려받기: <Link to="/me" className="font-semibold text-primary underline-offset-2 hover:underline">마이페이지</Link>의 "내 데이터"에서 저장된 정보와 공개 범위를 보고 JSON 파일로 받을 수 있어요.
        </li>
        <li>정정: 이름은 마이페이지에서, 카드 내용은 PR 카드 편집에서 바로 고쳐요.</li>
        <li>동의 철회·삭제: PR 카드만 삭제하거나, 계정 설정에서 계정을 삭제할 수 있어요.</li>
        <li>알림 수신: 계정 설정에서 알림 계열별로 끄고 켤 수 있어요.</li>
      </ul>
    </Article>
    <Article id="privacy-7" title="7. 안전성 확보 조치">
      <p>비밀번호는 복원할 수 없는 방식으로 암호화해 저장해요. 통신은 암호화(HTTPS)하고, 워크스페이스와 팀 단위로 접근 권한을 확인해요. 운영 비밀 정보는 저장소에 두지 않아요.</p>
    </Article>
    <Article id="privacy-8" title="8. 자동 수집 장치">
      <p>로그인 상태를 유지하려고 브라우저 저장소에 로그인 토큰을 저장해요(1시간 유효). 화면 설정 같은 편의 정보도 브라우저에만 저장해요. 광고 추적 쿠키는 쓰지 않아요.</p>
    </Article>
    <Article id="privacy-9" title="9. 개인정보 보호 책임자">
      <p>서비스 운영자가 개인정보 보호 책임자를 맡아요. 연락 창구는 정식 서비스 공개 때 이 문서에 적어요.</p>
    </Article>
    <Article id="privacy-10" title="10. 처리방침의 변경">
      <p>내용을 바꾸면 시행 7일 전부터 서비스 안에서 알리고, 바뀐 판에 다시 동의를 받을 수 있어요.</p>
    </Article>
  </PolicyLayout>
);

/** 이용약관(17 §6.8 필요 조항). */
export const TermsScreen: React.FC = () => (
  <PolicyLayout title="이용약관" other={{ to: '/privacy', label: '개인정보 처리방침' }}>
    <Article id="terms-1" title="제1조 서비스 제공 범위">
      <p>서비스는 워크스페이스, PR 카드, 팀 빌딩, 팀 협업 도구(칸반, 일정, 게시판, 공지, 채팅, 화상회의)와 알림을 제공해요. 운영자 한 명이 운영하는 서비스라 상시 가용성을 보장하지 않으며, 점검과 장애가 있을 수 있어요.</p>
    </Article>
    <Article id="terms-2" title="제2조 콘텐츠 권리">
      <p>이용자가 쓴 PR 카드, 게시글, 메시지의 권리는 작성자에게 있어요. 서비스는 그 콘텐츠를 워크스페이스와 팀 안에서 보여 주고 백업하는 데 필요한 범위에서만 이용해요.</p>
    </Article>
    <Article id="terms-3" title="제3조 이용 제한">
      <p>다른 사람을 괴롭히거나 불법 정보를 올리는 등 이 약관을 어기면 워크스페이스 관리자나 운영자가 경고, 내보내기, 차단, 계정 삭제를 할 수 있어요. 워크스페이스 차단은 그 워크스페이스에만 적용돼요.</p>
    </Article>
    <Article id="terms-4" title="제4조 서비스 중단과 변경">
      <p>점검이나 기능 변경은 미리 서비스 안에서 알려요. 서비스를 끝낼 때는 30일 전에 알리고 데이터를 내려받을 기간을 드려요.</p>
    </Article>
    <Article id="terms-5" title="제5조 책임의 한계">
      <p>운영자는 고의나 중대한 과실이 없는 한 서비스 장애와 데이터 손실에 책임을 지지 않아요. 중요한 자료는 따로 보관해 주세요.</p>
    </Article>
    <Article id="terms-6" title="제6조 가입 조건">
      <p>만 14세 이상만 가입할 수 있어요.</p>
    </Article>
  </PolicyLayout>
);
