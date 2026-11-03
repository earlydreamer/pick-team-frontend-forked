import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui';
import { JoinWorkspaceForm } from './WorkspaceForms';

interface JoinWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialInviteCode?: string;
}

const JoinWorkspaceModal: React.FC<JoinWorkspaceModalProps> = ({ isOpen, onClose, initialInviteCode }) => {
  const navigate = useNavigate();
  return (
  <Modal isOpen={isOpen} onClose={onClose} title="워크스페이스 참여" description="관리자에게 받은 초대 링크나 코드를 입력해 주세요.">
    <JoinWorkspaceForm
      showCancel
      onCancel={onClose}
      initialInviteCode={initialInviteCode}
      onDone={(workspace) => {
        onClose();
        navigate(`/ws/${workspace.id}`);
      }}
    />
  </Modal>
  );
};

export default JoinWorkspaceModal;
