import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Workspace, TeamProject } from '@/types';
import { workspaceApi } from '@/features/workspace/management/api/workspaceApi';
import { teamApi } from '@/features/teamspace/team/api/teamApi';
import { useAuth } from '@/features/user/auth/context/AuthContext';

export interface WorkspaceContextType {
    workspaces: Workspace[];
    currentWorkspace: Workspace | null;
    currentTeamProject: any | null; // TeamProject -> any
    teams: any[]; // 현재 워크스페이스의 팀 목록
    loadWorkspaces: () => Promise<void>;
    loadTeams: () => Promise<void>;
    addTeam: (team: any) => void;
    createWorkspace: (data: { name: string; iconUrl?: string; password?: string }) => Promise<Workspace>;
    joinWorkspace: (data: { inviteCode: string; password?: string }) => Promise<Workspace>;
    // joinWorkspaceById: 보안상 제거됨 - 초대 코드만 사용
    setCurrentWorkspaceById: (workspaceId: string | null) => void;
    setCurrentTeamProject: (teamProject: any | null) => void; // TeamProject -> any
    loading: boolean;
    error: string | null;
}

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: ReactNode }> = ({
    children,
}) => {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
    const [currentTeamProject, setCurrentTeamProject] = useState<TeamProject | null>(null);
    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasLoaded, setHasLoaded] = useState(false);
    const { currentUser, isAuthenticated } = useAuth();

    useEffect(() => {
        console.log('WorkspaceContext - currentUser:', currentUser, 'isAuthenticated:', isAuthenticated, 'hasLoaded:', hasLoaded);
        
        if (currentUser && isAuthenticated && !hasLoaded) {
            console.log('워크스페이스 로드 시작');
            loadWorkspaces();
        } else if (!currentUser || !isAuthenticated) {
            console.log('인증되지 않음, 워크스페이스 초기화');
            setWorkspaces([]);
            setCurrentWorkspace(null);
            setCurrentTeamProject(null);
            setTeams([]);
            setLoading(false);
            setHasLoaded(false);
        }
    }, [currentUser, isAuthenticated, hasLoaded]); // hasLoaded 의존성 다시 추가

    // 워크스페이스 변경 시 팀 목록 로드
    useEffect(() => {
        if (currentWorkspace) {
            loadTeams();
        }
    }, [currentWorkspace]);

    // 최초 로드는 위 effect의 hasLoaded로 한 번만 실행하고, 직접 호출하면 항상 다시 불러옵니다(재시도·참여 후 갱신).
    const loadWorkspaces = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('워크스페이스 API 호출 시작');
            const data = await workspaceApi.getMyWorkspaces();
            console.log('워크스페이스 데이터 수신:', data);
            setWorkspaces(data);
            
            // 현재 워크스페이스가 없고 워크스페이스가 있다면 첫 번째 워크스페이스를 설정
            if (data.length > 0 && !currentWorkspace) {
                console.log('첫 번째 워크스페이스로 설정:', data[0]);
                setCurrentWorkspace(data[0]);
            } else if (data.length === 0) {
                console.log('워크스페이스가 없음');
            }
            setHasLoaded(true);
        } catch (err: any) {
            console.error('워크스페이스 로드 실패:', err);
            setError(err.message || '워크스페이스 목록을 불러오는데 실패했습니다.');
            setHasLoaded(true); // 실패해도 재시도 방지
        } finally {
            setLoading(false);
        }
    };

    const loadTeams = async () => {
        if (!currentWorkspace) {
            setTeams([]);
            return;
        }
        
        try {
            const teamList = await teamApi.getTeams(currentWorkspace.id);
            setTeams(teamList);
        } catch (err: any) {
            console.error('팀 목록 로드 실패:', err);
            setTeams([]);
        }
    };

    const addTeam = (team: any) => {
        setTeams(prev => [...prev, team]);
    };

    const createWorkspace = async (data: { name: string; iconUrl?: string; password?: string }) => {
        try {
            const newWorkspace = await workspaceApi.create(data);
            setWorkspaces(prev => [...prev, newWorkspace]);
            setCurrentWorkspace(newWorkspace);
            return newWorkspace;
        } catch (err: any) {
            setError(err.message || '워크스페이스 생성에 실패했습니다.');
            console.error(err);
            throw err;
        }
    };

    const joinWorkspace = async (data: { inviteCode: string; password?: string }) => {
        try {
            const joinedWorkspace = await workspaceApi.join(data);
            // 이미 워크스페이스 목록에 있는지 확인
            if (!workspaces.some(ws => ws.id === joinedWorkspace.id)) {
                setWorkspaces(prev => [...prev, joinedWorkspace]);
            }
            setCurrentWorkspace(joinedWorkspace);
            return joinedWorkspace;
        } catch (err: any) {
            setError(err.message || '워크스페이스 참여에 실패했습니다.');
            console.error(err);
            throw err;
        }
    };

    // joinWorkspaceById: 보안상 제거됨 - 초대 코드만 사용
    /*
    const joinWorkspaceById = async (workspaceId: string, password?: string) => {
        try {
            const joinedWorkspace = await workspaceApi.joinById(workspaceId, password);
            if (!workspaces.some(ws => ws.id === joinedWorkspace.id)) {
                setWorkspaces(prev => [...prev, joinedWorkspace]);
            }
            setCurrentWorkspace(joinedWorkspace);
            return joinedWorkspace;
        } catch (err: any) {
            setError(err.message || 'ID로 워크스페이스 참여에 실패했습니다.');
            console.error(err);
            throw err;
        }
    };
    */

    const setCurrentWorkspaceById = (workspaceId: string | null) => {
        if (!workspaceId) {
            setCurrentWorkspace(null);
            setCurrentTeamProject(null); // 워크스페이스 변경 시 팀도 초기화
            setTeams([]); // 팀 목록도 초기화
            return;
        }
        
        // 우선 ID로 찾기, 없으면 초대 코드로 찾기 (하위 호환성)
        const workspace = workspaces.find(ws => 
            ws.id === workspaceId ||
            ws.inviteCode === workspaceId || 
            ws.url === workspaceId
        );
        
        if (workspace) {
            // 이미 현재 워크스페이스라면 아무것도 하지 않음 (무한 반복 방지)
            if (currentWorkspace?.id === workspace.id) {
                return;
            }
            setCurrentWorkspace(workspace);
            setCurrentTeamProject(null); // 워크스페이스 변경 시 팀도 초기화
            setTeams([]); // 팀 목록도 초기화
        }
    };

    const value: WorkspaceContextType = {
        workspaces,
        currentWorkspace,
        currentTeamProject,
        teams,
        loadWorkspaces,
        loadTeams,
        addTeam,
        createWorkspace,
        joinWorkspace,
        // joinWorkspaceById: 보안상 제거됨
        setCurrentWorkspaceById,
        setCurrentTeamProject,
        loading,
        error,
    };

    return (
        <WorkspaceContext.Provider value={value}>
            {children}
        </WorkspaceContext.Provider>
    );
};

export const useWorkspace = (): WorkspaceContextType => {
    const context = useContext(WorkspaceContext);
    if (context === undefined) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
}; 