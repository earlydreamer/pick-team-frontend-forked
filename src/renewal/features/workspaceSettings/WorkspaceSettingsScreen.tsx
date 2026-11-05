import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { WORKSPACE_LIMITS, validateWorkspaceName, validateWorkspacePassword } from '@/renewal/domain/auth';
import { WORKSPACE_ROLE_LABEL } from '@/renewal/domain/workspace';
import { tabsFor, type SettingsTab, type WorkspaceSettings } from '@/renewal/domain/workspaceAdmin';
import { useDeleteWorkspace, useLeaveWorkspace, useOpenReportCount, useRenameWorkspace, useSetArchived, useSetWorkspacePassword, useWorkspaceSettings } from '@/renewal/data/queries';
import { Button, ErrorState, Input, LoadingState, Modal, fieldClassName } from '@/renewal/ui';
import { NotFoundScreen } from '@/renewal/screens/system';
import { DataError } from '@/renewal/data';
import { ConfirmModal } from '@/renewal/features/teamBuilding/shared';
import { InviteTab } from './InviteTab';
import { BansTab, MembersTab } from './MemberAdminTabs';
import { ReportsTab } from './ReportsTab';
import { SettingsSection, attempt, formatDate } from './parts';

/** 일반 탭. 매니저 이상은 이름을 바꾸고, 개설자가 아닌 사람은 여기서 워크스페이스를 나간다. */
const GeneralTab: React.FC<{ settings: WorkspaceSettings }> = ({ settings }) => {
  const id = useId();
  const navigate = useNavigate();
  const rename = useRenameWorkspace(settings.id);
  const leave = useLeaveWorkspace(settings.id);
  const [name, setName] = useState(settings.name);
  const [error, setError] = useState<string>();
  const [leaving, setLeaving] = useState(false);
  // 보관 중이면 이름을 바꿀 수 없다(R24). 나가기는 그대로 둔다.
  const canEdit = settings.myRole !== 'MEMBER' && !settings.archivedAt;
  useEffect(() => setName(settings.name), [settings.name]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validateWorkspaceName(name);
    setError(problem);
    if (problem) {
      document.getElementById(`${id}-name`)?.focus();
      return;
    }
    await attempt(() => rename.mutateAsync(name), '이름을 바꿨어요.');
  };

  return (
    <div className="space-y-4">
      <SettingsSection id={`${id}-info`} title="기본 정보">
        {canEdit ? (
          <form onSubmit={save} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1">
              <Input id={`${id}-name`} label="워크스페이스 이름" value={name} maxLength={WORKSPACE_LIMITS.nameMax} onChange={(event) => setName(event.target.value)} error={error} />
            </div>
            <Button type="submit" loading={rename.isPending} disabled={name.trim() === settings.name} className="w-full sm:mt-[1.625rem] sm:w-auto">
              저장
            </Button>
          </form>
        ) : null}
        <dl className={`space-y-1 text-sm ${canEdit ? 'mt-3' : ''}`}>
          {!canEdit && (
            <div className="flex gap-2">
              <dt className="w-24 text-muted">이름</dt>
              <dd className="font-semibold">{settings.name}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="w-24 text-muted">내 역할</dt>
            <dd className="font-semibold">{WORKSPACE_ROLE_LABEL[settings.myRole]}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 text-muted">멤버</dt>
            <dd className="font-semibold tabular-nums">{settings.capacity ? `${settings.memberCount} / ${settings.capacity}명` : `${settings.memberCount}명`}</dd>
          </div>
        </dl>
      </SettingsSection>

      <SettingsSection id={`${id}-leave`} title="워크스페이스 나가기" tone="danger">
        {settings.myRole === 'OWNER' ? (
          <p className="text-sm text-muted">
            개설자는 다른 멤버에게 넘긴 뒤에 나갈 수 있어요.{' '}
            <Link to="?tab=members" className="font-semibold text-primary underline-offset-2 hover:underline">
              멤버 관리에서 넘기기
            </Link>
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">팀과 그룹 채팅방에서도 빠져요. 다시 들어오려면 초대 링크가 필요해요.</p>
            <Button variant="danger-ghost" leftIcon={<ArrowRightOnRectangleIcon className="h-5 w-5" />} onClick={() => setLeaving(true)}>
              나가기
            </Button>
          </>
        )}
      </SettingsSection>

      <ConfirmModal
        open={leaving}
        title={`${settings.name}에서 나갈까요?`}
        description="팀, 그룹 채팅방, 대기 중인 지원·스카우트에서 빠져요. 팀장이라면 먼저 팀장을 위임해 주세요."
        confirmLabel="나가기"
        tone="danger"
        pending={leave.isPending}
        onClose={() => setLeaving(false)}
        onConfirm={async () => {
          if (await attempt(() => leave.mutateAsync(), '워크스페이스에서 나왔어요.')) navigate('/', { replace: true });
          else setLeaving(false);
        }}
      />
    </div>
  );
};

/** 보안 탭(개설자). 초대 링크와 별개로 합류할 때 묻는 비밀번호(10-D4, 13 §4.2). */
const SecurityTab: React.FC<{ settings: WorkspaceSettings }> = ({ settings }) => {
  const id = useId();
  const setPassword = useSetWorkspacePassword(settings.id);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const [removing, setRemoving] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = value ? validateWorkspacePassword(value) : '새 비밀번호를 입력해 주세요.';
    setError(problem);
    if (problem) {
      document.getElementById(`${id}-password`)?.focus();
      return;
    }
    if (await attempt(() => setPassword.mutateAsync(value), settings.hasPassword ? '비밀번호를 바꿨어요.' : '비밀번호를 정했어요.')) setValue('');
  };

  return (
    <SettingsSection
      id={`${id}-title`}
      title="합류 비밀번호"
      description={settings.hasPassword ? '초대 링크로 들어온 사람은 비밀번호를 입력해야 합류할 수 있어요.' : '지금은 초대 링크만 있으면 누구나 합류할 수 있어요.'}
    >
      {!settings.archivedAt && (
      <form onSubmit={save} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <Input
            id={`${id}-password`}
            type="password"
            autoComplete="new-password"
            label={settings.hasPassword ? '새 비밀번호' : '비밀번호'}
            help={`${WORKSPACE_LIMITS.passwordMin}~${WORKSPACE_LIMITS.passwordMax}자. 이미 합류한 멤버에게는 묻지 않아요.`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            error={error}
          />
        </div>
        <Button type="submit" loading={setPassword.isPending && !removing} className="w-full sm:mt-[1.625rem] sm:w-auto">
          {settings.hasPassword ? '바꾸기' : '정하기'}
        </Button>
      </form>
      )}
      {settings.hasPassword && !settings.archivedAt && (
        <Button className="mt-3" variant="danger-ghost" onClick={() => setRemoving(true)}>
          비밀번호 없애기
        </Button>
      )}
      <ConfirmModal
        open={removing}
        title="비밀번호를 없앨까요?"
        description="초대 링크만 있으면 누구나 합류할 수 있게 돼요."
        confirmLabel="없애기"
        tone="danger"
        pending={setPassword.isPending}
        onClose={() => setRemoving(false)}
        onConfirm={async () => {
          await attempt(() => setPassword.mutateAsync(null), '비밀번호를 없앴어요.');
          setRemoving(false);
        }}
      />
    </SettingsSection>
  );
};

/**
 * 보관(01-D4, US-13-07). 기수가 끝나면 읽기 전용으로 바꾼다. 진행 중인 팀 빌딩은 끝나고 대기 지원은 만료된다(13-D7).
 * 해제하면 다시 쓸 수 있다.
 */
const ArchiveSection: React.FC<{ settings: WorkspaceSettings }> = ({ settings }) => {
  const id = useId();
  const setArchived = useSetArchived(settings.id);
  const [confirming, setConfirming] = useState(false);
  const archived = Boolean(settings.archivedAt);
  return (
    <SettingsSection
      id={`${id}-title`}
      title={archived ? '보관 중' : '워크스페이스 보관'}
      description={
        archived
          ? `${formatDate(settings.archivedAt!)}부터 읽기 전용으로 보관 중이에요. 해제하면 다시 쓰고 고칠 수 있어요.`
          : '기수가 끝나면 읽기 전용으로 보관하세요. 멤버는 지난 기록을 볼 수 있지만 새로 쓰거나 고칠 수 없고, 초대 링크로 새로 합류할 수 없어요.'
      }
    >
      {archived ? (
        <Button variant="outline" loading={setArchived.isPending} onClick={() => attempt(() => setArchived.mutateAsync(false), '보관을 해제했어요. 다시 쓸 수 있어요.')}>
          보관 해제
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setConfirming(true)}>
          보관하기
        </Button>
      )}
      <ConfirmModal
        open={confirming}
        title="워크스페이스를 보관할까요?"
        description="읽기 전용으로 바뀌어요. 진행 중인 팀 빌딩이 있으면 끝나고, 대기 중인 지원·스카우트는 만료돼요. 언제든 해제할 수 있어요."
        confirmLabel="보관하기"
        pending={setArchived.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          await attempt(() => setArchived.mutateAsync(true), '워크스페이스를 보관했어요.');
          setConfirming(false);
        }}
      />
    </SettingsSection>
  );
};

