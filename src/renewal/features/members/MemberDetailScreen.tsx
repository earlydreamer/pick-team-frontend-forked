import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon, ChatBubbleLeftRightIcon, ClockIcon, CalendarDaysIcon, LockClosedIcon, PaperAirplaneIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import {
  TIME_SLOT_LABEL,
  WEEKLY_HOURS_LABEL,
  WORKSTYLE_LABEL,
  isHttpUrl,
  type GoalTemperature,
} from '@/renewal/domain/card';
import { Avatar, Badge, Button, EmptyState, ErrorState, LoadingState, buttonClassName, toast } from '@/renewal/ui';
import { DataError } from '@/renewal/data';
import { useBoard, useInbox, useMe, useMember, useOpenDm, useScout } from '@/renewal/data/queries';
import { NotFoundScreen } from '@/renewal/screens/system';
import { CardRequiredModal, ProposalModal, useActionErrorHandler } from '@/renewal/features/teamBuilding/shared';
import { RoleBadges } from './MemberCardTile';

const temperatureText = (value: GoalTemperature) => (value <= 2 ? '완주 지향에 가까움' : value >= 4 ? '수상 지향에 가까움' : '중간');

const Block: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="border-t border-outline-soft py-5">
    <h2 className="mb-2 text-sm font-semibold text-muted">{title}</h2>
    {children}
  </section>
);

/**
 * SCR-PRF-01 카드 상세(11 §4.5). 워크스페이스에 속하지 않은 사람에게는 404로 존재를 숨기고,
 * 비공개·미작성 카드는 이름만 보이고 안내를 띄운다(11 §5.3).
 * 모집 중인 세션에서 빈자리가 있는 팀의 팀장은 팀이 없는 공개 카드 멤버에게 스카우트를 보낼 수 있다(12-D1).
 */
