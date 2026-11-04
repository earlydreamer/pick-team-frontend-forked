import React, { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BellSlashIcon, ChatBubbleLeftRightIcon, PlusIcon } from '@heroicons/react/24/outline';
import { relativeTime } from '@/renewal/domain/announcement';
import { CHAT_LIMITS } from '@/renewal/domain/chat';
import { useChatRooms, useCreateRoom, useMe, useMembers } from '@/renewal/data/queries';
import { Avatar, Badge, Button, EmptyState, ErrorState, LoadingState, Modal, fieldClassName, toast } from '@/renewal/ui';
import { errorMessage } from '@/renewal/features/teamSpace/TaskModals';

const KIND_LABEL = { TEAM: '팀', DM: 'DM', GROUP: '그룹' } as const;

/** 새 채팅방. 한 명만 고르고 이름을 비우면 DM으로 연다(이미 있으면 그 방). */
export const NewRoomModal: React.FC<{ open: boolean; workspaceId: string; onClose: () => void }> = ({ open, workspaceId, onClose }) => {
  const id = useId();
  const navigate = useNavigate();
  const me = useMe();
  const members = useMembers(open ? workspaceId : '');
  const create = useCreateRoom(workspaceId);
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setQuery('');
    setSelected([]);
    setError(undefined);
  }, [open]);

  const candidates = (members.data ?? []).filter((member) => member.account.id !== me.data?.id && member.account.name.includes(query.trim()));
  const submit = async () => {
    if (selected.length === 0) {
      setError('함께할 사람을 한 명 이상 골라 주세요.');
      document.getElementById(`${id}-search`)?.focus();
      return;
    }
    try {
      const result = await create.mutateAsync({ title: title.trim() || undefined, memberIds: selected });
      onClose();
      navigate(`/ws/${workspaceId}/chat/${result.roomId}`);
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      preventClose={create.isPending}
      title="새 채팅방"
      description="한 명만 고르고 이름을 비워 두면 DM으로 열려요."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            취소
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            {selected.length === 1 && !title.trim() ? 'DM 열기' : '방 만들기'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor={`${id}-title`} className="mb-1.5 block text-sm font-semibold">
            방 이름 <span className="font-normal text-muted">(선택)</span>
          </label>
          <input id={`${id}-title`} value={title} maxLength={CHAT_LIMITS.titleMax} onChange={(event) => setTitle(event.target.value)} className={fieldClassName(false)} />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">함께할 사람</legend>
          <label htmlFor={`${id}-search`} className="sr-only">
            이름으로 찾기
          </label>
          <input
            id={`${id}-search`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름으로 찾기"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className={fieldClassName(Boolean(error))}
          />
          {error && (
            <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
              {error}
            </p>
          )}
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {members.isLoading && <li className="px-2 py-2 text-sm text-muted">멤버를 불러오는 중이에요</li>}
            {candidates.map((member) => {
              const checked = selected.includes(member.account.id);
              return (
                <li key={member.account.id}>
                  <label className={`flex min-h-touch cursor-pointer items-center gap-3 rounded-lg px-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${checked ? 'bg-primary-container' : 'hover:bg-surface-container'}`}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={checked}
                      onChange={() => setSelected((prev) => (checked ? prev.filter((item) => item !== member.account.id) : [...prev, member.account.id]))}
                    />
                    <Avatar name={member.account.name} imageUrl={member.account.profileImageUrl} size="sm" />
                    <span className="text-sm font-medium">{member.account.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      </div>
    </Modal>
  );
};

/**
 * 채팅방 목록(15 §4.1). 컨텍스트 내비에 다 들어가지 않는 방과 좁은 화면을 위해 전체 목록을 따로 둔다.
 * ?new=1로 들어오면 새 채팅방 대화상자를 연다.
 */
export const ChatListScreen: React.FC = () => {
  const { wsId = '' } = useParams<{ wsId: string }>();
  const [params, setParams] = useSearchParams();
  const rooms = useChatRooms(wsId);
  const [creating, setCreating] = useState(params.get('new') === '1');

  useEffect(() => {
    if (params.get('new') === '1') setParams({}, { replace: true });
  }, [params, setParams]);

  if (rooms.isLoading) return <LoadingState className="min-h-[60vh]" label="채팅방을 불러오는 중이에요" />;
  if (rooms.isError || !rooms.data) {
    return <ErrorState className="min-h-[60vh]" title="채팅방을 불러오지 못했어요" description="네트워크 상태를 확인한 뒤 다시 시도해 주세요." action={<Button onClick={() => rooms.refetch()}>다시 시도</Button>} />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold leading-8">채팅</h1>
        <Button leftIcon={<PlusIcon className="h-5 w-5" />} onClick={() => setCreating(true)}>
          새 채팅방
        </Button>
      </div>
      {rooms.data.length === 0 ? (
        <div className="rounded-card border border-dashed border-outline-soft bg-surface">
          <EmptyState
            compact
            icon={<ChatBubbleLeftRightIcon className="h-5 w-5" />}
            title="아직 채팅방이 없어요"
            description="팀에 합류하면 팀 채팅방이 자동으로 생겨요. 직접 대화를 시작할 수도 있어요."
            action={<Button size="sm" onClick={() => setCreating(true)}>새 채팅방</Button>}
          />
        </div>
      ) : (
        <ul className="divide-y divide-outline-soft overflow-hidden rounded-card border border-outline-soft bg-surface">
          {rooms.data.map((item) => (
            <li key={item.room.id}>
              <Link to={`/ws/${wsId}/chat/${item.room.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-peri-50">
                <Avatar name={item.title} size="md" shape={item.room.kind === 'DM' ? 'circle' : 'rounded'} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{item.title}</span>
                    <Badge tone="neutral">{KIND_LABEL[item.room.kind]}</Badge>
                    {item.muted && <BellSlashIcon className="h-4 w-4 shrink-0 text-muted" aria-label="알림 꺼짐" />}
                  </span>
                  <span className="block truncate text-sm text-muted">{item.lastMessage?.content ?? '아직 메시지가 없어요'}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {item.lastMessage && <span className="text-xs text-muted">{relativeTime(item.lastMessage.createdAt)}</span>}
                  {item.unread > 0 && (
                    <>
                      <span aria-hidden="true" className="rounded-full bg-primary px-1.5 py-0.5 text-[0.6875rem] font-bold leading-4 text-on-primary tabular-nums">
                        {item.unread}
                      </span>
                      <span className="sr-only">, 안 읽은 메시지 {item.unread}개</span>
                    </>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <NewRoomModal open={creating} workspaceId={wsId} onClose={() => setCreating(false)} />
    </div>
  );
};