/** 위험 구역(개설자). 보관과 삭제. 워크스페이스 이름을 그대로 입력해야 삭제한다(prompt() 대체). */
const DangerTab: React.FC<{ settings: WorkspaceSettings }> = ({ settings }) => {
  const id = useId();
  const navigate = useNavigate();
  const remove = useDeleteWorkspace(settings.id);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const matches = value.trim() === settings.name;
  return (
    <div className="space-y-4">
    <ArchiveSection settings={settings} />
    <SettingsSection id={`${id}-title`} title="워크스페이스 삭제" tone="danger" description="팀과 칸반·일정·게시판, 채팅, 초대 링크가 모두 지워지고 되돌릴 수 없어요. 멤버는 모두 이 워크스페이스에 들어올 수 없게 돼요.">
      <Button
        variant="danger"
        onClick={() => {
          setValue('');
          setOpen(true);
        }}
      >
        워크스페이스 삭제
      </Button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        preventClose={remove.isPending}
        title="워크스페이스 삭제"
        description="삭제하면 되돌릴 수 없어요."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={remove.isPending}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={!matches}
              loading={remove.isPending}
              onClick={async () => {
                if (await attempt(() => remove.mutateAsync(value), '워크스페이스를 삭제했어요.')) navigate('/', { replace: true });
              }}
            >
              삭제하기
            </Button>
          </>
        }
      >
        <label htmlFor={`${id}-confirm`} className="mb-1.5 block text-sm font-semibold">
          확인을 위해 워크스페이스 이름을 입력해 주세요: <span className="font-bold">{settings.name}</span>
        </label>
        <input id={`${id}-confirm`} value={value} onChange={(event) => setValue(event.target.value)} autoComplete="off" className={fieldClassName(false)} />
      </Modal>
    </SettingsSection>
    </div>
  );
};

