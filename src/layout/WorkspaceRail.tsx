import React, { useState } from 'react';
import { Link, useMatch, useNavigate } from 'react-router-dom';
import { PlusIcon, LinkIcon } from '@heroicons/react/24/outline';
import { useWorkspace } from '@/features/workspace/core/hooks/useWorkspace';
import CreateWorkspaceModal from '@/features/workspace/management/components/CreateWorkspaceModal';
import JoinWorkspaceModal from '@/features/workspace/management/components/JoinWorkspaceModal';
import { getWorkspaceIconSrc } from '@/lib/imageUtils';
import { initialOf } from '@/components/ui';
import { BrandMark } from './BrandMark';
import { AccountMenu } from './AccountMenu';
import type { Workspace } from '@/types';

const railButton =
  'relative flex h-11 w-11 items-center justify-center rounded-[12px] text-sm font-bold transition-colors';

const WorkspaceIcon: React.FC<{ workspace: Workspace; active: boolean }> = ({ workspace, active }) => {
  const iconSrc = getWorkspaceIconSrc(workspace.iconUrl);
  return (
    <span
      className={`${railButton} overflow-hidden ${
        active
          ? 'bg-primary text-on-primary ring-2 ring-primary ring-offset-2 ring-offset-surface-low'
          : 'bg-surface text-on-primary-container ring-1 ring-outline-soft group-hover:bg-primary-container'
      }`}
    >
      {iconSrc ? <img src={iconSrc} alt="" className="h-full w-full object-cover" /> : initialOf(workspace.name)}
    </span>
  );
};

/**
 * 워크스페이스 레일: 소속 워크스페이스 전환과 추가·참여, 계정 메뉴를 담습니다.
 * 데스크톱에서는 화면 왼쪽에 고정되고, 모바일에서는 탐색 서랍 안에 표시됩니다.
 */
export const WorkspaceRail: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { workspaces, currentWorkspace, loading } = useWorkspace();
  const navigate = useNavigate();
  // 워크스페이스 밖 화면(마이페이지·초대 등)에서는 선택 표시를 하지 않습니다.
  const inWorkspace = useMatch('/ws/:workspaceId/*') !== null;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  const homePath = currentWorkspace ? `/ws/${currentWorkspace.id}` : '/';

  return (
    <>
      <nav
        aria-label="워크스페이스"
        className="flex h-full w-[72px] shrink-0 flex-col items-center gap-2 border-r border-outline-soft bg-surface-low py-3"
      >
        <Link to={homePath} onClick={onNavigate} aria-label="Pick Team 홈" className="mb-1 rounded-[12px]">
          <BrandMark className="h-11 w-11" />
        </Link>
        <div className="h-px w-8 bg-outline-soft" aria-hidden="true" />

        <ul className="flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto py-1">
          {loading ? (
            <li className="h-11 w-11 animate-pulse rounded-[12px] bg-surface-container" aria-label="워크스페이스를 불러오는 중" />
          ) : (
            workspaces.map((ws) => {
              const active = inWorkspace && currentWorkspace?.id === ws.id;
              return (
                <li key={ws.id}>
                  <button
                    type="button"
                    className="group rounded-[12px]"
                    aria-label={ws.name}
                    aria-current={active ? 'page' : undefined}
                    title={ws.name}
                    onClick={() => {
                      onNavigate?.();
                      navigate(`/ws/${ws.id}`);
                    }}
                  >
                    <WorkspaceIcon workspace={ws} active={active} />
                  </button>
                </li>
              );
            })
          )}
          <li>
            <button
              type="button"
              title="워크스페이스 만들기"
              aria-label="워크스페이스 만들기"
              className={`${railButton} border border-dashed border-outline text-primary hover:bg-primary-container`}
              onClick={() => setIsCreateOpen(true)}
            >
              <PlusIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </li>
          <li>
            <button
              type="button"
              title="초대 코드로 참여"
              aria-label="초대 코드로 참여"
              className={`${railButton} text-muted hover:bg-surface-container hover:text-ink`}
              onClick={() => setIsJoinOpen(true)}
            >
              <LinkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </li>
        </ul>

        <AccountMenu placement="rail" onNavigate={onNavigate} />
      </nav>
      <CreateWorkspaceModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <JoinWorkspaceModal isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} />
    </>
  );
};
