import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, InboxIcon, StarIcon } from '@heroicons/react/24/outline';
import { ROLE_LABEL, TIME_SLOTS, TIME_SLOT_LABEL } from '@/renewal/domain/card';
import type { TeamDetail } from '@/renewal/domain/teamBuilding';
import { DataError } from '@/renewal/data';
import { useApply, useBoard, useInbox, useMe, useTeamDetail } from '@/renewal/data/queries';
import { Avatar, Badge, Button, EmptyState, ErrorState, LoadingState, toast } from '@/renewal/ui';
import { NotFoundScreen } from '@/renewal/screens/system';
import { RoleBadges } from '@/renewal/features/members/MemberCardTile';
import { ProposalItem } from './ProposalItem';
import { ApplicationStatusBadge, CardRequiredModal, FitReasons, GoalTag, ProposalModal, Stars, temperatureLabel, useActionErrorHandler } from './shared';
import { useProposalActions } from './useProposalActions';

const Panel: React.FC<{ title: string; titleId: string; children: React.ReactNode; aside?: React.ReactNode }> = ({ title, titleId, children, aside }) => (
  <section aria-labelledby={titleId} className="rounded-card border border-outline-soft bg-surface p-5">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 id={titleId} className="text-base font-bold">
        {title}
      </h2>
      {aside}
    </div>
    {children}
  </section>
);

/** 팀 단위 집계만 보여 준다(12-D6). 개인 가용 시간이나 온도는 노출하지 않는다. */
const AggregateList: React.FC<{ detail: TeamDetail }> = ({ detail }) => {
  const slots = TIME_SLOTS.filter((slot) => detail.aggregate.commonTimeSlots.includes(slot));
  const temperature = detail.aggregate.averageTemperature;
  return (
    <dl className="mt-4 space-y-1.5 border-t border-outline-soft pt-4 text-sm">
      <div className="flex gap-2">
        <dt className="w-24 shrink-0 text-muted">공통 가용 시간</dt>
        <dd>{slots.length ? slots.map((slot) => TIME_SLOT_LABEL[slot]).join(' · ') : '아직 겹치는 시간대가 없어요'}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="w-24 shrink-0 text-muted">팀 목표 온도</dt>
        <dd>{temperature === undefined ? '아직 정보가 없어요' : `${temperatureLabel(temperature)} (평균 ${temperature}/5)`}</dd>
      </div>
    </dl>
  );
};

/**
 * SCR-TB-02 팀 모집 상세(12 §4.2). 팀원 카드 요약과 팀 단위 집계를 지원 판단 재료로 보여 준다.
 * 팀장에게는 오른쪽 패널이 받은 지원 관리로 바뀐다.
 */