const TAB_VIEW: Record<SettingsTab, React.FC<{ settings: WorkspaceSettings }>> = {
  general: GeneralTab,
  invite: InviteTab,
  members: MembersTab,
  bans: BansTab,
  reports: ReportsTab,
  security: SecurityTab,
  danger: DangerTab,
};

/**
 * SCR-WS-03 워크스페이스 설정(13 §4.1, 13-D2 풀페이지). 탭은 ?tab=으로 두고 역할에 맞는 탭만 보인다.
 * 넓은 화면은 왼쪽 탭 목록, 좁은 화면은 가로로 넘기는 탭 목록이다.
 * 권한 밖 탭 주소로 들어오면 일반 탭을 보여 준다.
 */
export const WorkspaceSettingsScreen: React.FC = () => {
  const { wsId = '' } = useParams<{ wsId: string }>();
  const [params, setParams] = useSearchParams();
  const settings = useWorkspaceSettings(wsId);
  const openReports = useOpenReportCount(wsId, settings.data?.myRole === 'OWNER' || settings.data?.myRole === 'ADMIN');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requested = params.get('tab');

  if (settings.isLoading) return <LoadingState className="min-h-[60vh]" label="설정을 불러오는 중이에요" />;
  if (settings.error instanceof DataError && settings.error.code === 'NOT_FOUND') return <NotFoundScreen />;
  if (settings.isError || !settings.data) {
    return <ErrorState className="min-h-[60vh]" title="설정을 불러오지 못했어요" description="네트워크 상태를 확인한 뒤 다시 시도해 주세요." action={<Button onClick={() => settings.refetch()}>다시 시도</Button>} />;
  }

  const tabs = tabsFor(settings.data.myRole);
  const active = tabs.find((tab) => tab.id === requested) ?? tabs[0];
  const View = TAB_VIEW[active.id];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold leading-8 focus:outline-none">
        워크스페이스 설정
      </h1>
      <p className="mb-5 text-sm text-muted">{settings.data.name}</p>
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        {tabs.length > 1 && (
          <nav aria-label="설정 항목" className="-mx-4 overflow-x-auto px-4 md:sticky md:top-20 md:mx-0 md:w-44 md:shrink-0 md:overflow-visible md:px-0">
            <ul className="flex gap-2 whitespace-nowrap md:flex-col md:gap-1">
              {tabs.map((tab) => {
                const current = tab.id === active.id;
                return (
                  <li key={tab.id} className={tab.id === 'security' ? 'md:mt-3 md:border-t md:border-outline-soft md:pt-3' : ''}>
                    <Link
                      to={`?tab=${tab.id}`}
                      onClick={(event) => {
                        event.preventDefault();
                        setParams({ tab: tab.id }, { replace: true });
                      }}
                      aria-current={current ? 'page' : undefined}
                      className={`inline-flex min-h-touch items-center rounded-full px-4 text-sm font-semibold md:flex md:rounded-lg md:px-3 ${
                        current ? 'bg-primary-container text-on-primary-container' : 'text-muted hover:bg-surface-container hover:text-ink'
                      } ${tab.id === 'danger' && !current ? 'md:text-danger' : ''}`}
                    >
                      {tab.label}
                      {tab.id === 'reports' && Boolean(openReports.data) && (
                        <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-danger px-1.5 text-xs font-bold leading-5 text-white">
                          {openReports.data}
                          <span className="sr-only">건 처리 대기</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
        <div className="min-w-0 flex-1">
          {settings.data.archivedAt && active.id !== 'danger' && active.id !== 'general' && (
            <p role="note" className="mb-4 rounded-lg bg-surface-container px-4 py-3 text-sm text-muted">
              보관 중이라 설정을 바꿀 수 없어요.{settings.data.myRole === 'OWNER' && ' 위험 구역에서 보관을 해제할 수 있어요.'}
            </p>
          )}
          <View key={active.id} settings={settings.data} />
        </div>
      </div>
    </div>
  );
};
