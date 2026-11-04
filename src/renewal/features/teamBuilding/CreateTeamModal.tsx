import React, { useEffect, useId, useState } from 'react';
import { MinusIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ROLES, ROLE_LABEL, type GoalTemperature, type Role } from '@/renewal/domain/card';
import { TEAM_BUILDING_RULES, type CreateTeamInput, type RecruitRole } from '@/renewal/domain/teamBuilding';
import { Button, Modal, fieldClassName } from '@/renewal/ui';
import { GoalTemperatureScale } from '@/renewal/features/card/fields';

/**
 * 팀 만들기(모집 공고 작성, 12 §4.1): 팀 이름, 소개, 목표 온도, 모집 역할과 인원.
 * 모집 인원 합계는 정원에서 나를 뺀 자리 수를 넘을 수 없다.
 */
export const CreateTeamModal: React.FC<{
  open: boolean;
  capacity: number;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTeamInput) => void;
}> = ({ open, capacity, pending, onClose, onSubmit }) => {
  const nameId = useId();
  const introId = useId();
  const roleSelectId = useId();
  const [name, setName] = useState('');
  const [intro, setIntro] = useState('');
  const [goalTemperature, setGoalTemperature] = useState<GoalTemperature | undefined>();
  const [roles, setRoles] = useState<RecruitRole[]>([]);
  const [nextRole, setNextRole] = useState<Role | ''>('');
  const [errors, setErrors] = useState<{ name?: string; roles?: string }>({});

  useEffect(() => {
    if (!open) return;
    setName('');
    setIntro('');
    setGoalTemperature(undefined);
    setRoles([]);
    setNextRole('');
    setErrors({});
  }, [open]);

  const seats = Math.max(capacity - 1, 0);
  const total = roles.reduce((sum, role) => sum + role.count, 0);

  const addRole = () => {
    if (!nextRole || roles.some((item) => item.role === nextRole)) return;
    if (total >= seats) {
      setErrors((prev) => ({ ...prev, roles: `모집 인원은 남은 자리 ${seats}명까지 정할 수 있어요.` }));
      return;
    }
    setRoles((prev) => [...prev, { role: nextRole, count: 1 }]);
    setNextRole('');
    setErrors((prev) => ({ ...prev, roles: undefined }));
  };

  const changeCount = (role: Role, delta: number) => {
    if (delta > 0 && total >= seats) {
      setErrors((prev) => ({ ...prev, roles: `모집 인원은 남은 자리 ${seats}명까지 정할 수 있어요.` }));
      return;
    }
    setRoles((prev) => prev.map((item) => (item.role === role ? { ...item, count: Math.max(1, item.count + delta) } : item)));
    setErrors((prev) => ({ ...prev, roles: undefined }));
  };

  const submit = () => {
    const found: typeof errors = {};
    if (!name.trim()) found.name = '팀 이름을 입력해 주세요.';
    if (roles.length === 0) found.roles = '모집할 역할을 하나 이상 추가해 주세요.';
    setErrors(found);
    if (found.name) {
      document.getElementById(nameId)?.focus();
      return;
    }
    if (found.roles) {
      document.getElementById(roleSelectId)?.focus();
      return;
    }
    onSubmit({ name: name.trim(), intro: intro.trim() || undefined, goalTemperature, recruitRoles: roles });
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      preventClose={pending}
      title="팀 만들기"
      description={`내가 팀장이 되고, 정원은 나를 포함해 ${capacity}명이에요. 답변을 기다리는 내 지원은 자동 철회돼요.`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button onClick={submit} loading={pending}>
            모집 시작하기
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label htmlFor={nameId} className="mb-1.5 block text-sm font-semibold">
            팀 이름
          </label>
          <input
            id={nameId}
            value={name}
            maxLength={TEAM_BUILDING_RULES.teamNameMax}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${nameId}-error` : undefined}
            className={fieldClassName(Boolean(errors.name))}
          />
          {errors.name && (
            <p id={`${nameId}-error`} className="mt-1.5 text-sm text-danger">
              {errors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={introId} className="mb-1.5 block text-sm font-semibold">
            한 줄 소개 <span className="font-normal text-muted">(선택)</span>
          </label>
          <input id={introId} value={intro} maxLength={TEAM_BUILDING_RULES.introMax} onChange={(event) => setIntro(event.target.value)} className={fieldClassName(false)} />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            목표 온도 <span className="font-normal text-muted">(선택)</span>
          </legend>
          <GoalTemperatureScale value={goalTemperature} onChange={setGoalTemperature} />
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            모집 역할 <span className="font-normal text-muted tabular-nums">({total}/{seats}명)</span>
          </legend>
          <div className="flex gap-2">
            <label htmlFor={roleSelectId} className="sr-only">
              추가할 역할
            </label>
            <select
              id={roleSelectId}
              value={nextRole}
              onChange={(event) => setNextRole(event.target.value as Role | '')}
              aria-invalid={errors.roles ? true : undefined}
              aria-describedby={errors.roles ? `${roleSelectId}-error` : undefined}
              className={fieldClassName(Boolean(errors.roles), 'flex-1 appearance-auto')}
            >
              <option value="">역할 선택</option>
              {ROLES.filter((role) => role !== 'OTHER').map((role) => (
                <option key={role} value={role} disabled={roles.some((item) => item.role === role)}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={addRole} disabled={!nextRole}>
              추가
            </Button>
          </div>
          {errors.roles && (
            <p id={`${roleSelectId}-error`} className="mt-1.5 text-sm text-danger">
              {errors.roles}
            </p>
          )}
          {roles.length > 0 && (
            <ul className="mt-3 divide-y divide-outline-soft rounded-card border border-outline-soft">
              {roles.map((item) => (
                <li key={item.role} className="flex items-center gap-3 px-3 py-2">
                  <span className="flex-1 text-sm font-medium">{ROLE_LABEL[item.role]}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => changeCount(item.role, -1)}
                      disabled={item.count <= 1}
                      aria-label={`${ROLE_LABEL[item.role]} 인원 줄이기`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-outline-soft disabled:opacity-40"
                    >
                      <MinusIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                      {item.count}명
                    </span>
                    <button
                      type="button"
                      onClick={() => changeCount(item.role, 1)}
                      aria-label={`${ROLE_LABEL[item.role]} 인원 늘리기`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-outline-soft"
                    >
                      <PlusIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRoles((prev) => prev.filter((role) => role.role !== item.role))}
                    aria-label={`${ROLE_LABEL[item.role]} 모집 빼기`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-surface-container"
                  >
                    <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      </div>
    </Modal>
  );
};
