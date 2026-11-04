import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CalendarDaysIcon, CheckCircleIcon, MegaphoneIcon } from '@heroicons/react/24/outline';
import { relativeTime } from '@/renewal/domain/announcement';
import { TASK_STATUSES, TASK_STATUS_LABEL } from '@/renewal/domain/kanban';
import { SCHEDULE_TYPE_LABEL, showChecklist } from '@/renewal/domain/teamSpace';
import { useConfirmRoles, useTeamOverview } from '@/renewal/data/queries';
import { Avatar, Button, ErrorState, Skeleton, toast } from '@/renewal/ui';
import { RoleBadges } from '@/renewal/features/members/MemberCardTile';
import { useTeamSpaceContext } from './TeamSpaceLayout';

const formatWhen = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });

const Card: React.FC<{ id: string; title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ id, title, action, children, className = '' }) => (
  <section aria-labelledby={id} className={`rounded-card border border-outline-soft bg-surface p-5 ${className}`}>
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 id={id} className="text-base font-bold">
        {title}
      </h2>
      {action}
    </div>
    {children}
  </section>
);

const MoreLink: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <Link to={to} className="inline-flex min-h-touch items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline">
    {children}
    <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
  </Link>
);

/**
 * SCR-TM-01 팀 개요(14 §4.1). 팀원 카드 요약, 칸반 진행도, 다음 일정, 최근 공지를 한 화면에 모은다.
 * 칸반과 일정이 모두 비어 있으면 결성 직후 체크리스트를 먼저 보여 준다.
 */
