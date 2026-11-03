import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import { useWorkspace } from '@/features/workspace/core/hooks/useWorkspace';
import { useChat } from '../context/ChatContext';
import { Card, TextArea, Button } from '@/components/ui';
import { PlusCircleIcon, XCircleIcon } from '@/assets/icons';
import Linkify from 'react-linkify';
import { chatLogger } from '../utils/chatLogger';
import { getFileUrl } from '@/lib/imageUtils';

// 메시지 컴포넌트를 memo로 최적화하여 깜빡거림 방지
const MessageItem = memo<{
  msg: any;
  currentUserId: number;
  currentWorkspace: any;
  onDeleteMessage: (messageId: number) => void;
}>(({ msg, currentUserId, currentWorkspace, onDeleteMessage }) => {
  const [isHovering, setIsHovering] = useState(false);

  // 삭제 권한 확인: 메시지 작성자 또는 워크스페이스 관리자
  const canDeleteMessage = () => {
    // 메시지 작성자인지 확인
    if (msg.userId === parseInt(currentUserId.toString())) {
      return true;
    }

    // 워크스페이스 관리자인지 확인
    if (currentWorkspace) {
      // 워크스페이스 소유자인지 확인
      if (currentWorkspace.owner && currentWorkspace.owner.id === currentUserId) {
        return true;
      }

      // 멤버 목록에서 현재 사용자의 역할 확인
      if (currentWorkspace.members) {
        const currentMember = currentWorkspace.members.find((member: any) => 
          member.id === currentUserId
        );
        if (currentMember && currentMember.role === 'ADMIN') {
          return true;
        }
      }
    }

    return false;
  };

  const handleDeleteClick = () => {
    if (window.confirm('이 메시지를 삭제하시겠습니까?')) {
      onDeleteMessage(msg.id);
    }
  };

  return (
    <div 
      className={`flex ${msg.userId === parseInt(currentUserId.toString()) ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className={`max-w-[70%] p-2.5 rounded-lg shadow relative ${msg.userId === parseInt(currentUserId.toString()) ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-800'}`}>
        {/* 삭제 버튼 */}
        {isHovering && canDeleteMessage() && (
          <button
            onClick={handleDeleteClick}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs transition-colors z-10"
            title="메시지 삭제"
          >
            ×
          </button>
        )}
        
        {msg.attachment && (
          <div className="mb-1 p-2 border border-neutral-300 rounded bg-white/50">
            {msg.attachment.type === 'image' ? (
              <img src={getFileUrl(msg.attachment.url) || msg.attachment.url} alt={msg.attachment.fileName} className="max-w-xs max-h-48 rounded"/>
            ) : (
              <a href={getFileUrl(msg.attachment.url) || msg.attachment.url} target="_blank" rel="noopener noreferrer" className="text-sm underline flex items-center">
                <PlusCircleIcon className="w-4 h-4 mr-1"/> {msg.attachment.fileName}
              </a>
            )}
          </div>
        )}
        {msg.text && (
          <p className="text-sm whitespace-pre-line">
            <Linkify componentDecorator={(decoratedHref: string, decoratedText: string, key: number) => (
              <a target="_blank" rel="noopener noreferrer" href={decoratedHref} key={key} className="text-blue-300 hover:underline">
                {decoratedText}
              </a>
            )}>
              {msg.text}
            </Linkify>
          </p>
        )}
        <p className={`text-xs mt-1 ${msg.userId === parseInt(currentUserId.toString()) ? 'text-blue-200 text-right' : 'text-neutral-500'}`}>
          {msg.userName || msg.senderName}, {(() => {
            // timestamp 처리를 더 안전하게 개선
            let messageDate: Date;
            
            // 1. timestamp가 이미 Date 객체인 경우
            if (msg.timestamp instanceof Date && !isNaN(msg.timestamp.getTime())) {
              messageDate = msg.timestamp;
            }
            // 2. createdAt 문자열을 사용
            else if (msg.createdAt) {
              messageDate = new Date(msg.createdAt);
            }
            // 3. 모든 방법이 실패한 경우
            else {
              chatLogger.ui.warn(`메시지 ${msg.id} 타임스탬프 정보 없음`, { timestamp: msg.timestamp, createdAt: msg.createdAt });
              return '시간 정보 없음';
            }
            
            // 유효한 Date 객체인지 검증
            if (isNaN(messageDate.getTime())) {
              chatLogger.ui.warn(`메시지 ${msg.id} 잘못된 타임스탬프`, { timestamp: msg.timestamp, createdAt: msg.createdAt, messageDate });
              return '시간 정보 없음';
            }
            
            return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          })()}
        </p>
      </div>
    </div>
  );
});

export const ChatPage: React.FC = () => {
  const { workspaceId, chatId } = useParams<{ workspaceId: string, chatId: string }>();
  const { currentUser } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { state, loadMessages, sendMessage, deleteMessage, setCurrentChatRoomById } = useChat();
  const navigate = useNavigate();

  const [newMessage, setNewMessage] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentRoomId = chatId ? parseInt(chatId) : null;
  const messages = currentRoomId ? (state.messages[currentRoomId] || []) : [];
  
  // 메시지 페이지네이션 상태 관리
  const [loadedMessageCount, setLoadedMessageCount] = useState(100);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // 표시할 메시지 계산 (동적 로딩)
  const displayMessages = useMemo(() => {
    if (messages.length <= loadedMessageCount) {
      return messages; // 모든 메시지 표시
    }
    return messages.slice(-loadedMessageCount); // 최근 N개만 표시
  }, [messages, loadedMessageCount]);
  
  // 이전 메시지 로드 함수
  const loadMoreMessages = useCallback(() => {
    if (isLoadingMore || messages.length <= loadedMessageCount) return;
    
    setIsLoadingMore(true);
    // 추가로 50개씩 로드
    setTimeout(() => {
      setLoadedMessageCount(prev => Math.min(prev + 50, messages.length));
      setIsLoadingMore(false);
    }, 100); // 약간의 지연으로 로딩 효과
  }, [isLoadingMore, messages.length, loadedMessageCount]);

  // 새 메시지가 추가될 때 로드된 메시지 수 자동 조정
  useEffect(() => {
    // 새 메시지가 추가되면 표시 범위도 함께 확장
    if (messages.length > loadedMessageCount) {
      const newMessagesCount = messages.length - loadedMessageCount;
      if (newMessagesCount > 0) {
        // 새 메시지만큼 로드된 메시지 수 증가
        setLoadedMessageCount(prev => prev + newMessagesCount);
      }
    }
  }, [messages.length, loadedMessageCount]);

  useEffect(() => {
    chatLogger.ui.debug('ChatPage useEffect 실행', { 
      currentRoomId, 
      currentUser: currentUser?.id, 
      workspaceId,
      currentWorkspace: currentWorkspace?.id 
    });
    
    const initializeChat = async () => {
      if (!currentUser) {
        chatLogger.ui.warn('사용자 없음, 로그인 페이지로 이동');
        navigate('/login');
        return;
      }

      if (!currentWorkspace) {
        chatLogger.ui.debug('워크스페이스 로딩 중... 기다리는 중');
        return;
      }
      
      if (currentRoomId) {
        chatLogger.ui.info('채팅방 ID로 초기화 시도', { currentRoomId });
        
        // 새 채팅방으로 변경될 때 메시지 로드 카운트 리셋
        setLoadedMessageCount(100);
        setIsLoadingMore(false);
        
        try {
          await setCurrentChatRoomById(currentRoomId);
          await loadMessages(currentRoomId);
          chatLogger.ui.info('채팅 초기화 완료');
        } catch (error) {
          chatLogger.ui.error('채팅 초기화 실패', error);
        }
      } else {
        chatLogger.ui.warn('채팅방 ID 없음, 워크스페이스 홈으로 이동');
        if(workspaceId) navigate(`/ws/${workspaceId}`);
        else navigate('/');
      }
    };
    
    initializeChat();
  }, [currentRoomId, currentUser?.id, currentWorkspace?.id, navigate, workspaceId]); // currentWorkspace.id 추가
  
  // 스크롤 최적화: 메시지가 추가될 때만 스크롤
  useEffect(() => {
    const shouldScroll = messages.length > 0;
    if (shouldScroll) {
      // requestAnimationFrame을 사용해 DOM 업데이트 후 스크롤
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [messages.length]); // messages 배열 전체가 아닌 길이만 감시

  const handleSendMessage = useCallback(async () => {
    if (!currentUser || !currentRoomId) return;
    if (newMessage.trim()) {
      const messageContent = newMessage.trim();
      
      // 입력창을 먼저 비우고 포커스 유지
      setNewMessage('');
      setAttachedFile(null);
      if(fileInputRef.current) fileInputRef.current.value = "";
      
      try {
        await sendMessage(currentRoomId, messageContent);
      } catch (error) {
        chatLogger.ui.error('메시지 전송 실패', error);
        // 전송 실패 시 메시지를 복원하지 않음 (이미 임시 메시지로 표시됨)
        alert('메시지 전송에 실패했습니다. 네트워크 연결을 확인해주세요.');
      }
    }
  }, [newMessage, currentUser, currentRoomId, sendMessage]);
  
  // 메시지 삭제 핸들러
  const handleDeleteMessage = useCallback(async (messageId: number) => {
    if (!currentRoomId) return;
    
    try {
      await deleteMessage(currentRoomId, messageId);
    } catch (error) {
      chatLogger.ui.error('메시지 삭제 실패', error);
      alert('메시지 삭제에 실패했습니다. 다시 시도해주세요.');
    }
  }, [currentRoomId, deleteMessage]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
        setAttachedFile(event.target.files[0]);
    }
  };

  // 채팅방 이름 표시 함수
  const getChatRoomDisplayName = () => {
    if (!state.currentChatRoom) return '채팅방';
    
    const room = state.currentChatRoom;
    
    // DM 채팅방인 경우 상대방 이름으로 표시
    if (room.type === 'PERSONAL') {
      // 멤버 정보에서 상대방 찾기 (백엔드 이름은 무시)
      if (room.members && room.members.length > 0 && currentUser) {
        const otherMember = room.members.find(member => {
          // account 필드로 비교 (백엔드 구조에 맞춤)
          return member.account !== undefined && 
                 member.account !== null && 
                 Number(member.account) !== Number(currentUser.id);
        });
        
        if (otherMember) {
          // 수정된 필드명으로 이름 가져오기
          const displayName = otherMember.name || `사용자 ${otherMember.account}`;
          return displayName;
        }
      }
      
      // 멤버 정보가 없는 경우에만 백엔드 이름 확인
      if (room.name && room.name.trim() !== '' && room.name !== 'DM' && !room.name.includes('대화:')) {
        return room.name;
      }
      
      // 모든 방법이 실패한 경우 임시 표시
      return `DM ${room.id}`;
    }
    
    // 그룹 채팅방은 기본 이름 사용
    return room.name || `그룹 채팅 ${room.id}`;
  };
  
  if (!currentUser) return <p className="p-6">로그인이 필요합니다.</p>;
  if (!currentWorkspace) return <div className="p-4 text-center">워크스페이스를 로딩 중...</div>;
  if (!currentRoomId) return <div className="p-4 text-center">채팅방을 불러오는 중이거나 선택된 채팅방이 없습니다...</div>;

  if (state.loading) {
    return <div className="p-4 text-center">로딩 중...</div>;
  }

  // 에러 표시 조건을 더 엄격하게 - 현재 채팅방에 대한 에러인지 확인
  if (state.error && !state.loading && messages.length === 0) {
    return <div className="p-4 text-center text-red-500">{state.error}</div>;
  }

  return (
    <div className="flex">
      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        <Card title={`대화: ${getChatRoomDisplayName()}`} className="flex flex-col h-[calc(100dvh-6.5rem)] lg:h-[calc(100dvh-4rem)]">
          <div className="flex-grow space-y-3 overflow-y-auto mb-3 pr-2 p-2 border border-neutral-200 rounded-md bg-neutral-50 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-neutral-100">
            {/* 이전 메시지 더보기 버튼 */}
            {messages.length > loadedMessageCount && (
              <div className="text-center py-3">
                <button
                  onClick={loadMoreMessages}
                  disabled={isLoadingMore}
                  className="px-4 py-2 text-sm bg-neutral-100 hover:bg-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400 rounded-lg border border-neutral-300 transition-colors"
                >
                  {isLoadingMore ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      로딩 중...
                    </span>
                  ) : (
                    `이전 메시지 ${messages.length - loadedMessageCount}개 더 보기`
                  )}
                </button>
              </div>
            )}
            
            {displayMessages.length > 0 ? (
              displayMessages.map(msg => (
                <MessageItem 
                  key={msg.id} 
                  msg={msg} 
                  currentUserId={currentUser.id} 
                  currentWorkspace={currentWorkspace}
                  onDeleteMessage={handleDeleteMessage}
                />
              ))
            ) : (
              <div className="text-center text-neutral-500 py-8">
                메시지가 없습니다. 첫 번째 메시지를 보내보세요!
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {attachedFile && (
            <div className="p-2 border-t border-neutral-200 text-sm text-neutral-600 flex justify-between items-center">
              <span>첨부 파일: {attachedFile.name} ({(attachedFile.size / 1024).toFixed(1)} KB)</span>
              <button onClick={() => {setAttachedFile(null); if(fileInputRef.current) fileInputRef.current.value = "";}} className="text-red-500 hover:text-red-700">
                <XCircleIcon className="w-5 h-5"/>
              </button>
            </div>
          )}
          <div className="flex items-center space-x-2 pt-2 border-t border-neutral-200">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" id="chat-file-input"/>
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} title="파일 첨부">
              <PlusCircleIcon className="w-5 h-5"/>
            </Button>
            <TextArea 
              value={newMessage} 
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
              placeholder="메시지 입력... (Shift+Enter로 줄바꿈)" 
              className="flex-grow !py-2"
              rows={1} 
              aria-label="메시지 입력창"
            />
            <Button onClick={handleSendMessage} title="전송 (Enter)" size="sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
