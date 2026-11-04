/**
 * 서버 검증 규칙과 같은 비밀번호 조건입니다.
 * - 회원가입(SignupRequest): 8–50자, 대문자·소문자·숫자·특수문자(!@#$%^&*()-=) 각각 1개 이상
 * - 비밀번호 재설정(ResetPasswordRequest): 영문·숫자·특수문자(@$!%*?&) 포함, 그 외 문자는 사용할 수 없음
 * 두 규칙이 서버에서 다르게 정의돼 있어 화면도 각각 따릅니다(docs/redesign-plan.md 참고).
 */
export type PasswordPolicy = 'signup' | 'reset';

export interface PasswordRule {
  id: string;
  label: string;
  test: (value: string) => boolean;
}

const signupRules: PasswordRule[] = [
  { id: 'length', label: '8–50자', test: (v) => v.length >= 8 && v.length <= 50 },
  { id: 'upper', label: '영문 대문자', test: (v) => /[A-Z]/.test(v) },
  { id: 'lower', label: '영문 소문자', test: (v) => /[a-z]/.test(v) },
  { id: 'digit', label: '숫자', test: (v) => /\d/.test(v) },
  { id: 'special', label: '특수문자 !@#$%^&*()-=', test: (v) => /[!@#$%^&*()\-=]/.test(v) },
];

const resetRules: PasswordRule[] = [
  { id: 'length', label: '8자 이상', test: (v) => v.length >= 8 },
  { id: 'letter', label: '영문', test: (v) => /[a-zA-Z]/.test(v) },
  { id: 'digit', label: '숫자', test: (v) => /\d/.test(v) },
  { id: 'special', label: '특수문자 @$!%*?&', test: (v) => /[@$!%*?&]/.test(v) },
  { id: 'charset', label: '영문·숫자·@$!%*?&만 사용', test: (v) => v.length > 0 && /^[A-Za-z\d@$!%*?&]+$/.test(v) },
];

export const passwordRules = (policy: PasswordPolicy) => (policy === 'signup' ? signupRules : resetRules);

export const isPasswordValid = (value: string, policy: PasswordPolicy) =>
  passwordRules(policy).every((rule) => rule.test(value));

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
