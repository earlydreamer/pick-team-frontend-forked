import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, ArrowPathIcon, Cog6ToothIcon, MagnifyingGlassIcon, PaperAirplaneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { CHAT_LIMITS, validateMessage, type ChatMessage } from '@/renewal/domain/chat';
import { DataError, data } from '@/renewal/data';
import {
  keys,
  useAddChatMembers,
  useChatRoom,
  useDeleteRoom,
  useLeaveRoom,
  useMe,
  useMembers,
  useMessages,
  useRenameRoom,
  useSendMessage,
  useSetMuted,
} from '@/renewal/data/queries';
import { Avatar, Button, ErrorState, LoadingState, Modal, fieldClassName, toast } from '@/renewal/ui';
import { NotFoundScreen } from '@/renewal/screens/system';
import { ConfirmModal } from '@/renewal/features/teamBuilding/shared';
import { errorMessage } from '@/renewal/features/teamSpace/TaskModals';

interface PendingMessage {
  tempId: string;
  content: string;
  status: 'sending' | 'failed';
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

/** 방 설정(15 §4.1 방 설정 패널): 멤버, 멤버 추가, 알림, 이름 바꾸기, 나가기·삭제. */
const RoomSettingsModal: React.FC<{ open: boolean; workspaceId: string; roomId: string; onClose: () => void }> = ({ open, workspaceId, roomId, onClose }) => {
  const id = useId();
  const navigate = useNavigate();
  const me = useMe();
  const room = useChatRoom(workspaceId, roomId);
  const members = useMembers(open ? workspaceId : '');
  const rename = useRenameRoom(workspaceId, roomId);
  const addMembers = useAddChatMembers(workspaceId, roomId);
  const setMuted = useSetMuted(workspaceId, roomId);
  const leave = useLeaveRoom(workspaceId, roomId);
  const remove = useDeleteRoom(workspaceId, roomId);
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [toAdd, setToAdd] = useState('');
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null);
  useEffect(() => {
    if (open && room.data) setTitle(room.data.room.title ?? '');
  }, [open, room.data]);
  if (!room.data) return null;
  const detail = room.data;
  const refresh = () => client.invalidateQueries({ queryKey: keys.chatRoom(workspaceId, roomId) });
  const run = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work();
      await refresh();
      toast.success(done);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  };
  const candidates = (members.data ?? []).filter((member) => !detail.room.memberIds.includes(member.account.id));

  return (
    <>
      <Modal isOpen={open} onClose={onClose} title="방 설정" size="lg">
        <div className="space-y-6">
          <section aria-labelledby={`${id}-mute`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 id={`${id}-mute`} className="text-sm font-semibold">
                  새 메시지 알림
                </h3>
                <p className="text-sm text-muted">끄면 이 방의 새 메시지를 알림으로 받지 않아요. 안 읽은 수는 계속 보여요.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!detail.muted}
                aria-labelledby={`${id}-mute`}
                disabled={setMuted.isPending}
                onClick={() => run(() => setMuted.mutateAsync(!detail.muted), detail.muted ? '알림을 켰어요.' : '알림을 껐어요.')}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${detail.muted ? 'bg-neutral-300' : 'bg-primary'}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${detail.muted ? 'translate-x-1' : 'translate-x-6'}`} />
              </button>
            </div>
          </section>

          {detail.permissions.rename && (
            <form
              className="flex items-end gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                await run(() => rename.mutateAsync(title), '방 이름을 바꿨어요.');
              }}
            >
              <div className="flex-1">
                <label htmlFor={`${id}-title`} className="mb-1.5 block text-sm font-semibold">
                  방 이름
                </label>
                <input id={`${id}-title`} value={title} maxLength={CHAT_LIMITS.titleMax} onChange={(event) => setTitle(event.target.value)} className={fieldClassName(false)} />
              </div>
              <Button type="submit" variant="outline" loading={rename.isPending} disabled={!title.trim() || title === detail.room.title}>
                바꾸기
              </Button>
            </form>
          )}

          <section aria-labelledby={`${id}-members`}>
            <h3 id={`${id}-members`} className="mb-2 text-sm font-semibold">
              멤버 {detail.members.length}명
            </h3>
            <ul className="space-y-1">
              {detail.members.map((account) => (
                <li key={account.id} className="flex items-center gap-2 text-sm">
                  <Avatar name={account.name} imageUrl={account.profileImageUrl} size="xs" />
                  {account.name}
                  {account.id === me.data?.id && <span className="text-xs text-muted">(나)</span>}
                  {account.id === detail.room.createdBy && detail.room.kind === 'GROUP' && <span className="text-xs text-primary">만든 사람</span>}
                </li>
              ))}
            </ul>
            {detail.room.kind === 'TEAM' && <p className="mt-2 text-xs text-muted">팀 채팅방 멤버는 팀 소속을 따라요.</p>}
            {detail.permissions.addMembers && (
              <form
                className="mt-3 flex items-end gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (toAdd && (await run(() => addMembers.mutateAsync([toAdd]), '멤버를 추가했어요.'))) setToAdd('');
                }}
              >
                <div className="flex-1">
                  <label htmlFor={`${id}-add`} className="mb-1.5 block text-sm font-semibold">
                    멤버 추가
                  </label>
                  <select id={`${id}-add`} value={toAdd} onChange={(event) => setToAdd(event.target.value)} className={fieldClassName(false, 'appearance-auto')}>
                    <option value="">멤버 선택</option>
                    {candidates.map((member) => (
                      <option key={member.account.id} value={member.account.id}>
                        {member.account.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" variant="outline" disabled={!toAdd} loading={addMembers.isPending}>
                  추가
                </Button>
              </form>
            )}
          </section>

          {(detail.permissions.leave || detail.permissions.delete) && (
            <div className="flex flex-wrap gap-2 border-t border-outline-soft pt-4">
              {detail.permissions.leave && (
                <Button variant="outline" onClick={() => setConfirm('leave')}>
                  방 나가기
                </Button>
              )}
              {detail.permissions.delete && (
                <Button variant="danger-ghost" onClick={() => setConfirm('delete')}>
                  방 삭제
                </Button>
              )}
            </div>
          )}
        </div>
      </Modal>
      <ConfirmModal
        open={confirm !== null}
        title={confirm === 'delete' ? '방 삭제' : '방 나가기'}
        description={confirm === 'delete' ? '방과 모든 메시지가 지워지고 되돌릴 수 없어요.' : '나가면 이 방의 메시지를 더 볼 수 없어요. 다시 들어오려면 멤버가 추가해 줘야 해요.'}
        confirmLabel={confirm === 'delete' ? '삭제하기' : '나가기'}
        pending={leave.isPending || remove.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          try {
            if (confirm === 'delete') await remove.mutateAsync();
            else await leave.mutateAsync();
            toast.success(confirm === 'delete' ? '방을 지웠어요.' : '방에서 나왔어요.');
            navigate(`/ws/${workspaceId}/chat`, { replace: true });
          } catch (error) {
            toast.error(errorMessage(error));
            setConfirm(null);
          }
        }}
      />
    </>
  );
};

/**
 * SCR-CHAT-01 채팅(15 §4.1~§4.2, §5.1). 메시지는 날짜별로 묶고, 보내기는 화면에 먼저 띄운 뒤 실패하면
 * "전송 실패" 표시와 다시 보내기 버튼을 남긴다(alert() 대체). 방에 들어오거나 새 메시지가 오면 읽음 처리한다.
 * 한글 입력 중(조합 중)에는 Enter로 보내지 않는다.
 */
export const ChatRoomScreen: React.FC = () => {
  const { wsId = '', roomId = '' } = useParams<{ wsId: string; roomId: string }>();
  const client = useQueryClient();
  const me = useMe();
  const room = useChatRoom(wsId, roomId);
  const messages = useMessages(wsId, roomId);
  const send = useSendMessage(wsId, roomId);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string>();
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<ChatMessage[] | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const count = messages.data?.length ?? 0;
  const ready = Boolean(messages.data && room.data);

  // 들어오거나 새 메시지가 오면 읽음 처리하고 목록의 안 읽은 수를 새로 고친다(15 §4.1).
  useEffect(() => {
    if (!ready) return;
    data.chat
      .markRead(wsId, roomId)
      .then(() => client.invalidateQueries({ queryKey: keys.chatRooms(wsId), exact: true }))
      .catch(() => undefined);
  }, [count, wsId, roomId, ready, client]);

  // 새 메시지가 오면 맨 아래로 내린다. 검색 결과로 이동한 직후에는 그 자리를 지킨다.
  useLayoutEffect(() => {
    if (highlight) return;
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [count, pending.length, highlight]);

  useEffect(() => {
    setPending([]);
    setResults(null);
    setSearchOpen(false);
    setHighlight(null);
  }, [roomId]);

  if (room.isLoading || messages.isLoading) return <LoadingState className="min-h-[60vh]" label="채팅방을 불러오는 중이에요" />;
  if (room.error instanceof DataError && room.error.code === 'NOT_FOUND') return <NotFoundScreen />;
  if (room.isError || messages.isError || !room.data || !messages.data) {
    return (
      <ErrorState
        className="min-h-[60vh]"
        title="채팅을 불러오지 못했어요"
        description="연결이 끊겼을 수 있어요. 다시 시도해 주세요."
        action={
          <Button
            onClick={() => {
              room.refetch();
              messages.refetch();
            }}
          >
            다시 연결
          </Button>
        }
      />
    );
  }

  const detail = room.data;
  const memberName = (id?: string) => detail.members.find((account) => account.id === id)?.name ?? '나간 멤버';
  const memberImage = (id?: string) => detail.members.find((account) => account.id === id)?.profileImageUrl;

  const deliver = async (item: PendingMessage) => {
    setPending((prev) => prev.map((entry) => (entry.tempId === item.tempId ? { ...entry, status: 'sending' } : entry)));
    try {
      const message = await send.mutateAsync(item.content);
      // 주기 조회가 먼저 가져왔을 수 있으니 이미 있으면 다시 붙이지 않는다.
      client.setQueryData<ChatMessage[]>(keys.messages(wsId, roomId), (prev) => (!prev ? [message] : prev.some((item) => item.id === message.id) ? prev : [...prev, message]));
      setPending((prev) => prev.filter((entry) => entry.tempId !== item.tempId));
    } catch {
      setPending((prev) => prev.map((entry) => (entry.tempId === item.tempId ? { ...entry, status: 'failed' } : entry)));
    }
  };

  const submit = () => {
    const error = validateMessage(draft);
    if (error) {
      setDraftError(draft.length > CHAT_LIMITS.messageMax ? error : undefined);
      return;
    }
    const item: PendingMessage = { tempId: `tmp-${Date.now()}`, content: draft.trim(), status: 'sending' };
    setPending((prev) => [...prev, item]);
    setDraft('');
    setDraftError(undefined);
    void deliver(item);
  };

  const runSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!keyword.trim()) return;
    try {
      setResults(await data.chat.searchMessages(wsId, roomId, keyword));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const jumpTo = (messageId: string) => {
    setHighlight(messageId);
    const element = document.getElementById(`msg-${messageId}`);
    element?.scrollIntoView({ block: 'center' });
    element?.focus();
    window.setTimeout(() => setHighlight((current) => (current === messageId ? null : current)), 2500);
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <header className="flex items-center gap-2 border-b border-outline-soft bg-surface px-3 py-2 sm:px-5">
        <Link to={`/ws/${wsId}/chat`} aria-label="채팅방 목록" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface-container lg:hidden">
          <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{detail.title}</h1>
          <p className="text-xs text-muted">멤버 {detail.members.length}명{detail.muted && ' · 알림 꺼짐'}</p>
        </div>
        <button
          type="button"
          aria-label="메시지 검색"
          aria-expanded={searchOpen}
          onClick={() => {
            setSearchOpen((value) => !value);
            setResults(null);
          }}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface-container"
        >
          <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" aria-label="방 설정" onClick={() => setSettingsOpen(true)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface-container">
          <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {searchOpen && (
        <div className="border-b border-outline-soft bg-surface-low px-3 py-3 sm:px-5">
          <form onSubmit={runSearch} className="flex gap-2" role="search">
            <label htmlFor="chat-search" className="sr-only">
              이 방에서 찾을 말
            </label>
            <input id="chat-search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="이 방에서 찾기" autoFocus className={fieldClassName(false, 'flex-1')} />
            <Button type="submit" variant="outline">
              찾기
            </Button>
          </form>
          {results && (
            <div className="mt-2">
              <p role="status" className="text-sm text-muted">
                {results.length === 0 ? '찾는 말이 들어간 메시지가 없어요.' : `${results.length}개를 찾았어요.`}
              </p>
              {results.length > 0 && (
                <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto">
                  {results.map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => jumpTo(item.id)} className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-container">
                        <span className="font-semibold">{memberName(item.authorId)}</span> <span className="text-xs text-muted">{dayLabel(item.createdAt)}</span>
                        <span className="block truncate">{item.content}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <div ref={logRef} role="log" aria-live="polite" aria-label={`${detail.title} 메시지`} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {messages.data.length === 0 && pending.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted">첫 메시지를 보내 보세요.</p>
        ) : (
          <ol className="space-y-1">
            {messages.data.map((message, index) => {
              const previous = messages.data[index - 1];
              const showDay = !previous || !sameDay(previous.createdAt, message.createdAt);
              const grouped = previous && previous.authorId === message.authorId && !showDay && message.authorId;
              const mine = message.authorId === me.data?.id;
              return (
                <li key={message.id}>
                  {showDay && (
                    <p className="my-3 text-center text-xs font-semibold text-muted">
                      <span className="rounded-full bg-surface-container px-3 py-1">{dayLabel(message.createdAt)}</span>
                    </p>
                  )}
                  {!message.authorId ? (
                    <p className="my-2 text-center text-xs text-muted">{message.content}</p>
                  ) : (
                    <div
                      id={`msg-${message.id}`}
                      tabIndex={-1}
                      className={`flex gap-2.5 rounded-lg px-2 py-1 focus:outline-none ${highlight === message.id ? 'bg-amber-50 ring-2 ring-warning' : mine ? 'bg-peri-50/60' : ''}`}
                    >
                      <span className="w-8 shrink-0">{!grouped && <Avatar name={memberName(message.authorId)} imageUrl={memberImage(message.authorId)} size="sm" />}</span>
                      <div className="min-w-0 flex-1">
                        {!grouped && (
                          <p className="text-sm">
                            <span className="font-semibold">{mine ? `${memberName(message.authorId)} (나)` : memberName(message.authorId)}</span>{' '}
                            <span className="text-xs text-muted">{time(message.createdAt)}</span>
                          </p>
                        )}
                        <p className="whitespace-pre-line break-words text-[0.9375rem] leading-6">{message.content}</p>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
            {pending.map((item) => (
              <li key={item.tempId}>
                <div className={`flex gap-2.5 rounded-lg px-2 py-1 ${item.status === 'failed' ? 'bg-red-50' : 'opacity-70'}`}>
                  <span className="w-8 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-line break-words text-[0.9375rem] leading-6">{item.content}</p>
                    {item.status === 'sending' ? (
                      <p className="text-xs text-muted">보내는 중</p>
                    ) : (
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-danger">
                        전송 실패
                        <button type="button" onClick={() => deliver(item)} className="inline-flex min-h-[32px] items-center gap-1 font-semibold underline underline-offset-2">
                          <ArrowPathIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          다시 보내기
                        </button>
                        <button
                          type="button"
                          onClick={() => setPending((prev) => prev.filter((entry) => entry.tempId !== item.tempId))}
                          className="inline-flex min-h-[32px] items-center gap-1 text-muted underline underline-offset-2"
                        >
                          <XMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          지우기
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <form
        className="border-t border-outline-soft bg-surface px-3 py-3 sm:px-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">
            메시지
          </label>
          <textarea
            id="chat-input"
            rows={1}
            value={draft}
            maxLength={CHAT_LIMITS.messageMax + 1}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="메시지 입력 (Shift+Enter 줄바꿈)"
            aria-invalid={draftError ? true : undefined}
            aria-describedby={draftError ? 'chat-input-error' : undefined}
            className={fieldClassName(Boolean(draftError), 'max-h-40 min-h-touch flex-1 resize-none leading-6')}
          />
          <Button type="submit" aria-label="보내기" disabled={!draft.trim()}>
            <PaperAirplaneIcon className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
        {draftError && (
          <p id="chat-input-error" className="mt-1 text-sm text-danger">
            {draftError}
          </p>
        )}
      </form>

      <RoomSettingsModal open={settingsOpen} workspaceId={wsId} roomId={roomId} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};