export const TeamRecruitDetail: React.FC = () => {
  const { wsId = '', teamId = '' } = useParams<{ wsId: string; teamId: string }>();
  const me = useMe();
  const board = useBoard(wsId);
  const detail = useTeamDetail(wsId, teamId);
  const isLeader = Boolean(detail.data && detail.data.team.leaderId === me.data?.id);
  const inbox = useInbox(isLeader ? wsId : '');
  const apply = useApply(wsId);
  const errors = useActionErrorHandler();
  const actions = useProposalActions(wsId, errors.handle);
  const [applying, setApplying] = useState(false);
  const base = `/ws/${wsId}/team-building`;

  if (detail.isLoading || board.isLoading) return <LoadingState className="min-h-[60vh]" label="팀 정보를 불러오는 중이에요" />;
  if (detail.error instanceof DataError && detail.error.code === 'NOT_FOUND') return <NotFoundScreen />;
  if (detail.isError || board.isError || !detail.data || !board.data) {
    return (
      <ErrorState
        className="min-h-[60vh]"
        title="팀 정보를 불러오지 못했어요"
        description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
        action={
          <Button
            onClick={() => {
              detail.refetch();
              board.refetch();
            }}
          >
            다시 시도
          </Button>
        }
      />
    );
  }

  const team = detail.data;
  const { session, me: status } = board.data;
  const open = session.status === 'OPEN';
  const isMine = status.teamId === team.team.id;
  const pendingApplies = team.receivedApplications?.filter((view) => view.application.status === 'PENDING').length ?? 0;

  const startApply = () => {
    if (!status.cardPublic) {
      errors.handle(new DataError('지원하려면 먼저 PR 카드를 만들어 공개해 주세요.', 'CARD_REQUIRED'));
      return;
    }
    setApplying(true);
  };

  const submitApply = async (message: string) => {
    try {
      await apply.mutateAsync({ teamId: team.team.id, message });
      toast.success(`${team.team.name}에 지원했어요. 진행 상황은 제안함에서 볼 수 있어요.`);
    } catch (error) {
      errors.handle(error);
    } finally {
      setApplying(false);
    }
  };

  const headerAction = () => {
    if (isMine) return <Badge tone="primary">{isLeader ? '내 팀 · 팀장' : '내 팀'}</Badge>;
    if (team.myApplicationStatus === 'PENDING') return <ApplicationStatusBadge status="PENDING" />;
    if (team.openSeats === 0) return <Badge tone="neutral">정원 마감</Badge>;
    if (!open || !status.isParticipant || status.teamId) return null;
    return <Button onClick={startApply}>지원하기</Button>;
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <Link to={base} className="mb-4 inline-flex min-h-touch items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
        팀 빌딩
      </Link>

      <header className="flex flex-wrap items-start gap-4 rounded-modal border border-outline-soft bg-surface p-5 sm:p-6">
        <Avatar name={team.team.name} size="lg" shape="rounded" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold leading-8">{team.team.name}</h1>
            <span className="text-sm text-muted tabular-nums">
              {team.team.memberIds.length}/{team.capacity}명 · {team.openSeats > 0 && open ? '모집 중' : team.openSeats > 0 ? '모집 종료' : '정원 마감'}
            </span>
          </div>
          {team.team.intro && <p className="mt-1 text-[0.9375rem] leading-6">“{team.team.intro}”</p>}
          <div className="mt-1.5">
            <GoalTag value={team.team.goalTemperature} />
          </div>
        </div>
        <div className="flex w-full justify-end sm:w-auto sm:self-center">{headerAction()}</div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel title="현재 팀원" titleId="team-members">
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {team.members.map((member) => {
              const leader = member.account.id === team.team.leaderId;
              const hidden = member.cardState !== 'PUBLIC';
              return (
                <li key={member.account.id}>
                  <Link
                    to={`/ws/${wsId}/members/${member.account.id}`}
                    className="flex items-center gap-3 rounded-card border border-outline-soft px-3 py-2.5 hover:border-peri-300 hover:bg-peri-50"
                  >
                    <Avatar name={member.account.name} imageUrl={member.account.profileImageUrl} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span className="truncate">{member.account.name}</span>
                        {leader && <span className="shrink-0 text-xs font-semibold text-primary">팀장</span>}
                      </span>
                      {hidden ? (
                        <span className="block text-xs text-muted">{member.cardState === 'PRIVATE' ? '카드 비공개' : '카드 미작성'}</span>
                      ) : (
                        <span className="mt-0.5 flex">
                          <RoleBadges member={member} />
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <AggregateList detail={team} />
        </Panel>

        {isLeader ? (
          <Panel
            title="받은 지원"
            titleId="team-received"
            aside={
              <Link to={`${base}/inbox`} className="inline-flex min-h-touch items-center text-sm font-semibold text-primary underline-offset-4 hover:underline">
                제안함
              </Link>
            }
          >
            {team.receivedApplications && team.receivedApplications.length > 0 ? (
              <>
                <p className="mb-2 text-sm text-muted tabular-nums">답변 대기 {pendingApplies}건</p>
                <ul className="-mx-5 divide-y divide-outline-soft border-y border-outline-soft">
                  {[...team.receivedApplications]
                    .sort((a, b) => Number(b.application.status === 'PENDING') - Number(a.application.status === 'PENDING'))
                    .map((view) => (
                      <ProposalItem
                        key={view.application.id}
                        view={view}
                        box="received"
                        myId={me.data?.id}
                        workspaceId={wsId}
                        actionable={open && Boolean(inbox.data)}
                        busy={actions.busyId === view.application.id}
                        onAccept={() => inbox.data && actions.requestAccept(view, inbox.data, team.openSeats)}
                        onDecline={() => actions.decline(view)}
                        onWithdraw={() => undefined}
                      />
                    ))}
                </ul>
              </>
            ) : (
              <EmptyState compact icon={<InboxIcon className="h-5 w-5" />} title="아직 받은 지원이 없어요" description={open ? '추천 멤버에게 먼저 스카우트를 보내 보세요.' : undefined} />
            )}
          </Panel>
        ) : (
          <div className="space-y-5">
            <Panel title="모집 중인 역할" titleId="team-recruit">
              {team.openSeats === 0 || team.team.recruitRoles.length === 0 ? (
                <p className="text-sm text-muted">{team.openSeats === 0 ? '정원이 모두 찼어요.' : '역할을 정하지 않고 모집하고 있어요.'}</p>
              ) : (
                <>
                  <ul className="space-y-1.5">
                    {team.team.recruitRoles.map((recruit) => (
                      <li key={recruit.role} className="flex items-center justify-between text-[0.9375rem]">
                        <span>{ROLE_LABEL[recruit.role]}</span>
                        <span className="font-semibold tabular-nums">{recruit.count}명</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm text-muted tabular-nums">
                    빈자리 {team.openSeats}명 · 답변 대기 중인 지원 {team.pendingApplies}건
                  </p>
                </>
              )}
            </Panel>
            {team.fit && (
              <Panel title="나와의 적합도" titleId="team-fit" aside={<Stars value={team.fit.stars} />}>
                <FitReasons fit={team.fit} compact />
              </Panel>
            )}
            {!team.fit && status.isParticipant && !status.teamId && !status.cardPublic && (
              <p className="flex items-start gap-2 rounded-card border border-dashed border-outline-soft bg-surface px-4 py-3 text-sm">
                <StarIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                PR 카드를 공개하면 이 팀과 나의 적합도를 사유와 함께 볼 수 있어요.
              </p>
            )}
          </div>
        )}
      </div>

      <ProposalModal
        open={applying}
        title={`${team.team.name}에 지원`}
        description="팀장이 수락하면 바로 팀에 합류하고, 답변을 기다리는 다른 지원은 자동 철회돼요."
        submitLabel="지원하기"
        pending={apply.isPending}
        onClose={() => setApplying(false)}
        onSubmit={submitApply}
      />
      {actions.modal}
      <CardRequiredModal open={errors.cardRequired !== null} workspaceId={wsId} message={errors.cardRequired ?? undefined} onClose={errors.clearCardRequired} />
    </div>
  );
};
