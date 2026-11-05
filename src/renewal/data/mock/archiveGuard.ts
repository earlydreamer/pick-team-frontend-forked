import { DataError, type DataSource } from '../ports';

/*
 * 워크스페이스 보관(아카이브, 01-D4, US-13-07)의 쓰기 차단. 백엔드는 WORKSPACE_ARCHIVED(403)로 막는다(13 아카이브 상세 설계).
 * 목업은 어댑터를 한 겹 감싸 워크스페이스 범위 메서드 중 쓰기만 막는다. 첫 인자가 워크스페이스 id인 메서드가 대상이다.
 *
 * | 허용 | 이유 |
 * |---|---|
 * | get·list·search로 시작하는 조회, 추천, 제안함, 팀 개요 | 읽기는 보관 뒤에도 그대로 연다 |
 * | 채팅 읽음 표시, 방 알림 끄기, 회의 나가기 | 내 상태만 바꾸고 기록을 남기지 않는다 |
 * | 워크스페이스 나가기·삭제·보관 해제 | 보관된 워크스페이스를 정리하는 길은 열어 둔다 |
 */

export const ARCHIVED_MESSAGE = '보관된 워크스페이스라 읽기만 할 수 있어요.';

const READ = /^(get|list|search)/;
const ALLOWED: Partial<Record<keyof DataSource, string[]>> = {
  teamBuilding: ['recommendations', 'inbox'],
  teamSpace: ['overview'],
  chat: ['markRead', 'setMuted'],
  video: ['leave'],
  workspaceAdmin: ['leave', 'remove', 'setArchived'],
};
const GUARDED: (keyof DataSource)[] = ['workspaceAdmin', 'announcements', 'teamBuilding', 'teamSpace', 'chat', 'video', 'dashboard'];

type AnyPort = Record<string, (...args: unknown[]) => Promise<unknown>>;

const guardPort = (name: keyof DataSource, port: AnyPort, isArchived: (workspaceId: string) => boolean): AnyPort =>
  Object.fromEntries(
    Object.entries(port).map(([method, fn]) => {
      if (READ.test(method) || ALLOWED[name]?.includes(method)) return [method, fn];
      const guarded = async (...args: unknown[]) => {
        if (typeof args[0] === 'string' && isArchived(args[0])) throw new DataError(ARCHIVED_MESSAGE, 'FORBIDDEN');
        return fn.apply(port, args);
      };
      return [method, guarded];
    }),
  );

export const withArchiveGuard = (source: DataSource, isArchived: (workspaceId: string) => boolean): DataSource => {
  const guarded = { ...source } as unknown as Record<string, unknown>;
  for (const name of GUARDED) guarded[name] = guardPort(name, source[name] as unknown as AnyPort, isArchived);
  return guarded as unknown as DataSource;
};