export const MemberDetailScreen: React.FC = () => {
  const { wsId = '', accountId = '' } = useParams<{ wsId: string; accountId: string }>();
  const me = useMe();
  const member = useMember(wsId, accountId);
  const board = useBoard(wsId);
  const leading = Boolean(board.data?.me.isLeader && board.data.session.status === 'OPEN');
  const inbox = useInbox(leading ? wsId : '');
  const scout = useScout(wsId);
  const openDm = useOpenDm(wsId);
  const navigate = useNavigate();
  const errors = useActionErrorHandler();
  const [scouting, setScouting] = useState(false);
  const back = `/ws/${wsId}/members`;

  if (member.isLoading) return <LoadingState className="min-h-[60vh]" label="카드를 불러오는 중이에요" />;
  if (member.error instanceof DataError && member.error.code === 'NOT_FOUND') return <NotFoundScreen />;
  if (member.isError || !member.data) {
    return (
      <ErrorState
        className="min-h-[60vh]"
        title="카드를 불러오지 못했어요"
        description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
        action={<Button onClick={() => member.refetch()}>다시 시도</Button>}
      />
    );
  }

  const { account, card, cardState } = member.data;
  const isMe = account.id === me.data?.id;
  const portfolioHref = card.portfolio && isHttpUrl(card.portfolio) ? card.portfolio : undefined;
  const myTeam = board.data?.teams.find((summary) => summary.team.id === board.data?.me.teamId);
  const scoutable = leading && !isMe && member.data.role === 'MEMBER' && !member.data.teamId && cardState === 'PUBLIC' && (myTeam?.openSeats ?? 0) > 0;
  const scoutSent = inbox.data?.sent.some((view) => view.application.direction === 'SCOUT' && view.application.applicantId === account.id && view.application.status === 'PENDING');

  const submitScout = async (message: string) => {
    try {
      await scout.mutateAsync({ accountId: account.id, message });
      toast.success(`${account.name}님에게 스카우트를 보냈어요. 진행 상황은 제안함에서 볼 수 있어요.`);
    } catch (error) {
      errors.handle(error);
    } finally {
      setScouting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
      <Link to={back} className="mb-4 inline-flex min-h-touch items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
        멤버 카드
      </Link>

      <article className="rounded-modal border border-outline-soft bg-surface p-6 sm:p-8">
        <header className="flex flex-wrap items-center gap-5">
          <Avatar name={account.name} imageUrl={account.profileImageUrl} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold leading-8">{account.name}</h1>
              {cardState === 'PUBLIC' && card.mbti && <Badge tone="neutral">{card.mbti}</Badge>}
            </div>
            {cardState === 'PUBLIC' && (
              <div className="mt-2 flex">
                <RoleBadges member={member.data} size="md" />
              </div>
            )}
          </div>
          {isMe && (
            <Link to="/me/card" className={buttonClassName('outline')}>
              <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
              편집
            </Link>
          )}
          {/* DM 시작(15 US-15-01): 이미 있으면 그 방으로, 없으면 새로 만든다. */}
          {!isMe && (
            <Button
              variant="outline"
              leftIcon={<ChatBubbleLeftRightIcon className="h-5 w-5" />}
              loading={openDm.isPending}
              onClick={async () => {
                try {
                  const result = await openDm.mutateAsync(account.id);
                  navigate(`/ws/${wsId}/chat/${result.roomId}`);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'DM을 열지 못했어요.');
                }
              }}
            >
              DM 보내기
            </Button>
          )}
          {scoutable &&
            (scoutSent ? (
              <Badge tone="warning">스카우트 답변 대기</Badge>
            ) : (
              <Button leftIcon={<PaperAirplaneIcon className="h-5 w-5" />} onClick={() => setScouting(true)}>
                스카우트 제안
              </Button>
            ))}
        </header>

        {cardState !== 'PUBLIC' && !isMe ? (
          <EmptyState
            compact
            className="mt-6 rounded-card bg-surface-low"
            icon={<LockClosedIcon className="h-5 w-5" />}
            title={cardState === 'PRIVATE' ? '이 멤버의 카드는 비공개 상태예요' : '아직 PR 카드를 작성하지 않았어요'}
          />
        ) : (
          <div className="mt-6">
            <Block title="가용성">
              <ul className="space-y-1.5 text-[0.9375rem]">
                {card.weeklyAvailableHours && (
                  <li className="flex items-center gap-2">
                    <ClockIcon className="h-5 w-5 text-muted" aria-hidden="true" />
                    주간 가용 {WEEKLY_HOURS_LABEL[card.weeklyAvailableHours]}
                  </li>
                )}
                {card.availableTimeSlots.length > 0 && (
                  <li className="flex items-center gap-2">
                    <CalendarDaysIcon className="h-5 w-5 text-muted" aria-hidden="true" />
                    선호 시간대: {card.availableTimeSlots.map((slot) => TIME_SLOT_LABEL[slot]).join(', ')}
                  </li>
                )}
              </ul>
            </Block>

            {card.goalTemperature !== undefined && (
              <Block title="목표 온도">
                <p className="flex items-center gap-3 text-[0.9375rem]">
                  <span className="flex gap-1" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((step) => (
                      <span key={step} className={`h-3 w-3 rounded-full ${step <= card.goalTemperature! ? 'bg-primary' : 'bg-surface-container'}`} />
                    ))}
                  </span>
                  <span>
                    {temperatureText(card.goalTemperature)} <span className="text-muted tabular-nums">({card.goalTemperature}/5)</span>
                  </span>
                </p>
              </Block>
            )}

            {card.hashtags.length > 0 && (
              <Block title="기술 스택·강점">
                <ul className="flex flex-wrap gap-1.5">
                  {card.hashtags.map((tag) => (
                    <li key={tag}>
                      <Badge tone="neutral">{tag}</Badge>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            {(card.preferWorkstyleOptions.length > 0 || card.dislikeWorkstyleOptions.length > 0 || card.workstyleText) && (
              <Block title="협업 스타일">
                <dl className="space-y-1.5 text-[0.9375rem]">
                  {card.preferWorkstyleOptions.length > 0 && (
                    <div className="flex gap-2">
                      <dt className="w-10 shrink-0 text-muted">선호</dt>
                      <dd>{card.preferWorkstyleOptions.map((style) => WORKSTYLE_LABEL[style]).join(', ')}</dd>
                    </div>
                  )}
                  {card.dislikeWorkstyleOptions.length > 0 && (
                    <div className="flex gap-2">
                      <dt className="w-10 shrink-0 text-muted">피함</dt>
                      <dd>{card.dislikeWorkstyleOptions.map((style) => WORKSTYLE_LABEL[style]).join(', ')}</dd>
                    </div>
                  )}
                </dl>
                {card.workstyleText && <p className="mt-3 whitespace-pre-line rounded-lg bg-surface-low px-4 py-3 text-[0.9375rem] leading-6">{card.workstyleText}</p>}
              </Block>
            )}

            {card.introduction && (
              <Block title="자기소개">
                <p className="whitespace-pre-line text-[0.9375rem] leading-6">{card.introduction}</p>
              </Block>
            )}

            {card.portfolio && (
              <Block title="포트폴리오">
                {portfolioHref ? (
                  <a href={portfolioHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all font-medium text-primary underline underline-offset-4">
                    {card.portfolio.replace(/^https?:\/\//, '')}
                    <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="sr-only">(새 창)</span>
                  </a>
                ) : (
                  <p>{card.portfolio}</p>
                )}
              </Block>
            )}

            {isMe && cardState !== 'PUBLIC' && (
              <p className="mt-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-warning">
                {cardState === 'PRIVATE' ? '내 카드는 비공개라 다른 멤버에게는 이름만 보여요.' : '카드를 공개하기 전이라 다른 멤버에게는 이름만 보여요.'}
              </p>
            )}
          </div>
        )}
      </article>

      <ProposalModal
        open={scouting}
        title={`${account.name}님에게 스카우트`}
        description={`${myTeam?.team.name ?? '내 팀'}에서 제안해요. 상대가 수락하면 바로 팀에 합류해요.`}
        submitLabel="스카우트 보내기"
        pending={scout.isPending}
        onClose={() => setScouting(false)}
        onSubmit={submitScout}
      />
      <CardRequiredModal open={errors.cardRequired !== null} workspaceId={wsId} message={errors.cardRequired ?? undefined} onClose={errors.clearCardRequired} />
    </div>
  );
};
