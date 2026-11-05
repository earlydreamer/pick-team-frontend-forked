import React, { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownTrayIcon, IdentificationIcon, PencilSquareIcon, Squares2X2Icon, TrashIcon } from '@heroicons/react/24/outline';
import { exportFileName, exportMyData, myDataRows, type MyData } from '@/renewal/domain/account';
import { NAME_LIMITS, validateName } from '@/renewal/domain/auth';
import { cardStatus, type CardStatus } from '@/renewal/domain/card';
import { WORKSPACE_ROLE_LABEL } from '@/renewal/domain/workspace';
import { useDeleteCard, useMe, useMyData, useUpdateName } from '@/renewal/data/queries';
import { Avatar, Badge, Button, EmptyState, ErrorState, Input, LoadingState, Modal, buttonClassName } from '@/renewal/ui';
import { ConfirmModal } from '@/renewal/features/teamBuilding/shared';
import { SettingsSection, attempt } from '@/renewal/features/workspaceSettings/parts';
import { workspaceEntryPath } from '@/renewal/shell/entry';

const CARD_STATE: Record<CardStatus, { label: string; tone: 'neutral' | 'warning' | 'success' | 'primary'; description: string }> = {
  NO_CONSENT: { label: '작성 전', tone: 'neutral', description: '카드를 쓰면 같은 워크스페이스 멤버가 나를 알아보고 팀 빌딩에 참여할 수 있어요.' },
  NOT_WRITTEN: { label: '작성 중', tone: 'warning', description: '희망 역할 두 개와 주간 가용 시간을 채워야 팀 빌딩에 참여할 수 있어요.' },
  PUBLIC: { label: '공개', tone: 'success', description: '소속 워크스페이스 멤버가 내 카드를 볼 수 있어요.' },
  PRIVATE: { label: '비공개', tone: 'primary', description: '이름과 사진만 보이고 카드 내용은 나만 볼 수 있어요.' },
};

const NameModal: React.FC<{ open: boolean; current: string; onClose: () => void }> = ({ open, current, onClose }) => {
  const id = useId();
  const update = useUpdateName();
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (open) {
      setValue(current);
      setError(undefined);
    }
  }, [open, current]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validateName(value);
    setError(problem);
    if (problem) return document.getElementById(`${id}-name`)?.focus();
    if (await attempt(() => update.mutateAsync(value), '이름을 바꿨어요.')) onClose();
  };
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      preventClose={update.isPending}
      title="이름 바꾸기"
      description="소속 워크스페이스의 멤버 목록, 카드, 채팅에 이 이름이 보여요."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            취소
          </Button>
          <Button type="submit" form={`${id}-form`} loading={update.isPending} disabled={value.trim() === current}>
            저장
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={submit} noValidate>
        <Input id={`${id}-name`} label="이름" value={value} maxLength={NAME_LIMITS.max} help="2~50자, 한글·영문·숫자·공백" error={error} onChange={(event) => setValue(event.target.value)} autoComplete="name" />
      </form>
    </Modal>
  );
};

