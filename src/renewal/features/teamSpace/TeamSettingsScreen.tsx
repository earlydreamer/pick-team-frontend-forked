import React, { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightOnRectangleIcon, ExclamationTriangleIcon, UserMinusIcon } from '@heroicons/react/24/outline';
import { DELEGATION_TTL_MS, TEAM_INFO_LIMITS, activeDelegation, delegationExpired, validateTeamInfo, type TeamInfoInput } from '@/renewal/domain/teamSpace';
import {
  useCancelDelegation,
  useDeleteTeam,
  useLeaveTeam,
  useMe,
  useRemoveMember,
  useRequestDelegation,
  useRespondDelegation,
  useUpdateTeamInfo,
} from '@/renewal/data/queries';
import { Avatar, Badge, Button, Modal, fieldClassName, toast } from '@/renewal/ui';
import { ConfirmModal } from '@/renewal/features/teamBuilding/shared';
import { useTeamSpaceContext } from './TeamSpaceLayout';
import { errorMessage } from './TaskModals';
import { josa } from '@/renewal/domain/josa';

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

const Section: React.FC<{ id: string; title: string; description?: string; tone?: 'default' | 'danger'; children: React.ReactNode }> = ({ id, title, description, tone = 'default', children }) => (
  <section aria-labelledby={id} className={`rounded-card border bg-surface p-5 ${tone === 'danger' ? 'border-red-200' : 'border-outline-soft'}`}>
    <h2 id={id} className={`text-base font-bold ${tone === 'danger' ? 'text-danger' : ''}`}>
      {title}
    </h2>
    {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const hoursLeft = (requestedAt: string) => Math.max(1, Math.ceil((new Date(requestedAt).getTime() + DELEGATION_TTL_MS - Date.now()) / 3_600_000));

/** 팀 이름을 그대로 입력해야 삭제 버튼이 켜지는 확인(14 §5.5, prompt() 대체). */
const DeleteTeamModal: React.FC<{ open: boolean; teamName: string; pending: boolean; onClose: () => void; onConfirm: (name: string) => void }> = ({ open, teamName, pending, onClose, onConfirm }) => {
  const id = useId();
  const [value, setValue] = useState('');
  useEffect(() => {
    if (open) setValue('');
  }, [open]);
  const matches = value.trim() === teamName;
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      preventClose={pending}
      title="팀 삭제"
      description="칸반, 일정, 게시판, 공지가 함께 지워지고 되돌릴 수 없어요. 팀원은 모두 소속 없는 상태가 돼요."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button variant="danger" onClick={() => onConfirm(value)} disabled={!matches} loading={pending}>
            삭제하기
          </Button>
        </>
      }
    >
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        확인을 위해 팀 이름 <span className="font-bold">{teamName}</span>을 입력해 주세요
      </label>
      <input id={id} value={value} onChange={(event) => setValue(event.target.value)} autoComplete="off" className={fieldClassName(false)} />
    </Modal>
  );
};

/**
 * SCR-TM-06 팀 설정(14 §4.6). 기본 정보, 팀장 위임, 멤버 관리, 팀 나가기, 팀 삭제를 한 화면에 모은다.
 * 팀원이 아닌 개설자·매니저는 멤버 내보내기와 팀 삭제만 할 수 있다(14 §2).
 */
