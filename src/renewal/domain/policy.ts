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
