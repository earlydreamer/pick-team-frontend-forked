import { emptyCard, type PrCard } from '@/renewal/domain/card';
import type { Account, WorkspaceRole } from '@/renewal/domain/workspace';
import type { Team, TeamBuildingSession } from '@/renewal/domain/teamBuilding';
import type { Announcement } from '@/renewal/domain/announcement';

/**
 * 목업 단계의 데이터 저장소. 브라우저 localStorage에 저장해 새로고침해도 유지된다.
 * 이름·카드 내용은 시연용 가상 데이터이며, 화면 상단 "목업 데이터" 표시로 실제 데이터와 구분한다.
 */

export interface MockWorkspace {
  id: string;
  name: string;
  members: { accountId: string; role: WorkspaceRole; teamId?: string }[];
}

export interface MockDb {
  version: number;
  currentAccountId: string | null;
  accounts: Account[];
  cards: Record<string, PrCard>;
  workspaces: MockWorkspace[];
  sessions: TeamBuildingSession[];
  teams: Team[];
  announcements: (Announcement & { workspaceId: string })[];
}

const STORAGE_KEY = 'pickteam.renewal.mock';
const VERSION = 3;

const daysFromNow = (days: number, hour = 23, minute = 59) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

const consented = (card: Partial<PrCard>): PrCard => ({
  ...emptyCard(),
  consentGivenAt: '2026-10-28T09:00:00.000Z',
  cardVisible: true,
  ...card,
});

const people: [string, string][] = [
  ['u-student', '김수강'],
  ['u-instructor', '박강사'],
  ['u-manager', '정매니저'],
  ['u-01', '김철수'],
  ['u-02', '이영희'],
  ['u-03', '박민준'],
  ['u-04', '최지아'],
  ['u-05', '한서준'],
  ['u-06', '오다은'],
  ['u-07', '윤지호'],
  ['u-08', '서하린'],
  ['u-09', '장우진'],
  ['u-10', '임채원'],
  ['u-11', '강도윤'],
];

