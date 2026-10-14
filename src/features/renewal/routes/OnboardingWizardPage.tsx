import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Input, TextArea } from '@/components/ui';
import { useRenewal } from '../context/RenewalContext';
import {
  DesiredRoleCode,
  WeeklyAvailableHoursCode,
  AvailableTimeSlotCode,
} from '@/features/user/types/user';
import {
  ROLE_META,
  WEEKLY_HOURS_META,
  TIME_SLOT_META,
  GOAL_TEMPERATURE_META,
} from '../types/renewal';

export const OnboardingWizardPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { getWorkspaceById, myPRCard, saveMyPRCard } = useRenewal();

  const activeWs = getWorkspaceById(workspaceId);
  const wsId = activeWs.id;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [consentRequired, setConsentRequired] = useState(true);
  const [role1, setRole1] = useState<DesiredRoleCode>(myPRCard.desiredRole1 || 'BACKEND');
  const [role2, setRole2] = useState<DesiredRoleCode>(myPRCard.desiredRole2 || 'INFRA');
  const [weeklyHours, setWeeklyHours] = useState<WeeklyAvailableHoursCode>(
    myPRCard.weeklyAvailableHours || 'H20_30'
  );
  const [timeSlots, setTimeSlots] = useState<AvailableTimeSlotCode[]>(
    myPRCard.availableTimeSlots || ['AFTERNOON', 'EVENING']
  );
  const [goalTemp, setGoalTemp] = useState<1 | 2 | 3 | 4 | 5>(myPRCard.goalTemperature || 4);
  const [tags, setTags] = useState<string[]>(myPRCard.hashtags || ['React', 'Spring Boot']);
  const [tagInput, setTagInput] = useState('');
  const [intro, setIntro] = useState(myPRCard.introduction || '');

  const isStep2Valid = !!role1 && !!role2 && role1 !== role2 && !!weeklyHours;

  const handleComplete = () => {
    saveMyPRCard({
      desiredRole1: role1,
      desiredRole2: role2,
      weeklyAvailableHours: weeklyHours,
      availableTimeSlots: timeSlots,
      goalTemperature: goalTemp,
      hashtags: tags,
      introduction: intro,
      cardVisible: true,
      consentGivenAt: new Date().toISOString(),
    });
    navigate(`/ws/${wsId}/members`);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="bg-white rounded-2xl border border-neutral-200/85 shadow-craft-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between text-xs font-medium text-ink-tertiary">
          <span>PR 카드 온보딩 ({activeWs.name})</span>
          <span className="text-peri-600 font-bold">{step} / 3단계</span>
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-bold text-ink-primary">
                PR 카드를 만들고 팀원을 찾아보세요
              </h1>
              <p className="text-xs sm:text-sm text-ink-tertiary mt-1">
                작성한 카드는 {activeWs.name} 워크스페이스 멤버에게만 공개됩니다.
              </p>
            </div>

            <label className="flex items-start gap-2.5 p-4 rounded-xl bg-surface-subtle/70 text-xs text-ink-primary cursor-pointer">
              <input
                type="checkbox"
                checked={consentRequired}
                onChange={(e) => setConsentRequired(e.target.checked)}
                className="mt-0.5 accent-peri-600"
              />
              <span>
                희망 역할, 가용 시간, 협업 스타일 정보 수집 및 워크스페이스 내 공개에 동의합니다. (필수)
              </span>
            </label>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/ws/${wsId}`)}>
                나중에 하기
              </Button>
              <Button variant="primary" size="md" disabled={!consentRequired} onClick={() => setStep(2)}>
                다음 단계로
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-ink-primary">희망 역할과 주간 가용 시간</h2>
              <p className="text-xs text-ink-tertiary mt-1">
                1순위와 2순위 역할을 서로 다르게 선택해 주세요.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                  1순위 희망 역할
                </label>
                <select
                  value={role1}
                  onChange={(e) => setRole1(e.target.value as DesiredRoleCode)}
                  className="w-full h-9 px-3 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-ink-primary"
                >
                  {(Object.keys(ROLE_META) as DesiredRoleCode[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_META[r].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                  2순위 희망 역할
                </label>
                <select
                  value={role2}
                  onChange={(e) => setRole2(e.target.value as DesiredRoleCode)}
                  className="w-full h-9 px-3 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-ink-primary"
                >
                  {(Object.keys(ROLE_META) as DesiredRoleCode[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_META[r].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                주간 가용 시간
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(WEEKLY_HOURS_META) as WeeklyAvailableHoursCode[]).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setWeeklyHours(code)}
                    className={`h-9 rounded-lg text-xs font-medium border cursor-pointer ${
                      weeklyHours === code
                        ? 'bg-peri-500 text-white border-peri-500'
                        : 'bg-white text-ink-secondary border-neutral-200'
                    }`}
                  >
                    {WEEKLY_HOURS_META[code].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                이전
              </Button>
              <Button variant="primary" size="md" disabled={!isStep2Valid} onClick={() => setStep(3)}>
                다음 단계로
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-ink-primary">기술 스택 및 한 줄 소개</h2>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                선호 시간대 및 목표 온도 ({GOAL_TEMPERATURE_META[goalTemp].label})
              </label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(Object.keys(TIME_SLOT_META) as AvailableTimeSlotCode[]).map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() =>
                      setTimeSlots((prev) =>
                        prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
                      )
                    }
                    className={`px-3 py-1 rounded-lg text-xs font-medium border cursor-pointer ${
                      timeSlots.includes(slot)
                        ? 'bg-peri-50 border-peri-400 text-peri-700'
                        : 'bg-white border-neutral-200 text-ink-secondary'
                    }`}
                  >
                    {TIME_SLOT_META[slot].label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {([1, 2, 3, 4, 5] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setGoalTemp(n)}
                    className={`h-8 rounded-lg text-xs font-semibold border cursor-pointer ${
                      goalTemp === n
                        ? 'bg-peri-500 text-white border-peri-500'
                        : 'bg-white text-ink-secondary border-neutral-200'
                    }`}
                  >
                    {n}단계
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                기술 스택 태그
              </label>
              <div className="flex gap-2">
                <Input
                  name="tagInput"
                  placeholder="태그 입력"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
                      setTags((p) => [...p, tagInput.trim()]);
                      setTagInput('');
                    }
                  }}
                >
                  추가
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-md bg-peri-50 text-peri-700 text-xs font-medium"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <TextArea
              label="자기소개"
              name="intro"
              placeholder="함께하고 싶은 팀에 나를 소개해 주세요."
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
            />

            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                이전
              </Button>
              <Button variant="primary" size="md" onClick={handleComplete}>
                PR 카드 등록 완료
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
