import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  IdentificationIcon,
  UserGroupIcon,
  ChartBarSquareIcon,
  AdjustmentsHorizontalIcon,
  Cog6ToothIcon,
  UsersIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { ChatBubbleLeftRightIcon, MegaphoneIcon, QueueListIcon, VideoCameraIcon, BellSlashIcon } from '@heroicons/react/24/outline';
import { dDayLabel } from '@/renewal/domain/teamBuilding';
import { useChatRooms, useVideoChannels } from '@/renewal/data/queries';
import { useWorkspaceContext } from './useWorkspaceContext';

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-[40px] w-full items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors ${
    isActive ? 'bg-primary-container font-semibold text-on-primary-container' : 'text-muted hover:bg-surface-container hover:text-ink'
  }`;

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mt-5 first:mt-0">
    <h3 className="mb-1 px-2.5 text-xs font-semibold text-muted">{title}</h3>
    <ul className="space-y-0.5">{children}</ul>
  </section>
);

/**
 * 컨텍스트 내비게이션(02 §2.3).
 * 워크스페이스, 관리(개설자·매니저만), 내 팀, 내 계정 순서로 그린다.
 * 멤버에게는 설정 화면을 "워크스페이스 정보"로 보여 준다. 멤버가 여는 탭은 기본 정보와 나가기뿐이다(13 §4.1).
 * 팀 빌딩 항목은 세션이 없으면 숨기고, 모집 중이면 마감 D-day를 붙인다(02 §1-3).
 * 세션 운영은 세션이 없어도 보여 매니저가 세션을 만들 수 있게 한다(12 §5.4-8).
 * 커뮤니케이션 섹션은 최근 채팅방 6개와 미읽음 수, 내 팀 회의실을 보여 준다.
 */
export const ContextNav: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { wsId, workspace, isManager, session, myTeams } = useWorkspaceContext();
  const { pathname } = useLocation();
  const rooms = useChatRooms(workspace ? wsId : '');
  const channels = useVideoChannels(workspace ? wsId : '');
  if (!workspace) return null;
  const base = `/ws/${wsId}`;
  const showTeamBuilding = session !== null;
  // 세션 운영도 /team-building 아래에 있으므로 팀 빌딩 항목은 운영 화면에서 활성으로 표시하지 않는다.
  const teamBuildingActive = pathname.startsWith(`${base}/team-building`) && !pathname.startsWith(`${base}/team-building/manage`);

  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-outline-soft bg-surface">
      <div className="flex min-h-[56px] items-center border-b border-outline-soft px-4">
        <p className="min-w-0 truncate font-bold" title={workspace.name}>
          {workspace.name}
        </p>
      </div>
      <nav aria-label={`${workspace.name} 메뉴`} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <Section title="워크스페이스">
          <li>
            <NavLink to={base} end className={itemClass} onClick={onNavigate}>
              <HomeIcon className="h-5 w-5 shrink-0" aria-hidden="true" />홈
            </NavLink>
          </li>
          <li>
            <NavLink to={`${base}/members`} className={itemClass} onClick={onNavigate}>
              <IdentificationIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
              멤버 카드
            </NavLink>
          </li>
          <li>
            <NavLink to={`${base}/announcements`} className={itemClass} onClick={onNavigate}>
              <MegaphoneIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
              공지
            </NavLink>
          </li>
          {showTeamBuilding && (
            <li>
              <Link
                to={`${base}/team-building`}
                aria-current={teamBuildingActive ? 'page' : undefined}
                className={itemClass({ isActive: teamBuildingActive })}
                onClick={onNavigate}
              >
                <UserGroupIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="flex-1">팀 빌딩</span>
                {session.status === 'OPEN' && (
                  <span className="rounded-full bg-danger px-1.5 py-0.5 text-[0.6875rem] font-bold leading-4 text-white tabular-nums">
                    {dDayLabel(session.closesAt)}
                    <span className="sr-only"> 마감</span>
                  </span>
                )}
              </Link>
            </li>
          )}
          {!isManager && (
            <li>
              <NavLink to={`${base}/settings`} className={itemClass} onClick={onNavigate}>
                <Cog6ToothIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                워크스페이스 정보
              </NavLink>
            </li>
          )}
        </Section>

        {isManager && (
          <Section title="관리">
            <li>
              <NavLink to={`${base}/dashboard`} className={itemClass} onClick={onNavigate}>
                <ChartBarSquareIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                대시보드
              </NavLink>
            </li>
            <li>
              <NavLink to={`${base}/team-building/manage`} className={itemClass} onClick={onNavigate}>
                <AdjustmentsHorizontalIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                세션 운영
              </NavLink>
            </li>
            <li>
              <NavLink to={`${base}/settings`} className={itemClass} onClick={onNavigate}>
                <Cog6ToothIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                설정
              </NavLink>
            </li>
          </Section>
        )}

        <Section title="내 팀">
          {myTeams.length > 0 ? (
            myTeams.map((team) => (
              <li key={team.id}>
                <NavLink to={`${base}/team/${team.id}`} className={itemClass} onClick={onNavigate}>
                  <UsersIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{team.name}</span>
                </NavLink>
              </li>
            ))
          ) : (
            <li className="px-2.5 py-1.5 text-xs text-neutral-500">아직 소속된 팀이 없어요</li>
          )}
        </Section>

        {/* 커뮤니케이션(02 §2.3, 15 §4.1): 채팅방과 미읽음, 팀 회의실 */}
        <Section title="커뮤니케이션">
          {(rooms.data ?? []).slice(0, 6).map((item) => (
            <li key={item.room.id}>
              <NavLink to={`${base}/chat/${item.room.id}`} className={itemClass} onClick={onNavigate}>
                <ChatBubbleLeftRightIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                {item.muted && <BellSlashIcon className="h-4 w-4 shrink-0 text-neutral-500" aria-label="알림 꺼짐" />}
                {item.unread > 0 && (
                  <>
                    <span aria-hidden="true" className="rounded-full bg-primary px-1.5 py-0.5 text-[0.6875rem] font-bold leading-4 text-on-primary tabular-nums">
                      {item.unread > 99 ? '99+' : item.unread}
                    </span>
                    <span className="sr-only">, 안 읽은 메시지 {item.unread}개</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li>
            <NavLink to={`${base}/chat`} end className={itemClass} onClick={onNavigate}>
              <QueueListIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {(rooms.data?.length ?? 0) > 6 ? '채팅방 모두 보기' : '채팅방 목록'}
            </NavLink>
          </li>
          {(channels.data ?? []).map((channel) => (
            <li key={channel.id}>
              <NavLink to={`${base}/video/${channel.id}`} className={itemClass} onClick={onNavigate}>
                <VideoCameraIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="truncate">{channel.name}</span>
              </NavLink>
            </li>
          ))}
        </Section>

        <Section title="내 계정">
          <li>
            <NavLink to="/me/card" className={itemClass} onClick={onNavigate}>
              <IdentificationIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
              내 PR 카드
            </NavLink>
          </li>
          <li>
            <NavLink to="/me/settings" className={itemClass} onClick={onNavigate}>
              <UserCircleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
              계정 설정
            </NavLink>
          </li>
        </Section>
      </nav>
    </div>
  );
};
