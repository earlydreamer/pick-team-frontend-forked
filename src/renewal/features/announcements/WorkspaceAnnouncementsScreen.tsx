import React, { useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { isManager } from '@/renewal/domain/workspace';
import {
  useCreateWorkspaceAnnouncement,
  useDeleteWorkspaceAnnouncement,
  useUpdateWorkspaceAnnouncement,
  useWorkspace,
  useWorkspaceAnnouncements,
} from '@/renewal/data/queries';
import { AnnouncementBoard } from './AnnouncementBoard';

/**
 * 워크스페이스 공지(02 §2.3 내비 "공지"). 멤버 모두 읽고 개설자·매니저가 쓴다. 올리면 멤버 모두에게 알림이 간다(16 §5.4).
 * ?id=로 들어오면 그 공지를 강조하고(알림·홈 최근 공지), ?new=1이면 작성 대화상자를 연다(대시보드).
 */
export const WorkspaceAnnouncementsScreen: React.FC = () => {
  const { wsId = '' } = useParams<{ wsId: string }>();
  const [params, setParams] = useSearchParams();
  const workspace = useWorkspace(wsId);
  const announcements = useWorkspaceAnnouncements(wsId);
  const create = useCreateWorkspaceAnnouncement(wsId);
  const update = useUpdateWorkspaceAnnouncement(wsId);
  const remove = useDeleteWorkspaceAnnouncement(wsId);
  const clearNew = useCallback(() => setParams((prev) => {
    const next = new URLSearchParams(prev);
    next.delete('new');
    return next;
  }, { replace: true }), [setParams]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
      <AnnouncementBoard
        heading={
          <div>
            <h1 className="text-2xl font-bold leading-8">공지</h1>
            <p className="text-sm text-muted">{workspace.data ? `${workspace.data.name} 전체 공지예요. 팀 공지는 각 팀 스페이스에 있어요.` : ' '}</p>
          </div>
        }
        query={announcements}
        canWrite={isManager(workspace.data?.myRole)}
        writeDescription="워크스페이스 멤버 모두에게 보이고 알림이 가요. 워크스페이스 홈의 최근 공지에도 실려요."
        emptyDescription="일정 변경이나 안내처럼 모두가 알아야 할 내용을 올려 보세요."
        create={(input) => create.mutateAsync(input)}
        update={(announcementId, announcement) => update.mutateAsync({ announcementId, announcement })}
        remove={(announcementId) => remove.mutateAsync(announcementId)}
        pending={create.isPending || update.isPending}
        removing={remove.isPending}
        highlightId={params.get('id')}
        openEditor={params.get('new') === '1'}
        onEditorOpened={clearNew}
      />
    </div>
  );
};
