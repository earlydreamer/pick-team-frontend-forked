import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ArrowRightIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import { useWorkspace } from '@/features/workspace/core/hooks/useWorkspace';
import { workspaceApi } from '@/features/workspace/management/api/workspaceApi';
import TeamActionModal from '@/features/teamspace/team/components/TeamActionModal';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  Skeleton,
  buttonClassName,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessage';
import { MemberProfileModal } from '../components/MemberProfileModal';
import type { Team, User } from '@/types';

/** 팀 응답의 members는 TeamMemberResponse(accountId 포함)입니다. */
type TeamMemberLike = { accountId?: number | string; name?: string; profileImage?: string };
const teamMembers = (team: Team) => (team.members ?? []) as unknown as TeamMemberLike[];
const isMyTeam = (team: Team, userId?: string) =>
  Boolean(userId) && teamMembers(team).some((member) => String(member.accountId) === String(userId));

const AvatarStack: React.FC<{ members: TeamMemberLike[]; total: number }> = ({ members, total }) => {
  const shown = members.slice(0, 4);
  const rest = Math.max(total - shown.length, 0);
  return (
    <span className="flex items-center" aria-hidden="true">
      {shown.map((member, index) => (
        <Avatar key={`${member.accountId}-${index}`} name={member.name} imageUrl={member.profileImage} size="sm" className="-ml-2 ring-2 ring-surface first:ml-0" />
      ))}
      {rest > 0 && (
        <span className="-ml-2 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-surface-container px-1.5 text-xs font-semibold text-muted ring-2 ring-surface">
          +{rest}
        </span>
      )}
    </span>
  );
};

