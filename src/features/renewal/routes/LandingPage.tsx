import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LandingHeroArtwork } from '../components/PeriwinkleArtwork';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const steps = [
    {
      title: '팀원 찾기',
      desc: '다양한 PR 카드로\n적합한 팀원을 만나세요',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      ),
    },
    {
      title: '팀 결성',
      desc: '관심 있는 사람들과\n팀을 만들어보세요',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    {
      title: '함께 작업하기',
      desc: '칸반으로 진행 상황을\n투명하게 관리하세요',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
    },
    {
      title: '완성하고 성장하기',
      desc: '좋은 경험이 다음 기회로\n이어집니다',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-white text-[#0F172A] flex flex-col">
      {/* Top Hero Wrapper with Atmospheric Periwinkle Gradient Wash (01. 메인 페이지) */}
      <div className="bg-gradient-to-b from-[#EEF0FA] via-[#F5F6FC] to-white border-b border-[#E2E8F0]/70">
        {/* Top Header */}
        <header className="h-20 px-6 sm:px-12 max-w-[1280px] w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-peri-500 text-white font-extrabold text-sm flex items-center justify-center shadow-peri-glow">
                PT
              </div>
              <span className="text-xl font-extrabold tracking-tight text-[#0F172A]">PickTeam</span>
            </Link>

            <nav className="hidden md:flex items-center gap-8 text-[15px] font-semibold text-[#334155]">
              <Link to="/ws/ws-kosta-295" className="hover:text-peri-600 transition-colors">
                프로젝트
              </Link>
              <Link to="/ws/ws-kosta-295/team-building" className="hover:text-peri-600 transition-colors">
                팀 찾기
              </Link>
              <Link to="/ws/ws-kosta-295/members" className="hover:text-peri-600 transition-colors">
                PR 카드
              </Link>
              <Link to="/ws/ws-kosta-295/team/team-alpha/kanban" className="hover:text-peri-600 transition-colors">
                칸반 · 승인
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="px-3.5 py-2 text-[15px] font-bold text-[#334155] hover:text-[#0F172A] transition-colors"
            >
              로그인
            </Link>
            <Link
              to="/signup"
              className="px-5 py-2.5 rounded-xl bg-peri-500 hover:bg-peri-600 text-white text-[15px] font-bold transition-colors shadow-peri-glow"
            >
              회원가입
            </Link>
          </div>
        </header>

        {/* Hero Content (09. Typography H1: 48/60 Bold) */}
        <section className="max-w-[1280px] w-full mx-auto px-6 sm:px-12 pt-6 pb-14 grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-8">
            <div className="space-y-4">
              <h1 className="text-[38px] sm:text-[48px] font-extrabold text-[#0F172A] leading-[1.24] tracking-tight">
                좋은 팀이
                <br />
                좋은 결과를 만든다
              </h1>
              <p className="text-base sm:text-[17px] font-medium text-[#475569] leading-[1.6]">
                개발, 디자인, 기획...
                <br />
                지금, 함께할 팀원을 찾고 프로젝트를 시작하세요.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={() => navigate('/ws/ws-kosta-295')}
                className="h-12 px-7 rounded-xl bg-peri-500 hover:bg-peri-600 text-white text-base font-bold shadow-peri-glow press-scale cursor-pointer"
              >
                지금 시작하기
              </button>
              <button
                type="button"
                onClick={() => navigate('/ws/ws-kosta-295/members')}
                className="h-12 px-7 rounded-xl bg-white hover:bg-[#F8FAFC] text-[#0F172A] border border-[#CBD5E1] text-base font-bold press-scale cursor-pointer shadow-2xs"
              >
                프로젝트 둘러보기
              </button>
            </div>

            {/* 3 Bold Hero Metrics with Vertical Dividers */}
            <div className="flex items-center gap-6 sm:gap-8 pt-4">
              <div>
                <div className="text-[28px] sm:text-[32px] font-extrabold text-[#0F172A] leading-none tabular-nums">
                  2.4K
                </div>
                <div className="text-sm font-medium text-[#64748B] mt-1.5">완료된 프로젝트</div>
              </div>
              <div className="h-10 w-px bg-[#CBD5E1]" />
              <div>
                <div className="text-[28px] sm:text-[32px] font-extrabold text-[#0F172A] leading-none tabular-nums">
                  8.1K
                </div>
                <div className="text-sm font-medium text-[#64748B] mt-1.5">등록된 PR 카드</div>
              </div>
              <div className="h-10 w-px bg-[#CBD5E1]" />
              <div>
                <div className="text-[28px] sm:text-[32px] font-extrabold text-[#0F172A] leading-none tabular-nums">
                  95%
                </div>
                <div className="text-sm font-medium text-[#64748B] mt-1.5">팀 매칭 만족도</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <LandingHeroArtwork />
          </div>
        </section>
      </div>

      {/* 4-Step Process Section (H2: 32/44 Bold) */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 sm:px-12 py-16 space-y-16">
        <section className="space-y-12">
          <div className="text-center">
            <h2 className="text-[26px] sm:text-[32px] font-extrabold text-[#0F172A] leading-[1.35] tracking-tight">
              아이디어는 많지만,
              <br />
              혼자 하긴 어렵다면?
            </h2>
          </div>

          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <div className="hidden md:block absolute top-7 left-[12%] right-[12%] h-[2px] bg-[#E0E7FF] -z-0" />

            {steps.map((step) => (
              <div
                key={step.title}
                className="relative z-10 flex flex-col items-center text-center space-y-3.5"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] border border-[#C7D2FE] text-peri-600 flex items-center justify-center shadow-xs">
                  {step.icon}
                </div>
                <h3 className="text-lg font-extrabold text-[#0F172A]">{step.title}</h3>
                <p className="text-sm font-medium text-[#64748B] whitespace-pre-line leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom Twilight CTA Banner */}
        <section className="rounded-3xl bg-gradient-to-r from-[#43458A] via-[#6667AB] to-[#818CF8] px-8 sm:px-12 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-craft-md">
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            지금, 새로운 팀을 만들어보세요.
          </h2>
          <button
            type="button"
            onClick={() => navigate('/ws/ws-kosta-295')}
            className="h-12 px-7 rounded-xl bg-white hover:bg-[#EEF2FF] text-[#4338CA] text-base font-extrabold transition-colors press-scale cursor-pointer shrink-0 shadow-sm"
          >
            무료로 시작하기 →
          </button>
        </section>
      </main>
    </div>
  );
};
