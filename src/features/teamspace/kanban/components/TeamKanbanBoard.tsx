import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Modal, Input, TextArea } from '@/components/ui';
import { useRenewal } from '@/features/renewal/context/RenewalContext';
import {
  KanbanTaskStatus,
  RenewalKanbanTask,
} from '@/features/renewal/types/renewal';
import { MemberAvatar } from '@/features/renewal/components/PeriwinkleArtwork';

interface TeamKanbanBoardProps {
  teamId: string;
  workspaceId?: string;
  isReadOnly?: boolean;
}

const COLUMNS: {
  id: KanbanTaskStatus;
  title: string;
  headerBg: string;
  headerText: string;
  countBg: string;
}[] = [
  {
    id: 'TODO',
    title: 'To Do',
    headerBg: 'bg-[#EEF2FF] border border-[#E0E7FF]',
    headerText: 'text-[#4338CA]',
    countBg: 'bg-white text-[#4338CA]',
  },
  {
    id: 'IN_PROGRESS',
    title: 'In Progress',
    headerBg: 'bg-[#E0F2FE] border border-[#BAE6FD]',
    headerText: 'text-[#0284C7]',
    countBg: 'bg-white text-[#0284C7]',
  },
  {
    id: 'APPROVAL_PENDING',
    title: 'Review',
    headerBg: 'bg-[#FEF3C7] border border-[#FDE68A]',
    headerText: 'text-[#D97706]',
    countBg: 'bg-white text-[#D97706]',
  },
  {
    id: 'DONE',
    title: 'Done',
    headerBg: 'bg-[#DCFCE7] border border-[#A7F3D0]',
    headerText: 'text-[#059669]',
    countBg: 'bg-white text-[#059669]',
  },
];

const ISSUE_CODES: Record<string, string> = {
  'task-101': '#BE-15',
  'task-102': '#FE-7',
  'task-103': '#DES-4',
  'task-104': '#BE-12',
  'task-105': '#FE-8',
  'task-201': '#DOC-3',
};

const CHANGED_FILES_MOCK = [
  { path: 'src/pages/profile/index.tsx', added: 120, removed: 12 },
  { path: 'src/components/profile/PRCardView.tsx', added: 45, removed: 3 },
  { path: 'src/apis/user.ts', added: 30, removed: 0 },
];

