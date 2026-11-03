import React from 'react';
import { Link } from 'react-router-dom';
import { MapIcon } from '@heroicons/react/24/outline';
import { buttonClassName, EmptyState } from '@/components/ui';

/** 없는 주소. 지금 갈 수 있는 곳(첫 화면)을 함께 안내합니다. */
export const NotFoundPage: React.FC = () => (
  <EmptyState
    className="min-h-[70vh]"
    icon={<MapIcon className="h-7 w-7" />}
    title="페이지를 찾을 수 없어요"
    description="주소가 바뀌었거나 삭제된 화면이에요. 링크를 다시 확인해 주세요."
    action={
      <Link to="/" className={buttonClassName('primary')}>
        첫 화면으로 가기
      </Link>
    }
  />
);
