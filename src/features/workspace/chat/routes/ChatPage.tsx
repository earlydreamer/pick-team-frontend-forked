import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Badge, Input } from '@/components/ui';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import { useRenewal } from '@/features/renewal/context/RenewalContext';
import { ReportModal } from '@/features/renewal/components/ReportModal';

interface ChatMessageItem {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
  type: 'TEXT' | 'SYSTEM';
  status: 'SENT' | 'FAILED';
  attachmentName?: string;
}

interface ChatRoomSummary {
  id: string;
  name: string;
  type: 'TEAM' | 'DM' | 'GROUP';
  unreadCount: number;
  memberNames: string[];
}

const INITIAL_ROOMS: ChatRoomSummary[] = [
  {
    id: 'team-team-alpha',
    name: '코드블루 (CodeBlue) 팀 채팅방',
    type: 'TEAM',
    unreadCount: 0,
    memberNames: ['이승우', '박재현', '김민지'],
  },
  {
    id: 'room-general',
    name: '295기 전체 오픈 라운지',
    type: 'GROUP',
    unreadCount: 2,
    memberNames: ['박강사', '박재현', '김민지', '이승우', '최수연', '정다은'],
  },
  {
    id: 'dm-2',
    name: 'DM · 김민지 (프론트엔드)',
    type: 'DM',
    unreadCount: 0,
    memberNames: ['박재현', '김민지'],
  },
  {
    id: 'dm-3',
    name: 'DM · 이승우 (팀장)',
    type: 'DM',
    unreadCount: 0,
    memberNames: ['박재현', '이승우'],
  },
];

const INITIAL_MESSAGES: ChatMessageItem[] = [
  {
    id: 'm-1',
    roomId: 'team-team-alpha',
    senderId: 'system',
    senderName: '시스템',
    text: '[팀 빌딩 확정] 코드블루 (CodeBlue) 팀 채팅방이 자동 생성되었습니다. (15-D3)',
    createdAt: '오전 09:00',
    type: 'SYSTEM',
    status: 'SENT',
  },
  {
    id: 'm-2',
    roomId: 'team-team-alpha',
    senderId: '3',
    senderName: '이승우',
    text: '안녕하세요 팀원분들! 팀 개요 탭에서 킥오프 체크리스트 확인하시고 오늘 20시 첫 회의 때 뵙겠습니다.',
    createdAt: '오전 09:15',
    type: 'TEXT',
    status: 'SENT',
  },
  {
    id: 'm-3',
    roomId: 'team-team-alpha',
    senderId: '2',
    senderName: '김민지',
    text: '@박재현 님, Very Peri(#6667AB) 디자인 토큰 CSS 변수 파일(src/index.css) 커밋 완료했습니다!',
    createdAt: '오전 10:42',
    type: 'TEXT',
    status: 'SENT',
  },
  {
    id: 'm-4',
    roomId: 'team-team-alpha',
    senderId: '1',
    senderName: '박재현',
    text: '확인했습니다! SSE 알림 센터 딥링크랑 칸반 완료 승인 큐까지 바로 연결해 둘게요.',
    createdAt: '오전 10:45',
    type: 'TEXT',
    status: 'SENT',
  },
  {
    id: 'm-5',
    roomId: 'room-general',
    senderId: '100',
    senderName: '박강사',
    text: '수강생 여러분, 팀 빌딩 마감까지 3일 남았습니다. 아직 PR 카드를 작성하지 않은 분은 오늘 중으로 완료해 주세요!',
    createdAt: '오전 11:00',
    type: 'TEXT',
    status: 'SENT',
  },
];

