import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, Button, Input, Modal } from '@/components/ui';
import { useRenewal } from '@/features/renewal/context/RenewalContext';
import { ROLE_META } from '@/features/renewal/types/renewal';
import { useToast } from '@/components/ui/Toast';
import { MemberAvatar } from '@/features/renewal/components/PeriwinkleArtwork';
import TeamKanbanBoard from '@/features/teamspace/kanban/components/TeamKanbanBoard';
import TeamCalendar from '@/features/teamspace/schedule/components/TeamCalendar';
import TeamBulletinBoard from '@/features/teamspace/bulletin/components/TeamBulletinBoard';
import TeamAnnouncementBoard from '@/features/teamspace/announcement/components/TeamAnnouncementBoard';

export type TeamSpaceTab =
  | 'overview'
  | 'kanban'
  | 'calendar'
  | 'board'
  | 'announcements'
  | 'settings';

export const TeamSpacePage: React.FC<{ forcedTab?: TeamSpaceTab }> = ({ forcedTab }) => {
  const { workspaceId, teamId } = useParams<{ workspaceId: string; teamId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const {
    getWorkspaceById,
    getRecruitments,
    getWorkspaceMembers,
    getTeamKanbanTasks,
    delegations,
    requestLeaderDelegation,
    respondLeaderDelegation,
    manualAssignMemberToTeam,
  } = useRenewal();

  const activeWs = getWorkspaceById(workspaceId);
  const wsId = activeWs.id;
  const isReadOnly = !!activeWs.archived;

  const teams = getRecruitments(wsId);
  const currentTeam = teams.find((t) => t.id === teamId) || teams[0];
  const resolvedTeamId = currentTeam?.id || teamId || 'team-alpha';

  const members = getWorkspaceMembers(wsId);
  const teamMembers = members.filter((m) => currentTeam?.memberIds.includes(m.id));
  const tasks = getTeamKanbanTasks(resolvedTeamId);

  const [activeTab, setActiveTab] = useState<TeamSpaceTab>(forcedTab || 'kanban');
  const [editTeamName, setEditTeamName] = useState(currentTeam?.name || '코드블루 (CodeBlue)');
  const [editTeamDesc, setEditTeamDesc] = useState(currentTeam?.intro || '');
  const [delegateTargetId, setDelegateTargetId] = useState(
    teamMembers.find((m) => m.id !== currentTeam?.leaderId)?.id || '1'
  );
  const [deleteTeamModalOpen, setDeleteTeamModalOpen] = useState(false);
  const [deleteTeamNameInput, setDeleteTeamNameInput] = useState('');

  useEffect(() => {
    if (forcedTab) {
      setActiveTab(forcedTab);
      return;
    }
    const path = location.pathname;
    if (path.endsWith('/kanban')) setActiveTab('kanban');
    else if (path.endsWith('/calendar')) setActiveTab('calendar');
    else if (path.endsWith('/board')) setActiveTab('board');
    else if (path.endsWith('/announcements')) setActiveTab('announcements');
    else if (path.endsWith('/settings')) setActiveTab('settings');
    else {
      const q = new URLSearchParams(location.search).get('tab') as TeamSpaceTab | null;
      if (q) setActiveTab(q);
      else setActiveTab('overview');
    }
  }, [forcedTab, location.pathname, location.search]);

  const handleTabClick = (tab: TeamSpaceTab) => {
    setActiveTab(tab);
    if (tab === 'overview') {
      navigate(`/ws/${wsId}/team/${resolvedTeamId}`);
    } else {
      navigate(`/ws/${wsId}/team/${resolvedTeamId}/${tab}`);
    }
  };

  const pendingCount = tasks.filter((t) => t.status === 'APPROVAL_PENDING').length;
  const pendingDelegation = delegations[resolvedTeamId];

  const tabs: { id: TeamSpaceTab; label: string; badge?: number }[] = [
    { id: 'kanban', label: '칸반 보드', badge: pendingCount > 0 ? pendingCount : undefined },
    { id: 'overview', label: '팀 개요' },
    { id: 'calendar', label: '일정' },
    { id: 'board', label: '게시판' },
    { id: 'announcements', label: '공지' },
    { id: 'settings', label: '팀 설정' },
  ];

  return (
    <div className="w-full max-w-[1360px] mx-auto px-5 sm:px-8 py-6 sm:py-7 space-y-6">
      {/* Subtle Sub-navigation strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 pb-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-peri-500 text-white shadow-2xs'
                    : 'text-ink-secondary hover:bg-white hover:text-ink-primary'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                      active ? 'bg-white/25 text-white' : 'bg-peri-100 text-peri-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/ws/${wsId}/chat/team-${resolvedTeamId}`)}
            className="h-8 px-3 rounded-lg bg-white border border-neutral-200 text-xs font-medium text-ink-secondary hover:text-ink-primary cursor-pointer"
          >
            팀 채팅
          </button>
          <button
            type="button"
            onClick={() => navigate(`/ws/${wsId}/video/${resolvedTeamId}`)}
            className="h-8 px-3 rounded-lg bg-peri-50 text-peri-700 text-xs font-semibold hover:bg-peri-100 cursor-pointer"
          >
            화상회의
          </button>
        </div>
      </div>

      {/* Active Tab Content */}
      {activeTab === 'kanban' && (
        <TeamKanbanBoard
          teamId={resolvedTeamId}
          workspaceId={wsId}
          isReadOnly={isReadOnly}
        />
      )}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-ink-primary">{currentTeam?.name}</h2>
            <p className="text-xs sm:text-sm text-ink-tertiary mt-1">{currentTeam?.intro}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamMembers.map((tm) => (
              <div
                key={tm.id}
                onClick={() => navigate(`/ws/${wsId}/members/${tm.id}`)}
                className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-craft-sm hover:border-peri-300 transition-colors cursor-pointer space-y-3"
              >
                <div className="flex items-center gap-3">
                  <MemberAvatar name={tm.name} size="md" />
                  <div>
                    <div className="text-sm font-bold text-ink-primary">{tm.name}</div>
                    <div className="text-xs text-ink-tertiary">
                      {tm.desiredRole1 ? ROLE_META[tm.desiredRole1].label : '백엔드'}
                      {tm.id === currentTeam?.leaderId && ' · 팀장'}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(tm.hashtags || []).slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded bg-peri-50 text-peri-700 text-[11px] font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
        <TeamCalendar teamId={resolvedTeamId} workspaceId={wsId} isReadOnly={isReadOnly} />
      )}

      {activeTab === 'board' && (
        <TeamBulletinBoard teamId={resolvedTeamId} workspaceId={wsId} isReadOnly={isReadOnly} />
      )}

      {activeTab === 'announcements' && (
        <TeamAnnouncementBoard
          teamId={resolvedTeamId}
          workspaceId={wsId}
          isReadOnly={isReadOnly}
        />
      )}

      {activeTab === 'settings' && (
        <div className="space-y-5 max-w-2xl">
          <Card title="팀 기본 설정">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                showToast({ title: '팀 정보가 저장되었습니다.', variant: 'success' });
              }}
              className="space-y-4"
            >
              <Input
                label="팀 이름"
                name="editTeamName"
                value={editTeamName}
                onChange={(e) => setEditTeamName(e.target.value)}
              />
              <Input
                label="팀 소개"
                name="editTeamDesc"
                value={editTeamDesc}
                onChange={(e) => setEditTeamDesc(e.target.value)}
              />
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm">
                  저장
                </Button>
              </div>
            </form>
          </Card>

          <Card title="팀장 권한 위임" subtitle="후임 팀원이 위임을 수락하면 팀장 권한이 이전됩니다.">
            {pendingDelegation && pendingDelegation.status === 'PENDING' ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-ink-secondary">
                  <strong>{pendingDelegation.targetMemberName}</strong> 님에게 위임 수락 대기 중
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={() => respondLeaderDelegation(resolvedTeamId, true)}
                  >
                    위임 수락
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => respondLeaderDelegation(resolvedTeamId, false)}
                  >
                    취소
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <select
                    value={delegateTargetId}
                    onChange={(e) => setDelegateTargetId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-ink-primary"
                  >
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => requestLeaderDelegation(resolvedTeamId, delegateTargetId)}
                >
                  위임 요청
                </Button>
              </div>
            )}
          </Card>

          <Card title="팀 멤버 및 삭제">
            <div className="space-y-3">
              {teamMembers.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <MemberAvatar name={m.name} size="xs" />
                    <span className="font-semibold text-ink-primary">{m.name}</span>
                  </div>
                  {m.id !== currentTeam?.leaderId && (
                    <button
                      type="button"
                      onClick={() => manualAssignMemberToTeam(wsId, m.id, null)}
                      className="text-ink-tertiary hover:text-rose-600 cursor-pointer"
                    >
                      내보내기
                    </button>
                  )}
                </div>
              ))}
              <div className="pt-3 border-t border-neutral-100 flex justify-end">
                <Button
                  variant="danger"
                  size="xs"
                  onClick={() => {
                    setDeleteTeamNameInput('');
                    setDeleteTeamModalOpen(true);
                  }}
                >
                  팀 삭제
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Modal
        isOpen={deleteTeamModalOpen}
        onClose={() => setDeleteTeamModalOpen(false)}
        title="팀 삭제 확인"
        subtitle={`팀 이름("${currentTeam?.name}")을 입력하면 삭제됩니다.`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDeleteTeamModalOpen(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={deleteTeamNameInput.trim() !== currentTeam?.name}
              onClick={() => {
                setDeleteTeamModalOpen(false);
                navigate(`/ws/${wsId}`);
              }}
            >
              삭제
            </Button>
          </>
        }
      >
        <Input
          name="deleteTeamNameInput"
          placeholder={currentTeam?.name}
          value={deleteTeamNameInput}
          onChange={(e) => setDeleteTeamNameInput(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default TeamSpacePage;