export const TeamKanbanBoard: React.FC<TeamKanbanBoardProps> = ({
  teamId,
  workspaceId = 'ws-kosta-295',
  isReadOnly = false,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    getTeamKanbanTasks,
    getWorkspaceMembers,
    getRecruitments,
    getEffectiveWorkspaceRole,
    createKanbanTask,
    moveKanbanTaskStatus,
    requestTaskCompletion,
    approveOrRejectTask,
    addKanbanComment,
  } = useRenewal();

  const tasks = getTeamKanbanTasks(teamId);
  const members = getWorkspaceMembers(workspaceId);
  const teams = getRecruitments(workspaceId);
  const currentTeam = teams.find((t) => t.id === teamId) || teams[0];
  const assignableMembers = members.slice(0, 5);

  const wsRole = getEffectiveWorkspaceRole(workspaceId);
  const isManagerOrOwner = wsRole === 'OWNER' || wsRole === 'ADMIN';

  const [viewType, setViewType] = useState<'BOARD' | 'LIST'>('BOARD');
  const [onlyReviewFilter, setOnlyReviewFilter] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>('task-102');
  const [inspectorTab, setInspectorTab] = useState<'DESC' | 'CHANGES' | 'COMMENTS'>('DESC');
  const [commentInput, setCommentInput] = useState('');
  const [rejectReasonOpen, setRejectReasonOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState(assignableMembers[0]?.id || '1');
  const [newDomainTag, setNewDomainTag] = useState('프론트엔드');

  useEffect(() => {
    const taskParam = searchParams.get('task');
    const reviewParam = searchParams.get('review');
    if (taskParam) {
      setSelectedTaskId(taskParam);
    } else if (reviewParam) {
      const firstReview = tasks.find((t) => t.status === 'APPROVAL_PENDING');
      if (firstReview) setSelectedTaskId(firstReview.id);
    }
  }, [searchParams, tasks]);

  const selectedTask: RenewalKanbanTask | null = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  const filteredTasks = useMemo(() => {
    if (!onlyReviewFilter) return tasks;
    return tasks.filter((t) => t.status === 'APPROVAL_PENDING');
  }, [tasks, onlyReviewFilter]);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const assignee =
      assignableMembers.find((m) => String(m.id) === String(newAssigneeId)) || assignableMembers[0];

    createKanbanTask({
      workspaceId,
      teamId: currentTeam?.id || teamId,
      teamName: currentTeam?.name || '코드블루',
      title: newTitle.trim(),
      description:
        newDesc.trim() ||
        '마이페이지 기본 정보, 프로필 수정, 활동 내역을 구현했습니다. 반응형도 함께 적용되어 있습니다.',
      assigneeId: assignee.id,
      assigneeName: assignee.name,
      deadline: '2026-10-18',
      priority: 'HIGH',
      tags: [newDomainTag],
    });
    setNewTitle('');
    setNewDesc('');
    setCreateOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Bar (06. 칸반 보드 — H2: 32/44 Bold) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-[30px] font-extrabold text-[#0F172A] tracking-tight leading-tight">
            칸반 보드
          </h2>
          <p className="text-sm sm:text-[15px] font-medium text-[#64748B] mt-1">
            작업을 체계적으로 관리하고, 팀의 진행 상황을 한눈에 확인하세요.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-white border border-[#CBD5E1] rounded-xl p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewType('BOARD')}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                viewType === 'BOARD'
                  ? 'bg-[#EEF2FF] text-[#4F46E5]'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              보드 뷰
            </button>
            <button
              type="button"
              onClick={() => setViewType('LIST')}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                viewType === 'LIST'
                  ? 'bg-[#EEF2FF] text-[#4F46E5]'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              리스트 뷰
            </button>
          </div>

          <button
            type="button"
            onClick={() => setOnlyReviewFilter((prev) => !prev)}
            className={`h-10 px-4 rounded-xl border text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              onlyReviewFilter
                ? 'bg-[#FEF3C7] border-[#F59E0B] text-[#B45309]'
                : 'bg-white border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC]'
            }`}
          >
            {onlyReviewFilter ? '승인 대기만 보는 중' : '필터'}
          </button>

          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="h-10 px-5 rounded-xl bg-peri-500 hover:bg-peri-600 text-white text-xs sm:text-sm font-bold shadow-peri-glow press-scale cursor-pointer"
            >
              + 작업 추가
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Layout: Kanban Columns + Right 07. 작업 승인 Panel */}
      <div className="grid lg:grid-cols-12 gap-5 items-start">
        <div className={selectedTask ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'}>
          {viewType === 'BOARD' ? (
            <div
              className={`grid grid-cols-1 md:grid-cols-2 ${
                selectedTask ? 'xl:grid-cols-3' : 'xl:grid-cols-4'
              } gap-4 items-start`}
            >
              {COLUMNS.map((col) => {
                const colTasks = filteredTasks.filter((t) => t.status === col.id);

                return (
                  <div
                    key={col.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggedTaskId && !isReadOnly) {
                        if (col.id === 'APPROVAL_PENDING') {
                          requestTaskCompletion(
                            draggedTaskId,
                            '구현 및 자체 검증을 마쳐 작업 승인을 요청합니다.'
                          );
                          setSelectedTaskId(draggedTaskId);
                        } else {
                          moveKanbanTaskStatus(draggedTaskId, col.id);
                        }
                        setDraggedTaskId(null);
                      }
                    }}
                    className="bg-[#F1F5F9] rounded-2xl p-3.5 space-y-3.5 min-h-[420px] border border-[#E2E8F0]"
                  >
                    {/* Column Header Pill (06. 칸반 보드) */}
                    <div
                      className={`${col.headerBg} ${col.headerText} rounded-xl px-4 py-2.5 flex items-center justify-between shadow-2xs`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold">{col.title}</span>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-xs font-extrabold tabular-nums ${col.countBg}`}
                        >
                          {colTasks.length}
                        </span>
                      </div>
                      <span className="text-sm font-bold opacity-70">›</span>
                    </div>

                    {/* Task Cards */}
                    <div className="space-y-3">
                      {colTasks.map((task, idx) => {
                        const issueCode = ISSUE_CODES[task.id] || `#FE-${10 + idx}`;
                        const isSelected = selectedTask?.id === task.id;
                        const tagLabel = task.tags[0] || '프론트엔드';
                        const tagTone =
                          tagLabel.includes('백엔드') || tagLabel.includes('보안')
                            ? 'bg-[#EEF2FF] text-[#4F46E5]'
                            : tagLabel.includes('문서') || tagLabel.includes('기획')
                            ? 'bg-[#FEF3C7] text-[#D97706]'
                            : tagLabel.includes('디자인')
                            ? 'bg-[#FCE7F3] text-[#DB2777]'
                            : 'bg-[#E0F2FE] text-[#0284C7]';

                        return (
                          <div
                            key={task.id}
                            draggable={!isReadOnly}
                            onDragStart={() => setDraggedTaskId(task.id)}
                            onClick={() => {
                              setSelectedTaskId(task.id);
                              setSearchParams({ task: task.id });
                            }}
                            className={`bg-white rounded-2xl p-4 sm:p-5 shadow-craft-sm border transition-all cursor-pointer space-y-3.5 ${
                              isSelected
                                ? 'border-peri-500 ring-2 ring-peri-500/20'
                                : 'border-[#E2E8F0] hover:border-peri-400'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-mono font-bold text-[#64748B]">
                              <span>{issueCode}</span>
                              {task.status === 'APPROVAL_PENDING' && (
                                <span className="font-sans font-extrabold text-[#D97706]">
                                  승인 대기
                                </span>
                              )}
                            </div>

                            <h3 className="text-[15px] sm:text-base font-extrabold text-[#0F172A] leading-snug">
                              {task.title}
                            </h3>

                            <div className="flex items-center justify-between pt-1">
                              <span
                                className={`px-3 py-1 rounded-lg text-xs font-extrabold ${tagTone}`}
                              >
                                {tagLabel}
                              </span>

                              <div className="flex items-center -space-x-1.5">
                                <MemberAvatar name={task.assigneeName} size="sm" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] divide-y divide-[#F1F5F9] shadow-craft-sm overflow-hidden">
              {filteredTasks.map((task, idx) => (
                <div
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className="p-4 sm:px-6 hover:bg-[#F8FAFC] transition-colors flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="text-xs font-mono font-bold text-[#64748B] shrink-0">
                      {ISSUE_CODES[task.id] || `#FE-${10 + idx}`}
                    </span>
                    <span className="text-[15px] font-extrabold text-[#0F172A] truncate">
                      {task.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-bold text-[#64748B]">{task.status}</span>
                    <MemberAvatar name={task.assigneeName} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Right Panel: "07. 작업 승인" (Exact Match to Reference Bottom-Right) */}
        {selectedTask && (
          <aside
            aria-label="작업 승인 패널"
            className="lg:col-span-5 xl:col-span-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-craft-md p-6 space-y-5 lg:sticky lg:top-24"
          >
            {/* Top Bar: ← 작업 승인 + 승인 대기 pill */}
            <div className="flex items-center justify-between pb-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedTaskId(null);
                  setSearchParams({});
                }}
                className="inline-flex items-center gap-2 text-base font-extrabold text-[#0F172A] hover:text-peri-600 cursor-pointer"
              >
                <span>←</span>
                <span>작업 승인</span>
              </button>

              <span
                className={`px-3 py-1 rounded-lg text-xs font-extrabold ${
                  selectedTask.status === 'DONE'
                    ? 'bg-[#DCFCE7] text-[#059669]'
                    : 'bg-[#EEF2FF] text-[#4F46E5]'
                }`}
              >
                {selectedTask.status === 'DONE'
                  ? '승인 완료'
                  : selectedTask.status === 'APPROVAL_PENDING'
                  ? '승인 대기'
                  : selectedTask.status}
              </span>
            </div>

            {/* Issue ID + H3 Title (24px Bold) + Author Meta */}
            <div className="space-y-2">
              <div className="text-xs font-mono font-bold text-[#64748B]">
                {ISSUE_CODES[selectedTask.id] || '#FE-7'}
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] leading-snug tracking-tight">
                {selectedTask.title}
              </h3>
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[#64748B] pt-0.5">
                <MemberAvatar name={selectedTask.assigneeName} size="xs" />
                <span className="font-bold text-[#334155]">{selectedTask.assigneeName}</span>
                <span>·</span>
                <span className="tabular-nums">2026.10.13 14:20</span>
              </div>
            </div>

            {/* Underline 3-Tab Bar: 설명 | 변경사항 | 코멘트 3 */}
            <div className="flex items-center gap-6 border-b border-[#E2E8F0] text-sm font-bold">
              <button
                type="button"
                onClick={() => setInspectorTab('DESC')}
                className={`pb-3 border-b-2 transition-colors cursor-pointer ${
                  inspectorTab === 'DESC'
                    ? 'border-peri-500 text-peri-600 font-extrabold'
                    : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                설명
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('CHANGES')}
                className={`pb-3 border-b-2 transition-colors cursor-pointer ${
                  inspectorTab === 'CHANGES'
                    ? 'border-peri-500 text-peri-600 font-extrabold'
                    : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                변경사항
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('COMMENTS')}
                className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  inspectorTab === 'COMMENTS'
                    ? 'border-peri-500 text-peri-600 font-extrabold'
                    : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <span>코멘트</span>
                <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#334155] text-xs font-extrabold tabular-nums">
                  {selectedTask.comments.length || 3}
                </span>
              </button>
            </div>

            {/* Tab Body */}
            {inspectorTab === 'DESC' && (
              <div className="space-y-5">
                <p className="text-sm sm:text-[15px] font-medium text-[#334155] leading-relaxed">
                  {selectedTask.completionRequestMessage || selectedTask.description}
                </p>

                {/* 변경 파일 (3) Box (Matches 07. 작업 승인) */}
                <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 space-y-3">
                  <div className="text-sm font-extrabold text-[#0F172A]">
                    변경 파일 ({CHANGED_FILES_MOCK.length})
                  </div>
                  <div className="space-y-2.5">
                    {CHANGED_FILES_MOCK.map((file) => (
                      <div
                        key={file.path}
                        className="flex items-center justify-between gap-2 text-xs sm:text-sm font-mono"
                      >
                        <span className="text-[#334155] font-medium truncate">{file.path}</span>
                        <div className="flex items-center gap-2 shrink-0 tabular-nums font-extrabold">
                          <span className="text-[#10B981]">+{file.added}</span>
                          <span className="text-[#EF4444]">-{file.removed}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {inspectorTab === 'CHANGES' && (
              <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 space-y-2.5">
                <div className="text-sm font-extrabold text-[#0F172A]">
                  커밋 및 변경 파일 ({CHANGED_FILES_MOCK.length})
                </div>
                {CHANGED_FILES_MOCK.map((file) => (
                  <div
                    key={file.path}
                    className="py-2 border-b border-[#E2E8F0] last:border-none flex items-center justify-between text-xs sm:text-sm font-mono"
                  >
                    <span className="text-[#334155] font-medium truncate">{file.path}</span>
                    <span className="text-[#10B981] font-extrabold">+{file.added}</span>
                  </div>
                ))}
              </div>
            )}

            {inspectorTab === 'COMMENTS' && (
              <div className="space-y-3">
                <div className="space-y-2.5 max-h-48 overflow-y-auto">
                  {selectedTask.comments.length === 0 ? (
                    <p className="text-xs font-medium text-[#64748B] py-2">
                      등록된 코멘트가 없습니다.
                    </p>
                  ) : (
                    selectedTask.comments.map((c) => (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm space-y-1"
                      >
                        <div className="flex justify-between font-bold text-[#0F172A]">
                          <span>{c.authorName}</span>
                          <span className="text-xs text-[#64748B] font-medium">{c.createdAt}</span>
                        </div>
                        <p className="text-[#334155] font-medium">{c.content}</p>
                      </div>
                    ))
                  )}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!commentInput.trim()) return;
                    addKanbanComment(selectedTask.id, commentInput);
                    setCommentInput('');
                  }}
                  className="flex gap-2"
                >
                  <Input
                    name="commentInput"
                    placeholder="코멘트 작성..."
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                  />
                  <Button type="submit" variant="secondary" size="md">
                    등록
                  </Button>
                </form>
              </div>
            )}

            {/* Bottom Action Buttons: [반려] (#FEE2E2 / #EF4444) + [승인] (#6667AB Solid) */}
            {!isReadOnly && (
              <div className="pt-2 space-y-2.5">
                {rejectReasonOpen && (
                  <div className="pb-1">
                    <Input
                      name="rejectReason"
                      placeholder="반려 사유를 입력해 주세요..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!rejectReasonOpen) {
                        setRejectReasonOpen(true);
                        return;
                      }
                      approveOrRejectTask(
                        selectedTask.id,
                        false,
                        rejectReason || '보완 사항 반영 후 다시 요청해 주세요.',
                        isManagerOrOwner ? 'MANAGER' : 'LEADER'
                      );
                      setRejectReasonOpen(false);
                      setRejectReason('');
                    }}
                    className="h-12 rounded-xl bg-[#FEE2E2] hover:bg-[#FECACA] text-[#EF4444] text-base font-extrabold transition-colors press-scale cursor-pointer"
                  >
                    반려
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      approveOrRejectTask(
                        selectedTask.id,
                        true,
                        '변경 파일 및 요구사항 검증 후 승인 완료했습니다.',
                        isManagerOrOwner ? 'MANAGER' : 'LEADER'
                      );
                      setRejectReasonOpen(false);
                    }}
                    className="h-12 rounded-xl bg-peri-500 hover:bg-peri-600 text-white text-base font-extrabold shadow-peri-glow transition-colors press-scale cursor-pointer"
                  >
                    승인
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Create Task Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="새 작업 추가"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              취소
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateTask}>
              작업 추가
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Input
            label="작업 제목"
            name="newTitle"
            requiredMark
            placeholder="예: 마이페이지 구현"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <TextArea
            label="설명"
            name="newDesc"
            placeholder="구현 내용 및 완료 기준을 입력하세요."
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
                담당자
              </label>
              <select
                value={newAssigneeId}
                onChange={(e) => setNewAssigneeId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-[#CBD5E1] bg-white text-sm font-bold text-[#0F172A]"
              >
                {assignableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
                영역 태그
              </label>
              <select
                value={newDomainTag}
                onChange={(e) => setNewDomainTag(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-[#CBD5E1] bg-white text-sm font-bold text-[#0F172A]"
              >
                <option value="프론트엔드">프론트엔드</option>
                <option value="백엔드">백엔드</option>
                <option value="웹">웹</option>
                <option value="디자인">디자인</option>
                <option value="문서">문서</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TeamKanbanBoard;
