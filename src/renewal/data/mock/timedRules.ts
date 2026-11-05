import { CLOSING_SOON_MS, SCHEDULE_REMINDER_MS } from '@/renewal/domain/notification';
import { dateKey } from '@/renewal/domain/collab';
import type { MockDb } from './db';
import { notify } from './notifyRules';

/*
 * 시각 기반 알림(16 §5.1, §5.3, 16-D3, 16-D4). 백엔드에서는 스케줄러가 맡는다.
 * 목업은 서버가 없으므로 알림을 조회할 때마다 이 함수를 불러 "지금 보내야 할 알림"을 계산하고, 보낸 것은 기록해 다시 보내지 않는다.
 *
 * | 이벤트 | 조건 | 받는 사람 |
 * |---|---|---|
 * | TB_SESSION_CLOSING_SOON | 모집 중(OPEN) 세션 마감 24시간 전부터 마감 전까지 | 팀이 없는 멤버 |
 * | TB_UNASSIGNED_WARNING | 같은 시점, 미배정 멤버가 있으면 | 개설자·매니저(16 §2 "미배정 경고") |
 * | SCHEDULE_REMINDER | 일정 시작 5분 전부터 시작 전까지 | 팀 일정은 팀원, 개인 일정은 만든 사람 |
 */

const SYSTEM = 'system';

export const runTimedEvents = (db: MockDb, now = Date.now()): MockDb => {
  let next = db;
  const sent = new Set(db.sentTimedEvents);
  const mark = (key: string) => {
    sent.add(key);
    next = { ...next, sentTimedEvents: [...sent] };
  };

  for (const session of db.sessions) {
    const closesAt = new Date(session.closesAt).getTime();
    if (session.status !== 'OPEN' || now < closesAt - CLOSING_SOON_MS || now >= closesAt) continue;
    const key = `closing:${session.id}:${session.closesAt}`;
    if (sent.has(key)) continue;
    const workspace = db.workspaces.find((item) => item.id === session.workspaceId);
    if (!workspace) continue;
    const unassigned = workspace.members.filter((member) => member.role === 'MEMBER' && !member.teamId).map((member) => member.accountId);
    const managers = workspace.members.filter((member) => member.role !== 'MEMBER').map((member) => member.accountId);
    const hours = Math.max(1, Math.ceil((closesAt - now) / 3_600_000));
    next = notify(
      next,
      unassigned,
      { type: 'TB_SESSION_CLOSING_SOON', workspaceId: workspace.id, link: `/ws/${workspace.id}/team-building`, title: `팀 빌딩 마감까지 ${hours}시간 남았어요. 아직 팀이 없다면 지원하거나 팀을 만들어 보세요.` },
      SYSTEM,
    );
    if (unassigned.length > 0) {
      next = notify(
        next,
        managers,
        { type: 'TB_UNASSIGNED_WARNING', workspaceId: workspace.id, link: `/ws/${workspace.id}/team-building/manage`, title: `팀 빌딩 마감 ${hours}시간 전, 아직 팀이 없는 멤버가 ${unassigned.length}명이에요.` },
        SYSTEM,
      );
    }
    mark(key);
  }

  for (const schedule of db.schedules) {
    const startAt = new Date(schedule.startAt).getTime();
    if (now < startAt - SCHEDULE_REMINDER_MS || now >= startAt) continue;
    const key = `schedule:${schedule.id}:${schedule.startAt}`;
    if (sent.has(key)) continue;
    const team = db.teams.find((item) => item.id === schedule.teamId);
    if (!team) continue;
    const minutes = Math.max(1, Math.ceil((startAt - now) / 60_000));
    next = notify(
      next,
      schedule.personal ? [schedule.createdBy] : team.memberIds,
      {
        type: 'SCHEDULE_REMINDER',
        workspaceId: team.workspaceId,
        link: `/ws/${team.workspaceId}/team/${team.id}/calendar?view=list&date=${dateKey(new Date(schedule.startAt))}`,
        title: `${minutes}분 뒤 시작: ${schedule.title}`,
      },
      SYSTEM,
    );
    mark(key);
  }

  return next;
};
