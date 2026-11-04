import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PrCard } from '@/renewal/domain/card';
import type { CreateTeamInput, SessionSettingsInput } from '@/renewal/domain/teamBuilding';
import type { TaskAction, TaskInput } from '@/renewal/domain/kanban';
import type { AnnouncementInput, PostInput, ScheduleInput } from '@/renewal/domain/collab';
import type { TeamInfoInput } from '@/renewal/domain/teamSpace';
import type { NotificationCategory, NotificationSettings } from '@/renewal/domain/notification';
import { data } from './index';

/** 쿼리 키를 한곳에서 관리해 무효화 범위를 분명히 한다. */
export const keys = {
  me: ['me'] as const,
  workspaces: ['workspaces'] as const,
  workspace: (id: string) => ['workspaces', id] as const,
  members: (id: string) => ['workspaces', id, 'members'] as const,
  member: (id: string, accountId: string) => ['workspaces', id, 'members', accountId] as const,
  myCard: ['me', 'card'] as const,
  session: (id: string) => ['workspaces', id, 'team-building', 'session'] as const,
  teams: (id: string) => ['workspaces', id, 'teams'] as const,
  announcements: (id: string) => ['workspaces', id, 'announcements'] as const,
  teamBuilding: (id: string) => ['workspaces', id, 'team-building'] as const,
  board: (id: string) => ['workspaces', id, 'team-building', 'board'] as const,
  teamDetail: (id: string, teamId: string) => ['workspaces', id, 'team-building', 'teams', teamId] as const,
  recommendations: (id: string) => ['workspaces', id, 'team-building', 'recommendations'] as const,
  inbox: (id: string) => ['workspaces', id, 'team-building', 'inbox'] as const,
  manage: (id: string) => ['workspaces', id, 'team-building', 'manage'] as const,
  dashboard: (id: string) => ['workspaces', id, 'dashboard'] as const,
  team: (id: string, teamId: string) => ['workspaces', id, 'team', teamId] as const,
  teamOverview: (id: string, teamId: string) => ['workspaces', id, 'team', teamId, 'overview'] as const,
  tasks: (id: string, teamId: string) => ['workspaces', id, 'team', teamId, 'tasks'] as const,
  schedules: (id: string, teamId: string) => ['workspaces', id, 'team', teamId, 'schedules'] as const,
  posts: (id: string, teamId: string) => ['workspaces', id, 'team', teamId, 'posts'] as const,
  teamAnnouncements: (id: string, teamId: string) => ['workspaces', id, 'team', teamId, 'announcements'] as const,
  chatRooms: (id: string) => ['workspaces', id, 'chat'] as const,
  chatRoom: (id: string, roomId: string) => ['workspaces', id, 'chat', roomId] as const,
  messages: (id: string, roomId: string) => ['workspaces', id, 'chat', roomId, 'messages'] as const,
  videoChannels: (id: string) => ['workspaces', id, 'video'] as const,
  videoChannel: (id: string, channelId: string) => ['workspaces', id, 'video', channelId] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => data.session.me() });
export const useMyWorkspaces = () => useQuery({ queryKey: keys.workspaces, queryFn: () => data.workspaces.listMine() });
export const useWorkspace = (id: string) => useQuery({ queryKey: keys.workspace(id), queryFn: () => data.workspaces.get(id), enabled: Boolean(id) });
export const useMembers = (id: string) => useQuery({ queryKey: keys.members(id), queryFn: () => data.workspaces.listMembers(id), enabled: Boolean(id) });
export const useMember = (id: string, accountId: string) =>
  useQuery({ queryKey: keys.member(id, accountId), queryFn: () => data.workspaces.getMember(id, accountId), enabled: Boolean(id && accountId) });
export const useMyCard = () => useQuery({ queryKey: keys.myCard, queryFn: () => data.cards.getMine() });
export const useSession = (id: string) => useQuery({ queryKey: keys.session(id), queryFn: () => data.teamBuilding.getSession(id), enabled: Boolean(id) });
export const useTeams = (id: string) => useQuery({ queryKey: keys.teams(id), queryFn: () => data.teamBuilding.listTeams(id), enabled: Boolean(id) });

export const useRecentAnnouncements = (id: string, limit = 3) =>
  useQuery({ queryKey: [...keys.announcements(id), limit], queryFn: () => data.announcements.listRecent(id, limit), enabled: Boolean(id) });

