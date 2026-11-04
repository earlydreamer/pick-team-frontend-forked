import { roomTitle } from '@/renewal/domain/chat';
import { dateKey } from '@/renewal/domain/collab';
import { josa } from '@/renewal/domain/josa';
import { TYPE_META, defaultSettings, shouldDeliver, type AppNotification, type NotificationType } from '@/renewal/domain/notification';
import type { MockDb } from './db';
import { membersOf } from './chatRules';

/*
 * 이벤트를 알림으로 기록한다(16 §5 카탈로그, §6.3 묶음, §6.4 수신 설정).
 * 각 목 규칙이 상태를 바꾼 뒤 어댑터가 여기의 on* 함수를 불러 알림을 남긴다. 행동한 본인에게는 보내지 않는다.
 * 백엔드에서는 같은 자리에서 NotificationLog를 기록하고 SSE로 보낸다(16 §7.3).
 */

const now = () => new Date().toISOString();
let sequence = 0;
const newId = () => `n-${Date.now().toString(36)}${(sequence++).toString(36)}`;
const nameOf = (db: MockDb, id?: string) => db.accounts.find((account) => account.id === id)?.name ?? '알 수 없음';
const quote = (title: string) => `“${title}”`;

interface Payload {
  type: NotificationType;
  workspaceId: string;
  link: string;
  /** 받는 사람마다 문구가 다를 수 있다(DM 방 이름 등) */
  title: string | ((recipientId: string) => string);
  groupKey?: string;
}

export const notify = (db: MockDb, recipients: (string | undefined)[], payload: Payload, actorId?: string): MockDb => {
  const targets = [...new Set(recipients.filter((id): id is string => Boolean(id) && id !== actorId))];
  let notifications = db.notifications;
  for (const accountId of targets) {
    if (!shouldDeliver(payload.type, db.notificationSettings[accountId] ?? defaultSettings())) continue;
    const title = typeof payload.title === 'function' ? payload.title(accountId) : payload.title;
    const grouped = payload.groupKey && notifications.find((item) => item.accountId === accountId && item.groupKey === payload.groupKey && !item.read);
    if (grouped) {
      // 같은 방의 읽지 않은 알림이 있으면 새로 쌓지 않고 개수만 늘린다(§6.3 폭주 제어).
      const count = (grouped.count ?? 1) + 1;
      notifications = notifications.map((item) => (item === grouped ? { ...item, count, title: `${title.replace(/ 새 메시지.*$/, '')} 새 메시지 ${count}개`, createdAt: now() } : item));
      continue;
    }
    const meta = TYPE_META[payload.type];
    const item: AppNotification = {
      id: newId(),
      accountId,
      workspaceId: payload.workspaceId,
      type: payload.type,
      category: meta.category,
      priority: meta.priority,
      title,
      link: payload.link,
      read: false,
      createdAt: now(),
      groupKey: payload.groupKey,
      count: payload.groupKey ? 1 : undefined,
    };
    notifications = [...notifications, item];
  }
  return notifications === db.notifications ? db : { ...db, notifications };
};

/* ── 팀 빌딩(§5.1) ── */

const appOf = (db: MockDb, appId: string) => db.applications.find((app) => app.id === appId)!;
const teamOf = (db: MockDb, teamId: string) => db.teams.find((team) => team.id === teamId);
const inbox = (workspaceId: string) => `/ws/${workspaceId}/team-building/inbox`;

/** 새로 만들어진 지원·스카우트는 목록 끝에 있다. */
export const lastApplicationId = (db: MockDb) => db.applications[db.applications.length - 1].id;

export const onApplicationCreated = (db: MockDb, workspaceId: string, appId: string, actorId: string) => {
  const app = appOf(db, appId);
  const team = teamOf(db, app.teamId)!;
  return app.direction === 'APPLY'
    ? notify(db, [team.leaderId], { type: 'TB_APPLICATION_RECEIVED', workspaceId, link: inbox(workspaceId), title: `${nameOf(db, app.applicantId)}님이 ${team.name}에 지원했어요.` }, actorId)
    : notify(db, [app.applicantId], { type: 'TB_SCOUT_RECEIVED', workspaceId, link: inbox(workspaceId), title: `${team.name}에서 스카우트를 보냈어요.` }, actorId);
};

export const onApplicationDecided = (db: MockDb, workspaceId: string, appId: string, actorId: string) => {
  const app = appOf(db, appId);
  const team = teamOf(db, app.teamId);
  if (!team) return db;
  const accepted = app.status === 'ACCEPTED';
  const teamLink = `/ws/${workspaceId}/team/${team.id}`;
  if (app.direction === 'APPLY') {
    return notify(
      db,
      [app.applicantId],
      { type: accepted ? 'TB_APPLICATION_ACCEPTED' : 'TB_APPLICATION_REJECTED', workspaceId, link: accepted ? teamLink : inbox(workspaceId), title: accepted ? `${team.name}에서 지원을 수락했어요. 팀 스페이스로 가 보세요.` : `${team.name}에서 지원을 거절했어요.` },
      actorId,
    );
  }
  return notify(
    db,
    [team.leaderId],
    { type: accepted ? 'TB_SCOUT_ACCEPTED' : 'TB_SCOUT_REJECTED', workspaceId, link: accepted ? teamLink : inbox(workspaceId), title: accepted ? `${nameOf(db, app.applicantId)}님이 스카우트를 수락했어요.` : `${nameOf(db, app.applicantId)}님이 스카우트를 거절했어요.` },
    actorId,
  );
};

