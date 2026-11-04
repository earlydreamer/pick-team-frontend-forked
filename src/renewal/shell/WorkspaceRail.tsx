import React from 'react';
import { Link, useMatch } from 'react-router-dom';
import { useMyWorkspaces } from '@/renewal/data/queries';

/** 레일 아이콘 글자: 숫자만 있는 단어(연도 등)를 건너뛰고 첫 단어의 앞 두 글자를 쓴다. 예) 2026 하계 부트캠프 → 하계 */
const railLabel = (name: string) => {
  const word = name.split(/\s+/).find((part) => part && !/^\d+$/.test(part)) ?? name;
  return word.slice(0, 2).toUpperCase();
};

/**
 * WS 레일(02 §2.1). 가입한 워크스페이스를 세로로 나열한다.
 * 워크스페이스 생성·참여 버튼과 미확인 알림 배지는 인증·초대와 알림 단계에서 추가한다.
 */
export const WorkspaceRail: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { data: workspaces, isLoading } = useMyWorkspaces();
  const match = useMatch('/ws/:wsId/*');
  const activeId = match?.params.wsId;

  return (
    <nav aria-label="워크스페이스" className="flex h-full w-16 shrink-0 flex-col items-center gap-2 border-r border-outline-soft bg-surface-low py-3">
      {isLoading && <span className="h-10 w-10 animate-pulse rounded-[10px] bg-surface-container" aria-label="워크스페이스를 불러오는 중" role="status" />}
      <ul className="flex flex-col items-center gap-2">
        {workspaces?.map((workspace) => {
          const active = workspace.id === activeId;
          return (
            <li key={workspace.id}>
              <Link
                to={`/ws/${workspace.id}`}
                onClick={onNavigate}
                aria-label={workspace.name}
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
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
