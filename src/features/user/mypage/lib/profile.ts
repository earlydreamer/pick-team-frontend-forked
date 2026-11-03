import type { User } from '@/features/user/types/user';

/** 서버 UserProfileUpdateRequest 검증 규칙과 같은 값입니다. */
export const PROFILE_LIMITS = {
  nameMin: 2,
  nameMax: 50,
  introduction: 500,
  disposition: 200,
  portfolio: 200,
  workstyle: 100,
  hashtagCount: 20,
  hashtagMin: 2,
  hashtagMax: 20,
} as const;

export const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP',
] as const;

export const NAME_PATTERN = /^[가-힣a-zA-Z0-9\s]*$/;
export const HASHTAG_PATTERN = /^[가-힣a-zA-Z0-9_]+$/;

/** 서버 응답과 예전 필드명(bio, portfolioUrl 등)을 함께 읽습니다. */
export const profileFields = (user: User) => ({
  introduction: user.introduction || user.bio || '',
  portfolio: user.portfolio || user.portfolioUrl || '',
  hashtags: (user.hashtags ?? []).map((tag) => tag.replace(/^#/, '')).filter(Boolean),
  disposition: user.disposition || '',
  preferWorkstyle: user.preferWorkstyle || user.preferredStyle || '',
  dislikeWorkstyle: user.dislikeWorkstyle || user.avoidedStyle || '',
});

/** 팀원이 판단하는 데 쓰는 항목. 화면의 '채움' 표시는 이 목록으로만 계산합니다. */
export const completenessItems = (user: User) => {
  const fields = profileFields(user);
  return [
    { id: 'photo', label: '프로필 사진', done: Boolean(user.profileImageUrl) },
    { id: 'introduction', label: '자기소개', done: Boolean(fields.introduction.trim()) },
    { id: 'hashtags', label: '관심 태그', done: fields.hashtags.length > 0 },
    { id: 'mbti', label: 'MBTI', done: Boolean(user.mbti) },
    { id: 'disposition', label: '협업 성향', done: Boolean(fields.disposition.trim()) },
    { id: 'workstyle', label: '선호·비선호 방식', done: Boolean(fields.preferWorkstyle.trim() || fields.dislikeWorkstyle.trim()) },
    { id: 'portfolio', label: '포트폴리오', done: Boolean(fields.portfolio.trim()) },
  ];
};

/** http(s) 주소만 링크로 만듭니다. */
export const safeHttpUrl = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return undefined;
  try {
    return new URL(trimmed).toString();
  } catch {
    return undefined;
  }
};
