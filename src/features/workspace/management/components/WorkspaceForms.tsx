import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/core/hooks/useWorkspace';
import { getErrorMessage } from '@/lib/errorMessage';
import { FormMessage } from '@/features/user/auth/components/AuthLayout';
import { describeJoinError, parseInviteInput } from '../lib/inviteLink';
import type { Workspace } from '@/types';

interface FormProps {
  /** 성공 후 호출. 기본 동작은 새 워크스페이스 홈으로 이동합니다. */
  onDone?: (workspace: Workspace) => void;
  onCancel?: () => void;
  /** 대화상자 안에서 쓸 때 취소 버튼을 보여 줍니다. */
  showCancel?: boolean;
  initialInviteCode?: string;
  submitLabel?: string;
  /** 같은 화면에 주요 행동이 둘일 때 하나를 보조 버튼으로 낮춥니다. */
  submitVariant?: 'primary' | 'secondary';
  autoFocus?: boolean;
}

const useAfterSuccess = (onDone?: (workspace: Workspace) => void) => {
  const navigate = useNavigate();
  return (workspace: Workspace) => {
    localStorage.setItem('lastAccessedWorkspaceId', String(workspace.id));
    if (onDone) onDone(workspace);
    else navigate(`/ws/${workspace.id}`);
  };
};

/** 초대 링크·코드로 워크스페이스에 참여하는 폼 */
export const JoinWorkspaceForm: React.FC<FormProps> = ({ onDone, onCancel, showCancel, initialInviteCode = '', submitLabel = '참여하기', autoFocus }) => {
  // joinWorkspace가 목록에 새 워크스페이스를 추가하므로 전체 목록을 다시 불러오지 않습니다(로딩 화면으로 폼이 사라지는 것 방지).
  const { joinWorkspace } = useWorkspace();
  const afterSuccess = useAfterSuccess(onDone);
  const [invite, setInvite] = useState(initialInviteCode);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const parsed = parseInviteInput(invite);
    if (!parsed.ok) {
      setError(
        parsed.reason === 'empty'
          ? '초대 링크나 코드를 입력해 주세요.'
          : '워크스페이스 번호로는 참여할 수 없어요. 관리자에게 받은 초대 링크나 코드를 입력해 주세요.',
      );
      inputRef.current?.focus();
      return;
    }
    setPending(true);
    try {
      const workspace = await joinWorkspace({ inviteCode: parsed.code, password: password.trim() || undefined });
      afterSuccess(workspace);
    } catch (err) {
      setError(describeJoinError(getErrorMessage(err, '참여하지 못했어요. 잠시 후 다시 시도해 주세요.')));
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Input
        ref={inputRef}
        label="초대 링크 또는 코드"
        name="invite"
        required
        value={invite}
        placeholder="예: AbC123xy"
        autoComplete="off"
        onChange={(event) => setInvite(event.target.value)}
      />
      <Input
        label="워크스페이스 비밀번호"
        name="workspace-password"
        type="password"
        autoComplete="off"
        value={password}
        help="관리자가 비밀번호를 설정한 경우에만 입력해요."
        onChange={(event) => setPassword(event.target.value)}
      />
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {showCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            취소
          </Button>
        )}
        <Button type="submit" loading={pending} className={showCancel ? '' : 'w-full'}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};

/** 새 워크스페이스를 만드는 폼. 아이콘과 초대 설정은 만든 뒤 워크스페이스 설정에서 바꿔요. */
export const CreateWorkspaceForm: React.FC<FormProps> = ({ onDone, onCancel, showCancel, submitLabel = '워크스페이스 만들기', submitVariant = 'primary', autoFocus }) => {
  const { createWorkspace } = useWorkspace();
  const afterSuccess = useAfterSuccess(onDone);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [nameError, setNameError] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!name.trim()) {
      setNameError('워크스페이스 이름을 입력해 주세요.');
      inputRef.current?.focus();
      return;
    }
    setNameError('');
    setPending(true);
    try {
      const workspace = await createWorkspace({ name: name.trim(), password: password.trim() || undefined });
      afterSuccess(workspace);
    } catch (err) {
      setError(getErrorMessage(err, '워크스페이스를 만들지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Input
        ref={inputRef}
        label="워크스페이스 이름"
        name="workspace-name"
        required
        maxLength={50}
        value={name}
        error={nameError}
        placeholder="예: KOSTA 295기"
        onChange={(event) => setName(event.target.value)}
      />
      <Input
        label="참여 비밀번호"
        name="new-workspace-password"
        type="password"
        autoComplete="new-password"
        value={password}
        help="설정하면 초대 링크를 받은 사람도 비밀번호를 입력해야 참여할 수 있어요."
        onChange={(event) => setPassword(event.target.value)}
      />
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {showCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            취소
          </Button>
        )}
        <Button type="submit" variant={submitVariant} loading={pending} className={showCancel ? '' : 'w-full'}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
