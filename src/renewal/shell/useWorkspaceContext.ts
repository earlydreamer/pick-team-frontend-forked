import { useEffect } from 'react';
import { useLocation, useMatch } from 'react-router-dom';
import { isManager } from '@/renewal/domain/workspace';
import { useMyWorkspaces, useSession, useTeams, useMe } from '@/renewal/data/queries';
import { rememberPath } from './entry';

const LAST_WORKSPACE_KEY = 'pickteam.renewal.lastWorkspace';

const readLastWorkspace = () => {
  try {
    return localStorage.getItem(LAST_WORKSPACE_KEY) ?? '';
  } catch {
    return '';
  }
};

/**
 * 주소의 워크스페이스와 그 안에서의 내 역할·팀·세션 상태를 모은다. 셸과 화면이 같은 기준을 쓴다.
 * /me 아래 화면처럼 주소에 워크스페이스가 없으면 마지막으로 방문한 워크스페이스를 쓴다(목업 pr-card-edit.html).
 */
export const useWorkspaceContext = () => {
  const match = useMatch('/ws/:wsId/*');
  const { pathname, search } = useLocation();
  const routeWsId = match?.params.wsId ?? '';
  const me = useMe();
  const workspaces = useMyWorkspaces();

  useEffect(() => {
    if (!routeWsId) return;
    try {
      localStorage.setItem(LAST_WORKSPACE_KEY, routeWsId);
    } catch {
      // 기억하지 못해도 동작에는 문제가 없다.
    }
  }, [routeWsId]);

  // 진입 경로 계산(entry.ts)을 위해 워크스페이스별 마지막 화면을 기억한다.
  const accountId = me.data?.id;
  useEffect(() => {
    if (routeWsId && accountId) rememberPath(accountId, routeWsId, pathname + search);
  }, [routeWsId, accountId, pathname, search]);

  // 마지막 워크스페이스에서 나갔거나 지워졌으면 첫 워크스페이스로 대신한다.
  const last = readLastWorkspace();
  const fallbackId = pathname.startsWith('/me') ? (workspaces.data?.some((item) => item.id === last) ? last : workspaces.data?.[0]?.id ?? '') : '';
  const wsId = routeWsId || fallbackId;
  const workspace = workspaces.data?.find((item) => item.id === wsId);
  const session = useSession(workspace ? wsId : '');
  const teams = useTeams(workspace ? wsId : '');
  const myTeams = (teams.data ?? []).filter((team) => me.data && team.memberIds.includes(me.data.id));

  return {
    wsId,
    workspace,
    workspaces,
    me: me.data,
    isManager: isManager(workspace?.myRole),
    session: session.data ?? null,
    myTeams,
  };
};
