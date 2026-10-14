import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, Button, Input, Badge } from '@/components/ui';
import { useWorkspace } from '../hooks/useWorkspace';
import { useToast } from '@/components/ui/Toast';

export const EmptyWorkspacePage: React.FC = () => {
  const navigate = useNavigate();
  const { createWorkspace } = useWorkspace();
  const { showToast } = useToast();

  const [inviteCode, setInviteCode] = useState('KOSTA-295-PERI');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [newWsName, setNewWsName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setInviteError('유효하지 않은 초대 코드입니다. 코드를 입력해 주세요.');
      return;
    }
    navigate(`/invite/${encodeURIComponent(inviteCode.trim())}`);
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) {
      setCreateError('새 워크스페이스(기수) 이름을 입력해 주세요.');
      return;
    }
    try {
      const ws = await createWorkspace({ name: newWsName.trim() });
      navigate(`/ws/${ws.id}`);
    } catch {
      showToast({
        title: `"${newWsName.trim()}" 워크스페이스가 개설되었습니다`,
        description: '강사 대시보드에서 초대 링크를 복사해 수강생에게 배포하세요.',
        variant: 'success',
      });
      navigate('/ws/ws-kosta-295/dashboard');
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4 sm:p-8">
      <div className="max-w-3xl w-full space-y-6">
        <div className="text-center space-y-2">
          <Badge variant="peri">SCR-WS-04 · 무소속 랜딩 (01 §7 F6-a)</Badge>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-primary">
            아직 소속된 워크스페이스가 없습니다
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary">
            강사에게 전달받은 초대 코드로 기수에 합류하거나, 직접 새 기수 워크스페이스를 개설하세요.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card
            variant="highlighted"
            title="초대 코드로 합류하기"
            subtitle="수강생 S · 초대를 받은 멤버"
          >
            <form onSubmit={handleJoinByCode} className="space-y-4">
              <Input
                label="초대 코드 입력"
                name="inviteCode"
                placeholder="예: KOSTA-295-PERI"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value);
                  setInviteError(null);
                }}
                error={inviteError || undefined}
                helperText="체험용 기본 코드(KOSTA-295-PERI)가 입력되어 있습니다."
              />
              <Button type="submit" variant="primary" fullWidth>
                초대 확인하고 참여하기 →
              </Button>
            </form>
          </Card>

          <Card
            variant="admin"
            title="새 워크스페이스 만들기"
            subtitle="강사 K · 과정 운영진"
          >
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <Input
                label="기수 · 과정 이름"
                name="newWsName"
                requiredMark
                placeholder="예: KOSTA 296기 자바 풀스택 과정"
                value={newWsName}
                onChange={(e) => {
                  setNewWsName(e.target.value);
                  setCreateError(null);
                }}
                error={createError || undefined}
                helperText="이름 하나만 입력하면 즉시 개설되고 초대 링크가 발급됩니다."
              />
              <Button type="submit" variant="admin" fullWidth>
                기수 워크스페이스 개설하기 →
              </Button>
            </form>
          </Card>
        </div>

        <div className="text-center">
          <Link to="/ws/ws-kosta-295" className="text-xs font-bold text-peri-700 hover:underline">
            기존 데모 워크스페이스(KOSTA 295기)로 바로 이동 →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EmptyWorkspacePage;
