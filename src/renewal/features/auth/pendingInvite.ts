/**
 * 초대 코드 보존(10 §5.2). 가입·로그인·OAuth를 거치는 동안 초대 코드를 sessionStorage에 둔다.
 * 탭을 닫으면 사라져 의도하지 않은 재합류를 막고, OAuth 리다이렉트로 URL 파라미터가 덮어써지는 문제를 피한다.
 */
const KEY = 'pendingInviteCode';

export const savePendingInvite = (code: string) => {
  try {
    sessionStorage.setItem(KEY, code);
  } catch {
    // 저장하지 못하면 가입 후 초대 링크를 다시 열어야 한다. 흐름 자체는 막지 않는다.
  }
};

export const readPendingInvite = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const clearPendingInvite = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // 지우지 못해도 탭을 닫으면 사라진다.
  }
};