const participants = (db: MockDb, workspaceId: string) => db.workspaces.find((workspace) => workspace.id === workspaceId)?.members.filter((member) => member.role === 'MEMBER') ?? [];

export const onSessionOpened = (db: MockDb, workspaceId: string, actorId: string) =>
  notify(db, participants(db, workspaceId).map((member) => member.accountId), { type: 'TB_SESSION_OPENED', workspaceId, link: `/ws/${workspaceId}/team-building`, title: '팀 빌딩 모집이 시작됐어요. 마음에 드는 팀을 찾아보세요.' }, actorId);

export const onSessionResolved = (db: MockDb, workspaceId: string, actorId: string) =>
  participants(db, workspaceId).reduce((acc, member) => {
    const team = member.teamId ? teamOf(acc, member.teamId) : undefined;
    return notify(
      acc,
      [member.accountId],
      { type: 'TB_SESSION_RESOLVED', workspaceId, link: team ? `/ws/${workspaceId}/team/${team.id}` : `/ws/${workspaceId}/team-building`, title: team ? `팀 빌딩이 끝났어요. ${team.name}에서 협업을 시작해 보세요.` : '팀 빌딩이 끝났어요.' },
      actorId,
    );
  }, db);

/** 대시보드의 카드 미작성자 리마인드. 이전에는 발송 기록만 남겼다. */
export const onCardReminder = (db: MockDb, workspaceId: string, accountIds: string[], actorId: string) => {
  const workspace = db.workspaces.find((item) => item.id === workspaceId);
  return notify(db, accountIds, { type: 'CARD_REMINDER', workspaceId, link: '/me/card', title: `${workspace?.name ?? '워크스페이스'} 팀 빌딩에 참여하려면 PR 카드를 작성해 주세요.` }, actorId);
};

/* ── 칸반(§5.2) ── */

const taskLink = (workspaceId: string, teamId: string, taskId: string) => `/ws/${workspaceId}/team/${teamId}/kanban?task=${taskId}`;

export const onTaskAssigned = (db: MockDb, workspaceId: string, teamId: string, taskId: string, newAssignees: string[], actorId: string) => {
  const task = db.tasks.find((item) => item.id === taskId);
  if (!task || newAssignees.length === 0) return db;
  return notify(db, newAssignees, { type: 'KANBAN_TASK_ASSIGNED', workspaceId, link: taskLink(workspaceId, teamId, taskId), title: `${nameOf(db, actorId)}님이 ${josa(quote(task.title), '을/를')} 맡겼어요.` }, actorId);
};

/** 상태 전이 뒤의 알림: 완료 요청은 팀장에게, 승인·반려는 요청한 사람에게 간다. */
export const onTaskTransition = (db: MockDb, workspaceId: string, teamId: string, taskId: string, action: string, requesterBefore: string | undefined, actorId: string) => {
  const task = db.tasks.find((item) => item.id === taskId);
  const team = teamOf(db, teamId);
  if (!task || !team) return db;
  const link = taskLink(workspaceId, teamId, taskId);
  if (action === 'request') {
    return notify(db, [team.leaderId], { type: 'KANBAN_TASK_COMPLETION_REQUESTED', workspaceId, link, title: `${nameOf(db, actorId)}님이 ${quote(task.title)} 완료 승인을 요청했어요.` }, actorId);
  }
  if (action === 'approve') return notify(db, [requesterBefore], { type: 'KANBAN_TASK_COMPLETION_APPROVED', workspaceId, link, title: `${quote(task.title)} 완료가 승인됐어요.` }, actorId);
  if (action === 'reject') return notify(db, [requesterBefore], { type: 'KANBAN_TASK_COMPLETION_REJECTED', workspaceId, link, title: `${quote(task.title)} 완료 요청이 반려됐어요. 사유를 확인해 주세요.` }, actorId);
  return db;
};

/* ── 일정·공지·게시판(§5.3, §5.4) ── */

export const onScheduleCreated = (db: MockDb, workspaceId: string, teamId: string, scheduleId: string, actorId: string) => {
  const schedule = db.schedules.find((item) => item.id === scheduleId);
  const team = teamOf(db, teamId);
  if (!schedule || schedule.personal || !team) return db;
  return notify(db, team.memberIds, { type: 'SCHEDULE_CREATED', workspaceId, link: `/ws/${workspaceId}/team/${teamId}/calendar?view=list&date=${dateKey(new Date(schedule.startAt))}`, title: `새 일정: ${schedule.title}` }, actorId);
};

