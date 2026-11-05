import { describe, expect, it } from 'vitest';
import type { DataSource } from '../ports';
import { seed } from './db';
import { joinByInvite } from './authRules';
import { setArchived } from './workspaceAdminRules';
import { ARCHIVED_MESSAGE, withArchiveGuard } from './archiveGuard';

const WS = 'ws-1';

describe('보관 규칙(01-D4, 13-D7)', () => {
  it('개설자만 보관하고, 진행 중인 세션을 끝내며 대기 지원을 만료한다', () => {
    expect(() => setArchived(seed(), WS, 'u-manager', true)).toThrow('개설자만');
    const db = setArchived(seed(), WS, 'u-instructor', true);
    expect(db.workspaces.find((item) => item.id === WS)?.archivedAt).toBeTruthy();
    expect(db.sessions[0].status).toBe('RESOLVED');
    expect(db.applications.filter((app) => app.status === 'PENDING')).toHaveLength(0);
    expect(db.applications.find((app) => app.id === 'app-3')).toMatchObject({ status: 'EXPIRED', reason: '워크스페이스 보관' });
  });

  it('해제하면 다시 쓸 수 있지만 세션은 되살리지 않는다', () => {
    const db = setArchived(setArchived(seed(), WS, 'u-instructor', true), WS, 'u-instructor', false);
    expect(db.workspaces.find((item) => item.id === WS)?.archivedAt).toBeUndefined();
    expect(db.sessions[0].status).toBe('RESOLVED');
  });

  it('보관된 워크스페이스에는 초대 링크로 합류할 수 없다', async () => {
    await expect(joinByInvite(setArchived(seed(), WS, 'u-instructor', true), 'SUMMER26', 'u-new')).rejects.toThrow('새로 합류할 수 없어요');
  });
});

describe('보관 중 쓰기 차단(archiveGuard)', () => {
  const calls: string[] = [];
  const port = (name: string, methods: string[]) =>
    Object.fromEntries(methods.map((method) => [method, async (...args: unknown[]) => calls.push(`${name}.${method}:${String(args[0])}`)]));
  const source = {
    kind: 'mock',
    teamSpace: port('teamSpace', ['get', 'listTasks', 'overview', 'createTask']),
    chat: port('chat', ['listMessages', 'sendMessage', 'markRead', 'setMuted']),
    workspaceAdmin: port('workspaceAdmin', ['getSettings', 'rename', 'leave', 'remove', 'setArchived']),
    announcements: port('announcements', ['listRecent', 'createWorkspace']),
    teamBuilding: port('teamBuilding', ['getBoard', 'inbox', 'apply']),
    video: port('video', ['getChannel', 'join', 'leave']),
    dashboard: port('dashboard', ['get', 'approve']),
    notifications: port('notifications', ['markAllRead']),
  } as unknown as DataSource;
  const guarded = withArchiveGuard(source, (id) => id === 'archived');

  it('보관된 워크스페이스의 쓰기만 막고 읽기와 정리는 연다', async () => {
    await expect(guarded.teamSpace.createTask('archived', 't-1', { title: 'x' } as never)).rejects.toThrow(ARCHIVED_MESSAGE);
    await expect(guarded.chat.sendMessage('archived', 'r', 'hi')).rejects.toThrow(ARCHIVED_MESSAGE);
    await expect(guarded.workspaceAdmin.rename('archived', 'x')).rejects.toThrow(ARCHIVED_MESSAGE);
    await expect(guarded.teamBuilding.apply('archived', 't-1')).rejects.toThrow(ARCHIVED_MESSAGE);
    await expect(guarded.video.join('archived', 'c')).rejects.toThrow(ARCHIVED_MESSAGE);
    await expect(guarded.dashboard.approve('archived', 'a')).rejects.toThrow(ARCHIVED_MESSAGE);
    for (const run of [
      () => guarded.teamSpace.listTasks('archived', 't-1'),
      () => guarded.teamSpace.overview('archived', 't-1'),
      () => guarded.chat.markRead('archived', 'r'),
      () => guarded.chat.setMuted('archived', 'r', true),
      () => guarded.teamBuilding.inbox('archived'),
      () => guarded.video.leave('archived', 'c'),
      () => guarded.workspaceAdmin.leave('archived'),
      () => guarded.workspaceAdmin.setArchived('archived', false),
      () => guarded.notifications.markAllRead(undefined),
    ]) {
      await expect(run()).resolves.toBeDefined();
    }
  });

  it('보관되지 않은 워크스페이스는 그대로 쓴다', async () => {
    await expect(guarded.teamSpace.createTask('open', 't-1', { title: 'x' } as never)).resolves.toBeDefined();
  });
});
