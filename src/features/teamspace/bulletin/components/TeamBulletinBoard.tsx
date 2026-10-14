import React, { useState } from 'react';
import { Card, Button, Badge, Modal, Input, TextArea } from '@/components/ui';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import { ReportModal } from '@/features/renewal/components/ReportModal';

interface BulletinPost {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  attachments: string[];
  comments: { id: string; authorName: string; content: string; createdAt: string }[];
}

const INITIAL_POSTS: BulletinPost[] = [
  {
    id: 'post-1',
    title: '백엔드·프론트엔드 공통 에러 코드(RFC 9457) 및 ApiResponse 규약 정리',
    content:
      'AnnouncementController까지 모두 ApiResponse<T>와 GlobalExceptionHandler로 통일했습니다. 첨부된 명세서 확인 부탁드려요!',
    authorId: '1',
    authorName: '박재현',
    createdAt: '오늘 11:20',
    attachments: ['api-contract-v2.pdf'],
    comments: [
      {
        id: 'bc-1',
        authorName: '김민지',
        content: '프론트엔드 apiClient 토스트 핸들러에 바로 반영했습니다!',
        createdAt: '오늘 11:45',
      },
    ],
  },
  {
    id: 'post-2',
    title: 'Pick Team 2.0 와이어프레임 & Very Peri 컬러 토큰 시안 공유',
    content:
      'WCAG 3.0 APCA 대비 기준을 통과한 Very Peri(#6667AB) 팔레트와 모바일 바텀 네비게이션 시안입니다.',
    authorId: '2',
    authorName: '김민지',
    createdAt: '어제',
    attachments: ['design-tokens-very-peri.fig'],
    comments: [],
  },
];

interface TeamBulletinBoardProps {
  teamId?: string;
  boardId?: number;
  workspaceId?: string;
  isReadOnly?: boolean;
}

export const TeamBulletinBoard: React.FC<TeamBulletinBoardProps> = ({
  workspaceId = 'ws-kosta-295',
  isReadOnly = false,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [posts, setPosts] = useState<BulletinPost[]>(INITIAL_POSTS);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [reportTarget, setReportTarget] = useState<BulletinPost | null>(null);

  const selectedPost = posts.find((p) => p.id === selectedPostId);

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    const newPost: BulletinPost = {
      id: `post-${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      authorId: String(currentUser?.id || '1'),
      authorName: currentUser?.name || '박재현',
      createdAt: '방금 전',
      attachments: attachmentName.trim() ? [attachmentName.trim()] : [],
      comments: [],
    };
    setPosts((prev) => [newPost, ...prev]);
    setTitle('');
    setContent('');
    setAttachmentName('');
    setCreateOpen(false);
    showToast({
      title: '게시글이 등록되었습니다',
      variant: 'success',
    });
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPost || !commentText.trim()) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === selectedPost.id
          ? {
              ...p,
              comments: [
                ...p.comments,
                {
                  id: `bc-${Date.now()}`,
                  authorName: currentUser?.name || '박재현',
                  content: commentText.trim(),
                  createdAt: '방금 전',
                },
              ],
            }
          : p
      )
    );
    setCommentText('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-ink-primary">
            팀 게시판 (SCR-TM-04)
          </h3>
          <p className="text-xs text-ink-tertiary">
            회의록, 산출물 파일 첨부, 기술 문서를 공유하고 댓글로 논의합니다.
          </p>
        </div>
        {!isReadOnly && (
          <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
            + 새 게시글 작성
          </Button>
        )}
      </div>

      {posts.length === 0 ? (
        <Card className="text-center py-12 space-y-2">
          <p className="text-sm font-bold text-ink-primary">
            아직 게시글이 없습니다. 팀의 첫 글을 작성해보세요! (14 §4.4)
          </p>
        </Card>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 divide-y divide-neutral-100 shadow-craft-sm overflow-hidden">
          {posts.map((post) => (
            <div
              key={post.id}
              onClick={() => setSelectedPostId(post.id)}
              className="p-4 sm:px-5 hover:bg-peri-50/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-ink-primary truncate">
                    {post.title}
                  </span>
                  {post.attachments.length > 0 && (
                    <Badge variant="peri" size="xs">
                      📎 첨부 {post.attachments.length}
                    </Badge>
                  )}
                  {post.comments.length > 0 && (
                    <Badge variant="neutral" size="xs">
                      💬 {post.comments.length}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-ink-secondary line-clamp-1">{post.content}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-ink-tertiary shrink-0">
                <span className="font-semibold text-ink-secondary">{post.authorName}</span>
                <span>·</span>
                <span className="tabular-nums">{post.createdAt}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post Detail Modal */}
      <Modal
        isOpen={!!selectedPost}
        onClose={() => setSelectedPostId(null)}
        title={selectedPost?.title || ''}
        subtitle={
          selectedPost ? `작성자: ${selectedPost.authorName} · ${selectedPost.createdAt}` : undefined
        }
        size="lg"
        footer={
          <div className="w-full flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (selectedPost) setReportTarget(selectedPost);
              }}
              className="text-xs font-semibold text-ink-tertiary hover:text-red-700 cursor-pointer"
            >
              🚨 게시글 신고
            </button>
            <Button variant="outline" size="sm" onClick={() => setSelectedPostId(null)}>
              닫기
            </Button>
          </div>
        }
      >
        {selectedPost && (
          <div className="space-y-4">
            <p className="text-sm text-ink-primary whitespace-pre-line leading-relaxed bg-surface-subtle p-4 rounded-xl border border-neutral-200">
              {selectedPost.content}
            </p>
            {selectedPost.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedPost.attachments.map((file) => (
                  <span
                    key={file}
                    className="px-3 py-1.5 rounded-xl bg-peri-50 border border-peri-200 text-xs font-bold text-peri-700"
                  >
                    📎 {file}
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-2.5 pt-3 border-t border-neutral-200">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-ink-tertiary">
                댓글 ({selectedPost.comments.length})
              </h4>
              {selectedPost.comments.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl bg-surface-subtle/60 border border-neutral-200 text-xs"
                >
                  <div className="flex justify-between font-bold text-ink-primary">
                    <span>{c.authorName}</span>
                    <span className="text-ink-tertiary font-normal">{c.createdAt}</span>
                  </div>
                  <p className="text-ink-secondary mt-1">{c.content}</p>
                </div>
              ))}
              {!isReadOnly && (
                <form onSubmit={handleAddComment} className="flex gap-2 pt-1">
                  <Input
                    name="commentText"
                    placeholder="댓글 입력..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <Button type="submit" variant="primary" size="sm">
                    댓글 등록
                  </Button>
                </form>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Create Post Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="새 게시글 작성"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              취소
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreatePost}>
              게시하기
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreatePost} className="space-y-4">
          <Input
            label="제목"
            name="title"
            requiredMark
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextArea
            label="내용"
            name="content"
            requiredMark
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Input
            label="첨부파일 이름 (선택)"
            name="attachmentName"
            placeholder="예: sprint1-retrospective.pdf"
            value={attachmentName}
            onChange={(e) => setAttachmentName(e.target.value)}
          />
        </form>
      </Modal>

      {reportTarget && (
        <ReportModal
          isOpen={!!reportTarget}
          onClose={() => setReportTarget(null)}
          workspaceId={workspaceId}
          targetType="POST"
          targetId={reportTarget.id}
          targetLabel={reportTarget.title}
          targetContentSnippet={reportTarget.content}
        />
      )}
    </div>
  );
};

export default TeamBulletinBoard;
