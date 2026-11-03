import React from 'react';
import { Link } from 'react-router-dom';
import { Modal, buttonClassName } from '@/components/ui';
import { ProfileCard } from '@/features/user/mypage/components/ProfileCard';
import type { User } from '@/types';

/** 멤버 프로필(PR 카드) 대화상자 */
export const MemberProfileModal: React.FC<{ member: User | null; onClose: () => void }> = ({ member, onClose }) => {
  if (!member) return null;
  return (
    <Modal isOpen onClose={onClose} title={`${member.name || '이름 없음'}님의 프로필`} size="lg">
      <ProfileCard user={member} />
      <div className="mt-6 flex justify-end">
        <Link to={`/users/${member.id}`} className={buttonClassName('outline')} onClick={onClose}>
          프로필 페이지 열기
        </Link>
      </div>
    </Modal>
  );
};
