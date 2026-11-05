import { describe, expect, it } from 'vitest';
import { MOCK_PASSWORD, seed, type MockDb } from './db';
import { signIn } from './authRules';
import { listReports, resolveReport, startReview, submitReport } from './reportRules';

const WS = 'ws-1';
const inbox = (db: MockDb, id: string) => db.notifications.filter((item) => item.accountId === id);
const reviewing = () => startReview(seed(), 'u-admin', 'rp-1');

describe('신고 제출(17 §4.1)', () => {
  it('볼 수 있는 대상만 신고하고, 자기 자신과 중복 신고는 막는다', () => {
    expect(() => submitReport(seed(), 'u-02', { targetType: 'MESSAGE', targetId: 'm-7', workspaceId: WS, reason: 'SPAM' })).toThrow('찾을 수 없어요');
    expect(() => submitReport(seed(), 'u-01', { targetType: 'MESSAGE', targetId: 'm-7', workspaceId: WS, reason: 'SPAM' })).toThrow('신고할 수 없어요');
    expect(() => submitReport(seed(), 'u-03', { targetType: 'MESSAGE', targetId: 'm-7', workspaceId: WS, reason: 'SPAM' })).toThrow('이미 신고했어요');
    expect(() => submitReport(seed(), 'u-02', { targetType: 'USER', targetId: 'u-01', workspaceId: WS, reason: 'OTHER' })).toThrow('사유를 적어');
    const db = submitReport(seed(), 'u-02', { targetType: 'POST', targetId: 'p-1', workspaceId: WS, reason: 'ABUSE', detail: '부적절한 표현' });
    expect(db.reports.slice(-1)[0]).toMatchObject({ targetAccountId: 'u-01', status: 'RECEIVED', reason: 'ABUSE' });
    expect(db.reports.slice(-1)[0].snapshot).toContain('회의록');
  });
});

describe('신고 처리(17 §5.1)', () => {
  it('시스템 관리자만 보고, 관리자 화면에는 신고자를 담지 않는다', () => {
    expect(() => listReports(seed(), 'u-instructor')).toThrow('시스템 관리자만');
    const [report] = listReports(seed(), 'u-admin');
    expect(report).toMatchObject({ id: 'rp-1', targetAccount: { id: 'u-01' }, targetExists: true });
    expect(JSON.stringify(report)).not.toContain('u-03');
  });

  it('검토를 시작해야 처리하고, 콘텐츠 삭제는 원문을 지우고 양쪽에 알린다', () => {
    expect(() => resolveReport(seed(), 'u-admin', 'rp-1', 'WARNED')).toThrow('검토를 시작한 신고만');
    const db = resolveReport(reviewing(), 'u-admin', 'rp-1', 'CONTENT_REMOVED', '반복 홍보');
    expect(db.chatMessages.some((item) => item.id === 'm-7')).toBe(false);
    expect(db.reports[0]).toMatchObject({ status: 'ACTED', action: 'CONTENT_REMOVED', adminMemo: '반복 홍보' });
    expect(inbox(db, 'u-01').slice(-1)[0]).toMatchObject({ type: 'MODERATION_NOTICE', title: expect.stringContaining('삭제됐어요') });
    const reporterNotice = inbox(db, 'u-03').slice(-1)[0];
    expect(reporterNotice).toMatchObject({ type: 'REPORT_RESOLVED', title: '신고하신 내용이 처리되었어요.' });
    expect(inbox(db, 'u-01').filter((item) => item.type === 'MODERATION_NOTICE').some((item) => item.title.includes('박민준'))).toBe(false);
  });

  it('기각은 신고자에게만 결과를 알린다', () => {
    const db = resolveReport(reviewing(), 'u-admin', 'rp-1', 'DISMISS');
    expect(db.reports[0].status).toBe('DISMISSED');
    expect(inbox(db, 'u-01').length).toBe(inbox(seed(), 'u-01').length);
    expect(inbox(db, 'u-03').slice(-1)[0].title).toContain('정책 위반은 확인되지 않았어요');
  });

  it('워크스페이스 차단은 차단 파급을 적용하고, 계정 정지는 로그인을 막는다', async () => {
    const banned = resolveReport(reviewing(), 'u-admin', 'rp-1', 'BANNED_WS');
    expect(banned.workspaces[0].members.some((member) => member.accountId === 'u-01')).toBe(false);
    expect(banned.bans.some((ban) => ban.accountId === 'u-01')).toBe(true);
    const suspended = resolveReport(reviewing(), 'u-admin', 'rp-1', 'BANNED_SYSTEM');
    const email = suspended.accounts.find((account) => account.id === 'u-01')!.email;
    await expect(signIn(suspended, email, MOCK_PASSWORD)).rejects.toThrow('이용이 정지된 계정');
  });
});
