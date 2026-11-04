import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  HomeIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  PlusIcon,
  LockClosedIcon,
  VideoCameraIcon,
  TrashIcon,
  HashtagIcon,
} from '@heroicons/react/24/outline';
import { useWorkspace } from '@/features/workspace/core/hooks/useWorkspace';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import { workspaceApi } from '@/features/workspace/management/api/workspaceApi';
import { chatApi, ChatRoomResponse, ChatMemberResponse } from '@/features/workspace/chat/api/chatApi';
import { videoApi } from '@/features/workspace/video/api/videoApi';
import { VideoChannel } from '@/features/workspace/video/types/video';
import { chatLogger } from '@/features/workspace/chat/utils/chatLogger';
import { Avatar, Modal, Button } from '@/components/ui';
import TeamCreateModal from '@/features/teamspace/team/components/TeamCreateModal';
import { NewChatModal } from '@/features/workspace/chat/components/NewChatModal';
import WorkspaceSettingsModal from '@/features/workspace/management/components/WorkspaceSettingsModal';
import NewVideoConferenceModal from '@/features/workspace/video/components/NewVideoConferenceModal';
import type { Team } from '@/types';

const itemBase =
  'group flex min-h-[40px] w-full items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors';
const itemIdle = 'text-muted hover:bg-surface-container hover:text-ink';
const itemActive = 'bg-primary-container font-semibold text-on-primary-container';

const NavSection: React.FC<{
  title: string;
  addLabel?: string;
  onAdd?: () => void;
  children: React.ReactNode;
  empty?: string;
  isEmpty?: boolean;
}> = ({ title, addLabel, onAdd, children, empty, isEmpty }) => (
  <section className="mt-5">
    <div className="mb-1 flex items-center justify-between pl-2.5 pr-1">
      <h3 className="text-xs font-semibold text-muted">{title}</h3>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          aria-label={addLabel}
          title={addLabel}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-container hover:text-ink"
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
    {isEmpty ? <p className="px-2.5 py-1.5 text-xs text-neutral-500">{empty}</p> : <ul className="space-y-0.5">{children}</ul>}
  </section>
);

/** DM 방의 표시 이름: 상대방 이름 → 서버가 준 방 이름 → 방 번호 순으로 사용합니다. */
const getChatRoomDisplayName = (room: ChatRoomResponse, members: ChatMemberResponse[] | undefined, currentUserId?: string) => {
  if (room.type === 'PERSONAL') {
    const other = members?.find((member) => String(member.account) !== String(currentUserId));
    if (other?.name) return other.name;
    if (room.name && room.name.trim() !== '' && room.name !== 'DM' && !room.name.includes('대화:')) return room.name;
    return `DM ${room.id}`;
  }
  return room.name?.trim() || `그룹 채팅 ${room.id}`;
};

/**
 * 워크스페이스 컨텍스트 탐색: 홈·팀 빌딩, 팀 목록, DM·그룹 채팅, 화상회의로 이동합니다.
 * 데이터 로딩은 기존 TeamProjectSidebar의 동작(화상회의 5초 갱신 등)을 유지합니다.
 */
