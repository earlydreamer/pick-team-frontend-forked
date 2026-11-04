import React from 'react';
import { Link } from 'react-router-dom';
import { relativeTime } from '@/renewal/domain/announcement';
import type { ApplicationView } from '@/renewal/domain/teamBuilding';
import { Avatar, Button } from '@/renewal/ui';
import { ApplicationStatusBadge } from './shared';

/**
 * 제안 한 건(12 §4.3). 방향(지원·스카우트)과 주체를 한 줄로 보여 주고,
 * 끝난 제안은 흐리게 두되 상태와 사유를 글자로 남긴다(히스토리 보존).
 */
export const ProposalItem: React.FC<{
  view: ApplicationView;
  box: 'received' | 'sent';
  myId?: string;
  workspaceId: string;
  /** 세션이 모집 중일 때만 수락·거절·철회할 수 있다 */
  actionable: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onWithdraw: () => void;
}> = ({ view, box, myId, workspaceId, actionable, busy, onAccept, onDecline, onWithdraw }) => {
  const { application, team, applicant } = view;
  const scout = application.direction === 'SCOUT';
  const applicantIsMe = applicant.id === myId;
  const pending = application.status === 'PENDING';
  const from = scout ? (box === 'sent' ? `내 팀 ${team.name}` : team.name) : applicantIsMe ? '나' : applicant.name;
  const to = scout ? (applicantIsMe ? '나' : applicant.name) : box === 'received' ? `내 팀 ${team.name}` : team.name;
  const counterpart = applicantIsMe
    ? { to: `/ws/${workspaceId}/team-building/teams/${team.id}`, label: '팀 보기' }
    : { to: `/ws/${workspaceId}/members/${applicant.id}`, label: '카드 보기' };

  return (
    <li className={`flex flex-wrap items-start gap-3 px-4 py-3.5 ${pending ? '' : 'bg-surface-low'}`}>
      <Avatar name={applicantIsMe ? team.name : applicant.name} imageUrl={applicantIsMe ? undefined : applicant.profileImageUrl} size="md" shape={applicantIsMe ? 'rounded' : 'circle'} className={pending ? '' : 'opacity-60'} />
      <div className={`min-w-0 flex-1 ${pending ? '' : 'text-muted'}`}>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`text-xs font-semibold ${scout ? 'text-primary' : 'text-ink'}`}>{scout ? '스카우트' : '지원'}</span>
          <span className="font-semibold">
            {from}
            <span aria-hidden="true"> → </span>
            <span className="sr-only">에서 </span>
            {to}
          </span>
          {!pending && <ApplicationStatusBadge status={application.status} />}
        </p>
        {application.message && <p className="mt-1 whitespace-pre-line break-words text-sm leading-6">“{application.message}”</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted">
          <span>
            {relativeTime(application.createdAt)} {box === 'received' ? '받음' : '보냄'}
          </span>
          {application.reason && <span>{application.reason}</span>}
          <Link to={counterpart.to} className="inline-flex min-h-touch items-center font-semibold text-primary underline-offset-4 hover:underline">
            {counterpart.label}
          </Link>
        </p>
      </div>
      {pending && actionable && (
        <div className="flex w-full shrink-0 justify-end gap-2 sm:w-auto sm:self-center">
          {box === 'received' ? (
            <>
              <Button size="sm" onClick={onAccept} disabled={busy}>
                수락
              </Button>
              <Button size="sm" variant="outline" onClick={onDecline} loading={busy}>
                거절
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={onWithdraw} loading={busy}>
              철회
            </Button>
          )}
        </div>
      )}
    </li>
  );
};
