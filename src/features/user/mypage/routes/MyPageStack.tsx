import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Button, Input, TextArea, Modal } from '@/components/ui';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import { useRenewal } from '@/features/renewal/context/RenewalContext';
import {
  ROLE_META,
  WEEKLY_HOURS_META,
  TIME_SLOT_META,
  WORKSTYLE_META,
  GOAL_TEMPERATURE_META,
  NotificationCategory,
} from '@/features/renewal/types/renewal';
import {
  DesiredRoleCode,
  WeeklyAvailableHoursCode,
  AvailableTimeSlotCode,
  WorkstyleOptionCode,
} from '@/features/user/types/user';
import { useToast } from '@/components/ui/Toast';
import { MemberAvatar } from '@/features/renewal/components/PeriwinkleArtwork';

export const MyPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { myPRCard, saveMyPRCard, allWorkspaces } = useRenewal();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink-primary tracking-tight">
            마이페이지
          </h1>
          <p className="text-xs sm:text-sm text-ink-tertiary mt-1">
            내 PR 카드와 계정 및 알림 수신 설정을 관리합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/me/settings">
            <Button variant="outline" size="sm">
              계정 · 알림 설정
            </Button>
          </Link>
          <Link to="/me/card">
            <Button variant="primary" size="sm">
              내 PR 카드 편집
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-5">
        <div className="md:col-span-7 bg-white rounded-2xl border border-neutral-200/85 shadow-craft-sm p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <MemberAvatar name={currentUser?.name || myPRCard.name} size="xl" />
              <div>
                <h2 className="text-lg font-bold text-ink-primary">
                  {currentUser?.name || myPRCard.name}
                </h2>
                <p className="text-xs text-ink-tertiary mt-0.5">
                  {myPRCard.desiredRole1 ? `${ROLE_META[myPRCard.desiredRole1].label} 개발자` : '백엔드 개발자'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => saveMyPRCard({ cardVisible: !myPRCard.cardVisible })}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                myPRCard.cardVisible
                  ? 'bg-peri-50 text-peri-700'
                  : 'bg-surface-subtle text-ink-tertiary'
              }`}
            >
              {myPRCard.cardVisible ? '공개 중' : '비공개'}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(myPRCard.hashtags || []).map((t) => (
              <span
                key={t}
                className="px-2.5 py-1 rounded-md bg-peri-50/80 text-peri-700 text-xs font-medium"
              >
                {t}
              </span>
            ))}
          </div>

          <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
            {myPRCard.introduction}
          </p>

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-neutral-100">
            <div>
              <div className="text-sm font-bold text-ink-primary">
                {myPRCard.weeklyAvailableHours
                  ? WEEKLY_HOURS_META[myPRCard.weeklyAvailableHours].label
                  : '20~30시간'}
              </div>
              <div className="text-[11px] text-ink-tertiary">주간 가용 시간</div>
            </div>
            <div>
              <div className="text-sm font-bold text-ink-primary">
                목표 {myPRCard.goalTemperature || 4}/5단계
              </div>
              <div className="text-[11px] text-ink-tertiary">기대 목표 온도</div>
            </div>
          </div>
        </div>

        <div className="md:col-span-5 bg-white rounded-2xl border border-neutral-200/85 shadow-craft-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-ink-primary">참여 중인 워크스페이스</h2>
          <div className="space-y-2.5">
            {allWorkspaces.map((ws) => (
              <div
                key={ws.id}
                onClick={() => navigate(`/ws/${ws.id}`)}
                className="p-3.5 rounded-xl bg-surface-subtle/60 hover:bg-peri-50/60 transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="text-xs font-bold text-ink-primary">{ws.name}</div>
                  <div className="text-[11px] text-ink-tertiary mt-0.5">멤버 {ws.memberCount}명</div>
                </div>
                <span className="text-xs text-peri-600 font-semibold">이동 →</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ProfileEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { myPRCard, saveMyPRCard } = useRenewal();
  const { showToast } = useToast();

  const [role1, setRole1] = useState<DesiredRoleCode>(myPRCard.desiredRole1 || 'BACKEND');
  const [role2, setRole2] = useState<DesiredRoleCode>(myPRCard.desiredRole2 || 'INFRA');
  const [weeklyHours, setWeeklyHours] = useState<WeeklyAvailableHoursCode>(
    myPRCard.weeklyAvailableHours || 'H20_30'
  );
  const [timeSlots, setTimeSlots] = useState<AvailableTimeSlotCode[]>(
    myPRCard.availableTimeSlots || ['AFTERNOON', 'EVENING']
  );
  const [goalTemp, setGoalTemp] = useState<1 | 2 | 3 | 4 | 5>(myPRCard.goalTemperature || 4);
  const [tags, setTags] = useState<string[]>(myPRCard.hashtags || []);
  const [tagInput, setTagInput] = useState('');
  const [preferStyles, setPreferStyles] = useState<WorkstyleOptionCode[]>(
    myPRCard.preferWorkstyleOptions || ['ASYNC_FIRST', 'DETAIL_ORIENTED']
  );
  const [intro, setIntro] = useState(myPRCard.introduction || '');
  const [portfolio, setPortfolio] = useState(myPRCard.portfolio || '');
  const [mbti, setMbti] = useState(myPRCard.mbtiVisible ? myPRCard.mbti || '' : '');
  const [cardVisible, setCardVisible] = useState(myPRCard.cardVisible !== false);

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (!tags.includes(trimmed) && tags.length < 20) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (role1 === role2) {
      showToast({
        title: '1순위와 2순위 희망 역할은 서로 다르게 선택해 주세요.',
        variant: 'warning',
      });
      return;
    }
    saveMyPRCard({
      desiredRole1: role1,
      desiredRole2: role2,
      weeklyAvailableHours: weeklyHours,
      availableTimeSlots: timeSlots,
      goalTemperature: goalTemp,
      hashtags: tags,
      preferWorkstyleOptions: preferStyles,
      introduction: intro,
      portfolio: portfolio.trim(),
      mbti: mbti || undefined,
      mbtiVisible: !!mbti,
      cardVisible,
    });
    navigate('/me');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink-primary tracking-tight">
            내 PR 카드 편집
          </h1>
          <p className="text-xs sm:text-sm text-ink-tertiary mt-1">
            희망 역할과 기술 스택, 가용 시간을 입력하면 적합한 팀과 매칭됩니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/me')}>
            취소
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            저장하기
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-neutral-200/85 shadow-craft-sm p-6 sm:p-8 space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">
              희망 역할 1순위 *
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
              희망 역할 2순위 *
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

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">
              주간 가용 시간 *
            </label>
            <select
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(e.target.value as WeeklyAvailableHoursCode)}
              className="w-full h-9 px-3 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-ink-primary"
            >
              {(Object.keys(WEEKLY_HOURS_META) as WeeklyAvailableHoursCode[]).map((code) => (
                <option key={code} value={code}>
                  {WEEKLY_HOURS_META[code].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">
              목표 온도 ({GOAL_TEMPERATURE_META[goalTemp].label})
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGoalTemp(n)}
                  className={`h-9 rounded-lg text-xs font-semibold border cursor-pointer ${
                    goalTemp === n
                      ? 'bg-peri-500 text-white border-peri-500'
                      : 'bg-white text-ink-secondary border-neutral-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1.5">
            선호 협업 시간대
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TIME_SLOT_META) as AvailableTimeSlotCode[]).map((slot) => {
              const active = timeSlots.includes(slot);
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() =>
                    setTimeSlots((prev) =>
                      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
                    )
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    active
                      ? 'bg-peri-50 border-peri-400 text-peri-700 font-semibold'
                      : 'bg-white border-neutral-200 text-ink-secondary'
                  }`}
                >
                  {TIME_SLOT_META[slot].label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1.5">
            기술 스택 태그
          </label>
          <div className="flex gap-2">
            <Input
              name="tagInput"
              placeholder="예: React, TypeScript, Spring Boot"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
            />
            <Button type="button" variant="secondary" size="md" onClick={handleAddTag}>
              추가
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-peri-50 text-peri-700 text-xs font-medium"
              >
                {t}
                <button
                  type="button"
                  onClick={() => setTags((prev) => prev.filter((item) => item !== t))}
                  className="text-peri-400 hover:text-peri-700 cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1.5">
            선호 협업 스타일
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(WORKSTYLE_META) as WorkstyleOptionCode[]).map((code) => {
              const active = preferStyles.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() =>
                    setPreferStyles((prev) =>
                      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
                    )
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    active
                      ? 'bg-peri-50 border-peri-400 text-peri-700 font-semibold'
                      : 'bg-white border-neutral-200 text-ink-secondary'
                  }`}
                >
                  {WORKSTYLE_META[code].label}
                </button>
              );
            })}
          </div>
        </div>

        <TextArea
          label="자기소개"
          name="intro"
          maxLength={500}
          rows={3}
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="포트폴리오 URL"
            name="portfolio"
            placeholder="https://github.com/..."
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
          />
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">
              MBTI (선택)
            </label>
            <select
              value={mbti}
              onChange={(e) => setMbti(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-ink-primary"
            >
              <option value="">표시 안 함</option>
              {[
                'INTJ', 'INTP', 'ENTJ', 'ENTP',
                'INFJ', 'INFP', 'ENFJ', 'ENFP',
                'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
                'ISTP', 'ISFP', 'ESTP', 'ESFP',
              ].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-medium text-ink-primary cursor-pointer">
            <input
              type="checkbox"
              checked={cardVisible}
              onChange={(e) => setCardVisible(e.target.checked)}
              className="accent-peri-600"
            />
            <span>워크스페이스 멤버에게 내 PR 카드 공개</span>
          </label>
          <Button type="submit" variant="primary" size="md">
            저장하기
          </Button>
        </div>
      </form>
    </div>
  );
};

export const AccountSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { notificationSettings, updateNotificationSettings } = useRenewal();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const categories: { id: NotificationCategory; label: string }[] = [
    { id: 'TEAM_BUILDING', label: '팀 빌딩 · 제안 알림' },
    { id: 'KANBAN', label: '칸반 · 작업 승인 알림' },
    { id: 'SCHEDULE', label: '일정 리마인더' },
    { id: 'BOARD', label: '공지 · 게시판 알림' },
    { id: 'CHAT', label: '메신저 알림' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink-primary">계정 및 알림 설정</h1>
        <Button variant="outline" size="sm" onClick={() => navigate('/me')}>
          돌아가기
        </Button>
      </div>

      <Card title="알림 수신 설정">
        <div className="divide-y divide-neutral-100">
          {categories.map((c) => {
            const on = notificationSettings.categories[c.id];
            return (
              <div key={c.id} className="py-3 flex items-center justify-between text-xs">
                <span className="font-medium text-ink-primary">{c.label}</span>
                <button
                  type="button"
                  onClick={() =>
                    updateNotificationSettings({
                      categories: { ...notificationSettings.categories, [c.id]: !on },
                    })
                  }
                  className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                    on ? 'bg-peri-500 text-white' : 'bg-surface-subtle text-ink-tertiary'
                  }`}
                >
                  {on ? '켜짐' : '꺼짐'}
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="계정 탈퇴">
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-secondary">
            계정 삭제 시 PR 카드는 즉시 비공개되며 30일 유예 후 영구 삭제됩니다.
          </span>
          <Button variant="danger" size="xs" onClick={() => setDeleteOpen(true)}>
            계정 삭제
          </Button>
        </div>
      </Card>

      <Modal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="계정 삭제 확인"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setDeleteOpen(false);
                logout();
                navigate('/landing');
              }}
            >
              삭제 확인
            </Button>
          </>
        }
      >
        <p className="text-xs text-ink-secondary">
          탈퇴 후에도 팀 기록 무결성을 위해 기존 칸반 및 게시글 기록은 익명화되어 유지됩니다.
        </p>
      </Modal>
    </div>
  );
};
