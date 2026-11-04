import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowPathIcon, CheckBadgeIcon, PlusIcon, UserGroupIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { roleText } from '@/renewal/domain/card';
import { isManager, type Member } from '@/renewal/domain/workspace';
import { SESSION_STATUS_LABEL, TEAM_BUILDING_RULES, dDayLabel, formatDeadline, type SessionManageView, type SessionStatus } from '@/renewal/domain/teamBuilding';
import { DataError } from '@/renewal/data';
import {
  useAddTeamSlot,
  useAssignMember,
  useCloseSession,
  useCreateSession,
  useManageView,
  useOpenSession,
  useRandomAssign,
  useRemindCardWriters,
  useResolveSession,
  useUnassignMember,
  useUpdateSession,
  useWorkspace,
} from '@/renewal/data/queries';
import { Avatar, Badge, Button, EmptyState, ErrorState, LoadingState, Modal, buttonClassName, fieldClassName, toast } from '@/renewal/ui';
import { ForbiddenScreen, NotFoundScreen } from '@/renewal/screens/system';
import { ConfirmModal } from '@/renewal/features/teamBuilding/shared';
import { ExtendDeadlineModal, SessionSettingsForm } from './SessionSettingsForm';

const statusTone: Record<SessionStatus, 'primary' | 'neutral' | 'success' | 'warning'> = {
  DRAFT: 'neutral',
  OPEN: 'primary',
  CLOSING: 'warning',
  RESOLVED: 'success',
};

type Confirm = 'open' | 'close' | 'resolve' | null;

const errorToast = (error: unknown) => toast.error(error instanceof Error ? error.message : '요청을 처리하지 못했어요. 다시 시도해 주세요.');

const memberRole = (member: Member) =>
  member.cardState === 'PUBLIC' ? `${roleText(member.card, member.card.desiredRole1)} 희망` : member.cardState === 'PRIVATE' ? '카드 비공개' : '카드 미작성';

const Stat: React.FC<{ label: string; value: React.ReactNode; tone?: 'default' | 'warning' }> = ({ label, value, tone = 'default' }) => (
  <div className="rounded-card border border-outline-soft bg-surface px-4 py-3">
    <dt className="text-xs font-semibold text-muted">{label}</dt>
    <dd className={`mt-0.5 text-2xl font-bold tabular-nums ${tone === 'warning' ? 'text-warning' : 'text-ink'}`}>{value}</dd>
  </div>
);

/** 새 팀 슬롯 이름 입력(CLOSING 수동 배치용). */
const TeamSlotModal: React.FC<{ open: boolean; pending: boolean; onClose: () => void; onSubmit: (name: string) => void }> = ({ open, pending, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  React.useEffect(() => {
    if (open) {
      setName('');
      setError(undefined);
    }
  }, [open]);
  const submit = () => {
    if (!name.trim()) {
      setError('팀 이름을 입력해 주세요.');
      document.getElementById('team-slot-name')?.focus();
      return;
    }
    onSubmit(name.trim());
  };
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      preventClose={pending}
      title="새 팀 슬롯"
      description="빈 팀을 만들고 미배정 멤버를 배치해요. 처음 배치한 사람이 팀장이 돼요."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button onClick={submit} loading={pending}>
            만들기
          </Button>
        </>
      }
    >
      <label htmlFor="team-slot-name" className="mb-1.5 block text-sm font-semibold">
        팀 이름
      </label>
      <input
        id="team-slot-name"
        value={name}
        maxLength={TEAM_BUILDING_RULES.teamNameMax}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && submit()}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'team-slot-name-error' : undefined}
        className={fieldClassName(Boolean(error))}
      />
      {error && (
        <p id="team-slot-name-error" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </Modal>
  );
};

