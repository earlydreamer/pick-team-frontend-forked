import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import { useChat } from '../context/ChatContext';
import { Card, TextArea, Button } from '@/components/ui';
import { getFileUrl } from '@/lib/imageUtils';
import { XCircleIcon } from '@/assets/icons';

export const ChatPage: React.FC = () => {
  const { workspaceId, roomId } = useParams<{ workspaceId: string, roomId: string }>();
  const { currentUser } = useAuth();
  const { state, loadMessages, sendMessage, setCurrentChatRoomById } = useChat();
  const navigate = useNavigate();

  const [newMessage, setNewMessage] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentRoomId = roomId ? parseInt(roomId) : null;
  const messages = currentRoomId ? (state.messages[currentRoomId] || []) : [];

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (currentRoomId) {
      setCurrentChatRoomById(currentRoomId);
      loadMessages(currentRoomId);
    } else {
      if(workspaceId) navigate(`/ws/${workspaceId}`);
      else navigate('/');
    }
  }, [currentRoomId, currentUser, navigate, workspaceId, setCurrentChatRoomById, loadMessages]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!currentUser || !currentRoomId) return;
    if (newMessage.trim()) {
      try {
        await sendMessage(currentRoomId, newMessage.trim());
        setNewMessage('');
        setAttachedFile(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
      } catch (error) {
        console.error('메시지 전송 실패:', error);
        alert('메시지 전송에 실패했습니다.');
      }
    }
  }, [newMessage, currentUser, currentRoomId, sendMessage]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
        setAttachedFile(event.target.files[0]);
    }
  };
  
  if (!currentUser) return <p>로그인이 필요합니다.</p>;
  if (!currentRoomId) return <div className="p-4 text-center">채팅방을 불러오는 중이거나 선택된 채팅방이 없습니다...</div>;

  const chatRoomDisplayName = state.currentChatRoom?.name || `채팅방 ${currentRoomId}`;

  if (state.loading) {
    return <div className="p-4 text-center">로딩 중...</div>;
  }

  if (state.error) {
    return <div className="p-4 text-center text-red-500">{state.error}</div>;
  }

  return (
    <Card title={`대화: ${chatRoomDisplayName}`} className="flex flex-col h-[calc(100dvh-6.5rem)] lg:h-[calc(100dvh-4rem)]">
      <div className="flex-grow space-y-3 overflow-y-auto mb-3 pr-2 p-2 border border-neutral-200 rounded-md bg-neutral-50 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-neutral-100">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.userId === parseInt(currentUser.id.toString()) ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] p-2.5 rounded-lg shadow ${msg.userId === parseInt(currentUser.id.toString()) ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-800'}`}>
              {msg.attachment && (
                <div className="mb-1 p-2 border border-neutral-300 rounded bg-white/50">
                  {msg.attachment.type === 'image' ? (
                    <img src={getFileUrl(msg.attachment.url) || msg.attachment.url} alt={msg.attachment.fileName} className="max-w-xs max-h-48 rounded"/>
                  ) : (
                    <a href={getFileUrl(msg.attachment.url) || msg.attachment.url} target="_blank" rel="noopener noreferrer" className="text-sm underline flex items-center">
                      <XCircleIcon className="w-4 h-4 mr-1"/> {msg.attachment.fileName}
                    </a>
                  )}
                </div>
              )}
              {msg.text && <p className="text-sm whitespace-pre-line">{msg.text}</p>}
              <p className={`text-xs mt-1 ${msg.userId === parseInt(currentUser.id.toString()) ? 'text-blue-200 text-right' : 'text-neutral-500'}`}>
                {msg.userName}, {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
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
          <XCircleIcon className="w-5 h-5"/>
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
          <XCircleIcon className="w-5 h-5"/>
        </Button>
      </div>
    </Card>
  );
};
