import React, { useId, useState } from 'react';
import { FlagIcon } from '@heroicons/react/24/outline';
import { ESCALATION_LABEL, REPORT_REASON_LABEL, REPORT_STATUS_LABEL, REPORT_TARGET_LABEL, handledByWorkspace, type AdminReport } from '@/renewal/domain/report';
import { relativeTime } from '@/renewal/domain/announcement';
import type { WorkspaceSettings } from '@/renewal/domain/workspaceAdmin';
import { useEscalateReport, useResolveInWorkspace, useStartWorkspaceReview, useWorkspaceReports } from '@/renewal/data/queries';
import { Badge, Button, EmptyState, ErrorState, LoadingState } from '@/renewal/ui';
import { ReportDetailModal, STATUS_TONE } from '@/renewal/features/reports/ReportDetailModal';
import { SettingsSection } from './parts';

const ReportList: React.FC<{ items: AdminReport[]; onOpen: (id: string) => void }> = ({ items, onOpen }) => (
  <ul className="-mx-2 divide-y divide-outline-soft">
    {items.map((item) => (
      <li key={item.id}>
        <button type="button" onClick={() => onOpen(item.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2.5 text-left hover:bg-surface-container">
          <Badge tone="neutral">{REPORT_TARGET_LABEL[item.targetType]}</Badge>
          <span className="min-w-[12rem] flex-1">
            <span className="block truncate font-semibold">
              {item.targetAccount.name} · {REPORT_REASON_LABEL[item.reason]}
            </span>
            <span className="block truncate text-sm text-muted">{item.snapshot}</span>
          </span>
          <span className="text-xs text-muted">{relativeTime(item.createdAt)}</span>
          {item.escalation && <Badge tone="warning">{ESCALATION_LABEL[item.escalation]}</Badge>}
          <Badge tone={STATUS_TONE[item.status]}>{REPORT_STATUS_LABEL[item.status]}</Badge>
        </button>
      </li>
    ))}
  </ul>
);

/**
 * 신고 탭(17 §2 워크스페이스 범위 신고 1차 수신, §5.2). 개설자·매니저가 이 워크스페이스의 신고를 검토하고 조치한다.
 * 계정 정지는 고를 수 없고 운영자에게 넘긴다. 운영진이 대상인 신고와 내가 신고했거나 대상인 신고는 목록에 없다.
 */
export const ReportsTab: React.FC<{ settings: WorkspaceSettings }> = ({ settings }) => {
  const id = useId();
  const reports = useWorkspaceReports(settings.id);
  const start = useStartWorkspaceReview(settings.id);
  const resolve = useResolveInWorkspace(settings.id);
  const escalate = useEscalateReport(settings.id);
  const [openId, setOpenId] = useState<string | null>(null);

  if (reports.isLoading) return <LoadingState label="신고를 불러오는 중이에요" />;
  if (reports.isError || !reports.data) {
    return <ErrorState title="신고를 불러오지 못했어요" description="잠시 뒤 다시 시도해 주세요." action={<Button onClick={() => reports.refetch()}>다시 시도</Button>} />;
  }

  const open = reports.data.filter(handledByWorkspace);
  const done = reports.data.filter((item) => !handledByWorkspace(item));
  const current = reports.data.find((item) => item.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <SettingsSection id={`${id}-open`} title={open.length ? `처리할 신고 ${open.length}건` : '처리할 신고'} description="신고한 사람은 보이지 않아요. 계정 정지가 필요하면 운영자에게 넘겨 주세요.">
        {open.length === 0 ? <EmptyState compact icon={<FlagIcon className="h-5 w-5" />} title="처리할 신고가 없어요" /> : <ReportList items={open} onOpen={setOpenId} />}
      </SettingsSection>
      {done.length > 0 && (
        <SettingsSection id={`${id}-done`} title="지난 신고" description="처리했거나 운영자에게 넘긴 신고예요.">
          <ReportList items={done} onOpen={setOpenId} />
        </SettingsSection>
      )}
      <ReportDetailModal
        report={current}
        scope="workspace"
        readOnly={Boolean(settings.archivedAt)}
        handlers={{
          start: start.mutateAsync,
          resolve: resolve.mutateAsync,
          escalate: escalate.mutateAsync,
          pending: { start: start.isPending, resolve: resolve.isPending, escalate: escalate.isPending },
        }}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
};
