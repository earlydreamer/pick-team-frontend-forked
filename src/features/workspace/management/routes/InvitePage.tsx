import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { EnvelopeOpenIcon } from '@heroicons/react/24/outline';
import { buttonClassName, LoadingState } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/core/hooks/useWorkspace';
import { JoinWorkspaceForm } from '../components/WorkspaceForms';

/**
 * 초대 링크(/invite/:inviteCode) 진입 화면.
 * 예전처럼 주소만 열어도 자동으로 참여시키지 않고, 사용자가 확인한 뒤 참여합니다.
 */
export const InvitePage: React.FC = () => {
  const { inviteCode = '' } = useParams<{ inviteCode: string }>();
  const { workspaces, loading } = useWorkspace();
  const code = decodeURIComponent(inviteCode);
  const joined = workspaces.find((ws) => ws.inviteCode === code || ws.url === code);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-md flex-col justify-center px-4 py-10 lg:min-h-screen">
      <div className="rounded-modal border border-outline-soft bg-surface p-6 sm:p-8">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container" aria-hidden="true">
          <EnvelopeOpenIcon className="h-6 w-6" />
        </span>
        {loading ? (
          <LoadingState compact label="참여 중인 워크스페이스를 확인하는 중이에요" />
        ) : joined ? (
          <>
            <h1 className="mt-4 text-2xl font-bold leading-8">이미 참여한 워크스페이스예요</h1>
            <p className="mt-2 text-[0.9375rem] leading-6 text-muted">{joined.name}에서 하던 일을 이어서 할 수 있어요.</p>
            <Link to={`/ws/${joined.id}`} className={buttonClassName('primary', 'lg', 'mt-6 w-full')}>
              {joined.name}로 이동
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-2xl font-bold leading-8">워크스페이스에 초대받았어요</h1>
            <p className="mb-6 mt-2 text-[0.9375rem] leading-6 text-muted">
              참여하면 워크스페이스 멤버에게 내 프로필이 보이고 팀 빌딩에 참여할 수 있어요.
            </p>
            <JoinWorkspaceForm initialInviteCode={code} submitLabel="참여하기" />
          </>
        )}
      </div>
      <p className="mt-6 text-center text-sm">
        <Link to="/" className="font-semibold text-primary underline-offset-4 hover:underline">
          나중에 할게요
        </Link>
      </p>
    </div>
  );
};
