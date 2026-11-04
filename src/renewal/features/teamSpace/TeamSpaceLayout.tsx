import React from 'react';
import { Link, NavLink, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { Cog6ToothIcon, EyeIcon, LockClosedIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import { activeDelegation, type TeamSpace } from '@/renewal/domain/teamSpace';
import { DataError } from '@/renewal/data';
import { useMe, useTeamSpace, useVideoChannels } from '@/renewal/data/queries';
import { Avatar, Badge, Button, EmptyState, ErrorState, LoadingState, buttonClassName } from '@/renewal/ui';
import { NotFoundScreen } from '@/renewal/screens/system';

export interface TeamSpaceContext {
  workspaceId: string;
  teamId: string;
  space: TeamSpace;
  base: string;
}

export const useTeamSpaceContext = () => useOutletContext<TeamSpaceContext>();

const TABS: { to: string; label: string; memberOnly: boolean }[] = [
  { to: '', label: '개요', memberOnly: false },
  { to: 'kanban', label: '칸반', memberOnly: false },
  { to: 'calendar', label: '일정', memberOnly: true },
  { to: 'board', label: '게시판', memberOnly: true },
  { to: 'announcements', label: '공지', memberOnly: true },
];

/**
 * 팀 스페이스 틀(14 §4.1 탭 구성). 팀 이름과 인원, 개요·칸반·일정·게시판·공지·설정 탭을 둔다.
 * 팀원이 아니면 존재를 숨기고(404), 팀원이 아닌 개설자·매니저는 개요와 칸반만 본다(13-D1).
 * 탭은 화면을 바꾸는 링크라 ARIA 탭이 아니라 내비게이션으로 표시한다.
 */
export const TeamSpaceLayout: React.FC = () => {
  const { wsId = '', teamId = '' } = useParams<{ wsId: string; teamId: string }>();
  const space = useTeamSpace(wsId, teamId);
  const me = useMe();
  const channels = useVideoChannels(wsId, Boolean(space.data?.access.isMember));
  const { pathname } = useLocation();
  const base = `/ws/${wsId}/team/${teamId}`;

  if (space.isLoading) return <LoadingState className="min-h-[60vh]" label="팀 스페이스를 불러오는 중이에요" />;
  if (space.error instanceof DataError && space.error.code === 'NOT_FOUND') return <NotFoundScreen />;
  if (space.isError || !space.data) {
    return (
      <ErrorState
        className="min-h-[60vh]"
        title="팀 스페이스를 불러오지 못했어요"
        description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
        action={<Button onClick={() => space.refetch()}>다시 시도</Button>}
      />
    );
  }

  const { team, members, access } = space.data;
  const tabs = TABS.filter((tab) => access.isMember || !tab.memberOnly);
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `-mb-px inline-flex min-h-touch shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold ${
      isActive ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'
    }`;

  return (
    <div className="pb-12">
      <header className="border-b border-outline-soft bg-surface px-4 pt-6 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center gap-3">
            <Avatar name={team.name} size="md" shape="rounded" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold leading-8">{team.name}</h1>
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                <span className="tabular-nums">{members.length}명</span>
                {access.isLeader && <Badge tone="primary">내가 팀장</Badge>}
                {access.isManagerViewer && (
                  <Badge tone="neutral" icon={<EyeIcon className="h-3.5 w-3.5" />}>
                    매니저 보기
                  </Badge>
                )}
              </p>
            </div>
            {/* 원클릭 회의 참여(15 US-15-06) */}
            {access.isMember && channels.data?.find((channel) => channel.teamId === team.id) && (
              <Link to={`/ws/${wsId}/video/${channels.data.find((channel) => channel.teamId === team.id)!.id}`} className={buttonClassName('outline', 'sm')}>
                <VideoCameraIcon className="h-4 w-4" aria-hidden="true" />
                화상회의
              </Link>
            )}
          </div>
          <nav aria-label={`${team.name} 메뉴`} className="mt-4 flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <NavLink key={tab.label} to={tab.to ? `${base}/${tab.to}` : base} end={!tab.to} className={tabClass}>
                {tab.label}
              </NavLink>
            ))}
            {/* 매니저도 멤버 내보내기와 팀 삭제를 할 수 있어 팀 설정은 함께 보여 준다(14 §2). */}
            {(access.isMember || access.isManagerViewer) && (
              <NavLink to={`${base}/settings`} className={tabClass}>
                <Cog6ToothIcon className="h-4 w-4" aria-hidden="true" />
                팀 설정
              </NavLink>
            )}
          </nav>
        </div>
      </header>
      {(() => {
        const delegation = activeDelegation(team);
        // 알림 센터가 생기기 전까지 위임 요청은 팀 스페이스 어디서든 알 수 있게 띄운다(14 §5.4).
        if (!delegation || delegation.targetId !== me.data?.id || pathname.startsWith(`${base}/settings`)) return null;
        return (
          <p role="status" className="mx-auto mt-4 flex max-w-6xl flex-wrap items-center gap-2 px-4 text-sm sm:px-6 lg:px-10">
            <span className="rounded-card bg-peri-50 px-3 py-2">
              {members.find((member) => member.account.id === team.leaderId)?.account.name}님이 팀장 위임을 요청했어요.{' '}
              <Link to={`${base}/settings`} className="font-semibold text-primary underline underline-offset-4">
                팀 설정에서 답하기
              </Link>
            </span>
          </p>
        );
      })()}
      {access.isManagerViewer && (
        <p role="note" className="mx-auto mt-4 max-w-6xl px-4 text-sm text-muted sm:px-6 lg:px-10">
          팀원이 아니라서 진행 집계와 칸반만 볼 수 있어요. 완료 요청은 승인하거나 반려할 수 있고, 팀 설정에서 팀원 내보내기와 팀 삭제를 할 수 있어요.
        </p>
      )}
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-10">
        <Outlet context={{ workspaceId: wsId, teamId, space: space.data, base } satisfies TeamSpaceContext} />
      </div>
    </div>
  );
};

/** 팀원만 볼 수 있는 탭(일정·게시판·공지). 매니저에게는 이유를 알려 준다(13-D1). */
export const TeamMemberOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { space, base } = useTeamSpaceContext();
  if (space.access.isMember) return <>{children}</>;
  return (
    <EmptyState
      className="min-h-[40vh]"
      icon={<LockClosedIcon className="h-7 w-7" />}
      title="팀원만 볼 수 있는 화면이에요"
      description="개설자와 매니저는 팀 내부 내용 대신 집계만 볼 수 있어요."
      action={
        <Link to={base} className={buttonClassName('outline')}>
          팀 개요로
        </Link>
      }
    />
  );
};
