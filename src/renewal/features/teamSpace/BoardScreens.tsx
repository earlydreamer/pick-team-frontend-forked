import React, { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ChatBubbleLeftIcon, MegaphoneIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { relativeTime } from '@/renewal/domain/announcement';
import {
  ANNOUNCEMENT_LIMITS,
  POST_LIMITS,
  canEditAuthored,
  validateAnnouncement,
  validatePost,
  type PostInput,
  type TeamAnnouncement,
} from '@/renewal/domain/collab';
import {
  useAddPostComment,
  useCreateAnnouncement,
  useCreatePost,
  useDeleteAnnouncement,
  useDeletePost,
  useDeletePostComment,
  useMe,
  usePosts,
  useTeamAnnouncements,
  useUpdateAnnouncement,
  useUpdatePost,
} from '@/renewal/data/queries';
import { Avatar, Button, EmptyState, ErrorState, LoadingState, Modal, fieldClassName, toast } from '@/renewal/ui';
import { NotFoundScreen } from '@/renewal/screens/system';
import { ConfirmModal } from '@/renewal/features/teamBuilding/shared';
import { useTeamSpaceContext } from './TeamSpaceLayout';
import { errorMessage } from './TaskModals';

const attempt = async (work: () => Promise<unknown>, done?: string) => {
  try {
    await work();
    if (done) toast.success(done);
    return true;
  } catch (error) {
    toast.error(errorMessage(error));
    return false;
  }
};

/** 제목·본문 편집 대화상자. 게시글과 팀 공지가 함께 쓴다. */
const TextEditorModal: React.FC<{
  open: boolean;
  heading: string;
  initial?: PostInput;
  limits: { titleMax: number; contentMax: number };
  validate: (input: PostInput) => Partial<Record<keyof PostInput, string>>;
  submitLabel: string;
  description?: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: PostInput) => Promise<boolean>;
}> = ({ open, heading, initial, limits, validate, submitLabel, description, pending, onClose, onSubmit }) => {
  const id = useId();
  const [value, setValue] = useState<PostInput>({ title: '', content: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof PostInput, string>>>({});
  useEffect(() => {
    if (!open) return;
    setValue(initial ?? { title: '', content: '' });
    setErrors({});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async () => {
    const found = validate(value);
    setErrors(found);
    if (found.title) return document.getElementById(`${id}-title`)?.focus();
    if (found.content) return document.getElementById(`${id}-content`)?.focus();
    if (await onSubmit(value)) onClose();
  };
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      preventClose={pending}
      title={heading}
      description={description}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button onClick={submit} loading={pending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor={`${id}-title`} className="mb-1.5 block text-sm font-semibold">
            제목
          </label>
          <input
            id={`${id}-title`}
            value={value.title}
            maxLength={limits.titleMax}
            onChange={(event) => setValue((prev) => ({ ...prev, title: event.target.value }))}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? `${id}-title-error` : undefined}
            className={fieldClassName(Boolean(errors.title))}
          />
          {errors.title && (
            <p id={`${id}-title-error`} className="mt-1.5 text-sm text-danger">
              {errors.title}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${id}-content`} className="mb-1.5 block text-sm font-semibold">
            내용
          </label>
          <textarea
            id={`${id}-content`}
            rows={8}
            value={value.content}
            maxLength={limits.contentMax}
            onChange={(event) => setValue((prev) => ({ ...prev, content: event.target.value }))}
            aria-invalid={errors.content ? true : undefined}
            aria-describedby={`${id}-content-count${errors.content ? ` ${id}-content-error` : ''}`}
            className={fieldClassName(Boolean(errors.content), 'leading-6')}
          />
          <div className="mt-1 flex justify-between gap-2 text-xs">
            <span id={`${id}-content-error`} className="text-sm text-danger">
              {errors.content}
            </span>
            <span id={`${id}-content-count`} className="text-muted tabular-nums">
              {value.content.length}/{limits.contentMax}자
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
};

/**
 * SCR-TM-04 게시판 목록(14 §4.4). 제목, 작성자, 날짜, 댓글 수를 보여 주고 글은 상세 주소로 연다.
 * 첨부 파일은 목업에서 다루지 않는다(백엔드 PostAttachController로 연결 예정).
 */
export const BoardScreen: React.FC = () => {
  const { workspaceId, teamId, space, base } = useTeamSpaceContext();
  const navigate = useNavigate();
  const posts = usePosts(workspaceId, teamId);
  const create = useCreatePost(workspaceId, teamId);
  const [writing, setWriting] = useState(false);
  const nameOf = (id: string) => space.members.find((member) => member.account.id === id)?.account.name ?? '이전 팀원';

  if (posts.isLoading) return <LoadingState className="min-h-[40vh]" label="게시판을 불러오는 중이에요" />;
  if (posts.isError || !posts.data) {
    return <ErrorState className="min-h-[40vh]" title="게시판을 불러오지 못했어요" description="네트워크 상태를 확인한 뒤 다시 시도해 주세요." action={<Button onClick={() => posts.refetch()}>다시 시도</Button>} />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">게시판</h2>
        <Button leftIcon={<PencilSquareIcon className="h-5 w-5" />} onClick={() => setWriting(true)}>
          글 작성
        </Button>
      </div>
      {posts.data.length === 0 ? (
        <div className="rounded-card border border-dashed border-outline-soft bg-surface">
          <EmptyState compact title="아직 글이 없어요" description="회의록이나 참고 자료로 팀의 첫 글을 남겨 보세요." />
        </div>
      ) : (
        <ul className="divide-y divide-outline-soft overflow-hidden rounded-card border border-outline-soft bg-surface">
          {posts.data.map((post) => (
            <li key={post.id}>
              <Link to={`${base}/board/${post.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-peri-50">
                <span className="min-w-0 flex-1 font-semibold">{post.title}</span>
                <span className="flex items-center gap-3 text-sm text-muted">
                  <span>{nameOf(post.authorId)}</span>
                  <span>{relativeTime(post.createdAt)}</span>
                  <span className="inline-flex items-center gap-0.5">
                    <ChatBubbleLeftIcon className="h-4 w-4" aria-hidden="true" />
                    <span className="tabular-nums">{post.comments.length}</span>
                    <span className="sr-only">개 댓글</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <TextEditorModal
        open={writing}
        heading="글 작성"
        limits={POST_LIMITS}
        validate={validatePost}
        submitLabel="올리기"
        pending={create.isPending}
        onClose={() => setWriting(false)}
        onSubmit={async (input) => {
          try {
            const result = await create.mutateAsync(input);
            toast.success('글을 올렸어요.');
            navigate(`${base}/board/${result.postId}`);
            return true;
          } catch (error) {
            toast.error(errorMessage(error));
            return false;
          }
        }}
      />
    </div>
  );
};

/** 게시글 상세: 본문, 수정·삭제(쓴 사람과 팀장), 댓글. */
export const PostDetailScreen: React.FC = () => {
  const { postId = '' } = useParams<{ postId: string }>();
  const { workspaceId, teamId, space, base } = useTeamSpaceContext();
  const navigate = useNavigate();
  const me = useMe();
  const posts = usePosts(workspaceId, teamId);
  const update = useUpdatePost(workspaceId, teamId);
  const remove = useDeletePost(workspaceId, teamId);
  const addComment = useAddPostComment(workspaceId, teamId);
  const deleteComment = useDeletePostComment(workspaceId, teamId);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [comment, setComment] = useState('');

  if (posts.isLoading) return <LoadingState className="min-h-[40vh]" label="글을 불러오는 중이에요" />;
  if (posts.isError || !posts.data) {
    return <ErrorState className="min-h-[40vh]" title="글을 불러오지 못했어요" action={<Button onClick={() => posts.refetch()}>다시 시도</Button>} />;
  }
  const post = posts.data.find((item) => item.id === postId);
  if (!post) return <NotFoundScreen />;

  const viewer = { accountId: me.data?.id ?? '', isLeader: space.access.isLeader };
  const author = space.members.find((member) => member.account.id === post.authorId)?.account;
  const nameOf = (id: string) => space.members.find((member) => member.account.id === id)?.account.name ?? '이전 팀원';

  return (
    <div className="max-w-3xl">
      <Link to={`${base}/board`} className="mb-3 inline-flex min-h-touch items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
        게시판
      </Link>
      <article className="rounded-card border border-outline-soft bg-surface p-5 sm:p-6">
        <header className="flex flex-wrap items-start gap-3 border-b border-outline-soft pb-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold leading-7">{post.title}</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted">
              <Avatar name={author?.name ?? '?'} imageUrl={author?.profileImageUrl} size="xs" />
              {nameOf(post.authorId)} · {relativeTime(post.createdAt)}
              {post.updatedAt !== post.createdAt && ' · 수정됨'}
            </p>
          </div>
          {canEditAuthored(post.authorId, viewer) && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                수정
              </Button>
              <Button size="sm" variant="danger-ghost" leftIcon={<TrashIcon className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
                삭제
              </Button>
            </div>
          )}
        </header>
        <p className="mt-4 whitespace-pre-line break-words text-[0.9375rem] leading-7">{post.content}</p>
      </article>

      <section aria-labelledby="post-comments" className="mt-5">
        <h3 id="post-comments" className="mb-2 text-sm font-semibold">
          댓글 <span className="text-muted tabular-nums">{post.comments.length}</span>
        </h3>
        {post.comments.length > 0 && (
          <ul className="mb-3 space-y-2">
            {post.comments.map((item) => (
              <li key={item.id} className="flex items-start gap-2 rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-outline-soft">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-ink">{nameOf(item.authorId)}</span> · {relativeTime(item.createdAt)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line break-words">{item.content}</p>
                </div>
                {canEditAuthored(item.authorId, viewer) && (
                  <button
                    type="button"
                    aria-label={`${nameOf(item.authorId)}의 댓글 삭제`}
                    onClick={() => attempt(() => deleteComment.mutateAsync({ postId: post.id, commentId: item.id }), '댓글을 지웠어요.')}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-container"
                  >
                    <TrashIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await attempt(() => addComment.mutateAsync({ postId: post.id, content: comment }))) setComment('');
          }}
        >
          <label htmlFor="post-comment" className="sr-only">
            댓글 쓰기
          </label>
          <input id="post-comment" value={comment} maxLength={POST_LIMITS.commentMax} onChange={(event) => setComment(event.target.value)} placeholder="댓글을 남겨 주세요" className={fieldClassName(false, 'flex-1')} />
          <Button type="submit" variant="outline" disabled={!comment.trim()} loading={addComment.isPending}>
            등록
          </Button>
        </form>
      </section>

      <TextEditorModal
        open={editing}
        heading="글 수정"
        initial={{ title: post.title, content: post.content }}
        limits={POST_LIMITS}
        validate={validatePost}
        submitLabel="저장"
        pending={update.isPending}
        onClose={() => setEditing(false)}
        onSubmit={(input) => attempt(() => update.mutateAsync({ postId: post.id, post: input }), '글을 고쳤어요.')}
      />
      <ConfirmModal
        open={confirmDelete}
        title="글 삭제"
        description="글을 지우면 댓글도 함께 지워지고 되돌릴 수 없어요."
        confirmLabel="삭제하기"
        pending={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (await attempt(() => remove.mutateAsync(post.id), '글을 지웠어요.')) navigate(`${base}/board`, { replace: true });
        }}
      />
    </div>
  );
};

/**
 * SCR-TM-05 팀 공지(14 §4.5). 공지는 팀장만 쓰고 고친다. 팀원은 읽기만 한다.
 * 공지 알림(16 연동)은 알림 센터 단계에서 붙인다.
 */
export const AnnouncementsScreen: React.FC = () => {
  const { workspaceId, teamId, space } = useTeamSpaceContext();
  const announcements = useTeamAnnouncements(workspaceId, teamId);
  const create = useCreateAnnouncement(workspaceId, teamId);
  const update = useUpdateAnnouncement(workspaceId, teamId);
  const remove = useDeleteAnnouncement(workspaceId, teamId);
  const [editing, setEditing] = useState<TeamAnnouncement | 'new' | null>(null);
  const [deleting, setDeleting] = useState<TeamAnnouncement | null>(null);
  const leader = space.access.isLeader;

  if (announcements.isLoading) return <LoadingState className="min-h-[40vh]" label="공지를 불러오는 중이에요" />;
  if (announcements.isError || !announcements.data) {
    return <ErrorState className="min-h-[40vh]" title="공지를 불러오지 못했어요" action={<Button onClick={() => announcements.refetch()}>다시 시도</Button>} />;
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">팀 공지</h2>
        {leader && (
          <Button leftIcon={<PlusIcon className="h-5 w-5" />} onClick={() => setEditing('new')}>
            공지 작성
          </Button>
        )}
      </div>
      {announcements.data.length === 0 ? (
        <div className="rounded-card border border-dashed border-outline-soft bg-surface">
          <EmptyState compact icon={<MegaphoneIcon className="h-5 w-5" />} title="등록된 공지가 없어요" description={leader ? '팀 전체가 알아야 할 내용을 공지로 남겨 보세요.' : undefined} />
        </div>
      ) : (
        <ul className="space-y-3">
          {announcements.data.map((item) => (
            <li key={item.id}>
              <article className="rounded-card border border-outline-soft bg-surface p-5">
                <header className="flex flex-wrap items-start gap-2">
                  <MegaphoneIcon className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold leading-6">{item.title}</h3>
                    <p className="text-sm text-muted">
                      {item.authorName} · {relativeTime(item.createdAt)}
                    </p>
                  </div>
                  {leader && (
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
        description={editing === 'new' ? '공지는 팀원 모두에게 보이고 워크스페이스 홈의 최근 공지에도 실려요.' : undefined}
        pending={create.isPending || update.isPending}
        onClose={() => setEditing(null)}
        onSubmit={(input) =>
          editing === 'new'
            ? attempt(() => create.mutateAsync(input), '공지를 올렸어요.')
            : attempt(() => update.mutateAsync({ announcementId: (editing as TeamAnnouncement).id, announcement: input }), '공지를 고쳤어요.')
        }
      />
      <ConfirmModal
        open={deleting !== null}
        title="공지 삭제"
        description={`"${deleting?.title ?? ''}" 공지를 지우면 되돌릴 수 없어요.`}
        confirmLabel="삭제하기"
        pending={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting && (await attempt(() => remove.mutateAsync(deleting.id), '공지를 지웠어요.'))) setDeleting(null);
        }}
      />
    </div>
  );
};

