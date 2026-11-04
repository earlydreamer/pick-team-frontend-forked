import React from 'react';
import { Link, useMatch } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useMe, useMyWorkspaces, useUnreadSummary } from '@/renewal/data/queries';
import { workspaceEntryPath } from './entry';

/** 레일 아이콘 글자: 숫자만 있는 단어(연도 등)를 건너뛰고 첫 단어의 앞 두 글자를 쓴다. 예) 2026 하계 부트캠프 → 하계 */
const railLabel = (name: string) => {
  const word = name.split(/\s+/).find((part) => part && !/^\d+$/.test(part)) ?? name;
  return word.slice(0, 2).toUpperCase();
};

/**
 * WS 레일(02 §2.1). 가입한 워크스페이스를 세로로 나열한다. 링크는 역할별 진입 경로(02-D4)를 따른다.
 * 맨 아래 추가 버튼은 워크스페이스 참여·만들기(SCR-WS-04)로 간다.
 * 다른 워크스페이스에 마지막으로 들어간 뒤 온 미확인 알림 수를 배지로 보인다(16 §6.2, 16-D5). 보고 있는 워크스페이스에는 배지를 달지 않는다.
 */
export const WorkspaceRail: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { data: workspaces, isLoading } = useMyWorkspaces();
  const me = useMe();
  const match = useMatch('/ws/:wsId/*');
  const activeId = match?.params.wsId;
  const summary = useUnreadSummary(Boolean(me.data));

  return (
    <nav aria-label="워크스페이스" className="flex h-full w-16 shrink-0 flex-col items-center gap-2 border-r border-outline-soft bg-surface-low py-3">
      {isLoading && <span className="h-10 w-10 animate-pulse rounded-[10px] bg-surface-container" aria-label="워크스페이스를 불러오는 중" role="status" />}
      <ul className="flex flex-col items-center gap-2">
        {workspaces?.map((workspace) => {
          const active = workspace.id === activeId;
          const unread = active ? 0 : summary.data?.byWorkspace[workspace.id] ?? 0;
          return (
            <li key={workspace.id} className="relative">
              <Link
                to={workspaceEntryPath(me.data?.id, workspace)}
                onClick={onNavigate}
                aria-label={unread > 0 ? `${workspace.name}, 새 알림 ${unread}개` : workspace.name}
                aria-current={active ? 'page' : undefined}
                title={workspace.name}
                className={`flex h-10 w-10 items-center justify-center rounded-[10px] text-xs font-bold transition-colors ${
                  active
                    ? 'bg-primary text-on-primary ring-2 ring-primary ring-offset-2 ring-offset-surface-low'
                    : 'bg-surface text-on-primary-container ring-1 ring-outline-soft hover:bg-primary-container'
                }`}
              >
                {railLabel(workspace.name)}
              </Link>
              {unread > 0 && (
                <span aria-hidden="true" className="pointer-events-none absolute -right-1.5 -top-1.5 min-w-[1.125rem] rounded-full bg-danger px-1 text-center text-[0.6875rem] font-bold leading-[1.125rem] text-white ring-2 ring-surface-low tabular-nums">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <Link
        to="/welcome"
        onClick={onNavigate}
        aria-label="워크스페이스 참여하거나 만들기"
        title="워크스페이스 참여하거나 만들기"
        className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-dashed border-outline text-muted hover:border-primary hover:text-primary"
      >
        <PlusIcon className="h-5 w-5" aria-hidden="true" />
      </Link>
    </nav>
  );
};