export const seed = (): MockDb => ({
  version: VERSION,
  currentAccountId: 'u-student',
  accounts: people.map(([id, name], index) => ({ id, name, email: `user${index + 1}@example.com`, profileImageUrl: null })),
  cards: {
    // 수강생 본인: 동의 전 상태로 시작해 온보딩 위저드를 체험할 수 있게 한다.
    'u-student': emptyCard(),
    'u-instructor': emptyCard(),
    'u-manager': emptyCard(),
    'u-01': consented({ desiredRole1: 'BACKEND', desiredRole2: 'INFRA', weeklyAvailableHours: 'H20_30', availableTimeSlots: ['EVENING', 'WEEKEND'], goalTemperature: 4, hashtags: ['Java', 'Spring', 'MySQL'], preferWorkstyleOptions: ['STRUCTURED', 'DETAIL_ORIENTED'], introduction: '서버와 데이터 모델링을 좋아해요.', mbti: 'ISTJ' }),
    'u-02': consented({ desiredRole1: 'FRONTEND', desiredRole2: 'DESIGN', weeklyAvailableHours: 'H10_20', availableTimeSlots: ['AFTERNOON', 'EVENING'], goalTemperature: 3, hashtags: ['React', 'TypeScript', 'Figma'], preferWorkstyleOptions: ['ASYNC_FIRST'], introduction: '사용자가 헤매지 않는 화면을 만들고 싶어요.', portfolio: 'https://github.com/example-yh' }),
    'u-03': consented({ desiredRole1: 'BACKEND', desiredRole2: 'FULLSTACK', weeklyAvailableHours: 'LT10H', availableTimeSlots: ['WEEKEND'], goalTemperature: 2, hashtags: ['NodeJS', 'DevOps'], }),
    'u-04': consented({ desiredRole1: 'FRONTEND', desiredRole2: 'PM', weeklyAvailableHours: 'H10_20', availableTimeSlots: ['EVENING'], goalTemperature: 5, hashtags: ['Vue', '기획'], preferWorkstyleOptions: ['SPEED_FIRST', 'SYNC_PREFERRED'], workstyleText: '아이디어를 빠르게 검증하는 팀을 좋아해요.' }),
    'u-05': consented({ desiredRole1: 'AI_DATA', desiredRole2: 'BACKEND', weeklyAvailableHours: 'GT30H', availableTimeSlots: ['MORNING', 'AFTERNOON'], goalTemperature: 5, hashtags: ['Python', 'PyTorch'] }),
    'u-06': consented({ desiredRole1: 'DESIGN', desiredRole2: 'FRONTEND', weeklyAvailableHours: 'H20_30', availableTimeSlots: ['AFTERNOON'], goalTemperature: 3, hashtags: ['Figma', 'UX리서치'] }),
    'u-07': consented({ desiredRole1: 'PM', desiredRole2: 'BACKEND', weeklyAvailableHours: 'H10_20', availableTimeSlots: ['EVENING', 'WEEKEND'], goalTemperature: 4, hashtags: ['Notion', 'Jira'] }),
    'u-08': consented({ desiredRole1: 'FULLSTACK', desiredRole2: 'FRONTEND', weeklyAvailableHours: 'H20_30', availableTimeSlots: ['EVENING'], goalTemperature: 3, hashtags: ['NextJS', 'Prisma'] }),
    // 비공개 카드와 미작성 카드(갤러리 흐린 표시 대상)
    'u-09': consented({ desiredRole1: 'INFRA', desiredRole2: 'BACKEND', weeklyAvailableHours: 'H10_20', cardVisible: false }),
    'u-10': { ...emptyCard(), consentGivenAt: '2026-10-29T09:00:00.000Z' },
    'u-11': emptyCard(),
  },
  workspaces: [
    {
      id: 'ws-1',
      name: '2026 하계 부트캠프',
      members: [
        { accountId: 'u-instructor', role: 'OWNER' },
        { accountId: 'u-manager', role: 'ADMIN' },
        { accountId: 'u-student', role: 'MEMBER' },
        { accountId: 'u-01', role: 'MEMBER', teamId: 't-1' },
        { accountId: 'u-02', role: 'MEMBER', teamId: 't-1' },
        { accountId: 'u-03', role: 'MEMBER' },
        { accountId: 'u-04', role: 'MEMBER', teamId: 't-2' },
        { accountId: 'u-05', role: 'MEMBER', teamId: 't-2' },
        { accountId: 'u-06', role: 'MEMBER' },
        { accountId: 'u-07', role: 'MEMBER' },
        { accountId: 'u-08', role: 'MEMBER' },
        { accountId: 'u-09', role: 'MEMBER' },
        { accountId: 'u-10', role: 'MEMBER' },
        { accountId: 'u-11', role: 'MEMBER' },
      ],
    },
    {
      id: 'ws-2',
      name: '알고리즘 스터디',
      members: [
        { accountId: 'u-student', role: 'OWNER' },
        { accountId: 'u-01', role: 'MEMBER' },
        { accountId: 'u-02', role: 'MEMBER' },
      ],
    },
  ],
  sessions: [{ id: 's-1', workspaceId: 'ws-1', status: 'OPEN', closesAt: daysFromNow(3), teamCapacity: 4 }],
  announcements: [
    { id: 'a-1', workspaceId: 'ws-1', title: '팀 빌딩 마감 시각 안내', authorName: '박강사', createdAt: hoursAgo(1) },
    { id: 'a-2', workspaceId: 'ws-1', title: 'PR 카드 작성 가이드: 희망 역할과 태그 쓰는 법', authorName: '정매니저', createdAt: hoursAgo(26) },
    { id: 'a-3', workspaceId: 'ws-1', title: '알파팀 첫 회의 일정', authorName: '김철수', teamName: '알파팀', createdAt: hoursAgo(72) },
  ],
  teams: [
    { id: 't-1', workspaceId: 'ws-1', name: '알파팀', leaderId: 'u-01', memberIds: ['u-01', 'u-02'] },
    { id: 't-2', workspaceId: 'ws-1', name: '데이터 크루', leaderId: 'u-05', memberIds: ['u-04', 'u-05'] },
  ],
});

const read = (): MockDb => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockDb;
      if (parsed.version === VERSION) return parsed;
    }
  } catch {
    // 저장소를 쓸 수 없거나 손상된 경우 초기 데이터로 시작한다.
  }
  return seed();
};

let db: MockDb = read();
// 처음 실행하면 초기 데이터를 바로 저장해 새로고침 후에도 같은 상태로 시작한다.
try {
  if (!localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
} catch {
  // 저장하지 못해도 메모리에서 동작한다.
}

export const getDb = () => db;

export const commit = (next: MockDb) => {
  db = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 시크릿 모드 등에서 저장하지 못해도 메모리에서는 계속 동작한다.
  }
};

export const resetDb = () => commit(seed());

/** 실제 네트워크와 비슷한 지연 */
export const latency = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 오류 상태 확인용 스위치: localStorage `pickteam.renewal.mock.fail`에 쉼표로 구분한 작업 이름을 넣으면 해당 호출이 실패한다.
 * 예) members,saveCard
 */
export const shouldFail = (operation: string) => {
  try {
    return (localStorage.getItem('pickteam.renewal.mock.fail') ?? '').split(',').map((v) => v.trim()).includes(operation);
  } catch {
    return false;
  }
};
