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

/**
 * 소셜 로그인 목적지 보존. 제공자 화면을 다녀오면 로그인 화면의 ?redirect=가 사라지므로,
 * 떠나기 전에 sessionStorage에 두고 콜백에서 한 번 꺼내 쓴다.
 */
const REDIRECT_KEY = 'pendingAuthRedirect';

export const savePendingRedirect = (path: string | null) => {
  try {
    if (path) sessionStorage.setItem(REDIRECT_KEY, path);
    else sessionStorage.removeItem(REDIRECT_KEY);
  } catch {
    // 저장하지 못하면 로그인 뒤 첫 화면으로 간다.
  }
};

/** 꺼내면서 지운다. 다음 로그인에 남지 않게 하기 위해서다 */
export const takePendingRedirect = () => {
  try {
    const value = sessionStorage.getItem(REDIRECT_KEY);
    sessionStorage.removeItem(REDIRECT_KEY);
    return value;
  } catch {
    return null;
  }
};