/** 카드 저장 후 내 카드와 멤버 목록(갤러리)을 함께 새로 고친다. */
export const useSaveMyCard = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (card: PrCard) => data.cards.saveMine(card),
    onSuccess: (card) => {
      client.setQueryData(keys.myCard, card);
      client.invalidateQueries({ queryKey: keys.workspaces });
    },
  });
};

export const useSetCardVisibility = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (visible: boolean) => data.cards.setVisibility(visible),
    onSuccess: (card) => {
      client.setQueryData(keys.myCard, card);
      client.invalidateQueries({ queryKey: keys.workspaces });
    },
  });
};

export const useUpdateProfileImage = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (file: File | null) => data.session.updateProfileImage(file),
    onSuccess: (account) => {
      client.setQueryData(keys.me, account);
      client.invalidateQueries({ queryKey: keys.workspaces });
    },
  });
};

/* ── 팀 빌딩 ── */

export const useBoard = (id: string) => useQuery({ queryKey: keys.board(id), queryFn: () => data.teamBuilding.getBoard(id), enabled: Boolean(id) });
export const useTeamDetail = (id: string, teamId: string) =>
  useQuery({ queryKey: keys.teamDetail(id, teamId), queryFn: () => data.teamBuilding.getTeamDetail(id, teamId), enabled: Boolean(id && teamId) });
export const useRecommendations = (id: string, enabled = true) =>
  useQuery({ queryKey: keys.recommendations(id), queryFn: () => data.teamBuilding.recommendations(id), enabled: Boolean(id) && enabled });
export const useInbox = (id: string) => useQuery({ queryKey: keys.inbox(id), queryFn: () => data.teamBuilding.inbox(id), enabled: Boolean(id) });

/**
 * 팀 빌딩 변경 후 새로 고칠 범위. 제안 하나가 팀 구성, 멤버의 팀, 세션 현황에 모두 영향을 주므로 워크스페이스 단위로 무효화한다.
 */
const useTeamBuildingMutation = <Input, Output>(id: string, fn: (input: Input) => Promise<Output>) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => client.invalidateQueries({ queryKey: keys.workspace(id) }),
  });
};

export const useApply = (id: string) => useTeamBuildingMutation(id, (input: { teamId: string; message?: string }) => data.teamBuilding.apply(id, input.teamId, input.message));
export const useScout = (id: string) => useTeamBuildingMutation(id, (input: { accountId: string; message?: string }) => data.teamBuilding.scout(id, input.accountId, input.message));
export const useAccept = (id: string) => useTeamBuildingMutation(id, (applicationId: string) => data.teamBuilding.accept(id, applicationId));
export const useDecline = (id: string) => useTeamBuildingMutation(id, (applicationId: string) => data.teamBuilding.decline(id, applicationId));
export const useWithdraw = (id: string) => useTeamBuildingMutation(id, (applicationId: string) => data.teamBuilding.withdraw(id, applicationId));
export const useCreateTeam = (id: string) => useTeamBuildingMutation(id, (input: CreateTeamInput) => data.teamBuilding.createTeam(id, input));

/* 세션 운영(SCR-TB-04)과 강사 대시보드(SCR-DSH-01) */

export const useManageView = (id: string, enabled = true) =>
  useQuery({ queryKey: keys.manage(id), queryFn: () => data.teamBuilding.getManageView(id), enabled: Boolean(id) && enabled });
export const useCreateSession = (id: string) => useTeamBuildingMutation(id, (input: SessionSettingsInput) => data.teamBuilding.createSession(id, input));
export const useUpdateSession = (id: string) => useTeamBuildingMutation(id, (input: SessionSettingsInput) => data.teamBuilding.updateSession(id, input));
export const useOpenSession = (id: string) => useTeamBuildingMutation(id, (_: void) => data.teamBuilding.openSession(id));
export const useCloseSession = (id: string) => useTeamBuildingMutation(id, (_: void) => data.teamBuilding.closeSession(id));
export const useAssignMember = (id: string) =>
  useTeamBuildingMutation(id, (input: { accountId: string; teamId: string }) => data.teamBuilding.assignMember(id, input.accountId, input.teamId));
