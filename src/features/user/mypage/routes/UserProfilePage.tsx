import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Button, ErrorState, LoadingState, buttonClassName } from '@/components/ui';
import { userApi } from '@/lib/userApi';
import { getErrorMessage, getErrorStatus } from '@/lib/errorMessage';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import type { User } from '@/features/user/types/user';
import { ProfileCard } from '../components/ProfileCard';

type State = { status: 'loading' } | { status: 'error'; message: string; notFound: boolean } | { status: 'ready'; user: User };

/** 다른 사용자의 프로필(PR 카드). 예전에는 하드코딩된 가상 사용자를 보여 줬습니다. */
export const UserProfileViewPage: React.FC = () => {
  const { userId = '' } = useParams<{ userId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const response = await userApi.getUserProfile(userId);
      setState({ status: 'ready', user: response.data as User });
    } catch (error) {
      const status = getErrorStatus(error);
      setState({
        status: 'error',
        notFound: status === 404 || status === 400,
        message: getErrorMessage(error, '네트워크 상태를 확인한 뒤 다시 시도해 주세요.'),
      });
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const isMe = currentUser && String(currentUser.id) === String(userId);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-10">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        className="mb-4 inline-flex min-h-touch items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
        뒤로
      </button>

      {state.status === 'loading' && <LoadingState className="min-h-[40vh]" label="프로필을 불러오는 중이에요" />}
      {state.status === 'error' && (
        <ErrorState
          className="min-h-[40vh]"
          title={state.notFound ? '프로필을 찾을 수 없어요' : '프로필을 불러오지 못했어요'}
          description={state.notFound ? '탈퇴했거나 주소가 잘못된 사용자예요.' : state.message}
          action={state.notFound ? undefined : <Button onClick={load}>다시 시도</Button>}
        />
      )}
      {state.status === 'ready' && (
        <section className="rounded-modal border border-outline-soft bg-surface p-6 sm:p-8">
          <ProfileCard user={state.user} headingLevel="h1" />
          {isMe && (
            <div className="mt-6 flex justify-end border-t border-outline-soft pt-5">
              <Link to="/my-page/profile-edit" className={buttonClassName('outline')}>
                내 프로필 편집
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
