import React from 'react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { Avatar, Badge } from '@/components/ui';
import type { User } from '@/features/user/types/user';
import { profileFields, safeHttpUrl } from '../lib/profile';

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="border-t border-outline-soft py-4 first:border-t-0 first:pt-0">
    <dt className="text-xs font-semibold text-muted">{label}</dt>
    <dd className="mt-1.5 whitespace-pre-line text-[0.9375rem] leading-6 text-ink">{children}</dd>
  </div>
);

/**
 * PR 카드: 팀원이 함께할 사람을 판단할 때 보는 프로필 요약입니다.
 * 입력한 항목만 보여 주고 빈 항목은 만들지 않습니다. 홈의 멤버 대화상자, 사용자 프로필, 마이페이지가 함께 씁니다.
 */
export const ProfileCard: React.FC<{
  user: User;
  /** 머리글(사진·이름)을 숨기고 본문만 보여 줄 때 */
  bodyOnly?: boolean;
  emptyMessage?: string;
  headingLevel?: 'h1' | 'h2';
}> = ({ user, bodyOnly, emptyMessage = '아직 프로필을 채우지 않았어요.', headingLevel = 'h2' }) => {
  const fields = profileFields(user);
  const portfolioHref = safeHttpUrl(fields.portfolio);
  const Heading = headingLevel;
  const hasBody =
    fields.introduction || fields.disposition || fields.preferWorkstyle || fields.dislikeWorkstyle || fields.portfolio || user.age;

  return (
    <div>
      {!bodyOnly && (
        <div className="flex items-center gap-4">
          <Avatar name={user.name} imageUrl={user.profileImageUrl} size="xl" />
          <div className="min-w-0">
            <Heading className="text-2xl font-bold leading-8 tracking-[-0.02em]">{user.name || '이름 없음'}</Heading>
            <p className="mt-0.5 truncate text-sm text-muted">{user.email}</p>
            {(user.mbti || user.age) && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5">
                {user.mbti && <Badge>{user.mbti}</Badge>}
                {user.age ? <Badge tone="neutral">{user.age}세</Badge> : null}
              </p>
            )}
          </div>
        </div>
      )}

      {fields.hashtags.length > 0 && (
        <ul className={`flex flex-wrap gap-1.5 ${bodyOnly ? '' : 'mt-5'}`} aria-label="관심 태그">
          {fields.hashtags.map((tag) => (
            <li key={tag}>
              <Badge tone="neutral">#{tag}</Badge>
            </li>
          ))}
        </ul>
      )}

      {hasBody ? (
        <dl className="mt-5">
          {fields.introduction && <Section label="자기소개">{fields.introduction}</Section>}
          {fields.disposition && <Section label="협업 성향">{fields.disposition}</Section>}
          {(fields.preferWorkstyle || fields.dislikeWorkstyle) && (
            <div className="grid gap-x-6 border-t border-outline-soft first:border-t-0 sm:grid-cols-2">
              {fields.preferWorkstyle && (
                <div className="py-4">
                  <dt className="text-xs font-semibold text-muted">이렇게 일하고 싶어요</dt>
                  <dd className="mt-1.5 whitespace-pre-line text-[0.9375rem] leading-6">{fields.preferWorkstyle}</dd>
                </div>
              )}
              {fields.dislikeWorkstyle && (
                <div className="py-4">
                  <dt className="text-xs font-semibold text-muted">이런 방식은 피하고 싶어요</dt>
                  <dd className="mt-1.5 whitespace-pre-line text-[0.9375rem] leading-6">{fields.dislikeWorkstyle}</dd>
                </div>
              )}
            </div>
          )}
          {fields.portfolio && (
            <Section label="포트폴리오">
              {portfolioHref ? (
                <a
                  href={portfolioHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 break-all font-medium text-primary underline underline-offset-4"
                >
                  {fields.portfolio}
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="sr-only">(새 창)</span>
                </a>
              ) : (
                fields.portfolio
              )}
            </Section>
          )}
        </dl>
      ) : (
        <p className="mt-5 rounded-lg bg-surface-low px-4 py-3 text-sm text-muted">{emptyMessage}</p>
      )}
    </div>
  );
};
