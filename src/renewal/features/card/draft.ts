import type { PrCard } from '@/renewal/domain/card';

/**
 * 온보딩 위저드 임시저장(11 §4.2 단계 이탈 처리). 브라우저 localStorage에 계정·워크스페이스별로 둔다.
 */
export interface OnboardingDraft {
  step: 2 | 3;
  card: PrCard;
  savedAt: string;
}

const key = (accountId: string, workspaceId: string) => `pickteam.renewal.onboarding.${accountId}.${workspaceId}`;

export const readDraft = (accountId: string, workspaceId: string): { draft: OnboardingDraft | null; failed: boolean } => {
  try {
    const raw = localStorage.getItem(key(accountId, workspaceId));
    if (!raw) return { draft: null, failed: false };
    const parsed = JSON.parse(raw) as OnboardingDraft;
    if (!parsed?.card || (parsed.step !== 2 && parsed.step !== 3)) throw new Error('invalid draft');
    return { draft: parsed, failed: false };
  } catch {
    return { draft: null, failed: true };
  }
};

export const writeDraft = (accountId: string, workspaceId: string, draft: Omit<OnboardingDraft, 'savedAt'>) => {
  try {
    localStorage.setItem(key(accountId, workspaceId), JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
  } catch {
    // 저장소를 쓸 수 없으면 임시저장 없이 진행한다.
  }
};

export const clearDraft = (accountId: string, workspaceId: string) => {
  try {
    localStorage.removeItem(key(accountId, workspaceId));
  } catch {
    // 무시한다.
  }
};