export const WorkspaceNav: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { currentWorkspace, teams, addTeam } = useWorkspace();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [chatRooms, setChatRooms] = useState<ChatRoomResponse[]>([]);
  const [chatRoomMembers, setChatRoomMembers] = useState<Record<number, ChatMemberResponse[]>>({});
  const [chatLoadFailed, setChatLoadFailed] = useState(false);
  const [videoChannels, setVideoChannels] = useState<VideoChannel[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [modal, setModal] = useState<'team' | 'chat' | 'video' | 'settings' | null>(null);
  const [channelToDelete, setChannelToDelete] = useState<VideoChannel | null>(null);
  const [deleteState, setDeleteState] = useState<{ pending: boolean; error: string | null }>({ pending: false, error: null });

  const workspaceId = currentWorkspace?.id;

  const loadVideoChannels = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setVideoChannels(await videoApi.getVideoChannels(String(workspaceId)));
    } catch (error) {
      chatLogger.ui.error('화상회의 목록을 불러오는데 실패했습니다:', error);
    }
  }, [workspaceId]);

  // 화상회의 목록은 다른 사람이 만든 방을 반영하기 위해 5초마다 갱신합니다.
  useEffect(() => {
    if (!workspaceId) return;
    setVideoChannels([]);
    loadVideoChannels();
    const interval = setInterval(loadVideoChannels, 5000);
    return () => clearInterval(interval);
  }, [workspaceId, loadVideoChannels]);

  useEffect(() => {
    if (!workspaceId || !currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await chatApi.getChatRooms(Number(workspaceId));
        const rooms = response.content || [];
        const entries = await Promise.all(
          rooms
            .filter((room) => room.type === 'PERSONAL')
            .map(async (room) => {
              try {
                return [room.id, await chatApi.getChatMembers(room.id)] as const;
              } catch (error) {
                chatLogger.ui.error(`DM 채팅방 ${room.id}의 멤버 정보를 가져오는데 실패:`, error);
                return [room.id, []] as const;
              }
            }),
        );
        if (cancelled) return;
        setChatRoomMembers(Object.fromEntries(entries));
        setChatRooms(rooms);
        setChatLoadFailed(false);
      } catch (error) {
        chatLogger.ui.error('채팅방 목록을 불러오는데 실패했습니다:', error);
        if (cancelled) return;
        setChatRooms([]);
        setChatRoomMembers({});
        setChatLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, currentUser]);

  // 화상회의 방 삭제는 워크스페이스 소유자에게만 노출합니다(서버 권한 검사는 별도).
  useEffect(() => {
    if (!workspaceId || !currentUser) {
      setIsOwner(false);
      return;
    }
    let cancelled = false;
    workspaceApi
      .getWorkspaceDetails(workspaceId)
      .then((workspace) => {
        if (!cancelled) setIsOwner(String(workspace.owner?.id) === String(currentUser.id));
      })
      .catch(() => {
        if (!cancelled) setIsOwner(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, currentUser]);

  if (!currentWorkspace) return null;

  const base = `/ws/${currentWorkspace.id}`;
  const activeRoomId = searchParams.get('roomId');
  const isVideoActive = (channelId: string) => location.pathname.startsWith(`${base}/video/`) && activeRoomId === String(channelId);
  const personalRooms = chatRooms.filter((room) => room.type === 'PERSONAL');
  const groupRooms = chatRooms.filter((room) => room.type === 'GROUP');
  const navClass = ({ isActive }: { isActive: boolean }) => `${itemBase} ${isActive ? itemActive : itemIdle}`;

  const handleTeamCreated = (newTeam: Team) => {
    addTeam(newTeam);
    setModal(null);
    navigate(`${base}/team/${newTeam.id}`);
    onNavigate?.();
  };

  const handleChatRoomCreated = async (newRoom: ChatRoomResponse) => {
    setChatRooms((prev) => [...prev, newRoom]);
    if (newRoom.type === 'PERSONAL') {
      try {
        const members = await chatApi.getChatMembers(newRoom.id);
        setChatRoomMembers((prev) => ({ ...prev, [newRoom.id]: members }));
      } catch (error) {
        chatLogger.ui.error(`새 DM 채팅방 ${newRoom.id}의 멤버 정보를 가져오는데 실패:`, error);
      }
    }
  };

  const confirmDeleteChannel = async () => {
    if (!channelToDelete) return;
    setDeleteState({ pending: true, error: null });
    try {
      await videoApi.deleteVideoChannel(String(currentWorkspace.id), channelToDelete.id);
      setVideoChannels((prev) => prev.filter((channel) => channel.id !== channelToDelete.id));
      setChannelToDelete(null);
      setDeleteState({ pending: false, error: null });
      loadVideoChannels();
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.message;
      setDeleteState({ pending: false, error: detail ? `삭제하지 못했어요. ${detail}` : '삭제하지 못했어요. 잠시 후 다시 시도해 주세요.' });
    }
  };

  return (
    <>
      <div className="flex h-full w-[248px] shrink-0 flex-col border-r border-outline-soft bg-surface">
        <div className="flex min-h-[64px] items-center justify-between gap-2 border-b border-outline-soft px-4">
          <h2 className="min-w-0 truncate text-base font-bold text-ink" title={currentWorkspace.name}>
            {currentWorkspace.name}
          </h2>
          <button
            type="button"
            onClick={() => setModal('settings')}
            aria-label="워크스페이스 설정"
            title="워크스페이스 설정"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-container hover:text-ink"
          >
            <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label={`${currentWorkspace.name} 메뉴`} className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3">
          <ul className="space-y-0.5">
            <li>
              <NavLink to={base} end className={navClass} onClick={onNavigate}>
                <HomeIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                홈
              </NavLink>
            </li>
            <li>
              <NavLink to={`${base}/team-formation`} className={navClass} onClick={onNavigate}>
                <UserGroupIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                팀 빌딩
              </NavLink>
            </li>
          </ul>

          <NavSection title="팀" addLabel="팀 만들기" onAdd={() => setModal('team')} isEmpty={teams.length === 0} empty="아직 참여한 팀이 없어요">
            {teams.map((team: Team) => (
              <li key={team.id}>
                <NavLink to={`${base}/team/${team.id}`} className={navClass} onClick={onNavigate}>
                  <Avatar name={team.name} size="xs" shape="rounded" />
                  <span className="min-w-0 flex-1 truncate">{team.name}</span>
                  {team.passwordProtected && (
                    <LockClosedIcon className="h-4 w-4 shrink-0 text-neutral-500" aria-label="비밀번호 필요" />
                  )}
                </NavLink>
              </li>
            ))}
          </NavSection>

          <NavSection
            title="DM"
            addLabel="새 대화 시작"
            onAdd={() => setModal('chat')}
            isEmpty={personalRooms.length === 0}
            empty={chatLoadFailed ? '대화 목록을 불러오지 못했어요' : '아직 DM이 없어요'}
          >
            {personalRooms.map((room) => {
              const name = getChatRoomDisplayName(room, chatRoomMembers[room.id], currentUser?.id);
              const other = chatRoomMembers[room.id]?.find((member) => String(member.account) !== String(currentUser?.id));
              return (
                <li key={room.id}>
                  <NavLink to={`${base}/chat/${room.id}`} className={navClass} onClick={onNavigate}>
                    <Avatar name={name} imageUrl={other?.profileImageUrl} size="xs" />
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                  </NavLink>
                </li>
              );
            })}
          </NavSection>

          <NavSection
            title="그룹 채팅"
            addLabel="그룹 채팅 만들기"
            onAdd={() => setModal('chat')}
            isEmpty={groupRooms.length === 0}
            empty={chatLoadFailed ? '대화 목록을 불러오지 못했어요' : '아직 그룹 채팅이 없어요'}
          >
            {groupRooms.map((room) => (
              <li key={room.id}>
                <NavLink to={`${base}/chat/${room.id}`} className={navClass} onClick={onNavigate}>
                  <HashtagIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{getChatRoomDisplayName(room, undefined, currentUser?.id)}</span>
                </NavLink>
              </li>
            ))}
          </NavSection>

          <NavSection
            title="화상회의"
            addLabel="화상회의 방 만들기"
            onAdd={() => setModal('video')}
            isEmpty={videoChannels.length === 0}
            empty="열린 화상회의 방이 없어요"
          >
            {videoChannels.map((channel) => {
              const active = isVideoActive(channel.id);
              return (
                <li key={channel.id} className="flex items-center gap-1">
                  <Link
                    to={`${base}/video/live?roomId=${channel.id}&roomName=${encodeURIComponent(channel.name)}`}
                    className={`${itemBase} ${active ? itemActive : itemIdle}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={onNavigate}
                  >
                    <VideoCameraIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{channel.name}</span>
                  </Link>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteState({ pending: false, error: null });
                        setChannelToDelete(channel);
                      }}
                      aria-label={`${channel.name} 방 삭제`}
                      title="방 삭제"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-red-50 hover:text-danger"
                    >
                      <TrashIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </NavSection>
        </nav>
      </div>

      <TeamCreateModal isOpen={modal === 'team'} onClose={() => setModal(null)} onTeamCreated={handleTeamCreated} />
      <NewChatModal isOpen={modal === 'chat'} onClose={() => setModal(null)} onChatRoomCreated={handleChatRoomCreated} />
      <NewVideoConferenceModal
        isOpen={modal === 'video'}
        onClose={() => setModal(null)}
        onVideoConferenceCreated={loadVideoChannels}
      />
      <WorkspaceSettingsModal isOpen={modal === 'settings'} onClose={() => setModal(null)} />

      <Modal
        isOpen={channelToDelete !== null}
        onClose={() => setChannelToDelete(null)}
        preventClose={deleteState.pending}
        title="화상회의 방을 삭제할까요?"
        description={channelToDelete ? `'${channelToDelete.name}' 방이 목록에서 사라지고 되돌릴 수 없어요.` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setChannelToDelete(null)} disabled={deleteState.pending}>
              취소
            </Button>
            <Button variant="danger" onClick={confirmDeleteChannel} loading={deleteState.pending}>
              삭제
            </Button>
          </>
        }
      >
        {deleteState.error && (
          <p role="alert" className="text-sm text-danger">
            {deleteState.error}
          </p>
        )}
      </Modal>
    </>
  );
};
