import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon, CameraIcon, CheckCircleIcon, PencilSquareIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import { useAuth } from '@/features/user/auth/context/AuthContext';
import { Avatar, Button, Input, LoadingState, TextArea, buttonClassName, fieldClassName } from '@/components/ui';
import { getErrorMessage, getErrorStatus } from '@/lib/errorMessage';
import { userApi as userServiceApi } from '@/lib/userApi';
import { FormMessage } from '@/features/user/auth/components/AuthLayout';
import { PasswordField } from '@/features/user/auth/components/PasswordField';
import { PasswordRules } from '@/features/user/auth/components/PasswordRules';
import { isPasswordValid } from '@/features/user/auth/lib/passwordPolicy';
import type { User } from '@/features/user/types/user';
import { userApi } from '../api/userApi';
import { ProfileCard } from '../components/ProfileCard';
import { HashtagInput } from '../components/HashtagInput';
import { MBTI_TYPES, NAME_PATTERN, PROFILE_LIMITS, completenessItems, profileFields, safeHttpUrl } from '../lib/profile';

const PageShell: React.FC<{ children: React.ReactNode; wide?: boolean }> = ({ children, wide }) => (
  <div className={`mx-auto w-full px-4 py-6 sm:px-6 lg:px-10 lg:py-10 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>{children}</div>
);

const BackLink: React.FC<{ to: string; label: string }> = ({ to, label }) => (
  <Link to={to} className="mb-4 inline-flex min-h-touch items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
    <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
    {label}
  </Link>
);

/** 앱 안에서만 이동하도록 from 파라미터를 제한합니다(외부 주소로 보내는 열린 리디렉션 방지). */
const safeReturnPath = (value: string | null) => (value && value.startsWith('/') && !value.startsWith('//') ? value : null);

/* ───────────────────────── 내 프로필 ───────────────────────── */

export const MyPage: React.FC = () => {
  const { currentUser } = useAuth();
  if (!currentUser) return <LoadingState className="min-h-[60vh]" />;

  const items = completenessItems(currentUser);
  const done = items.filter((item) => item.done).length;

  return (
    <PageShell wide>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold leading-8 tracking-[-0.02em] sm:text-[1.75rem] sm:leading-9">내 프로필</h1>
          <p className="mt-1 text-[0.9375rem] text-muted">워크스페이스 멤버에게 이렇게 보여요.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/my-page/account-settings" className={buttonClassName('outline')}>
            <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" />
            계정 설정
          </Link>
          <Link to="/my-page/profile-edit" className={buttonClassName('primary')}>
            <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
            프로필 편집
          </Link>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-label="프로필 카드" className="rounded-modal border border-outline-soft bg-surface p-6 sm:p-8">
          <ProfileCard user={currentUser} emptyMessage="자기소개와 협업 방식을 채우면 팀원이 나를 판단하기 쉬워요." />
        </section>

        <aside aria-labelledby="completeness-heading" className="h-fit rounded-card border border-outline-soft bg-surface p-5">
          <h2 id="completeness-heading" className="flex items-baseline justify-between font-bold">
            프로필 항목
            <span className="text-sm font-semibold text-muted tabular-nums">
              {done}/{items.length} 채움
            </span>
          </h2>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-container" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(done / items.length) * 100}%` }} />
          </div>
          <ul className="mt-4 space-y-2">
            {items.map((item) => (
              <li key={item.id} className={`flex items-center gap-2 text-sm ${item.done ? 'text-ink' : 'text-muted'}`}>
                {item.done ? (
                  <CheckCircleSolidIcon className="h-5 w-5 text-success" aria-hidden="true" />
                ) : (
                  <span className="mx-0.5 h-4 w-4 rounded-full border-[1.5px] border-outline" aria-hidden="true" />
                )}
                {item.label}
                <span className="sr-only">{item.done ? '채움' : '비어 있음'}</span>
              </li>
            ))}
          </ul>
          {done < items.length && (
            <Link to="/my-page/profile-edit" className={buttonClassName('secondary', 'md', 'mt-5 w-full')}>
              빈 항목 채우기
            </Link>
          )}
        </aside>
      </div>
    </PageShell>
  );
};

