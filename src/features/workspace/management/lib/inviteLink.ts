/**
 * 워크스페이스 초대 링크 형식.
 * - 현재: {origin}/invite/{code}  → 초대 화면에서 사용자가 참여를 확인합니다.
 * - 예전: {origin}/#/ws/{code}   → 해시 라우터 시절 형식. BrowserRouter에서는 열리지 않아 붙여 넣기 입력으로만 인식합니다.
 */
export const buildInviteUrl = (inviteCode: string) => `${window.location.origin}/invite/${encodeURIComponent(inviteCode)}`;

export type ParsedInvite = { ok: true; code: string } | { ok: false; reason: 'empty' | 'workspace-id' };

/** 입력한 초대 링크나 코드에서 초대 코드를 꺼냅니다. 숫자만 있는 워크스페이스 ID는 보안상 받지 않습니다. */
export const parseInviteInput = (input: string): ParsedInvite => {
  const value = input.trim();
  if (!value) return { ok: false, reason: 'empty' };
  const fromPath = value.match(/(?:\/invite\/|#\/ws\/|\/ws\/)([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/);
  const code = fromPath ? decodeURIComponent(fromPath[1]) : value;
  if (/^\d+$/.test(code)) return { ok: false, reason: 'workspace-id' };
  return { ok: true, code };
};

/** 참여 실패 원인을 사용자가 할 수 있는 행동과 함께 설명합니다. */
export const describeJoinError = (message: string) => {
  if (message.includes('차단') || message.includes('블랙리스트')) return '이 워크스페이스에서 차단돼 참여할 수 없어요. 관리자에게 문의해 주세요.';
  if (message.includes('비밀번호')) return '비밀번호가 맞지 않아요. 워크스페이스 관리자에게 받은 비밀번호를 확인해 주세요.';
  if (message.includes('이미')) return '이미 참여한 워크스페이스예요.';
  if (message.includes('찾을 수 없') || message.includes('유효하지')) return '초대 코드가 올바르지 않거나 만료됐어요. 관리자에게 새 링크를 요청해 주세요.';
  return message;
};
