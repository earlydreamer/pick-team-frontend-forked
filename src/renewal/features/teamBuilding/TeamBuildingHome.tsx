import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRightIcon, ClockIcon, PlusIcon, SparklesIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { dDayLabel, type TeamSummary } from '@/renewal/domain/teamBuilding';
import { roleText } from '@/renewal/domain/card';
import { DataError } from '@/renewal/data';
import { useApply, useBoard, useCreateTeam, useRecommendations, useScout, useWorkspace } from '@/renewal/data/queries';
import { Avatar, Badge, Button, EmptyState, ErrorState, LoadingState, Skeleton, buttonClassName, toast } from '@/renewal/ui';
import { NotFoundScreen } from '@/renewal/screens/system';
import { CreateTeamModal } from './CreateTeamModal';
import { ApplicationStatusBadge, CardRequiredModal, FitReasons, GoalTag, ProposalModal, RecruitRoleChips, Stars, useActionErrorHandler } from './shared';

type Proposal = { kind: 'apply'; teamId: string; teamName: string } | { kind: 'scout'; accountId: string; name: string } | null;

/**
 * SCR-TB-01 팀 빌딩 홈(12 §4.1, 목업 team-building-session.html).
 * 세션 상태에 따라 같은 주소가 다른 화면을 보여 준다(12 §5.1).
 * 상단 상태 바는 내 소속, 제안 현황, 마감까지 남은 날을 한 줄로 보여 주고 이 화면의 모든 분기 기준이 된다.
 */