export const useUnassignMember = (id: string) => useTeamBuildingMutation(id, (accountId: string) => data.teamBuilding.unassignMember(id, accountId));
export const useAddTeamSlot = (id: string) => useTeamBuildingMutation(id, (name: string) => data.teamBuilding.addTeamSlot(id, name));
export const useRandomAssign = (id: string) => useTeamBuildingMutation(id, (_: void) => data.teamBuilding.randomAssign(id));
export const useResolveSession = (id: string) => useTeamBuildingMutation(id, (_: void) => data.teamBuilding.resolveSession(id));

export const useDashboard = (id: string, enabled = true) =>
  useQuery({ queryKey: keys.dashboard(id), queryFn: () => data.dashboard.get(id), enabled: Boolean(id) && enabled });
export const useApprove = (id: string) => useTeamBuildingMutation(id, (approvalId: string) => data.dashboard.approve(id, approvalId));
export const useRemindCardWriters = (id: string) => useTeamBuildingMutation(id, (_: void) => data.dashboard.remindCardWriters(id));

/* 인증·초대(10). 초대 정보의 "이미 멤버" 여부는 로그인 계정에 따라 달라지므로 인증이 바뀌면 캐시를 비운다(useCompleteAuth). */
export const useInvite = (code: string) => useQuery({ queryKey: ['invite', code] as const, queryFn: () => data.invites.get(code), enabled: Boolean(code) });

/* 팀 스페이스(14). 변경은 워크스페이스 단위로 무효화해 대시보드 진행도·승인 대기도 함께 새로 고친다. */
export const useTeamSpace = (id: string, teamId: string) =>
  useQuery({ queryKey: keys.team(id, teamId), queryFn: () => data.teamSpace.get(id, teamId), enabled: Boolean(id && teamId) });
export const useTeamOverview = (id: string, teamId: string) =>
  useQuery({ queryKey: keys.teamOverview(id, teamId), queryFn: () => data.teamSpace.overview(id, teamId), enabled: Boolean(id && teamId) });
export const useTasks = (id: string, teamId: string) =>
  useQuery({ queryKey: keys.tasks(id, teamId), queryFn: () => data.teamSpace.listTasks(id, teamId), enabled: Boolean(id && teamId) });
export const useConfirmRoles = (id: string, teamId: string) => useTeamBuildingMutation(id, (_: void) => data.teamSpace.confirmRoles(id, teamId));
export const useCreateTask = (id: string, teamId: string) => useTeamBuildingMutation(id, (input: TaskInput) => data.teamSpace.createTask(id, teamId, input));
export const useUpdateTask = (id: string, teamId: string) =>
  useTeamBuildingMutation(id, (input: { taskId: string; task: TaskInput }) => data.teamSpace.updateTask(id, teamId, input.taskId, input.task));
export const useTransitionTask = (id: string, teamId: string) =>
  useTeamBuildingMutation(id, (input: { taskId: string; action: TaskAction; note?: string }) => data.teamSpace.transitionTask(id, teamId, input.taskId, input.action, input.note));
export const useDeleteTask = (id: string, teamId: string) => useTeamBuildingMutation(id, (taskId: string) => data.teamSpace.deleteTask(id, teamId, taskId));
export const useAddComment = (id: string, teamId: string) =>
  useTeamBuildingMutation(id, (input: { taskId: string; content: string }) => data.teamSpace.addComment(id, teamId, input.taskId, input.content));

/* 일정·게시판·팀 공지(14 §4.3~§4.5) */
export const useSchedules = (id: string, teamId: string) =>
  useQuery({ queryKey: keys.schedules(id, teamId), queryFn: () => data.teamSpace.listSchedules(id, teamId), enabled: Boolean(id && teamId) });
export const useCreateSchedule = (id: string, teamId: string) => useTeamBuildingMutation(id, (input: ScheduleInput) => data.teamSpace.createSchedule(id, teamId, input));
export const useUpdateSchedule = (id: string, teamId: string) =>
  useTeamBuildingMutation(id, (input: { scheduleId: string; schedule: ScheduleInput }) => data.teamSpace.updateSchedule(id, teamId, input.scheduleId, input.schedule));
export const useDeleteSchedule = (id: string, teamId: string) => useTeamBuildingMutation(id, (scheduleId: string) => data.teamSpace.deleteSchedule(id, teamId, scheduleId));

export const usePosts = (id: string, teamId: string) =>
  useQuery({ queryKey: keys.posts(id, teamId), queryFn: () => data.teamSpace.listPosts(id, teamId), enabled: Boolean(id && teamId) });
