import React, { useEffect, useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { MegaphoneIcon, PlusIcon } from '@heroicons/react/24/outline';
import { relativeTime } from '@/renewal/domain/announcement';
import { ANNOUNCEMENT_LIMITS, validateAnnouncement, type AnnouncementInput, type TeamAnnouncement } from '@/renewal/domain/collab';
import { Button, EmptyState, ErrorState, LoadingState, toast } from '@/renewal/ui';
import { ConfirmModal } from '@/renewal/features/teamBuilding/shared';
import { TextEditorModal } from '@/renewal/features/teamSpace/TextEditorModal';
import { errorMessage } from '@/renewal/features/teamSpace/TaskModals';

const attempt = async (work: () => Promise<unknown>, done: string) => {
  try {
    await work();
    toast.success(done);
    return true;
  } catch (error) {
    toast.error(errorMessage(error));
    return false;
  }
};

/**
 * 공지 목록과 작성·수정·삭제. 팀 공지(SCR-TM-05)와 워크스페이스 공지가 함께 쓴다.
 * highlightId가 있으면 그 공지로 스크롤하고 포커스를 옮겨 알림·홈에서 온 사람이 바로 찾게 한다.
 * openEditor가 참이면 처음 열 때 작성 대화상자를 연다(대시보드의 "공지 보내기").
 */
export const AnnouncementBoard: React.FC<{
  heading: React.ReactNode;
  query: UseQueryResult<TeamAnnouncement[]>;
  canWrite: boolean;
  writeDescription: string;
  emptyDescription?: string;
  create: (input: AnnouncementInput) => Promise<unknown>;
  update: (announcementId: string, input: AnnouncementInput) => Promise<unknown>;
  remove: (announcementId: string) => Promise<unknown>;
  pending: boolean;
  removing: boolean;
  highlightId?: string | null;
  openEditor?: boolean;
  onEditorOpened?: () => void;
}> = ({ heading, query, canWrite, writeDescription, emptyDescription, create, update, remove, pending, removing, highlightId, openEditor, onEditorOpened }) => {
  const [editing, setEditing] = useState<TeamAnnouncement | 'new' | null>(null);
  const [deleting, setDeleting] = useState<TeamAnnouncement | null>(null);

  useEffect(() => {
    if (openEditor && canWrite) {
      setEditing('new');
      onEditorOpened?.();
    }
  }, [openEditor, canWrite, onEditorOpened]);

  const found = Boolean(highlightId && query.data?.some((item) => item.id === highlightId));
  useEffect(() => {
    if (!found || !highlightId) return;
    const target = document.getElementById(`announcement-${highlightId}`);
    target?.scrollIntoView({ block: 'center' });
    target?.focus({ preventScroll: true });
  }, [found, highlightId]);

  if (query.isLoading) return <LoadingState className="min-h-[40vh]" label="공지를 불러오는 중이에요" />;
  if (query.isError || !query.data) {
    return <ErrorState className="min-h-[40vh]" title="공지를 불러오지 못했어요" action={<Button onClick={() => query.refetch()}>다시 시도</Button>} />;
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        {heading}
        {canWrite && (
          <Button leftIcon={<PlusIcon className="h-5 w-5" />} onClick={() => setEditing('new')}>
            공지 작성
          </Button>
        )}
      </div>
      {highlightId && !found && (
        <p role="status" className="mb-3 rounded-lg bg-surface-container px-3 py-2 text-sm text-muted">
          찾는 공지가 없어요. 지워졌을 수 있어요.
        </p>
      )}
      {query.data.length === 0 ? (
        <div className="rounded-card border border-dashed border-outline-soft bg-surface">
          <EmptyState compact icon={<MegaphoneIcon className="h-5 w-5" />} title="등록된 공지가 없어요" description={canWrite ? emptyDescription : undefined} />
        </div>
      ) : (
        <ul className="space-y-3">
          {query.data.map((item) => (
            <li key={item.id}>
              <article
                id={`announcement-${item.id}`}
                tabIndex={-1}
                aria-labelledby={`announcement-${item.id}-title`}
                className={`rounded-card border bg-surface p-5 focus:outline-none ${item.id === highlightId ? 'border-primary ring-2 ring-primary/40' : 'border-outline-soft'}`}
              >
                <header className="flex flex-wrap items-start gap-2">
                  <MegaphoneIcon className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <h3 id={`announcement-${item.id}-title`} className="text-base font-bold leading-6">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted">
                      {item.authorName} · <time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
                      {item.updatedAt && ' · 수정됨'}
                    </p>
                  </div>
                  {canWrite && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(item)} aria-label={`${item.title} 수정`}>
                        수정
                      </Button>
                      <Button size="sm" variant="danger-ghost" onClick={() => setDeleting(item)} aria-label={`${item.title} 삭제`}>
                        삭제
                      </Button>
                    </div>
                  )}
                </header>
                {item.content && <p className="mt-3 whitespace-pre-line break-words text-[0.9375rem] leading-7">{item.content}</p>}
              </article>
            </li>
          ))}
        </ul>
      )}
      <TextEditorModal
        open={editing !== null}
        heading={editing === 'new' ? '공지 작성' : '공지 수정'}
        initial={editing && editing !== 'new' ? { title: editing.title, content: editing.content } : undefined}
        limits={ANNOUNCEMENT_LIMITS}
        validate={validateAnnouncement}
        submitLabel={editing === 'new' ? '올리기' : '저장'}
        description={editing === 'new' ? writeDescription : undefined}
        pending={pending}
        onClose={() => setEditing(null)}
        onSubmit={(input) =>
          editing === 'new' ? attempt(() => create(input), '공지를 올렸어요.') : attempt(() => update((editing as TeamAnnouncement).id, input), '공지를 고쳤어요.')
        }
      />
      <ConfirmModal
        open={deleting !== null}
        title="공지 삭제"
        description={`"${deleting?.title ?? ''}" 공지를 지우면 되돌릴 수 없어요.`}
        confirmLabel="삭제하기"
        tone="danger"
        pending={removing}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting && (await attempt(() => remove(deleting.id), '공지를 지웠어요.'))) setDeleting(null);
        }}
      />
    </>
  );
};
