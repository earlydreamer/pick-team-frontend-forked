import React from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { EmptyState } from '@/components/ui';

/**
 * 알림 센터. 백엔드에 알림 API가 아직 없어 예전처럼 가상의 알림을 보여 주지 않고 준비 상태를 안내합니다.
 * 알림 API가 생기면 이 화면에서 목록·읽음 처리·해당 항목으로 이동을 구현합니다(docs/redesign-plan.md).
 */
export const NotificationsPage: React.FC = () => (
  <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-10">
    <h1 className="text-2xl font-bold leading-8">알림</h1>
    <div className="mt-6 rounded-card border border-outline-soft bg-surface">
      <EmptyState
        icon={<BellIcon className="h-7 w-7" />}
        title="알림은 준비 중이에요"
        description="새 메시지와 일정은 각 채팅방과 팀 캘린더에서 확인해 주세요."
      />
    </div>
  </div>
);
