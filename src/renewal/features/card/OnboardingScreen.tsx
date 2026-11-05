import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  CARD_LIMITS,
  cardStatus,
  emptyCard,
  validateCard,
  type CardErrors,
  type PrCard,
} from '@/renewal/domain/card';
import { Button, ErrorState, LoadingState, toast } from '@/renewal/ui';
import { useMe, useMyCard, useSaveMyCard, useWorkspace } from '@/renewal/data/queries';
import { BrandLockup } from '@/renewal/shell/BrandMark';
import { ConsentPanel } from './ConsentPanel';
import { clearDraft, readDraft, writeDraft } from './draft';
import {
  CountedTextArea,
  FieldGroup,
  GoalTemperatureScale,
  HashtagField,
  MbtiSelect,
  OtherRoleInput,
  PortfolioInput,
  RequiredMark,
  RoleRadioField,
  WeeklyHoursChips,
  WorkstyleChips,
} from './fields';

type Step = 1 | 2 | 3;
const STEP_LABELS = ['동의', '필수 입력', '선택 입력'];

const StepIndicator: React.FC<{ step: Step }> = ({ step }) => (
  <ol className="flex items-start" aria-label="작성 단계">
    {STEP_LABELS.map((label, index) => {
      const number = (index + 1) as Step;
      const state = number < step ? 'done' : number === step ? 'current' : 'todo';
      return (
        <li key={label} className="flex flex-1 flex-col items-center gap-1.5" aria-current={state === 'current' ? 'step' : undefined}>
          <div className="flex w-full items-center">
            <span className={`h-0.5 flex-1 ${index === 0 ? 'invisible' : state === 'todo' ? 'bg-outline-soft' : 'bg-primary'}`} aria-hidden="true" />
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
                state === 'todo' ? 'bg-surface-container text-muted' : 'bg-primary text-on-primary'
              }`}
              aria-hidden="true"
            >
              {number}
            </span>
            <span className={`h-0.5 flex-1 ${index === 2 ? 'invisible' : number < step ? 'bg-primary' : 'bg-outline-soft'}`} aria-hidden="true" />
          </div>
          <span className={`text-xs ${state === 'current' ? 'font-semibold text-primary' : 'text-muted'}`}>
            {label}
            {state === 'done' && <span className="sr-only"> (완료)</span>}
          </span>
        </li>
      );
    })}
  </ol>
);

/**
 * SCR-ONB-01 온보딩 위저드(11 §4.2, 목업 onboarding.html).
 * 1단계 동의, 2단계 필수 입력(희망 역할 2개, 주간 가용 시간), 3단계 선택 입력으로 진행한다.
 * 2·3단계 입력은 브라우저에 임시저장해 다시 들어오면 이어서 쓸 수 있다.
 */
export const OnboardingScreen: React.FC = () => {
  const { wsId = '' } = useParams<{ wsId: string }>();
  const navigate = useNavigate();
  const me = useMe();
  const workspace = useWorkspace(wsId);
  const myCard = useMyCard();
  const save = useSaveMyCard();

  const [step, setStep] = useState<Step>(1);
  const [card, setCard] = useState<PrCard>(emptyCard());
  const [errors, setErrors] = useState<CardErrors>({});
  const [restoreNotice, setRestoreNotice] = useState<'restored' | 'failed' | null>(null);
  const [initialized, setInitialized] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const accountId = me.data?.id ?? '';

  // 서버 카드와 임시저장을 합쳐 시작 단계를 정한다.
  useEffect(() => {
    if (initialized || !myCard.data || !accountId) return;
    const status = cardStatus(myCard.data);
    const { draft, failed } = readDraft(accountId, wsId);
    if (status === 'NO_CONSENT') {
      setCard(myCard.data);
      setStep(1);
    } else if (draft) {
      setCard({ ...draft.card, consentGivenAt: myCard.data.consentGivenAt });
      setStep(draft.step);
      setRestoreNotice('restored');
    } else {
      setCard(myCard.data);
      setStep(2);
      if (failed) setRestoreNotice('failed');
    }
    setInitialized(true);
  }, [initialized, myCard.data, accountId, wsId]);

  // 2·3단계 입력을 임시저장한다.
  useEffect(() => {
    if (initialized && accountId && step !== 1) writeDraft(accountId, wsId, { step, card });
  }, [initialized, accountId, wsId, step, card]);

  useEffect(() => {
    if (initialized) headingRef.current?.focus();
  }, [step, initialized]);

  // 이미 카드를 만든 사람은 편집 화면에서 고친다.
  const status = myCard.data ? cardStatus(myCard.data) : null;
  if (!initialized && (status === 'PUBLIC' || status === 'PRIVATE')) return <Navigate to="/me/card" replace />;

  if (me.isLoading || workspace.isLoading || myCard.isLoading || (!initialized && myCard.data)) {
    return <LoadingState className="min-h-screen" label="카드 정보를 불러오는 중이에요" />;
  }
  if (workspace.isError || myCard.isError) {
    return (
      <ErrorState
        className="min-h-screen"
        title="온보딩을 시작하지 못했어요"
        description="워크스페이스에 소속되어 있는지 확인한 뒤 다시 시도해 주세요."
        action={<Button onClick={() => navigate('/')}>홈으로 가기</Button>}
      />
    );
  }
  const home = `/ws/${wsId}`;
  const update = (patch: Partial<PrCard>) => {
    setCard((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      (Object.keys(patch) as (keyof CardErrors)[]).forEach((field) => delete next[field]);
      return next;
    });
  };

  const consent = async () => {
    try {
      const saved = await save.mutateAsync({ ...card, consentGivenAt: new Date().toISOString(), cardVisible: false });
      setCard(saved);
      setStep(2);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '동의를 저장하지 못했어요. 다시 시도해 주세요.');
    }
  };

  const goToOptional = () => {
    const found = validateCard(card, true);
    setErrors(found);
    const first = (['desiredRole1', 'desiredRole2', 'otherRoleText', 'weeklyAvailableHours'] as const).find((field) => found[field]);
    if (first) {
      document.getElementById(`onboarding-${first}`)?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
      return;
    }
    setStep(3);
  };

  /** 3단계를 마치거나 건너뛰면 필수 항목으로 카드를 공개한다(11 §4.2 단계 이탈 처리). */
  const publish = async (mode: 'complete' | 'later') => {
    // 건너뛰더라도 3단계에 입력한 값은 버리지 않고 함께 저장한다.
    const found = validateCard(card);
    setErrors(found);
    if (found.portfolio) {
      document.querySelector<HTMLInputElement>('input[name="portfolio"]')?.focus();
      return;
    }
    try {
      await save.mutateAsync({ ...card, cardVisible: true });
      clearDraft(accountId, wsId);
      if (mode === 'complete') {
        toast.success('카드를 공개했어요. 멤버 카드에서 내 카드를 확인할 수 있어요.');
        navigate(`${home}/members`, { replace: true });
      } else {
        toast.success('필수 항목으로 카드를 공개했어요. 나머지는 내 PR 카드에서 채울 수 있어요.');
        navigate(home, { replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '카드를 저장하지 못했어요. 다시 시도해 주세요.');
    }
  };

  const otherSelected = card.desiredRole1 === 'OTHER' || card.desiredRole2 === 'OTHER';

  return (
    <div className="min-h-screen bg-canvas px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <BrandLockup className="text-base" />
          {workspace.data && <span className="truncate text-sm text-muted">{workspace.data.name}</span>}
        </header>

        <main className="rounded-modal border border-outline-soft bg-surface p-5 sm:p-8">
          <StepIndicator step={step} />

          {restoreNotice && step !== 1 && (
            <div role="status" className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-peri-200 bg-peri-50 px-4 py-3 text-sm">
              <span>{restoreNotice === 'restored' ? '이전에 쓰던 내용을 불러왔어요.' : '이전 임시저장을 불러오지 못했어요. 처음부터 작성해 주세요.'}</span>
              {restoreNotice === 'restored' && (
                <button
                  type="button"
                  className="min-h-touch font-semibold text-primary underline-offset-4 hover:underline"
                  onClick={() => {
                    setCard({ ...emptyCard(), consentGivenAt: card.consentGivenAt });
                    setStep(2);
                    setErrors({});
                    setRestoreNotice(null);
                  }}
                >
                  처음부터 쓰기
                </button>
              )}
            </div>
          )}

          {step === 1 && (
            <section className="mt-8" aria-labelledby="onboarding-heading">
              <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold leading-8 focus:outline-none">
                Pick Team에 오신 걸 환영해요
              </h1>
              <p className="mt-1 text-[0.9375rem] text-muted">{workspace.data?.name}에서 팀을 찾으려면 PR 카드가 필요해요.</p>
              <p className="mb-4 mt-6 font-semibold">카드를 만들기 전에 확인해 주세요.</p>
              <ConsentPanel workspaceName={workspace.data?.name} headingLevel={2} />
              <div className="mt-8 flex flex-wrap justify-end gap-2 border-t border-outline-soft pt-6">
                <Link to={home} className="inline-flex min-h-touch items-center rounded-[10px] border border-outline bg-surface px-4 text-sm font-semibold hover:bg-surface-container">
                  나중에 하기
                </Link>
                <Button onClick={consent} loading={save.isPending}>
                  동의하고 카드 만들기
                </Button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="mt-8" aria-labelledby="onboarding-heading">
              <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1} className="text-xl font-bold leading-7 focus:outline-none">
                필수 항목 2개만 채우면 카드를 공개할 수 있어요
              </h1>
              <div className="mt-6 space-y-8">
                <FieldGroup
                  legend={
                    <>
                      어떤 역할을 맡고 싶나요?
                      <RequiredMark />
                    </>
                  }
                  legendClassName="text-base font-bold"
                  description="1순위와 2순위를 서로 다르게 골라 주세요."
                >
                  <div className="space-y-5">
                    <div id="onboarding-desiredRole1">
                      <RoleRadioField rank={1} value={card.desiredRole1} other={card.desiredRole2} onChange={(role) => update({ desiredRole1: role })} error={errors.desiredRole1} />
                    </div>
                    <div id="onboarding-desiredRole2">
                      <RoleRadioField rank={2} value={card.desiredRole2} other={card.desiredRole1} onChange={(role) => update({ desiredRole2: role })} error={errors.desiredRole2} />
                    </div>
                    {otherSelected && (
                      <div id="onboarding-otherRoleText">
                        <OtherRoleInput value={card.otherRoleText} onChange={(value) => update({ otherRoleText: value })} error={errors.otherRoleText} />
                      </div>
                    )}
                  </div>
                </FieldGroup>

                <div id="onboarding-weeklyAvailableHours">
                  <FieldGroup
                    legend={
                      <>
                        일주일에 얼마나 시간을 낼 수 있나요?
                        <RequiredMark />
                      </>
                    }
                    legendClassName="text-base font-bold"
                    description="팀 빌딩 매칭에 쓰여요."
                    error={errors.weeklyAvailableHours}
                  >
                    <WeeklyHoursChips value={card.weeklyAvailableHours} onChange={(value) => update({ weeklyAvailableHours: value })} />
                  </FieldGroup>
                </div>
              </div>
              <div className="mt-8 flex flex-wrap justify-end gap-2 border-t border-outline-soft pt-6">
                <Button variant="primary" onClick={goToOptional}>
                  다음
                </Button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="mt-8" aria-labelledby="onboarding-heading">
              <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1} className="text-xl font-bold leading-7 focus:outline-none">
                나를 더 알려 주세요
              </h1>
              <p className="mt-1 text-sm text-muted">모두 선택 항목이에요. 지금 건너뛰어도 필수 항목으로 카드가 공개돼요.</p>
              <div className="mt-6 space-y-8">
                <FieldGroup legend="기술 스택·강점 태그" legendClassName="text-base font-bold">
                  <HashtagField value={card.hashtags} onChange={(hashtags) => update({ hashtags })} />
                </FieldGroup>
                <FieldGroup legend="협업 스타일" legendClassName="text-base font-bold" description={`선호와 피하고 싶은 스타일을 각각 ${CARD_LIMITS.workstyleMax}개까지 골라요.`}>
                  <div className="space-y-4">
                    <FieldGroup legend="선호" legendClassName="text-sm font-semibold text-muted">
                      <WorkstyleChips kind="prefer" values={card.preferWorkstyleOptions} opposite={card.dislikeWorkstyleOptions} onChange={(values) => update({ preferWorkstyleOptions: values })} />
                    </FieldGroup>
                    <FieldGroup legend="피하고 싶은 스타일" legendClassName="text-sm font-semibold text-muted">
                      <WorkstyleChips kind="dislike" values={card.dislikeWorkstyleOptions} opposite={card.preferWorkstyleOptions} onChange={(values) => update({ dislikeWorkstyleOptions: values })} />
                    </FieldGroup>
                  </div>
                </FieldGroup>
                <FieldGroup legend="목표 온도" legendClassName="text-base font-bold" description="팀 프로젝트에서 바라는 목표 수준이에요.">
                  <GoalTemperatureScale value={card.goalTemperature} onChange={(value) => update({ goalTemperature: value })} />
                </FieldGroup>
                <CountedTextArea label="자기소개" value={card.introduction} max={CARD_LIMITS.introduction} onChange={(value) => update({ introduction: value })} />
                <PortfolioInput value={card.portfolio} onChange={(value) => update({ portfolio: value })} error={errors.portfolio} />
                <MbtiSelect value={card.mbti} onChange={(value) => update({ mbti: value })} />
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-outline-soft pt-6">
                <Button variant="ghost" onClick={() => setStep(2)} disabled={save.isPending}>
                  이전
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => publish('later')} disabled={save.isPending}>
                    나중에 채우기
                  </Button>
                  <Button onClick={() => publish('complete')} loading={save.isPending}>
                    완료하고 멤버 카드 보기
                  </Button>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};
