import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button, Modal, TextArea } from '@/components/ui';
import { useRenewal } from '@/features/renewal/context/RenewalContext';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import {
  ROLE_META,
  WEEKLY_HOURS_META,
  TIME_SLOT_META,
  WORKSTYLE_META,
  GOAL_TEMPERATURE_META,
} from '@/features/renewal/types/renewal';
import { calculateMemberToMemberMatch } from '@/features/renewal/utils/matchingEngine';
import { ReportModal } from '@/features/renewal/components/ReportModal';
import { MemberAvatar } from '@/features/renewal/components/PeriwinkleArtwork';
import { DesiredRoleCode } from '@/features/user/types/user';

export const UserProfileViewPage: React.FC = () => {
  const { workspaceId, accountId, userId } = useParams<{
    workspaceId?: string;
    accountId?: string;
    userId?: string;
  }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const {
    getWorkspaceById,
    getMemberCard,
    myPRCard,
    getSession,
    getRecruitments,
    submitApplication,
  } = useRenewal();

  const activeWs = getWorkspaceById(workspaceId);
  const wsId = activeWs.id;
  const targetId = accountId || userId || '1';
  const member = getMemberCard(wsId, targetId);
  const session = getSession(wsId);
  const recruitments = getRecruitments(wsId);

  const isMyCard = String(currentUser?.id || '1') === String(targetId);
  const myTeam = recruitments.find((t) => t.id === myPRCard.assignedTeamId) || recruitments[0];

  const [scoutModalOpen, setScoutModalOpen] = useState(false);
  const [scoutRole, setScoutRole] = useState<DesiredRoleCode>(
    member?.desiredRole1 || 'BACKEND'
  );
  const [scoutMessage, setScoutMessage] = useState(
    'PR 카드의 희망 역할과 협업 스타일이 저희 팀과 잘 맞아 스카우트 제안드립니다.'
  );
  const [reportModalOpen, setReportModalOpen] = useState(false);

  if (!member) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center space-y-4">
        <h1 className="text-lg font-bold text-ink-primary">멤버 카드를 찾을 수 없습니다</h1>
        <Button variant="primary" size="sm" onClick={() => navigate(`/ws/${wsId}/members`)}>
          팀원 찾기로 돌아가기
        </Button>
      </div>
    );
  }

  if (!member.cardVisible || !member.consentGivenAt) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 space-y-4 text-center">
        <h1 className="text-lg font-bold text-ink-primary">
          {member.name} 님의 PR 카드는 현재 비공개 상태입니다
        </h1>
        <Button variant="outline" size="sm" onClick={() => navigate(`/ws/${wsId}/members`)}>
          목록으로 돌아가기
        </Button>
      </div>
    );
  }

  const matchWithMe = calculateMemberToMemberMatch(myPRCard, member);

  const handleSendScout = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = submitApplication(wsId, {
      direction: 'SCOUT',
      targetTeamId: myTeam.id,
      targetMemberId: member.id,
      desiredRole: scoutRole,
      message: scoutMessage,
    });
    if (ok) setScoutModalOpen(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-5">
      <div className="flex items-center justify-between">
        <Link
          to={`/ws/${wsId}/members`}
          className="text-xs sm:text-sm font-semibold text-ink-secondary hover:text-peri-600"
        >
          ← 팀원 찾기로 돌아가기
        </Link>
        {!isMyCard && (
          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="text-xs text-ink-tertiary hover:text-rose-600 cursor-pointer"
          >
            신고하기
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200/85 shadow-craft-sm p-6 sm:p-8 space-y-7">
        {/* Top Profile Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-100">
          <div className="flex items-center gap-4">
            <MemberAvatar name={member.name} size="xl" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-ink-primary">{member.name}</h1>
                {member.mbtiVisible && member.mbti && (
                  <span className="px-2 py-0.5 rounded bg-surface-subtle text-ink-tertiary text-xs font-medium">
                    {member.mbti}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-ink-tertiary mt-1">
                {member.desiredRole1 ? `${ROLE_META[member.desiredRole1].label} 1순위` : '백엔드'}
                {member.desiredRole2 ? ` · ${ROLE_META[member.desiredRole2].label} 2순위` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMyCard ? (
              <Button variant="primary" size="sm" onClick={() => navigate('/me/card')}>
                PR 카드 수정
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/ws/${wsId}/chat/dm-${member.id}`)}
                >
                  메시지 보내기
                </Button>
                {session.status === 'OPEN' && (
                  <Button variant="primary" size="sm" onClick={() => setScoutModalOpen(true)}>
                    스카우트 제안
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Match Fit Summary */}
        {!isMyCard && (
          <div className="rounded-xl bg-peri-50/70 border border-peri-200/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-peri-700">나와의 협업 적합도 근거</div>
              <div className="text-xs sm:text-sm font-semibold text-ink-primary">
                {matchWithMe.reasons.join(' · ')}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-bold text-peri-700 tabular-nums">
                {Math.min(99, matchWithMe.totalScore + 8)}% 일치
              </div>
            </div>
          </div>
        )}

        {/* Key Specs Grid */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-surface-subtle/60 space-y-1">
            <div className="text-xs text-ink-tertiary">주간 가용 시간</div>
            <div className="text-sm font-bold text-ink-primary">
              {member.weeklyAvailableHours
                ? WEEKLY_HOURS_META[member.weeklyAvailableHours].label
                : '20~30시간'}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-surface-subtle/60 space-y-1">
            <div className="text-xs text-ink-tertiary">선호 시간대</div>
            <div className="text-sm font-bold text-ink-primary">
              {(member.availableTimeSlots || ['AFTERNOON', 'EVENING'])
                .map((s) => TIME_SLOT_META[s].label)
                .join(' · ')}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-surface-subtle/60 space-y-1">
            <div className="text-xs text-ink-tertiary">목표 수준</div>
            <div className="text-sm font-bold text-ink-primary">
              {GOAL_TEMPERATURE_META[member.goalTemperature || 4].label}
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="space-y-2.5">
          <h2 className="text-xs font-semibold text-ink-tertiary">기술 스택</h2>
          <div className="flex flex-wrap gap-1.5">
            {(member.hashtags || []).map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-lg bg-peri-50 text-peri-700 text-xs font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Workstyle & Introduction */}
        <div className="space-y-2.5">
          <h2 className="text-xs font-semibold text-ink-tertiary">협업 스타일 및 소개</h2>
          <div className="flex flex-wrap gap-1.5 pb-1">
            {(member.preferWorkstyleOptions || []).map((code) => (
              <span
                key={code}
                className="px-2.5 py-1 rounded-md bg-surface-subtle text-ink-secondary text-xs font-medium"
              >
                {WORKSTYLE_META[code].label}
              </span>
            ))}
          </div>
          <p className="text-sm text-ink-primary leading-relaxed whitespace-pre-line">
            {member.introduction}
          </p>
          {member.portfolio && (
            <div className="pt-2">
              <a
                href={member.portfolio}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-peri-600 hover:underline"
              >
                포트폴리오 보기 ({member.portfolio}) →
              </a>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={scoutModalOpen}
        onClose={() => setScoutModalOpen(false)}
        title={`${member.name} 님에게 스카우트 제안`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setScoutModalOpen(false)}>
              취소
            </Button>
            <Button variant="primary" size="sm" onClick={handleSendScout}>
              제안 보내기
            </Button>
          </>
        }
      >
        <form onSubmit={handleSendScout} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">
              제안 역할
            </label>
            <select
              value={scoutRole}
              onChange={(e) => setScoutRole(e.target.value as DesiredRoleCode)}
              className="w-full h-9 px-3 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-ink-primary"
            >
              {(Object.keys(ROLE_META) as DesiredRoleCode[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_META[r].label}
                </option>
              ))}
            </select>
          </div>
          <TextArea
            label="메시지"
            name="scoutMessage"
            maxLength={200}
            value={scoutMessage}
            onChange={(e) => setScoutMessage(e.target.value)}
          />
        </form>
      </Modal>

      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        workspaceId={wsId}
        targetType="CARD"
        targetId={member.id}
        targetLabel={`${member.name} 님의 PR 카드`}
        targetContentSnippet={member.introduction || ''}
      />
    </div>
  );
};

export default UserProfileViewPage;
