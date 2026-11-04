import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BuildingOffice2Icon, PlusIcon } from '@heroicons/react/24/outline';
import { INVITE_CODE_PATTERN, WORKSPACE_LIMITS, extractInviteCode, validateWorkspaceName, validateWorkspacePassword } from '@/renewal/domain/auth';
import { data } from '@/renewal/data';
import { keys, useMe, useMyWorkspaces } from '@/renewal/data/queries';
import { Button, Input, Modal, toast } from '@/renewal/ui';
import { workspaceEntryPath } from '@/renewal/shell/entry';
import { PasswordField } from './AuthUi';
import { josa } from '@/renewal/domain/josa';

const CreateWorkspaceModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const client = useQueryClient();
  const me = useMe();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; password?: string; form?: string }>({});
  const [pending, setPending] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName('');
    setPassword('');
    setErrors({});
  }, [open]);

  const submit = async () => {
    const found = { name: validateWorkspaceName(name), password: validateWorkspacePassword(password) };
    setErrors(found);
    if (found.name) return document.getElementsByName('workspaceName')[0]?.focus();
    if (found.password) return document.getElementsByName('workspacePassword')[0]?.focus();
    setPending(true);
    try {
      const workspace = await data.workspaces.create({ name: name.trim(), password: password || undefined });
      await client.invalidateQueries({ queryKey: keys.workspaces });
      toast.success(`${josa(workspace.name, '을/를')} 만들었어요.`);
      onClose();
      // 개설자는 처음 들어올 때 대시보드로 간다(02-D4).
      navigate(workspaceEntryPath(me.data?.id, workspace));
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : '워크스페이스를 만들지 못했어요. 다시 시도해 주세요.' });
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      preventClose={pending}
      title="새 워크스페이스 만들기"
      description="만든 사람이 개설자가 되고, 30일 동안 쓸 수 있는 초대 링크가 함께 만들어져요."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button onClick={submit} loading={pending}>
            만들기
          </Button>
        </>
      }
    >
      {errors.form && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
          {errors.form}
        </p>
      )}
      <div className="space-y-4">
        <Input label="워크스페이스 이름" name="workspaceName" value={name} maxLength={WORKSPACE_LIMITS.nameMax} onChange={(event) => setName(event.target.value)} error={errors.name} help="예: 2026 동계 부트캠프" />
        <PasswordField
          label="합류 비밀번호 (선택)"
          name="workspacePassword"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          help={`정하면 초대 링크로 들어온 사람도 비밀번호를 입력해야 합류할 수 있어요. ${WORKSPACE_LIMITS.passwordMin}자 이상으로 정해 주세요.`}
        />
      </div>
    </Modal>
  );
};

/**
 * SCR-WS-04 무소속 랜딩(10 §4.6). 초대 코드로 참여하거나 새 워크스페이스를 만든다.
 * 이미 워크스페이스가 있는 사람도 WS 레일의 추가 버튼으로 들어와 같은 일을 할 수 있다.
 * 초대 코드는 확인만 하고 초대 랜딩으로 넘겨 비밀번호 입력과 합류를 한곳에서 처리한다.
 */
export const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const me = useMe();
  const workspaces = useMyWorkspaces();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasWorkspace = Boolean(workspaces.data?.length);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = extractInviteCode(code);
    if (!INVITE_CODE_PATTERN.test(value)) {
      setError(value ? '초대 코드는 영문, 숫자, 하이픈(-), 밑줄(_)로 되어 있어요.' : '초대 코드를 입력해 주세요.');
      return inputRef.current?.focus();
    }
    setChecking(true);
    try {
      await data.invites.get(value);
      navigate(`/invite/${encodeURIComponent(value)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '초대 코드를 확인하지 못했어요. 다시 시도해 주세요.');
      inputRef.current?.focus();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      <div className="text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
          <BuildingOffice2Icon className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold leading-8">{hasWorkspace ? '워크스페이스 참여·만들기' : `${me.data?.name ?? ''}님이 참여한 워크스페이스가 없어요`}</h1>
        <p className="mt-1.5 text-[0.9375rem] text-muted">강사에게 받은 초대 코드나 링크로 참여하거나, 직접 워크스페이스를 만들 수 있어요.</p>
      </div>

      <form onSubmit={submit} noValidate className="mt-8 rounded-card border border-outline-soft bg-surface p-5">
        <label htmlFor="invite-code" className="mb-1.5 block text-sm font-semibold">
          초대 코드 또는 링크
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            id="invite-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'invite-code-error' : undefined}
            placeholder="예: SUMMER26"
            autoComplete="off"
            className={`block min-h-touch w-full min-w-0 flex-1 rounded-lg border bg-surface px-3 py-2.5 text-[0.9375rem] focus:outline-none focus:ring-2 ${
              error ? 'border-2 border-danger focus:ring-danger/30' : 'border-outline focus:border-primary focus:ring-primary/30'
            }`}
          />
          <Button type="submit" loading={checking}>
            참여하기
          </Button>
        </div>
        {error && (
          <p id="invite-code-error" className="mt-1.5 text-sm text-danger">
            {error}
          </p>
        )}
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-outline-soft" />
        또는
        <span className="h-px flex-1 bg-outline-soft" />
      </div>

      <Button variant="outline" className="w-full" leftIcon={<PlusIcon className="h-5 w-5" />} onClick={() => setCreating(true)}>
        새 워크스페이스 만들기
      </Button>
      <CreateWorkspaceModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
};