export const useCreatePost = (id: string, teamId: string) => useTeamBuildingMutation(id, (input: PostInput) => data.teamSpace.createPost(id, teamId, input));
export const useUpdatePost = (id: string, teamId: string) =>
  useTeamBuildingMutation(id, (input: { postId: string; post: PostInput }) => data.teamSpace.updatePost(id, teamId, input.postId, input.post));
export const useDeletePost = (id: string, teamId: string) => useTeamBuildingMutation(id, (postId: string) => data.teamSpace.deletePost(id, teamId, postId));
export const useAddPostComment = (id: string, teamId: string) =>
  useTeamBuildingMutation(id, (input: { postId: string; content: string }) => data.teamSpace.addPostComment(id, teamId, input.postId, input.content));
export const useDeletePostComment = (id: string, teamId: string) =>
  useTeamBuildingMutation(id, (input: { postId: string; commentId: string }) => data.teamSpace.deletePostComment(id, teamId, input.postId, input.commentId));

export const useTeamAnnouncements = (id: string, teamId: string) =>
  useQuery({ queryKey: keys.teamAnnouncements(id, teamId), queryFn: () => data.teamSpace.listAnnouncements(id, teamId), enabled: Boolean(id && teamId) });
export const useCreateAnnouncement = (id: string, teamId: string) => useTeamBuildingMutation(id, (input: AnnouncementInput) => data.teamSpace.createAnnouncement(id, teamId, input));
export const useUpdateAnnouncement = (id: string, teamId: string) =>
  useTeamBuildingMutation(id, (input: { announcementId: string; announcement: AnnouncementInput }) => data.teamSpace.updateAnnouncement(id, teamId, input.announcementId, input.announcement));
export const useDeleteAnnouncement = (id: string, teamId: string) => useTeamBuildingMutation(id, (announcementId: string) => data.teamSpace.deleteAnnouncement(id, teamId, announcementId));

/* 팀 설정(14 §4.6) */
export const useUpdateTeamInfo = (id: string, teamId: string) => useTeamBuildingMutation(id, (input: TeamInfoInput) => data.teamSpace.updateTeamInfo(id, teamId, input));
export const useRequestDelegation = (id: string, teamId: string) => useTeamBuildingMutation(id, (targetId: string) => data.teamSpace.requestDelegation(id, teamId, targetId));
export const useCancelDelegation = (id: string, teamId: string) => useTeamBuildingMutation(id, (_: void) => data.teamSpace.cancelDelegation(id, teamId));
export const useRespondDelegation = (id: string, teamId: string) => useTeamBuildingMutation(id, (accept: boolean) => data.teamSpace.respondDelegation(id, teamId, accept));
export const useRemoveMember = (id: string, teamId: string) => useTeamBuildingMutation(id, (accountId: string) => data.teamSpace.removeMember(id, teamId, accountId));
export const useLeaveTeam = (id: string, teamId: string) => useTeamBuildingMutation(id, (_: void) => data.teamSpace.leaveTeam(id, teamId));
export const useDeleteTeam = (id: string, teamId: string) => useTeamBuildingMutation(id, (confirmName: string) => data.teamSpace.deleteTeam(id, teamId, confirmName));

/*
 * 채팅·화상회의(15). 목업은 실시간 연결이 없어 주기 조회로 새 메시지와 미읽음을 가져온다.
 * http 어댑터는 SSE 이벤트를 받을 때 같은 쿼리 키를 무효화하면 된다.
 */
const CHAT_POLL_MS = 4000;
export const useChatRooms = (id: string, enabled = true) =>
  useQuery({ queryKey: keys.chatRooms(id), queryFn: () => data.chat.listRooms(id), enabled: Boolean(id) && enabled, refetchInterval: CHAT_POLL_MS * 2 });
export const useChatRoom = (id: string, roomId: string) =>
  useQuery({ queryKey: keys.chatRoom(id, roomId), queryFn: () => data.chat.getRoom(id, roomId), enabled: Boolean(id && roomId) });
export const useMessages = (id: string, roomId: string) =>
  useQuery({ queryKey: keys.messages(id, roomId), queryFn: () => data.chat.listMessages(id, roomId), enabled: Boolean(id && roomId), refetchInterval: CHAT_POLL_MS });

