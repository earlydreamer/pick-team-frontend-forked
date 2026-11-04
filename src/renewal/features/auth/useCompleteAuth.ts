import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { safeRedirect } from '@/renewal/domain/auth';
import type { Account } from '@/renewal/domain/workspace';
import { keys } from '@/renewal/data/queries';
import { readPendingInvite } from './pendingInvite';

/**
 * 로그인·가입·OAuth를 마친 뒤의 이동(10 §5.1). 보존한 초대 코드가 있으면 초대 랜딩으로 돌아가 합류를 마치고,
 * 없으면 redirect 쿼리의 원래 목적지(앱 안의 경로만)나 첫 화면으로 간다.
 * 합류 처리를 초대 랜딩 한곳에 모아 비밀번호 입력(10-D4)과 실패 후 재시도(10 §5.2)를 같은 화면에서 다룬다.
 */
export const useCompleteAuth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const client = useQueryClient();
  return (account: Account) => {
    // 이전 계정의 캐시가 섞이지 않도록 비우고 새 계정으로 채운다.
    client.clear();
    client.setQueryData(keys.me, account);
    const invite = readPendingInvite();
    if (invite) {
      navigate(`/invite/${encodeURIComponent(invite)}?join=1`, { replace: true });
      return;
    }
    navigate(safeRedirect(params.get('redirect')) ?? '/', { replace: true });
  };
};