export const OverviewScreen: React.FC = () => {
  const { workspaceId, teamId, space, base } = useTeamSpaceContext();
  const overview = useTeamOverview(workspaceId, teamId);
  const confirmRoles = useConfirmRoles(workspaceId, teamId);
  const { team, members, access } = space;

  const membersCard = (
    <Card id="tm-members" title={`팀원 ${members.length}명`}>
      {members.length <= 1 ? (
        <p className="text-sm text-muted">
          아직 팀원이 없어요.{' '}
          <Link to={`/ws/${workspaceId}/team-building`} className="font-semibold text-primary underline underline-offset-4">
            팀 빌딩에서 팀원 찾기
          </Link>
        </p>
      ) : null}
      <ul className="flex snap-x gap-3 overflow-x-auto pb-1">
        {members.map((member) => (
          <li key={member.account.id} className="w-44 shrink-0 snap-start">
            <Link
              to={`/ws/${workspaceId}/members/${member.account.id}`}
              className="flex h-full flex-col gap-2 rounded-card border border-outline-soft p-3 hover:border-peri-300 hover:bg-peri-50"
            >
              <span className="flex items-center gap-2">
                <Avatar name={member.account.name} imageUrl={member.account.profileImageUrl} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{member.account.name}</span>
                  {member.account.id === team.leaderId && <span className="text-xs font-semibold text-primary">팀장</span>}
                </span>
              </span>
              {member.cardState === 'PUBLIC' ? (
                <>
                  <span className="flex">
                    <RoleBadges member={member} />
                  </span>
                  {member.card.hashtags.length > 0 && <span className="truncate text-xs text-muted">{member.card.hashtags.slice(0, 3).join(' · ')}</span>}
                </>
              ) : (
                <span className="text-xs text-muted">{member.cardState === 'PRIVATE' ? '카드 비공개' : '카드 미작성'}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );

  if (overview.isLoading) {
    return (
      <div className="space-y-5">
        {membersCard}
        <Skeleton className="h-40 rounded-card" />
      </div>
    );
  }
  if (overview.isError || !overview.data) {
    return (
      <div className="space-y-5">
        {membersCard}
        <ErrorState compact title="진행 현황을 불러오지 못했어요" action={<Button size="sm" variant="outline" onClick={() => overview.refetch()}>다시 시도</Button>} />
      </div>
    );
  }

  const data = overview.data;
  const checklist = access.isMember && showChecklist(data);
  const pending = data.progress.byStatus.APPROVAL_PENDING;

  return (
    <div className="space-y-5">
      {checklist && (
        <section aria-labelledby="tm-checklist" className="rounded-card border border-peri-200 bg-peri-50 p-5">
          <h2 id="tm-checklist" className="text-base font-bold">
            팀이 결성됐어요. 이것부터 시작해 보세요
          </h2>
          <ul className="mt-3 space-y-2">
            {!data.rolesConfirmed && (
              <li className="flex flex-wrap items-center gap-3 rounded-lg bg-surface px-3 py-2.5">
                <span className="flex-1 text-sm">
                  <span className="font-semibold">역할 확정하기</span>
                  <span className="text-muted"> · 아래 팀원 카드의 희망 역할을 보고 정해요</span>
                </span>
                {access.isLeader && (
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<CheckCircleIcon className="h-4 w-4" />}
                    loading={confirmRoles.isPending}
                    onClick={async () => {
                      try {
                        await confirmRoles.mutateAsync();
                        toast.success('역할 확정을 표시했어요.');
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : '저장하지 못했어요.');
                      }
                    }}
                  >
                    확정했어요
                  </Button>
                )}
              </li>
            )}
            <li className="flex flex-wrap items-center gap-3 rounded-lg bg-surface px-3 py-2.5">
              <span className="flex-1 text-sm font-semibold">첫 회의 일정 등록하기</span>
              <MoreLink to={`${base}/calendar`}>일정에서 등록</MoreLink>
            </li>
            <li className="flex flex-wrap items-center gap-3 rounded-lg bg-surface px-3 py-2.5">
              <span className="flex-1 text-sm font-semibold">첫 태스크 추가하기</span>
              <MoreLink to={`${base}/kanban?new=1`}>칸반에서 추가</MoreLink>
            </li>
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {membersCard}
        <Card id="tm-progress" title="진행도" action={<MoreLink to={`${base}/kanban`}>칸반 보기</MoreLink>}>
          {data.progress.total === 0 ? (
            <p className="text-sm text-muted">아직 태스크가 없어요.</p>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold">완료</p>
                <p className="text-xl font-bold tabular-nums">{data.progress.completionRate}%</p>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-peri-100" role="progressbar" aria-label="칸반 완료율" aria-valuenow={data.progress.completionRate} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${data.progress.completionRate}%` }} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                {TASK_STATUSES.map((status) => {
                  const emphasize = status === 'APPROVAL_PENDING' && pending > 0 && (access.isLeader || access.isManagerViewer);
                  return (
                    <div key={status} className={`rounded-lg px-3 py-2 ${emphasize ? 'bg-amber-50 text-warning' : 'bg-surface-low'}`}>
                      <dt className="text-xs font-semibold">{TASK_STATUS_LABEL[status]}</dt>
                      <dd className="text-lg font-bold tabular-nums">{data.progress.byStatus[status]}</dd>
                    </div>
                  );
                })}
              </dl>
              {pending > 0 && (access.isLeader || access.isManagerViewer) && (
                <div className="mt-3">
                  <MoreLink to={`${base}/kanban?filter=pending`}>승인 대기 {pending}건 처리</MoreLink>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {access.isMember && (
        <div className="grid gap-5 md:grid-cols-2">
          <Card id="tm-next" title="다음 일정" action={<MoreLink to={`${base}/calendar`}>일정 보기</MoreLink>}>
            {data.nextSchedule ? (
              <p className="flex items-start gap-2 text-[0.9375rem]">
                <CalendarDaysIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                <span>
                  <span className="block font-semibold">{data.nextSchedule.title}</span>
                  <span className="text-sm text-muted">
                    {formatWhen(data.nextSchedule.startAt)} · {SCHEDULE_TYPE_LABEL[data.nextSchedule.type]}
                  </span>
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted">예정된 일정이 없어요.</p>
            )}
          </Card>
          <Card id="tm-notice" title="최근 공지" action={<MoreLink to={`${base}/announcements`}>공지 보기</MoreLink>}>
            {data.latestAnnouncement ? (
              <p className="flex items-start gap-2 text-[0.9375rem]">
                <MegaphoneIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                <span>
                  <span className="block font-semibold">{data.latestAnnouncement.title}</span>
                  <span className="text-sm text-muted">{relativeTime(data.latestAnnouncement.createdAt)}</span>
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted">등록된 공지가 없어요.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
