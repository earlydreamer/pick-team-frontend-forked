import { isManager, type Workspace } from '@/renewal/domain/workspace';

/**
 * 워크스페이스 진입 경로(02-D4, 13 §5.4). 개설자·매니저는 처음 들어올 때만 대시보드로 보내고,
 * 이후에는 그 워크스페이스에서 마지막으로 본 화면으로 보낸다. 멤버는 홈으로 들어간다.
 * 진입점은 앱 첫 화면과 WS 레일이다. 내비의 "홈" 링크는 진입이 아니라 이동이므로 홈으로 간다.
 */

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const browserStore = (): KeyValueStore | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const lastPathKey = (accountId: string, workspaceId: string) => `pickteam.renewal.lastPath.${accountId}.${workspaceId}`;

export const rememberPath = (accountId: string, workspaceId: string, path: string, store: KeyValueStore | null = browserStore()) => {
  try {
    store?.setItem(lastPathKey(accountId, workspaceId), path);
  } catch {
    // 기억하지 못하면 다음 진입도 첫 진입처럼 처리한다.
  }
};

export const workspaceEntryPath = (
  accountId: string | undefined,
  workspace: Pick<Workspace, 'id' | 'myRole'>,
  store: KeyValueStore | null = browserStore(),
) => {
  const home = `/ws/${workspace.id}`;
  if (!accountId || !isManager(workspace.myRole)) return home;
  let last: string | null = null;
  try {
    last = store?.getItem(lastPathKey(accountId, workspace.id)) ?? null;
  } catch {
    last = null;
  }
  if (!last) return `${home}/dashboard`;
  return last === home || last.startsWith(`${home}/`) || last.startsWith(`${home}?`) ? last : home;
};
