import React from 'react';
import { EnvelopeOpenIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import { useWorkspace } from '@/features/workspace/core/hooks/useWorkspace';
import { LoadingState } from '@/components/ui';
import { CreateWorkspaceForm, JoinWorkspaceForm } from '@/features/workspace/management/components/WorkspaceForms';

const Option: React.FC<{ icon: React.ReactNode; title: string; description: string; children: React.ReactNode; headingId: string }> = ({
  icon,
  title,
  description,
  children,
  headingId,
}) => (
  <section aria-labelledby={headingId} className="flex flex-col rounded-modal border border-outline-soft bg-surface p-6 sm:p-7">
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary-container text-on-primary-container" aria-hidden="true">
      {icon}
    </span>
    <h2 id={headingId} className="mt-4 text-lg font-bold leading-7">
      {title}
    </h2>
    <p className="mb-5 mt-1 text-sm leading-5 text-muted">{description}</p>
    <div className="mt-auto">{children}</div>
  </section>
);

/**
 * 소속 워크스페이스가 없을 때의 합류 화면.
 * 팀원은 초대 코드로 참여하고, 강사·운영자는 워크스페이스를 만듭니다.
 */
const EmptyWorkspacePage: React.FC = () => {
  const { currentUser } = useAuth();
  const { loading } = useWorkspace();

  if (loading) return <LoadingState className="min-h-[60vh]" label="워크스페이스를 확인하는 중이에요" />;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:py-16">
      <h1 className="text-2xl font-bold leading-8 tracking-[-0.02em] sm:text-[1.75rem] sm:leading-9">
        {currentUser?.name ? `${currentUser.name}님, ` : ''}참여할 워크스페이스를 정해 주세요
      </h1>
      <p className="mt-2 text-[0.9375rem] leading-6 text-muted">워크스페이스에 들어가면 멤버를 둘러보고 팀을 꾸릴 수 있어요.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Option
          headingId="join-heading"
          icon={<EnvelopeOpenIcon className="h-6 w-6" />}
          title="초대받은 워크스페이스에 참여"
          description="강사나 팀장에게 받은 초대 링크·코드로 참여해요."
        >
          <JoinWorkspaceForm />
        </Option>
        <Option
          headingId="create-heading"
          icon={<BuildingOffice2Icon className="h-6 w-6" />}
          title="새 워크스페이스 만들기"
          description="과정이나 조직을 운영한다면 직접 만들고 멤버를 초대해요."
        >
          <CreateWorkspaceForm submitVariant="secondary" />
        </Option>
      </div>
    </div>
  );
};

export default EmptyWorkspacePage;
