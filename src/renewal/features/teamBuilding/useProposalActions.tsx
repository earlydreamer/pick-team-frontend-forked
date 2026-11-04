import { useState } from 'react';
import { acceptConsequence, acceptMessage } from '@/renewal/domain/proposals';
import type { ApplicationView, Inbox } from '@/renewal/domain/teamBuilding';
import { useAccept, useDecline, useWithdraw } from '@/renewal/data/queries';
import { toast } from '@/renewal/ui';
import { ConfirmModal } from './shared';

interface PendingAccept {
  view: ApplicationView;
  message: string;
}

/**
 * 제안 수락·거절·철회. 수락은 팀 합류를 확정하고 다른 제안을 함께 끝내므로 결과를 알리는 확인을 거친다(12 §4.3).
 * 거절과 철회는 한 건만 바꾸므로 바로 처리하고 결과를 토스트로 알린다.
 */
export const useProposalActions = (workspaceId: string, onError: (error: unknown) => void) => {
  const accept = useAccept(workspaceId);
  const decline = useDecline(workspaceId);
  const withdraw = useWithdraw(workspaceId);
  const [confirming, setConfirming] = useState<PendingAccept | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const requestAccept = (view: ApplicationView, inbox: Inbox, openSeats: number) =>
    setConfirming({ view, message: acceptMessage(acceptConsequence(view, inbox, openSeats)) });

  const run = async (view: ApplicationView, action: (id: string) => Promise<unknown>, done: string) => {
    setBusyId(view.application.id);
    try {
      await action(view.application.id);
      toast.success(done);
    } catch (error) {
      onError(error);
    } finally {
      setBusyId(null);
    }
  };

  const confirmAccept = async () => {
    if (!confirming) return;
    const { view } = confirming;
    const done = view.application.direction === 'SCOUT' ? `${view.team.name}에 합류했어요.` : `${view.applicant.name}님이 팀에 합류했어요.`;
    await run(view, accept.mutateAsync, done);
    setConfirming(null);
  };

  const modal = (
    <ConfirmModal
      open={confirming !== null}
      title={confirming?.view.application.direction === 'SCOUT' ? `${confirming.view.team.name} 스카우트 수락` : `${confirming?.view.applicant.name ?? ''}님 지원 수락`}
      description={confirming?.message ?? ''}
      confirmLabel="수락하기"
      pending={accept.isPending}
      onClose={() => setConfirming(null)}
      onConfirm={confirmAccept}
    />
  );

  return {
    modal,
    busyId,
    requestAccept,
    decline: (view: ApplicationView) => run(view, decline.mutateAsync, '거절했어요.'),
    withdraw: (view: ApplicationView) => run(view, withdraw.mutateAsync, '철회했어요.'),
  };
};
