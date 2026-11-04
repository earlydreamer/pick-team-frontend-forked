import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRightIcon, IdentificationIcon, MegaphoneIcon, UserGroupIcon, UsersIcon } from '@heroicons/react/24/outline';
import { cardStatus } from '@/renewal/domain/card';
import { dDayLabel, formatDeadline } from '@/renewal/domain/teamBuilding';
import { relativeTime } from '@/renewal/domain/announcement';
import { Avatar, Badge, Button, EmptyState, ErrorState, LoadingState, Skeleton, buttonClassName } from '@/renewal/ui';
import { useMe, useMembers, useMyCard, useRecentAnnouncements, useSession, useTeams, useWorkspace } from '@/renewal/data/queries';
import { MemberCardTile } from '@/renewal/features/members/MemberCardTile';


const SummaryCard: React.FC<{ label: string; tone?: 'default' | 'accent' | 'warning'; children: React.ReactNode; labelledBy: string }> = ({
  label,
  tone = 'default',
  children,
  labelledBy,
}) => {
  const tones = {
    default: 'border-outline-soft bg-surface',
    accent: 'border-primary bg-surface ring-1 ring-primary',
    warning: 'border-amber-200 bg-amber-50',
  };
  return (
    <section aria-labelledby={labelledBy} className={`flex flex-col rounded-modal border p-5 ${tones[tone]}`}>
      <p className={`text-xs font-semibold ${tone === 'warning' ? 'text-warning' : 'text-muted'}`}>{label}</p>
      {children}
    </section>
  );
};

/**
 * SCR-WS-01 워크스페이스 홈(02 §3.2, 01 §3, 목업 workspace-home.html).
 * 내 상태 요약(내 팀, 팀 빌딩, 카드 작성 유도), 최근 공지, 멤버 카드 미리보기 순서로 보여 준다.
 * 수집하지 않는 지표(칸반 완료율 등)는 해당 데이터를 연결하는 단계에서 추가한다.
 */
