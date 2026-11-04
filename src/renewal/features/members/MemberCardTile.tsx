import React from 'react';
import { Link } from 'react-router-dom';
import { ClockIcon, FireIcon } from '@heroicons/react/24/outline';
import { WEEKLY_HOURS_LABEL, roleText } from '@/renewal/domain/card';
import type { Member } from '@/renewal/domain/workspace';
import { Avatar, Badge } from '@/renewal/ui';

/** 카드에 보이는 희망 역할 배지. 1순위는 채운 배지, 2순위는 테두리 배지로 구분하고 순위를 글자로도 알린다. */
export const RoleBadges: React.FC<{ member: Member; size?: 'sm' | 'md' }> = ({ member, size = 'sm' }) => {
  const first = roleText(member.card, member.card.desiredRole1);
  const second = roleText(member.card, member.card.desiredRole2);
  const pad = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
  return (
    <span className="flex flex-wrap justify-center gap-1">
      {first && (
        <span className={`rounded-md bg-primary-container font-semibold text-on-primary-container ${pad}`}>
          <span className="sr-only">1순위 </span>
          {first}
        </span>
      )}
      {second && (
        <span className={`rounded-md border border-outline-soft font-medium text-muted ${pad}`}>
          <span className="sr-only">2순위 </span>
          {second}
        </span>
      )}
    </span>
  );
};

/**
 * 멤버 카드 요약(11 §4.4 정보 위계): 이름·아바타, 희망 역할, 주간 가용 시간, 목표 온도, 태그 3개.
 * 미작성·비공개 카드는 흐린 자리 표시로 그린다(11-D3).
 */
export const MemberCardTile: React.FC<{ member: Member; to: string; isMe?: boolean }> = ({ member, to, isMe }) => {
  const { account, card, cardState } = member;

  if (cardState !== 'PUBLIC' && !isMe) {
    return (
      <div className="flex h-full flex-col items-center gap-2 rounded-card border border-dashed border-outline-soft bg-surface-low px-4 py-5 text-center">
        <Avatar name={account.name} imageUrl={account.profileImageUrl} size="lg" className="opacity-60" />
        <p className="font-semibold text-muted">{account.name}</p>
        <p className="text-xs text-muted">{cardState === 'PRIVATE' ? '카드를 비공개로 두었어요.' : '아직 PR 카드를 작성하지 않았어요.'}</p>
        <Badge tone="warning">{cardState === 'PRIVATE' ? '비공개' : '미작성'}</Badge>
      </div>
    );
  }

  return (
    <Link
      to={to}
      className="group flex h-full flex-col items-center gap-2 rounded-card border border-outline-soft bg-surface px-4 py-5 text-center transition-colors hover:border-peri-300 hover:bg-peri-50"
    >
      <Avatar name={account.name} imageUrl={account.profileImageUrl} size="lg" />
      <p className="font-bold text-ink">
        {account.name}
        {isMe && <span className="ml-1 text-xs font-semibold text-primary">(나)</span>}
      </p>
      <RoleBadges member={member} />
      <dl className="mt-0.5 space-y-0.5 text-xs text-muted">
        {card.weeklyAvailableHours && (
          <div className="flex items-center justify-center gap-1">
            <dt>
              <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">주간 가용 시간</span>
            </dt>
            <dd>{WEEKLY_HOURS_LABEL[card.weeklyAvailableHours]}</dd>
          </div>
        )}
        {card.goalTemperature !== undefined && (
          <div className="flex items-center justify-center gap-1">
            <dt>
              <FireIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">목표 온도</span>
            </dt>
            <dd className="tabular-nums">{card.goalTemperature}/5</dd>
          </div>
        )}
      </dl>
      {card.hashtags.length > 0 && (
        <ul className="mt-auto flex flex-wrap justify-center gap-1 pt-1" aria-label="태그">
          {card.hashtags.slice(0, 3).map((tag) => (
            <li key={tag} className="rounded bg-surface-container px-1.5 py-0.5 text-[0.6875rem] text-muted">
              {tag}
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
};
