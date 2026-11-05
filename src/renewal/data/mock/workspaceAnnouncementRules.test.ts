import { describe, expect, it } from 'vitest';
import { announcementLink } from '@/renewal/domain/announcement';
import { seed } from './db';
import { createWorkspaceAnnouncement, deleteWorkspaceAnnouncement, listWorkspaceAnnouncements, updateWorkspaceAnnouncement } from './workspaceAnnouncementRules';
import { onWorkspaceAnnouncement } from './notifyRules';

const WS = 'ws-1';
const input = { title: '다음 주 휴강 안내', content: '수요일은 휴강이에요.' };

describe('워크스페이스 공지', () => {
  it('전체 공지만 최신순으로 보이고 팀 공지는 섞지 않는다', () => {
    const items = listWorkspaceAnnouncements(seed(), WS, 'u-01');
    expect(items.map((item) => item.id)).toEqual(['a-1', 'a-2']);
    expect(() => listWorkspaceAnnouncements(seed(), WS, 'u-12')).toThrow('찾을 수 없어요');
  });

  it('개설자·매니저만 쓰고, 빈 제목은 막는다', () => {
    expect(() => createWorkspaceAnnouncement(seed(), WS, 'u-01', input)).toThrow('개설자와 매니저만');
    expect(() => createWorkspaceAnnouncement(seed(), WS, 'u-manager', { ...input, title: ' ' })).toThrow('제목을 입력');
    const { db, announcementId } = createWorkspaceAnnouncement(seed(), WS, 'u-manager', input);
    expect(listWorkspaceAnnouncements(db, WS, 'u-01')[0]).toMatchObject({ id: announcementId, title: input.title, authorName: '정매니저' });
  });

  it('올리면 쓴 사람을 뺀 멤버 모두에게 알림이 가고 그 공지로 이어진다', () => {
    const created = createWorkspaceAnnouncement(seed(), WS, 'u-manager', input);
    const db = onWorkspaceAnnouncement(created.db, WS, created.announcementId, input.title, 'u-manager');
    const added = db.notifications.filter((item) => !seed().notifications.some((old) => old.id === item.id));
    expect(added.some((item) => item.accountId === 'u-manager')).toBe(false);
    expect(added.length).toBe(seed().workspaces[0].members.length - 1);
    expect(added[0].link).toBe(`/ws/ws-1/announcements?id=${created.announcementId}`);
  });

  it('고치면 수정 표시가 남고, 지우면 사라진다. 팀 공지는 이 경로로 고칠 수 없다', () => {
    const edited = updateWorkspaceAnnouncement(seed(), WS, 'u-instructor', 'a-1', { title: '마감 시각 변경', content: '월요일 오전 9시로 미뤄요.' });
    expect(listWorkspaceAnnouncements(edited, WS, 'u-01')[0]).toMatchObject({ title: '마감 시각 변경' });
    expect(listWorkspaceAnnouncements(edited, WS, 'u-01')[0].updatedAt).toBeTruthy();
    expect(() => updateWorkspaceAnnouncement(seed(), WS, 'u-instructor', 'a-3', input)).toThrow('찾을 수 없어요');
    expect(listWorkspaceAnnouncements(deleteWorkspaceAnnouncement(seed(), WS, 'u-instructor', 'a-1'), WS, 'u-01').map((item) => item.id)).toEqual(['a-2']);
  });

  it('공지 링크는 팀 공지면 팀 공지 탭, 전체 공지면 강조 주소다', () => {
    expect(announcementLink(WS, { id: 'a-3', teamId: 't-1' })).toBe('/ws/ws-1/team/t-1/announcements');
    expect(announcementLink(WS, { id: 'a-1' })).toBe('/ws/ws-1/announcements?id=a-1');
  });
});
