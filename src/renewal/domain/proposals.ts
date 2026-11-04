/**
 * 제안 수락의 결과 계산. 수락 확인 대화상자가 "무엇이 함께 바뀌는지"를 실제 규칙과 같게 알리도록
 * mock 규칙(data/mock/rules.ts accept)과 같은 기준으로 센다. 근거: 12 §4.3, §5.2.
 */
import type { ApplicationView, Inbox } from './teamBuilding';

export interface AcceptConsequence {
  /** 합류하는 사람(지원자 또는 스카우트 대상) */
  joinerName: string;
  teamName: string;
  /** 받는 쪽이 개인(스카우트 수락)인지, 팀장(지원 수락)인지 */
  acceptingAs: 'MEMBER' | 'LEADER';
  /** 합류하는 사람의 다른 대기 제안 중 자동 철회되는 건수(내가 볼 수 있는 범위) */
  autoWithdrawn: number;
  /** 이 수락으로 정원이 차서 정원 마감으로 끝나는 같은 팀의 다른 대기 제안 건수 */
  closedByCapacity: number;
}

const isPending = (view: ApplicationView) => view.application.status === 'PENDING';

/**
 * @param openSeats 수락 대상 팀의 현재 빈자리 수
 */
export const acceptConsequence = (target: ApplicationView, inbox: Inbox, openSeats: number): AcceptConsequence => {
  const { application } = target;
  const others = [...inbox.received, ...inbox.sent].filter((view) => isPending(view) && view.application.id !== application.id);
  const fillsTeam = openSeats <= 1;

  if (application.direction === 'SCOUT') {
    // 내가 스카우트를 수락하면 내가 보낸 지원과 내가 받은 다른 스카우트가 모두 자동 철회된다.
    return {
      joinerName: target.applicant.name,
      teamName: target.team.name,
      acceptingAs: 'MEMBER',
      autoWithdrawn: others.filter((view) => view.application.applicantId === application.applicantId).length,
      closedByCapacity: 0,
    };
  }

  // 팀장이 지원을 수락할 때 지원자의 다른 지원은 팀장에게 보이지 않으므로 세지 않는다.
  return {
    joinerName: target.applicant.name,
    teamName: target.team.name,
    acceptingAs: 'LEADER',
    autoWithdrawn: 0,
    closedByCapacity: fillsTeam
      ? others.filter((view) => view.application.teamId === application.teamId && view.application.applicantId !== application.applicantId).length
      : 0,
  };
};

/** 수락 확인 대화상자 문구(해요체 UI 문구). */
export const acceptMessage = (result: AcceptConsequence) => {
  if (result.acceptingAs === 'MEMBER') {
    const tail = result.autoWithdrawn > 0 ? `되고, 답변을 기다리는 내 다른 제안 ${result.autoWithdrawn}건은 자동 철회돼요` : '돼요';
    return `수락하면 ${result.teamName} 합류가 확정${tail}. 되돌릴 수 없어요.`;
  }
  const capacity = result.closedByCapacity > 0 ? ` 정원이 차서 답변을 기다리는 다른 제안 ${result.closedByCapacity}건은 정원 마감으로 끝나요.` : '';
  return `수락하면 ${result.joinerName}님이 ${result.teamName}에 합류해요.${capacity} 되돌릴 수 없어요.`;
};
