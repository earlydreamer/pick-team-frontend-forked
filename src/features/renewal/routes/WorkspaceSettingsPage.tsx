import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Input } from '@/components/ui';
import { useRenewal } from '../context/RenewalContext';
import { useToast } from '@/components/ui/Toast';
import { MemberAvatar } from '../components/PeriwinkleArtwork';

export const WorkspaceSettingsPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const {
    getWorkspaceById,
    updateWorkspaceConfig,
    refreshInviteLink,
    toggleWorkspaceArchive,
    getWorkspaceMembers,
    kickWorkspaceMember,
    banWorkspaceMember,
  } = useRenewal();
  const { showToast } = useToast();

  const activeWs = getWorkspaceById(workspaceId);
  const wsId = activeWs.id;
  const members = getWorkspaceMembers(wsId);

  const [wsName, setWsName] = useState(activeWs.name);
  const [wsDesc, setWsDesc] = useState(activeWs.description || '');
  const inviteUrl = `${window.location.origin}/invite/${activeWs.inviteCode || 'KOSTA-295-PERI'}`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink-primary tracking-tight">
            워크스페이스 설정
          </h1>
          <p className="text-xs sm:text-sm text-ink-tertiary mt-1">
            기수 기본 정보와 초대 링크, 멤버 권한을 관리합니다.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(`/ws/${wsId}`)}>
          홈으로
        </Button>
      </div>

      <Card title="기본 정보">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateWorkspaceConfig(wsId, { name: wsName, description: wsDesc });
          }}
          className="space-y-4"
        >
          <Input
            label="워크스페이스 이름"
            name="wsName"
            value={wsName}
            onChange={(e) => setWsName(e.target.value)}
          />
          <Input
            label="설명"
            name="wsDesc"
            value={wsDesc}
            onChange={(e) => setWsDesc(e.target.value)}
          />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm">
              저장
            </Button>
          </div>
        </form>
      </Card>

      <Card title="초대 링크 관리">
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="flex-1 h-9 px-3 rounded-lg bg-surface-subtle border border-neutral-200 text-xs font-mono text-ink-primary"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(inviteUrl);
                showToast({ title: '초대 링크가 복사되었습니다.', variant: 'success' });
              }}
            >
              복사
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshInviteLink(wsId, '2026-11-30T23:59:59')}
            >
              링크 재발급
            </Button>
          </div>
          <p className="text-xs text-ink-tertiary">
            재발급하면 기존 초대 링크는 즉시 무효화됩니다.
          </p>
        </div>
      </Card>

      <Card title={`멤버 관리 (${members.length}명)`}>
        <div className="divide-y divide-neutral-100">
          {members.map((m) => (
            <div key={m.id} className="py-3 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <MemberAvatar name={m.name} size="sm" />
                <div>
                  <div className="font-semibold text-ink-primary">{m.name}</div>
                  <div className="text-ink-tertiary">{m.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => kickWorkspaceMember(wsId, m.id)}
                  className="text-ink-tertiary hover:text-ink-primary cursor-pointer"
                >
                  내보내기
                </button>
                <button
                  type="button"
                  onClick={() => banWorkspaceMember(wsId, m.id)}
                  className="text-rose-600 hover:underline cursor-pointer"
                >
                  차단
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="기수 아카이브 (읽기 전용 전환)">
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="text-ink-secondary">
            기수가 종료된 워크스페이스를 읽기 전용으로 보관합니다.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleWorkspaceArchive(wsId, !activeWs.archived)}
          >
            {activeWs.archived ? '아카이브 해제' : '아카이브 전환'}
          </Button>
        </div>
      </Card>
    </div>
  );
};
