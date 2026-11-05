import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDaysIcon, ExclamationTriangleIcon, UserIcon } from '@heroicons/react/24/outline';
import { cardStatus } from '@/renewal/domain/card';
import { DataError, data } from '@/renewal/data';
import { consentState } from '@/renewal/domain/policy';
import { useInvite, useMe, usePolicyConsent } from '@/renewal/data/queries';
import { Button, ErrorState, LoadingState, buttonClassName, toast } from '@/renewal/ui';
import { AuthLayout, FormError, MockHint, PasswordField } from './AuthUi';
import { clearPendingInvite, savePendingInvite } from './pendingInvite';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

/**
 * SCR-AUTH-04 초대 랜딩(10 §4.4). 어디에 초대받았는지 먼저 보여 주고 가입·로그인으로 나눈다.
 * 초대 코드는 sessionStorage에 보존해 어떤 인증 경로를 거쳐도 이 화면으로 돌아와 합류를 마친다(10 §5.2).
 * 로그인 상태에서는 참여 버튼 하나만 보여 주고, ?join=1로 돌아오면 비밀번호가 없는 한 바로 합류한다.
 * 약관 동의가 없거나 개정 이전이면(소셜 첫 로그인 등) 합류보다 동의를 먼저 받고 ?join=1로 돌아온다(17 §6.2).
 */
