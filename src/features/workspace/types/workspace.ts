export type WorkspaceMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type WorkspaceMemberStatus = 'ACTIVE' | 'BANNED' | 'LEFT';

export interface WorkspaceMemberInfo {
  id: number;
  name: string;
  email?: string;
  profileImage?: string;
  role: WorkspaceMemberRole | string;
  status?: WorkspaceMemberStatus;
  joinedAt?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  owner: {
    id: number;
    name: string;
    profileImage?: string;
    role: string;
  };
  currentMemberRole?: WorkspaceMemberRole;
  passwordProtected: boolean;
  inviteCode?: string;
  inviteCodeExpiresAt?: string | null;
  inviteUsedCount?: number;
  inviteActive?: boolean;
  capacity?: number;
  teamBuildingEnabled?: boolean;
  archived?: boolean;
  url?: string;
  memberCount: number;
  members: WorkspaceMemberInfo[];
  createdAt: string;
  updatedAt: string;
}
