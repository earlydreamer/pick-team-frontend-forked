import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellSlashIcon } from '@heroicons/react/24/outline';
import { CATEGORY_LABEL, visibleCategories, type NotificationCategory, type NotificationSettings } from '@/renewal/domain/notification';
import { isManager } from '@/renewal/domain/workspace';
import type { ChatRoomSummary } from '@/renewal/domain/chat';
import { useChatRoomsOf, useMyData, useMyWorkspaces, useNotificationSettings, useSetMuted, useUpdateNotificationSettings } from '@/renewal/data/queries';
import { Avatar, Button, ErrorState, LoadingState, Switch, toast } from '@/renewal/ui';
import { errorMessage } from '@/renewal/features/teamSpace/TaskModals';
import { AccountInfoSection, DeleteAccountSection, PasswordSection } from './AccountSecurity';

const CATEGORY_HINT: Partial<Record<NotificationCategory, string>> = {
  TEAM_BUILDING: '지원·스카우트, 모집 시작과 결과, 카드 작성 요청',
  KANBAN: '태스크 배정, 완료 승인 요청과 결과',
  SCHEDULE: '팀 일정 등록',
  ANNOUNCEMENT: '공지 등록, 내 글에 달린 댓글',
  CHAT: '음소거하지 않은 방의 새 메시지',
  MEMBERSHIP: '새 멤버 합류, 팀장 위임',
};

/** 수신 설정(16 §4.3). 바꾸면 바로 저장하고 실패하면 되돌린다. */
const NotificationSettingsSection: React.FC<{ manager: boolean }> = ({ manager }) => {
  const settings = useNotificationSettings();
  const update = useUpdateNotificationSettings();
  const [draft, setDraft] = useState<NotificationSettings>();

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  if (settings.isLoading || (!draft && !settings.isError)) return <LoadingState compact label="수신 설정을 불러오는 중이에요" />;
  if (settings.isError || !draft) {
    return <ErrorState compact title="수신 설정을 불러오지 못했어요" description="잠시 뒤 다시 시도해 주세요." action={<Button size="sm" onClick={() => settings.refetch()}>다시 시도</Button>} />;
  }

  const save = async (next: NotificationSettings) => {
    const before = draft;
    setDraft(next);
    try {
      await update.mutateAsync(next);
    } catch (reason) {
      setDraft(before);
      toast.error(errorMessage(reason));
    }
  };

  return (
    <div>
      <Switch label="인앱 알림" description="끄면 벨 배지와 알림 센터에 새 알림이 쌓이지 않아요." checked={draft.enabled} onChange={(enabled) => save({ ...draft, enabled })} />
      <h3 className="mb-1 mt-4 text-sm font-semibold text-muted">계열별 알림</h3>
      <p className="mb-2 text-sm text-muted">끈 계열의 알림은 기록하지 않아서 나중에 다시 켜도 그동안의 알림은 볼 수 없어요.</p>
      <div className="divide-y divide-outline-soft">
        {visibleCategories(manager).map((category) => (
          <Switch
            key={category}
            label={CATEGORY_LABEL[category]}
            description={CATEGORY_HINT[category]}
            checked={draft.categories[category]}
            disabled={!draft.enabled}
            onChange={(on) => save({ ...draft, categories: { ...draft.categories, [category]: on } })}
          />
        ))}
      </div>
      {!draft.enabled && <p className="mt-2 text-sm text-muted">인앱 알림을 켜야 계열별로 고를 수 있어요.</p>}
    </div>
  );
};

const MutedRoomRow: React.FC<{ workspaceId: string; workspaceName?: string; item: ChatRoomSummary }> = ({ workspaceId, workspaceName, item }) => {
  const setMuted = useSetMuted(workspaceId, item.room.id);
  return (
    <li className="flex items-center gap-3 py-2">
      <Avatar name={item.title} size="sm" shape={item.room.kind === 'DM' ? 'circle' : 'rounded'} />
      <span className="min-w-0 flex-1">
        <Link to={`/ws/${workspaceId}/chat/${item.room.id}`} className="block truncate text-sm font-semibold hover:underline">
          {item.title}
        </Link>
        {workspaceName && <span className="block truncate text-xs text-muted">{workspaceName}</span>}
      </span>
      <Button
        variant="outline"
        size="sm"
        loading={setMuted.isPending}
        aria-label={`${item.title} 음소거 해제`}
        onClick={async () => {
          try {
            await setMuted.mutateAsync(false);
            toast.success(`${item.title} 알림을 다시 켰어요.`);
          } catch (reason) {
            toast.error(errorMessage(reason));
          }
        }}
      >
        음소거 해제
      </Button>
    </li>
  );
};

