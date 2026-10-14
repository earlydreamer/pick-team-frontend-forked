import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useRenewal } from '../context/RenewalContext';
import { MemberAvatar } from '../components/PeriwinkleArtwork';

export const InstructorDashboardPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const {
    getWorkspaceById,
    getWorkspaceMembers,
    sendUnwrittenCardReminders,
    getRecruitments,
    getTeamKanbanTasks,
    getWorkspaceApprovalQueue,
    approveOrRejectTask,
  } = useRenewal();

  const activeWs = getWorkspaceById(workspaceId);
  const wsId = activeWs.id;
  const members = getWorkspaceMembers(wsId);
  const teams = getRecruitments(wsId);
  const approvalQueue = getWorkspaceApprovalQueue(wsId);

  const writtenCount = members.filter((m) => !!m.consentGivenAt && !!m.desiredRole1).length;
  const unwrittenCount = Math.max(0, members.length - writtenCount);
  const assignedCount = members.filter((m) => !!m.assignedTeamId).length;
  const unassignedCount = members.length - assignedCount;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink-primary tracking-tight">
            강사 운영 대시보드
          </h1>
          <p className="text-xs sm:text-sm text-ink-tertiary mt-1">
            {activeWs.name} 기수의 팀 편성 현황과 작업 승인 대기 목록을 관리합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendUnwrittenCardReminders(wsId)}
          >
            미작성자 리마인드 ({unwrittenCount}명)
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/ws/${wsId}/team-building/manage`)}
          >
            미배정 인원 배치하기
          </Button>
        </div>
      </div>

      {/* 4 Clean KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-craft-sm space-y-2">
          <div className="text-xs text-ink-tertiary font-medium">기수 합류 인원</div>
          <div className="text-2xl font-bold text-ink-primary tabular-nums">
            {activeWs.inviteUsedCount || 28} / {activeWs.capacity || 32}명
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-craft-sm space-y-2">
          <div className="text-xs text-ink-tertiary font-medium">PR 카드 등록</div>
          <div className="text-2xl font-bold text-ink-primary tabular-nums">
            {writtenCount} / {members.length}명
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-craft-sm space-y-2">
          <div className="text-xs text-ink-tertiary font-medium">팀 배정 현황</div>
          <div className="text-2xl font-bold text-ink-primary tabular-nums">
            배정 {assignedCount} · 미배정 {unassignedCount}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-craft-sm space-y-2">
          <div className="text-xs text-ink-tertiary font-medium">승인 대기 작업</div>
          <div className="text-2xl font-bold text-peri-600 tabular-nums">
            {approvalQueue.length}건
          </div>
        </div>
      </div>

      {/* 2-Column Split: Team Progress + Approval Queue */}
      <div className="grid lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-6 bg-white rounded-2xl border border-neutral-200/80 shadow-craft-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-ink-primary">팀별 진행도</h2>
          <div className="space-y-4">
            {teams.map((team) => {
              const tasks = getTeamKanbanTasks(team.id);
              const done = tasks.filter((t) => t.status === 'DONE').length;
              const pct = Math.round((done / Math.max(1, tasks.length)) * 100);
              return (
                <div
                  key={team.id}
                  onClick={() => navigate(`/ws/${wsId}/team/${team.id}/kanban`)}
                  className="space-y-1.5 cursor-pointer group"
                >
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-ink-primary group-hover:text-peri-600">{team.name}</span>
                    <span className="text-ink-tertiary tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-subtle overflow-hidden">
                    <div
                      className="h-full bg-peri-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-6 bg-white rounded-2xl border border-neutral-200/80 shadow-craft-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-ink-primary">
            작업 승인 대기 ({approvalQueue.length})
          </h2>
          {approvalQueue.length === 0 ? (
            <p className="text-xs text-ink-tertiary py-6 text-center">
              대기 중인 작업 승인 요청이 없습니다.
            </p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {approvalQueue.map((task) => (
                <div
                  key={task.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MemberAvatar name={task.assigneeName} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-ink-primary truncate">
                        {task.title}
                      </div>
                      <div className="text-xs text-ink-tertiary">
                        {task.teamName} · {task.assigneeName}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => approveOrRejectTask(task.id, false, '보완 요청', 'MANAGER')}
                      className="h-8 px-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-semibold cursor-pointer"
                    >
                      반려
                    </button>
                    <button
                      type="button"
                      onClick={() => approveOrRejectTask(task.id, true, '승인 완료', 'MANAGER')}
                      className="h-8 px-3 rounded-lg bg-peri-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      승인
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