/** 채팅 변경은 채팅 쿼리만 새로 고친다. 메시지 전송마다 워크스페이스 전체를 다시 부르지 않기 위해서다. */
const useChatMutation = <Input, Output>(id: string, fn: (input: Input) => Promise<Output>) => {
  const client = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => client.invalidateQueries({ queryKey: keys.chatRooms(id) }) });
};
export const useSendMessage = (id: string, roomId: string) => useChatMutation(id, (content: string) => data.chat.sendMessage(id, roomId, content));
export const useCreateRoom = (id: string) => useChatMutation(id, (input: { title?: string; memberIds: string[] }) => data.chat.createRoom(id, input));
export const useOpenDm = (id: string) => useChatMutation(id, (accountId: string) => data.chat.openDm(id, accountId));
export const useRenameRoom = (id: string, roomId: string) => useChatMutation(id, (title: string) => data.chat.renameRoom(id, roomId, title));
export const useAddChatMembers = (id: string, roomId: string) => useChatMutation(id, (memberIds: string[]) => data.chat.addMembers(id, roomId, memberIds));
export const useLeaveRoom = (id: string, roomId: string) => useChatMutation(id, (_: void) => data.chat.leaveRoom(id, roomId));
export const useDeleteRoom = (id: string, roomId: string) => useChatMutation(id, (_: void) => data.chat.deleteRoom(id, roomId));
export const useSetMuted = (id: string, roomId: string) => useChatMutation(id, (muted: boolean) => data.chat.setMuted(id, roomId, muted));

/** 여러 워크스페이스의 채팅방 목록. 계정 설정의 음소거 목록이 쓴다(16 §4.3). */
export const useChatRoomsOf = (ids: string[]) =>
  useQueries({ queries: ids.map((id) => ({ queryKey: keys.chatRooms(id), queryFn: () => data.chat.listRooms(id) })) });

export const useVideoChannels = (id: string, enabled = true) =>
  useQuery({ queryKey: keys.videoChannels(id), queryFn: () => data.video.listChannels(id), enabled: Boolean(id) && enabled });
export const useVideoChannel = (id: string, channelId: string, live = false) =>
  useQuery({ queryKey: keys.videoChannel(id, channelId), queryFn: () => data.video.getChannel(id, channelId), enabled: Boolean(id && channelId), refetchInterval: live ? CHAT_POLL_MS * 2 : false });

/*
 * 알림(16). 다른 사람의 행동으로 생기므로 목업은 주기 조회로 가져온다. 알림 쿼리는 워크스페이스 밖(['notifications'])에 둔다.
 */
const NOTIFICATION_POLL_MS = 8000;
export const notificationKeys = {
  all: ['notifications'] as const,
  list: (category: string, limit: number) => ['notifications', 'list', category, limit] as const,
  summary: ['notifications', 'summary'] as const,
  settings: ['notifications', 'settings'] as const,
};
export const useNotifications = (category: NotificationCategory | undefined, limit: number, enabled = true) =>
  useQuery({
    queryKey: notificationKeys.list(category ?? 'ALL', limit),
    queryFn: () => data.notifications.list({ category, limit }),
    enabled,
    refetchInterval: NOTIFICATION_POLL_MS,
    // 더 보기로 limit만 바뀔 때는 이전 목록을 유지한다. 계열이 바뀌면 다른 목록이라 유지하지 않는다.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === (category ?? 'ALL') ? previous : undefined),
  });
export const useUnreadSummary = (enabled = true) =>
  useQuery({ queryKey: notificationKeys.summary, queryFn: () => data.notifications.unreadSummary(), enabled, refetchInterval: NOTIFICATION_POLL_MS });

const useNotificationMutation = <Input, Output>(fn: (input: Input) => Promise<Output>) => {
  const client = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => client.invalidateQueries({ queryKey: notificationKeys.all }) });
};
export const useMarkNotificationRead = () => useNotificationMutation((id: string) => data.notifications.markRead(id));
export const useMarkAllRead = () => useNotificationMutation((category: NotificationCategory | undefined) => data.notifications.markAllRead(category));
export const useRemoveNotification = () => useNotificationMutation((id: string) => data.notifications.remove(id));
export const useMarkWorkspaceSeen = () => useNotificationMutation((workspaceId: string) => data.notifications.markWorkspaceSeen(workspaceId));
export const useNotificationSettings = () => useQuery({ queryKey: notificationKeys.settings, queryFn: () => data.notifications.getSettings() });
export const useUpdateNotificationSettings = () => useNotificationMutation((settings: NotificationSettings) => data.notifications.updateSettings(settings));