/** 음소거한 채팅방(16 §4.3, 15 연동). 가입한 모든 워크스페이스에서 모은다. */
const MutedRoomsSection: React.FC<{ workspaceIds: string[]; nameOf: (id: string) => string | undefined }> = ({ workspaceIds, nameOf }) => {
  const results = useChatRoomsOf(workspaceIds);
  if (results.some((result) => result.isLoading)) return <LoadingState compact label="채팅방을 불러오는 중이에요" />;
  const muted = results.flatMap((result, index) => (result.data ?? []).filter((item) => item.muted).map((item) => ({ workspaceId: workspaceIds[index], item })));
  const failed = results.some((result) => result.isError);
  return (
    <div>
      {muted.length === 0 ? (
        <p className="flex items-center gap-2 py-2 text-sm text-muted">
          <BellSlashIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
          음소거한 채팅방이 없어요. 채팅방 메뉴에서 방마다 알림을 끌 수 있어요.
        </p>
      ) : (
        <ul className="divide-y divide-outline-soft">
          {muted.map(({ workspaceId, item }) => (
            <MutedRoomRow key={item.room.id} workspaceId={workspaceId} workspaceName={workspaceIds.length > 1 ? nameOf(workspaceId) : undefined} item={item} />
          ))}
        </ul>
      )}
      {failed && <p role="alert" className="mt-2 text-sm text-danger">일부 워크스페이스의 채팅방을 불러오지 못했어요.</p>}
    </div>
  );
};

/**
 * 계정 설정(SCR-MY-03). 계정 정보, 비밀번호 변경, 알림 수신 설정과 채팅방 음소거(16 §4.3), 계정 삭제(17 §6.4).
 * 멤버십·관리 계열은 한 곳에서라도 매니저·개설자인 사람에게만 보인다(16-D2).
 */
export const AccountSettingsScreen: React.FC = () => {
  const workspaces = useMyWorkspaces();
  const myData = useMyData();
  const list = workspaces.data ?? [];
  const manager = list.some((workspace) => isManager(workspace.myRole));
  const nameOf = (id: string) => list.find((workspace) => workspace.id === id)?.name;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 lg:py-8">
      <h1 className="mb-6 text-2xl font-bold leading-8">계정 설정</h1>
      {myData.isLoading ? (
        <LoadingState compact label="계정 정보를 불러오는 중이에요" />
      ) : myData.isError || !myData.data ? (
        <ErrorState compact title="계정 정보를 불러오지 못했어요" description="잠시 뒤 다시 시도해 주세요." action={<Button size="sm" onClick={() => myData.refetch()}>다시 시도</Button>} />
      ) : (
        <div className="mb-4 space-y-4">
          <AccountInfoSection data={myData.data} />
          <PasswordSection data={myData.data} />
        </div>
      )}
      <section aria-labelledby="settings-notifications" className="rounded-card border border-outline-soft bg-surface p-4 sm:p-6">
        <h2 id="settings-notifications" className="mb-2 text-lg font-bold">
          알림 수신
        </h2>
        {workspaces.isLoading ? <LoadingState compact /> : <NotificationSettingsSection manager={manager} />}
      </section>
      <section aria-labelledby="settings-muted" className="mt-4 rounded-card border border-outline-soft bg-surface p-4 sm:p-6">
        <h2 id="settings-muted" className="mb-2 text-lg font-bold">
          음소거한 채팅방
        </h2>
        {workspaces.isLoading ? <LoadingState compact /> : <MutedRoomsSection workspaceIds={list.map((workspace) => workspace.id)} nameOf={nameOf} />}
      </section>
      {myData.data && (
        <div className="mt-4">
          <DeleteAccountSection data={myData.data} />
        </div>
      )}
    </div>
  );
};