export const TeamSettingsScreen: React.FC = () => {
  const { workspaceId, teamId, space } = useTeamSpaceContext();
  const navigate = useNavigate();
  const me = useMe();
  const updateInfo = useUpdateTeamInfo(workspaceId, teamId);
  const requestDelegation = useRequestDelegation(workspaceId, teamId);
  const cancelDelegation = useCancelDelegation(workspaceId, teamId);
  const respond = useRespondDelegation(workspaceId, teamId);
  const removeMember = useRemoveMember(workspaceId, teamId);
  const leave = useLeaveTeam(workspaceId, teamId);
  const deleteTeam = useDeleteTeam(workspaceId, teamId);
  const { team, members, access } = space;
  const [info, setInfo] = useState<TeamInfoInput>({ name: team.name, intro: team.intro ?? '' });
  const [infoErrors, setInfoErrors] = useState<Partial<Record<keyof TeamInfoInput, string>>>({});
  const [target, setTarget] = useState('');
  const [confirm, setConfirm] = useState<'accept' | 'leave' | { remove: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const meId = me.data?.id;
  const pendingDelegation = activeDelegation(team);
  const expired = delegationExpired(team);
  const nameOf = (id?: string) => members.find((member) => member.account.id === id)?.account.name ?? '';
  const others = members.filter((member) => member.account.id !== team.leaderId);
  const canManage = access.isLeader || access.isManagerViewer;
  const alone = members.length === 1;

  useEffect(() => {
    setInfo({ name: team.name, intro: team.intro ?? '' });
  }, [team.name, team.intro]);

  const saveInfo = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateTeamInfo(info);
    setInfoErrors(found);
    if (found.name) return document.getElementById('team-name')?.focus();
    await attempt(() => updateInfo.mutateAsync(info), '팀 정보를 저장했어요.');
  };

  const confirmCopy = (() => {
    if (confirm === 'accept') return { title: '팀장 위임 수락', description: '수락하면 팀장이 되고 완료 승인과 팀 설정을 맡아요.', label: '수락하기' };
    if (confirm === 'leave')
      return alone && access.isLeader
        ? { title: '팀 해체', description: '혼자 남은 팀이라 나가면 팀이 해체돼요. 칸반, 일정, 게시판, 공지가 함께 지워지고 되돌릴 수 없어요.', label: '해체하고 나가기' }
        : { title: '팀 나가기', description: '나가면 이 팀의 담당 태스크에서 빠지고 팀 스페이스에 들어올 수 없어요.', label: '나가기' };
    if (confirm && typeof confirm === 'object')
      return { title: '팀원 내보내기', description: `${nameOf(confirm.remove)}님을 내보내면 담당 태스크에서 빠지고 팀 스페이스에 들어올 수 없어요.`, label: '내보내기' };
    return null;
  })();

  const runConfirm = async () => {
    if (confirm === 'accept') {
      if (await attempt(() => respond.mutateAsync(true), '팀장이 됐어요.')) setConfirm(null);
      return;
    }
    if (confirm === 'leave') {
      try {
        const result = await leave.mutateAsync();
        toast.success(result.disbanded ? '팀을 해체했어요.' : `${team.name}에서 나왔어요.`);
        navigate(`/ws/${workspaceId}`, { replace: true });
      } catch (error) {
        toast.error(errorMessage(error));
        setConfirm(null);
      }
      return;
    }
    if (confirm && typeof confirm === 'object') {
      const name = nameOf(confirm.remove);
      if (await attempt(() => removeMember.mutateAsync(confirm.remove), `${name}님을 내보냈어요.`)) setConfirm(null);
    }
  };

  return (
    <div className="max-w-3xl space-y-5">
      <h2 className="text-xl font-bold">팀 설정</h2>

      {pendingDelegation && pendingDelegation.targetId === meId && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-card border border-peri-200 bg-peri-50 px-4 py-3">
          <p className="flex-1 text-sm">
            <span className="font-semibold">{nameOf(team.leaderId)}</span>님이 팀장 위임을 요청했어요. {hoursLeft(pendingDelegation.requestedAt)}시간 안에 답해 주세요.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" loading={respond.isPending && confirm === null} onClick={() => attempt(() => respond.mutateAsync(false), '위임 요청을 거절했어요.')}>
              거절
            </Button>
            <Button size="sm" onClick={() => setConfirm('accept')}>
              수락
            </Button>
          </div>
        </div>
      )}

      {access.isMember && (
        <Section id="ts-info" title="기본 정보" description={access.isLeader ? undefined : '팀장만 바꿀 수 있어요.'}>
          <form onSubmit={saveInfo} noValidate className="space-y-4">
            <div>
              <label htmlFor="team-name" className="mb-1.5 block text-sm font-semibold">
                팀 이름
              </label>
              <input
                id="team-name"
                value={info.name}
                maxLength={TEAM_INFO_LIMITS.nameMax}
                readOnly={!access.isLeader}
                onChange={(event) => setInfo((prev) => ({ ...prev, name: event.target.value }))}
                aria-invalid={infoErrors.name ? true : undefined}
                aria-describedby={infoErrors.name ? 'team-name-error' : undefined}
                className={fieldClassName(Boolean(infoErrors.name))}
              />
              {infoErrors.name && (
                <p id="team-name-error" className="mt-1.5 text-sm text-danger">
                  {infoErrors.name}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="team-intro" className="mb-1.5 block text-sm font-semibold">
                팀 소개 <span className="font-normal text-muted">(선택)</span>
              </label>
              <input
                id="team-intro"
                value={info.intro ?? ''}
                maxLength={TEAM_INFO_LIMITS.introMax}
                readOnly={!access.isLeader}
                onChange={(event) => setInfo((prev) => ({ ...prev, intro: event.target.value }))}
                className={fieldClassName(false)}
              />
            </div>
            {access.isLeader && (
              <Button type="submit" loading={updateInfo.isPending} disabled={info.name === team.name && (info.intro ?? '') === (team.intro ?? '')}>
                저장
              </Button>
            )}
          </form>
        </Section>
      )}

      {access.isLeader && (
        <Section id="ts-delegate" title="팀장 위임" description="지명한 팀원이 24시간 안에 수락하면 팀장이 바뀌고, 나는 팀원이 돼요.">
          {pendingDelegation ? (
            <div className="flex flex-wrap items-center gap-3">
              <p role="status" className="flex-1 text-sm">
                <span className="font-semibold">{nameOf(pendingDelegation.targetId)}</span>님에게 위임을 요청했어요. 수락을 기다리는 중이에요(약 {hoursLeft(pendingDelegation.requestedAt)}시간 남음). 그동안 내 승인은 보류돼요.
              </p>
              <Button size="sm" variant="outline" loading={cancelDelegation.isPending} onClick={() => attempt(() => cancelDelegation.mutateAsync(), '위임 요청을 취소했어요.')}>
                요청 취소
              </Button>
            </div>
          ) : others.length === 0 ? (
            <p className="text-sm text-muted">위임할 팀원이 없어요.</p>
          ) : (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!target) return;
                if (await attempt(() => requestDelegation.mutateAsync(target), `${nameOf(target)}님에게 위임을 요청했어요.`)) setTarget('');
              }}
            >
              <div className="min-w-[12rem] flex-1">
                <label htmlFor="delegate-target" className="mb-1.5 block text-sm font-semibold">
                  지명할 팀원
                </label>
                <select id="delegate-target" value={target} onChange={(event) => setTarget(event.target.value)} className={fieldClassName(false, 'appearance-auto')}>
                  <option value="">팀원 선택</option>
                  {others.map((member) => (
                    <option key={member.account.id} value={member.account.id}>
                      {member.account.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={!target} loading={requestDelegation.isPending}>
                위임 요청
              </Button>
            </form>
          )}
          {expired && <p className="mt-3 text-sm text-warning">이전 위임 요청이 응답 없이 만료됐어요. 다시 지명해 주세요.</p>}
        </Section>
      )}

      <Section id="ts-members" title="멤버" description={canManage ? '팀장은 내보낼 수 없어요. 먼저 위임해 주세요.' : undefined}>
        <ul className="divide-y divide-outline-soft">
          {members.map((member) => {
            const leader = member.account.id === team.leaderId;
            return (
              <li key={member.account.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={member.account.name} imageUrl={member.account.profileImageUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{member.account.name}</span>
                  {member.account.id === meId && <span className="ml-1 text-xs text-muted">(나)</span>}
                </span>
                {leader ? <Badge tone="primary">팀장</Badge> : <span className="text-sm text-muted">팀원</span>}
                {canManage && !leader && (
                  <Button size="sm" variant="danger-ghost" leftIcon={<UserMinusIcon className="h-4 w-4" />} onClick={() => setConfirm({ remove: member.account.id })} aria-label={`${member.account.name} 내보내기`}>
                    내보내기
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      {access.isMember && (
        <Section id="ts-leave" title="팀 나가기">
          {access.isLeader && !alone ? (
            <p className="flex items-start gap-2 text-sm text-muted">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              {pendingDelegation ? '위임 수락을 기다리는 중이에요. 수락한 뒤에 나갈 수 있어요.' : '팀장은 다른 팀원에게 위임한 뒤에 나갈 수 있어요.'}
            </p>
          ) : (
            <Button variant="outline" leftIcon={<ArrowRightOnRectangleIcon className="h-5 w-5" />} onClick={() => setConfirm('leave')}>
              {alone && access.isLeader ? '팀 해체하고 나가기' : '팀 나가기'}
            </Button>
          )}
        </Section>
      )}

      {canManage && (
        <Section id="ts-danger" title="팀 삭제" tone="danger" description="팀과 팀의 모든 협업 기록을 지워요.">
          <Button variant="danger" onClick={() => setDeleting(true)}>
            팀 삭제
          </Button>
        </Section>
      )}

      {confirmCopy && (
        <ConfirmModal
          open
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel={confirmCopy.label}
          pending={respond.isPending || leave.isPending || removeMember.isPending}
          onClose={() => setConfirm(null)}
          onConfirm={runConfirm}
        />
      )}
      <DeleteTeamModal
        open={deleting}
        teamName={team.name}
        pending={deleteTeam.isPending}
        onClose={() => setDeleting(false)}
        onConfirm={async (name) => {
          try {
            await deleteTeam.mutateAsync(name);
            toast.success(`${josa(team.name, '을/를')} 삭제했어요.`);
            navigate(access.isManagerViewer ? `/ws/${workspaceId}/dashboard` : `/ws/${workspaceId}`, { replace: true });
          } catch (error) {
            toast.error(errorMessage(error));
          }
        }}
      />
    </div>
  );
};