/* ───────────────────────── 프로필 편집 ───────────────────────── */

type Draft = {
  name: string;
  age: string;
  mbti: string;
  introduction: string;
  hashtags: string[];
  disposition: string;
  preferWorkstyle: string;
  dislikeWorkstyle: string;
  portfolio: string;
};

const toDraft = (user: User): Draft => {
  const fields = profileFields(user);
  return {
    name: user.name ?? '',
    age: user.age ? String(user.age) : '',
    mbti: user.mbti ?? '',
    introduction: fields.introduction,
    hashtags: fields.hashtags,
    disposition: fields.disposition,
    preferWorkstyle: fields.preferWorkstyle,
    dislikeWorkstyle: fields.dislikeWorkstyle,
    portfolio: fields.portfolio,
  };
};

const validate = (draft: Draft) => {
  const errors: Partial<Record<keyof Draft, string>> = {};
  const name = draft.name.trim();
  if (name.length < PROFILE_LIMITS.nameMin || name.length > PROFILE_LIMITS.nameMax) errors.name = '이름은 2–50자로 입력해 주세요.';
  else if (!NAME_PATTERN.test(name)) errors.name = '이름에는 한글, 영문, 숫자, 공백만 쓸 수 있어요.';
  if (draft.age && (!/^\d+$/.test(draft.age) || Number(draft.age) > 225)) errors.age = '나이는 0–225 사이의 숫자로 입력해 주세요.';
  if (draft.portfolio.trim() && !safeHttpUrl(draft.portfolio)) errors.portfolio = 'https://로 시작하는 전체 주소를 입력해 주세요.';
  return errors;
};