/** 미배정 멤버 한 명. 마감 처리 중에는 배치할 팀을 고를 수 있다. */
const UnassignedRow: React.FC<{
  member: Member;
  view: SessionManageView;
  editable: boolean;
  busy: boolean;
  onAssign: (teamId: string) => void;
}> = ({ member, view, editable, busy, onAssign }) => {
  const [teamId, setTeamId] = useState('');
  const options = view.teams.filter((item) => item.openSeats > 0);
  const selectId = `assign-${member.account.id}`;
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Avatar name={member.account.name} imageUrl={member.account.profileImageUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{member.account.name}</p>
        <p className="text-xs text-muted">{memberRole(member)}</p>
      </div>
      {editable && (
        <div className="flex w-full gap-2">
          <label htmlFor={selectId} className="sr-only">
            {member.account.name} 배치할 팀
          </label>
          <select
            id={selectId}
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            disabled={options.length === 0}
            className={fieldClassName(false, 'min-w-0 flex-1 appearance-auto py-2 text-sm')}
          >
            <option value="">{options.length === 0 ? '빈자리 없음' : '팀 선택'}</option>
            {options.map((item) => (
              <option key={item.team.id} value={item.team.id}>
                {item.team.name} ({item.team.memberIds.length}/{view.session?.teamCapacity})
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" disabled={!teamId || busy} onClick={() => onAssign(teamId)}>
            배치
          </Button>
        </div>
      )}
    </li>
  );
};

/**
 * SCR-TB-04 세션 운영(12 §4.4). 개설자·매니저 전용이며 세션 상태마다 할 수 있는 일이 다르다.
 * 세션 없음은 만들기, DRAFT는 설정과 모집 시작, OPEN은 현황 모니터와 연장·마감,
 * CLOSING은 수동 배치와 랜덤 배치·결과 확정, RESOLVED는 결과 요약을 보여 준다.
 * 기획의 드래그 앤 드롭 배치는 키보드로도 쓸 수 있도록 팀 선택 목록으로 대신했다.
 */
export const ManageScreen: React.FC = () => {
  const { wsId = '' } = useParams<{ wsId: string }>();
  const workspace = useWorkspace(wsId);
  const manager = isManager(workspace.data?.myRole);
  const view = useManageView(wsId, manager);
  const createSession = useCreateSession(wsId);
  const updateSession = useUpdateSession(wsId);
  const openSession = useOpenSession(wsId);
  const closeSession = useCloseSession(wsId);
  const assign = useAssignMember(wsId);
  const unassign = useUnassignMember(wsId);
  const addSlot = useAddTeamSlot(wsId);
  const randomAssign = useRandomAssign(wsId);
  const resolve = useResolveSession(wsId);
  const remind = useRemindCardWriters(wsId);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [extending, setExtending] = useState(false);
  const [addingSlot, setAddingSlot] = useState(false);
  const busy = assign.isPending || unassign.isPending || randomAssign.isPending;
  const home = `/ws/${wsId}`;

  if (workspace.isLoading || (manager && view.isLoading)) return <LoadingState className="min-h-[60vh]" label="세션 운영 정보를 불러오는 중이에요" />;
  if (workspace.error instanceof DataError && workspace.error.code === 'NOT_FOUND') return <NotFoundScreen />;
  if ((workspace.data && !manager) || (view.error instanceof DataError && view.error.code === 'FORBIDDEN')) return <ForbiddenScreen backTo={home} />;
  if (workspace.isError || view.isError || !view.data) {
    return (
      <ErrorState
        className="min-h-[60vh]"
        title="세션 운영 정보를 불러오지 못했어요"
        description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
        action={<Button onClick={() => (workspace.isError ? workspace.refetch() : view.refetch())}>다시 시도</Button>}
      />
    );
  }

  const data = view.data;
  const { session } = data;

  const run = async <T,>(action: () => Promise<T>, done: string | ((result: T) => string)) => {
    try {
      const result = await action();
      toast.success(typeof done === 'string' ? done : done(result));
      return true;
    } catch (error) {
      errorToast(error);
      return false;
    }
  };

  if (!session) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
        <h1 className="text-2xl font-bold leading-8">세션 운영</h1>
        <section aria-labelledby="create-session" className="mt-6 rounded-modal border border-outline-soft bg-surface p-6">
          <h2 id="create-session" className="text-lg font-bold">
            팀 빌딩 세션 만들기
          </h2>
          <p className="mb-5 mt-1 text-sm text-muted">준비 중 상태로 만들어져요. 모집을 시작하기 전까지 멤버에게는 보이지 않아요.</p>
          <SessionSettingsForm submitLabel="세션 만들기" pending={createSession.isPending} onSubmit={(input) => run(() => createSession.mutateAsync(input), '세션을 만들었어요.')} />
        </section>
      </div>
    );
  }

  const fullTeams = data.teams.filter((item) => item.team.memberIds.length > 0 && item.openSeats === 0).length;
  const editable = session.status === 'CLOSING';
  const confirmCopy: Record<Exclude<Confirm, null>, { title: string; description: string; label: string; pending: boolean; action: () => Promise<boolean> }> = {
    open: {
      title: '모집 시작',
      description: '모집을 시작하면 멤버들이 팀을 만들고 지원할 수 있어요. 시작한 뒤에는 팀 정원을 바꿀 수 없어요.',
      label: '모집 시작하기',
      pending: openSession.isPending,
      action: () => run(() => openSession.mutateAsync(), '모집을 시작했어요.'),
    },
    close: {
      title: '지금 마감',
      description: `마감하면 새 지원과 스카우트를 받지 않고, 답변을 기다리는 제안 ${data.pendingApplications}건은 만료돼요. 모집을 다시 열 수 없어요.`,
      label: '마감하기',
      pending: closeSession.isPending,
      action: () => run(() => closeSession.mutateAsync(), '모집을 마감했어요. 남은 멤버를 팀에 배치해 주세요.'),
    },
    resolve: {
      title: '결과 확정',
      description: '확정하면 팀 구성이 끝나고 세션을 다시 열 수 없어요. 아무도 배치되지 않은 팀 슬롯은 삭제돼요.',
      label: '확정하기',
      pending: resolve.isPending,
      action: () => run(() => resolve.mutateAsync(), '팀 빌딩 결과를 확정했어요.'),
    },
  };
  const current = confirm ? confirmCopy[confirm] : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold leading-8">세션 운영</h1>
            <Badge tone={statusTone[session.status]}>{SESSION_STATUS_LABEL[session.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {session.status === 'OPEN' ? (
              <>
                모집 마감 {formatDeadline(session.closesAt)} · <span className="font-semibold text-ink">{dDayLabel(session.closesAt)}</span>
              </>
            ) : session.status === 'DRAFT' ? (
              `모집 마감 예정 ${formatDeadline(session.closesAt)}`
            ) : (
              `모집 마감 ${formatDeadline(session.closesAt)}`
            )}{' '}
            · 팀 정원 {session.teamCapacity}명
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {session.status === 'DRAFT' && <Button onClick={() => setConfirm('open')}>모집 시작</Button>}
          {session.status === 'OPEN' && (
            <>
              <Button variant="outline" onClick={() => setExtending(true)}>
                마감 연장
              </Button>
              <Button variant="danger" onClick={() => setConfirm('close')}>
                지금 마감
              </Button>
            </>
          )}
          {session.status === 'RESOLVED' && (
            <Link to={`${home}/dashboard`} className={buttonClassName('outline')}>
              대시보드로 이동
            </Link>
          )}
        </div>
      </header>

      {session.status === 'DRAFT' && (
        <section aria-labelledby="session-settings" className="mt-6 rounded-modal border border-outline-soft bg-surface p-6">
          <h2 id="session-settings" className="mb-4 text-lg font-bold">
            세션 설정
          </h2>
          <SessionSettingsForm
            initial={{ closesAt: session.closesAt, teamCapacity: session.teamCapacity }}
            submitLabel="설정 저장"
            pending={updateSession.isPending}
            onSubmit={(input) => run(() => updateSession.mutateAsync(input), '설정을 저장했어요.')}
          />
        </section>
      )}

      <section aria-labelledby="session-stats" className="mt-6">
        <h2 id="session-stats" className="sr-only">
          현황
        </h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="참여 대상" value={`${data.participants}명`} />
          <Stat label="배정" value={`${data.assigned}명`} />
          <Stat label="미배정" value={`${data.unassigned.length}명`} tone={data.unassigned.length > 0 ? 'warning' : 'default'} />
          <Stat
            label="팀"
            value={
              <>
                {data.teams.length}개 <span className="text-sm font-semibold text-muted">정원 충족 {fullTeams}</span>
              </>
            }
          />
        </dl>
        {(session.status === 'DRAFT' || session.status === 'OPEN') && data.cardNotWritten > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
            <p className="text-warning">카드를 쓰지 않은 멤버가 {data.cardNotWritten}명 있어요. 카드가 없으면 지원과 팀 만들기를 할 수 없어요.</p>
            <Button size="sm" variant="outline" loading={remind.isPending} onClick={() => run(() => remind.mutateAsync(), (result) => `${result.count}명에게 카드 작성 리마인드를 보냈어요.`)}>
              리마인드 보내기
            </Button>
          </div>
        )}
      </section>

      {editable && (
        <section aria-labelledby="closing-actions" className="mt-6 rounded-card border border-outline-soft bg-surface p-4">
          <h2 id="closing-actions" className="text-base font-bold">
            마감 처리
          </h2>
          <p className="mt-1 text-sm text-muted">
            {data.unassigned.length > 0
              ? `미배정 ${data.unassigned.length}명을 팀에 배치해야 결과를 확정할 수 있어요.`
              : '모든 멤버가 배치됐어요. 결과를 확정하면 팀 빌딩이 끝나요.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              leftIcon={<ArrowPathIcon className="h-5 w-5" />}
              disabled={data.unassigned.length === 0 || busy}
              loading={randomAssign.isPending}
              onClick={() =>
                run(
                  () => randomAssign.mutateAsync(),
                  (result) =>
                    result.remaining > 0
                      ? `${result.assigned}명을 배치했어요. 빈자리가 모자라 ${result.remaining}명이 남았어요. 새 팀 슬롯을 추가해 주세요.`
                      : `${result.assigned}명을 배치했어요.`,
                )
              }
            >
              남은 미배정자 랜덤 배치
            </Button>
            <Button leftIcon={<CheckBadgeIcon className="h-5 w-5" />} disabled={data.unassigned.length > 0 || busy} onClick={() => setConfirm('resolve')}>
              결과 확정
            </Button>
          </div>
        </section>
      )}

      {session.status === 'RESOLVED' && (
        <p role="status" className="mt-6 rounded-card border border-green-200 bg-green-50 px-4 py-3 text-sm text-success">
          팀 빌딩을 확정했어요. 세션은 다시 열 수 없어요.
        </p>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section aria-labelledby="unassigned-heading" className="self-start overflow-hidden rounded-card border border-outline-soft bg-surface">
          <h2 id="unassigned-heading" className="border-b border-outline-soft px-4 py-3 text-base font-bold">
            미배정 멤버 <span className="text-muted tabular-nums">{data.unassigned.length}</span>
          </h2>
          {data.unassigned.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">모든 멤버가 팀에 속해 있어요.</p>
          ) : (
            <ul className="divide-y divide-outline-soft">
              {data.unassigned.map((member) => (
                <UnassignedRow
                  key={member.account.id}
                  member={member}
                  view={data}
                  editable={editable}
                  busy={busy}
                  onAssign={(teamId) =>
                    run(() => assign.mutateAsync({ accountId: member.account.id, teamId }), `${member.account.name}님을 ${data.teams.find((item) => item.team.id === teamId)?.team.name}에 배치했어요.`)
                  }
                />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="team-board-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="team-board-heading" className="text-base font-bold">
              팀 보드 <span className="text-muted tabular-nums">{data.teams.length}</span>
            </h2>
            {editable && (
              <Button size="sm" variant="outline" leftIcon={<PlusIcon className="h-4 w-4" />} onClick={() => setAddingSlot(true)}>
                새 팀 슬롯
              </Button>
            )}
          </div>
          {data.teams.length === 0 ? (
            <div className="rounded-card border border-dashed border-outline-soft bg-surface">
              <EmptyState
                compact
                icon={<UserGroupIcon className="h-5 w-5" />}
                title="아직 만들어진 팀이 없어요"
                description={editable ? '새 팀 슬롯을 추가해 멤버를 배치해 주세요.' : session.status === 'OPEN' ? '멤버가 팀을 만들면 여기에 보여요.' : undefined}
              />
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.teams.map(({ team, members, openSeats }) => (
                <li key={team.id} className="rounded-card border border-outline-soft bg-surface p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="truncate font-bold">{team.name}</p>
                    <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted tabular-nums">
                      {team.memberIds.length}/{session.teamCapacity}
                      {members.length > 0 && openSeats === 0 && <Badge tone="success">정원 충족</Badge>}
                    </span>
                  </div>
                  {members.length === 0 ? (
                    <p className="text-sm text-muted">아직 배치된 멤버가 없어요.</p>
                  ) : (
                    <ul className="space-y-1">
                      {members.map((member) => (
                        <li key={member.account.id} className="flex items-center gap-2 text-sm">
                          <Avatar name={member.account.name} imageUrl={member.account.profileImageUrl} size="xs" />
                          <span className="min-w-0 flex-1 truncate">
                            {member.account.name}
                            {member.account.id === team.leaderId && <span className="ml-1 text-xs font-semibold text-primary">팀장</span>}
                            <span className="ml-1.5 text-xs text-muted">{memberRole(member)}</span>
                          </span>
                          {editable && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => run(() => unassign.mutateAsync(member.account.id), `${member.account.name}님을 미배정으로 돌렸어요.`)}
                              aria-label={`${member.account.name} 배치 취소`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-container disabled:opacity-40"
                            >
                              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {current && (
        <ConfirmModal
          open
          title={current.title}
          description={current.description}
          confirmLabel={current.label}
          pending={current.pending}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await current.action();
            setConfirm(null);
          }}
        />
      )}
      <ExtendDeadlineModal
        open={extending}
        closesAt={session.closesAt}
        teamCapacity={session.teamCapacity}
        pending={updateSession.isPending}
        onClose={() => setExtending(false)}
        onSubmit={async (input) => {
          if (await run(() => updateSession.mutateAsync(input), `모집 마감을 ${formatDeadline(input.closesAt)}로 연장했어요.`)) setExtending(false);
        }}
      />
      <TeamSlotModal
        open={addingSlot}
        pending={addSlot.isPending}
        onClose={() => setAddingSlot(false)}
        onSubmit={async (name) => {
          if (await run(() => addSlot.mutateAsync(name), `${name} 슬롯을 추가했어요.`)) setAddingSlot(false);
        }}
      />
    </div>
  );
};
