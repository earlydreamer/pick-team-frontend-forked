import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  MemberPRCardProfile,
  TeamBuildingSession,
  TeamRecruitment,
  TeamApplication,
  RenewalKanbanTask,
  RenewalNotification,
  NotificationSettingsState,
  SafetyReport,
  DelegationRequest,
  PersonalOrTeamSchedule,
  WorkspaceNoticeItem,
  DesiredRoleCode,
  KanbanTaskStatus,
  ReportTargetType,
  ReportReasonType,
  ReportActionType,
} from '../types/renewal';
import { Workspace, WorkspaceMemberRole } from '@/features/workspace/types/workspace';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import { useWorkspace } from '@/features/workspace/core/hooks/useWorkspace';
import { useToast } from '@/components/ui/Toast';

export type ActivePersonaPreset = 'STUDENT' | 'LEADER' | 'INSTRUCTOR' | 'SYSADMIN';

interface RenewalContextValue {
  // Active Persona & Role simulation / real role resolution
  activePersona: ActivePersonaPreset;
  switchPersona: (persona: ActivePersonaPreset) => void;
  getEffectiveWorkspaceRole: (workspaceId?: string) => WorkspaceMemberRole;
  isSystemAdmin: boolean;

  // Workspaces & Members (with PR Card v2)
  allWorkspaces: Workspace[];
  getWorkspaceById: (wsId?: string) => Workspace;
  updateWorkspaceConfig: (wsId: string, patch: Partial<Workspace>) => void;
  refreshInviteLink: (wsId: string, expiresAt: string | null) => string;
  toggleWorkspaceArchive: (wsId: string, archived: boolean) => void;

  membersByWorkspace: Record<string, MemberPRCardProfile[]>;
  getWorkspaceMembers: (wsId?: string) => MemberPRCardProfile[];
  getMemberCard: (wsId: string, accountId: string) => MemberPRCardProfile | undefined;
  myPRCard: MemberPRCardProfile;
  saveMyPRCard: (patch: Partial<MemberPRCardProfile>) => void;
  changeMemberWorkspaceRole: (wsId: string, accountId: string, newRole: WorkspaceMemberRole) => void;
  kickWorkspaceMember: (wsId: string, accountId: string) => void;
  banWorkspaceMember: (wsId: string, accountId: string) => void;
  unbanWorkspaceMember: (wsId: string, accountId: string) => void;
  sendUnwrittenCardReminders: (wsId: string) => number;

