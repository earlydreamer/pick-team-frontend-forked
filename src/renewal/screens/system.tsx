import React, { useEffect, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { MapIcon, WrenchScrewdriverIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { EmptyState, ErrorState, LoadingState, buttonClassName, toast } from '@/renewal/ui';
import { useMe, useMyWorkspaces } from '@/renewal/data/queries';
import { workspaceEntryPath } from '@/renewal/shell/entry';

/**
 * 첫 진입. 소속 워크스페이스가 있으면 첫 워크스페이스의 진입 경로(02-D4)로, 없으면 무소속 랜딩으로 보낸다.
 */
export const RootRedirect: React.FC = () => {
  const { data, isLoading, isError, refetch } = useMyWorkspaces();
  const me = useMe();
  if (isLoading) return <LoadingState className="min-h-[60vh]" label="워크스페이스를 불러오는 중이에요" />;
  if (isError)
    return (
      <ErrorState
        className="min-h-[60vh]"
        title="워크스페이스를 불러오지 못했어요"
        description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
        action={
          <button type="button" className={buttonClassName('primary')} onClick={() => refetch()}>
            다시 시도
          </button>
        }
      />
    );
  if (!data || data.length === 0) return <Navigate to="/welcome" replace />;
  if (me.isLoading) return <LoadingState className="min-h-[60vh]" label="워크스페이스를 불러오는 중이에요" />;
  return <Navigate to={workspaceEntryPath(me.data?.id, data[0])} replace />;
};

/**
 * 아직 구현하지 않은 IA 화면. 빈 화면 대신 화면 ID와 상태를 알려 막다른 길을 만들지 않는다.
 */
export const PendingScreen: React.FC<{ screenId: string; title: string }> = ({ screenId, title }) => (
  <EmptyState
    className="min-h-[60vh]"
    icon={<WrenchScrewdriverIcon className="h-7 w-7" />}
    title={`${title} 화면은 준비 중이에요`}
    description={<span className="tabular-nums">{screenId}</span>}
    action={
      <Link to="/" className={buttonClassName('outline')}>
        홈으로 가기
      </Link>
    }
  />
);

export const NotFoundScreen: React.FC = () => (
  <EmptyState
    className="min-h-[60vh]"
    icon={<MapIcon className="h-7 w-7" />}
    title="페이지를 찾을 수 없어요"
    description="주소가 바뀌었거나 볼 수 없는 페이지예요."
    action={
      <Link to="/" className={buttonClassName('primary')}>
        홈으로 가기
      </Link>
    }
  />
);

/**
 * 관리 화면에 권한 없이 들어왔을 때의 안내(02-D2: 관리 화면은 403 안내, 비공개 자원은 404 은닉).
 */
export const ForbiddenScreen: React.FC<{ backTo: string }> = ({ backTo }) => (
  <EmptyState
    className="min-h-[60vh]"
    icon={<LockClosedIcon className="h-7 w-7" />}
    title="개설자와 매니저만 볼 수 있는 화면이에요"
    description="권한이 필요하면 워크스페이스 개설자에게 문의해 주세요."
    action={
      <Link to={backTo} className={buttonClassName('outline')}>
        워크스페이스 홈으로
      </Link>
    }
  />
);

/**
 * 딥링크 대상이 없을 때(16 §6.4). 404 화면 대신 안내 토스트를 띄우고 한 단계 위 화면으로 보낸다.
 * 내가 방금 지우거나 나가서 사라진 경우에는 silent로 토스트 없이 옮긴다(이미 결과 토스트가 떴다).
 * 비공개 자원도 같은 문구로 다뤄 존재 여부를 드러내지 않는다(02 §4).
 */
export const MissingRedirect: React.FC<{ to: string; silent?: boolean; message?: string }> = ({ to, silent = false, message = '삭제됐거나 볼 수 없는 항목이에요.' }) => {
  const shown = useRef(false);
  useEffect(() => {
    if (silent || shown.current) return;
    shown.current = true;
    toast.info(message);
  }, [silent, message]);
  return <Navigate to={to} replace />;
};