const TeamRow: React.FC<{ team: Team; to: string; mine: boolean }> = ({ team, to, mine }) => {
  const members = teamMembers(team);
  const count = team.memberCount ?? members.length;
  return (
    <li>
      <Link
        to={to}
        className="group flex items-center gap-4 rounded-card border border-outline-soft bg-surface px-4 py-3.5 transition-colors hover:border-peri-300 hover:bg-peri-50"
      >
        <Avatar name={team.name} size="md" shape="rounded" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            <span className="truncate">{team.name}</span>
            {team.passwordProtected && <LockClosedIcon className="h-4 w-4 shrink-0 text-neutral-500" aria-label="비밀번호 필요" />}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            팀원 <span className="tabular-nums">{count}</span>명{team.leader?.name ? ` · 팀장 ${team.leader.name}` : ''}
          </p>
        </div>
        <span className="hidden sm:block">
          <AvatarStack members={members} total={count} />
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          {mine ? '열기' : '둘러보기'}
          <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
};

const SectionHeader: React.FC<{ id: string; title: string; count?: number; action?: React.ReactNode }> = ({ id, title, count, action }) => (
  <div className="mb-3 flex items-center justify-between gap-3">
    <h2 id={id} className="text-lg font-bold">
      {title}
      {count !== undefined && <span className="ml-1.5 text-base font-semibold text-muted tabular-nums">{count}</span>}
    </h2>
    {action}
  </div>
);

const MemberButton: React.FC<{ member: User; isMe: boolean; onSelect: (member: User) => void; showEmail?: boolean }> = ({
  member,
  isMe,
  onSelect,
  showEmail,
}) => {
  const tags = member.hashtags?.slice(0, 3).map((tag) => `#${tag.replace(/^#/, '')}`).join(' ');
  return (
    <button type="button" onClick={() => onSelect(member)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-container">
      <Avatar name={member.name} imageUrl={member.profileImageUrl} size="md" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-semibold text-ink">{member.name || '이름 없음'}</span>
          {isMe && <Badge tone="neutral">나</Badge>}
        </span>
        <span className="block truncate text-sm text-muted">{showEmail || !tags ? member.email : tags}</span>
      </span>
      {member.mbti && <Badge>{member.mbti}</Badge>}
    </button>
  );
};

type MembersState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; members: User[] };

/**
 * 워크스페이스 홈: 소속 팀과 다음 행동, 멤버를 먼저 보여 줍니다.
 * 실제로 수집하지 않는 지표(진행률·활동량)는 표시하지 않습니다(DESIGN.md 작업 화면의 정보 위계).
 */
export const HomePage: React.FC = () => {
  const { currentUser } = useAuth();
  const { currentWorkspace, workspaces, teams, addTeam, loading: workspacesLoading } = useWorkspace();
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const [members, setMembers] = useState<MembersState>({ status: 'loading' });
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [isAllMembersOpen, setIsAllMembersOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [isTeamActionOpen, setIsTeamActionOpen] = useState(false);

  const isRouteWorkspace = Boolean(workspaceId) && currentWorkspace?.id === workspaceId;

  const loadMembers = useCallback(async () => {
    if (!workspaceId) return;
    setMembers({ status: 'loading' });
    try {
      const list = await workspaceApi.getMembers(workspaceId);
      setMembers({ status: 'ready', members: list ?? [] });
    } catch (error) {
      setMembers({ status: 'error', message: getErrorMessage(error, '네트워크 상태를 확인한 뒤 다시 시도해 주세요.') });
    }
  }, [workspaceId]);

  useEffect(() => {
    if (isRouteWorkspace) loadMembers();
  }, [isRouteWorkspace, loadMembers]);

  const { myTeams, otherTeams } = useMemo(() => {
    const mine: Team[] = [];
    const others: Team[] = [];
    (teams as Team[]).forEach((team) => (isMyTeam(team, currentUser?.id) ? mine : others).push(team));
    return { myTeams: mine, otherTeams: others };
  }, [teams, currentUser?.id]);

  const filteredMembers = useMemo(() => {
    if (members.status !== 'ready') return [];
    const query = memberQuery.trim().toLowerCase();
    if (!query) return members.members;
    return members.members.filter((member) =>
      [member.name, member.email, member.mbti, ...(member.hashtags ?? [])].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [members, memberQuery]);

  if (!workspaceId) return <Navigate to="/" replace />;

  if (!workspacesLoading && !workspaces.some((ws) => ws.id === workspaceId)) {
    // 예전 초대 링크(/ws/초대코드)는 초대 화면으로 보내 사용자가 직접 참여를 확인하게 합니다.
    if (!/^\d+$/.test(workspaceId)) return <Navigate to={`/invite/${encodeURIComponent(workspaceId)}`} replace />;
    return (
      <ErrorState
        className="min-h-[70vh]"
        title="이 워크스페이스에 들어갈 수 없어요"
        description="참여하지 않았거나 삭제된 워크스페이스예요. 초대 링크를 받았다면 링크로 다시 들어와 주세요."
        action={
          <Link to="/" className={buttonClassName('primary')}>
            내 워크스페이스로 가기
          </Link>
        }
      />
    );
  }

  if (!currentUser || !currentWorkspace || !isRouteWorkspace) {
    return <LoadingState className="min-h-[70vh]" label="워크스페이스를 여는 중이에요" />;
  }

  const base = `/ws/${currentWorkspace.id}`;
  const memberPreview = members.status === 'ready' ? members.members.slice(0, 6) : [];
  const memberCount = members.status === 'ready' ? members.members.length : currentWorkspace.memberCount;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{currentWorkspace.name}</p>
          <h1 className="mt-1 text-2xl font-bold leading-8 tracking-[-0.02em] sm:text-[1.75rem] sm:leading-9">
            {currentUser.name || '멤버'}님, 안녕하세요
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`${base}/team-formation`} className={buttonClassName('outline')}>
            <UserGroupIcon className="h-5 w-5" aria-hidden="true" />
            팀 빌딩
          </Link>
          <Button onClick={() => setIsTeamActionOpen(true)}>팀 만들기·참여</Button>
        </div>
      </header>

      {/* 다음 행동: 참여할 수 있는 팀이 있는데 소속 팀이 없을 때만 안내합니다(팀이 하나도 없으면 아래 빈 상태가 안내). */}
      {myTeams.length === 0 && otherTeams.length > 0 && (
        <section aria-labelledby="next-step-heading" className="mt-6 rounded-modal bg-peri-900 p-6 text-white sm:p-8">
          <h2 id="next-step-heading" className="text-xl font-bold leading-7">
            아직 소속된 팀이 없어요
          </h2>
          <p className="mt-1.5 max-w-xl text-[0.9375rem] leading-6 text-peri-100">
            멤버 프로필을 둘러보고 팀을 만들거나, 열려 있는 팀을 둘러보고 참여해 보세요.
          </p>
        </section>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          {myTeams.length > 0 && (
            <section aria-labelledby="my-teams-heading">
              <SectionHeader id="my-teams-heading" title="내 팀" count={myTeams.length} />
              <ul className="space-y-2.5">
                {myTeams.map((team) => (
                  <TeamRow key={team.id} team={team} to={`${base}/team/${team.id}`} mine />
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="other-teams-heading">
            <SectionHeader
              id="other-teams-heading"
              title={myTeams.length > 0 ? '워크스페이스의 다른 팀' : '워크스페이스의 팀'}
              count={otherTeams.length}
            />
            {otherTeams.length > 0 ? (
              <ul className="space-y-2.5">
                {otherTeams.map((team) => (
                  <TeamRow key={team.id} team={team} to={`${base}/team/${team.id}`} mine={false} />
                ))}
              </ul>
            ) : (
              <div className="rounded-card border border-dashed border-outline-soft bg-surface">
                <EmptyState
                  compact
                  icon={<UsersIcon className="h-5 w-5" />}
                  title={myTeams.length > 0 ? '다른 팀은 아직 없어요' : '아직 만들어진 팀이 없어요'}
                  description="첫 팀을 만들고 멤버를 모아 보세요."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setIsTeamActionOpen(true)}>
                      팀 만들기
                    </Button>
                  }
                />
              </div>
            )}
          </section>
        </div>

        <aside aria-labelledby="members-heading" className="min-w-0">
          <SectionHeader
            id="members-heading"
            title="멤버"
            count={memberCount}
            action={
              members.status === 'ready' && members.members.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setIsAllMembersOpen(true)}
                  className="min-h-touch text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  전체 보기
                </button>
              ) : undefined
            }
          />
          <div className="rounded-card border border-outline-soft bg-surface p-2">
            {members.status === 'loading' && (
              <ul className="space-y-1 p-2" aria-label="멤버를 불러오는 중">
                {Array.from({ length: 4 }).map((_, index) => (
                  <li key={index} className="flex items-center gap-3 py-1.5">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                  </li>
                ))}
              </ul>
            )}
            {members.status === 'error' && (
              <ErrorState
                compact
                title="멤버를 불러오지 못했어요"
                description={members.message}
                action={
                  <Button size="sm" variant="outline" onClick={loadMembers}>
                    다시 시도
                  </Button>
                }
              />
            )}
            {members.status === 'ready' &&
              (memberPreview.length > 0 ? (
                <ul>
                  {memberPreview.map((member) => (
                    <li key={member.id}>
                      <MemberButton member={member} isMe={String(member.id) === String(currentUser.id)} onSelect={setSelectedMember} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact title="아직 멤버가 없어요" description="워크스페이스 설정에서 초대 링크를 복사해 공유해 보세요." />
              ))}
          </div>
        </aside>
      </div>

      <Modal
        isOpen={isAllMembersOpen}
        onClose={() => {
          setIsAllMembersOpen(false);
          setMemberQuery('');
        }}
        title={`멤버 ${memberCount}명`}
        size="lg"
      >
        <label className="relative block">
          <span className="sr-only">멤버 검색</span>
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
          <input
            type="search"
            value={memberQuery}
            onChange={(event) => setMemberQuery(event.target.value)}
            placeholder="이름, 이메일, MBTI, 태그로 찾기"
            className="block min-h-touch w-full rounded-lg border border-outline bg-surface pl-10 pr-3 text-[0.9375rem] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <p className="sr-only" role="status">
          {filteredMembers.length}명 찾음
        </p>
        {filteredMembers.length > 0 ? (
          <ul className="mt-3 max-h-[50vh] overflow-y-auto">
            {filteredMembers.map((member) => (
              <li key={member.id}>
                <MemberButton member={member} isMe={String(member.id) === String(currentUser.id)} onSelect={setSelectedMember} showEmail />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact title="찾는 멤버가 없어요" description="다른 검색어로 찾아보세요." />
        )}
      </Modal>

      <MemberProfileModal member={selectedMember} onClose={() => setSelectedMember(null)} />

      <TeamActionModal
        isOpen={isTeamActionOpen}
        onClose={() => setIsTeamActionOpen(false)}
        onTeamCreated={(team) => {
          addTeam(team);
          setIsTeamActionOpen(false);
        }}
      />
    </div>
  );
};
