import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PrCard } from '@/renewal/domain/card';
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
