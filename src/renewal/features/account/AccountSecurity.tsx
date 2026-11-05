import React, { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { LOGIN_METHOD_LABEL, type MyData } from '@/renewal/domain/account';
import { isPasswordValid } from '@/renewal/domain/auth';
import { useChangePassword, useDeleteAccount } from '@/renewal/data/queries';
import { Button, Input, Modal, toast } from '@/renewal/ui';
import { PasswordChecklist, PasswordField } from '@/renewal/features/auth/AuthUi';
import { errorMessage } from '@/renewal/features/teamSpace/TaskModals';
import { SettingsSection, attempt } from '@/renewal/features/workspaceSettings/parts';

/** 계정 정보: 이메일과 로그인 방식. 이름·사진은 마이페이지와 카드 편집에서 바꾼다. */
export const AccountInfoSection: React.FC<{ data: MyData }> = ({ data }) => {
  const id = useId();
  return (
    <SettingsSection id={`${id}-title`} title="계정 정보">
      <dl className="divide-y divide-outline-soft text-sm">
        <div className="flex flex-wrap justify-between gap-2 py-2.5">
          <dt className="text-muted">이메일</dt>
          <dd className="font-semibold">{data.account.email}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2 py-2.5">
          <dt className="text-muted">로그인 방식</dt>
          <dd className="font-semibold">{data.loginMethods.map((method) => LOGIN_METHOD_LABEL[method]).join(', ') || '없음'}</dd>
        </div>
      </dl>
      <p className="mt-2 text-sm text-muted">
        이름과 사진은{' '}
        <Link to="/me" className="font-semibold text-primary underline-offset-2 hover:underline">
          마이페이지
        </Link>
        에서 바꿔요.
      </p>
    </SettingsSection>
  );
};

/** 비밀번호 변경. 소셜 로그인만 쓰는 계정은 Pick Team 비밀번호가 없다고 알린다. */
export const PasswordSection: React.FC<{ data: MyData }> = ({ data }) => {
  const id = useId();
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const hasPassword = data.loginMethods.includes('EMAIL');

  if (!hasPassword) {
    return (
      <SettingsSection id={`${id}-title`} title="비밀번호">
        <p className="text-sm text-muted">{data.loginMethods.map((method) => LOGIN_METHOD_LABEL[method]).join(', ')}으로 로그인해서 Pick Team 비밀번호가 없어요. 비밀번호는 그 서비스에서 관리해 주세요.</p>
      </SettingsSection>
    );
  }

  const errors = {
    current: touched && !current ? '지금 비밀번호를 입력해 주세요.' : undefined,
    next: touched && !isPasswordValid(next, 'signup') ? '아래 조건을 모두 채워 주세요.' : touched && next === current ? '지금 비밀번호와 달라야 해요.' : undefined,
    confirm: touched && confirm !== next ? '새 비밀번호와 같게 입력해 주세요.' : undefined,
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    const valid = current && isPasswordValid(next, 'signup') && next !== current && confirm === next;
    if (!valid) {
      const field = !current ? 'current' : !isPasswordValid(next, 'signup') || next === current ? 'next' : 'confirm';
      requestAnimationFrame(() => document.getElementById(`${id}-${field}`)?.focus());
      return;
    }
    if (await attempt(() => change.mutateAsync({ current, next }), '비밀번호를 바꿨어요. 다음 로그인부터 새 비밀번호를 써요.')) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setTouched(false);
    }
  };

  return (
    <SettingsSection id={`${id}-title`} title="비밀번호 변경">
      <form onSubmit={submit} noValidate className="max-w-md space-y-4">
        <PasswordField id={`${id}-current`} label="지금 비밀번호" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} error={errors.current} />
        <div>
          <PasswordField
            id={`${id}-next`}
            label="새 비밀번호"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            error={errors.next}
            aria-describedby={`${id}-rules`}
          />
          <PasswordChecklist id={`${id}-rules`} value={next} policy="signup" />
        </div>
        <PasswordField id={`${id}-confirm`} label="새 비밀번호 확인" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} error={errors.confirm} />
        <Button type="submit" loading={change.isPending}>
          비밀번호 바꾸기
        </Button>
      </form>
    </SettingsSection>
  );
};

/**
 * 계정 삭제(17 §6.4). 워크스페이스를 나갈 수 없는 상태(개설자, 팀원이 있는 팀장)면 먼저 할 일을 보이고 막는다.
 * 이메일 계정은 비밀번호, 소셜 계정은 이메일을 다시 입력해 확인한다.
 */
export const DeleteAccountSection: React.FC<{ data: MyData }> = ({ data }) => {
  const id = useId();
  const navigate = useNavigate();
  const remove = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();
  const byPassword = data.loginMethods.includes('EMAIL');
  const blocked = data.deletionBlockers.length > 0;
  useEffect(() => {
    if (open) {
      setConfirm('');
      setError(undefined);
    }
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!confirm.trim()) {
      setError(byPassword ? '비밀번호를 입력해 주세요.' : '이메일을 입력해 주세요.');
      return;
    }
    try {
      await remove.mutateAsync(confirm);
      toast.success('계정을 삭제했어요. 그동안 함께해 줘서 고마워요.');
      navigate('/login', { replace: true });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  return (
    <SettingsSection id={`${id}-title`} title="계정 삭제" tone="danger" description="모든 워크스페이스에서 나가고 PR 카드, 로그인 정보, 알림이 바로 지워져요. 되돌릴 수 없어요.">
      {blocked ? (
        <div role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-warning ring-1 ring-inset ring-amber-200">
          <p className="flex items-center gap-1.5 font-semibold">
            <ExclamationTriangleIcon className="h-4 w-4" aria-hidden="true" />
            삭제하기 전에 먼저 해 주세요
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {data.deletionBlockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted">보낸 메시지와 게시글은 팀 기록으로 남고, 30일 뒤 작성자가 "탈퇴한 사용자"로 바뀌어요.</p>
      )}
      <Button className="mt-3" variant="danger" disabled={blocked} onClick={() => setOpen(true)}>
        계정 삭제
      </Button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        preventClose={remove.isPending}
        title="계정을 삭제할까요?"
        description="삭제하면 되돌릴 수 없어요. 같은 이메일로 다시 가입할 수는 있어요."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={remove.isPending}>
              취소
            </Button>
            <Button type="submit" form={`${id}-form`} variant="danger" loading={remove.isPending}>
              삭제하기
            </Button>
          </>
        }
      >
        <form id={`${id}-form`} onSubmit={submit} noValidate>
          {byPassword ? (
            <PasswordField label="확인을 위해 비밀번호를 입력해 주세요" autoComplete="current-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} error={error} />
          ) : (
            <Input label="확인을 위해 이메일을 입력해 주세요" type="email" autoComplete="email" value={confirm} onChange={(event) => setConfirm(event.target.value)} error={error} help={data.account.email} />
          )}
        </form>
      </Modal>
    </SettingsSection>
  );
};
