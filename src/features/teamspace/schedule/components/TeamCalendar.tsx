import React, { useState } from 'react';
import { Card, Button, Badge, Modal, Input, TextArea } from '@/components/ui';
import { useRenewal } from '@/features/renewal/context/RenewalContext';

interface TeamCalendarProps {
  teamId?: string;
  workspaceId?: string;
  isReadOnly?: boolean;
}

const SCHEDULE_TYPE_META: Record<
  'MEETING' | 'DEADLINE' | 'WORKSHOP' | 'VACATION' | 'OTHER',
  { label: string; badgeVariant: 'peri' | 'danger' | 'warning' | 'success' | 'neutral'; dotClass: string }
> = {
  MEETING: { label: '정기·스프린트 회의', badgeVariant: 'peri', dotClass: 'bg-peri-600' },
  DEADLINE: { label: '마감·데드라인', badgeVariant: 'danger', dotClass: 'bg-rose-600' },
  WORKSHOP: { label: '코드리뷰·워크숍', badgeVariant: 'warning', dotClass: 'bg-amber-600' },
  VACATION: { label: '휴가·개인일정', badgeVariant: 'success', dotClass: 'bg-emerald-600' },
  OTHER: { label: '기타', badgeVariant: 'neutral', dotClass: 'bg-neutral-500' },
};

