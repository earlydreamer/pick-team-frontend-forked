import React, { useState } from 'react';
import { Card, Button, Badge, Modal, TextArea } from '@/components/ui';
import { useRenewal } from '../context/RenewalContext';
import {
  SafetyReport,
  ReportStatusType,
  ReportActionType,
} from '../types/renewal';

export const AdminReportsPage: React.FC = () => {
  const { reports, processSafetyReport } = useRenewal();
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReportStatusType>('ALL');
  const [selectedReport, setSelectedReport] = useState<SafetyReport | null>(null);
  const [selectedAction, setSelectedAction] = useState<ReportActionType>('WARNED');
  const [adminMemo, setAdminMemo] = useState('');

  const filteredReports = reports.filter((r) =>
    statusFilter === 'ALL' ? true : r.status === statusFilter
  );

  const handleActionSubmit = (dismiss: boolean) => {
    if (!selectedReport) return;
    processSafetyReport(
      selectedReport.id,
      dismiss ? 'DISMISSED' : 'ACTED',
      dismiss ? undefined : selectedAction,
      adminMemo.trim() || undefined
    );
    setSelectedReport(null);
    setAdminMemo('');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="admin" size="xs">
              SCR-SYS-01 · 시스템 관리자 신고 처리 콘솔 (17 §4.1)
            </Badge>
            <Badge variant="peri" size="xs">
              SLA: 영업일 3일 내 1차 검토 (17-D5)
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-ink-primary mt-1">
            트러스트 & 세이프티 신고 처리 콘솔
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary">
            신고자 익명 보호 원칙(17 §5.1) 하에 접수된 사용자·메시지·게시글·PR 카드 신고를 검토하고 제재를 집행합니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(['ALL', 'RECEIVED', 'REVIEWING', 'ACTED', 'DISMISSED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                statusFilter === st
                  ? 'bg-violet-700 text-white'
                  : 'bg-white border border-neutral-200 text-ink-secondary'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <Card variant="admin" noPadding className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-violet-50/80 text-violet-950 font-extrabold border-b border-violet-200">
              <tr>
                <th className="p-4">신고 ID</th>
                <th className="p-4">대상 유형 · 라벨</th>
                <th className="p-4">신고 사유</th>
                <th className="p-4">접수 일시</th>
                <th className="p-4">상태</th>
                <th className="p-4 text-right">검토 · 조치</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/80 bg-white">
              {filteredReports.map((r) => (
                <tr key={r.id} className="hover:bg-peri-50/30">
                  <td className="p-4 font-mono font-bold text-peri-700">{r.id}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" size="xs">
                        {r.targetType}
                      </Badge>
                      <span className="font-bold text-ink-primary">{r.targetLabel}</span>
                    </div>
                    <p className="text-xs text-ink-tertiary mt-0.5 line-clamp-1">
                      "{r.targetContentSnippet}"
                    </p>
                  </td>
                  <td className="p-4 font-semibold text-ink-secondary">{r.reason}</td>
                  <td className="p-4 text-xs text-ink-tertiary tabular-nums">{r.createdAt}</td>
                  <td className="p-4">
                    <Badge
                      variant={
                        r.status === 'RECEIVED'
                          ? 'danger'
                          : r.status === 'REVIEWING'
                          ? 'warning'
                          : r.status === 'ACTED'
                          ? 'success'
                          : 'neutral'
                      }
                      size="xs"
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    <Button
                      variant="admin"
                      size="xs"
                      onClick={() => {
                        setSelectedReport(r);
                        setAdminMemo(r.adminMemo || '');
                      }}
                    >
                      상세 검토 · 조치 →
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Report Review & Action Modal */}
      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title={`신고 검토 및 제재 집행 (${selectedReport?.id || ''})`}
        subtitle="신고자 식별 정보는 피신고자에게 절대 노출되지 않습니다. (17 §5.1)"
        size="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setSelectedReport(null)}>
              닫기
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleActionSubmit(true)}
            >
              근거 없음 기각 (DISMISSED)
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleActionSubmit(false)}
            >
              제재 조치 실행 ({selectedAction})
            </Button>
          </>
        }
      >
        {selectedReport && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-surface-subtle border border-neutral-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="font-bold text-ink-tertiary">신고 대상</span>
                <span className="font-bold text-ink-primary">
                  [{selectedReport.targetType}] {selectedReport.targetLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-ink-tertiary">신고자 (익명 보호)</span>
                <span className="font-semibold text-ink-secondary">
                  {selectedReport.reporterName}
                </span>
              </div>
              <div className="pt-2 border-t border-neutral-200">
                <div className="font-bold text-ink-primary mb-1">신고 원문 스니펫 및 상세 사유</div>
                <p className="text-ink-secondary italic">"{selectedReport.targetContentSnippet}"</p>
                {selectedReport.reasonDetail && (
                  <p className="text-ink-primary font-medium mt-1">
                    사유 상세: {selectedReport.reasonDetail}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-bold text-ink-primary mb-2">
                집행할 제재 조치 선택 (17 §5.1 상태 머신)
              </label>
              <div className="grid sm:grid-cols-2 gap-2">
                {[
                  { id: 'WARNED', label: '1. 경고 조치 발송 (WARNED)' },
                  { id: 'CONTENT_REMOVED', label: '2. 해당 콘텐츠 삭제/비공개 (CONTENT_REMOVED)' },
                  { id: 'BANNED_WS', label: '3. 워크스페이스 차단 파급 (BANNED_WS)' },
                  { id: 'BANNED_SYSTEM', label: '4. 시스템 계정 정지 (BANNED_SYSTEM)' },
                ].map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setSelectedAction(act.id as ReportActionType)}
                    className={`p-3 rounded-xl border text-left text-xs font-bold cursor-pointer ${
                      selectedAction === act.id
                        ? 'bg-violet-700 text-white border-violet-700'
                        : 'bg-white text-ink-secondary border-neutral-300'
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            </div>

            <TextArea
              label="관리자 내부 처리 메모"
              name="adminMemo"
              placeholder="조치 근거 및 특이사항을 기록하세요."
              value={adminMemo}
              onChange={(e) => setAdminMemo(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminReportsPage;
