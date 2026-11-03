import React, { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandLockup } from '@/layout/BrandMark';

interface AuthLayoutProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** 폼 아래 보조 링크(회원가입·로그인 전환 등) */
  footer?: ReactNode;
  /** 초대 링크로 들어온 경우처럼 폼 위에 보여 줄 맥락 */
  notice?: ReactNode;
}

/**
 * 인증 화면 공통 레이아웃: 데스크톱은 왼쪽 브랜드 영역 + 오른쪽 폼, 모바일은 폼 단일 열입니다.
 * 브랜드 영역의 그림(public/design-assets/team-hero.webp)은 장식이므로 대체 텍스트를 비웁니다.
 */
export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, description, children, footer, notice }) => (
  <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(480px,560px)]">
    <aside className="relative hidden overflow-hidden bg-peri-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <Link to="/login" className="relative z-10 inline-flex w-fit rounded-lg text-white">
        <span className="inline-flex items-center gap-2 text-lg font-bold">
          <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#fff" />
            <path
              d="M11 24V8h6.2c3.6 0 5.8 2 5.8 5.1 0 3.2-2.2 5.2-5.8 5.2H14.6V24H11Zm3.6-8.6h2.3c1.6 0 2.5-.8 2.5-2.3 0-1.4-.9-2.2-2.5-2.2h-2.3v4.5Z"
              fill="#3F4199"
            />
          </svg>
          Pick Team
        </span>
      </Link>
      <img
        src="/design-assets/team-hero.webp"
        alt=""
        width={1200}
        height={800}
        className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-[min(92%,760px)] -translate-y-1/2 [mask-image:radial-gradient(ellipse_at_center,#000_48%,transparent_72%)]"
      />
      <div className="relative z-10 max-w-lg">
        <p className="text-[1.75rem] font-bold leading-[1.35] tracking-[-0.02em] text-white">
          팀원을 찾고, 팀을 꾸리고,
          <br />한 곳에서 함께 일해요
        </p>
        <p className="mt-3 text-base leading-6 text-peri-100">워크스페이스·팀 빌딩·칸반·채팅·화상회의를 Pick Team 하나로 이어 써요.</p>
      </div>
    </aside>

    <main className="flex min-h-screen flex-col bg-[url('/design-assets/peri-background.webp')] bg-cover bg-center px-4 py-8 sm:px-8 lg:bg-none lg:bg-surface">
      <div className="lg:hidden">
        <BrandLockup />
      </div>
      <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
        <div className="rounded-modal border border-outline-soft bg-surface p-6 sm:p-8 lg:border-0 lg:p-0">
          <h1 className="text-2xl font-bold leading-8 tracking-[-0.02em] text-ink">{title}</h1>
          {description && <p className="mt-2 text-[0.9375rem] leading-6 text-muted">{description}</p>}
          {notice && <div className="mt-5">{notice}</div>}
          <div className="mt-7">{children}</div>
        </div>
        {footer && <div className="mt-6 space-y-2 text-center text-sm text-muted">{footer}</div>}
      </div>
    </main>
  </div>
);

/** 폼 상단의 결과 알림. 오류는 role=alert, 성공·안내는 role=status로 읽힙니다. */
export const FormMessage: React.FC<{ tone: 'error' | 'success' | 'info'; children: ReactNode; id?: string }> = ({ tone, children, id }) => {
  const styles = {
    error: 'border-red-200 bg-red-50 text-danger',
    success: 'border-green-200 bg-green-50 text-success',
    info: 'border-peri-200 bg-peri-50 text-on-primary-container',
  }[tone];
  return (
    <div id={id} role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-3.5 py-3 text-sm leading-5 ${styles}`}>
      {children}
    </div>
  );
};
