import { describe, expect, it } from 'vitest';
import { MOCK_PASSWORD, seed, type MockDb } from './db';
import { signIn } from './authRules';
import { escalateReport, listReports, listWorkspaceReports, openWorkspaceReportCount, resolveInWorkspace, resolveReport, startReview, startWorkspaceReview, submitReport } from './reportRules';

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

describe('워크스페이스 운영진의 1차 처리(17 §2, §5.2)', () => {
  const postReport = () => submitReport(seed(), 'u-02', { targetType: 'POST', targetId: 'p-1', workspaceId: WS, reason: 'ABUSE' });
  const latest = (db: MockDb) => db.reports.slice(-1)[0];

  it('새 신고를 운영진에게 알리고 묶는다. 신고자는 운영진 화면에도 없다', () => {
    const db = postReport();
    expect(inbox(db, 'u-instructor').slice(-1)[0]).toMatchObject({ type: 'REPORT_RECEIVED', link: '/ws/ws-1/settings?tab=reports' });
    expect(inbox(db, 'u-manager').some((item) => item.type === 'REPORT_RECEIVED')).toBe(true);
    const twice = submitReport(db, 'u-02', { targetType: 'USER', targetId: 'u-03', workspaceId: WS, reason: 'SPAM' });
    const received = inbox(twice, 'u-manager').filter((item) => item.type === 'REPORT_RECEIVED');
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ count: 2, title: '새 신고가 2건 접수됐어요. 확인해 주세요.' });
    const list = listWorkspaceReports(db, 'u-manager', WS);
    expect(list.map((item) => item.id)).toContain(latest(db).id);
    expect(JSON.stringify(list)).not.toContain('u-02');
    expect(() => listWorkspaceReports(db, 'u-01', WS)).toThrow('운영진만');
  });

  it('운영진이 대상이면 바로 운영자에게 넘기고 운영진에게는 알리지도 보이지도 않는다', () => {
    const db = submitReport(seed(), 'u-02', { targetType: 'USER', targetId: 'u-manager', workspaceId: WS, reason: 'ABUSE' });
    expect(latest(db)).toMatchObject({ escalation: 'STAFF_TARGET' });
    expect(inbox(db, 'u-instructor').some((item) => item.type === 'REPORT_RECEIVED')).toBe(false);
    expect(listWorkspaceReports(db, 'u-instructor', WS).some((item) => item.id === latest(db).id)).toBe(false);
    expect(listReports(db, 'u-admin').find((item) => item.id === latest(db).id)?.escalation).toBe('STAFF_TARGET');
  });

  it('운영진은 계정 정지를 고를 수 없고, 콘텐츠 삭제는 처리한 쪽을 남긴다', () => {
    const db = postReport();
    const id = latest(db).id;
    expect(openWorkspaceReportCount(db, 'u-manager', WS)).toBeGreaterThanOrEqual(1);
    const started = startWorkspaceReview(db, 'u-manager', WS, id);
    expect(() => resolveInWorkspace(started, 'u-manager', WS, id, 'BANNED_SYSTEM')).toThrow('쓸 수 없는 조치');
    const done = resolveInWorkspace(started, 'u-manager', WS, id, 'CONTENT_REMOVED', '욕설');
    expect(done.posts.some((item) => item.id === 'p-1')).toBe(false);
    expect(latest(done)).toMatchObject({ status: 'ACTED', handledBy: 'WORKSPACE', adminMemo: '욕설' });
    expect(inbox(done, 'u-02').slice(-1)[0]).toMatchObject({ type: 'REPORT_RESOLVED' });
  });

  it('워크스페이스 차단은 멤버 관리의 차단과 같은 파급을 적용한다', () => {
    const db = submitReport(seed(), 'u-02', { targetType: 'USER', targetId: 'u-03', workspaceId: WS, reason: 'ABUSE' });
    const id = latest(db).id;
    const done = resolveInWorkspace(startWorkspaceReview(db, 'u-instructor', WS, id), 'u-instructor', WS, id, 'BANNED_WS');
    expect(done.workspaces.find((item) => item.id === WS)?.members.some((member) => member.accountId === 'u-03')).toBe(false);
    expect(done.bans.some((ban) => ban.workspaceId === WS && ban.accountId === 'u-03')).toBe(true);
  });

  it('넘긴 신고는 운영진이 처리할 수 없고 운영자는 처리할 수 있다', () => {
    const db = postReport();
    const id = latest(db).id;
    const escalated = escalateReport(db, 'u-manager', WS, id, '계정 정지 검토 부탁');
    expect(latest(escalated)).toMatchObject({ escalation: 'MANAGER', status: 'RECEIVED', adminMemo: '계정 정지 검토 부탁' });
    expect(() => startWorkspaceReview(escalated, 'u-instructor', WS, id)).toThrow('운영자에게 넘긴');
    expect(openWorkspaceReportCount(escalated, 'u-instructor', WS)).toBe(openWorkspaceReportCount(db, 'u-instructor', WS) - 1);
    const done = resolveReport(startReview(escalated, 'u-admin', id), 'u-admin', id, 'BANNED_SYSTEM', '운영자 메모');
    expect(latest(done)).toMatchObject({ status: 'ACTED', handledBy: 'SYSTEM' });
    expect(listWorkspaceReports(done, 'u-manager', WS).find((item) => item.id === id)?.adminMemo).toBeUndefined();
  });

  it('내가 신고했거나 내가 대상인 신고는 보지 않는다', () => {
    const db = submitReport(seed(), 'u-manager', { targetType: 'USER', targetId: 'u-03', workspaceId: WS, reason: 'SPAM' });
    const id = latest(db).id;
    expect(listWorkspaceReports(db, 'u-manager', WS).some((item) => item.id === id)).toBe(false);
    expect(listWorkspaceReports(db, 'u-instructor', WS).some((item) => item.id === id)).toBe(true);
    expect(() => startWorkspaceReview(db, 'u-manager', WS, id)).toThrow('찾을 수 없어요');
  });
});

