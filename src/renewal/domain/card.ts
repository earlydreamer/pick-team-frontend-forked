/**
 * PR 카드 v2 도메인. 근거: docs/renewal/spec/11-profile-pr-card.md §4.1
 * 희망 역할, 가용 시간, 목표 온도, 공개 여부, 동의 시각은 백엔드에 아직 없는 필드다.
 */

export const ROLES = ['BACKEND', 'FRONTEND', 'FULLSTACK', 'PM', 'DESIGN', 'INFRA', 'AI_DATA', 'OTHER'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = {
  BACKEND: '백엔드',
  FRONTEND: '프론트엔드',
  FULLSTACK: '풀스택',
  PM: 'PM·기획',
  DESIGN: '디자인',
  INFRA: '인프라·DevOps',
  AI_DATA: 'AI·데이터',
  OTHER: '기타',
};

export const WEEKLY_HOURS = ['LT10H', 'H10_20', 'H20_30', 'GT30H'] as const;
export type WeeklyHours = (typeof WEEKLY_HOURS)[number];
export const WEEKLY_HOURS_LABEL: Record<WeeklyHours, string> = {
  LT10H: '10시간 미만',
  H10_20: '10~20시간',
  H20_30: '20~30시간',
  GT30H: '30시간 이상',
};

export const TIME_SLOTS = ['MORNING', 'AFTERNOON', 'EVENING', 'WEEKEND'] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];
export const TIME_SLOT_LABEL: Record<TimeSlot, string> = { MORNING: '오전', AFTERNOON: '오후', EVENING: '저녁', WEEKEND: '주말' };

export const WORKSTYLES = ['ASYNC_FIRST', 'SYNC_PREFERRED', 'DETAIL_ORIENTED', 'SPEED_FIRST', 'STRUCTURED', 'FLEXIBLE'] as const;
export type Workstyle = (typeof WORKSTYLES)[number];
export const WORKSTYLE_LABEL: Record<Workstyle, string> = {
  ASYNC_FIRST: '비동기 우선',
  SYNC_PREFERRED: '실시간 소통 선호',
  DETAIL_ORIENTED: '꼼꼼한 문서화',
  SPEED_FIRST: '빠른 실행',
  STRUCTURED: '계획 중심 진행',
  FLEXIBLE: '유연한 진행',
};

export const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP',
] as const;
export type Mbti = (typeof MBTI_TYPES)[number];

/** 1(완주 지향) ~ 5(수상 지향) */
export type GoalTemperature = 1 | 2 | 3 | 4 | 5;

export interface PrCard {
  desiredRole1?: Role;
  desiredRole2?: Role;
  /** 역할이 OTHER일 때 자유 입력 */
  otherRoleText?: string;
  weeklyAvailableHours?: WeeklyHours;
  availableTimeSlots: TimeSlot[];
  goalTemperature?: GoalTemperature;
  hashtags: string[];
  preferWorkstyleOptions: Workstyle[];
  dislikeWorkstyleOptions: Workstyle[];
  /** 협업 스타일 자유 서술(100자) */
  workstyleText?: string;
  introduction?: string;
  portfolio?: string;
  /** 선택하지 않으면 카드에 표시하지 않고 매칭에서도 쓰지 않는다(11-D4) */
  mbti?: Mbti;
  cardVisible: boolean;
  consentGivenAt?: string;
}

/** 11 §5.1 카드 작성 상태 */
export type CardStatus = 'NO_CONSENT' | 'NOT_WRITTEN' | 'PUBLIC' | 'PRIVATE';

export const isRequiredComplete = (card: PrCard) =>
  Boolean(card.desiredRole1 && card.desiredRole2 && card.desiredRole1 !== card.desiredRole2 && card.weeklyAvailableHours);

export const cardStatus = (card: PrCard): CardStatus => {
  if (!card.consentGivenAt) return 'NO_CONSENT';
  if (!isRequiredComplete(card)) return 'NOT_WRITTEN';
  return card.cardVisible ? 'PUBLIC' : 'PRIVATE';
};

/** 서버 검증과 같아야 하는 제한(백엔드 구현 시 맞춘다) */
export const CARD_LIMITS = {
  introduction: 500,
  workstyleText: 100,
  portfolio: 200,
  hashtagCount: 20,
  hashtagMin: 2,
  hashtagMax: 20,
  workstyleMax: 3,
  otherRoleText: 20,
} as const;

/** 기존 UserHashtag 검증 규칙과 같다(UserProfileUpdateRequest). 공백과 기호를 받지 않는다. */
export const HASHTAG_PATTERN = /^[가-힣a-zA-Z0-9_]+$/;

export const emptyCard = (): PrCard => ({
  availableTimeSlots: [],
  hashtags: [],
  preferWorkstyleOptions: [],
  dislikeWorkstyleOptions: [],
  cardVisible: false,
});

export const roleText = (card: Pick<PrCard, 'otherRoleText'>, role?: Role) =>
  role === 'OTHER' && card.otherRoleText ? card.otherRoleText : role ? ROLE_LABEL[role] : undefined;

/** 폼 검증 결과. 키는 필드 이름이고 값은 화면에 보여 줄 문장이다. */
export type CardErrors = Partial<Record<'desiredRole1' | 'desiredRole2' | 'otherRoleText' | 'weeklyAvailableHours' | 'portfolio', string>>;

export const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

/** 필수 항목과 형식을 검사한다. requiredOnly면 필수 항목만 본다(위저드 2단계). */
export const validateCard = (card: PrCard, requiredOnly = false): CardErrors => {
  const errors: CardErrors = {};
  if (!card.desiredRole1) errors.desiredRole1 = '1순위 역할을 골라 주세요.';
  if (!card.desiredRole2) errors.desiredRole2 = '2순위 역할을 골라 주세요.';
  else if (card.desiredRole1 === card.desiredRole2) errors.desiredRole2 = '1순위와 다른 역할을 골라 주세요.';
  if ((card.desiredRole1 === 'OTHER' || card.desiredRole2 === 'OTHER') && !card.otherRoleText?.trim()) {
    errors.otherRoleText = '기타 역할의 이름을 적어 주세요.';
  }
  if (!card.weeklyAvailableHours) errors.weeklyAvailableHours = '주간 가용 시간을 골라 주세요.';
  if (!requiredOnly && card.portfolio?.trim() && !isHttpUrl(card.portfolio)) {
    errors.portfolio = '올바른 URL 형식이 아니에요. https://로 시작하는 주소를 입력해 주세요.';
  }
  return errors;
};
