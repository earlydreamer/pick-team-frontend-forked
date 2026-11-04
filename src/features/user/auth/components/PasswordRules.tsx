import React from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { passwordRules, PasswordPolicy } from '../lib/passwordPolicy';

/** 비밀번호 조건 목록. 충족 여부를 아이콘과 텍스트(충족/미충족)로 함께 표시합니다. */
export const PasswordRules: React.FC<{ value: string; policy: PasswordPolicy; id?: string }> = ({ value, policy, id }) => (
  <ul id={id} className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5" aria-label="비밀번호 조건">
    {passwordRules(policy).map((rule) => {
      const passed = rule.test(value);
      return (
        <li key={rule.id} className={`inline-flex items-center gap-1 text-xs ${passed ? 'text-success' : 'text-muted'}`}>
          {passed ? (
            <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <span className="inline-block h-3 w-3 rounded-full border-[1.5px] border-current" aria-hidden="true" />
          )}
          {rule.label}
          <span className="sr-only">{passed ? '충족' : '미충족'}</span>
        </li>
      );
    })}
  </ul>
);
