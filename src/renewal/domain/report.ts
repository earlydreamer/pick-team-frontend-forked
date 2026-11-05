/**
 * 신고(17 §4.1, §5.1, §5.2, §6.5). 사용자가 제출하면 워크스페이스 개설자·매니저가 1차로 받고(17 §2),
 * 시스템 관리자는 /admin/reports(SCR-SYS-01)에서 모든 신고를 처리할 수 있다.
 * 신고자 정보는 어떤 경우에도 피신고자에게 보이지 않는다(17 §5.1 신고자 보호).
 */

export type ReportTargetType = 'USER' | 'MESSAGE' | 'POST';
export const REPORT_TARGET_LABEL: Record<ReportTargetType, string> = { USER: '사용자', MESSAGE: '메시지', POST: '게시글' };

export type ReportReason = 'ABUSE' | 'SPAM' | 'PRIVACY' | 'OTHER';
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'ABUSE', label: '욕설·혐오 표현' },
  { value: 'SPAM', label: '스팸·반복 도배' },
  { value: 'PRIVACY', label: '개인정보 침해' },
  { value: 'OTHER', label: '기타' },
];
export const REPORT_REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((item) => [item.value, item.label])) as Record<ReportReason, string>;

export type ReportStatus = 'RECEIVED' | 'REVIEWING' | 'DISMISSED' | 'ACTED';
export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = { RECEIVED: '접수', REVIEWING: '검토 중', DISMISSED: '기각', ACTED: '조치 완료' };

/** 조치. 기각(DISMISS)은 status만 DISMISSED로 바꾼다 */
export type ReportAction = 'DISMISS' | 'WARNED' | 'CONTENT_REMOVED' | 'BANNED_WS' | 'BANNED_SYSTEM';
export const REPORT_ACTION_LABEL: Record<ReportAction, string> = {
  DISMISS: '기각',
  WARNED: '경고',
  CONTENT_REMOVED: '콘텐츠 삭제',
  BANNED_WS: '워크스페이스 차단',
  BANNED_SYSTEM: '계정 정지',
};

export const REPORT_LIMITS = { detailMax: 500, memoMax: 500 } as const;

export interface ReportInput {
  targetType: ReportTargetType;
  /** 사용자면 계정 id, 메시지·게시글이면 그 id */
  targetId: string;
  workspaceId: string;
  reason: ReportReason;
  detail?: string;
}

/**
 * 시스템 관리자에게 넘어간 이유. 운영진이 대상인 신고는 접수 때 바로 넘어가고(관할 구분, 17 §2),
 * 매니저는 계정 정지가 필요하거나 판단이 어려우면 넘긴다.
 */
export type ReportEscalation = 'STAFF_TARGET' | 'MANAGER';
export const ESCALATION_LABEL: Record<ReportEscalation, string> = { STAFF_TARGET: '운영진 대상', MANAGER: '매니저가 넘김' };

/** 처리한 쪽. 워크스페이스 운영진(개설자·매니저) 또는 시스템 관리자 */
export type ReportHandler = 'WORKSPACE' | 'SYSTEM';
export const HANDLER_LABEL: Record<ReportHandler, string> = { WORKSPACE: '워크스페이스 운영진', SYSTEM: '운영자' };

/** 관리자 화면 모델. 신고자는 "신고자"로만 보이고 계정은 담지 않는다(신고자 보호는 관리자 화면에서도 필요한 만큼만) */
export interface AdminReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  workspaceId: string;
  workspaceName: string;
  /** 피신고자(작성자) */
  targetAccount: { id: string; name: string };
  /** 신고 시점의 원문. 대상이 지워져도 남는다 */
  snapshot: string;
  reason: ReportReason;
  detail?: string;
  status: ReportStatus;
  action?: Exclude<ReportAction, 'DISMISS'>;
  adminMemo?: string;
  createdAt: string;
  resolvedAt?: string;
  /** 대상이 아직 남아 있는지(콘텐츠 삭제 가능 여부) */
  targetExists: boolean;
  escalation?: ReportEscalation;
  handledBy?: ReportHandler;
}

export const validateReport = (input: Pick<ReportInput, 'reason' | 'detail'>) => {
  const detail = input.detail?.trim() ?? '';
  if (input.reason === 'OTHER' && !detail) return '기타를 고르면 사유를 적어 주세요.';
  if (detail.length > REPORT_LIMITS.detailMax) return `설명은 ${REPORT_LIMITS.detailMax}자까지 쓸 수 있어요.`;
  return undefined;
};

/** 대상 종류마다 고를 수 있는 조치(17 §5.2). 콘텐츠 삭제는 메시지·게시글에만 있다 */
export const actionsFor = (targetType: ReportTargetType): ReportAction[] =>
  targetType === 'USER' ? ['DISMISS', 'WARNED', 'BANNED_WS', 'BANNED_SYSTEM'] : ['DISMISS', 'WARNED', 'CONTENT_REMOVED', 'BANNED_WS', 'BANNED_SYSTEM'];

export const isOpen = (status: ReportStatus) => status === 'RECEIVED' || status === 'REVIEWING';

/** 워크스페이스 운영진이 고를 수 있는 조치. 계정 정지는 시스템 관리자 몫이다(17 §2 관할 구분) */
export const workspaceActionsFor = (targetType: ReportTargetType): ReportAction[] => actionsFor(targetType).filter((action) => action !== 'BANNED_SYSTEM');

/** 운영진이 지금 처리할 수 있는 신고인지. 넘긴 신고는 시스템 관리자만 처리한다 */
export const handledByWorkspace = (report: Pick<AdminReport, 'status' | 'escalation'>) => isOpen(report.status) && !report.escalation;
