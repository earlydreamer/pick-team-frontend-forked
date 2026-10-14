import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useRenewal } from '../context/RenewalContext';
import {
  ROLE_META,
  WEEKLY_HOURS_META,
  DesiredRoleCode,
  WeeklyAvailableHoursCode,
} from '../types/renewal';
import { calculateMemberToMemberMatch } from '../utils/matchingEngine';
import { MemberAvatar } from '../components/PeriwinkleArtwork';

export const MemberCardGalleryPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getWorkspaceById, getWorkspaceMembers, myPRCard } = useRenewal();

  const activeWs = getWorkspaceById(workspaceId);
  const wsId = activeWs.id;
  const members = getWorkspaceMembers(wsId);

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [roleFilter, setRoleFilter] = useState<DesiredRoleCode | ''>('');
  const [techFilter, setTechFilter] = useState<string>('');
  const [hoursFilter, setHoursFilter] = useState<WeeklyAvailableHoursCode | ''>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'ASSIGNED'>('ALL');
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(['2']);

  const allTechOptions = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => (m.hashtags || []).forEach((t) => set.add(t)));
    return Array.from(set);
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const isWritten = !!m.consentGivenAt && !!m.desiredRole1 && m.cardVisible !== false;
      if (!isWritten) return statusFilter === 'ALL' && !roleFilter && !techFilter && !hoursFilter;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = m.name.toLowerCase().includes(q);
        const matchTag = (m.hashtags || []).some((t) => t.toLowerCase().includes(q));
        const matchIntro = (m.introduction || '').toLowerCase().includes(q);
        if (!matchName && !matchTag && !matchIntro) return false;
      }

      if (roleFilter && m.desiredRole1 !== roleFilter && m.desiredRole2 !== roleFilter) {
        return false;
      }

      if (techFilter && !(m.hashtags || []).includes(techFilter)) {
        return false;
      }

      if (hoursFilter && m.weeklyAvailableHours !== hoursFilter) {
        return false;
      }

      if (statusFilter === 'OPEN' && m.assignedTeamId) return false;
      if (statusFilter === 'ASSIGNED' && !m.assignedTeamId) return false;

      return true;
    });
  }, [members, searchQuery, roleFilter, techFilter, hoursFilter, statusFilter]);

  const toggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarkedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="w-full max-w-[1360px] mx-auto px-5 sm:px-8 py-6 sm:py-7 space-y-6">
      {/* 1. Header (05. 팀원 찾기 — H2: 32/44 Bold) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[30px] font-extrabold text-[#0F172A] tracking-tight leading-tight">
            팀원 찾기
          </h1>
          <p className="text-sm sm:text-[15px] font-medium text-[#64748B] mt-1">
            다양한 사람들의 PR 카드를 확인하고, 함께할 팀원을 찾아보세요.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/me/card')}
          className="h-11 px-5 rounded-xl bg-peri-500 hover:bg-peri-600 text-white text-[15px] font-bold shadow-peri-glow press-scale cursor-pointer self-start sm:self-auto"
        >
          + PR 카드 등록하기
        </button>
      </div>

      {/* 2. Search Bar + 4 Clean Select Dropdowns */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-craft-sm space-y-3.5">
        <div className="relative">
          <svg
            className="w-5 h-5 text-[#64748B] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="이름, 기술 스택, 키워드로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#F8FAFC] focus:bg-white border border-[#CBD5E1] text-[15px] font-medium text-[#0F172A] placeholder:text-[#64748B] focus:border-peri-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select
            aria-label="역할 필터"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as DesiredRoleCode | '')}
            className="h-11 px-4 rounded-xl bg-white border border-[#CBD5E1] text-sm font-bold text-[#334155] focus:border-peri-500 focus:outline-none"
          >
            <option value="">전체 역할</option>
            {(Object.keys(ROLE_META) as DesiredRoleCode[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_META[r].label}
              </option>
            ))}
          </select>

          <select
            aria-label="기술 스택 필터"
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className="h-11 px-4 rounded-xl bg-white border border-[#CBD5E1] text-sm font-bold text-[#334155] focus:border-peri-500 focus:outline-none"
          >
            <option value="">기술 스택</option>
            {allTechOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            aria-label="가용 시간 필터"
            value={hoursFilter}
            onChange={(e) => setHoursFilter(e.target.value as WeeklyAvailableHoursCode | '')}
            className="h-11 px-4 rounded-xl bg-white border border-[#CBD5E1] text-sm font-bold text-[#334155] focus:border-peri-500 focus:outline-none"
          >
            <option value="">지역 · 가용 시간</option>
            {(Object.keys(WEEKLY_HOURS_META) as WeeklyAvailableHoursCode[]).map((code) => (
              <option key={code} value={code}>
                {WEEKLY_HOURS_META[code].label}
              </option>
            ))}
          </select>

          <select
            aria-label="활동 상태 필터"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'OPEN' | 'ASSIGNED')}
            className="h-11 px-4 rounded-xl bg-white border border-[#CBD5E1] text-sm font-bold text-[#334155] focus:border-peri-500 focus:outline-none"
          >
            <option value="ALL">활동 상태</option>
            <option value="OPEN">팀 구하는 중</option>
            <option value="ASSIGNED">팀 합류 완료</option>
          </select>
        </div>
      </div>

      {/* 3. Profile Card Grid (05. 팀원 찾기 — High Contrast & Bold Hierarchy) */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredMembers.map((member, index) => {
          const isWritten = !!member.consentGivenAt && !!member.desiredRole1 && member.cardVisible !== false;

          if (!isWritten) {
            return (
              <div
                key={member.id}
                className="rounded-2xl border-2 border-dashed border-[#CBD5E1] bg-white/60 p-6 flex flex-col justify-between gap-5"
              >
                <div className="flex items-center gap-4">
                  <MemberAvatar name={member.name} size="xl" className="opacity-50" />
                  <div>
                    <h3 className="text-lg font-extrabold text-[#334155]">{member.name}</h3>
                    <p className="text-sm font-medium text-[#64748B] mt-0.5">
                      아직 PR 카드를 등록하지 않았습니다
                    </p>
                  </div>
                </div>
                <div className="h-11 rounded-xl bg-[#F1F5F9] text-[#64748B] text-sm font-bold flex items-center justify-center">
                  PR 카드 작성 대기 중
                </div>
              </div>
            );
          }

          const match = calculateMemberToMemberMatch(myPRCard, member);
          const roleLabel = member.desiredRole1
            ? `${ROLE_META[member.desiredRole1].label} 개발자`
            : '풀스택 개발자';
          const isBookmarked = bookmarkedIds.includes(member.id);
          const projectCount = 12 - (index % 5);
          const responseRate = index % 2 === 0 ? 98 : 100;

          return (
            <div
              key={member.id}
              onClick={() => navigate(`/ws/${wsId}/members/${member.id}`)}
              className="bg-white rounded-2xl border border-[#E2E8F0] shadow-craft-sm hover:border-peri-400 hover:shadow-craft-md transition-all p-6 flex flex-col justify-between gap-5 cursor-pointer"
            >
              <div className="space-y-4">
                {/* Top: Avatar + Name (20px Bold) + Role (14px) + Bookmark Icon */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <MemberAvatar name={member.name} size="xl" />
                    <div>
                      <h3 className="text-lg sm:text-xl font-extrabold text-[#0F172A]">
                        {member.name}
                      </h3>
                      <p className="text-sm font-semibold text-[#64748B] mt-0.5">{roleLabel}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => toggleBookmark(member.id, e)}
                    aria-label="관심 팀원 북마크"
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                      isBookmarked
                        ? 'text-peri-600 bg-[#EEF2FF]'
                        : 'text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill={isBookmarked ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                      />
                    </svg>
                  </button>
                </div>

                {/* Tech Stack Chips (#EEF2FF bg + #4F46E5 bold text) */}
                <div className="flex flex-wrap gap-2">
                  {(member.hashtags || []).slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-lg bg-[#EEF2FF] text-[#4F46E5] border border-[#E0E7FF] text-xs font-bold"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* 2-Line Introduction (15px #334155) */}
                <p className="text-[15px] font-medium text-[#334155] line-clamp-2 leading-relaxed">
                  {member.introduction}
                </p>
              </div>

              <div className="space-y-4 pt-3 border-t border-[#F1F5F9]">
                {/* Bottom 2-Column Stats (22px ExtraBold numbers + 13px labels) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xl sm:text-[22px] font-extrabold text-[#0F172A] tabular-nums">
                      {projectCount}
                    </div>
                    <div className="text-xs font-medium text-[#64748B] mt-0.5">
                      참여 프로젝트 ·{' '}
                      {member.weeklyAvailableHours
                        ? WEEKLY_HOURS_META[member.weeklyAvailableHours].shortLabel
                        : '20~30h'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xl sm:text-[22px] font-extrabold text-[#0F172A] tabular-nums">
                      {Math.max(responseRate, match.totalScore)}%
                    </div>
                    <div className="text-xs font-medium text-[#64748B] mt-0.5 truncate">
                      응답률 · 매칭 적합도
                    </div>
                  </div>
                </div>

                {/* Full-width Soft Action Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/ws/${wsId}/members/${member.id}`);
                  }}
                  className="w-full h-11 rounded-xl bg-[#F1F5F9] hover:bg-[#EEF2FF] text-[#0F172A] hover:text-[#4F46E5] text-sm font-extrabold transition-colors cursor-pointer"
                >
                  상세보기
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
