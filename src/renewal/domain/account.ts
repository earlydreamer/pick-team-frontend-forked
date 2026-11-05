import { TIME_SLOT_LABEL, WEEKLY_HOURS_LABEL, WORKSTYLE_LABEL, cardStatus, roleText, type PrCard } from './card';
import { WORKSPACE_ROLE_LABEL, type Account, type WorkspaceRole } from './workspace';
import type { NotificationSettings } from './notification';

/**
 * 마이페이지(SCR-MY-01)와 계정 설정(SCR-MY-03)의 내 데이터.
 * 근거: docs/renewal/spec/17-policy-operations.md §6.1 수집 항목, §6.3 열람·정정·삭제권, §6.4 삭제 처리.
 */

export type LoginMethod = 'EMAIL' | 'GOOGLE' | 'KAKAO';
export const LOGIN_METHOD_LABEL: Record<LoginMethod, string> = { EMAIL: '이메일', GOOGLE: 'Google', KAKAO: '카카오' };

export interface MyWorkspace {
  id: string;
  name: string;
  role: WorkspaceRole;
  teamName?: string;
  teamLeader?: boolean;
}

export interface MyData {
  account: Account;
  loginMethods: LoginMethod[];
  card: PrCard;
  workspaces: MyWorkspace[];
  notificationSettings: NotificationSettings;
  /** 계정을 지우기 전에 먼저 해야 할 일. 비어 있으면 바로 지울 수 있다 */
  deletionBlockers: string[];
}

/** 열람 표의 한 줄: 항목, 저장된 값, 공개 범위(17 §6.1) */
export interface DataRow {
  label: string;
  value: string;
  scope: string;
}

const EMPTY = '없음';
const join = (values: string[]) => (values.length ? values.join(', ') : EMPTY);

/**
 * 17 §6.1 인벤토리를 내 값으로 채운다. 카드 항목은 카드를 공개했을 때만 워크스페이스 멤버에게 보인다.
 * 성향·MBTI는 프로파일링성 정보라 카드 작성 동의(11, 17 §6.2)가 있어야 저장된다.
 */
export const myDataRows = (data: MyData): DataRow[] => {
  const { account, card } = data;
  const members = '워크스페이스 멤버';
  const cardScope = cardStatus(card) === 'PUBLIC' ? members : '나만(카드 비공개)';
  return [
    { label: '이메일', value: account.email, scope: '나만(로그인용)' },
    { label: '이름', value: account.name, scope: members },
    { label: '프로필 사진', value: account.profileImageUrl ? '있음' : EMPTY, scope: members },
    { label: '로그인 방식', value: join(data.loginMethods.map((method) => LOGIN_METHOD_LABEL[method])), scope: '나만' },
    { label: '카드 작성 동의', value: card.consentGivenAt ? new Date(card.consentGivenAt).toLocaleString('ko-KR') : EMPTY, scope: '나만' },
    { label: '희망 역할', value: join([card.desiredRole1, card.desiredRole2].filter((role): role is NonNullable<typeof role> => Boolean(role)).map((role) => roleText(card, role) ?? '')), scope: cardScope },
    { label: '주간 가용 시간', value: card.weeklyAvailableHours ? WEEKLY_HOURS_LABEL[card.weeklyAvailableHours] : EMPTY, scope: cardScope },
    { label: '가능한 시간대', value: join(card.availableTimeSlots.map((slot) => TIME_SLOT_LABEL[slot])), scope: cardScope },
    { label: '기술·관심 해시태그', value: join(card.hashtags.map((tag) => `#${tag}`)), scope: cardScope },
    { label: '선호 협업 방식', value: join(card.preferWorkstyleOptions.map((style) => WORKSTYLE_LABEL[style])), scope: cardScope },
    { label: '피하고 싶은 방식', value: join(card.dislikeWorkstyleOptions.map((style) => WORKSTYLE_LABEL[style])), scope: cardScope },
    { label: '협업 스타일 설명', value: card.workstyleText || EMPTY, scope: cardScope },
    { label: '자기소개', value: card.introduction || EMPTY, scope: cardScope },
    { label: '포트폴리오', value: card.portfolio || EMPTY, scope: cardScope },
    { label: 'MBTI', value: card.mbti ?? EMPTY, scope: cardScope },
    { label: '소속 워크스페이스', value: join(data.workspaces.map((workspace) => `${workspace.name}(${WORKSPACE_ROLE_LABEL[workspace.role]})`)), scope: '각 워크스페이스 멤버' },
  ];
};

/** 내려받기 파일. 화면 표와 같은 내용을 기계가 읽을 수 있는 형태로 준다(17 §6.3 열람권). */
export const exportMyData = (data: MyData, now = new Date()) => ({
  exportedAt: now.toISOString(),
  account: { id: data.account.id, name: data.account.name, email: data.account.email, hasProfileImage: Boolean(data.account.profileImageUrl) },
  loginMethods: data.loginMethods,
  card: data.card,
  workspaces: data.workspaces,
  notificationSettings: data.notificationSettings,
});

export const exportFileName = (now = new Date()) => `pickteam-my-data-${now.toISOString().slice(0, 10)}.json`;