export const TeamBuildingHome: React.FC = () => {
  const { wsId = '' } = useParams<{ wsId: string }>();
  const navigate = useNavigate();
  const workspace = useWorkspace(wsId);
  const board = useBoard(wsId);
  const canRecommend = Boolean(board.data?.me.isParticipant && board.data.me.cardPublic && board.data.session.status === 'OPEN');
  const recommendations = useRecommendations(wsId, canRecommend);
  const apply = useApply(wsId);
  const scout = useScout(wsId);
  const createTeam = useCreateTeam(wsId);
  const errors = useActionErrorHandler();
  const [proposal, setProposal] = useState<Proposal>(null);
  const [creating, setCreating] = useState(false);

  if (board.isLoading) return <LoadingState className="min-h-[60vh]" label="팀 빌딩을 불러오는 중이에요" />;
  if (board.error instanceof DataError && board.error.code === 'NOT_FOUND') {
    // 세션이 없으면 매니저에게는 세션 만들기를 안내하고, 멤버에게는 안내만 한다(12 §5.4-8).
    if (!workspace.data) return <NotFoundScreen />;
    const manager = workspace.data.myRole !== 'MEMBER';
    return (
      <EmptyState
        className="min-h-[60vh]"
        icon={<UserGroupIcon className="h-7 w-7" />}
        title="진행 중인 팀 빌딩이 없어요"
        description={manager ? '세션을 만들면 멤버들이 팀을 찾고 만들 수 있어요.' : '강사가 팀 빌딩을 열면 여기에서 팀을 찾을 수 있어요.'}
        action={
          manager ? (
            <Link to={`/ws/${wsId}/team-building/manage`} className={buttonClassName('primary')}>
              세션 운영으로 이동
            </Link>
          ) : undefined
        }
      />
    );
  }
  if (board.isError || !board.data) {
    return (
      <ErrorState
        className="min-h-[60vh]"
        title="팀 빌딩을 불러오지 못했어요"
        description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
        action={<Button onClick={() => board.refetch()}>다시 시도</Button>}
      />
    );
  }

  const { session, me, teams } = board.data;
  const base = `/ws/${wsId}/team-building`;
  const open = session.status === 'OPEN';
  const myTeam = teams.find((summary) => summary.team.id === me.teamId);

  if (session.status === 'DRAFT' && me.isParticipant) {
    return (
      <EmptyState
        className="min-h-[60vh]"
        icon={<ClockIcon className="h-7 w-7" />}
        title="팀 빌딩을 준비하고 있어요"
        description="강사가 모집을 시작하면 알려 드릴게요. 그 전에 PR 카드를 채워 두면 추천을 바로 받을 수 있어요."
        action={
          <Link to="/me/card" className={buttonClassName('outline')}>
            내 PR 카드 보기
          </Link>
        }
      />
    );
  }

  const startApply = (summary: TeamSummary) => {
    if (!me.cardPublic) {
      errors.handle(new DataError('지원하려면 먼저 PR 카드를 만들어 공개해 주세요.', 'CARD_REQUIRED'));
      return;
    }
    setProposal({ kind: 'apply', teamId: summary.team.id, teamName: summary.team.name });
  };

  const submitProposal = async (message: string) => {
    if (!proposal) return;
    try {
      if (proposal.kind === 'apply') {
        await apply.mutateAsync({ teamId: proposal.teamId, message });
        toast.success(`${proposal.teamName}에 지원했어요. 진행 상황은 제안함에서 볼 수 있어요.`);
      } else {
        await scout.mutateAsync({ accountId: proposal.accountId, message });
        toast.success(`${proposal.name}님에게 스카우트를 보냈어요.`);
      }
      setProposal(null);
    } catch (error) {
      setProposal(null);
      errors.handle(error);
    }
  };

  const submitTeam = async (input: Parameters<typeof createTeam.mutateAsync>[0]) => {
    try {
      const result = await createTeam.mutateAsync(input);
      setCreating(false);
      toast.success(`${input.name} 모집을 시작했어요.`);
      navigate(`${base}/teams/${result.teamId}`);
    } catch (error) {
      setCreating(false);
      errors.handle(error);
    }
  };

  const teamAction = (summary: TeamSummary) => {
    if (summary.team.id === me.teamId) return <Badge tone="primary">내 팀</Badge>;
    if (summary.myApplicationStatus === 'PENDING') return <ApplicationStatusBadge status="PENDING" />;
    if (summary.openSeats === 0) return <Badge tone="neutral">정원 마감</Badge>;
    if (!open || !me.isParticipant || me.teamId) return null;
    return (
      <Button size="sm" onClick={() => startApply(summary)}>
        지원
      </Button>
    );
  };

  return (
    <div className="pb-12">
      <section aria-labelledby="tb-heading" className="bg-peri-900 px-4 py-6 text-white sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 id="tb-heading" className="text-xl font-bold leading-7 sm:text-2xl">
              팀 빌딩{workspace.data ? ` · ${workspace.data.name}` : ''}
            </h1>
            {me.isParticipant ? (
              <ul className="mt-2 flex flex-wrap items-center gap-2 text-sm" aria-label="내 상태">
                <li className="rounded-full bg-white/15 px-2.5 py-0.5 font-semibold">{myTeam ? myTeam.team.name : '팀 없음'}</li>
                <li className="rounded-full bg-white/15 px-2.5 py-0.5 tabular-nums">보낸 제안 {me.sentPending}건</li>
                <li className="rounded-full bg-white/15 px-2.5 py-0.5 tabular-nums">받은 제안 {me.receivedPending}건</li>
                <li>
                  <Link to={`${base}/inbox`} className="inline-flex min-h-touch items-center gap-1 font-semibold text-peri-100 underline-offset-4 hover:underline">
                    제안함
                    <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </li>
              </ul>
            ) : (
              <p className="mt-2 text-sm text-peri-100">
                개설자와 매니저는 지원·스카우트의 당사자가 아니에요.{' '}
                <Link to={`${base}/manage`} className="font-semibold text-white underline underline-offset-4">
                  세션 운영
                </Link>
                에서 현황을 관리해요.
              </p>
            )}
          </div>
          <p className="text-lg font-bold tabular-nums">
            {open ? (
              <>
                마감까지 {dDayLabel(session.closesAt)}
              </>
            ) : session.status === 'CLOSING' ? (
              '강사가 배정 중'
            ) : session.status === 'RESOLVED' ? (
              '팀 빌딩 완료'
            ) : (
              '준비 중'
            )}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        {session.status === 'CLOSING' && (
          <p role="status" className="mt-6 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-warning">
            모집이 끝나 새 지원과 스카우트를 받지 않아요. 강사가 남은 멤버를 팀에 배정하고 있어요.
          </p>
        )}
        {session.status === 'RESOLVED' && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-outline-soft bg-surface px-4 py-3 text-sm">
            <p>{myTeam ? `팀 빌딩이 끝났어요. ${myTeam.team.name}에서 협업을 시작해 보세요.` : '팀 빌딩이 끝났어요.'}</p>
            {myTeam && (
              <Link to={`/ws/${wsId}/team/${myTeam.team.id}`} className={buttonClassName('primary', 'sm')}>
                팀 스페이스로 이동
              </Link>
            )}
          </div>
        )}

        {me.isParticipant && open && (
          <section aria-labelledby="tb-recommend" className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="tb-recommend" className="flex items-center gap-1.5 text-lg font-bold">
                <SparklesIcon className="h-5 w-5 text-primary" aria-hidden="true" />
                추천
              </h2>
              <Link to={`/ws/${wsId}/members`} className="inline-flex min-h-touch items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline">
                멤버 카드
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {!me.cardPublic ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-dashed border-outline-soft bg-surface px-4 py-4 text-sm">
                <p>PR 카드를 공개하면 나와 맞는 팀과 사람을 사유와 함께 추천받을 수 있어요.</p>
                <Link to={`/ws/${wsId}/onboarding`} className={buttonClassName('primary', 'sm')}>
                  카드 만들기
                </Link>
              </div>
            ) : recommendations.isLoading ? (
              <div className="grid gap-3 md:grid-cols-3">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-44 rounded-card" />
                ))}
              </div>
            ) : recommendations.isError ? (
              <ErrorState
                compact
                title="추천을 불러오지 못했어요"
                action={
                  <Button size="sm" variant="outline" onClick={() => recommendations.refetch()}>
                    다시 시도
                  </Button>
                }
              />
            ) : !recommendations.data?.length ? (
              <p className="rounded-card border border-dashed border-outline-soft bg-surface px-4 py-4 text-sm text-muted">
                지금은 조건이 맞는 추천이 없어요. 카드에 선호 시간대와 협업 스타일을 채우면 추천이 늘어나요.
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-3">
                {recommendations.data.map((item) =>
                  item.kind === 'TEAM' ? (
                    <li key={item.summary.team.id} className="flex flex-col gap-3 rounded-card border border-outline-soft bg-surface p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-muted">팀 추천</p>
                          <p className="mt-0.5 truncate text-base font-bold">{item.summary.team.name}</p>
                          <p className="text-sm text-muted tabular-nums">{item.summary.openSeats}자리 모집 중</p>
                        </div>
                        <Stars value={item.fit.stars} />
                      </div>
                      <FitReasons fit={item.fit} compact />
                      <div className="mt-auto grid grid-cols-2 gap-2">
                        <Link to={`${base}/teams/${item.summary.team.id}`} className={buttonClassName('outline', 'sm')}>
                          상세
                        </Link>
                        {item.summary.myApplicationStatus === 'PENDING' ? (
                          <span className="inline-flex items-center justify-center">
                            <ApplicationStatusBadge status="PENDING" />
                          </span>
                        ) : (
                          <Button size="sm" onClick={() => startApply(item.summary)}>
                            지원
                          </Button>
                        )}
                      </div>
                    </li>
                  ) : (
                    <li key={item.member.account.id} className="flex flex-col gap-3 rounded-card border border-outline-soft bg-surface p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={item.member.account.name} imageUrl={item.member.account.profileImageUrl} size="md" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-muted">멤버 추천</p>
                            <p className="truncate font-bold">{item.member.account.name}</p>
                            <p className="text-sm text-muted">{roleText(item.member.card, item.member.card.desiredRole1)} 희망</p>
                          </div>
                        </div>
                        <Stars value={item.fit.stars} />
                      </div>
                      <FitReasons fit={item.fit} compact />
                      <div className="mt-auto grid grid-cols-2 gap-2">
                        <Link to={`/ws/${wsId}/members/${item.member.account.id}`} className={buttonClassName('outline', 'sm')}>
                          카드 보기
                        </Link>
                        {item.canScout ? (
                          <Button size="sm" onClick={() => setProposal({ kind: 'scout', accountId: item.member.account.id, name: item.member.account.name })}>
                            스카우트
                          </Button>
                        ) : (
                          <span className="inline-flex items-center justify-center text-center text-xs text-muted">스카우트는 팀장만 보낼 수 있어요</span>
                        )}
                      </div>
                    </li>
                  ),
                )}
              </ul>
            )}
          </section>
        )}

        <section aria-labelledby="tb-teams" className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="tb-teams" className="text-lg font-bold">
              {open ? '모집 중인 팀' : '팀 목록'} <span className="text-base font-semibold text-muted tabular-nums">{teams.length}</span>
            </h2>
            {open && me.isParticipant && !me.teamId && (
              <Button variant="outline" leftIcon={<PlusIcon className="h-5 w-5" />} onClick={() => (me.cardPublic ? setCreating(true) : errors.handle(new DataError('팀을 만들려면 먼저 PR 카드를 만들어 공개해 주세요.', 'CARD_REQUIRED')))}>
                팀 만들기
              </Button>
            )}
          </div>
          {teams.length === 0 ? (
            <div className="rounded-card border border-dashed border-outline-soft bg-surface">
              <EmptyState compact icon={<UserGroupIcon className="h-5 w-5" />} title="아직 만들어진 팀이 없어요" description={open && me.isParticipant ? '첫 팀을 만들고 함께할 사람을 모아 보세요.' : undefined} />
            </div>
          ) : (
            <ul className="space-y-2.5">
              {teams.map((summary) => (
                <li key={summary.team.id} className="flex flex-wrap items-center gap-3 rounded-card border border-outline-soft bg-surface px-4 py-3">
                  <Avatar name={summary.team.name} size="md" shape="rounded" />
                  <div className="min-w-0 flex-1">
                    <Link to={`${base}/teams/${summary.team.id}`} className="font-bold text-ink underline-offset-4 hover:underline">
                      {summary.team.name}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-sm text-muted tabular-nums">
                        {summary.team.memberIds.length}/{summary.capacity}명
                      </span>
                      {summary.openSeats > 0 && <RecruitRoleChips roles={summary.team.recruitRoles} />}
                      <GoalTag value={summary.team.goalTemperature} />
                    </p>
                  </div>
                  <div className="shrink-0">{teamAction(summary)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ProposalModal
        open={proposal !== null}
        title={proposal?.kind === 'scout' ? `${proposal.name}님에게 스카우트` : `${proposal?.kind === 'apply' ? proposal.teamName : ''}에 지원`}
        description={proposal?.kind === 'scout' ? '상대가 수락하면 바로 팀에 합류해요.' : '팀장이 수락하면 바로 팀에 합류하고, 답변을 기다리는 다른 지원은 자동 철회돼요.'}
        submitLabel={proposal?.kind === 'scout' ? '스카우트 보내기' : '지원하기'}
        pending={apply.isPending || scout.isPending}
        onClose={() => setProposal(null)}
        onSubmit={submitProposal}
      />
      <CreateTeamModal open={creating} capacity={session.teamCapacity} pending={createTeam.isPending} onClose={() => setCreating(false)} onSubmit={submitTeam} />
      <CardRequiredModal open={errors.cardRequired !== null} workspaceId={wsId} message={errors.cardRequired ?? undefined} onClose={errors.clearCardRequired} />
    </div>
  );
};
