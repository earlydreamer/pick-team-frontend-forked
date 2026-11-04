import { describe, expect, it } from 'vitest';
import { acceptConsequence, acceptMessage } from './proposals';
import type { ApplicationStatus, ApplicationView, Inbox } from './teamBuilding';

const view = (id: string, direction: 'APPLY' | 'SCOUT', applicantId: string, teamId: string, status: ApplicationStatus = 'PENDING'): ApplicationView => ({
  application: { id, sessionId: 's-1', direction, applicantId, teamId, status, createdAt: '2026-11-01T00:00:00Z' },
  team: { id: teamId, name: teamId === 't-1' ? '알파팀' : '달빛' },
  applicant: { id: applicantId, name: applicantId === 'me' ? '김수강' : '이지원', email: `${applicantId}@example.com` },
});

describe('acceptConsequence', () => {
  it('스카우트를 수락하면 내 다른 대기 제안만 자동 철회 대상으로 센다', () => {
    const target = view('a', 'SCOUT', 'me', 't-3');
    const inbox: Inbox = {
      received: [target, view('b', 'SCOUT', 'me', 't-1'), view('c', 'SCOUT', 'me', 't-1', 'EXPIRED')],
      sent: [view('d', 'APPLY', 'me', 't-1')],
    };
    const result = acceptConsequence(target, inbox, 2);
    expect(result.autoWithdrawn).toBe(2);
    expect(acceptMessage(result)).toBe('수락하면 달빛 합류가 확정되고, 답변을 기다리는 내 다른 제안 2건은 자동 철회돼요. 되돌릴 수 없어요.');
  });

  it('다른 대기 제안이 없으면 철회 문구를 붙이지 않는다', () => {
    const target = view('a', 'SCOUT', 'me', 't-3');
    expect(acceptMessage(acceptConsequence(target, { received: [target], sent: [] }, 2))).toBe('수락하면 달빛 합류가 확정돼요. 되돌릴 수 없어요.');
  });

  it('팀장이 마지막 자리를 채우면 같은 팀의 다른 대기 제안이 정원 마감으로 끝난다', () => {
    const target = view('a', 'APPLY', 'u-03', 't-1');
    const inbox: Inbox = { received: [target, view('b', 'APPLY', 'u-07', 't-1')], sent: [view('c', 'SCOUT', 'u-09', 't-1')] };
    const result = acceptConsequence(target, inbox, 1);
    expect(result.closedByCapacity).toBe(2);
    expect(acceptMessage(result)).toContain('정원이 차서 답변을 기다리는 다른 제안 2건은 정원 마감으로 끝나요.');
  });

  it('빈자리가 남으면 정원 마감 대상이 없다', () => {
    const target = view('a', 'APPLY', 'u-03', 't-1');
    const inbox: Inbox = { received: [target, view('b', 'APPLY', 'u-07', 't-1')], sent: [] };
    expect(acceptConsequence(target, inbox, 2).closedByCapacity).toBe(0);
  });
});