/** 내 데이터(17 §6.1, §6.3 열람권). 항목, 저장된 값, 공개 범위를 보여 주고 JSON으로 내려받게 한다. */
const MyDataSection: React.FC<{ data: MyData }> = ({ data }) => {
  const id = useId();
  const removeCard = useDeleteCard();
  const [confirming, setConfirming] = useState(false);
  const status = cardStatus(data.card);

  const download = () => {
    const blob = new Blob([JSON.stringify(exportMyData(data), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName();
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SettingsSection id={`${id}-title`} title="내 데이터" description="Pick Team에 저장된 내 정보와 누구에게 보이는지예요. 틀린 내용은 카드 편집과 이름 바꾸기에서 고칠 수 있어요.">
      <dl className="divide-y divide-outline-soft text-sm">
        {myDataRows(data).map((row) => (
          <div key={row.label} className="grid grid-cols-1 gap-x-4 gap-y-0.5 py-2.5 sm:grid-cols-[9rem_1fr_9rem]">
            <dt className="font-semibold">{row.label}</dt>
            <dd className={`break-words ${row.value === '없음' ? 'text-muted' : ''}`}>{row.value}</dd>
            <dd className="text-xs text-muted sm:text-right sm:text-sm">
              <span className="sr-only">공개 범위: </span>
              {row.scope}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" leftIcon={<ArrowDownTrayIcon className="h-5 w-5" />} onClick={download}>
          JSON으로 내려받기
        </Button>
        {status !== 'NO_CONSENT' && (
          <Button variant="danger-ghost" leftIcon={<TrashIcon className="h-5 w-5" />} onClick={() => setConfirming(true)}>
            PR 카드 삭제
          </Button>
        )}
      </div>
      <p className="mt-3 text-sm text-muted">
        계정 삭제는{' '}
        <Link to="/me/settings" className="font-semibold text-primary underline-offset-2 hover:underline">
          계정 설정
        </Link>
        에서 할 수 있어요.
      </p>
      <ConfirmModal
        open={confirming}
        title="PR 카드를 삭제할까요?"
        description="협업 성향과 MBTI를 포함한 카드 내용과 동의 기록이 지워지고 되돌릴 수 없어요. 팀 빌딩에 참여하려면 카드를 다시 써야 해요."
        confirmLabel="삭제하기"
        tone="danger"
        pending={removeCard.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          await attempt(() => removeCard.mutateAsync(), 'PR 카드를 삭제했어요.');
          setConfirming(false);
        }}
      />
    </SettingsSection>
  );
};

/**
 * SCR-MY-01 마이페이지. 프로필, 내 PR 카드 상태, 소속 워크스페이스, 내 데이터(열람·내려받기·카드 삭제)를 모은다.
 * 사진은 카드 편집에서 바꾸고, 비밀번호·알림·계정 삭제는 계정 설정에서 다룬다.
 */
export const MyPageScreen: React.FC = () => {
  const id = useId();
  const me = useMe();
  const myData = useMyData();
  const [editingName, setEditingName] = useState(false);

  if (myData.isLoading) return <LoadingState className="min-h-[60vh]" label="내 정보를 불러오는 중이에요" />;
  if (myData.isError || !myData.data) {
    return <ErrorState className="min-h-[60vh]" title="내 정보를 불러오지 못했어요" description="네트워크 상태를 확인한 뒤 다시 시도해 주세요." action={<Button onClick={() => myData.refetch()}>다시 시도</Button>} />;
  }
  const data = myData.data;
  const state = CARD_STATE[cardStatus(data.card)];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 sm:px-6 lg:py-8">
      <h1 className="text-2xl font-bold leading-8">마이페이지</h1>

      <section aria-labelledby={`${id}-profile`} className="flex flex-col gap-4 rounded-card border border-outline-soft bg-surface p-5 sm:flex-row sm:items-center">
        <Avatar name={data.account.name} imageUrl={data.account.profileImageUrl} size="xl" />
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-profile`} className="truncate text-xl font-bold">
            {data.account.name}
          </h2>
          <p className="truncate text-sm text-muted">{data.account.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" leftIcon={<PencilSquareIcon className="h-4 w-4" />} onClick={() => setEditingName(true)}>
            이름 바꾸기
          </Button>
          <Link to="/me/card" className={buttonClassName('outline', 'sm')}>
            사진 바꾸기
          </Link>
        </div>
      </section>

      <SettingsSection id={`${id}-card`} title="내 PR 카드">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <Badge tone={state.tone} icon={<IdentificationIcon className="h-3.5 w-3.5" aria-hidden="true" />}>
              {state.label}
            </Badge>
            <p className="mt-1.5 text-sm text-muted">{state.description}</p>
          </div>
          <Link to="/me/card" className={buttonClassName('primary', 'md', 'w-full sm:w-auto')}>
            {cardStatus(data.card) === 'NO_CONSENT' ? '카드 쓰기' : '카드 편집'}
          </Link>
        </div>
      </SettingsSection>

      <SettingsSection id={`${id}-workspaces`} title={`내 워크스페이스 ${data.workspaces.length}곳`}>
        {data.workspaces.length === 0 ? (
          <EmptyState
            compact
            icon={<Squares2X2Icon className="h-5 w-5" />}
            title="아직 소속된 워크스페이스가 없어요"
            action={
              <Link to="/welcome" className={buttonClassName('primary', 'sm')}>
                참여하거나 만들기
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-outline-soft">
            {data.workspaces.map((workspace) => (
              <li key={workspace.id}>
                <Link
                  to={workspaceEntryPath(me.data?.id, { id: workspace.id, myRole: workspace.role })}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-container"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{workspace.name}</span>
                    <span className="block truncate text-sm text-muted">{workspace.teamName ? `${workspace.teamName} ${workspace.teamLeader ? '팀장' : '팀원'}` : '소속 팀 없음'}</span>
                  </span>
                  <Badge tone={workspace.role === 'MEMBER' ? 'neutral' : 'primary'}>{WORKSPACE_ROLE_LABEL[workspace.role]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      <MyDataSection data={data} />
      <NameModal open={editingName} current={data.account.name} onClose={() => setEditingName(false)} />
    </div>
  );
};
