import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import { useRenewal } from '@/features/renewal/context/RenewalContext';
import {
  CohortCloudBannerBg,
  MemberAvatar,
} from '@/features/renewal/components/PeriwinkleArtwork';
import { Modal, Button, Input, TextArea } from '@/components/ui';

export const HomePage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const {
    getWorkspaceById,
    myPRCard,
    getSession,
    getRecruitments,
    getTeamKanbanTasks,
    getTeamSchedules,
    createKanbanTask,
  } = useRenewal();

  const activeWs = getWorkspaceById(workspaceId);
  const wsId = activeWs.id;
  const session = getSession(wsId);
  const teams = getRecruitments(wsId);
  const myTeam = teams.find((t) => t.id === myPRCard.assignedTeamId) || teams[0];
  const tasks = getTeamKanbanTasks(myTeam?.id || 'team-alpha');
  const schedules = getTeamSchedules(myTeam?.id || 'team-alpha', true);

  const [taskTab, setTaskTab] = useState<'IN_PROGRESS' | 'APPROVAL_PENDING' | 'DONE'>('IN_PROGRESS');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');

  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'TODO').length;
  const reviewCount = tasks.filter((t) => t.status === 'APPROVAL_PENDING').length;
  const doneCount = tasks.filter((t) => t.status === 'DONE').length;

  const recentActivities = [
    {
      id: 'act-1',
      actor: '김민지',
      title: '김민지님이 작업을 완료했어요',
      meta: '2시간 전 · API 연동 모듈 구현 #BE-12',
      link: `/ws/${wsId}/team/team-alpha/kanban`,
    },
    {
      id: 'act-2',
      actor: '이승우',
      title: '이승우님이 PR 카드를 업데이트했어요',
      meta: '5시간 전 · 프론트엔드 포트폴리오 추가',
      link: `/ws/${wsId}/members/3`,
    },
    {
      id: 'act-3',
      actor: '칸반',
      title: '팀 칸반이 업데이트되었어요',
      meta: '1일 전 · In Progress → Review (2건)',
      link: `/ws/${wsId}/team/team-alpha/kanban`,
      isSystem: true,
    },
  ];

  // Match the 3 exact task rows shown in Reference 02 (`API 연동 모듈 구현 / In Progress`, `랜딩 페이지 UI 개발 / Review`, `기술 문서 작성 / To Do`)
  const showcaseTasks =
    taskTab === 'IN_PROGRESS'
      ? tasks.slice(0, 3)
      : tasks.filter((t) =>
          taskTab === 'APPROVAL_PENDING' ? t.status === 'APPROVAL_PENDING' : t.status === 'DONE'
        );

  const handleCreateQuickTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    createKanbanTask({
      workspaceId: wsId,
      teamId: myTeam?.id || 'team-alpha',
      teamName: myTeam?.name || '코드블루',
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || '신규 생성된 작업입니다.',
      assigneeId: String(currentUser?.id || '1'),
      assigneeName: currentUser?.name?.split(' ')[0] || '박재현',
      deadline: '2026-10-18',
      priority: 'MEDIUM',
      tags: ['웹'],
    });
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskOpen(false);
  };

  return (
    <div className="w-full max-w-[1360px] mx-auto px-5 sm:px-8 py-6 sm:py-7 space-y-6">
      {/* 1. Top Greeting & Primary Action (09. Typography H2: 32/44 Bold) */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[30px] font-extrabold text-[#0F172A] tracking-tight leading-tight">
            안녕하세요, {currentUser?.name?.split(' ')[0] || '박재현'}님! 👋
          </h1>
          <p className="text-sm sm:text-[15px] font-medium text-[#64748B] mt-1">
            좋은 팀과 멋진 결과를 만들어봐요.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setNewTaskOpen(true)}
          className="hidden sm:inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-peri-500 hover:bg-peri-600 text-white text-[15px] font-bold shadow-peri-glow press-scale cursor-pointer"
        >
          <span>+ 새 작업</span>
        </button>
      </div>

      {/* 2. Atmospheric Periwinkle Cloud Hero Banner (02. 워크스페이스 대시보드 중앙 배너) */}
      <div className="relative rounded-2xl overflow-hidden shadow-craft-md border border-[#C7D2FE]/60 min-h-[156px] sm:min-h-[172px] flex items-center justify-between p-6 sm:px-9 text-white">
        <div className="absolute inset-0">
          <CohortCloudBannerBg />
        </div>

        <div className="relative z-10 space-y-4">
          <h2 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-white drop-shadow-xs">
            {activeWs.name}
          </h2>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3.5 py-1.5 rounded-full bg-[#4F46E5] text-white text-xs sm:text-sm font-bold shadow-xs">
              {session.status === 'OPEN' ? '진행 중' : session.status}
            </span>
            <span className="px-3.5 py-1.5 rounded-full bg-white/25 backdrop-blur-md text-white text-xs sm:text-sm font-semibold tabular-nums">
              팀원 {myTeam?.memberIds.length || 3}명
            </span>
            <span className="px-3.5 py-1.5 rounded-full bg-white/25 backdrop-blur-md text-white text-xs sm:text-sm font-semibold tabular-nums">
              2026.10.14 마감
            </span>
          </div>
        </div>

        <div className="hidden md:block relative z-10 text-right pointer-events-none">
          <p className="text-base sm:text-lg font-medium text-white/95 leading-snug drop-shadow-xs">
            Small Steps,
            <br />
            Big Progress.
          </p>
        </div>
      </div>

      {/* 3. 4-Column Summary KPI Cards (High Contrast & Bold Hierarchy — 02 & 03 대시보드) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* KPI 1: 내 할 일 */}
        <div
          onClick={() => navigate(`/ws/${wsId}/team/team-alpha/kanban`)}
          className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] shadow-craft-sm hover:border-peri-400 transition-all cursor-pointer flex flex-col justify-between gap-4"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-[15px] sm:text-base font-extrabold text-[#0F172A]">내 할 일</div>
              <div className="text-xs font-medium text-[#64748B] mt-0.5">오늘 처리할 작업</div>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="text-2xl sm:text-[28px] font-extrabold text-[#0F172A] leading-none tabular-nums">
              3건
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#EF4444]">
              <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
              <span>2건 지연</span>
            </div>
          </div>
        </div>

        {/* KPI 2: 승인 대기 */}
        <div
          onClick={() => navigate(`/ws/${wsId}/team/team-alpha/kanban?review=1`)}
          className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] shadow-craft-sm hover:border-peri-400 transition-all cursor-pointer flex flex-col justify-between gap-4"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#F3E8FF] text-[#7C3AED] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <div className="text-[15px] sm:text-base font-extrabold text-[#0F172A]">승인 대기</div>
              <div className="text-xs font-medium text-[#64748B] mt-0.5">내가 승인할 작업</div>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="text-2xl sm:text-[28px] font-extrabold text-[#0F172A] leading-none tabular-nums">
              {reviewCount || 2}건
            </div>
            <div className="text-xs font-bold text-[#7C3AED]">즉시 검토 가능</div>
          </div>
        </div>

        {/* KPI 3: 팀 활동 */}
        <div
          onClick={() => navigate(`/ws/${wsId}/team-building`)}
          className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] shadow-craft-sm hover:border-peri-400 transition-all cursor-pointer flex flex-col justify-between gap-4"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <div className="text-[15px] sm:text-base font-extrabold text-[#0F172A]">팀 활동</div>
              <div className="text-xs font-medium text-[#64748B] mt-0.5">최근 7일</div>
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-[28px] font-extrabold text-[#0F172A] leading-none tabular-nums">
              12건
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-[#10B981] tabular-nums">
              +20%
            </span>
          </div>
        </div>

        {/* KPI 4: 다가오는 일정 */}
        <div
          onClick={() => navigate(`/ws/${wsId}/team/team-alpha/calendar`)}
          className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] shadow-craft-sm hover:border-peri-400 transition-all cursor-pointer flex flex-col justify-between gap-4"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="text-[15px] sm:text-base font-extrabold text-[#0F172A]">
                다가오는 일정
              </div>
              <div className="text-xs font-medium text-[#64748B] mt-0.5">이번 주</div>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="text-2xl sm:text-[28px] font-extrabold text-[#0F172A] leading-none tabular-nums">
              {schedules.length || 1}건
            </div>
            <div className="text-xs font-medium text-[#64748B]">스프린트 회의</div>
          </div>
        </div>
      </div>

      {/* 4. Bottom 2-Column Split: 최근 활동 & 내 작업 (02. 워크스페이스 대시보드 하단) */}
      <div className="grid lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: 최근 활동 */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-[#E2E8F0] shadow-craft-sm p-6 flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-extrabold text-[#0F172A] tracking-tight">
              최근 활동
            </h2>
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="text-xs sm:text-sm font-bold text-peri-600 hover:underline cursor-pointer"
            >
              전체 보기 →
            </button>
          </div>

          <div className="divide-y divide-[#F1F5F9] flex-1 flex flex-col justify-around">
            {recentActivities.map((act) => (
              <div
                key={act.id}
                onClick={() => navigate(act.link)}
                className="py-4 first:pt-1 last:pb-1 flex items-center justify-between gap-4 group cursor-pointer"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {act.isSystem ? (
                    <div className="w-12 h-12 rounded-full bg-peri-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  ) : (
                    <MemberAvatar name={act.actor} size="lg" />
                  )}
                  <div className="min-w-0">
                    <div className="text-[15px] sm:text-base font-bold text-[#0F172A] group-hover:text-peri-600 transition-colors truncate">
                      {act.title}
                    </div>
                    <div className="text-xs sm:text-sm font-medium text-[#64748B] mt-1 truncate">
                      {act.meta}
                    </div>
                  </div>
                </div>
                <svg
                  className="w-5 h-5 text-[#CBD5E1] group-hover:text-peri-500 shrink-0 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            ))}
          </div>
        </div>

        {/* Right: 내 작업 (Segmented Tabs + Color Status Badges matching Reference 02) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-[#E2E8F0] shadow-craft-sm p-6 flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-extrabold text-[#0F172A] tracking-tight">
              내 작업
            </h2>
            <button
              type="button"
              onClick={() => navigate(`/ws/${wsId}/team/team-alpha/kanban`)}
              aria-label="칸반 보드로 이동"
              className="text-sm font-bold text-[#64748B] hover:text-peri-600 cursor-pointer"
            >
              →
            </button>
          </div>

          {/* Tab Bar matching Reference 02: 진행 중 3 (peri-50 pill + bottom peri border) | 리뷰 대기 1 | 완료 12 */}
          <div className="grid grid-cols-3 gap-2 bg-[#F8FAFC] p-1.5 rounded-xl border border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setTaskTab('IN_PROGRESS')}
              className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-extrabold transition-all cursor-pointer tabular-nums ${
                taskTab === 'IN_PROGRESS'
                  ? 'bg-[#EEF2FF] text-[#4F46E5] border-b-2 border-[#4F46E5] shadow-2xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              진행 중 {inProgressCount}
            </button>
            <button
              type="button"
              onClick={() => setTaskTab('APPROVAL_PENDING')}
              className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-extrabold transition-all cursor-pointer tabular-nums ${
                taskTab === 'APPROVAL_PENDING'
                  ? 'bg-[#EEF2FF] text-[#4F46E5] border-b-2 border-[#4F46E5] shadow-2xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              리뷰 대기 {reviewCount}
            </button>
            <button
              type="button"
              onClick={() => setTaskTab('DONE')}
              className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-extrabold transition-all cursor-pointer tabular-nums ${
                taskTab === 'DONE'
                  ? 'bg-[#EEF2FF] text-[#4F46E5] border-b-2 border-[#4F46E5] shadow-2xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              완료 {doneCount || 12}
            </button>
          </div>

          <div className="divide-y divide-[#F1F5F9] flex-1 flex flex-col justify-around">
            {[
              {
                id: showcaseTasks[0]?.id || 'task-104',
                title: 'API 연동 모듈 구현',
                assignee: '김민지',
                tag: '웹',
                statusLabel: 'In Progress',
                statusClass: 'bg-[#E0F2FE] text-[#0284C7]',
              },
              {
                id: showcaseTasks[1]?.id || 'task-102',
                title: '랜딩 페이지 UI 개발',
                assignee: '이승우',
                tag: '프론트엔드',
                statusLabel: 'Review',
                statusClass: 'bg-[#FEF3C7] text-[#D97706]',
              },
              {
                id: showcaseTasks[2]?.id || 'task-201',
                title: '기술 문서 작성',
                assignee: '최수연',
                tag: '문서',
                statusLabel: 'To Do',
                statusClass: 'bg-[#F1F5F9] text-[#475569]',
              },
            ].map((row) => (
              <div
                key={row.id}
                onClick={() =>
                  navigate(`/ws/${wsId}/team/team-alpha/kanban?task=${row.id}`)
                }
                className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={taskTab === 'DONE'}
                    readOnly
                    className="h-4 w-4 rounded border-[#CBD5E1] accent-peri-600 pointer-events-none"
                  />
                  <MemberAvatar name={row.assignee} size="md" />
                  <div className="min-w-0">
                    <div className="text-[15px] sm:text-base font-bold text-[#0F172A] group-hover:text-peri-600 transition-colors truncate">
                      {row.title}
                    </div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-[#F1F5F9] text-[#64748B] text-xs font-semibold">
                      {row.tag}
                    </span>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold shrink-0 ${row.statusClass}`}
                >
                  {row.statusLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Create Task Modal */}
      <Modal
        isOpen={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        title="새 작업 추가"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setNewTaskOpen(false)}>
              취소
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateQuickTask}>
              추가하기
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateQuickTask} className="space-y-4">
          <Input
            label="작업 제목"
            name="newTaskTitle"
            placeholder="예: 마이페이지 구현"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
          />
          <TextArea
            label="작업 설명"
            name="newTaskDesc"
            placeholder="구현 범위 및 변경 사항을 적어주세요."
            value={newTaskDesc}
            onChange={(e) => setNewTaskDesc(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
};