export const TeamCalendar: React.FC<TeamCalendarProps> = ({
  teamId = 'team-alpha',
  workspaceId = 'ws-kosta-295',
  isReadOnly = false,
}) => {
  const { getTeamSchedules, addSchedule, deleteSchedule } = useRenewal();

  const [viewMode, setViewMode] = useState<'MONTH' | 'WEEK' | 'LIST'>('MONTH');
  const [showPersonalLayer, setShowPersonalLayer] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('2026-10-16T14:00');
  const [endDate, setEndDate] = useState('2026-10-16T15:30');
  const [type, setType] = useState<'MEETING' | 'DEADLINE' | 'WORKSHOP' | 'VACATION' | 'OTHER'>('MEETING');
  const [isPersonal, setIsPersonal] = useState(false);
  const [desc, setDesc] = useState('');

  const schedules = getTeamSchedules(teamId, showPersonalLayer);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addSchedule({
      workspaceId,
      teamId,
      title: title.trim(),
      startDate,
      endDate,
      type,
      isPersonal,
      scheduleDesc: desc.trim() || undefined,
      reminderMinutesBefore: 5,
    });
    setTitle('');
    setDesc('');
    setCreateOpen(false);
  };

  // Generate October 2026 days for Month Grid
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="space-y-5">
      {/* Toolbar: 3 Views (Month / Week / List) + Personal Layer Toggle (Spec 14 §4.3) */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-craft-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex p-1 bg-surface-subtle rounded-xl border border-neutral-200">
            {[
              { id: 'MONTH', label: '월간 그리드' },
              { id: 'WEEK', label: '주간 타임라인' },
              { id: 'LIST', label: '리스트 뷰' },
            ].map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setViewMode(v.id as 'MONTH' | 'WEEK' | 'LIST')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  viewMode === v.id ? 'bg-peri-600 text-white shadow-xs' : 'text-ink-secondary'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-peri-50 border border-peri-200 text-xs font-bold text-peri-800 cursor-pointer">
            <input
              type="checkbox"
              checked={showPersonalLayer}
              onChange={(e) => setShowPersonalLayer(e.target.checked)}
              className="h-4 w-4 accent-peri-600"
            />
            <span>내 개인 일정 레이어 겹쳐 보기 (본인에게만 표시)</span>
          </label>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3">
          <span className="text-sm font-extrabold text-ink-primary tabular-nums">2026년 10월</span>
          {!isReadOnly && (
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              + 일정 추가 (팀/개인)
            </Button>
          )}
        </div>
      </div>

      {/* Legend (5 ScheduleTypes, Spec 14-D3) */}
      <div className="flex flex-wrap items-center gap-3 px-1 text-xs text-ink-secondary">
        <span className="font-bold text-ink-tertiary">유형 범례:</span>
        {(Object.keys(SCHEDULE_TYPE_META) as Array<keyof typeof SCHEDULE_TYPE_META>).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 font-semibold">
            <span className={`w-2.5 h-2.5 rounded-full ${SCHEDULE_TYPE_META[k].dotClass}`} />
            <span>
              {k} ({SCHEDULE_TYPE_META[k].label})
            </span>
          </span>
        ))}
      </div>

      {/* 1. MONTH VIEW */}
      {viewMode === 'MONTH' && (
        <Card noPadding className="overflow-hidden">
          <div className="grid grid-cols-7 bg-surface-subtle border-b border-neutral-200 text-center py-2.5 text-xs font-extrabold text-ink-secondary">
            {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-neutral-200/80">
            {/* Offset for Oct 1, 2026 (Thursday = 4 empty cells) */}
            {[0, 1, 2, 3].map((empty) => (
              <div key={`empty-${empty}`} className="min-h-[96px] sm:min-h-[116px] bg-surface-subtle/30 p-1.5" />
            ))}
            {daysInMonth.map((day) => {
              const datePrefix = `2026-10-${String(day).padStart(2, '0')}`;
              const dayEvents = schedules.filter((s) => s.startDate.startsWith(datePrefix));
              const isToday = day === 14;

              return (
                <div
                  key={day}
                  className={`min-h-[96px] sm:min-h-[116px] p-1.5 sm:p-2 flex flex-col gap-1 ${
                    isToday ? 'bg-peri-50/40' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center tabular-nums ${
                        isToday ? 'bg-peri-600 text-white' : 'text-ink-secondary'
                      }`}
                    >
                      {day}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className={`px-1.5 py-1 rounded text-[11px] font-bold truncate ${
                          ev.isPersonal
                            ? 'bg-violet-50 text-violet-900 border border-dashed border-violet-400'
                            : ev.type === 'DEADLINE'
                            ? 'bg-rose-50 text-rose-900 border border-rose-200'
                            : 'bg-peri-50 text-peri-800 border border-peri-200'
                        }`}
                        title={`${ev.title} (${ev.startDate.slice(11, 16)})`}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] font-bold text-ink-tertiary pl-1">
                        +{dayEvents.length - 3}개 더보기
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 2. WEEK VIEW */}
      {viewMode === 'WEEK' && (
        <Card title="이번 주 일정 레인 (2026.10.12 ~ 10.18)" subtitle="시간대별 팀 공식 일정과 내 개인 일정을 비교합니다.">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[14, 15, 16, 17].map((day) => {
              const datePrefix = `2026-10-${day}`;
              const dayEvents = schedules.filter((s) => s.startDate.startsWith(datePrefix));
              return (
                <div
                  key={day}
                  className="p-3.5 rounded-2xl bg-surface-subtle/70 border border-neutral-200 space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                    <span className="text-sm font-extrabold text-ink-primary tabular-nums">
                      10월 {day}일
                    </span>
                    {day === 14 && (
                      <Badge variant="peri" size="xs">
                        오늘
                      </Badge>
                    )}
                  </div>
                  {dayEvents.length === 0 ? (
                    <p className="text-xs text-ink-tertiary py-4 text-center">등록된 일정 없음</p>
                  ) : (
                    dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3 rounded-xl bg-white border border-neutral-200 space-y-1 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <Badge
                            variant={
                              ev.isPersonal
                                ? 'admin'
                                : SCHEDULE_TYPE_META[ev.type].badgeVariant
                            }
                            size="xs"
                          >
                            {ev.isPersonal ? '내 개인 일정' : ev.type}
                          </Badge>
                          <span className="text-xs font-bold text-ink-tertiary tabular-nums">
                            {ev.startDate.slice(11, 16)}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-ink-primary">
                          {ev.title}
                        </div>
                        {ev.scheduleDesc && (
                          <p className="text-xs text-ink-secondary">{ev.scheduleDesc}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 3. LIST VIEW */}
      {viewMode === 'LIST' && (
        <Card title="전체 일정 리스트" subtitle="시작 5분 전 인앱 리마인더 알림이 자동 발송됩니다. (16-D4)">
          <div className="space-y-3">
            {schedules.map((ev) => (
              <div
                key={ev.id}
                className="p-4 rounded-2xl bg-surface-subtle/60 border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        ev.isPersonal ? 'admin' : SCHEDULE_TYPE_META[ev.type].badgeVariant
                      }
                      size="xs"
                    >
                      {ev.isPersonal ? '🔒 내 개인 일정' : SCHEDULE_TYPE_META[ev.type].label}
                    </Badge>
                    <span className="text-sm font-extrabold text-ink-primary">{ev.title}</span>
                  </div>
                  {ev.scheduleDesc && (
                    <p className="text-xs text-ink-secondary">{ev.scheduleDesc}</p>
                  )}
                  <div className="text-xs text-ink-tertiary tabular-nums">
                    일시: {ev.startDate.replace('T', ' ')} ~ {ev.endDate.replace('T', ' ')} · 등록:{' '}
                    {ev.creatorName}
                  </div>
                </div>
                {!isReadOnly && (
                  <Button variant="ghost" size="xs" onClick={() => deleteSchedule(ev.id)}>
                    삭제
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add Schedule Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="새 일정 등록 (팀 공식 / 내 개인 일정)"
        subtitle="개인 일정으로 체크하면 타 팀원에게는 절대 노출되지 않으며 내 캘린더에만 표시됩니다. (14 §4.3)"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              취소
            </Button>
            <Button variant="primary" size="sm" onClick={handleAdd}>
              일정 등록하기
            </Button>
          </>
        }
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            label="일정 제목"
            name="title"
            requiredMark
            placeholder="예: 중간 발표 리허설 회의"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              label="시작 일시"
              name="startDate"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="종료 일시"
              name="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-ink-primary mb-1.5">
              일정 유형 (ScheduleType 5종)
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-neutral-300 bg-surface-subtle/60 text-sm font-semibold text-ink-primary"
            >
              {(Object.keys(SCHEDULE_TYPE_META) as Array<keyof typeof SCHEDULE_TYPE_META>).map(
                (k) => (
                  <option key={k} value={k}>
                    {k} — {SCHEDULE_TYPE_META[k].label}
                  </option>
                )
              )}
            </select>
          </div>
          <TextArea
            label="일정 메모 (선택)"
            name="desc"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-violet-50 border border-dashed border-violet-300 text-xs font-bold text-violet-900 cursor-pointer">
            <input
              type="checkbox"
              checked={isPersonal}
              onChange={(e) => setIsPersonal(e.target.checked)}
              className="h-4 w-4 accent-peri-600"
            />
            <span>🔒 내 개인 일정으로 등록 (본인에게만 표시 · 14 §5.3)</span>
          </label>
        </form>
      </Modal>
    </div>
  );
};

export default TeamCalendar;
