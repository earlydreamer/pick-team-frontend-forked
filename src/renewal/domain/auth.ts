import type { Agreements } from './policy';
/**
 * 인증·초대 도메인 규칙. 근거: docs/renewal/spec/10-auth-onboarding.md, 백엔드 DTO 검증 규칙.
 *
 * | 항목 | 규칙 | 백엔드 근거 |
 * |---|---|---|
 * | 가입 비밀번호 | 8~50자, 대문자·소문자·숫자·특수문자(!@#$%^&*()-=) 각 1개 이상 | SignupRequest |
 * | 재설정 비밀번호 | 8~100자, 영문·숫자·특수문자(@$!%*?&) 포함, 그 외 문자 불가 | PasswordResetDto |
 * | 이름 | 2~50자, 한글·영문·숫자·공백 | 프로필 수정 요청 |
 * | 인증 코드 | 숫자 6자리, 5분 유효 | PasswordResetDto, 10 §6.4 |
 * | 초대 코드 | 영문·숫자·하이픈·밑줄, 100자 이하 | WorkspaceJoinRequest |
 * | 워크스페이스 이름·비밀번호 | 이름 1~50자, 비밀번호 4~100자 | WorkspaceCreateRequest |
 */

export type PasswordPolicy = 'signup' | 'reset';

export interface PasswordRule {
  id: string;
  label: string;
  test: (value: string) => boolean;
}

const signupRules: PasswordRule[] = [
  { id: 'length', label: '8~50자', test: (v) => v.length >= 8 && v.length <= 50 },
  { id: 'upper', label: '영문 대문자', test: (v) => /[A-Z]/.test(v) },
  { id: 'lower', label: '영문 소문자', test: (v) => /[a-z]/.test(v) },
  { id: 'digit', label: '숫자', test: (v) => /\d/.test(v) },
  { id: 'special', label: '특수문자 !@#$%^&*()-=', test: (v) => /[!@#$%^&*()\-=]/.test(v) },
];

const resetRules: PasswordRule[] = [
  { id: 'length', label: '8~100자', test: (v) => v.length >= 8 && v.length <= 100 },
  { id: 'letter', label: '영문', test: (v) => /[a-zA-Z]/.test(v) },
  { id: 'digit', label: '숫자', test: (v) => /\d/.test(v) },
  { id: 'special', label: '특수문자 @$!%*?&', test: (v) => /[@$!%*?&]/.test(v) },
  { id: 'charset', label: '영문·숫자·@$!%*?&만 사용', test: (v) => v.length > 0 && /^[A-Za-z\d@$!%*?&]+$/.test(v) },
];

export const passwordRules = (policy: PasswordPolicy) => (policy === 'signup' ? signupRules : resetRules);
export const isPasswordValid = (value: string, policy: PasswordPolicy) => passwordRules(policy).every((rule) => rule.test(value));

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const NAME_LIMITS = { min: 2, max: 50 } as const;
export const validateName = (value: string) => {
  const name = value.trim();
  if (!name) return '이름을 입력해 주세요.';
  if (name.length < NAME_LIMITS.min || name.length > NAME_LIMITS.max) return `이름은 ${NAME_LIMITS.min}~${NAME_LIMITS.max}자로 입력해 주세요.`;
  if (!/^[가-힣a-zA-Z0-9\s]+$/.test(name)) return '이름에는 한글, 영문, 숫자, 공백만 쓸 수 있어요.';
  return undefined;
};

export const CODE_PATTERN = /^\d{6}$/;
/** 인증 코드 유효 시간(10 §6.4) */
export const CODE_TTL_MS = 5 * 60 * 1000;

export const INVITE_CODE_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

export const WORKSPACE_LIMITS = { nameMax: 50, passwordMin: 4, passwordMax: 100 } as const;
export const validateWorkspaceName = (value: string) => {
  const name = value.trim();
  if (!name) return '워크스페이스 이름을 입력해 주세요.';
  if (name.length > WORKSPACE_LIMITS.nameMax) return `이름은 ${WORKSPACE_LIMITS.nameMax}자까지 쓸 수 있어요.`;
  return undefined;
};
/** 비어 있으면 비밀번호 없이 만든다. */
export const validateWorkspacePassword = (value: string) =>
  value && (value.length < WORKSPACE_LIMITS.passwordMin || value.length > WORKSPACE_LIMITS.passwordMax)
    ? `비밀번호는 ${WORKSPACE_LIMITS.passwordMin}~${WORKSPACE_LIMITS.passwordMax}자로 정해 주세요.`
    : undefined;

/**
 * 로그인 후 돌아갈 주소. 다른 사이트로 보내는 열린 리다이렉트를 막기 위해 앱 안의 경로만 허용한다.
 * "/"로 시작하되 "//"(프로토콜 상대 주소)나 "/\"는 거절하고, 인증 화면으로 되돌아가는 주소도 거절한다.
 */
export const safeRedirect = (value: string | null | undefined) => {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  if (/^\/(login|signup|reset-password|oauth)(\/|\?|$)/.test(value)) return null;
  return value;
};

/** 초대 랜딩 정보(10 §4.4, §6.2 GET /api/workspaces/invite/:code) */
export interface InviteInfo {
  code: string;
  workspaceId: string;
  workspaceName: string;
  ownerName: string;
  /** null이면 만료 없음 */
  expiresAt: string | null;
  /** 10-D4: 워크스페이스에 비밀번호가 있으면 랜딩에서 함께 받는다 */
  requiresPassword: boolean;
  /** 로그인 상태일 때만 의미가 있다 */
  alreadyMember: boolean;
}

export interface JoinResult {
  workspaceId: string;
  alreadyMember: boolean;
}

export type OAuthProvider = 'google' | 'kakao';
export const OAUTH_LABEL: Record<OAuthProvider, string> = { google: 'Google', kakao: '카카오' };

export interface SignUpInput {
  email: string;
  name: string;
  password: string;
  /** 이용약관, 개인정보 처리방침, 만 14세 이상 확인(17 §6.2, 17-D6) */
  agreements: Agreements;
}

export interface CreateWorkspaceInput {
  name: string;
  password?: string;
}

/** 붙여 넣은 초대 링크에서 코드만 꺼낸다. 예) https://…/invite/SUMMER26 → SUMMER26. 디코딩할 수 없으면 원문을 돌려준다. */
export const extractInviteCode = (value: string) => {
  const trimmed = value.trim();
  const fromLink = trimmed.match(/\/invite\/([^/?#\s]+)/);
  if (!fromLink) return trimmed;
  try {
    return decodeURIComponent(fromLink[1]);
  } catch {
    return fromLink[1];
  }
};