export const InviteScreen: React.FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const me = useMe();
  const invite = useInvite(code);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ field?: string; form?: string; blocked?: boolean }>({});
  const [joining, setJoining] = useState(false);
  const autoTried = useRef(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const loggedIn = Boolean(me.data);
  const consent = usePolicyConsent(loggedIn);
  // 조회에 실패하면 막지 않는다. 합류 요청에서 서버가 다시 확인한다.
  const needsConsent = loggedIn && consent.isSuccess && consentState(consent.data) !== 'current';

  const goToWorkspace = async (workspaceId: string) => {
    client.clear();
    const card = await data.cards.getMine().catch(() => null);
    const written = card && ['PUBLIC', 'PRIVATE'].includes(cardStatus(card));
    // 카드가 없으면 온보딩으로, 이미 있으면 홈으로 간다(10 §4.5 진입 조건).
    navigate(written ? `/ws/${workspaceId}` : `/ws/${workspaceId}/onboarding`, { replace: true });
  };

  const join = async () => {
    if (!invite.data) return;
    if (invite.data.requiresPassword && !password) {
      setError({ field: '워크스페이스 비밀번호를 입력해 주세요.' });
      passwordRef.current?.focus();
      return;
    }
    setJoining(true);
    setError({});
    try {
      const result = await data.invites.join(code, password || undefined);
      clearPendingInvite();
      if (result.alreadyMember) {
        toast.success('이미 참여 중인 워크스페이스예요.');
        client.clear();
        navigate(`/ws/${result.workspaceId}`, { replace: true });
        return;
      }
      toast.success(`${invite.data.workspaceName}에 합류했어요.`);
      await goToWorkspace(result.workspaceId);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '합류하지 못했어요. 다시 시도해 주세요.';
      if (reason instanceof DataError && reason.code === 'INVALID' && invite.data.requiresPassword) {
        setError({ field: message });
        passwordRef.current?.focus();
      } else if (reason instanceof DataError && ['FORBIDDEN', 'GONE', 'NOT_FOUND'].includes(reason.code)) {
        // 다시 시도해도 결과가 같으므로 보존한 코드를 지운다(10 §5.3 차단 멤버).
        clearPendingInvite();
        setError({ form: message, blocked: true });
      } else {
        // 네트워크 오류 등은 코드를 남겨 두고 다시 시도할 수 있게 한다(10 §5.2).
        setError({ form: message });
      }
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => {
    if (invite.data) savePendingInvite(invite.data.code);
  }, [invite.data]);

  // 이미 멤버면 그 워크스페이스로 바로 보낸다(10 §5.3).
  useEffect(() => {
    if (loggedIn && invite.data?.alreadyMember) {
      clearPendingInvite();
      toast.success('이미 참여 중인 워크스페이스예요.');
      navigate(`/ws/${invite.data.workspaceId}`, { replace: true });
    }
  }, [loggedIn, invite.data, navigate]);

  // 인증을 마치고 돌아오면(?join=1) 비밀번호가 없는 워크스페이스는 바로 합류한다.
  useEffect(() => {
    if (autoTried.current || !loggedIn || needsConsent || consent.isLoading || !invite.data || invite.data.alreadyMember || invite.data.requiresPassword || params.get('join') !== '1') return;
    autoTried.current = true;
    void join();
    // join은 최신 상태를 읽는 핸들러라 의존성에서 뺀다.
  }, [loggedIn, needsConsent, consent.isLoading, invite.data, params]);

  if (invite.isLoading || me.isLoading || (loggedIn && consent.isLoading)) return <LoadingState className="min-h-screen" label="초대 정보를 확인하는 중이에요" />;

  if (invite.isError) {
    const expired = invite.error instanceof DataError && (invite.error.code === 'GONE' || invite.error.code === 'NOT_FOUND');
    if (!expired) {
      return (
        <ErrorState
          className="min-h-screen"
          title="초대 정보를 불러오지 못했어요"
          description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
          action={<Button onClick={() => invite.refetch()}>다시 시도</Button>}
        />
      );
    }
    return (
      <AuthLayout title={invite.error instanceof DataError && invite.error.code === 'GONE' ? '만료된 초대 링크예요' : '초대 링크를 찾을 수 없어요'}>
        <p className="flex items-start gap-2 text-[0.9375rem] leading-6">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
          강사에게 새 초대 링크를 요청해 주세요.
        </p>
        <Link to="/" className={buttonClassName('outline', 'md', 'mt-6 w-full')}>
          Pick Team 첫 화면으로
        </Link>
      </AuthLayout>
    );
  }

  const info = invite.data!;
  if (loggedIn && info.alreadyMember) return <LoadingState className="min-h-screen" label="워크스페이스로 이동하는 중이에요" />;
  if (needsConsent) return <Navigate to={`/agreements?redirect=${encodeURIComponent(`/invite/${info.code}?join=1`)}`} replace />;
  const authQuery = `?redirect=${encodeURIComponent(`/invite/${info.code}`)}`;

  return (
    <AuthLayout title={`${info.workspaceName}에 초대받았어요`}>
      <dl className="space-y-2 rounded-card bg-surface-low px-4 py-3 text-[0.9375rem]">
        <div className="flex items-center gap-2">
          <UserIcon className="h-5 w-5 text-muted" aria-hidden="true" />
          <dt className="text-muted">개설자</dt>
          <dd className="font-semibold">{info.ownerName}</dd>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="h-5 w-5 text-muted" aria-hidden="true" />
          <dt className="text-muted">링크 만료</dt>
          <dd className="font-semibold">{info.expiresAt ? `${formatDate(info.expiresAt)}까지` : '만료 없음'}</dd>
        </div>
      </dl>

      <div className="mt-6">
        <FormError message={error.form} />
        {loggedIn ? (
          error.blocked ? (
            <Link to="/" className={buttonClassName('outline', 'md', 'w-full')}>
              Pick Team 첫 화면으로
            </Link>
          ) : (
            <form
              noValidate
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void join();
              }}
            >
              {info.requiresPassword && (
                <>
                  <PasswordField
                    ref={passwordRef}
                    label="워크스페이스 비밀번호"
                    name="workspacePassword"
                    autoComplete="off"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    error={error.field}
                    help="개설자가 비밀번호를 걸어 둔 워크스페이스예요."
                  />
                  <MockHint>UX 리서치 스터디의 비밀번호는 study예요.</MockHint>
                </>
              )}
              <Button type="submit" className="w-full" loading={joining}>
                이 워크스페이스에 참여하기
              </Button>
              <p className="text-center text-sm text-muted">{me.data?.name}님 계정으로 참여해요.</p>
            </form>
          )
        ) : (
          <div className="grid gap-2">
            <Link to={`/signup${authQuery}`} className={buttonClassName('primary', 'md', 'w-full')}>
              가입하고 참여하기
            </Link>
            <Link to={`/login${authQuery}`} className={buttonClassName('outline', 'md', 'w-full')}>
              로그인하고 참여하기
            </Link>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};
