import React, { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Button, Badge, Input } from '@/components/ui';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import { useRenewal } from '@/features/renewal/context/RenewalContext';
import { useToast } from '@/components/ui/Toast';

export const VideoConferencePage: React.FC = () => {
  const { workspaceId, channelId } = useParams<{ workspaceId: string; channelId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { getWorkspaceById } = useRenewal();
  const { showToast } = useToast();

  const activeWs = getWorkspaceById(workspaceId);
  const wsId = activeWs.id;

  const queryParams = new URLSearchParams(location.search);
  const roomNameFromQuery = queryParams.get('roomName');
  const roomTitle = roomNameFromQuery
    ? decodeURIComponent(roomNameFromQuery)
    : channelId === 'channel-alpha'
    ? '코드블루 (CodeBlue) 공식 화상회의 채널'
    : `팀 화상회의 라운지 (${channelId || 'live'})`;

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [sideChatOpen, setSideChatOpen] = useState(true);
  const [chatMsg, setChatMsg] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { id: 'v-1', sender: '이승우', text: '화면 공유로 ERD랑 칸반 보드 띄워놓았습니다!', time: '20:01' },
    { id: 'v-2', sender: '김민지', text: '오디오 잘 들립니다 👍', time: '20:02' },
  ]);

  const participants = [
    {
      id: '1',
      name: currentUser?.name || '박재현 (나)',
      role: '백엔드 · 인프라',
      speaking: isMicOn,
      isLocal: true,
    },
    { id: '3', name: '이승우 (팀장)', role: '풀스택 · 화면 공유중', speaking: true, isLocal: false },
    { id: '2', name: '김민지', role: '프론트엔드 · 디자인', speaking: false, isLocal: false },
  ];

  const handleRequestMediaCheck = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach((t) => t.stop());
      }
      setPermissionDenied(false);
      showToast({
        title: '카메라 및 마이크 권한이 정상 확인되었습니다',
        variant: 'success',
      });
    } catch {
      // Spec 15 §3 US-15-07 & §5.4: Clear recovery guide UI when media permission is denied
      setPermissionDenied(true);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    setChatHistory((prev) => [
      ...prev,
      {
        id: `v-${Date.now()}`,
        sender: currentUser?.name || '박재현',
        text: chatMsg.trim(),
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setChatMsg('');
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-peri-950 text-white flex flex-col">
      {/* Top Bar */}
      <div className="h-14 px-4 sm:px-6 bg-surface-rail border-b border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Badge variant="peri" size="xs">
            SCR-VID-01 · LiveKit WebRTC
          </Badge>
          <h1 className="text-sm sm:text-base font-extrabold text-white truncate">{roomTitle}</h1>
          <span className="hidden sm:inline-block text-xs text-peri-200 tabular-nums">
            · 참여자 {participants.length}명
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPermissionDenied((p) => !p)}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-peri-200 cursor-pointer"
          >
            {permissionDenied ? '권한 정상 상태로 복귀' : '미디어 권한 거부 안내 UI 확인 (US-15-07)'}
          </button>
          <Button
            variant="danger"
            size="xs"
            onClick={() => {
              showToast({
                title: '화상회의 채널에서 퇴장했습니다',
                description: 'LiveKit Room 연결 해제 및 VideoMember 세션 정리가 완료되었습니다. (15 §5.4)',
                variant: 'info',
              });
              navigate(`/ws/${wsId}/team/team-alpha`);
            }}
          >
            회의 나가기 ✕
          </Button>
        </div>
      </div>

      {/* Media Permission Denied Recovery Banner (Spec 15 §3 US-15-07 & §5.4) */}
      {permissionDenied && (
        <div className="p-4 sm:px-6 bg-amber-500/20 border-b border-amber-400/50 text-amber-100">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-sm font-extrabold text-amber-300">
                ⚠️ 브라우저 카메라/마이크 접근 권한이 거부되었습니다 (US-15-07)
              </div>
              <p className="text-xs leading-relaxed text-amber-100">
                주소창 왼쪽의 자물쇠(🔒) 아이콘을 클릭한 뒤 <strong>카메라 및 마이크 권한을 [허용]</strong>으로 변경하고 아래 재시도 버튼을 눌러주세요. 권한 없이도 관전 및 사이드 채팅 참여는 가능합니다.
              </p>
            </div>
            <Button variant="warning" size="xs" onClick={handleRequestMediaCheck}>
              권한 다시 요청하기
            </Button>
          </div>
        </div>
      )}

      {/* Main Stage + Side STOMP Chat */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-4 sm:p-6 flex flex-col gap-4 overflow-y-auto">
          {isScreenSharing && (
            <div className="w-full rounded-2xl bg-peri-900 border-2 border-peri-400 p-6 text-center space-y-2">
              <Badge variant="peri" size="xs">
                🖥️ 내 화면 공유 중 (LiveKit ScreenTrack)
              </Badge>
              <p className="text-sm font-bold text-white">
                현재 팀원들에게 내 화면이 실시간 송출되고 있습니다.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
            {participants.map((p) => (
              <div
                key={p.id}
                className={`relative rounded-3xl bg-peri-900/90 border-2 ${
                  p.speaking ? 'border-emerald-400 shadow-lg' : 'border-white/10'
                } min-h-[220px] flex flex-col items-center justify-center p-6`}
              >
                <div className="w-20 h-20 rounded-3xl bg-peri-600 text-white text-2xl font-black flex items-center justify-center shadow-md">
                  {p.name.charAt(0)}
                </div>
                <div className="mt-3 text-center">
                  <div className="text-sm font-extrabold text-white">{p.name}</div>
                  <div className="text-xs text-peri-200 mt-0.5">{p.role}</div>
                </div>

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-black/50 text-white font-semibold">
                    {p.isLocal ? (isCamOn ? '📷 카메라 켜짐' : '📷 카메라 꺼짐') : '📷 HD 수신중'}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-lg font-bold ${
                      p.speaking
                        ? 'bg-emerald-600/90 text-white'
                        : 'bg-black/50 text-peri-200'
                    }`}
                  >
                    {p.speaking ? '🎤 발언중' : '🔇 음소거'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Control Dock */}
          <div className="py-3 px-5 rounded-2xl bg-surface-rail border border-white/15 flex flex-wrap items-center justify-center gap-3 self-center">
            <Button
              variant={isMicOn ? 'primary' : 'danger'}
              size="sm"
              onClick={() => setIsMicOn((p) => !p)}
            >
              {isMicOn ? '🎤 마이크 켜짐' : '🔇 마이크 꺼짐'}
            </Button>
            <Button
              variant={isCamOn ? 'primary' : 'danger'}
              size="sm"
              onClick={() => setIsCamOn((p) => !p)}
            >
              {isCamOn ? '📷 카메라 켜짐' : '🚫 카메라 꺼짐'}
            </Button>
            <Button
              variant={isScreenSharing ? 'warning' : 'secondary'}
              size="sm"
              onClick={() => setIsScreenSharing((p) => !p)}
            >
              {isScreenSharing ? '🖥️ 화면 공유 중지' : '🖥️ 화면 공유'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSideChatOpen((p) => !p)}
            >
              💬 회의 채팅 {sideChatOpen ? '닫기' : '열기'}
            </Button>
          </div>
        </div>

        {/* Side Chat */}
        {sideChatOpen && (
          <aside className="w-full lg:w-80 bg-white text-ink-primary border-t lg:border-t-0 lg:border-l border-neutral-200 flex flex-col shrink-0">
            <div className="p-3.5 border-b border-neutral-200 font-extrabold text-sm flex items-center justify-between">
              <span>회의 실시간 채팅</span>
              <Badge variant="peri" size="xs">
                보안 토큰 헤더 인증 (15-D5)
              </Badge>
            </div>
            <div className="flex-1 p-3.5 space-y-2.5 overflow-y-auto max-h-64 lg:max-h-none">
              {chatHistory.map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 rounded-xl bg-surface-subtle border border-neutral-200 text-xs space-y-0.5"
                >
                  <div className="flex justify-between font-bold text-ink-primary">
                    <span>{m.sender}</span>
                    <span className="text-ink-tertiary font-normal tabular-nums">{m.time}</span>
                  </div>
                  <p className="text-ink-secondary">{m.text}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendChat} className="p-3 border-t border-neutral-200 flex gap-2">
              <Input
                name="chatMsg"
                placeholder="회의 메시지 입력..."
                value={chatMsg}
                onChange={(e) => setChatMsg(e.target.value)}
              />
              <Button type="submit" variant="primary" size="sm">
                전송
              </Button>
            </form>
          </aside>
        )}
      </div>
    </div>
  );
};

export default VideoConferencePage;