  // Team Building Session & Recruitments & Applications
  sessionsByWorkspace: Record<string, TeamBuildingSession>;
  getSession: (wsId?: string) => TeamBuildingSession;
  updateSession: (wsId: string, patch: Partial<TeamBuildingSession>) => void;
  recruitmentsByWorkspace: Record<string, TeamRecruitment[]>;
  getRecruitments: (wsId?: string) => TeamRecruitment[];
  createRecruitmentTeam: (
    wsId: string,
    payload: {
      name: string;
      intro: string;
      goalTemperature: 1 | 2 | 3 | 4 | 5;
      roles: { role: DesiredRoleCode; count: number }[];
      kickoffTimeNote?: string;
    }
  ) => TeamRecruitment;
  applicationsByWorkspace: Record<string, TeamApplication[]>;
  getApplications: (wsId?: string) => TeamApplication[];
  submitApplication: (
    wsId: string,
    payload: {
      direction: 'APPLY' | 'SCOUT';
      targetTeamId: string;
      targetMemberId?: string;
      desiredRole: DesiredRoleCode;
      message: string;
    }
  ) => boolean;
  decideApplication: (wsId: string, applicationId: string, decision: 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN') => void;
  manualAssignMemberToTeam: (wsId: string, memberId: string, targetTeamId: string | null) => void;
  runConstrainedRandomFallback: (wsId: string) => number;
  resolveTeamBuildingSession: (wsId: string) => boolean;

  // Kanban & Completion Approval Workflow
  kanbanTasks: RenewalKanbanTask[];
  getTeamKanbanTasks: (teamId: string) => RenewalKanbanTask[];
  getWorkspaceApprovalQueue: (wsId?: string) => RenewalKanbanTask[];
  createKanbanTask: (
    task: Omit<RenewalKanbanTask, 'id' | 'comments' | 'updatedAt' | 'status'> & { status?: KanbanTaskStatus }
  ) => void;
  moveKanbanTaskStatus: (taskId: string, status: KanbanTaskStatus) => void;
  requestTaskCompletion: (taskId: string, message: string) => void;
  approveOrRejectTask: (
    taskId: string,
    approved: boolean,
    comment: string,
    approverRole: 'LEADER' | 'MANAGER'
  ) => void;
  addKanbanComment: (taskId: string, content: string) => void;
  deleteKanbanTask: (taskId: string) => void;

  // Schedules (Team + Personal Layer)
  schedules: PersonalOrTeamSchedule[];
  getTeamSchedules: (teamId: string, includePersonal: boolean) => PersonalOrTeamSchedule[];
  addSchedule: (item: Omit<PersonalOrTeamSchedule, 'id' | 'creatorId' | 'creatorName'>) => void;
  deleteSchedule: (id: string) => void;

  // Notices / Announcements
  notices: WorkspaceNoticeItem[];
  getWorkspaceNotices: (wsId: string, teamId?: string) => WorkspaceNoticeItem[];
  addNotice: (wsId: string, title: string, content: string, teamId?: string, pinned?: boolean) => void;
  markNoticeRead: (noticeId: string) => void;

  // Team Settings & Leader Delegation
  delegations: Record<string, DelegationRequest>;
  requestLeaderDelegation: (teamId: string, targetMemberId: string) => void;
  respondLeaderDelegation: (teamId: string, accept: boolean) => void;

  // Notifications & Settings
  notifications: RenewalNotification[];
  unreadNotificationCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  deleteNotification: (id: string) => void;
  notificationSettings: NotificationSettingsState;
  updateNotificationSettings: (patch: Partial<NotificationSettingsState>) => void;
  toggleMuteChatRoom: (roomId: string) => void;

  // Trust & Safety Reports
  reports: SafetyReport[];
  submitSafetyReport: (payload: {
    workspaceId: string;
    targetType: ReportTargetType;
    targetId: string;
    targetLabel: string;
    targetContentSnippet: string;
    reason: ReportReasonType;
    reasonDetail?: string;
  }) => void;
  processSafetyReport: (
    reportId: string,
    status: 'DISMISSED' | 'ACTED',
    actionType?: ReportActionType,
    adminMemo?: string
  ) => void;
}

const RenewalContext = createContext<RenewalContextValue | undefined>(undefined);

const INITIAL_WORKSPACES: Workspace[] = [
  {
    id: 'ws-kosta-295',
    name: 'KOSTA 295기 풀스택 파이널',
    description: 'Java Spring Boot & React 19 클라우드 네이티브 실전 프로젝트 기수',
    owner: { id: 100, name: '박강사 (과정책임)', role: 'OWNER' },
    currentMemberRole: 'MEMBER',
    passwordProtected: false,
    inviteCode: 'KOSTA-295-PERI',
    inviteCodeExpiresAt: '2026-11-15T23:59:59',
    inviteUsedCount: 28,
    inviteActive: true,
    capacity: 32,
    teamBuildingEnabled: true,
    archived: false,
    memberCount: 28,
    members: [
      { id: 100, name: '박강사 (과정책임)', email: 'instructor@pickteam.kr', role: 'OWNER', status: 'ACTIVE' },
      { id: 101, name: '김민서 (운영매니저)', email: 'manager@pickteam.kr', role: 'ADMIN', status: 'ACTIVE' },
      { id: 1, name: '박재현', email: 'jaehyun@pickteam.kr', role: 'MEMBER', status: 'ACTIVE' },
      { id: 2, name: '김민지', email: 'minji@pickteam.kr', role: 'MEMBER', status: 'ACTIVE' },
      { id: 3, name: '이승우', email: 'seungwoo@pickteam.kr', role: 'MEMBER', status: 'ACTIVE' },
      { id: 4, name: '최수연', email: 'suyeon@pickteam.kr', role: 'MEMBER', status: 'ACTIVE' },
      { id: 5, name: '정다은', email: 'daeun@pickteam.kr', role: 'MEMBER', status: 'ACTIVE' },
      { id: 6, name: '윤지호', email: 'jiho@pickteam.kr', role: 'MEMBER', status: 'ACTIVE' },
      { id: 7, name: '한서준', email: 'seojun@pickteam.kr', role: 'MEMBER', status: 'ACTIVE' },
      { id: 8, name: '오하윤', email: 'hayoon@pickteam.kr', role: 'MEMBER', status: 'ACTIVE' },
    ],
    createdAt: '2026-10-01T09:00:00',
    updatedAt: '2026-10-14T09:00:00',
  },
  {
    id: 'ws-devcourse-be4',
    name: '데브코스 클라우드 BE 4기',
    description: '대규모 트래픽 처리 및 백엔드 아키텍처 심화 과정',
    owner: { id: 100, name: '박강사 (과정책임)', role: 'OWNER' },
    currentMemberRole: 'MEMBER',
    passwordProtected: true,
    inviteCode: 'DEV-BE4-2026',
    inviteCodeExpiresAt: '2026-12-01T23:59:59',
    inviteUsedCount: 24,
    inviteActive: true,
    capacity: 30,
    teamBuildingEnabled: true,
    archived: false,
    memberCount: 24,
    members: [
      { id: 100, name: '박강사 (과정책임)', email: 'instructor@pickteam.kr', role: 'OWNER', status: 'ACTIVE' },
      { id: 1, name: '박재현', email: 'jaehyun@pickteam.kr', role: 'MEMBER', status: 'ACTIVE' },
    ],
    createdAt: '2026-09-15T09:00:00',
    updatedAt: '2026-10-12T09:00:00',
  },
];

const INITIAL_MEMBERS: MemberPRCardProfile[] = [
  {
    id: '1',
    name: '박재현',
    email: 'jaehyun@pickteam.kr',
    workspaceRole: 'MEMBER',
    workspaceStatus: 'ACTIVE',
    desiredRole1: 'BACKEND',
    desiredRole2: 'INFRA',
    weeklyAvailableHours: 'H20_30',
    availableTimeSlots: ['AFTERNOON', 'EVENING', 'WEEKEND'],
    goalTemperature: 4,
    hashtags: ['Spring Boot', 'QueryDSL', 'Redis', 'LiveKit', 'Docker', 'SSE'],
    preferWorkstyleOptions: ['ASYNC_FIRST', 'DETAIL_ORIENTED', 'STRUCTURED'],
    dislikeWorkstyleOptions: ['FLEXIBLE'],
    preferWorkstyleText: 'API 명세와 도메인 규칙을 명확히 합의하고 비동기로 빠르게 공유하는 문화를 선호합니다.',
    dislikeWorkstyleText: '근거 없는 일정 변경이나 공유 없는 잠수',
    introduction:
      'SSE 실시간 메신저와 온프레미스 인프라 구성을 깊게 다뤄봤습니다. 단순 CRUD를 넘어 실사용 가능한 완성도를 함께 만들 팀을 찾고 있습니다!',
    portfolio: 'https://github.com/earlydreamer',
    mbti: 'INTJ',
    mbtiVisible: true,
    cardVisible: true,
    consentGivenAt: '2026-10-10T10:15:00',
    assignedTeamId: 'team-alpha',
    assignedTeamName: '코드블루 (CodeBlue)',
  },
  {
    id: '2',
    name: '김민지',
    email: 'minji@pickteam.kr',
    workspaceRole: 'MEMBER',
    workspaceStatus: 'ACTIVE',
    desiredRole1: 'FRONTEND',
    desiredRole2: 'DESIGN',
    weeklyAvailableHours: 'H20_30',
    availableTimeSlots: ['AFTERNOON', 'EVENING'],
    goalTemperature: 4,
    hashtags: ['React 19', 'TypeScript', 'Tailwind CSS', 'Figma', 'Design System'],
    preferWorkstyleOptions: ['ASYNC_FIRST', 'DETAIL_ORIENTED', 'SPEED_FIRST'],
    dislikeWorkstyleOptions: [],
    preferWorkstyleText: '컴포넌트 토큰화와 접근성(WCAG 3.0) 준수에 관심이 많습니다.',
    introduction:
      '사용자 여정이 끊기지 않는 프론트엔드 아키텍처와 디자인 시스템을 설계합니다. 디테일한 인터랙션을 함께 고민해요.',
    portfolio: 'https://github.com/minji-fe',
    mbti: 'ENFP',
    mbtiVisible: true,
    cardVisible: true,
    consentGivenAt: '2026-10-10T11:20:00',
    assignedTeamId: 'team-alpha',
    assignedTeamName: '코드블루 (CodeBlue)',
  },
  {
    id: '3',
    name: '이승우',
    email: 'seungwoo@pickteam.kr',
    workspaceRole: 'MEMBER',
    workspaceStatus: 'ACTIVE',
    desiredRole1: 'FULLSTACK',
    desiredRole2: 'BACKEND',
    weeklyAvailableHours: 'GT30H',
    availableTimeSlots: ['MORNING', 'AFTERNOON', 'EVENING', 'WEEKEND'],
    goalTemperature: 5,
    hashtags: ['Java', 'Spring Security', 'React', 'MySQL', 'Kubernetes'],
    preferWorkstyleOptions: ['SPEED_FIRST', 'SYNC_PREFERRED', 'STRUCTURED'],
    dislikeWorkstyleOptions: [],
    preferWorkstyleText: '매일 15분 데일리 스크럼으로 블로커를 즉시 해결하는 팀을 선호합니다.',
    introduction:
      '파이널 프로젝트 최우수상을 목표로 풀타임 몰입 가능합니다. 인증/보안과 실시간 파이프라인 구축 경험이 있습니다.',
    portfolio: 'https://github.com/seungwoo-dev',
    mbti: 'ENTJ',
    mbtiVisible: true,
    cardVisible: true,
    consentGivenAt: '2026-10-10T12:00:00',
    assignedTeamId: 'team-alpha',
    assignedTeamName: '코드블루 (CodeBlue)',
  },
  {
    id: '4',
    name: '최수연',
    email: 'suyeon@pickteam.kr',
    workspaceRole: 'MEMBER',
    workspaceStatus: 'ACTIVE',
    desiredRole1: 'PM',
    desiredRole2: 'FRONTEND',
    weeklyAvailableHours: 'H10_20',
    availableTimeSlots: ['EVENING', 'WEEKEND'],
    goalTemperature: 3,
    hashtags: ['프로덕트기획', '유저스토리', 'React', 'Notion', 'QA자동화'],
    preferWorkstyleOptions: ['DETAIL_ORIENTED', 'STRUCTURED', 'ASYNC_FIRST'],
    dislikeWorkstyleOptions: ['SPEED_FIRST'],
    preferWorkstyleText: '기획 문서 정본화와 칸반 티켓 단위의 명확한 수용 기준 정의를 좋아합니다.',
    introduction:
      '서비스 기획자 출신 개발 수강생입니다. 모호한 요구사항을 구조화된 스펙과 와이어프레임으로 정리해 드립니다.',
    portfolio: 'https://notion.so/suyeon-pm',
    mbti: 'INFJ',
    mbtiVisible: false,
    cardVisible: true,
    consentGivenAt: '2026-10-11T09:30:00',
    assignedTeamId: 'team-luna',
    assignedTeamName: '달빛스튜디오 (Luna)',
  },
  {
    id: '5',
    name: '정다은',
    email: 'daeun@pickteam.kr',
    workspaceRole: 'MEMBER',
    workspaceStatus: 'ACTIVE',
    desiredRole1: 'BACKEND',
    desiredRole2: 'AI_DATA',
    weeklyAvailableHours: 'H20_30',
    availableTimeSlots: ['AFTERNOON', 'EVENING', 'WEEKEND'],
    goalTemperature: 4,
    hashtags: ['Spring Boot', 'JPA', 'Python', 'FastAPI', 'PostgreSQL'],
    preferWorkstyleOptions: ['ASYNC_FIRST', 'DETAIL_ORIENTED'],
    dislikeWorkstyleOptions: [],
    preferWorkstyleText: '코드 리뷰와 테스트 코드를 통해 안정적으로 기능을 쌓아가는 방식을 선호합니다.',
    introduction:
      '백엔드 도메인 모델링과 데이터 파이프라인에 강점이 있습니다. 아직 팀 미배정 상태라 좋은 팀의 스카우트를 기다리고 있어요!',
    portfolio: 'https://github.com/daeun-backend',
    mbti: 'ISTJ',
    mbtiVisible: true,
    cardVisible: true,
    consentGivenAt: '2026-10-11T14:00:00',
    assignedTeamId: null,
    assignedTeamName: null,
  },
  {
    id: '6',
    name: '윤지호',
    email: 'jiho@pickteam.kr',
    workspaceRole: 'MEMBER',
    workspaceStatus: 'ACTIVE',
    desiredRole1: 'DESIGN',
    desiredRole2: 'FRONTEND',
    weeklyAvailableHours: 'H20_30',
    availableTimeSlots: ['AFTERNOON', 'EVENING'],
    goalTemperature: 4,
    hashtags: ['UI/UX', 'Figma', 'Tailwind', 'Framer Motion', '반응형웹'],
    preferWorkstyleOptions: ['SYNC_PREFERRED', 'SPEED_FIRST', 'FLEXIBLE'],
    dislikeWorkstyleOptions: [],
    preferWorkstyleText: '화면 프로토타입을 먼저 띄워놓고 함께 피드백 나누는 걸 좋아합니다.',
    introduction:
      '브랜드 아이덴티티부터 디자인 토큰, React 퍼블리싱까지 직접 구현하는 프로덕트 디자이너 겸 프론트엔드입니다.',
    portfolio: 'https://behance.net/jiho-ux',
    mbti: 'ENFJ',
    mbtiVisible: true,
    cardVisible: true,
    consentGivenAt: '2026-10-11T16:10:00',
    assignedTeamId: null,
    assignedTeamName: null,
  },
  {
    id: '7',
    name: '한서준',
    email: 'seojun@pickteam.kr',
    workspaceRole: 'MEMBER',
    workspaceStatus: 'ACTIVE',
    desiredRole1: 'INFRA',
    desiredRole2: 'BACKEND',
    weeklyAvailableHours: 'H10_20',
    availableTimeSlots: ['EVENING', 'WEEKEND'],
    goalTemperature: 3,
    hashtags: ['Docker', 'GitHub Actions', 'Nginx', 'AWS', 'Cloudflare'],
    preferWorkstyleOptions: ['ASYNC_FIRST', 'STRUCTURED'],
    dislikeWorkstyleOptions: [],
    preferWorkstyleText: 'CI/CD 자동화와 무중단 배포 파이프라인 구축을 맡고 싶습니다.',
    introduction: '인프라 및 배포 환경 구성에 자신 있습니다. 저녁·주말 시간대에 집중 투입 가능합니다.',
    portfolio: 'https://github.com/seojun-infra',
    mbti: 'INTP',
    mbtiVisible: true,
    cardVisible: true,
    consentGivenAt: '2026-10-12T10:00:00',
    assignedTeamId: null,
    assignedTeamName: null,
  },
  {
    id: '8',
    name: '오하윤',
    email: 'hayoon@pickteam.kr',
    workspaceRole: 'MEMBER',
    workspaceStatus: 'ACTIVE',
    // Card not written yet (11-D3 blurred placeholder demonstration)
    cardVisible: false,
    consentGivenAt: null,
    assignedTeamId: null,
    assignedTeamName: null,
  },
];

const INITIAL_SESSION: TeamBuildingSession = {
  id: 'ses-kosta-295',
  workspaceId: 'ws-kosta-295',
  name: '295기 파이널 프로젝트 공식 팀 빌딩',
  status: 'OPEN',
  startAt: '2026-10-10T09:00:00',
  endAt: '2026-10-17T23:59:59',
  teamSizeMin: 4,
  teamSizeMax: 5,
  allowMemberTeamCreate: true,
};

const INITIAL_RECRUITMENTS: TeamRecruitment[] = [
  {
    id: 'team-alpha',
    workspaceId: 'ws-kosta-295',
    sessionId: 'ses-kosta-295',
    name: '코드블루 (CodeBlue)',
    intro: '부트캠프를 위한 올인원 팀 빌딩·협업 플랫폼 MVP 2.0을 실서비스 수준으로 완성할 팀원을 찾습니다!',
    goalTemperature: 4,
    commonTimeSlots: ['AFTERNOON', 'EVENING', 'WEEKEND'],
    weeklyHours: 'H20_30',
    preferWorkstyles: ['ASYNC_FIRST', 'DETAIL_ORIENTED', 'STRUCTURED'],
    leaderId: '3',
    leaderName: '이승우',
    memberIds: ['3', '1', '2'],
    recruitRoles: [
      { role: 'BACKEND', totalCount: 2, filledCount: 1, pendingApplyCount: 1 },
      { role: 'FRONTEND', totalCount: 1, filledCount: 1, pendingApplyCount: 0 },
      { role: 'DESIGN', totalCount: 1, filledCount: 0, pendingApplyCount: 1 },
      { role: 'INFRA', totalCount: 1, filledCount: 1, pendingApplyCount: 0 },
    ],
    status: 'RECRUITING',
    kickoffTimeNote: '매주 월/목 20:00 정기 싱크 + 상시 비동기 협업',
    createdAt: '2026-10-10T13:00:00',
  },
  {
    id: 'team-luna',
    workspaceId: 'ws-kosta-295',
    sessionId: 'ses-kosta-295',
    name: '달빛스튜디오 (Luna)',
    intro: '안정적인 일정 관리와 탄탄한 문서화를 바탕으로 스트레스 없이 완주할 분들을 환영해요.',
    goalTemperature: 3,
    commonTimeSlots: ['EVENING', 'WEEKEND'],
    weeklyHours: 'H10_20',
    preferWorkstyles: ['DETAIL_ORIENTED', 'STRUCTURED', 'ASYNC_FIRST'],
    leaderId: '4',
    leaderName: '최수연',
    memberIds: ['4'],
    recruitRoles: [
      { role: 'BACKEND', totalCount: 2, filledCount: 0, pendingApplyCount: 1 },
      { role: 'FRONTEND', totalCount: 1, filledCount: 0, pendingApplyCount: 0 },
      { role: 'PM', totalCount: 1, filledCount: 1, pendingApplyCount: 0 },
    ],
    status: 'RECRUITING',
    kickoffTimeNote: '평일 저녁 21:00 및 토요일 오후 집중 작업',
    createdAt: '2026-10-11T10:00:00',
  },
  {
    id: 'team-nova',
    workspaceId: 'ws-kosta-295',
    sessionId: 'ses-kosta-295',
    name: '노바 AI (Nova Lab)',
    intro: 'AI 에이전트 기반 코드 리뷰 & 기술 면접 코칭 SaaS를 빠르게 프로토타이핑합니다.',
    goalTemperature: 5,
    commonTimeSlots: ['MORNING', 'AFTERNOON', 'EVENING'],
    weeklyHours: 'GT30H',
    preferWorkstyles: ['SPEED_FIRST', 'SYNC_PREFERRED'],
    leaderId: '5',
    leaderName: '정다은',
    memberIds: [],
    recruitRoles: [
      { role: 'AI_DATA', totalCount: 1, filledCount: 0, pendingApplyCount: 0 },
      { role: 'BACKEND', totalCount: 2, filledCount: 0, pendingApplyCount: 0 },
      { role: 'FRONTEND', totalCount: 1, filledCount: 0, pendingApplyCount: 0 },
    ],
    status: 'RECRUITING',
    kickoffTimeNote: '코어타임 10:00 ~ 19:00 실시간 음성 채널 상주',
    createdAt: '2026-10-12T09:00:00',
  },
];

const INITIAL_APPLICATIONS: TeamApplication[] = [
  {
    id: 'app-1',
    workspaceId: 'ws-kosta-295',
    sessionId: 'ses-kosta-295',
    direction: 'SCOUT',
    applicantId: '1',
    applicantName: '박재현',
    applicantRole1: 'BACKEND',
    targetTeamId: 'team-luna',
    targetTeamName: '달빛스튜디오 (Luna)',
    desiredRole: 'BACKEND',
    message: '재현님 PR 카드의 API 명세 중심 협업 스타일이 저희 팀과 정말 잘 맞을 것 같아 백엔드 리드로 스카우트 제안드립니다!',
    status: 'PENDING',
    createdAt: '2026-10-13T18:20:00',
  },
  {
    id: 'app-2',
    workspaceId: 'ws-kosta-295',
    sessionId: 'ses-kosta-295',
    direction: 'APPLY',
    applicantId: '5',
    applicantName: '정다은',
    applicantRole1: 'BACKEND',
    targetTeamId: 'team-alpha',
    targetTeamName: '코드블루 (CodeBlue)',
    desiredRole: 'BACKEND',
    message: 'QueryDSL 최적화와 도메인 테스트 작성에 자신이 있습니다. 코드블루 백엔드 포지션에 합류하고 싶습니다!',
    status: 'PENDING',
    createdAt: '2026-10-14T09:10:00',
  },
  {
    id: 'app-3',
    workspaceId: 'ws-kosta-295',
    sessionId: 'ses-kosta-295',
    direction: 'APPLY',
    applicantId: '6',
    applicantName: '윤지호',
    applicantRole1: 'DESIGN',
    targetTeamId: 'team-alpha',
    targetTeamName: '코드블루 (CodeBlue)',
    desiredRole: 'DESIGN',
    message: 'Very Peri 키 컬러 기반 디자인 시스템과 반응형 UI 구현을 맡아보고 싶습니다.',
    status: 'PENDING',
    createdAt: '2026-10-14T10:05:00',
  },
];

const INITIAL_KANBAN_TASKS: RenewalKanbanTask[] = [
  {
    id: 'task-101',
    workspaceId: 'ws-kosta-295',
    teamId: 'team-alpha',
    teamName: '코드블루 (CodeBlue)',
    title: 'Account-Id 헤더 인증 우회 제거 및 @AuthenticationPrincipal 일원화',
    description: '7개 컨트롤러의 임의 Account-Id 수신을 제거하고 JWT SecurityContext 기반으로 리소스 소유권 검증을 통합합니다.',
    status: 'DONE',
    assigneeId: '3',
    assigneeName: '이승우',
    deadline: '2026-10-13',
    priority: 'HIGH',
    tags: ['보안', 'M0.2', 'Backend'],
    approvedBy: '이승우',
    approvedByRole: 'LEADER',
    approvedAt: '2026-10-13 17:40',
    comments: [
      {
        id: 'c-1',
        authorId: '1',
        authorName: '박재현',
        content: '통합 테스트 28개 모두 통과 확인했습니다!',
        createdAt: '2026-10-13 16:30',
      },
    ],
    updatedAt: '2026-10-13T17:40:00',
  },
  {
    id: 'task-102',
    workspaceId: 'ws-kosta-295',
    teamId: 'team-alpha',
    teamName: '코드블루 (CodeBlue)',
    title: '자기 PR 카드 v2 온보딩 위저드 및 워크스페이스 공개 범위 API 연동',
    description: '희망 역할 1·2순위, 주간 가용 시간, 목표 온도 5점 척도 및 워크스페이스 스코프 공개 동의 플로우 구현',
    status: 'APPROVAL_PENDING',
    assigneeId: '1',
    assigneeName: '박재현',
    deadline: '2026-10-15',
    priority: 'HIGH',
    tags: ['PR카드', 'M2.1', 'Fullstack'],
    completionRequestMessage: '온보딩 3단계 위저드, localStorage 임시저장, 갤러리 다중 필터까지 구현 완료하여 승인 요청드립니다.',
    completionRequestedAt: '2시간 전',
    comments: [
      {
        id: 'c-2',
        authorId: '2',
        authorName: '김민지',
        content: '모바일 뷰포트(375px)에서도 위저드 스텝 전환이 아주 매끄럽네요!',
        createdAt: '1시간 전',
      },
    ],
    updatedAt: '2026-10-14T11:00:00',
  },
  {
    id: 'task-103',
    workspaceId: 'ws-kosta-295',
    teamId: 'team-alpha',
    teamName: '코드블루 (CodeBlue)',
    title: 'Very Peri(#6667AB) & WCAG 3.0 APCA 디자인 토큰 시스템 구축',
    description: 'Primitive → Semantic → Component 3계층 CSS 변수 및 APCA Lc ≥ 75 명도 대비 검증 완료',
    status: 'APPROVAL_PENDING',
    assigneeId: '2',
    assigneeName: '김민지',
    deadline: '2026-10-15',
    priority: 'HIGH',
    tags: ['디자인시스템', 'WCAG3.0', 'Frontend'],
    completionRequestMessage: '전역 토큰 정의 및 버튼·배지·모달·토스트 컴포넌트 APCA 대비 검수 완료했습니다.',
    completionRequestedAt: '45분 전',
    comments: [],
    updatedAt: '2026-10-14T12:15:00',
  },
  {
    id: 'task-104',
    workspaceId: 'ws-kosta-295',
    teamId: 'team-alpha',
    teamName: '코드블루 (CodeBlue)',
    title: '설명 가능한 규칙 기반 매칭 v1 점수 산출 및 추천 사유 생성기',
    description: '역할 상보성(40) + 가용시간(25) + 목표온도(20) + 협업스타일(15) 가중치 계산 및 상위 2개 기여 신호 문장화',
    status: 'IN_PROGRESS',
    assigneeId: '1',
    assigneeName: '박재현',
    deadline: '2026-10-16',
    priority: 'HIGH',
    tags: ['매칭엔진', 'M2.4'],
    comments: [],
    updatedAt: '2026-10-14T10:00:00',
  },
  {
    id: 'task-105',
    workspaceId: 'ws-kosta-295',
    teamId: 'team-alpha',
    teamName: '코드블루 (CodeBlue)',
    title: 'SSE 알림 센터 실연결 및 채팅방 음소거/재전송 UX 정비',
    description: '카카오톡 목업 알림 제거, 6개 계열별 필터 탭 및 딥링크 착지 규약 적용',
    status: 'TODO',
    assigneeId: '2',
    assigneeName: '김민지',
    deadline: '2026-10-18',
    priority: 'MEDIUM',
    tags: ['SSE', '알림센터', 'M1.3'],
    comments: [],
    updatedAt: '2026-10-14T09:00:00',
  },
  {
    id: 'task-201',
    workspaceId: 'ws-kosta-295',
    teamId: 'team-luna',
    teamName: '달빛스튜디오 (Luna)',
    title: '서비스 요구사항 정의서 및 E2E 사용자 여정 다이어그램 확정',
    description: '강사·수강생·팀장 페르소나별 핵심 시나리오 및 예외 분기 정의',
    status: 'APPROVAL_PENDING',
    assigneeId: '4',
    assigneeName: '최수연',
    deadline: '2026-10-14',
    priority: 'MEDIUM',
    tags: ['기획', 'IA'],
    completionRequestMessage: '00~17 전체 상세 기획서 및 Open Questions 추천안 확정본 반영 완료했습니다.',
    completionRequestedAt: '1일 전',
    comments: [],
    updatedAt: '2026-10-13T18:00:00',
  },
];

const INITIAL_SCHEDULES: PersonalOrTeamSchedule[] = [
  {
    id: 'sch-1',
    workspaceId: 'ws-kosta-295',
    teamId: 'team-alpha',
    title: '스프린트 1 킥오프 & 역할 확정 회의',
    startDate: '2026-10-14T20:00',
    endDate: '2026-10-14T21:30',
    scheduleDesc: '팀원 PR 카드 기반 세부 담당 모듈 배정 및 API 계약 확정',
    type: 'MEETING',
    isPersonal: false,
    creatorId: '3',
    creatorName: '이승우',
    reminderMinutesBefore: 5,
  },
  {
    id: 'sch-2',
    workspaceId: 'ws-kosta-295',
    teamId: 'team-alpha',
    title: 'MVP 2.0 팀 빌딩 세션 공식 마감',
    startDate: '2026-10-17T23:59',
    endDate: '2026-10-17T23:59',
    scheduleDesc: '마감 전까지 모든 제안 수락/거절 완료 필요',
    type: 'DEADLINE',
    isPersonal: false,
    creatorId: '100',
    creatorName: '박강사',
    reminderMinutesBefore: 5,
  },
  {
    id: 'sch-3',
    workspaceId: 'ws-kosta-295',
    teamId: 'team-alpha',
    title: '프론트엔드 디자인 시스템 코드 리뷰 워크숍',
    startDate: '2026-10-16T15:00',
    endDate: '2026-10-16T17:00',
    scheduleDesc: 'Very Peri 컬러 토큰 및 WCAG 3.0 대비 점검',
    type: 'WORKSHOP',
    isPersonal: false,
    creatorId: '2',
    creatorName: '김민지',
    reminderMinutesBefore: 5,
  },
  {
    id: 'sch-personal-1',
    workspaceId: 'ws-kosta-295',
    teamId: 'team-alpha',
    title: '[개인] CS 스터디 및 저녁 개인 정비 시간',
    startDate: '2026-10-15T18:30',
    endDate: '2026-10-15T20:00',
    scheduleDesc: '내 일정 레이어 ON일 때만 본인에게 보이는 개인 일정입니다.',
    type: 'OTHER',
    isPersonal: true,
    creatorId: '1',
    creatorName: '박재현',
  },
];

const INITIAL_NOTICES: WorkspaceNoticeItem[] = [
  {
    id: 'notice-1',
    workspaceId: 'ws-kosta-295',
    title: '[필독] 295기 파이널 프로젝트 팀 빌딩 세션 오픈 및 PR 카드 작성 안내',
    content:
      '안녕하세요 수강생 여러분! 이번 파이널 프로젝트 팀 빌딩은 Pick Team 2.0을 통해 진행됩니다. 10월 17일(토) 23:59까지 자기 PR 카드를 작성하고 원하는 팀에 지원하거나 스카우트 제안을 수락해 주세요. 마감 시점 미배정 인원은 CLOSING 단계에서 희망 역할을 고려해 배정됩니다.',
    authorId: '100',
    authorName: '박강사 (과정책임)',
    authorRole: 'OWNER',
    pinned: true,
    readByIds: ['2', '3'],
    createdAt: '2시간 전',
  },
  {
    id: 'notice-2',
    workspaceId: 'ws-kosta-295',
    title: '칸반 완료 승인 워크플로 운영 가이드 안내',
    content:
      '각 팀의 태스크 완료는 [진행 중] → [완료 요청] → [팀장/강사 승인] 단계로 집계됩니다. 주 2회 강사 대시보드에서 팀별 진행도와 승인 큐를 점검할 예정이니 적극 활용해 주세요.',
    authorId: '101',
    authorName: '김민서 (운영매니저)',
    authorRole: 'ADMIN',
    pinned: false,
    readByIds: ['1', '2', '3'],
    createdAt: '어제',
  },
  {
    id: 'notice-team-1',
    workspaceId: 'ws-kosta-295',
    teamId: 'team-alpha',
    title: '코드블루 팀 브랜치 전략 및 PR 규칙 공지',
    content:
      '모든 기능 개발은 feat/* 브랜치에서 진행하며, 칸반 태스크 완료 요청 시 PR 링크를 코멘트로 남겨주세요.',
    authorId: '3',
    authorName: '이승우',
    authorRole: 'LEADER',
    pinned: true,
    readByIds: ['1', '3'],
    createdAt: '3시간 전',
  },
];

const INITIAL_NOTIFICATIONS: RenewalNotification[] = [
  {
    id: 'noti-1',
    workspaceId: 'ws-kosta-295',
    category: 'TEAM_BUILDING',
    eventCode: 'TB_SCOUT_RECEIVED',
    title: '새로운 스카우트 제안이 도착했습니다',
    message: '달빛스튜디오 (Luna) 팀에서 백엔드 포지션으로 스카우트 제안을 보냈습니다.',
    deepLink: '/ws/ws-kosta-295/team-building/inbox',
    priority: 'HIGH',
    read: false,
    createdAt: '15분 전',
  },
  {
    id: 'noti-2',
    workspaceId: 'ws-kosta-295',
    category: 'KANBAN',
    eventCode: 'KANBAN_TASK_COMPLETION_REQUESTED',
    title: '칸반 태스크 완료 승인 요청 (2건)',
    message: '코드블루 팀에서 "자기 PR 카드 v2 온보딩 위저드" 외 1건의 완료 승인을 요청했습니다.',
    deepLink: '/ws/ws-kosta-295/team/team-alpha?tab=kanban',
    priority: 'HIGH',
    read: false,
    createdAt: '45분 전',
  },
  {
    id: 'noti-3',
    workspaceId: 'ws-kosta-295',
    category: 'TEAM_BUILDING',
    eventCode: 'TB_APPLICATION_RECEIVED',
    title: '내 팀에 신규 지원자가 있습니다',
    message: '정다은 님이 코드블루 (CodeBlue) 백엔드 포지션에 지원했습니다.',
    deepLink: '/ws/ws-kosta-295/team-building/inbox',
    priority: 'HIGH',
    read: false,
    createdAt: '1시간 전',
  },
  {
    id: 'noti-4',
    workspaceId: 'ws-kosta-295',
    category: 'BOARD',
    eventCode: 'ANNOUNCEMENT_CREATED',
    title: '워크스페이스 필독 공지가 등록되었습니다',
    message: '[필독] 295기 파이널 프로젝트 팀 빌딩 세션 오픈 및 PR 카드 작성 안내',
    deepLink: '/ws/ws-kosta-295',
    priority: 'HIGH',
    read: true,
    createdAt: '2시간 전',
  },
  {
    id: 'noti-5',
    workspaceId: 'ws-kosta-295',
    category: 'SCHEDULE',
    eventCode: 'SCHEDULE_REMINDER',
    title: '일정 시작 5분 전 리마인더',
    message: '스프린트 1 킥오프 & 역할 확정 회의가 곧 시작됩니다.',
    deepLink: '/ws/ws-kosta-295/team/team-alpha?tab=calendar',
    priority: 'MEDIUM',
    read: true,
    createdAt: '어제',
  },
];

const INITIAL_REPORTS: SafetyReport[] = [
  {
    id: 'R-2026-001',
    workspaceId: 'ws-kosta-295',
    reporterId: '2',
    reporterName: '익명 보호됨 (신고자 #2)',
    targetType: 'MESSAGE',
    targetId: 'msg-991',
    targetLabel: '채팅 메시지 (그룹 라운지)',
    targetContentSnippet: '외부 유료 강의 홍보 링크 반복 도배 메시지...',
    reason: 'SPAM',
    reasonDetail: '오픈 라운지 채팅방에 동일한 외부 광고 링크를 5회 연속 게시함',
    status: 'RECEIVED',
    createdAt: '2026-10-14 10:15',
  },
  {
    id: 'R-2026-002',
    workspaceId: 'ws-kosta-295',
    reporterId: '4',
    reporterName: '익명 보호됨 (신고자 #4)',
    targetType: 'CARD',
    targetId: 'card-772',
    targetLabel: 'PR 카드 (타 기수 외부인)',
    targetContentSnippet: '포트폴리오 링크에 타인의 개인 연락처가 무단 기재됨',
    reason: 'PRIVACY',
    reasonDetail: '동의 없는 제3자 연락처 노출 의심',
    status: 'REVIEWING',
    adminMemo: '포트폴리오 링크 확인 중 — 당사자 소명 요청 발송',
    createdAt: '2026-10-13 16:40',
  },
];

const STORAGE_KEY = 'pickteam_renewal_v2_state';

export const RenewalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, login } = useAuth();
  const { workspaces: backendWorkspaces } = useWorkspace();
  const { showToast } = useToast();

  const [activePersona, setActivePersona] = useState<ActivePersonaPreset>(() => {
    const saved = localStorage.getItem('pickteam_active_persona');
    return (saved as ActivePersonaPreset) || 'STUDENT';
  });

  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>(INITIAL_WORKSPACES);
  const [membersByWorkspace, setMembersByWorkspace] = useState<Record<string, MemberPRCardProfile[]>>({
    'ws-kosta-295': INITIAL_MEMBERS,
    'ws-devcourse-be4': INITIAL_MEMBERS.slice(0, 5),
  });
  const [sessionsByWorkspace, setSessionsByWorkspace] = useState<Record<string, TeamBuildingSession>>({
    'ws-kosta-295': INITIAL_SESSION,
    'ws-devcourse-be4': {
      ...INITIAL_SESSION,
      id: 'ses-devcourse-be4',
      workspaceId: 'ws-devcourse-be4',
      name: '데브코스 BE 4기 팀 빌딩 세션',
      status: 'CLOSING',
    },
  });
  const [recruitmentsByWorkspace, setRecruitmentsByWorkspace] = useState<Record<string, TeamRecruitment[]>>({
    'ws-kosta-295': INITIAL_RECRUITMENTS,
    'ws-devcourse-be4': INITIAL_RECRUITMENTS.slice(0, 2),
  });
  const [applicationsByWorkspace, setApplicationsByWorkspace] = useState<Record<string, TeamApplication[]>>({
    'ws-kosta-295': INITIAL_APPLICATIONS,
    'ws-devcourse-be4': [],
  });
  const [kanbanTasks, setKanbanTasks] = useState<RenewalKanbanTask[]>(INITIAL_KANBAN_TASKS);
  const [schedules, setSchedules] = useState<PersonalOrTeamSchedule[]>(INITIAL_SCHEDULES);
  const [notices, setNotices] = useState<WorkspaceNoticeItem[]>(INITIAL_NOTICES);
  const [delegations, setDelegations] = useState<Record<string, DelegationRequest>>({});
  const [notifications, setNotifications] = useState<RenewalNotification[]>(INITIAL_NOTIFICATIONS);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettingsState>({
    masterEnabled: true,
    categories: {
      TEAM_BUILDING: true,
      KANBAN: true,
      SCHEDULE: true,
      BOARD: true,
      CHAT: true,
      ADMIN: true,
    },
    mutedChatRoomIds: [],
  });
  const [reports, setReports] = useState<SafetyReport[]>(INITIAL_REPORTS);

  // Merge backend workspaces if present
  useEffect(() => {
    if (backendWorkspaces && backendWorkspaces.length > 0) {
      setAllWorkspaces((prev) => {
        const existingIds = new Set(prev.map((w) => String(w.id)));
        const merged = [...prev];
        for (const bw of backendWorkspaces) {
          if (!existingIds.has(String(bw.id))) {
            merged.unshift({
              ...bw,
              teamBuildingEnabled: bw.teamBuildingEnabled ?? true,
              capacity: bw.capacity ?? 30,
              inviteCode: bw.inviteCode || `WS-${bw.id}-INVITE`,
            });
          }
        }
        return merged;
      });
    }
  }, [backendWorkspaces]);

  // Persist key state changes to localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.kanbanTasks) setKanbanTasks(parsed.kanbanTasks);
        if (parsed.notifications) setNotifications(parsed.notifications);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          kanbanTasks,
          notifications,
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [kanbanTasks, notifications]);

  const switchPersona = useCallback(
    (persona: ActivePersonaPreset) => {
      setActivePersona(persona);
      localStorage.setItem('pickteam_active_persona', persona);

      const personaUsers: Record<ActivePersonaPreset, { id: string; name: string; email: string; role: string }> = {
        STUDENT: { id: '1', name: '박재현', email: 'jaehyun@pickteam.kr', role: 'USER' },
        LEADER: { id: '3', name: '이승우 (코드블루 팀장)', email: 'seungwoo@pickteam.kr', role: 'USER' },
        INSTRUCTOR: { id: '100', name: '박강사 (과정책임)', email: 'instructor@pickteam.kr', role: 'USER' },
        SYSADMIN: { id: '999', name: '시스템 운영자', email: 'admin@pickteam.kr', role: 'ADMIN' },
      };

      const target = personaUsers[persona];
      const existingMember = INITIAL_MEMBERS.find((m) => m.id === target.id) || INITIAL_MEMBERS[0];

      login({
        ...existingMember,
        id: target.id,
        name: target.name,
        email: target.email,
        role: target.role,
      });

      const roleDesc: Record<ActivePersonaPreset, string> = {
        STUDENT: '수강생 S (워크스페이스 멤버 · PR 카드 탐색 및 팀 빌딩 참여)',
        LEADER: '팀장 L (팀 모집 공고 관리 · 칸반 완료 승인 · 팀장 위임)',
        INSTRUCTOR: '강사 K (워크스페이스 개설자 · 강사 대시보드 · 승인 큐 개입 · 세션 운영)',
        SYSADMIN: '시스템 관리자 O (신고 처리 콘솔 · 계정/워크스페이스 제재)',
      };

      showToast({
        title: `페르소나 전환: ${target.name}`,
        description: roleDesc[persona],
        variant: 'info',
      });
    },
    [login, showToast]
  );

  const getEffectiveWorkspaceRole = useCallback(
    ( _workspaceId?: string): WorkspaceMemberRole => {
      if (activePersona === 'INSTRUCTOR' || activePersona === 'SYSADMIN') return 'OWNER';
      if (currentUser?.role === 'ADMIN') return 'ADMIN';
      return 'MEMBER';
    },
    [activePersona, currentUser]
  );

  const isSystemAdmin = activePersona === 'SYSADMIN' || currentUser?.role === 'ADMIN';

  const getWorkspaceById = useCallback(
    (wsId?: string): Workspace => {
      if (!wsId) return allWorkspaces[0];
      return (
        allWorkspaces.find((w) => String(w.id) === String(wsId) || w.inviteCode === wsId) ||
        allWorkspaces[0]
      );
    },
    [allWorkspaces]
  );

  const updateWorkspaceConfig = useCallback(
    (wsId: string, patch: Partial<Workspace>) => {
      setAllWorkspaces((prev) =>
        prev.map((w) => (String(w.id) === String(wsId) ? { ...w, ...patch, updatedAt: new Date().toISOString() } : w))
      );
      showToast({
        title: '워크스페이스 설정이 저장되었습니다',
        variant: 'success',
      });
    },
    [showToast]
  );

  const refreshInviteLink = useCallback(
    (wsId: string, expiresAt: string | null): string => {
      const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const newCode = `PT-${randomSuffix}`;
      setAllWorkspaces((prev) =>
        prev.map((w) =>
          String(w.id) === String(wsId)
            ? {
                ...w,
                inviteCode: newCode,
                inviteCodeExpiresAt: expiresAt,
                inviteActive: true,
              }
            : w
        )
      );
      showToast({
        title: '초대 링크가 재발급되었습니다',
        description: '기존 초대 코드는 즉시 무효화되었습니다.',
        variant: 'info',
      });
      return newCode;
    },
    [showToast]
  );

  const toggleWorkspaceArchive = useCallback(
    (wsId: string, archived: boolean) => {
      setAllWorkspaces((prev) =>
        prev.map((w) => (String(w.id) === String(wsId) ? { ...w, archived } : w))
      );
      if (archived) {
        // Spec 13-D7: Force close OPEN session before archiving
        setSessionsByWorkspace((prev) => {
          const cur = prev[wsId];
          if (!cur) return prev;
          return {
            ...prev,
            [wsId]: { ...cur, status: 'RESOLVED', resolvedAt: new Date().toISOString() },
          };
        });
      }
      showToast({
        title: archived ? '워크스페이스가 아카이브(읽기 전용) 전환되었습니다' : '워크스페이스 아카이브가 해제되었습니다',
        description: archived
          ? '모든 기록과 칸반·채팅 이력은 열람 가능하며 쓰기 동작만 제한됩니다.'
          : '다시 모든 협업 도구를 편집할 수 있습니다.',
        variant: archived ? 'warning' : 'success',
      });
    },
    [showToast]
  );

  const getWorkspaceMembers = useCallback(
    (wsId?: string): MemberPRCardProfile[] => {
      const key = wsId && membersByWorkspace[wsId] ? wsId : 'ws-kosta-295';
      return (membersByWorkspace[key] || INITIAL_MEMBERS).filter((m) => m.workspaceStatus === 'ACTIVE');
    },
    [membersByWorkspace]
  );

  const getMemberCard = useCallback(
    (wsId: string, accountId: string): MemberPRCardProfile | undefined => {
      const list = getWorkspaceMembers(wsId);
      return list.find((m) => String(m.id) === String(accountId));
    },
    [getWorkspaceMembers]
  );

  const myPRCard: MemberPRCardProfile = React.useMemo(() => {
    const list = membersByWorkspace['ws-kosta-295'] || INITIAL_MEMBERS;
    const found = list.find((m) => String(m.id) === String(currentUser?.id || '1'));
    return found || list[0];
  }, [membersByWorkspace, currentUser]);

  const saveMyPRCard = useCallback(
    (patch: Partial<MemberPRCardProfile>) => {
      const targetId = String(currentUser?.id || '1');
      setMembersByWorkspace((prev) => {
        const next: Record<string, MemberPRCardProfile[]> = {};
        for (const wsKey of Object.keys(prev)) {
          next[wsKey] = prev[wsKey].map((m) =>
            String(m.id) === targetId
              ? {
                  ...m,
                  ...patch,
                  consentGivenAt: patch.consentGivenAt || m.consentGivenAt || new Date().toISOString(),
                }
              : m
          );
        }
        return next;
      });
      showToast({
        title: '내 PR 카드가 저장되었습니다',
        description: '워크스페이스 멤버 카드 갤러리와 매칭 추천에 즉시 반영됩니다.',
        variant: 'success',
      });
    },
    [currentUser, showToast]
  );

  const changeMemberWorkspaceRole = useCallback(
    (wsId: string, accountId: string, newRole: WorkspaceMemberRole) => {
      setAllWorkspaces((prev) =>
        prev.map((w) => {
          if (String(w.id) !== String(wsId)) return w;
          return {
            ...w,
            members: w.members.map((m) => {
              if (String(m.id) === String(accountId)) return { ...m, role: newRole };
              if (newRole === 'OWNER' && m.role === 'OWNER') return { ...m, role: 'ADMIN' };
              return m;
            }),
          };
        })
      );
      showToast({
        title: '멤버 역할이 변경되었습니다',
        description: `새 권한(${newRole})이 즉시 적용되었습니다.`,
        variant: 'success',
      });
    },
    [showToast]
  );

  const kickWorkspaceMember = useCallback(
    (wsId: string, accountId: string) => {
      setMembersByWorkspace((prev) => ({
        ...prev,
        [wsId]: (prev[wsId] || INITIAL_MEMBERS).map((m) =>
          String(m.id) === String(accountId) ? { ...m, workspaceStatus: 'LEFT', cardVisible: false } : m
        ),
      }));
      showToast({
        title: '멤버를 강퇴 처리했습니다',
        description: '해당 멤버는 LEFT 상태로 전환되었으며 초대 코드로 재합류는 가능합니다.',
        variant: 'warning',
      });
    },
    [showToast]
  );

  const banWorkspaceMember = useCallback(
    (wsId: string, accountId: string) => {
      // Spec 00 §3.2 Rule 4 & 13 §5.1: BANNED cascades to team exclusion + PR card private + application expiration
      setMembersByWorkspace((prev) => ({
        ...prev,
        [wsId]: (prev[wsId] || INITIAL_MEMBERS).map((m) =>
          String(m.id) === String(accountId)
            ? {
                ...m,
                workspaceStatus: 'BANNED',
                cardVisible: false,
                assignedTeamId: null,
                assignedTeamName: null,
              }
            : m
        ),
      }));
      setApplicationsByWorkspace((prev) => ({
        ...prev,
        [wsId]: (prev[wsId] || []).map((a) =>
          String(a.applicantId) === String(accountId) && a.status === 'PENDING'
            ? { ...a, status: 'EXPIRED', statusReason: '멤버 차단(BANNED)으로 인한 자동 만료' }
            : a
        ),
      }));
      showToast({
        title: '멤버 영구 차단(BANNED) 완료',
        description: '소속 팀 자동 제외, PR 카드 비공개 전환, 진행 중 제안 만료 및 재가입 차단이 일괄 실행되었습니다.',
        variant: 'error',
      });
    },
    [showToast]
  );

  const unbanWorkspaceMember = useCallback(
    (wsId: string, accountId: string) => {
      setMembersByWorkspace((prev) => ({
        ...prev,
        [wsId]: (prev[wsId] || INITIAL_MEMBERS).map((m) =>
          String(m.id) === String(accountId) ? { ...m, workspaceStatus: 'ACTIVE' } : m
        ),
      }));
      showToast({
        title: '멤버 차단이 해제되었습니다',
        variant: 'info',
      });
    },
    [showToast]
  );

  const sendUnwrittenCardReminders = useCallback(
    (wsId: string): number => {
      const unwritten = getWorkspaceMembers(wsId).filter((m) => !m.consentGivenAt || !m.desiredRole1);
      const count = unwritten.length || 1;
      showToast({
        title: `미작성자 ${count}명에게 PR 카드 작성 리마인드 발송 완료`,
        description: '인앱 SSE 알림 및 온보딩 바로가기 딥링크가 전달되었습니다.',
        variant: 'success',
      });
      return count;
    },
    [getWorkspaceMembers, showToast]
  );

  const getSession = useCallback(
    (wsId?: string): TeamBuildingSession => {
      const key = wsId && sessionsByWorkspace[wsId] ? wsId : 'ws-kosta-295';
      return sessionsByWorkspace[key] || INITIAL_SESSION;
    },
    [sessionsByWorkspace]
  );

  const updateSession = useCallback(
    (wsId: string, patch: Partial<TeamBuildingSession>) => {
      const key = wsId && sessionsByWorkspace[wsId] ? wsId : 'ws-kosta-295';
      setSessionsByWorkspace((prev) => ({
        ...prev,
        [key]: { ...prev[key], ...patch },
      }));
      if (patch.status === 'CLOSING') {
        // Expire remaining pending applications on CLOSING transition (Spec 12 §5.2)
        setApplicationsByWorkspace((prev) => ({
          ...prev,
          [key]: (prev[key] || []).map((app) =>
            app.status === 'PENDING'
              ? { ...app, status: 'EXPIRED', statusReason: '세션 마감(CLOSING) 전환으로 자동 종료' }
              : app
          ),
        }));
      }
      showToast({
        title: '팀 빌딩 세션 설정이 업데이트되었습니다',
        description: patch.status ? `세션 단계가 [${patch.status}] 상태로 전환되었습니다.` : undefined,
        variant: 'info',
      });
    },
    [sessionsByWorkspace, showToast]
  );

  const getRecruitments = useCallback(
    (wsId?: string): TeamRecruitment[] => {
      const key = wsId && recruitmentsByWorkspace[wsId] ? wsId : 'ws-kosta-295';
      return recruitmentsByWorkspace[key] || INITIAL_RECRUITMENTS;
    },
    [recruitmentsByWorkspace]
  );

  const createRecruitmentTeam = useCallback(
    (
      wsId: string,
      payload: {
        name: string;
        intro: string;
        goalTemperature: 1 | 2 | 3 | 4 | 5;
        roles: { role: DesiredRoleCode; count: number }[];
        kickoffTimeNote?: string;
      }
    ): TeamRecruitment => {
      const key = wsId && recruitmentsByWorkspace[wsId] ? wsId : 'ws-kosta-295';
      const creatorId = String(currentUser?.id || '1');
      const creatorName = currentUser?.name || '박재현';

      const newTeam: TeamRecruitment = {
        id: `team-${Date.now()}`,
        workspaceId: key,
        sessionId: getSession(key).id,
        name: payload.name,
        intro: payload.intro,
        goalTemperature: payload.goalTemperature,
        commonTimeSlots: myPRCard.availableTimeSlots || ['AFTERNOON', 'EVENING'],
        weeklyHours: myPRCard.weeklyAvailableHours || 'H20_30',
        preferWorkstyles: myPRCard.preferWorkstyleOptions || ['ASYNC_FIRST', 'STRUCTURED'],
        leaderId: creatorId,
        leaderName: creatorName,
        memberIds: [creatorId],
        recruitRoles: payload.roles.map((r) => ({
          role: r.role,
          totalCount: r.count,
          filledCount: r.role === myPRCard.desiredRole1 ? 1 : 0,
          pendingApplyCount: 0,
        })),
        status: 'RECRUITING',
        kickoffTimeNote: payload.kickoffTimeNote,
        createdAt: new Date().toISOString(),
      };

      setRecruitmentsByWorkspace((prev) => ({
        ...prev,
        [key]: [newTeam, ...(prev[key] || [])],
      }));

      showToast({
        title: `모집 팀 "${payload.name}" 개설 완료`,
        description: '팀 빌딩 홈과 추천 레일에 모집 공고가 게시되었습니다.',
        variant: 'success',
      });

      return newTeam;
    },
    [currentUser, getSession, myPRCard, recruitmentsByWorkspace, showToast]
  );

  const getApplications = useCallback(
    (wsId?: string): TeamApplication[] => {
      const key = wsId && applicationsByWorkspace[wsId] ? wsId : 'ws-kosta-295';
      return applicationsByWorkspace[key] || INITIAL_APPLICATIONS;
    },
    [applicationsByWorkspace]
  );

  const submitApplication = useCallback(
    (
      wsId: string,
      payload: {
        direction: 'APPLY' | 'SCOUT';
        targetTeamId: string;
        targetMemberId?: string;
        desiredRole: DesiredRoleCode;
        message: string;
      }
    ): boolean => {
      const key = wsId && applicationsByWorkspace[wsId] ? wsId : 'ws-kosta-295';
      const currentApps = applicationsByWorkspace[key] || INITIAL_APPLICATIONS;
      const myId = String(currentUser?.id || '1');

      if (payload.direction === 'APPLY') {
        const myPendingApplies = currentApps.filter(
          (a) => a.direction === 'APPLY' && a.applicantId === myId && a.status === 'PENDING'
        );
        // Spec 12-D4: Max 3 concurrent PENDING applications
        if (myPendingApplies.length >= 3) {
          showToast({
            title: '동시 지원 상한(3건) 초과',
            description: '기존 대기 중인 지원을 철회하거나 결과가 나온 뒤 다시 지원해 주세요. (규칙 12-D4)',
            variant: 'warning',
          });
          return false;
        }
        if (myPendingApplies.some((a) => a.targetTeamId === payload.targetTeamId)) {
          showToast({
            title: '이미 지원 대기 중인 팀입니다',
            description: '제안함에서 진행 상태를 확인할 수 있습니다.',
            variant: 'warning',
          });
          return false;
        }
      }

      const team = getRecruitments(key).find((t) => t.id === payload.targetTeamId);
      const targetMember = payload.targetMemberId
        ? getWorkspaceMembers(key).find((m) => String(m.id) === String(payload.targetMemberId))
        : myPRCard;

      const newApp: TeamApplication = {
        id: `app-${Date.now()}`,
        workspaceId: key,
        sessionId: getSession(key).id,
        direction: payload.direction,
        applicantId: targetMember?.id || myId,
        applicantName: targetMember?.name || currentUser?.name || '박재현',
        applicantRole1: targetMember?.desiredRole1 || payload.desiredRole,
        targetTeamId: payload.targetTeamId,
        targetTeamName: team?.name || '모집 팀',
        desiredRole: payload.desiredRole,
        message: payload.message,
        status: 'PENDING',
        createdAt: '방금 전',
      };

      setApplicationsByWorkspace((prev) => ({
        ...prev,
        [key]: [newApp, ...(prev[key] || [])],
      }));

      showToast({
        title: payload.direction === 'APPLY' ? '팀 지원서가 발송되었습니다' : '스카우트 제안이 발송되었습니다',
        description: '상대방에게 실시간 알림이 전송되었으며 제안함에서 상태를 추적할 수 있습니다.',
        variant: 'success',
      });
      return true;
    },
    [applicationsByWorkspace, currentUser, getRecruitments, getSession, getWorkspaceMembers, myPRCard, showToast]
  );

  const decideApplication = useCallback(
    (wsId: string, applicationId: string, decision: 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN') => {
      const key = wsId && applicationsByWorkspace[wsId] ? wsId : 'ws-kosta-295';
      const targetApp = (applicationsByWorkspace[key] || []).find((a) => a.id === applicationId);
      if (!targetApp) return;

      const session = getSession(key);

      if (decision === 'ACCEPTED') {
        // Spec 12 §5.2: Cascading cleanup transaction
        // 1) Target application -> ACCEPTED
        // 2) Other PENDING proposals for the same applicant -> AUTO_WITHDRAWN
        setApplicationsByWorkspace((prev) => ({
          ...prev,
          [key]: (prev[key] || []).map((a) => {
            if (a.id === applicationId) {
              return { ...a, status: 'ACCEPTED', decidedAt: '방금 전' };
            }
            if (a.applicantId === targetApp.applicantId && a.status === 'PENDING') {
              return {
                ...a,
                status: 'AUTO_WITHDRAWN',
                statusReason: `${targetApp.targetTeamName} 팀 합류 확정으로 자동 철회됨`,
                decidedAt: '방금 전',
              };
            }
            return a;
          }),
        }));

        // Update member assignment
        setMembersByWorkspace((prev) => ({
          ...prev,
          [key]: (prev[key] || INITIAL_MEMBERS).map((m) =>
            String(m.id) === String(targetApp.applicantId)
              ? {
                  ...m,
                  assignedTeamId: targetApp.targetTeamId,
                  assignedTeamName: targetApp.targetTeamName,
                }
              : m
          ),
        }));

        // Update team recruitment memberIds and filledCount
        setRecruitmentsByWorkspace((prev) => ({
          ...prev,
          [key]: (prev[key] || []).map((t) => {
            if (t.id !== targetApp.targetTeamId) return t;
            const nextMembers = t.memberIds.includes(targetApp.applicantId)
              ? t.memberIds
              : [...t.memberIds, targetApp.applicantId];
            const isNowFull = nextMembers.length >= session.teamSizeMax;
            return {
              ...t,
              memberIds: nextMembers,
              status: isNowFull ? 'CONFIRMED' : t.status,
              recruitRoles: t.recruitRoles.map((r) =>
                r.role === targetApp.desiredRole
                  ? { ...r, filledCount: Math.min(r.totalCount, r.filledCount + 1) }
                  : r
              ),
            };
          }),
        }));

        showToast({
          title: `${targetApp.targetTeamName} 팀 합류가 확정되었습니다!`,
          description: '다른 대기 중이던 지원/스카우트 제안은 규칙에 따라 자동 철회(AUTO_WITHDRAWN) 처리되었습니다.',
          variant: 'success',
        });
      } else {
        setApplicationsByWorkspace((prev) => ({
          ...prev,
          [key]: (prev[key] || []).map((a) =>
            a.id === applicationId
              ? {
                  ...a,
                  status: decision,
                  statusReason: decision === 'WITHDRAWN' ? '발신자가 직접 철회함' : '수신 측에서 정중히 거절함',
                  decidedAt: '방금 전',
                }
              : a
          ),
        }));
        showToast({
          title: decision === 'WITHDRAWN' ? '제안을 철회했습니다' : '제안을 거절 처리했습니다',
          variant: 'info',
        });
      }
    },
    [applicationsByWorkspace, getSession, showToast]
  );

  const manualAssignMemberToTeam = useCallback(
    (wsId: string, memberId: string, targetTeamId: string | null) => {
      const key = wsId && membersByWorkspace[wsId] ? wsId : 'ws-kosta-295';
      const teams = recruitmentsByWorkspace[key] || INITIAL_RECRUITMENTS;
      const targetTeam = teams.find((t) => t.id === targetTeamId);

      setMembersByWorkspace((prev) => ({
        ...prev,
        [key]: (prev[key] || INITIAL_MEMBERS).map((m) =>
          String(m.id) === String(memberId)
            ? {
                ...m,
                assignedTeamId: targetTeamId,
                assignedTeamName: targetTeam?.name || null,
              }
            : m
        ),
      }));

      setRecruitmentsByWorkspace((prev) => ({
        ...prev,
        [key]: (prev[key] || INITIAL_RECRUITMENTS).map((t) => {
          const cleaned = t.memberIds.filter((id) => String(id) !== String(memberId));
          if (t.id === targetTeamId) {
            return { ...t, memberIds: [...cleaned, String(memberId)] };
          }
          return { ...t, memberIds: cleaned };
        }),
      }));

      showToast({
        title: targetTeam ? `${targetTeam.name} 팀으로 수동 배치되었습니다` : '미배정 풀로 이동되었습니다',
        variant: 'info',
      });
    },
    [membersByWorkspace, recruitmentsByWorkspace, showToast]
  );

  const runConstrainedRandomFallback = useCallback(
    (wsId: string): number => {
      const key = wsId && membersByWorkspace[wsId] ? wsId : 'ws-kosta-295';
      const members = membersByWorkspace[key] || INITIAL_MEMBERS;
      const unassigned = members.filter((m) => m.workspaceStatus === 'ACTIVE' && !m.assignedTeamId);

      if (unassigned.length === 0) {
        showToast({
          title: '미배정 멤버가 없습니다',
          description: '모든 멤버가 이미 팀에 배정되어 있습니다.',
          variant: 'info',
        });
        return 0;
      }

      const teams = [...(recruitmentsByWorkspace[key] || INITIAL_RECRUITMENTS)];
      const session = getSession(key);

      // Constrained role-balanced assignment (Spec 12 §5.4 #6)
      const updatedTeams = teams.map((t) => ({ ...t, memberIds: [...t.memberIds] }));
      const memberTeamMap: Record<string, { id: string; name: string }> = {};

      for (const member of unassigned) {
        // Pick team with fewest members that hasn't exceeded teamSizeMax and prefers member's role
        updatedTeams.sort((a, b) => a.memberIds.length - b.memberIds.length);
        const candidateTeam =
          updatedTeams.find(
            (t) =>
              t.memberIds.length < session.teamSizeMax &&
              t.recruitRoles.some((r) => r.role === member.desiredRole1 && r.filledCount < r.totalCount)
          ) ||
          updatedTeams.find((t) => t.memberIds.length < session.teamSizeMax) ||
          updatedTeams[0];

        if (candidateTeam) {
          candidateTeam.memberIds.push(member.id);
          memberTeamMap[member.id] = { id: candidateTeam.id, name: candidateTeam.name };
        }
      }

      setRecruitmentsByWorkspace((prev) => ({
        ...prev,
        [key]: updatedTeams,
      }));

      setMembersByWorkspace((prev) => ({
        ...prev,
        [key]: (prev[key] || INITIAL_MEMBERS).map((m) =>
          memberTeamMap[m.id]
            ? {
                ...m,
                assignedTeamId: memberTeamMap[m.id].id,
                assignedTeamName: memberTeamMap[m.id].name,
              }
            : m
        ),
      }));

      showToast({
        title: `미배정자 ${unassigned.length}명 역할 균형 배치 완료`,
        description: '희망 역할 상보성과 팀별 정원 균형을 고려해 배정이 완료되었습니다.',
        variant: 'success',
      });

      return unassigned.length;
    },
    [getSession, membersByWorkspace, recruitmentsByWorkspace, showToast]
  );

  const resolveTeamBuildingSession = useCallback(
    (wsId: string): boolean => {
      const key = wsId && membersByWorkspace[wsId] ? wsId : 'ws-kosta-295';
      const unassignedCount = (membersByWorkspace[key] || INITIAL_MEMBERS).filter(
        (m) => m.workspaceStatus === 'ACTIVE' && !m.assignedTeamId
      ).length;

      if (unassignedCount > 0) {
        showToast({
          title: `아직 미배정 멤버가 ${unassignedCount}명 남아 있습니다`,
          description: '수동 배치 또는 제약 랜덤 폴백으로 미배정자를 0명으로 만든 후 확정할 수 있습니다.',
          variant: 'warning',
        });
        return false;
      }

      setSessionsByWorkspace((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || INITIAL_SESSION),
          status: 'RESOLVED',
          resolvedAt: new Date().toISOString(),
        },
      }));

      setRecruitmentsByWorkspace((prev) => ({
        ...prev,
        [key]: (prev[key] || INITIAL_RECRUITMENTS).map((t) => ({ ...t, status: 'CONFIRMED' })),
      }));

      const newNoti: RenewalNotification = {
        id: `noti-resolved-${Date.now()}`,
        workspaceId: key,
        category: 'TEAM_BUILDING',
        eventCode: 'TB_SESSION_RESOLVED',
        title: '팀 빌딩 최종 결과 확정 및 팀 스페이스 오픈!',
        message: '모든 팀의 칸반 보드, 일정, 게시판, 팀 채팅방이 자동 생성되었습니다. 지금 팀 개요에서 첫 체크리스트를 확인하세요.',
        deepLink: `/ws/${key}/team/team-alpha`,
        priority: 'HIGH',
        read: false,
        createdAt: '방금 전',
      };
      setNotifications((prev) => [newNoti, ...prev]);

      showToast({
        title: '팀 빌딩 세션이 최종 확정(RESOLVED)되었습니다!',
        description: '결성된 모든 팀의 칸반·게시판·채팅방이 즉시 활성화되었습니다.',
        variant: 'success',
      });
      return true;
    },
    [membersByWorkspace, showToast]
  );

  // Kanban methods
  const getTeamKanbanTasks = useCallback(
    (teamId: string): RenewalKanbanTask[] => {
      const matched = kanbanTasks.filter((t) => String(t.teamId) === String(teamId));
      return matched.length > 0 ? matched : kanbanTasks.filter((t) => t.teamId === 'team-alpha');
    },
    [kanbanTasks]
  );

  const getWorkspaceApprovalQueue = useCallback(
    (wsId?: string): RenewalKanbanTask[] => {
      return kanbanTasks.filter(
        (t) => (!wsId || t.workspaceId === wsId || wsId === 'ws-kosta-295') && t.status === 'APPROVAL_PENDING'
      );
    },
    [kanbanTasks]
  );

  const createKanbanTask = useCallback(
    (
      task: Omit<RenewalKanbanTask, 'id' | 'comments' | 'updatedAt' | 'status'> & { status?: KanbanTaskStatus }
    ) => {
      const newTask: RenewalKanbanTask = {
        ...task,
        id: `task-${Date.now()}`,
        status: task.status || 'TODO',
        comments: [],
        updatedAt: new Date().toISOString(),
      };
      setKanbanTasks((prev) => [newTask, ...prev]);
      showToast({
        title: '새 칸반 태스크가 추가되었습니다',
        description: `"${task.title}" (${task.assigneeName} 담당)`,
        variant: 'success',
      });
    },
    [showToast]
  );

  const moveKanbanTaskStatus = useCallback(
    (taskId: string, status: KanbanTaskStatus) => {
      setKanbanTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status,
                updatedAt: new Date().toISOString(),
              }
            : t
        )
      );
    },
    []
  );

  const requestTaskCompletion = useCallback(
    (taskId: string, message: string) => {
      setKanbanTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'APPROVAL_PENDING',
                completionRequestMessage: message || '구현 및 자체 검증을 마쳐 완료 승인을 요청합니다.',
                completionRequestedAt: '방금 전',
                rejectionReason: undefined,
                updatedAt: new Date().toISOString(),
              }
            : t
        )
      );
      showToast({
        title: '완료 승인 요청이 전송되었습니다',
        description: '팀장 및 강사 대시보드 승인 큐에 등록되었습니다.',
        variant: 'info',
      });
    },
    [showToast]
  );

  const approveOrRejectTask = useCallback(
    (taskId: string, approved: boolean, comment: string, approverRole: 'LEADER' | 'MANAGER') => {
      const approverName =
        approverRole === 'MANAGER'
          ? '박강사 (과정책임 · 개입승인)'
          : currentUser?.name || '이승우 (팀장)';
      const nowStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

      setKanbanTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          if (approved) {
            return {
              ...t,
              status: 'DONE',
              approvedBy: approverName,
              approvedByRole: approverRole,
              approvedAt: `오늘 ${nowStr}`,
              comments: comment
                ? [
                    ...t.comments,
                    {
                      id: `c-${Date.now()}`,
                      authorId: String(currentUser?.id || '100'),
                      authorName: approverName,
                      content: `[승인 완료] ${comment}`,
                      createdAt: '방금 전',
                    },
                  ]
                : t.comments,
              updatedAt: new Date().toISOString(),
            };
          } else {
            return {
              ...t,
              status: 'IN_PROGRESS',
              rejectionReason: comment || '보완 사항 확인 후 다시 완료 요청해 주세요.',
              comments: [
                ...t.comments,
                {
                  id: `c-${Date.now()}`,
                  authorId: String(currentUser?.id || '100'),
                  authorName: approverName,
                  content: `[승인 반려] ${comment || '보완 후 재요청 바랍니다.'}`,
                  createdAt: '방금 전',
                },
              ],
              updatedAt: new Date().toISOString(),
            };
          }
        })
      );

      showToast({
        title: approved ? '태스크 완료가 최종 승인되었습니다' : '태스크 완료 요청이 반려되었습니다',
        description: approved
          ? `승인자(${approverName}) 기록과 함께 팀 진행도율이 갱신되었습니다.`
          : '태스크가 [진행 중] 컬럼으로 되돌아갔으며 사유가 코멘트에 기록되었습니다.',
        variant: approved ? 'success' : 'warning',
      });
    },
    [currentUser, showToast]
  );

  const addKanbanComment = useCallback(
    (taskId: string, content: string) => {
      if (!content.trim()) return;
      setKanbanTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                comments: [
                  ...t.comments,
                  {
                    id: `c-${Date.now()}`,
                    authorId: String(currentUser?.id || '1'),
                    authorName: currentUser?.name || '박재현',
                    content: content.trim(),
                    createdAt: '방금 전',
                  },
                ],
              }
            : t
        )
      );
    },
    [currentUser]
  );

  const deleteKanbanTask = useCallback(
    (taskId: string) => {
      setKanbanTasks((prev) => prev.filter((t) => t.id !== taskId));
      showToast({
        title: '태스크가 삭제되었습니다',
        variant: 'info',
      });
    },
    [showToast]
  );

  // Schedules
  const getTeamSchedules = useCallback(
    (teamId: string, includePersonal: boolean): PersonalOrTeamSchedule[] => {
      const myId = String(currentUser?.id || '1');
      return schedules.filter((s) => {
        const teamMatch = !s.teamId || s.teamId === teamId || teamId === 'team-alpha';
        if (!teamMatch) return false;
        if (s.isPersonal) {
          return includePersonal && String(s.creatorId) === myId;
        }
        return true;
      });
    },
    [currentUser, schedules]
  );

  const addSchedule = useCallback(
    (item: Omit<PersonalOrTeamSchedule, 'id' | 'creatorId' | 'creatorName'>) => {
      const newItem: PersonalOrTeamSchedule = {
        ...item,
        id: `sch-${Date.now()}`,
        creatorId: String(currentUser?.id || '1'),
        creatorName: currentUser?.name || '박재현',
      };
      setSchedules((prev) => [newItem, ...prev]);
      showToast({
        title: item.isPersonal ? '내 개인 일정이 등록되었습니다' : '팀 공식 일정이 등록되었습니다',
        description: item.isPersonal
          ? '개인 일정은 본인에게만 표시되며 타 팀원에게는 보이지 않습니다.'
          : '팀원 전원에게 일정 알림 및 5분 전 리마인더가 예약되었습니다.',
        variant: 'success',
      });
    },
    [currentUser, showToast]
  );

  const deleteSchedule = useCallback(
    (id: string) => {
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      showToast({
        title: '일정이 삭제되었습니다',
        variant: 'info',
      });
    },
    [showToast]
  );

  // Notices
  const getWorkspaceNotices = useCallback(
    (wsId: string, teamId?: string): WorkspaceNoticeItem[] => {
      return notices.filter((n) => {
        if (teamId) return n.teamId === teamId || (!n.teamId && n.pinned);
        return !n.teamId && (n.workspaceId === wsId || wsId === 'ws-kosta-295');
      });
    },
    [notices]
  );

  const addNotice = useCallback(
    (wsId: string, title: string, content: string, teamId?: string, pinned = false) => {
      const newNotice: WorkspaceNoticeItem = {
        id: `notice-${Date.now()}`,
        workspaceId: wsId || 'ws-kosta-295',
        teamId,
        title,
        content,
        authorId: String(currentUser?.id || '100'),
        authorName: currentUser?.name || '박강사',
        authorRole: getEffectiveWorkspaceRole(wsId),
        pinned,
        readByIds: [String(currentUser?.id || '1')],
        createdAt: '방금 전',
      };
      setNotices((prev) => [newNotice, ...prev]);
      showToast({
        title: '공지사항이 등록되었습니다',
        description: '대상 멤버들에게 실시간 공지 알림이 발송되었습니다.',
        variant: 'success',
      });
    },
    [currentUser, getEffectiveWorkspaceRole, showToast]
  );

  const markNoticeRead = useCallback(
    (noticeId: string) => {
      const myId = String(currentUser?.id || '1');
      setNotices((prev) =>
        prev.map((n) =>
          n.id === noticeId && !n.readByIds.includes(myId)
            ? { ...n, readByIds: [...n.readByIds, myId] }
            : n
        )
      );
    },
    [currentUser]
  );

  // Leader Delegation
  const requestLeaderDelegation = useCallback(
    (teamId: string, targetMemberId: string) => {
      const target = getWorkspaceMembers('ws-kosta-295').find((m) => String(m.id) === String(targetMemberId));
      if (!target) return;
      const req: DelegationRequest = {
        teamId,
        fromLeaderId: String(currentUser?.id || '3'),
        fromLeaderName: currentUser?.name || '이승우',
        targetMemberId: target.id,
        targetMemberName: target.name,
        status: 'PENDING',
        requestedAt: '방금 전',
      };
      setDelegations((prev) => ({ ...prev, [teamId]: req }));
      showToast({
        title: `${target.name} 님에게 팀장 위임 요청을 발송했습니다`,
        description: '상대방이 수락하면 팀장 권한이 즉시 이전됩니다.',
        variant: 'info',
      });
    },
    [currentUser, getWorkspaceMembers, showToast]
  );

  const respondLeaderDelegation = useCallback(
    (teamId: string, accept: boolean) => {
      const req = delegations[teamId];
      if (!req) return;
      if (accept) {
        setDelegations((prev) => ({
          ...prev,
          [teamId]: { ...req, status: 'ACCEPTED' },
        }));
        setRecruitmentsByWorkspace((prev) => ({
          ...prev,
          'ws-kosta-295': (prev['ws-kosta-295'] || []).map((t) =>
            t.id === teamId ? { ...t, leaderId: req.targetMemberId, leaderName: req.targetMemberName } : t
          ),
        }));
        showToast({
          title: '팀장 권한 위임이 완료되었습니다',
          description: `이제 ${req.targetMemberName} 님이 새로운 팀장입니다.`,
          variant: 'success',
        });
      } else {
        setDelegations((prev) => ({
          ...prev,
          [teamId]: { ...req, status: 'REJECTED' },
        }));
        showToast({
          title: '팀장 위임 요청이 거절/취소되었습니다',
          variant: 'warning',
        });
      }
    },
    [delegations, showToast]
  );

  // Notifications
  const unreadNotificationCount = React.useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    showToast({
      title: '모든 알림을 읽음 처리했습니다',
      variant: 'info',
    });
  }, [showToast]);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const updateNotificationSettings = useCallback(
    (patch: Partial<NotificationSettingsState>) => {
      setNotificationSettings((prev) => ({ ...prev, ...patch }));
      showToast({
        title: '알림 수신 설정이 저장되었습니다',
        variant: 'success',
      });
    },
    [showToast]
  );

  const toggleMuteChatRoom = useCallback(
    (roomId: string) => {
      setNotificationSettings((prev) => {
        const exists = prev.mutedChatRoomIds.includes(roomId);
        const nextMuted = exists
          ? prev.mutedChatRoomIds.filter((id) => id !== roomId)
          : [...prev.mutedChatRoomIds, roomId];
        showToast({
          title: exists ? '채팅방 알림 음소거가 해제되었습니다' : '채팅방이 음소거되었습니다',
          description: exists
            ? '새 메시지 도착 시 다시 알림을 수신합니다.'
            : '멘션(@)을 제외한 일반 메시지 알림이 울리지 않습니다. (16-D6, 16-D9)',
          variant: 'info',
        });
        return { ...prev, mutedChatRoomIds: nextMuted };
      });
    },
    [showToast]
  );

  // Safety Reports
  const submitSafetyReport = useCallback(
    (payload: {
      workspaceId: string;
      targetType: ReportTargetType;
      targetId: string;
      targetLabel: string;
      targetContentSnippet: string;
      reason: ReportReasonType;
      reasonDetail?: string;
    }) => {
      const newReport: SafetyReport = {
        id: `R-2026-00${reports.length + 1}`,
        workspaceId: payload.workspaceId,
        reporterId: String(currentUser?.id || '1'),
        reporterName: `익명 보호됨 (신고자 #${currentUser?.id || '1'})`,
        targetType: payload.targetType,
        targetId: payload.targetId,
        targetLabel: payload.targetLabel,
        targetContentSnippet: payload.targetContentSnippet,
        reason: payload.reason,
        reasonDetail: payload.reasonDetail,
        status: 'RECEIVED',
        createdAt: '방금 전',
      };
      setReports((prev) => [newReport, ...prev]);
      showToast({
        title: '신고가 안전하게 접수되었습니다',
        description: '신고자 신원은 철저히 익명으로 보호되며, 검토 후 결과가 알림으로 안내됩니다.',
        variant: 'success',
      });
    },
    [currentUser, reports.length, showToast]
  );

  const processSafetyReport = useCallback(
    (
      reportId: string,
      status: 'DISMISSED' | 'ACTED',
      actionType?: ReportActionType,
      adminMemo?: string
    ) => {
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? {
                ...r,
                status,
                actionType,
                adminMemo,
                updatedAt: '방금 전',
              }
            : r
        )
      );
      showToast({
        title: status === 'DISMISSED' ? '신고 건이 기각 처리되었습니다' : `신고 조치(${actionType})가 완료되었습니다`,
        description: '신고자에게 처리 완료 알림이 익명으로 발송되었습니다.',
        variant: status === 'DISMISSED' ? 'info' : 'success',
      });
    },
    [showToast]
  );

  return (
    <RenewalContext.Provider
      value={{
        activePersona,
        switchPersona,
        getEffectiveWorkspaceRole,
        isSystemAdmin,
        allWorkspaces,
        getWorkspaceById,
        updateWorkspaceConfig,
        refreshInviteLink,
        toggleWorkspaceArchive,
        membersByWorkspace,
        getWorkspaceMembers,
        getMemberCard,
        myPRCard,
        saveMyPRCard,
        changeMemberWorkspaceRole,
        kickWorkspaceMember,
        banWorkspaceMember,
        unbanWorkspaceMember,
        sendUnwrittenCardReminders,
        sessionsByWorkspace,
        getSession,
        updateSession,
        recruitmentsByWorkspace,
        getRecruitments,
        createRecruitmentTeam,
        applicationsByWorkspace,
        getApplications,
        submitApplication,
        decideApplication,
        manualAssignMemberToTeam,
        runConstrainedRandomFallback,
        resolveTeamBuildingSession,
        kanbanTasks,
        getTeamKanbanTasks,
        getWorkspaceApprovalQueue,
        createKanbanTask,
        moveKanbanTaskStatus,
        requestTaskCompletion,
        approveOrRejectTask,
        addKanbanComment,
        deleteKanbanTask,
        schedules,
        getTeamSchedules,
        addSchedule,
        deleteSchedule,
        notices,
        getWorkspaceNotices,
        addNotice,
        markNoticeRead,
        delegations,
        requestLeaderDelegation,
        respondLeaderDelegation,
        notifications,
        unreadNotificationCount,
        markNotificationRead,
        markAllNotificationsRead,
        deleteNotification,
        notificationSettings,
        updateNotificationSettings,
        toggleMuteChatRoom,
        reports,
        submitSafetyReport,
        processSafetyReport,
      }}
    >
      {children}
    </RenewalContext.Provider>
  );
};

export const useRenewal = (): RenewalContextValue => {
  const ctx = useContext(RenewalContext);
  if (!ctx) {
    throw new Error('useRenewal must be used within a RenewalProvider');
  }
  return ctx;
};