export const HomeScreen: React.FC = () => {
  const { wsId = '' } = useParams<{ wsId: string }>();
  const me = useMe();
  const workspace = useWorkspace(wsId);
  const members = useMembers(wsId);
  const myCard = useMyCard();
  const session = useSession(wsId);
  const teams = useTeams(wsId);
  const announcements = useRecentAnnouncements(wsId, 3);

  if (workspace.isLoading || me.isLoading) return <LoadingState className="min-h-[60vh]" label="워크스페이스를 여는 중이에요" />;
  if (workspace.isError || !workspace.data || !me.data) {
    return (
      <ErrorState
        className="min-h-[60vh]"
        title="워크스페이스를 열지 못했어요"
        description="소속된 워크스페이스인지 확인한 뒤 다시 시도해 주세요."
        action={<Button onClick={() => workspace.refetch()}>다시 시도</Button>}
      />
    );
  }

  const base = `/ws/${wsId}`;
  const myId = me.data.id;
  const myTeam = teams.data?.find((team) => team.memberIds.includes(myId));
  const myStatus = myCard.data ? cardStatus(myCard.data) : null;
  const allMembers = members.data ?? [];
  const publicCount = allMembers.filter((member) => member.cardState === 'PUBLIC').length;
  const writeRate = allMembers.length ? Math.round((publicCount / allMembers.length) * 100) : 0;
  const unassignedCount = allMembers.filter((member) => member.role === 'MEMBER' && !member.teamId).length;
  const preview = allMembers.filter((member) => member.cardState === 'PUBLIC' && member.account.id !== myId).slice(0, 4);
  const teamMembers = myTeam ? allMembers.filter((member) => myTeam.memberIds.includes(member.account.id)) : [];
  // 멤버에게는 DRAFT 세션을 보여 주지 않는다(12 §5.1).
  const visibleSession = session.data && session.data.status !== 'DRAFT' ? session.data : null;
  const showCardBanner = myStatus !== null && myStatus !== 'PUBLIC';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <header>
        <h1 className="text-2xl font-bold leading-8">안녕하세요, {me.data.name}님</h1>
        <p className="mt-0.5 text-sm text-muted">{workspace.data.name}</p>
      </header>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard label="내 팀" labelledBy="home-team">
          {teams.isLoading ? (
            <Skeleton className="mt-3 h-20" />
          ) : myTeam ? (
            <>
              <div className="mt-3 flex -space-x-2" aria-hidden="true">
                {teamMembers.slice(0, 5).map((member) => (
                  <Avatar key={member.account.id} name={member.account.name} imageUrl={member.account.profileImageUrl} size="sm" className="ring-2 ring-surface" />
                ))}
              </div>
              <h2 id="home-team" className="mt-3 text-lg font-bold">
                {myTeam.name}
              </h2>
              <p className="text-sm text-muted tabular-nums">
                팀원 {myTeam.memberIds.length}명{myTeam.leaderId === myId ? ' · 내가 팀장' : ''}
              </p>
              <div className="mt-auto pt-4">
                <Link to={`${base}/team/${myTeam.id}`} className={buttonClassName('outline', 'md', 'w-full')}>
                  팀 스페이스로 이동
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2 id="home-team" className="mt-3 text-lg font-bold">
                아직 소속된 팀이 없어요
              </h2>
              <p className="mt-1 text-sm text-muted">
                {visibleSession?.status === 'OPEN' ? '팀 빌딩에서 팀을 찾거나 만들 수 있어요.' : '팀 빌딩이 열리면 여기에서 팀을 찾을 수 있어요.'}
              </p>
            </>
          )}
        </SummaryCard>

        {visibleSession && (
          <SummaryCard label={visibleSession.status === 'OPEN' ? '팀 빌딩 진행 중' : visibleSession.status === 'CLOSING' ? '팀 빌딩 배정 중' : '팀 빌딩 완료'} tone={visibleSession.status === 'OPEN' ? 'accent' : 'default'} labelledBy="home-session">
            {visibleSession.status === 'OPEN' ? (
              <>
                <h2 id="home-session" className="mt-2 text-3xl font-bold text-primary tabular-nums">
                  {dDayLabel(visibleSession.closesAt)}
                  <span className="sr-only"> 마감까지</span>
                </h2>
                <p className="mt-1 text-sm leading-5 text-muted">
                  {formatDeadline(visibleSession.closesAt)}에 마감돼요.
                  {members.data && unassignedCount > 0 && (
                    <>
                      {' '}
                      아직 팀이 없는 멤버가 <strong className="font-semibold text-ink tabular-nums">{unassignedCount}명</strong> 있어요.
                    </>
                  )}
                </p>
                <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                  <Link to={`${base}/team-building`} className={buttonClassName('primary')}>
                    팀 빌딩 보기
                  </Link>
                  <Link to={`${base}/team-building/inbox`} className={buttonClassName('outline')}>
                    내 제안함
                  </Link>
                </div>
              </>
            ) : visibleSession.status === 'CLOSING' ? (
              <>
                <h2 id="home-session" className="mt-3 text-lg font-bold">
                  강사가 팀을 배정하고 있어요
                </h2>
                <p className="mt-1 text-sm text-muted">새 지원과 스카우트는 받지 않아요. 배정이 끝나면 내 팀이 여기에 보여요.</p>
              </>
            ) : (
              <>
                <h2 id="home-session" className="mt-3 text-lg font-bold">
                  팀 빌딩이 끝났어요
                </h2>
                <p className="mt-1 text-sm text-muted">{myTeam ? `${myTeam.name}에서 협업을 시작해 보세요.` : '배정 결과는 강사에게 문의해 주세요.'}</p>
              </>
            )}
          </SummaryCard>
        )}

        {showCardBanner && (
          <SummaryCard label="PR 카드" tone="warning" labelledBy="home-card">
            <IdentificationIcon className="mt-3 h-7 w-7 text-warning" aria-hidden="true" />
            <h2 id="home-card" className="mt-2 text-lg font-bold">
              {myStatus === 'PRIVATE' ? '내 카드가 비공개 상태예요' : '내 카드가 갤러리에 없어요'}
            </h2>
            <p className="mt-1 text-sm leading-5 text-ink">
              {myStatus === 'PRIVATE'
                ? '공개하면 팀원들이 나를 발견하고 스카우트를 제안할 수 있어요.'
                : '카드를 만들면 팀원들이 나를 발견하고 스카우트를 제안할 수 있어요.'}
            </p>
            {members.data && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted">
                  <span>워크스페이스 카드 공개율</span>
                  <span className="font-semibold text-ink tabular-nums">{writeRate}%</span>
                </div>
                <div
                  className="mt-1 h-2 overflow-hidden rounded-full bg-amber-100"
                  role="progressbar"
                  aria-label="워크스페이스 카드 공개율"
                  aria-valuenow={writeRate}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="h-full rounded-full bg-warning" style={{ width: `${writeRate}%` }} />
                </div>
              </div>
            )}
            <div className="mt-auto pt-4">
              <Link to={myStatus === 'PRIVATE' ? '/me/card' : `${base}/onboarding`} className={buttonClassName('primary', 'md', 'w-full')}>
                {myStatus === 'PRIVATE' ? '공개 설정 바꾸기' : '카드 만들기'}
              </Link>
            </div>
          </SummaryCard>
        )}
      </div>

      <section aria-labelledby="home-announcements" className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="home-announcements" className="text-lg font-bold">
            최근 공지
          </h2>
        </div>
        <div className="rounded-card border border-outline-soft bg-surface">
          {announcements.isLoading && (
            <div className="space-y-3 p-4">
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
            </div>
          )}
          {announcements.isError && (
            <ErrorState
              compact
              title="공지를 불러오지 못했어요"
              action={
                <Button size="sm" variant="outline" onClick={() => announcements.refetch()}>
                  다시 시도
                </Button>
              }
            />
          )}
          {announcements.data &&
            (announcements.data.length === 0 ? (
              <EmptyState compact icon={<MegaphoneIcon className="h-5 w-5" />} title="아직 공지가 없어요" />
            ) : (
              <ul className="divide-y divide-outline-soft">
                {announcements.data.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <Badge tone={item.teamName ? 'neutral' : 'primary'}>{item.teamName ?? '전체'}</Badge>
                    <span className="min-w-0 flex-1 text-[0.9375rem]">{item.title}</span>
                    <span className="text-xs text-muted">
                      {item.authorName} · <time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
                    </span>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      </section>

      <section aria-labelledby="home-members" className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="home-members" className="text-lg font-bold">
            멤버 카드 미리보기
          </h2>
          <Link to={`${base}/members`} className="inline-flex min-h-touch items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline">
            모두 보기
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        {members.isLoading && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-44 rounded-card" />
            ))}
          </div>
        )}
        {members.isError && (
          <ErrorState
            compact
            title="멤버 카드를 불러오지 못했어요"
            action={
              <Button size="sm" variant="outline" onClick={() => members.refetch()}>
                다시 시도
              </Button>
            }
          />
        )}
        {members.data &&
          (preview.length === 0 ? (
            <div className="rounded-card border border-dashed border-outline-soft bg-surface">
              <EmptyState compact icon={<UsersIcon className="h-5 w-5" />} title="아직 공개된 멤버 카드가 없어요" />
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {preview.map((member) => (
                  <li key={member.account.id}>
                    <MemberCardTile member={member} to={`${base}/members/${member.account.id}`} />
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-center">
                <Link to={`${base}/members`} className={buttonClassName('secondary')}>
                  <UserGroupIcon className="h-5 w-5" aria-hidden="true" />
                  멤버 카드 전체 보기 ({publicCount}명)
                </Link>
              </div>
            </>
          ))}
      </section>
    </div>
  );
};
