/**
 * API 오류를 화면에 보여 줄 문장으로 바꿉니다.
 * apiClient·userApi는 서버 응답 본문(JSON 문자열)을 그대로 message에 담으므로,
 * JSON이면 message/detail을 꺼내고 HTML·빈 값이면 호출자가 준 안내 문구를 사용합니다.
 */
export const getErrorStatus = (error: unknown): number | undefined => {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
};

export const getErrorMessage = (error: unknown, fallback: string): string => {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!raw) return fallback;
  const text = raw.trim();
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      const message = parsed?.message || parsed?.detail || parsed?.error?.message || parsed?.errors?.[0]?.defaultMessage;
      return typeof message === 'string' && message.trim() ? message : fallback;
    } catch {
      return fallback;
    }
  }
  if (text.startsWith('<') || /^HTTP \d+$/.test(text) || text.length > 200) return fallback;
  return text;
};
