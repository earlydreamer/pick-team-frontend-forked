import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { Button, Modal, Input, TextArea } from '@/components/ui';
import { useRenewal } from '@/features/renewal/context/RenewalContext';
import {
  ROLE_META,
  TIME_SLOT_META,
  GOAL_TEMPERATURE_META,
  TeamRecruitment,
  DesiredRoleCode,
} from '@/features/renewal/types/renewal';
import { calculateMemberToTeamMatch } from '@/features/renewal/utils/matchingEngine';
import { MemberAvatar } from '@/features/renewal/components/PeriwinkleArtwork';

const SubNavTabs: React.FC<{ wsId: string }> = ({ wsId }) => {
  const location = useLocation();
  const { getApplications, getEffectiveWorkspaceRole } = useRenewal();
  const apps = getApplications(wsId);
  const pendingCount = apps.filter((a) => a.status === 'PENDING').length;
  const role = getEffectiveWorkspaceRole(wsId);
  const canManage = role === 'OWNER' || role === 'ADMIN';

  const tabs = [
    { label: '모집 중인 팀', path: `/ws/${wsId}/team-building`, exact: true },
    {
      label: '받은 제안 · 지원함',
      path: `/ws/${wsId}/team-building/inbox`,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    ...(canManage
      ? [{ label: '미배정 배치 · 세션 운영', path: `/ws/${wsId}/team-building/manage` }]
      : []),
  ];

  return (
    <div className="flex items-center gap-1.5 border-b border-neutral-200/80 pb-3">
      {tabs.map((t) => {
        const active = t.exact
          ? location.pathname === t.path || location.pathname.endsWith('/team-formation')
          : location.pathname.startsWith(t.path);
        return (
          <Link
            key={t.path}
            to={t.path}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              active
                ? 'bg-peri-500 text-white shadow-2xs'
                : 'text-ink-secondary hover:bg-white hover:text-ink-primary'
            }`}
          >
            <span>{t.label}</span>
            {t.badge !== undefined && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                  active ? 'bg-white/25 text-white' : 'bg-peri-100 text-peri-700'
                }`}
              >
                {t.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
};

export const TeamBuildingHomePage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const {
    getWorkspaceById,
    getSession,
    getRecruitments,
    myPRCard,
    createRecruitmentTeam,
    submitApplication,
  } = useRenewal();

  const activeWs = getWorkspaceById(workspaceId);
  const wsId = activeWs.id;
  const session = getSession(wsId);
  const teams = getRecruitments(wsId);

  const [roleFilter, setRoleFilter] = useState<DesiredRoleCode | ''>('');
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamIntro, setNewTeamIntro] = useState('');
  const [newTeamTemp, setNewTeamTemp] = useState<1 | 2 | 3 | 4 | 5>(4);

  const [applyTargetTeam, setApplyTargetTeam] = useState<TeamRecruitment | null>(null);
  const [applyRole, setApplyRole] = useState<DesiredRoleCode>(myPRCard.desiredRole1 || 'BACKEND');
  const [applyMessage, setApplyMessage] = useState(
    '희망 역할과 협업 시간대가 잘 맞아 지원합니다.'
  );

  const filteredTeams = useMemo(() => {
    if (!roleFilter) return teams;
    return teams.filter((t) =>
      t.recruitRoles.some((r) => r.role === roleFilter && r.filledCount < r.totalCount)
    );
  }, [teams, roleFilter]);

  const handleSubmitApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyTargetTeam) return;
    const ok = submitApplication(wsId, {
      direction: 'APPLY',
      targetTeamId: applyTargetTeam.id,
      desiredRole: applyRole,
      message: applyMessage,
    });
    if (ok) setApplyTargetTeam(null);
  };

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim() || !newTeamIntro.trim()) return;
    const created = createRecruitmentTeam(wsId, {
      name: newTeamName.trim(),
      intro: newTeamIntro.trim(),
      goalTemperature: newTeamTemp,
      roles: [
        { role: 'BACKEND', count: 2 },
        { role: 'FRONTEND', count: 2 },
      ],
    });
    setCreateTeamOpen(false);
    navigate(`/ws/${wsId}/team-building/teams/${created.id}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink-primary tracking-tight">
            팀 빌딩
          </h1>
          <p className="text-xs sm:text-sm text-ink-tertiary mt-1">
            모집 중인 팀의 부족 역할과 매칭 적합도를 확인하고 지원해 보세요.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateTeamOpen(true)}
          className="h-10 px-4 rounded-xl bg-peri-500 hover:bg-peri-600 text-white text-xs sm:text-sm font-semibold shadow-xs press-scale cursor-pointer self-start sm:self-auto"
        >
          + 새 팀 모집하기
        </button>
      </div>

      <SubNavTabs wsId={wsId} />

      {/* Role Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setRoleFilter('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
            roleFilter === ''
              ? 'bg-ink-primary text-white'
              : 'bg-white border border-neutral-200 text-ink-secondary hover:bg-surface-subtle'
          }`}
        >
          전체 팀 ({teams.length})
        </button>
        {(['BACKEND', 'FRONTEND', 'PM', 'DESIGN', 'AI_DATA'] as DesiredRoleCode[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRoleFilter(roleFilter === r ? '' : r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              roleFilter === r
                ? 'bg-ink-primary text-white'
                : 'bg-white border border-neutral-200 text-ink-secondary hover:bg-surface-subtle'
            }`}
          >
            {ROLE_META[r].label} 모집 중
          </button>
        ))}
      </div>

      {/* Clean 2-Column Team Cards */}
      <div className="grid md:grid-cols-2 gap-4 sm:gap-5">
        {filteredTeams.map((team) => {
          const match = calculateMemberToTeamMatch(myPRCard, team);
          return (
            <div
              key={team.id}
              onClick={() => navigate(`/ws/${wsId}/team-building/teams/${team.id}`)}
              className="bg-white rounded-2xl border border-neutral-200/85 shadow-craft-sm hover:border-peri-300 transition-all p-5 sm:p-6 flex flex-col justify-between gap-4 cursor-pointer"
            >
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-ink-primary">{team.name}</h3>
                    <p className="text-xs text-ink-tertiary mt-0.5">
                      팀장 {team.leaderName} · 현재 {team.memberIds.length}/{session.teamSizeMax}명
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-peri-50 text-peri-700 text-xs font-bold tabular-nums shrink-0">
                    적합도 {Math.min(98, match.totalScore + 6)}%
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-ink-secondary line-clamp-2 leading-relaxed">
                  {team.intro}
                </p>

                {/* Open Role Slots */}
                <div className="flex flex-wrap gap-1.5">
                  {team.recruitRoles.map((slot) => {
                    const open = slot.totalCount - slot.filledCount;
                    return (
                      <span
                        key={slot.role}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                          open > 0
                            ? 'bg-peri-50/90 text-peri-700'
                            : 'bg-surface-subtle text-ink-tertiary line-through'
                        }`}
                      >
                        {ROLE_META[slot.role].label} {slot.filledCount}/{slot.totalCount}
                      </span>
                    );
                  })}
                </div>

                <div className="text-xs text-ink-tertiary">
                  매칭 근거: <span className="text-ink-secondary font-medium">{match.reasons[0]}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/ws/${wsId}/team-building/teams/${team.id}`);
                  }}
                  className="h-9 rounded-xl bg-surface-subtle hover:bg-neutral-200/70 text-ink-primary text-xs font-semibold transition-colors cursor-pointer"
                >
                  상세보기
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setApplyTargetTeam(team);
                  }}
                  className="h-9 rounded-xl bg-peri-500 hover:bg-peri-600 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  지원하기
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Apply Modal */}
      <Modal
        isOpen={!!applyTargetTeam}
        onClose={() => setApplyTargetTeam(null)}
        title={`${applyTargetTeam?.name || ''} 지원하기`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setApplyTargetTeam(null)}>
              취소
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmitApply}>
              지원서 보내기
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmitApply} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">
              지원 포지션
            </label>
            <select
              value={applyRole}
              onChange={(e) => setApplyRole(e.target.value as DesiredRoleCode)}
              className="w-full h-9 px-3 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-ink-primary"
            >
              {(Object.keys(ROLE_META) as DesiredRoleCode[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_META[r].label}
                </option>
              ))}
            </select>
          </div>
          <TextArea
            label="한마디 메시지"
            name="applyMessage"
            maxLength={200}
            value={applyMessage}
            onChange={(e) => setApplyMessage(e.target.value)}
          />
        </form>
      </Modal>

      {/* Create Team Modal */}
      <Modal
        isOpen={createTeamOpen}
        onClose={() => setCreateTeamOpen(false)}
        title="새 팀 모집 공고 등록"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateTeamOpen(false)}>
              취소
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateTeam}>
              등록하기
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateTeam} className="space-y-4">
          <Input
            label="팀 이름"
            name="newTeamName"
            placeholder="예: 코드블루"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <TextArea
            label="팀 소개"
            name="newTeamIntro"
            placeholder="프로젝트 목표와 협업 방식을 적어주세요."
            value={newTeamIntro}
            onChange={(e) => setNewTeamIntro(e.target.value)}
          />
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">
              목표 수준 (1~5)
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNewTeamTemp(n)}
                  className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                    newTeamTemp === n
                      ? 'bg-peri-500 text-white border-peri-500'
                      : 'bg-white text-ink-secondary border-neutral-200'
                  }`}
                >
                  {n}단계
                </button>
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const TeamRecruitmentDetailPage: React.FC = () => {
  const { workspaceId, teamId } = useParams<{ workspaceId: string; teamId: string }>();
  const navigate = useNavigate();
  const {
    getWorkspaceById,
    getSession,
    getRecruitments,
    getWorkspaceMembers,
    myPRCard,
    submitApplication,
  } = useRenewal();

  const activeWs = getWorkspaceById(workspaceId);
  const wsId = activeWs.id;
  const session = getSession(wsId);
  const teams = getRecruitments(wsId);
  const members = getWorkspaceMembers(wsId);

  const team = teams.find((t) => t.id === teamId) || teams[0];
  const teamMembers = members.filter((m) => team.memberIds.includes(m.id));
  const match = calculateMemberToTeamMatch(myPRCard, team);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-5">
      <Link
        to={`/ws/${wsId}/team-building`}
        className="inline-block text-xs sm:text-sm font-semibold text-ink-secondary hover:text-peri-600"
      >
        ← 팀 빌딩 목록으로 돌아가기
      </Link>

      <div className="bg-white rounded-2xl border border-neutral-200/85 shadow-craft-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-neutral-100">
          <div>
            <span className="px-2.5 py-1 rounded-md bg-peri-50 text-peri-700 text-xs font-semibold">
              모집 중 · {team.memberIds.length}/{session.teamSizeMax}명
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-ink-primary mt-2">{team.name}</h1>
            <p className="text-sm text-ink-secondary mt-1">{team.intro}</p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() =>
              submitApplication(wsId, {
                direction: 'APPLY',
                targetTeamId: team.id,
                desiredRole: myPRCard.desiredRole1 || 'BACKEND',
                message: '팀 목표와 협업 방식에 공감하여 지원합니다.',
              })
            }
          >
            지원하기
          </Button>
        </div>

        <div className="rounded-xl bg-peri-50/70 border border-peri-200/70 p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-peri-700">나와의 매칭 적합도</div>
            <div className="text-sm font-bold text-ink-primary mt-0.5">
              {match.reasons.join(' · ')}
            </div>
          </div>
          <span className="text-lg font-bold text-peri-700 tabular-nums">
            {Math.min(98, match.totalScore + 6)}%
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-ink-tertiary">현재 팀원 ({teamMembers.length}명)</h2>
            <div className="space-y-2">
              {teamMembers.map((tm) => (
                <div
                  key={tm.id}
                  onClick={() => navigate(`/ws/${wsId}/members/${tm.id}`)}
                  className="p-3 rounded-xl bg-surface-subtle/60 flex items-center justify-between cursor-pointer hover:bg-peri-50/50"
                >
                  <div className="flex items-center gap-2.5">
                    <MemberAvatar name={tm.name} size="sm" />
                    <div>
                      <div className="text-xs font-bold text-ink-primary">{tm.name}</div>
                      <div className="text-[11px] text-ink-tertiary">
                        {tm.desiredRole1 ? ROLE_META[tm.desiredRole1].label : '백엔드'}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-peri-600 font-medium">프로필 →</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-ink-tertiary">모집 포지션 및 가용 시간</h2>
            <div className="space-y-2">
              {team.recruitRoles.map((slot) => (
                <div
                  key={slot.role}
                  className="p-3 rounded-xl bg-surface-subtle/60 flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-ink-primary">
                    {ROLE_META[slot.role].label}
                  </span>
                  <span className="text-ink-secondary tabular-nums">
                    {slot.filledCount} / {slot.totalCount}명
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-ink-tertiary pt-1">
              공통 선호 시간대: {team.commonTimeSlots.map((s) => TIME_SLOT_META[s].label).join(' · ')} ·{' '}
              {GOAL_TEMPERATURE_META[team.goalTemperature].label}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TeamBuildingInboxPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { getWorkspaceById, getApplications, decideApplication } = useRenewal();
  const activeWs = getWorkspaceById(workspaceId);
  const wsId = activeWs.id;
  const applications = getApplications(wsId);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-ink-primary tracking-tight">
          받은 제안 · 지원함
        </h1>
        <p className="text-xs sm:text-sm text-ink-tertiary mt-1">
          받은 스카우트와 지원 내역을 확인하고 수락 또는 거절할 수 있습니다.
        </p>
      </div>

      <SubNavTabs wsId={wsId} />

      <div className="space-y-3">
        {applications.map((app) => (
          <div
            key={app.id}
            className="bg-white rounded-2xl border border-neutral-200/85 p-5 shadow-craft-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3.5">
              <MemberAvatar name={app.applicantName} size="md" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-peri-50 text-peri-700 text-[11px] font-semibold">
                    {app.direction === 'SCOUT' ? '스카우트 제안' : '팀 지원'}
                  </span>
                  <span className="text-sm font-bold text-ink-primary">
                    {app.targetTeamName} · {ROLE_META[app.desiredRole].label}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-ink-secondary">{app.message}</p>
                <div className="text-xs text-ink-tertiary">{app.createdAt}</div>
              </div>
            </div>

            {app.status === 'PENDING' ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => decideApplication(wsId, app.id, 'DECLINED')}
                  className="h-9 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold cursor-pointer"
                >
                  거절
                </button>
                <button
                  type="button"
                  onClick={() => decideApplication(wsId, app.id, 'ACCEPTED')}
                  className="h-9 px-4 rounded-xl bg-peri-500 hover:bg-peri-600 text-white text-xs font-bold cursor-pointer"
                >
                  수락
                </button>
              </div>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-surface-subtle text-ink-tertiary text-xs font-semibold">
                {app.status}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const TeamBuildingManagePage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const {
    getWorkspaceById,
    getSession,
    getWorkspaceMembers,
    getRecruitments,
    manualAssignMemberToTeam,
    runConstrainedRandomFallback,
    resolveTeamBuildingSession,
  } = useRenewal();

  const activeWs = getWorkspaceById(workspaceId);
  const wsId = activeWs.id;
  const session = getSession(wsId);
  const members = getWorkspaceMembers(wsId);
  const teams = getRecruitments(wsId);
  const unassigned = members.filter((m) => !m.assignedTeamId);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink-primary tracking-tight">
            미배정 배치 및 세션 확정
          </h1>
          <p className="text-xs sm:text-sm text-ink-tertiary mt-1">
            미배정 인원({unassigned.length}명)을 팀에 배치하고 팀 빌딩을 확정합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={unassigned.length === 0}
            onClick={() => runConstrainedRandomFallback(wsId)}
          >
            역할 균형 자동 배치
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={unassigned.length > 0}
            onClick={() => {
              if (resolveTeamBuildingSession(wsId)) {
                navigate(`/ws/${wsId}/team/team-alpha/kanban`);
              }
            }}
          >
            팀 빌딩 최종 확정
          </Button>
        </div>
      </div>

      <SubNavTabs wsId={wsId} />

      <div className="grid lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 bg-white rounded-2xl border border-neutral-200/85 p-5 space-y-3">
          <h2 className="text-sm font-bold text-ink-primary">미배정 멤버 ({unassigned.length})</h2>
          {unassigned.length === 0 ? (
            <p className="text-xs text-emerald-700 py-6 text-center font-medium">
              모든 멤버가 팀에 배정되었습니다.
            </p>
          ) : (
            unassigned.map((m) => (
              <div
                key={m.id}
                className="p-3.5 rounded-xl bg-surface-subtle/70 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5">
                  <MemberAvatar name={m.name} size="sm" />
                  <div>
                    <div className="text-xs font-bold text-ink-primary">{m.name}</div>
                    <div className="text-[11px] text-ink-tertiary">
                      {m.desiredRole1 ? ROLE_META[m.desiredRole1].label : '미작성'}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => manualAssignMemberToTeam(wsId, m.id, t.id)}
                      className="px-2 py-1 rounded bg-white border border-neutral-200 hover:border-peri-500 text-[11px] font-medium text-ink-primary cursor-pointer"
                    >
                      + {t.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
          {teams.map((team) => {
            const teamMembers = members.filter((m) => m.assignedTeamId === team.id);
            return (
              <div
                key={team.id}
                className="bg-white rounded-2xl border border-neutral-200/85 p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-ink-primary">{team.name}</h3>
                  <span className="text-xs text-ink-tertiary tabular-nums">
                    {teamMembers.length}/{session.teamSizeMax}명
                  </span>
                </div>
                <div className="space-y-1.5">
                  {teamMembers.map((tm) => (
                    <div
                      key={tm.id}
                      className="px-3 py-2 rounded-xl bg-surface-subtle/60 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-ink-primary">{tm.name}</span>
                      <button
                        type="button"
                        onClick={() => manualAssignMemberToTeam(wsId, tm.id, null)}
                        className="text-ink-tertiary hover:text-rose-600 cursor-pointer"
                      >
                        제외
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const TeamFormationHubPage = TeamBuildingHomePage;
export default TeamBuildingHomePage;
