import React, { useEffect, useId, useRef, useState } from 'react';
import { EllipsisVerticalIcon, NoSymbolIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { WORKSPACE_ROLE_LABEL, type Member } from '@/renewal/domain/workspace';
import { matchesMember, memberActions, type MemberActions, type WorkspaceSettings } from '@/renewal/domain/workspaceAdmin';
import {
  useBanMember,
  useBans,
  useChangeRole,
  useKickMember,
  useMe,
  useMembers,
  useTeams,
  useTransferOwnership,
  useUnbanMember,
} from '@/renewal/data/queries';
import { Avatar, Badge, Button, EmptyState, ErrorState, LoadingState, Modal, fieldClassName } from '@/renewal/ui';
import { ConfirmModal } from '@/renewal/features/teamBuilding/shared';
import { SettingsSection, attempt, formatDate } from './parts';

type Action = keyof MemberActions;
const ACTION_LABEL: Record<Action, string> = { promote: '매니저로 임명', demote: '매니저 해제', transfer: '개설자 넘기기', kick: '내보내기', ban: '차단하기' };
const ACTION_ORDER: Action[] = ['promote', 'demote', 'transfer', 'kick', 'ban'];

/** 행 메뉴. 버튼으로 열고 Escape·바깥 클릭으로 닫으며 닫히면 버튼으로 포커스를 돌린다. */
const RowMenu: React.FC<{ name: string; actions: MemberActions; onPick: (action: Action) => void }> = ({ name, actions, onPick }) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);
  const available = ACTION_ORDER.filter((action) => actions[action]);
  if (available.length === 0) return <span className="inline-block h-11 w-11" aria-hidden="true" />;
  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${name} 관리`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-container hover:text-ink"
      >
        <EllipsisVerticalIcon className="h-5 w-5" aria-hidden="true" />
      </button>
      {open && (
        <ul id={menuId} className="absolute right-0 top-full z-20 mt-1 w-44 rounded-card border border-outline-soft bg-surface p-1 shadow-float">
          {available.map((action) => (
            <li key={action}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onPick(action);
                }}
                className={`flex min-h-touch w-full items-center rounded-lg px-3 text-left text-sm font-medium hover:bg-surface-container ${action === 'kick' || action === 'ban' ? 'text-danger' : ''}`}
              >
                {ACTION_LABEL[action]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** 개설자 넘기기 2단계 확인(13 §5.3): ① 넘기면 나는 매니저가 된다는 안내 → ② 받는 사람 이름 입력. */
const TransferModal: React.FC<{ target: Member | null; pending: boolean; onClose: () => void; onConfirm: (name: string) => void }> = ({ target, pending, onClose, onConfirm }) => {
  const id = useId();
  const [step, setStep] = useState<1 | 2>(1);
  const [value, setValue] = useState('');
  useEffect(() => {
    if (target) {
      setStep(1);
      setValue('');
    }
  }, [target]);
  if (!target) return null;
  const name = target.account.name;
  const matches = value.trim() === name;
  return (
    <Modal
      isOpen
      onClose={onClose}
      preventClose={pending}
      title="개설자 넘기기"
      description={step === 1 ? `${name}님이 개설자가 되고, 나는 매니저가 돼요. 보안과 위험 구역 설정, 워크스페이스 삭제는 ${name}님만 할 수 있게 돼요.` : '확인을 위해 받는 사람 이름을 입력해 주세요.'}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={step === 1 ? onClose : () => setStep(1)} disabled={pending}>
            {step === 1 ? '취소' : '이전'}
          </Button>
          {step === 1 ? (
            <Button onClick={() => setStep(2)}>계속</Button>
          ) : (
            <Button variant="danger" onClick={() => onConfirm(value)} disabled={!matches} loading={pending}>
              넘기기
            </Button>
          )}
        </>
      }
    >
      {step === 2 ? (
        <>
          <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
            받는 사람 이름 <span className="font-bold">{name}</span>
          </label>
          <input id={id} value={value} onChange={(event) => setValue(event.target.value)} autoComplete="off" autoFocus className={fieldClassName(false)} />
        </>
      ) : (
        <p className="text-sm">
          받는 사람: <span className="font-semibold">{name}</span> ({target.account.email})
        </p>
      )}
    </Modal>
  );
};

/**
 * 멤버 관리 탭(13 §4.3). 이름·이메일 검색, 역할 표시, 행 메뉴로 역할 변경·이양·내보내기·차단.
 * 마지막 매니저를 해제할 때는 개설자 혼자 운영하게 된다고 알리고 허용한다(13-D6).
 */
export const MembersTab: React.FC<{ settings: WorkspaceSettings }> = ({ settings }) => {
  const wsId = settings.id;
  const id = useId();
  const me = useMe();
  const members = useMembers(wsId);
  const teams = useTeams(wsId);
  const changeRole = useChangeRole(wsId);
  const transfer = useTransferOwnership(wsId);
  const kick = useKickMember(wsId);
  const ban = useBanMember(wsId);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<{ action: Action; member: Member } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  if (members.isLoading || !me.data) return <LoadingState label="멤버를 불러오는 중이에요" />;
  if (members.isError || !members.data) {
    return <ErrorState title="멤버를 불러오지 못했어요" description="잠시 뒤 다시 시도해 주세요." action={<Button onClick={() => members.refetch()}>다시 시도</Button>} />;
  }

  const myId = me.data.id;
  const list = members.data;
  const shown = list.filter((member) => matchesMember(member.account, query));
  const teamOf = (member: Member) => teams.data?.find((team) => team.id === member.teamId);
  const managerCount = list.filter((member) => member.role === 'ADMIN').length;

  const close = () => setPending(null);
  const finish = (ok: boolean) => {
    if (ok) {
      close();
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  };

  const describe = (action: Action, member: Member) => {
    const name = member.account.name;
    const team = teamOf(member);
    const heirId = team && team.leaderId === member.account.id ? team.memberIds.find((memberId) => memberId !== member.account.id) : undefined;
    const heir = heirId ? list.find((item) => item.account.id === heirId)?.account.name : undefined;
    const teamNote = team && team.leaderId === member.account.id ? (heir ? ` ${team.name} 팀장은 ${heir}님이 이어받아요.` : ` 혼자 있던 ${team.name}은 해체돼요.`) : '';
    switch (action) {
      case 'promote':
        return { title: `${name}님을 매니저로 임명할까요?`, description: '대시보드, 세션 운영, 초대와 멤버 관리를 함께 맡게 돼요.', confirm: '임명하기', danger: false };
      case 'demote':
        return {
          title: `${name}님의 매니저를 해제할까요?`,
          description: managerCount === 1 ? '남는 매니저가 없어 개설자 혼자 운영하게 돼요.' : '멤버 권한으로 돌아가요.',
          confirm: '해제하기',
          danger: false,
        };
      case 'kick':
        return { title: `${name}님을 내보낼까요?`, description: `팀과 그룹 채팅방에서 빠지고 대기 중인 지원·스카우트는 만료돼요. 초대 링크로 다시 합류할 수 있어요.${teamNote}`, confirm: '내보내기', danger: true };
      default:
        return { title: `${name}님을 차단할까요?`, description: `내보내기와 같이 정리되고, 차단을 풀기 전까지 다시 합류할 수 없어요. 당사자에게 차단 알림이 가요.${teamNote}`, confirm: '차단하기', danger: true };
    }
  };

  const run = async () => {
    if (!pending) return;
    const { action, member } = pending;
    const name = member.account.name;
    const accountId = member.account.id;
    if (action === 'promote' || action === 'demote') {
      finish(await attempt(() => changeRole.mutateAsync({ accountId, role: action === 'promote' ? 'ADMIN' : 'MEMBER' }), action === 'promote' ? `${name}님을 매니저로 임명했어요.` : `${name}님의 매니저를 해제했어요.`));
    } else if (action === 'kick') {
      finish(await attempt(() => kick.mutateAsync(accountId), `${name}님을 내보냈어요.`));
    } else if (action === 'ban') {
      finish(await attempt(() => ban.mutateAsync(accountId), `${name}님을 차단했어요.`));
    }
  };

  const confirmText = pending && pending.action !== 'transfer' ? describe(pending.action, pending.member) : null;

  return (
    <SettingsSection id={`${id}-title`} title={`멤버 ${list.length}명`}>
      <label htmlFor={`${id}-search`} className="sr-only">
        이름이나 이메일로 찾기
      </label>
      <input ref={searchRef} id={`${id}-search`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름이나 이메일로 찾기" className={fieldClassName(false)} />
      <p className="sr-only" role="status">
        {query.trim() ? `${shown.length}명을 찾았어요` : ''}
      </p>
      {shown.length === 0 ? (
        <EmptyState compact icon={<UserGroupIcon className="h-5 w-5" />} title="찾는 멤버가 없어요" description="이름이나 이메일을 다시 확인해 주세요." />
      ) : (
        <ul className="mt-3 divide-y divide-outline-soft">
          {shown.map((member) => {
            const team = teamOf(member);
            // 보관 중이면 역할 변경·내보내기·차단 메뉴를 숨긴다(R24).
            const actions = memberActions(settings.archivedAt ? 'MEMBER' : settings.myRole, myId, { accountId: member.account.id, role: member.role });
            return (
              <li key={member.account.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={member.account.name} imageUrl={member.account.profileImageUrl} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className="truncate font-semibold">{member.account.name}</span>
                    {member.account.id === myId && <span className="text-xs text-muted">(나)</span>}
                  </span>
                  <span className="block truncate text-sm text-muted">{member.account.email}</span>
                  {team && <span className="block truncate text-sm text-muted">{`${team.name}${team.leaderId === member.account.id ? ' 팀장' : ' 팀원'}`}</span>}
                </span>
                <Badge tone={member.role === 'MEMBER' ? 'neutral' : 'primary'}>{WORKSPACE_ROLE_LABEL[member.role]}</Badge>
                <RowMenu name={member.account.name} actions={actions} onPick={(action) => setPending({ action, member })} />
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmModal
        open={Boolean(confirmText)}
        title={confirmText?.title ?? ''}
        description={confirmText?.description ?? ''}
        confirmLabel={confirmText?.confirm ?? ''}
        tone={confirmText?.danger ? 'danger' : 'default'}
        pending={changeRole.isPending || kick.isPending || ban.isPending}
        onClose={close}
        onConfirm={run}
      />
      <TransferModal
        target={pending?.action === 'transfer' ? pending.member : null}
        pending={transfer.isPending}
        onClose={close}
        onConfirm={async (confirmName) => {
          if (!pending) return;
          const name = pending.member.account.name;
          finish(await attempt(() => transfer.mutateAsync({ accountId: pending.member.account.id, confirmName }), `${name}님에게 개설자를 넘겼어요. 이제 매니저예요.`));
        }}
      />
    </SettingsSection>
  );
};

/** 차단 목록 탭. 해제하면 초대 링크로 다시 합류할 수 있다. 워크스페이스에 자동으로 돌아오지는 않는다. */
export const BansTab: React.FC<{ settings: WorkspaceSettings }> = ({ settings }) => {
  const id = useId();
  const bans = useBans(settings.id);
  const unban = useUnbanMember(settings.id);
  const headingRef = useRef<HTMLHeadingElement>(null);

  if (bans.isLoading) return <LoadingState label="차단 목록을 불러오는 중이에요" />;
  if (bans.isError || !bans.data) {
    return <ErrorState title="차단 목록을 불러오지 못했어요" description="잠시 뒤 다시 시도해 주세요." action={<Button onClick={() => bans.refetch()}>다시 시도</Button>} />;
  }

  return (
    <SettingsSection id={`${id}-title`} title={`차단한 멤버 ${bans.data.length}명`} description="차단을 풀면 초대 링크로 다시 합류할 수 있어요. 자동으로 돌아오지는 않아요.">
      <h3 ref={headingRef} tabIndex={-1} className="sr-only">
        차단 목록
      </h3>
      {bans.data.length === 0 ? (
        <EmptyState compact icon={<NoSymbolIcon className="h-5 w-5" />} title="차단한 멤버가 없어요" />
      ) : (
        <ul className="divide-y divide-outline-soft">
          {bans.data.map((item) => (
            <li key={item.account.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <Avatar name={item.account.name} imageUrl={item.account.profileImageUrl} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{item.account.name}</span>
                <span className="block truncate text-sm text-muted">
                  {item.account.email} · {formatDate(item.bannedAt)} 차단
                </span>
              </span>
              {!settings.archivedAt && (
              <Button
                variant="outline"
                size="sm"
                aria-label={`${item.account.name} 차단 해제`}
                loading={unban.isPending && unban.variables === item.account.id}
                onClick={async () => {
                  if (await attempt(() => unban.mutateAsync(item.account.id), `${item.account.name}님의 차단을 풀었어요.`)) headingRef.current?.focus();
                }}
              >
                차단 해제
              </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  );
};
