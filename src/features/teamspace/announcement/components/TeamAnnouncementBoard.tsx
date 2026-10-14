import React, { useState } from 'react';
import { Card, Button, Badge, Modal, Input, TextArea } from '@/components/ui';
import { useRenewal } from '@/features/renewal/context/RenewalContext';

interface TeamAnnouncementBoardProps {
  teamId?: string;
  workspaceId?: string;
  isTeamLeader?: boolean;
  isReadOnly?: boolean;
}

export const TeamAnnouncementBoard: React.FC<TeamAnnouncementBoardProps> = ({
  teamId = 'team-alpha',
  workspaceId = 'ws-kosta-295',
  isTeamLeader = true,
  isReadOnly = false,
}) => {
  const { getWorkspaceNotices, addNotice } = useRenewal();
  const notices = getWorkspaceNotices(workspaceId, teamId);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    addNotice(workspaceId, title.trim(), content.trim(), teamId, true);
    setTitle('');
    setContent('');
    setCreateOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-ink-primary">
            팀 공지사항 (SCR-TM-05)
          </h3>
          <p className="text-xs text-ink-tertiary">
            팀장이 등록한 공지는 팀원 전원에게 즉시 알림이 발송됩니다. (14 §4.5)
          </p>
        </div>
        {isTeamLeader && !isReadOnly && (
          <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
            📢 팀 공지 작성
          </Button>
        )}
      </div>

      {notices.length === 0 ? (
        <Card className="text-center py-10">
          <p className="text-sm text-ink-tertiary">등록된 공지가 없습니다.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <Card key={n.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={n.teamId ? 'peri' : 'admin'} size="xs">
                    {n.teamId ? '팀 공지' : '워크스페이스 전체 필독'}
                  </Badge>
                  <h4 className="text-sm sm:text-base font-extrabold text-ink-primary">
                    {n.title}
                  </h4>
                </div>
                <span className="text-xs text-ink-tertiary tabular-nums">
                  {n.authorName} · {n.createdAt}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-ink-secondary whitespace-pre-line leading-relaxed">
                {n.content}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="새 팀 공지 작성"
        subtitle="등록 시 팀원 전원에게 ANNOUNCEMENT_CREATED 알림이 발송됩니다."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              취소
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreate}>
              공지 등록
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="공지 제목"
            name="title"
            requiredMark
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextArea
            label="공지 내용"
            name="content"
            requiredMark
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
};

export default TeamAnnouncementBoard;
