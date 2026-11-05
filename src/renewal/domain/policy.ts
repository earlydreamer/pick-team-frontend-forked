/**
 * 약관·개인정보 동의. 근거: docs/renewal/spec/17-policy-operations.md §6.2 동의 시점, 17-D6 연령 확인.
 * 가입할 때 이용약관과 개인정보 처리방침 동의, 만 14세 이상 확인을 모두 받아야 한다.
 * 소셜 로그인으로 처음 들어온 계정은 첫 화면 전에 같은 동의를 받는다.
 */

export type AgreementKey = 'terms' | 'privacy' | 'age';
export type Agreements = Record<AgreementKey, boolean>;

/** 문서를 고치면 올린다. 동의 기록에 함께 남겨 어떤 판에 동의했는지 알 수 있게 한다 */
export const POLICY_VERSION = '2026-11-05';

export const AGREEMENT_ITEMS: { key: AgreementKey; label: string; link?: { to: string; text: string } }[] = [
  { key: 'terms', label: '이용약관에 동의해요', link: { to: '/terms', text: '이용약관 보기' } },
  { key: 'privacy', label: '개인정보 수집·이용에 동의해요', link: { to: '/privacy', text: '개인정보 처리방침 보기' } },
  { key: 'age', label: '만 14세 이상이에요' },
];

export const noAgreements = (): Agreements => ({ terms: false, privacy: false, age: false });

/** 빠진 동의가 있으면 화면에 보일 문장을 돌려준다 */
export const missingAgreement = (agreements: Agreements | undefined) => {
  if (!agreements?.terms || !agreements.privacy) return '이용약관과 개인정보 처리방침에 동의해 주세요.';
  if (!agreements.age) return '만 14세 미만은 가입할 수 없어요.';
  return undefined;
};

export interface PolicyConsent {
  version: string;
  agreedAt: string;
}

/**
 * 이 판보다 앞선 동의는 다시 받는다. 수집 항목, 이용 목적, 이용 제한처럼 동의 내용이 바뀌는 개정에서만 올린다.
 * 문구 정리 같은 작은 개정은 POLICY_VERSION만 올리고 다시 묻지 않는다.
 */
export const CONSENT_MIN_VERSION = '2026-10-01';

/** missing은 동의 기록이 없는 경우(소셜 첫 로그인), outdated는 다시 동의해야 하는 개정 이전 동의다 */
export type ConsentState = 'missing' | 'outdated' | 'current';

/** 판은 시행일(YYYY-MM-DD)이라 문자열 비교로 앞뒤를 가린다 */
export const consentState = (consent: PolicyConsent | null | undefined): ConsentState => {
  if (!consent) return 'missing';
  return consent.version < CONSENT_MIN_VERSION ? 'outdated' : 'current';
};

/** 다시 동의할 때 묻는 항목. 연령 확인은 처음 동의할 때 받은 것을 그대로 쓴다 */
export const agreementKeysFor = (state: ConsentState): AgreementKey[] => (state === 'outdated' ? ['terms', 'privacy'] : ['terms', 'privacy', 'age']);
