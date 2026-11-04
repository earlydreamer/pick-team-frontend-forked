import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui';
import { CreateWorkspaceForm } from './WorkspaceForms';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  return (
  <Modal isOpen={isOpen} onClose={onClose} title="워크스페이스 만들기" description="과정이나 조직 단위로 만들고 멤버를 초대해요.">
    <CreateWorkspaceForm
      showCancel
      onCancel={onClose}
      onDone={(workspace) => {
        onClose();
        navigate(`/ws/${workspace.id}`);
      }}
    />
  </Modal>
  );
};

export default CreateWorkspaceModal;
