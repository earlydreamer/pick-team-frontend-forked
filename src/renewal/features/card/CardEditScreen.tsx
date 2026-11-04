import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDownIcon, CameraIcon } from '@heroicons/react/24/outline';
import {
  CARD_LIMITS,
  cardStatus,
  isRequiredComplete,
  validateCard,
  type CardErrors,
  type PrCard,
} from '@/renewal/domain/card';
import { Avatar, Button, ErrorState, LoadingState, Modal, toast } from '@/renewal/ui';
import { useMe, useMyCard, useSaveMyCard, useUpdateProfileImage } from '@/renewal/data/queries';
import { useWorkspaceContext } from '@/renewal/shell/useWorkspaceContext';
import { ConsentPanel } from './ConsentPanel';
import {
  CountedTextArea,
  FieldGroup,
  GoalTemperatureScale,
  HashtagField,
  MbtiSelect,
  OtherRoleInput,
  PortfolioInput,
  RequiredMark,
  RoleSelect,
  TimeSlotChips,
  WeeklyHoursChips,
  WorkstyleChips,
} from './fields';

type SectionId = 'basic' | 'role' | 'availability' | 'temperature' | 'tags' | 'workstyle' | 'intro' | 'mbti' | 'visibility';

/** 펼침 섹션(11 §4.3 accordion). 제목 버튼이 aria-expanded로 상태를 알린다. */
const Section: React.FC<{
  id: SectionId;
  title: string;
  required?: boolean;
  open: boolean;
  onToggle: (id: SectionId) => void;
  hasError?: boolean;
  children: React.ReactNode;
}> = ({ id, title, required, open, onToggle, hasError, children }) => {
  const panelId = useId();
  return (
    <section className={`rounded-card border bg-surface ${hasError ? 'border-danger' : 'border-outline-soft'}`}>
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onToggle(id)}
          className="flex min-h-[56px] w-full items-center gap-2 px-5 text-left text-base font-bold"
        >
          <span className="flex-1">
            {title}
            {required && <RequiredMark />}
            {hasError && <span className="ml-2 text-sm font-semibold text-danger">확인 필요</span>}
          </span>
          <ChevronDownIcon className={`h-5 w-5 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </h2>
      <div id={panelId} hidden={!open} className="border-t border-outline-soft px-5 pb-6 pt-5">
        {children}
      </div>
    </section>
  );
};

const hasContent = (card: PrCard): Record<SectionId, boolean> => ({
  basic: true,
  role: true,
  availability: true,
  temperature: card.goalTemperature !== undefined,
  tags: card.hashtags.length > 0,
  workstyle: card.preferWorkstyleOptions.length + card.dislikeWorkstyleOptions.length > 0 || Boolean(card.workstyleText),
  intro: Boolean(card.introduction || card.portfolio),
  mbti: Boolean(card.mbti),
  visibility: true,
});

const sectionOfError: Record<keyof CardErrors, SectionId> = {
  desiredRole1: 'role',
  desiredRole2: 'role',
  otherRoleText: 'role',
  weeklyAvailableHours: 'availability',
  portfolio: 'intro',
};

/**
 * SCR-MY-02 내 PR 카드 편집(11 §4.3, 목업 pr-card-edit.html).
 * 단일 폼을 섹션별로 펼치고 접는다. 필수 섹션과 내용이 있는 섹션은 펼친 상태로 시작한다.
 * 동의 전이면 동의 안내를 먼저 보여 준다.
 */
export const CardEditScreen: React.FC = () => {
  const navigate = useNavigate();
  const { workspace } = useWorkspaceContext();
  const me = useMe();
  const myCard = useMyCard();
  const save = useSaveMyCard();
  const photo = useUpdateProfileImage();

  const [card, setCard] = useState<PrCard | null>(null);
  const [open, setOpen] = useState<Record<SectionId, boolean> | null>(null);
  const [errors, setErrors] = useState<CardErrors>({});
  const [confirmLeave, setConfirmLeave] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (myCard.data && !card) {
      setCard(myCard.data);
      setOpen(hasContent(myCard.data));
    }
  }, [myCard.data, card]);

  const dirty = useMemo(() => Boolean(card && myCard.data && JSON.stringify(card) !== JSON.stringify(myCard.data)), [card, myCard.data]);
  const leaveTo = workspace ? `/ws/${workspace.id}` : '/';

  if (me.isLoading || myCard.isLoading || (myCard.data && (!card || !open))) {
    return <LoadingState className="min-h-[60vh]" label="카드를 불러오는 중이에요" />;
  }
  if (myCard.isError || !card || !open || !me.data) {
    return (
      <ErrorState
        className="min-h-[60vh]"
        title="카드를 불러오지 못했어요"
        description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
        action={<Button onClick={() => myCard.refetch()}>다시 시도</Button>}
      />
    );
  }

  const status = cardStatus(card);
  const requiredComplete = isRequiredComplete(card);
  const toggle = (id: SectionId) => setOpen((prev) => (prev ? { ...prev, [id]: !prev[id] } : prev));
  const update = (patch: Partial<PrCard>) => {
    setCard((prev) => (prev ? { ...prev, ...patch } : prev));
    setErrors((prev) => {
      const next = { ...prev };
      (Object.keys(patch) as (keyof CardErrors)[]).forEach((field) => delete next[field]);
      return next;
    });
  };

  const handleSave = async () => {
    const found = validateCard(card);
    setErrors(found);
    const fields = Object.keys(found) as (keyof CardErrors)[];
    if (fields.length > 0) {
      setOpen((prev) => (prev ? { ...prev, ...Object.fromEntries(fields.map((field) => [sectionOfError[field], true])) } : prev));
      toast.error('확인이 필요한 항목이 있어요. 표시된 섹션을 확인해 주세요.');
      // 섹션이 펼쳐진 뒤 첫 오류 입력으로 포커스를 옮긴다.
      requestAnimationFrame(() => {
        const target =
          document.querySelector<HTMLElement>('[aria-invalid="true"]') ??
          document.querySelector<HTMLElement>('section.border-danger input:not(:disabled), section.border-danger select');
        target?.focus();
      });
      return;
    }
    try {
      const saved = await save.mutateAsync(card);
      setCard(saved);
      toast.success(saved.cardVisible ? '카드를 저장했어요. 소속 워크스페이스 멤버에게 공개돼요.' : '카드를 저장했어요. 지금은 비공개 상태예요.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '카드를 저장하지 못했어요. 다시 시도해 주세요.');
    }
  };

  const giveConsent = async () => {
    try {
      const saved = await save.mutateAsync({ ...card, consentGivenAt: new Date().toISOString(), cardVisible: false });
      setCard(saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '동의를 저장하지 못했어요. 다시 시도해 주세요.');
    }
  };

  const changePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      await photo.mutateAsync(file);
      toast.success('프로필 사진을 바꿨어요.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '사진을 올리지 못했어요. 다시 시도해 주세요.');
    }
  };

  const removePhoto = async () => {
    try {
      await photo.mutateAsync(null);
      toast.success('프로필 사진을 삭제했어요.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '사진을 삭제하지 못했어요. 다시 시도해 주세요.');
    }
  };

  if (status === 'NO_CONSENT') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 lg:py-10">
        <h1 className="text-2xl font-bold leading-8">내 PR 카드</h1>
        <p className="mb-6 mt-1 text-[0.9375rem] text-muted">카드를 만들기 전에 수집하는 정보와 공개 범위를 확인해 주세요.</p>
        <ConsentPanel workspaceName={workspace?.name} />
        <div className="mt-6 flex justify-end">
          <Button onClick={giveConsent} loading={save.isPending}>
            동의하고 카드 만들기
          </Button>
        </div>
      </div>
    );
  }

  const otherSelected = card.desiredRole1 === 'OTHER' || card.desiredRole2 === 'OTHER';
  const visibilityHelpId = 'card-visibility-help';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
      <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-outline-soft bg-canvas/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-7 sm:text-2xl sm:leading-8">내 PR 카드 편집</h1>
          <p className="text-sm text-muted" aria-live="polite">
            {status === 'PUBLIC' ? '공개 중' : status === 'PRIVATE' ? '비공개' : '필수 항목을 채우면 공개할 수 있어요'}
            {dirty && ' · 저장하지 않은 변경이 있어요'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => (dirty ? setConfirmLeave(true) : navigate(leaveTo))} disabled={save.isPending}>
            취소
          </Button>
          <Button onClick={handleSave} loading={save.isPending}>
            저장
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <Section id="basic" title="기본 정보" open={open.basic} onToggle={toggle}>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={me.data.name} imageUrl={me.data.profileImageUrl} size="xl" />
            <div className="min-w-0 space-y-2">
              <p className="text-lg font-bold">{me.data.name}</p>
              <p className="text-sm text-muted">이름은 계정 설정에서 바꿀 수 있어요.</p>
              <div className="flex flex-wrap gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={changePhoto} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} loading={photo.isPending} leftIcon={<CameraIcon className="h-4 w-4" />}>
                  {me.data.profileImageUrl ? '프로필 사진 변경' : '프로필 사진 올리기'}
                </Button>
                {me.data.profileImageUrl && (
                  <Button variant="ghost" size="sm" onClick={removePhoto} disabled={photo.isPending}>
                    사진 삭제
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Section>

        <Section id="role" title="희망 역할" required open={open.role} onToggle={toggle} hasError={Boolean(errors.desiredRole1 || errors.desiredRole2 || errors.otherRoleText)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <RoleSelect id="card-role-1" label="1순위" value={card.desiredRole1} other={card.desiredRole2} onChange={(role) => update({ desiredRole1: role })} error={errors.desiredRole1} />
            <RoleSelect id="card-role-2" label="2순위" value={card.desiredRole2} other={card.desiredRole1} onChange={(role) => update({ desiredRole2: role })} error={errors.desiredRole2} />
          </div>
          {otherSelected && (
            <div className="mt-4">
              <OtherRoleInput value={card.otherRoleText} onChange={(value) => update({ otherRoleText: value })} error={errors.otherRoleText} />
            </div>
          )}
        </Section>

        <Section id="availability" title="가용성" required open={open.availability} onToggle={toggle} hasError={Boolean(errors.weeklyAvailableHours)}>
          <div className="space-y-6">
            <FieldGroup legend="주간 가용 시간" error={errors.weeklyAvailableHours}>
              <WeeklyHoursChips value={card.weeklyAvailableHours} onChange={(value) => update({ weeklyAvailableHours: value })} />
            </FieldGroup>
            <FieldGroup legend="선호 시간대" description="여러 개 고를 수 있어요.">
              <TimeSlotChips values={card.availableTimeSlots} onChange={(values) => update({ availableTimeSlots: values })} />
            </FieldGroup>
          </div>
        </Section>

        <Section id="temperature" title="목표 온도" open={open.temperature} onToggle={toggle}>
          <FieldGroup legend="팀 프로젝트에서 바라는 목표 수준">
            <GoalTemperatureScale value={card.goalTemperature} onChange={(value) => update({ goalTemperature: value })} />
          </FieldGroup>
        </Section>

        <Section id="tags" title="기술 스택·강점 태그" open={open.tags} onToggle={toggle}>
          <HashtagField value={card.hashtags} onChange={(hashtags) => update({ hashtags })} />
        </Section>

        <Section id="workstyle" title="협업 스타일" open={open.workstyle} onToggle={toggle}>
          <div className="space-y-6">
            <FieldGroup legend="선호" description={`${CARD_LIMITS.workstyleMax}개까지 고를 수 있어요.`}>
              <WorkstyleChips kind="prefer" values={card.preferWorkstyleOptions} opposite={card.dislikeWorkstyleOptions} onChange={(values) => update({ preferWorkstyleOptions: values })} />
            </FieldGroup>
            <FieldGroup legend="피하고 싶은 스타일" description={`${CARD_LIMITS.workstyleMax}개까지 고를 수 있어요.`}>
              <WorkstyleChips kind="dislike" values={card.dislikeWorkstyleOptions} opposite={card.preferWorkstyleOptions} onChange={(values) => update({ dislikeWorkstyleOptions: values })} />
            </FieldGroup>
            <CountedTextArea label="자유 서술" rows={2} value={card.workstyleText} max={CARD_LIMITS.workstyleText} onChange={(value) => update({ workstyleText: value })} />
          </div>
        </Section>

        <Section id="intro" title="자기소개·포트폴리오" open={open.intro} onToggle={toggle} hasError={Boolean(errors.portfolio)}>
          <div className="space-y-5">
            <CountedTextArea label="자기소개" value={card.introduction} max={CARD_LIMITS.introduction} onChange={(value) => update({ introduction: value })} />
            <PortfolioInput value={card.portfolio} onChange={(value) => update({ portfolio: value })} error={errors.portfolio} />
          </div>
        </Section>

        <Section id="mbti" title="MBTI" open={open.mbti} onToggle={toggle}>
          <MbtiSelect value={card.mbti} onChange={(value) => update({ mbti: value })} />
        </Section>

        <Section id="visibility" title="공개 설정" open={open.visibility} onToggle={toggle}>
          <div className="flex items-start gap-4">
            <button
              type="button"
              role="switch"
              aria-checked={card.cardVisible}
              aria-describedby={visibilityHelpId}
              aria-label="소속 워크스페이스에 내 카드 공개"
              disabled={!requiredComplete && !card.cardVisible}
              onClick={() => update({ cardVisible: !card.cardVisible })}
              className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                card.cardVisible ? 'bg-primary' : 'bg-neutral-400'
              }`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${card.cardVisible ? 'translate-x-6' : 'translate-x-1'}`} aria-hidden="true" />
            </button>
            <div>
              <p className="font-semibold">소속 워크스페이스에 내 카드 공개 {card.cardVisible ? '켜짐' : '꺼짐'}</p>
              <p id={visibilityHelpId} className="mt-0.5 text-sm text-muted">
                {!requiredComplete && !card.cardVisible
                  ? '희망 역할과 주간 가용 시간을 채우면 공개할 수 있어요.'
                  : '끄면 멤버 카드와 추천에서 숨겨져요. 저장해야 반영돼요.'}
              </p>
            </div>
          </div>
        </Section>
      </div>

      <Modal
        isOpen={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="저장하지 않고 나갈까요?"
        description="지금까지 바꾼 내용은 사라져요."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmLeave(false)}>
              계속 편집하기
            </Button>
            <Button variant="danger" onClick={() => navigate(leaveTo)}>
              저장하지 않고 나가기
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </div>
  );
};
