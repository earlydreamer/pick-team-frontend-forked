import React, { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { safeRedirect } from '@/renewal/domain/auth';
import { CONSENT_MIN_VERSION, agreementKeysFor, consentState, missingAgreement, noAgreements, type Agreements } from '@/renewal/domain/policy';
import { data } from '@/renewal/data';
import { useAgreePolicies, usePolicyConsent } from '@/renewal/data/queries';
import { Button, LoadingState } from '@/renewal/ui';
import { AuthLayout, FormError } from '@/renewal/features/auth/AuthUi';
import { errorMessage } from '@/renewal/features/teamSpace/TaskModals';
import { AgreementChecklist } from './AgreementChecklist';

const formatDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

/**
 * 첫 화면 전 약관 동의(17 §6.2). 소셜 로그인으로 처음 들어온 계정처럼 동의 기록이 없을 때 온다.
 * 동의 내용이 바뀌는 개정(CONSENT_MIN_VERSION) 이전에 동의한 계정도 여기로 와서 약관과 개인정보 처리방침에 다시 동의한다.
 * 동의하지 않으려면 로그아웃할 수 있다.
 */
export const AgreementsScreen: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const consent = usePolicyConsent(true);
  const agree = useAgreePolicies();
  const [value, setValue] = useState<Agreements>(noAgreements());
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const target = safeRedirect(params.get('redirect')) ?? '/';

  if (consent.isLoading) return <LoadingState className="min-h-screen" />;
  const state = consentState(consent.data);
  if (state === 'current') return <Navigate to={target} replace />;
  const renewing = state === 'outdated';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = missingAgreement(renewing ? { ...value, age: true } : value);
    setError(problem);
    if (problem) return document.getElementsByName('agree-all')[0]?.focus();
    try {
      await agree.mutateAsync(value);
      navigate(target, { replace: true });
    } catch (reason) {
      setFormError(errorMessage(reason));
    }
  };

  return (
    <AuthLayout
      title={renewing ? '약관이 바뀌었어요' : '시작하기 전에 확인해 주세요'}
      description={renewing ? `${formatDate(CONSENT_MIN_VERSION)}부터 바뀐 이용약관과 개인정보 처리방침을 확인하고 다시 동의해 주세요.` : 'Pick Team을 쓰려면 아래 항목에 동의해야 해요.'}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={formError} />
        <AgreementChecklist value={value} onChange={setValue} error={error} keys={agreementKeysFor(state)} />
        <Button type="submit" className="w-full" loading={agree.isPending}>
          {renewing ? '동의하고 계속하기' : '동의하고 시작하기'}
        </Button>
        <button
          type="button"
          className="w-full text-center text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink"
          onClick={async () => {
            await data.session.signOut();
            client.clear();
            navigate('/login', { replace: true });
          }}
        >
          동의하지 않고 로그아웃
        </button>
      </form>
    </AuthLayout>
  );
};