export const ChatPage: React.FC = () => {
  const { workspaceId, chatId } = useParams<{ workspaceId: string; chatId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { getWorkspaceById, notificationSettings, toggleMuteChatRoom } = useRenewal();

  const activeWs = getWorkspaceById(workspaceId);
  const wsId = activeWs.id;
  const isReadOnly = !!activeWs.archived;

  const [rooms, setRooms] = useState<ChatRoomSummary[]>(INITIAL_ROOMS);
  const [messages, setMessages] = useState<ChatMessageItem[]>(INITIAL_MESSAGES);
  const [textInput, setTextInput] = useState('');
  const [simulateSendFail, setSimulateSendFail] = useState(false);

  // Search bar & Right Room Settings Drawer (Spec 15 §4.1~4.2)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRoomTitle, setEditingRoomTitle] = useState('');
  const [inviteMemberName, setInviteMemberName] = useState('');

  // Report modal
  const [reportTargetMsg, setReportTargetMsg] = useState<ChatMessageItem | null>(null);

  const currentRoom =
    rooms.find((r) => r.id === chatId) || rooms[0];
  const isMuted = notificationSettings.mutedChatRoomIds.includes(currentRoom.id);

  const roomMessages = useMemo(() => {
    const base = messages.filter(
      (m) => m.roomId === currentRoom.id || (m.roomId === 'team-team-alpha' && !rooms.some((r) => r.id === chatId))
    );
    if (!searchKeyword.trim()) return base;
    return base.filter((m) =>
      m.text.toLowerCase().includes(searchKeyword.trim().toLowerCase()) ||
      m.senderName.toLowerCase().includes(searchKeyword.trim().toLowerCase())
    );
  }, [messages, currentRoom.id, chatId, rooms, searchKeyword]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isReadOnly) return;

    const newMsg: ChatMessageItem = {
      id: `m-${Date.now()}`,
      roomId: currentRoom.id,
      senderId: String(currentUser?.id || '1'),
      senderName: currentUser?.name || '박재현',
      text: textInput.trim(),
      createdAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      type: 'TEXT',
      status: simulateSendFail ? 'FAILED' : 'SENT',
    };

    setMessages((prev) => [...prev, newMsg]);
    setTextInput('');
  };

  // Spec 15 §5.1 US-15-03: Retry failed message inline without alert()
  const handleRetryMessage = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, status: 'SENT' } : m))
    );
  };

  // Spec 15 §5.1 US-15-02: Real-time member join/leave event simulation (CHAT_MEMBER_JOINED / LEFT)
  const handleAddMemberToRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const name = inviteMemberName.trim() || '정다은';
    setRooms((prev) =>
      prev.map((r) =>
        r.id === currentRoom.id && !r.memberNames.includes(name)
          ? { ...r, memberNames: [...r.memberNames, name] }
          : r
      )
    );
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        roomId: currentRoom.id,
        senderId: 'system',
        senderName: '시스템',
        text: `[${name}] 님이 채팅방에 참여했습니다. (SSE CHAT_MEMBER_JOINED)`,
        createdAt: '방금 전',
        type: 'SYSTEM',
        status: 'SENT',
      },
    ]);
    setInviteMemberName('');
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col md:flex-row overflow-hidden bg-surface-canvas">
      {/* Left Room List Sidebar */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-neutral-200 flex flex-col shrink-0">
        <div className="p-3.5 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-peri-600">
              SCR-CHAT-01 · SSE 메신저
            </span>
            <h2 className="text-sm font-extrabold text-ink-primary">채팅방 · DM 목록</h2>
          </div>
          <Badge variant="success" size="xs">
            SSE 연결됨
          </Badge>
        </div>

        <div className="flex md:flex-col overflow-x-auto md:overflow-y-auto p-2 gap-1">
          {rooms.map((room) => {
            const active = room.id === currentRoom.id;
            const muted = notificationSettings.mutedChatRoomIds.includes(room.id);
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => {
                  setRooms((prev) =>
                    prev.map((r) => (r.id === room.id ? { ...r, unreadCount: 0 } : r))
                  );
                  navigate(`/ws/${wsId}/chat/${room.id}`);
                }}
                className={`px-3 py-2.5 rounded-xl text-left flex items-center justify-between gap-2 whitespace-nowrap md:whitespace-normal transition-colors cursor-pointer shrink-0 ${
                  active
                    ? 'bg-peri-600 text-white font-bold shadow-xs'
                    : 'text-ink-secondary hover:bg-peri-50'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate flex items-center gap-1.5">
                    <span>{room.type === 'DM' ? '💬' : '🗪'}</span>
                    <span className="truncate">{room.name}</span>
                  </div>
                  <div
                    className={`text-[11px] mt-0.5 ${
                      active ? 'text-peri-100' : 'text-ink-tertiary'
                    }`}
                  >
                    멤버 {room.memberNames.length}명 {muted && '· 🔕 음소거됨'}
                  </div>
                </div>
                {room.unreadCount > 0 && !muted && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold tabular-nums">
                    {room.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Center Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Chat Room Header */}
        <div className="h-14 px-4 border-b border-neutral-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm sm:text-base font-extrabold text-ink-primary truncate">
              {currentRoom.name}
            </h1>
            <Badge variant="neutral" size="xs">
              {currentRoom.memberNames.length}명
            </Badge>
            {isMuted && (
              <Badge variant="warning" size="xs">
                🔕 알림 음소거 중
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSimulateSendFail((p) => !p)}
              className={`hidden sm:inline-flex px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                simulateSendFail
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-surface-subtle text-ink-tertiary border-neutral-200'
              }`}
              title="전송 실패 시 인라인 재전송 버튼(US-15-03) 테스트"
            >
              {simulateSendFail ? '전송실패 시뮬레이션 ON' : '전송실패 테스트'}
            </button>

            <Button
              variant={searchOpen ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setSearchOpen((prev) => !prev)}
            >
              🔍 검색
            </Button>

            <Button
              variant={drawerOpen ? 'primary' : 'outline'}
              size="xs"
              onClick={() => {
                setEditingRoomTitle(currentRoom.name);
                setDrawerOpen((prev) => !prev);
              }}
            >
              ⚙️ 방 설정
            </Button>
          </div>
        </div>

        {/* In-Room Keyword Search Bar (Spec 15 §4.2 US-15-05) */}
        {searchOpen && (
          <div className="px-4 py-2.5 bg-peri-50/70 border-b border-peri-200 flex items-center gap-2">
            <Input
              name="searchKeyword"
              placeholder="이 채팅방 내 메시지 키워드 또는 작성자 검색..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
            {searchKeyword && (
              <Button variant="ghost" size="xs" onClick={() => setSearchKeyword('')}>
                초기화
              </Button>
            )}
          </div>
        )}

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-canvas/50">
          {roomMessages.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="text-2xl">💬</div>
              <p className="text-sm font-bold text-ink-primary">
                {searchKeyword
                  ? `"${searchKeyword}" 검색 결과가 없습니다.`
                  : '첫 메시지를 보내 대화를 시작해 보세요!'}
              </p>
            </div>
          ) : (
            roomMessages.map((msg) => {
              if (msg.type === 'SYSTEM') {
                return (
                  <div key={msg.id} className="text-center my-2">
                    <span className="inline-block px-3 py-1 rounded-full bg-peri-100/80 text-peri-800 text-xs font-semibold">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              const isMe = String(msg.senderId) === String(currentUser?.id || '1');
              const isFailed = msg.status === 'FAILED';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-xs font-bold text-ink-secondary">{msg.senderName}</span>
                    <span className="text-[11px] text-ink-tertiary tabular-nums">{msg.createdAt}</span>
                    {!isMe && (
                      <button
                        type="button"
                        onClick={() => setReportTargetMsg(msg)}
                        className="text-[10px] text-ink-tertiary hover:text-red-700 cursor-pointer"
                      >
                        신고
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 max-w-[80%] sm:max-w-[70%]">
                    {isFailed && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 shrink-0">
                        <span>전송 실패</span>
                        <button
                          type="button"
                          onClick={() => handleRetryMessage(msg.id)}
                          className="underline text-rose-900 hover:text-rose-700 cursor-pointer"
                        >
                          🔄 재전송
                        </button>
                      </div>
                    )}

                    <div
                      className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                        isFailed
                          ? 'bg-neutral-200 text-ink-tertiary border border-dashed border-rose-400'
                          : isMe
                          ? 'bg-peri-600 text-white rounded-br-xs'
                          : 'bg-white text-ink-primary border border-neutral-200 rounded-bl-xs'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Message Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 sm:p-4 bg-white border-t border-neutral-200 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            disabled={isReadOnly}
            placeholder={
              isReadOnly
                ? '아카이브된 워크스페이스에서는 메시지를 보낼 수 없습니다.'
                : '메시지를 입력하세요 (@이름 으로 멘션 시 상대방 음소거 무시 알림 발송)...'
            }
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-surface-subtle/70 focus:bg-white border border-neutral-300 focus:border-peri-600 focus:outline-none text-sm text-ink-primary"
          />
          <Button type="submit" variant="primary" size="md" disabled={isReadOnly || !textInput.trim()}>
            전송
          </Button>
        </form>
      </div>

      {/* Right Room Settings Drawer (Spec 15 §4.1) */}
      {drawerOpen && (
        <aside className="w-full md:w-80 bg-white border-l border-neutral-200 p-4 space-y-5 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <h3 className="text-sm font-extrabold text-ink-primary">채팅방 상세 설정 (15 §4.1)</h3>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="text-xs font-bold text-ink-tertiary hover:text-ink-primary cursor-pointer"
            >
              닫기 ✕
            </button>
          </div>

          {/* Room Mute Toggle (US-15-04 & 16 §4.3) */}
          <div className="p-3.5 rounded-xl bg-surface-subtle border border-neutral-200 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-ink-primary">이 채팅방 알림 음소거</div>
              <div className="text-[11px] text-ink-tertiary">
                OFF 시 일반 메시지 알림을 받지 않습니다.
              </div>
            </div>
            <Button
              variant={isMuted ? 'warning' : 'outline'}
              size="xs"
              onClick={() => toggleMuteChatRoom(currentRoom.id)}
            >
              {isMuted ? '🔕 음소거 해제' : '🔔 알림 켜짐'}
            </Button>
          </div>

          {/* Edit Room Title */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingRoomTitle.trim()) return;
              setRooms((prev) =>
                prev.map((r) =>
                  r.id === currentRoom.id ? { ...r, name: editingRoomTitle.trim() } : r
                )
              );
            }}
            className="space-y-2"
          >
            <Input
              label="채팅방 이름 변경"
              name="editingRoomTitle"
              value={editingRoomTitle}
              onChange={(e) => setEditingRoomTitle(e.target.value)}
            />
            <Button type="submit" variant="secondary" size="xs" fullWidth>
              방 제목 저장
            </Button>
          </form>

          {/* Room Members & Real-time Join Event */}
          <div className="space-y-2.5 pt-2 border-t border-neutral-200">
            <div className="text-xs font-extrabold uppercase tracking-wider text-ink-tertiary">
              참여 멤버 ({currentRoom.memberNames.length}명)
            </div>
            <div className="space-y-1.5">
              {currentRoom.memberNames.map((name) => (
                <div
                  key={name}
                  className="px-3 py-2 rounded-xl bg-surface-subtle/60 border border-neutral-200 flex items-center justify-between text-xs font-bold text-ink-primary"
                >
                  <span>{name}</span>
                  <Badge variant="peri" size="xs">
                    참여중
                  </Badge>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddMemberToRoom} className="flex gap-1.5 pt-1">
              <Input
                name="inviteMemberName"
                placeholder="초대할 멤버 이름 (예: 정다은)"
                value={inviteMemberName}
                onChange={(e) => setInviteMemberName(e.target.value)}
              />
              <Button type="submit" variant="primary" size="sm">
                추가
              </Button>
            </form>
          </div>
        </aside>
      )}

      {reportTargetMsg && (
        <ReportModal
          isOpen={!!reportTargetMsg}
          onClose={() => setReportTargetMsg(null)}
          workspaceId={wsId}
          targetType="MESSAGE"
          targetId={reportTargetMsg.id}
          targetLabel={`${reportTargetMsg.senderName} 님의 채팅 메시지`}
          targetContentSnippet={reportTargetMsg.text}
        />
      )}
    </div>
  );
};

export default ChatPage;
