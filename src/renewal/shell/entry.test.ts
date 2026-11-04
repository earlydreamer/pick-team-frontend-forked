import { describe, expect, it } from 'vitest';
import { rememberPath, workspaceEntryPath, type KeyValueStore } from './entry';

const memoryStore = (): KeyValueStore => {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
};

describe('workspaceEntryPath', () => {
  it('멤버는 항상 홈으로 들어간다', () => {
    expect(workspaceEntryPath('u-1', { id: 'ws-1', myRole: 'MEMBER' }, memoryStore())).toBe('/ws/ws-1');
  });

  it('매니저의 첫 진입은 대시보드다', () => {
    expect(workspaceEntryPath('u-1', { id: 'ws-1', myRole: 'ADMIN' }, memoryStore())).toBe('/ws/ws-1/dashboard');
  });

  it('이후에는 마지막으로 본 화면으로 들어간다', () => {
    const store = memoryStore();
    rememberPath('u-1', 'ws-1', '/ws/ws-1/members?role=BACKEND', store);
    expect(workspaceEntryPath('u-1', { id: 'ws-1', myRole: 'OWNER' }, store)).toBe('/ws/ws-1/members?role=BACKEND');
  });

  it('계정과 워크스페이스별로 따로 기억한다', () => {
    const store = memoryStore();
    rememberPath('u-1', 'ws-1', '/ws/ws-1', store);
    expect(workspaceEntryPath('u-2', { id: 'ws-1', myRole: 'ADMIN' }, store)).toBe('/ws/ws-1/dashboard');
    expect(workspaceEntryPath('u-1', { id: 'ws-2', myRole: 'ADMIN' }, store)).toBe('/ws/ws-2/dashboard');
  });

  it('다른 워크스페이스 주소가 저장돼 있으면 홈으로 보낸다', () => {
    const store = memoryStore();
    rememberPath('u-1', 'ws-1', '/ws/ws-10/members', store);
    expect(workspaceEntryPath('u-1', { id: 'ws-1', myRole: 'ADMIN' }, store)).toBe('/ws/ws-1');
  });

  it('저장소를 쓸 수 없으면 첫 진입처럼 대시보드로 보낸다', () => {
    expect(workspaceEntryPath('u-1', { id: 'ws-1', myRole: 'ADMIN' }, null)).toBe('/ws/ws-1/dashboard');
  });
});
