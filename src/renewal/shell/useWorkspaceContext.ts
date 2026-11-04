import { useMatch } from 'react-router-dom';
import { isManager } from '@/renewal/domain/workspace';
import { useMyWorkspaces, useSession, useTeams, useMe } from '@/renewal/data/queries';

/** 주소의 워크스페이스와 그 안에서의 내 역할·팀·세션 상태를 모은다. 셸과 화면이 같은 기준을 쓴다. */
export const useWorkspaceContext = () => {
  const match = useMatch('/ws/:wsId/*');
  const wsId = match?.params.wsId ?? '';
  const me = useMe();
  const workspaces = useMyWorkspaces();
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