export const onAnnouncementCreated = (db: MockDb, workspaceId: string, teamId: string, title: string, actorId: string) => {
  const team = teamOf(db, teamId);
  if (!team) return db;
  return notify(db, team.memberIds, { type: 'ANNOUNCEMENT_CREATED', workspaceId, link: `/ws/${workspaceId}/team/${teamId}/announcements`, title: `${team.name} 새 공지: ${title}` }, actorId);
};

export const onPostCommented = (db: MockDb, workspaceId: string, teamId: string, postId: string, actorId: string) => {
  const post = db.posts.find((item) => item.id === postId);
  if (!post) return db;
  return notify(db, [post.authorId], { type: 'POST_COMMENT_ADDED', workspaceId, link: `/ws/${workspaceId}/team/${teamId}/board/${postId}`, title: `${nameOf(db, actorId)}님이 ${quote(post.title)}에 댓글을 달았어요.` }, actorId);
};

/* ── 채팅(§5.5, §6.3) ── */

/** 새 메시지 알림. 알림을 끈 방은 기록하지 않고(16-D6), 같은 방의 읽지 않은 알림은 하나로 묶는다. */
export const onChatMessage = (db: MockDb, workspaceId: string, roomId: string, actorId: string) => {
  const room = db.chatRooms.find((item) => item.id === roomId);
  if (!room) return db;
  const full = { ...room, memberIds: membersOf(db, room) };
  const recipients = full.memberIds.filter((id) => !db.chatMutes.includes(`${roomId}:${id}`));
  return notify(
    db,
    recipients,
    {
      type: 'NEW_CHAT_MESSAGE',
      workspaceId,
      link: `/ws/${workspaceId}/chat/${roomId}`,
      groupKey: `chat:${roomId}`,
      title: (recipientId) => `${roomTitle(full, recipientId, (id) => nameOf(db, id))} 새 메시지 1개`,
    },
    actorId,
  );
};

/** 방에 들어가 읽으면 그 방의 채팅 알림도 읽음으로 바꾼다(배지 정합, §6.2). */
export const readChatNotifications = (db: MockDb, roomId: string, accountId: string): MockDb => ({
  ...db,
  notifications: db.notifications.map((item) => (item.accountId === accountId && item.groupKey === `chat:${roomId}` && !item.read ? { ...item, read: true } : item)),
});

/* ── 멤버십(§5.6) ── */

export const onWorkspaceJoined = (db: MockDb, workspaceId: string, accountId: string) => {
  const managers = db.workspaces.find((workspace) => workspace.id === workspaceId)?.members.filter((member) => member.role !== 'MEMBER').map((member) => member.accountId) ?? [];
  return notify(db, managers, { type: 'WS_MEMBER_JOINED', workspaceId, link: `/ws/${workspaceId}/dashboard`, title: `${nameOf(db, accountId)}님이 워크스페이스에 합류했어요.` }, accountId);
};

export const onDelegationRequested = (db: MockDb, workspaceId: string, teamId: string, actorId: string) => {
  const team = teamOf(db, teamId);
  if (!team?.delegation) return db;
  return notify(db, [team.delegation.targetId], { type: 'TEAM_LEADER_DELEGATION_REQUESTED', workspaceId, link: `/ws/${workspaceId}/team/${teamId}/settings`, title: `${nameOf(db, actorId)}님이 ${team.name} 팀장 위임을 요청했어요. 24시간 안에 답해 주세요.` }, actorId);
};

/** 위임이 수락되면 이전 팀장에게 알린다. 새 팀장은 직접 수락했으므로 따로 알리지 않는다. */
export const onDelegationAccepted = (db: MockDb, workspaceId: string, teamId: string, previousLeaderId: string, actorId: string) => {
  const team = teamOf(db, teamId);
  if (!team) return db;
  return notify(db, [previousLeaderId], { type: 'TEAM_LEADER_DELEGATED', workspaceId, link: `/ws/${workspaceId}/team/${teamId}`, title: `${nameOf(db, actorId)}님이 ${team.name} 팀장을 맡았어요.` }, actorId);
};

/** 차단 당사자에게 알린다(§5.6). 차단되면 워크스페이스 화면을 볼 수 없으므로 무소속 랜딩으로 보낸다. */
export const onMemberBanned = (db: MockDb, workspaceId: string, targetId: string, actorId: string) => {
  const workspace = db.workspaces.find((item) => item.id === workspaceId);
  return notify(db, [targetId], { type: 'WS_MEMBER_BANNED', workspaceId, link: '/welcome', title: `${workspace?.name ?? '워크스페이스'}에서 차단됐어요. 더 이상 참여할 수 없어요.` }, actorId);
};

/** 팀장이 워크스페이스에서 빠져 팀장을 이어받은 사람에게 알린다. */
export const onLeaderSucceeded = (db: MockDb, workspaceId: string, teamId: string, accountId: string, actorId: string) => {
  const team = teamOf(db, teamId);
  if (!team) return db;
  return notify(db, [accountId], { type: 'TEAM_LEADER_DELEGATED', workspaceId, link: `/ws/${workspaceId}/team/${teamId}`, title: `이전 팀장이 워크스페이스를 떠나 ${team.name} 팀장을 맡게 됐어요.` }, actorId);
};