const Fieldset: React.FC<{ legend: string; description?: string; children: React.ReactNode }> = ({ legend, description, children }) => (
  <fieldset className="rounded-modal border border-outline-soft bg-surface p-5 sm:p-6">
    <legend className="sr-only">{legend}</legend>
    <h2 className="text-lg font-bold" aria-hidden="true">
      {legend}
    </h2>
    {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
    <div className="mt-5 space-y-5">{children}</div>
  </fieldset>
);

const counter = (value: string, max: number) => `${value.length}/${max}자`;

export const ProfileEditPage: React.FC = () => {
  const { currentUser, updateUserProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnPath = safeReturnPath(searchParams.get('from'));
  const isOnboarding = searchParams.get('onboarding') === '1';

  const [draft, setDraft] = useState<Draft | null>(currentUser ? toDraft(currentUser) : null);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<{ pending: boolean; error: string | null; message: string | null }>({ pending: false, error: null, message: null });
  const fileRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser && !draft) setDraft(toDraft(currentUser));
  }, [currentUser, draft]);

  const previewUser = useMemo<User | null>(
    () =>
      currentUser && draft
        ? {
            ...currentUser,
            name: draft.name,
            age: draft.age ? Number(draft.age) : undefined,
            mbti: draft.mbti || undefined,
            introduction: draft.introduction,
            hashtags: draft.hashtags,
            disposition: draft.disposition,
            preferWorkstyle: draft.preferWorkstyle,
            dislikeWorkstyle: draft.dislikeWorkstyle,
            portfolio: draft.portfolio,
            bio: undefined,
            portfolioUrl: undefined,
          }
        : null,
    [currentUser, draft],
  );

  if (!currentUser || !draft || !previewUser) return <LoadingState className="min-h-[60vh]" />;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };
  const text = (key: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    set(key, event.target.value as never);

  const handlePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhoto({ pending: false, error: '이미지 파일(JPG, PNG 등)을 골라 주세요.', message: null });
      return;
    }
    setPhoto({ pending: true, error: null, message: null });
    try {
      const imageUrl = await userApi.uploadProfileImage(file);
      updateUserProfile({ profileImageUrl: imageUrl });
      await refreshProfile();
      setPhoto({ pending: false, error: null, message: '사진을 바꿨어요.' });
    } catch (error) {
      setPhoto({ pending: false, error: getErrorMessage(error, '사진을 올리지 못했어요. 파일 크기와 형식을 확인해 주세요.'), message: null });
    }
  };

  const removePhoto = async () => {
    setPhoto({ pending: true, error: null, message: null });
    try {
      await userServiceApi.deleteProfileImage();
      updateUserProfile({ profileImageUrl: null });
      await refreshProfile();
      setPhoto({ pending: false, error: null, message: '사진을 삭제했어요.' });
    } catch (error) {
      setPhoto({ pending: false, error: getErrorMessage(error, '사진을 삭제하지 못했어요. 다시 시도해 주세요.'), message: null });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaveError(null);
    const found = validate(draft);
    setErrors(found);
    const firstInvalid = Object.keys(found)[0];
    if (firstInvalid) {
      document.querySelector<HTMLElement>(`[name="profile-${firstInvalid}"]`)?.focus();
      return;
    }
    setSaving(true);
    try {
      await userApi.updateUserProfile({
        name: draft.name.trim(),
        age: draft.age ? Number(draft.age) : undefined,
        mbti: draft.mbti,
        introduction: draft.introduction.trim(),
        hashtags: draft.hashtags,
        disposition: draft.disposition.trim(),
        preferWorkstyle: draft.preferWorkstyle.trim(),
        dislikeWorkstyle: draft.dislikeWorkstyle.trim(),
        portfolio: draft.portfolio.trim(),
      });
      await refreshProfile();
      navigate(returnPath ?? '/my-page', { replace: true });
    } catch (error) {
      setSaveError(getErrorMessage(error, '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell wide>
      {!isOnboarding && <BackLink to={returnPath ?? '/my-page'} label="돌아가기" />}
      <h1 className="text-2xl font-bold leading-8 tracking-[-0.02em] sm:text-[1.75rem] sm:leading-9">
        {isOnboarding ? '나를 알려 주세요' : '프로필 편집'}
      </h1>
      <p className="mt-1 text-[0.9375rem] text-muted">팀원이 함께할 사람을 고를 때 보는 정보예요. 이름 외에는 모두 선택이에요.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSubmit} noValidate className="min-w-0 space-y-5 pb-24">
          {saveError && (
            <div ref={errorRef} tabIndex={-1}>
              <FormMessage tone="error">{saveError}</FormMessage>
            </div>
          )}

          <Fieldset legend="기본 정보">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={draft.name} imageUrl={currentUser.profileImageUrl} size="xl" />
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={handlePhoto} />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} loading={photo.pending} leftIcon={<CameraIcon className="h-4 w-4" />}>
                    {currentUser.profileImageUrl ? '사진 바꾸기' : '사진 올리기'}
                  </Button>
                  {currentUser.profileImageUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={removePhoto} disabled={photo.pending}>
                      사진 삭제
                    </Button>
                  )}
                </div>
                <p className={`text-sm ${photo.error ? 'text-danger' : 'text-muted'}`} role={photo.error ? 'alert' : 'status'}>
                  {photo.error ?? photo.message ?? '사진은 고르면 바로 저장돼요.'}
                </p>
              </div>
            </div>
            <Input label="이름" name="profile-name" required maxLength={PROFILE_LIMITS.nameMax} value={draft.name} error={errors.name} onChange={text('name')} autoComplete="name" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="나이" name="profile-age" inputMode="numeric" value={draft.age} error={errors.age} onChange={(event) => set('age', event.target.value.replace(/\D/g, '').slice(0, 3))} />
              <div>
                <label htmlFor="profile-mbti" className="mb-1.5 block text-sm font-semibold text-ink">
                  MBTI
                </label>
                <select id="profile-mbti" name="profile-mbti" value={draft.mbti} onChange={text('mbti')} className={fieldClassName(false, 'appearance-auto')}>
                  <option value="">선택 안 함</option>
                  {MBTI_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Fieldset>

          <Fieldset legend="소개" description="어떤 사람이고 무엇에 관심이 있는지 적어 주세요.">
            <TextArea
              label="자기소개"
              name="profile-introduction"
              rows={5}
              maxLength={PROFILE_LIMITS.introduction}
              value={draft.introduction}
              help={counter(draft.introduction, PROFILE_LIMITS.introduction)}
              onChange={text('introduction')}
            />
            <HashtagInput value={draft.hashtags} onChange={(tags) => set('hashtags', tags)} />
          </Fieldset>

          <Fieldset legend="협업 방식" description="팀을 꾸릴 때 서로 맞는지 판단하는 데 쓰여요.">
            <TextArea
              label="협업 성향"
              name="profile-disposition"
              rows={3}
              maxLength={PROFILE_LIMITS.disposition}
              placeholder="예: 일정을 먼저 정하고 꼼꼼하게 기록하는 편이에요"
              value={draft.disposition}
              help={counter(draft.disposition, PROFILE_LIMITS.disposition)}
              onChange={text('disposition')}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextArea
                label="이렇게 일하고 싶어요"
                name="profile-preferWorkstyle"
                rows={3}
                maxLength={PROFILE_LIMITS.workstyle}
                value={draft.preferWorkstyle}
                help={counter(draft.preferWorkstyle, PROFILE_LIMITS.workstyle)}
                onChange={text('preferWorkstyle')}
              />
              <TextArea
                label="이런 방식은 피하고 싶어요"
                name="profile-dislikeWorkstyle"
                rows={3}
                maxLength={PROFILE_LIMITS.workstyle}
                value={draft.dislikeWorkstyle}
                help={counter(draft.dislikeWorkstyle, PROFILE_LIMITS.workstyle)}
                onChange={text('dislikeWorkstyle')}
              />
            </div>
          </Fieldset>

          <Fieldset legend="포트폴리오">
            <Input
              label="포트폴리오 주소"
              name="profile-portfolio"
              type="url"
              inputMode="url"
              maxLength={PROFILE_LIMITS.portfolio}
              placeholder="https://github.com/아이디"
              value={draft.portfolio}
              error={errors.portfolio}
              help="GitHub, 노션, 개인 사이트 등 한 곳을 연결해요."
              onChange={text('portfolio')}
            />
          </Fieldset>

          <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t border-outline-soft bg-canvas/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border sm:px-4">
            <Button type="button" variant="outline" onClick={() => navigate(returnPath ?? '/my-page')} disabled={saving}>
              {isOnboarding ? '나중에 할게요' : '취소'}
            </Button>
            <Button type="submit" loading={saving}>
              저장
            </Button>
          </div>
        </form>

        <aside aria-labelledby="preview-heading" className="hidden lg:block">
          <div className="sticky top-6 rounded-modal border border-outline-soft bg-surface p-6">
            <h2 id="preview-heading" className="mb-4 text-sm font-semibold text-muted">
              멤버에게 보이는 모습
            </h2>
            <ProfileCard user={previewUser} />
          </div>
        </aside>
      </div>
    </PageShell>
  );
};

/* ───────────────────────── 계정 설정 ───────────────────────── */

const providerLabel = (provider?: string) => {
  switch (provider?.toUpperCase()) {
    case 'GOOGLE':
      return 'Google 계정';
    case 'KAKAO':
      return '카카오 계정';
    default:
      return '이메일과 비밀번호';
  }
};

export const AccountSettingsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);

  if (!currentUser) return <LoadingState className="min-h-[60vh]" />;

  const isSocial = Boolean(currentUser.provider && currentUser.provider.toUpperCase() !== 'LOCAL');
  const joinedAt = currentUser.createdAt ? new Date(currentUser.createdAt) : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    setResult(null);
    if (!currentPassword || !isPasswordValid(newPassword, 'signup') || newPassword !== confirmPassword) return;
    if (currentPassword === newPassword) {
      setResult({ tone: 'error', message: '새 비밀번호는 지금 비밀번호와 달라야 해요.' });
      return;
    }
    setPending(true);
    try {
      await userApi.changePassword(currentPassword, newPassword);
      setResult({ tone: 'success', message: '비밀번호를 바꿨어요. 다음 로그인부터 새 비밀번호를 사용해요.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTouched(false);
    } catch (error) {
      const status = getErrorStatus(error);
      setResult({
        tone: 'error',
        message: status === 401 ? '지금 비밀번호가 맞지 않아요.' : getErrorMessage(error, '비밀번호를 바꾸지 못했어요. 다시 시도해 주세요.'),
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <PageShell>
      <BackLink to="/my-page" label="내 프로필" />
      <h1 className="text-2xl font-bold leading-8 tracking-[-0.02em] sm:text-[1.75rem] sm:leading-9">계정 설정</h1>

      <section aria-labelledby="account-heading" className="mt-8 rounded-modal border border-outline-soft bg-surface p-5 sm:p-6">
        <h2 id="account-heading" className="text-lg font-bold">
          계정 정보
        </h2>
        <dl className="mt-4 divide-y divide-outline-soft text-[0.9375rem]">
          <div className="flex flex-wrap justify-between gap-2 py-3">
            <dt className="text-muted">이메일</dt>
            <dd className="font-medium">{currentUser.email}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2 py-3">
            <dt className="text-muted">로그인 방식</dt>
            <dd className="font-medium">{providerLabel(currentUser.provider)}</dd>
          </div>
          {joinedAt && !Number.isNaN(joinedAt.getTime()) && (
            <div className="flex flex-wrap justify-between gap-2 py-3">
              <dt className="text-muted">가입일</dt>
              <dd className="font-medium tabular-nums">{joinedAt.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</dd>
            </div>
          )}
        </dl>
      </section>

      <section aria-labelledby="password-heading" className="mt-5 rounded-modal border border-outline-soft bg-surface p-5 sm:p-6">
        <h2 id="password-heading" className="text-lg font-bold">
          비밀번호 변경
        </h2>
        {isSocial ? (
          <p className="mt-2 text-[0.9375rem] leading-6 text-muted">
            {providerLabel(currentUser.provider)}으로 로그인해서 Pick Team 비밀번호가 없어요. 비밀번호는 해당 서비스에서 관리해 주세요.
          </p>
        ) : (
          <form className="mt-5 max-w-md space-y-4" onSubmit={handleSubmit} noValidate>
            {result && <FormMessage tone={result.tone}>{result.message}</FormMessage>}
            <PasswordField
              label="지금 비밀번호"
              name="current-password"
              autoComplete="current-password"
              required
              value={currentPassword}
              error={touched && !currentPassword ? '지금 비밀번호를 입력해 주세요.' : undefined}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <div>
              <PasswordField
                label="새 비밀번호"
                name="new-password"
                autoComplete="new-password"
                required
                value={newPassword}
                error={touched && !isPasswordValid(newPassword, 'signup') ? '아래 조건을 모두 채워 주세요.' : undefined}
                aria-describedby="change-password-rules"
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <PasswordRules id="change-password-rules" value={newPassword} policy="signup" />
            </div>
            <PasswordField
              label="새 비밀번호 확인"
              name="confirm-password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              error={touched && confirmPassword !== newPassword ? '비밀번호가 서로 달라요.' : undefined}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <Button type="submit" loading={pending}>
              비밀번호 바꾸기
            </Button>
          </form>
        )}
      </section>
      <p className="mt-6 flex items-center gap-1.5 text-sm text-muted">
        <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
        프로필 정보는{' '}
        <Link to="/my-page/profile-edit" className="font-semibold text-primary underline-offset-4 hover:underline">
          프로필 편집
        </Link>
        에서 바꿔요.
      </p>
    </PageShell>
  );
};
