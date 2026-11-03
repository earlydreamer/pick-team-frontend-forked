import React from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Badge, Modal, buttonClassName } from '@/components/ui';
import type { User } from '@/types';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="border-t border-outline-soft py-3 first:border-t-0">
    <dt className="text-xs font-semibold text-muted">{label}</dt>
    <dd className="mt-1 whitespace-pre-line text-[0.9375rem] leading-6 text-ink">{children}</dd>
  </div>
);

/** 외부 링크는 http(s)만 링크로 만들고, 그 외 값은 글자로만 보여 줍니다. */
const safeUrl = (value?: string) => (value && /^https?:\/\//i.test(value.trim()) ? value.trim() : undefined);

/**
 * 멤버 프로필 요약(팀 빌딩 카드). 사용자가 입력한 항목만 표시하고 빈 항목은 만들지 않습니다.
 */
export const MemberProfileModal: React.FC<{ member: User | null; onClose: () => void }> = ({ member, onClose }) => {
  if (!member) return null;
  const portfolio = member.portfolio || member.portfolioUrl;
  const portfolioHref = safeUrl(portfolio);
  const introduction = member.introduction || member.bio;
  const hasDetails =
    introduction || member.disposition || member.preferWorkstyle || member.dislikeWorkstyle || portfolio || member.age;

  return (
    <Modal isOpen onClose={onClose} title={member.name || '이름 없음'} description={member.email} size="lg">
      <div className="flex items-center gap-4">
        <Avatar name={member.name} imageUrl={member.profileImageUrl} size="lg" />
        <div className="flex flex-wrap gap-1.5">
          {member.mbti && <Badge>{member.mbti}</Badge>}
          {member.hashtags?.map((tag) => (
            <Badge key={tag} tone="neutral">
              #{tag.replace(/^#/, '')}
            </Badge>
          ))}
        </div>
      </div>

      {hasDetails ? (
        <dl className="mt-5">
          {introduction && <Field label="자기소개">{introduction}</Field>}
          {member.disposition && <Field label="협업 성향">{member.disposition}</Field>}
          {member.preferWorkstyle && <Field label="선호하는 협업 방식">{member.preferWorkstyle}</Field>}
          {member.dislikeWorkstyle && <Field label="피하고 싶은 협업 방식">{member.dislikeWorkstyle}</Field>}
          {member.age ? <Field label="나이">{member.age}세</Field> : null}
          {portfolio && (
            <Field label="포트폴리오">
              {portfolioHref ? (
                <a href={portfolioHref} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-primary underline underline-offset-4">
                  {portfolio}
                  <span className="sr-only"> (새 창)</span>
                </a>
              ) : (
                portfolio
              )}
            </Field>
          )}
        </dl>
      ) : (
        <p className="mt-5 rounded-lg bg-surface-low px-4 py-3 text-sm text-muted">아직 프로필을 채우지 않았어요.</p>
      )}

      <div className="mt-6 flex justify-end">
        <Link to={`/users/${member.id}`} className={buttonClassName('outline')} onClick={onClose}>
          프로필 페이지 열기
        </Link>
      </div>
    </Modal>
  );
};
