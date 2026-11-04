import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PrCard } from '@/renewal/domain/card';
import type { CreateTeamInput } from '@/renewal/domain/teamBuilding';
import { data } from './index';

/** 쿼리 키를 한곳에서 관리해 무효화 범위를 분명히 한다. */
export const keys = {
  me: ['me'] as const,
  workspaces: ['workspaces'] as const,
  workspace: (id: string) => ['workspaces', id] as const,
  members: (id: string) => ['workspaces', id, 'members'] as const,
  member: (id: string, accountId: string) => ['workspaces', id, 'members', accountId] as const,
  myCard: ['me', 'card'] as const,
  session: (id: string) => ['workspaces', id, 'team-building', 'session'] as const,
  teams: (id: string) => ['workspaces', id, 'teams'] as const,
  announcements: (id: string) => ['workspaces', id, 'announcements'] as const,
  teamBuilding: (id: string) => ['workspaces', id, 'team-building'] as const,
  board: (id: string) => ['workspaces', id, 'team-building', 'board'] as const,
  teamDetail: (id: string, teamId: string) => ['workspaces', id, 'team-building', 'teams', teamId] as const,
  recommendations: (id: string) => ['workspaces', id, 'team-building', 'recommendations'] as const,
  inbox: (id: string) => ['workspaces', id, 'team-building', 'inbox'] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => data.session.me() });
export const useMyWorkspaces = () => useQuery({ queryKey: keys.workspaces, queryFn: () => data.workspaces.listMine() });
export const useWorkspace = (id: string) => useQuery({ queryKey: keys.workspace(id), queryFn: () => data.workspaces.get(id), enabled: Boolean(id) });
export const useMembers = (id: string) => useQuery({ queryKey: keys.members(id), queryFn: () => data.workspaces.listMembers(id), enabled: Boolean(id) });
export const useMember = (id: string, accountId: string) =>
  useQuery({ queryKey: keys.member(id, accountId), queryFn: () => data.workspaces.getMember(id, accountId), enabled: Boolean(id && accountId) });
export const useMyCard = () => useQuery({ queryKey: keys.myCard, queryFn: () => data.cards.getMine() });
export const useSession = (id: string) => useQuery({ queryKey: keys.session(id), queryFn: () => data.teamBuilding.getSession(id), enabled: Boolean(id) });
export const useTeams = (id: string) => useQuery({ queryKey: keys.teams(id), queryFn: () => data.teamBuilding.listTeams(id), enabled: Boolean(id) });

export const useRecentAnnouncements = (id: string, limit = 3) =>
  useQuery({ queryKey: [...keys.announcements(id), limit], queryFn: () => data.announcements.listRecent(id, limit), enabled: Boolean(id) });

/** 카드 저장 후 내 카드와 멤버 목록(갤러리)을 함께 새로 고친다. */
export const useSaveMyCard = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (card: PrCard) => data.cards.saveMine(card),
    onSuccess: (card) => {
      client.setQueryData(keys.myCard, card);
      client.invalidateQueries({ queryKey: keys.workspaces });
    },
  });
};

export const useSetCardVisibility = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (visible: boolean) => data.cards.setVisibility(visible),
    onSuccess: (card) => {
      client.setQueryData(keys.myCard, card);
      client.invalidateQueries({ queryKey: keys.workspaces });
    },
  });
};

export const useUpdateProfileImage = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (file: File | null) => data.session.updateProfileImage(file),
    onSuccess: (account) => {
      client.setQueryData(keys.me, account);
      client.invalidateQueries({ queryKey: keys.workspaces });
    },
  });
};

/* ── 팀 빌딩 ── */

export const useBoard = (id: string) => useQuery({ queryKey: keys.board(id), queryFn: () => data.teamBuilding.getBoard(id), enabled: Boolean(id) });
export const useTeamDetail = (id: string, teamId: string) =>
  useQuery({ queryKey: keys.teamDetail(id, teamId), queryFn: () => data.teamBuilding.getTeamDetail(id, teamId), enabled: Boolean(id && teamId) });
export const useRecommendations = (id: string, enabled = true) =>
  useQuery({ queryKey: keys.recommendations(id), queryFn: () => data.teamBuilding.recommendations(id), enabled: Boolean(id) && enabled });
export const useInbox = (id: string) => useQuery({ queryKey: keys.inbox(id), queryFn: () => data.teamBuilding.inbox(id), enabled: Boolean(id) });

/**
 * 팀 빌딩 변경 후 새로 고칠 범위. 제안 하나가 팀 구성, 멤버의 팀, 세션 현황에 모두 영향을 주므로 워크스페이스 단위로 무효화한다.
 */
const useTeamBuildingMutation = <Input, Output>(id: string, fn: (input: Input) => Promise<Output>) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => client.invalidateQueries({ queryKey: keys.workspace(id) }),
  });
};

export const useApply = (id: string) => useTeamBuildingMutation(id, (input: { teamId: string; message?: string }) => data.teamBuilding.apply(id, input.teamId, input.message));
export const useScout = (id: string) => useTeamBuildingMutation(id, (input: { accountId: string; message?: string }) => data.teamBuilding.scout(id, input.accountId, input.message));
export const useAccept = (id: string) => useTeamBuildingMutation(id, (applicationId: string) => data.teamBuilding.accept(id, applicationId));
export const useDecline = (id: string) => useTeamBuildingMutation(id, (applicationId: string) => data.teamBuilding.decline(id, applicationId));
export const useWithdraw = (id: string) => useTeamBuildingMutation(id, (applicationId: string) => data.teamBuilding.withdraw(id, applicationId));
export const useCreateTeam = (id: string) => useTeamBuildingMutation(id, (input: CreateTeamInput) => data.teamBuilding.createTeam(id, input));
