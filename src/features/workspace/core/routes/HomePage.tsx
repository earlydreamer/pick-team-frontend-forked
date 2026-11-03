import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import { useWorkspace } from '@/features/workspace/core/hooks/useWorkspace';
import {
  Card,
  Button,
  Modal,
} from '@/components/ui';
import { User, Workspace } from '@/types';
import { workspaceApi } from '@/features/workspace/management/api/workspaceApi';
import { UserIcon, UsersIcon } from '@/assets/icons';
import TeamActionModal from '@/features/teamspace/team/components/TeamActionModal';
import { getProfileImageSrc, handleImageError } from '@/lib/imageUtils';

export const HomePage: React.FC = () => {
  const { currentUser } = useAuth();
  const { 
    currentWorkspace, 
    setCurrentWorkspaceById, 
    setCurrentTeamProject, 
    workspaces, 
    loadWorkspaces, 
    teams, 
    addTeam 
  } = useWorkspace();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  // 워크스페이스 멤버 관련 상태
  const [workspaceMembers, setWorkspaceMembers] = useState<User[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  // 선택된 멤버 상세 정보 상태
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [isMemberDetailModalOpen, setIsMemberDetailModalOpen] = useState(false);

  // 팀 액션 모달 상태
  const [isTeamActionModalOpen, setIsTeamActionModalOpen] = useState(false);

  // 워크스페이스 멤버 목록 조회 (전체)
  const fetchWorkspaceMembers = async () => {
    if (!currentWorkspace) return;
    
    setIsLoadingMembers(true);
    setMembersError(null);
    
    try {
      const members = await workspaceApi.getMembers(currentWorkspace.id);
      setWorkspaceMembers(members);
      setIsMembersModalOpen(true);
    } catch (error: any) {
      console.error('워크스페이스 멤버 조회 실패:', error);
      setMembersError(error.message || '멤버 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // 워크스페이스 멤버 미리보기 로드 (4명)
  const loadMembersPreview = async () => {
    if (!currentWorkspace) return;
    
    try {
      console.log('워크스페이스 멤버 로드 시작:', currentWorkspace.id, currentWorkspace.name);
      const members = await workspaceApi.getMembers(currentWorkspace.id);
      console.log('로드된 멤버 목록:', members);
      setWorkspaceMembers(members);
    } catch (error: any) {
      console.error('워크스페이스 멤버 미리보기 로드 실패:', error);
      setMembersError(error.message || '멤버 목록을 불러오는데 실패했습니다.');
    }
  };

  // 멤버 상세 정보 보기
  const showMemberDetail = (member: User) => {
    setSelectedMember(member);
    setIsMemberDetailModalOpen(true);
  };

  // 워크스페이스의 팀 목록 로드 - 더 이상 필요하지 않음 (워크스페이스 컨텍스트에서 자동으로 처리)
  // const loadTeams = async () => {
  //   if (!currentWorkspace) return;
  //   
  //   setIsLoadingTeams(true);
  //   setTeamsError(null);
  //   
  //   try {
  //     const teamList = await teamApi.getTeams(currentWorkspace.id);
  //     setTeams(teamList);
  //   } catch (error: any) {
  //     console.error('팀 목록 로드 실패:', error);
  //     setTeamsError(error.message || '팀 목록을 불러오는데 실패했습니다.');
  //   } finally {
  //     setIsLoadingTeams(false);
  //   }
  // };

  // 팀 액션 모달 열기
  const handleOpenTeamActionModal = () => {
    setIsTeamActionModalOpen(true);
  };

  // 팀 생성 완료 후 처리
  const handleTeamCreated = (newTeam: any) => {
    addTeam(newTeam);
    setIsTeamActionModalOpen(false);
  };

  useEffect(() => {
    if (workspaceId && (!currentWorkspace || currentWorkspace.id !== workspaceId)) {
      // 실제 workspaces 배열에서 찾기 (ID 또는 초대 코드로)
      const targetWs = workspaces.find((ws: Workspace) => 
        ws.id === workspaceId || 
        ws.inviteCode === workspaceId || 
        ws.url === workspaceId
      );
      if (targetWs) {
        // 워크스페이스 ID로 통일하여 설정
        setCurrentWorkspaceById(targetWs.id);
        
        // URL이 초대 코드인 경우 워크스페이스 ID로 리다이렉트 (일관성 유지)
        if (workspaceId !== targetWs.id) {
          navigate(`/ws/${targetWs.id}`, { replace: true });
        }
      } else {
        // 워크스페이스를 찾지 못한 경우, 초대 코드로 인식하여 자동 참여 시도
        let isJoining = false; // 중복 호출 방지 플래그
        
        const handleAutoJoin = async () => {
          if (isJoining) return; // 이미 처리 중이면 무시
          isJoining = true;
          
          try {
            // 숫자가 아닌 경우 초대 코드로 인식
            if (!/^\d+$/.test(workspaceId)) {
              console.log('초대 코드로 워크스페이스 참여 시도:', workspaceId);
              
              const workspace = await workspaceApi.join({
                inviteCode: workspaceId,
                password: undefined
              });
              
              if (workspace) {
                console.log('워크스페이스 참여 성공:', workspace);
                // 워크스페이스 목록 다시 로드 후 워크스페이스 ID로 리다이렉트
                await loadWorkspaces();
                navigate(`/ws/${workspace.id}`, { replace: true });
                return;
              }
            }
            
            // 일반적인 워크스페이스 ID인 경우 또는 참여 실패 시
            if (workspaces.length > 0) {
              const firstWorkspace = workspaces[0];
              navigate(`/ws/${firstWorkspace.id}`);
            } else {
              navigate('/');
            }
          } catch (error) {
            console.error('자동 참여 실패:', error);
            // 참여 실패 시 기본 동작
            if (workspaces.length > 0) {
              const firstWorkspace = workspaces[0];
              navigate(`/ws/${firstWorkspace.id}`);
            } else {
              navigate('/');
            }
          } finally {
            isJoining = false;
          }
        };
        
        handleAutoJoin();
      }
    }
    // Clear selected team project when navigating to a workspace home
    if(setCurrentTeamProject) setCurrentTeamProject(null);
  }, [workspaceId, currentWorkspace, setCurrentWorkspaceById, navigate, setCurrentTeamProject, workspaces]);

  // 워크스페이스 멤버 미리보기 로드
  useEffect(() => {
    if (currentWorkspace) {
      // 워크스페이스 변경 시 멤버 목록 초기화
      setWorkspaceMembers([]);
      setMembersError(null);
      
      loadMembersPreview();
      // loadTeams(); // 더 이상 필요하지 않음 - 워크스페이스 컨텍스트에서 자동으로 처리
    }
  }, [currentWorkspace]);

  // 팀 생성 이벤트 리스닝 - 중복 방지를 위해 제거
  // useEffect(() => {
  //   const handleTeamCreated = (event: CustomEvent) => {
  //     const newTeam = event.detail;
  //     setTeams(prev => [...prev, newTeam]);
  //   };

  //   window.addEventListener('teamCreated', handleTeamCreated as EventListener);
    
  //   return () => {
  //     window.removeEventListener('teamCreated', handleTeamCreated as EventListener);
  //   };
  // }, []);

  if (!currentUser || !currentWorkspace) {
    // This should ideally be handled by ProtectedRoute and App.tsx's NavigateToInitialView
    // or show a loading state until context is ready.
    return <div className="p-4">워크스페이스 정보를 불러오는 중...</div>;
  }
  
  // 실제 팀 프로젝트는 워크스페이스 컨텍스트에서 가져옴
  const teamsForCurrentWorkspace = teams;


  return (
    <div className="flex">
      <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8">
        <Card>
          <h1 className="text-2xl font-bold text-neutral-800">안녕하세요, {currentUser.name || '사용자'}님!</h1>
          <p className="text-neutral-600 mt-1">{currentWorkspace.name} 워크스페이스입니다.</p>
          <p className="text-neutral-600 mt-2">오늘도 PickTeam과 함께 성공적인 프로젝트를 만들어보세요.</p>
        </Card>

      {/* My Teams Section */}
      <Card title="내 팀 목록">
        {teamsForCurrentWorkspace.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamsForCurrentWorkspace.map(team => (
              <Card key={team.id} className="bg-white hover:shadow-xl transition-shadow flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-primary-dark">{team.name}</h3>
                  <p className="text-sm text-neutral-600 mt-1 mb-1">{team.memberCount || team.members?.length || 0}명의 팀원</p>
                  {team.progress !== undefined && (
                    <div className="my-2">
                      <div className="flex justify-between text-xs text-neutral-500 mb-0.5">
                        <span>프로젝트 진행도</span>
                        <span>{team.progress}%</span>
                      </div>
                      <div className="w-full bg-neutral-200 rounded-full h-1.5">
                        <div className="bg-primary h-1.5 rounded-full" style={{ width: `${team.progress}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>
                <Link to={`/ws/${currentWorkspace.id}/team/${team.id}`} className="mt-4 block">
                  <Button variant="primary" size="sm" className="w-full">팀 스페이스 입장</Button>
                </Link>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-neutral-500 py-4 text-center">이 워크스페이스에 아직 팀/프로젝트가 없습니다.</p>
        )}
        <div className="mt-6 text-center">
            <Button 
                variant="outline" 
                size="lg" 
                onClick={handleOpenTeamActionModal}
            >
                팀 생성 또는 참여하기
            </Button>
        </div>
      </Card>

      <Card title="워크스페이스 팀원 알아보기">
        {workspaceMembers.length > 0 ? (
          <div className="space-y-6">
            {/* 팀원 미리보기 (최대 4명) */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {workspaceMembers.slice(0, 4).map(member => (
                <div 
                  key={member.id} 
                  className="bg-white border border-neutral-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => showMemberDetail(member)}
                >
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-primary-light flex items-center justify-center overflow-hidden">
                      {member.profileImageUrl ? (
                        <img 
                          src={getProfileImageSrc(member.profileImageUrl, member.id, 64)} 
                          alt={member.name}
                          className="w-full h-full object-cover"
                          onError={(e) => handleImageError(e, member.id, 64)}
                        />
                      ) : (
                        <UserIcon className="w-8 h-8 text-primary" />
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-neutral-800 truncate mb-1">
                      {member.name || '이름 없음'}
                    </h4>
                    {member.mbti && (
                      <span className="inline-block px-2 py-1 bg-primary-light text-primary text-xs rounded-full">
                        {member.mbti}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 더보기 버튼과 총 멤버 수 */}
            <div className="text-center space-y-3">
              <p className="text-sm text-neutral-600">
                총 {workspaceMembers.length}명의 팀원
                {workspaceMembers.length > 4 && ` (${workspaceMembers.length - 4}명 더 있음)`}
              </p>
              <Button 
                variant="outline" 
                size="md"
                onClick={fetchWorkspaceMembers}
                disabled={isLoadingMembers}
              >
                {isLoadingMembers ? '불러오는 중...' : '전체 팀원 보기'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <UsersIcon className="w-16 h-16 mx-auto text-neutral-400 mb-4" />
            <p className="text-neutral-600 mb-6">
              아직 워크스페이스 팀원 정보를 불러오지 못했습니다.
            </p>
            {membersError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-600 text-sm">{membersError}</p>
              </div>
            )}
            <Button 
              variant="primary" 
              size="lg"
              onClick={loadMembersPreview}
              disabled={isLoadingMembers}
            >
              {isLoadingMembers ? '불러오는 중...' : '팀원 정보 불러오기'}
            </Button>
          </div>
        )}
      </Card>

      {/* 워크스페이스 전체 멤버 목록 모달 (간단한 형태) */}
      <Modal 
        isOpen={isMembersModalOpen} 
        onClose={() => setIsMembersModalOpen(false)}
        title={`${currentWorkspace.name} 전체 팀원`}
        size="md"
      >
        <div className="space-y-2">
          {workspaceMembers.length > 0 ? (
            <div className="max-h-96 overflow-y-auto space-y-2">
              {workspaceMembers.map(member => (
                <div 
                  key={member.id} 
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-neutral-50 cursor-pointer transition-colors"
                  onClick={() => showMemberDetail(member)}
                >
                  <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center overflow-hidden">
                    {member.profileImageUrl ? (
                      <img 
                        src={getProfileImageSrc(member.profileImageUrl, member.id, 40)} 
                        alt={member.name}
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageError(e, member.id, 40)}
                      />
                    ) : (
                      <UserIcon className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-neutral-800 truncate">
                      {member.name || '이름 없음'}
                    </h4>
                    <p className="text-xs text-neutral-600 truncate">{member.email}</p>
                  </div>
                  {member.mbti && (
                    <span className="text-xs bg-primary-light text-primary px-2 py-1 rounded">
                      {member.mbti}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <UsersIcon className="w-12 h-12 mx-auto text-neutral-400 mb-3" />
              <p className="text-neutral-600">워크스페이스에 멤버가 없습니다.</p>
            </div>
          )}
          <div className="text-center text-xs text-neutral-500 mt-4 pt-4 border-t">
            총 {workspaceMembers.length}명의 팀원 • 클릭하여 상세 정보 보기
          </div>
        </div>
      </Modal>

      {/* 멤버 상세 정보 모달 */}
      <Modal 
        isOpen={isMemberDetailModalOpen} 
        onClose={() => setIsMemberDetailModalOpen(false)}
        title="팀원 상세 정보"
        size="md"
      >
        {selectedMember && (
          <div className="space-y-4">
            {/* 프로필 헤더 */}
            <div className="text-center pb-4 border-b border-neutral-200">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-primary-light flex items-center justify-center overflow-hidden">
                {selectedMember.profileImageUrl ? (
                  <img 
                    src={getProfileImageSrc(selectedMember.profileImageUrl, selectedMember.id, 96)} 
                    alt={selectedMember.name}
                    className="w-full h-full object-cover"
                    onError={(e) => handleImageError(e, selectedMember.id, 96)}
                  />
                ) : (
                  <UserIcon className="w-12 h-12 text-primary" />
                )}
              </div>
              <h3 className="text-xl font-bold text-neutral-800 mb-2">
                {selectedMember.name || '이름 없음'}
              </h3>
              <p className="text-neutral-600">{selectedMember.email}</p>
            </div>

            {/* 기본 정보 */}
            <div className="space-y-3">
              {selectedMember.mbti && (
                <div>
                  <h4 className="text-base font-semibold text-neutral-900 mb-2">성격 유형 (MBTI)</h4>
                  <div className="bg-neutral-50 p-3 rounded-md">
                    <p className="text-sm text-neutral-700 ml-2">
                      {selectedMember.mbti}
                    </p>
                  </div>
                </div>
              )}

              {selectedMember.age && (
                <div>
                  <h4 className="text-base font-semibold text-neutral-900 mb-2">나이</h4>
                  <div className="bg-neutral-50 p-3 rounded-md">
                    <p className="text-sm text-neutral-700 ml-2">{selectedMember.age}세</p>
                  </div>
                </div>
              )}

              {selectedMember.disposition && (
                <div>
                  <h4 className="text-base font-semibold text-neutral-900 mb-2">성향/특성</h4>
                  <div className="bg-neutral-50 p-3 rounded-md">
                    <p className="text-sm text-neutral-700 leading-relaxed ml-2">{selectedMember.disposition}</p>
                  </div>
                </div>
              )}

              {selectedMember.introduction && (
                <div>
                  <h4 className="text-base font-semibold text-neutral-900 mb-2">자기소개</h4>
                  <div className="bg-neutral-50 p-3 rounded-md">
                    <p className="text-sm text-neutral-700 leading-relaxed ml-2">{selectedMember.introduction}</p>
                  </div>
                </div>
              )}

              {selectedMember.preferWorkstyle && (
                <div>
                  <h4 className="text-base font-semibold text-neutral-900 mb-2">선호하는 것들</h4>
                  <div className="bg-neutral-50 p-3 rounded-md">
                    <p className="text-sm text-neutral-700 leading-relaxed ml-2">{selectedMember.preferWorkstyle}</p>
                  </div>
                </div>
              )}

              {selectedMember.dislikeWorkstyle && (
                <div>
                  <h4 className="text-base font-semibold text-neutral-900 mb-2">비선호하는 것들</h4>
                  <div className="bg-neutral-50 p-3 rounded-md">
                    <p className="text-sm text-neutral-700 leading-relaxed ml-2">{selectedMember.dislikeWorkstyle}</p>
                  </div>
                </div>
              )}

              {selectedMember.portfolio && (
                <div>
                  <h4 className="text-base font-semibold text-neutral-900 mb-2">포트폴리오</h4>
                  <div className="bg-neutral-50 p-3 rounded-md">
                    {selectedMember.portfolio.startsWith('http') ? (
                      <a 
                        href={selectedMember.portfolio} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary-dark underline break-all text-sm ml-2 block"
                      >
                        {selectedMember.portfolio}
                      </a>
                    ) : (
                      <p className="text-sm text-neutral-700 leading-relaxed ml-2">{selectedMember.portfolio}</p>
                    )}
                  </div>
                </div>
              )}

              {selectedMember.hashtags && selectedMember.hashtags.length > 0 && (
                <div>
                  <h4 className="text-base font-semibold text-neutral-900 mb-2">관심 태그</h4>
                  <div className="bg-neutral-50 p-3 rounded-md">
                    <div className="flex flex-wrap gap-2 ml-2">
                      {selectedMember.hashtags.map((tag, index) => (
                        <span 
                          key={index} 
                          className="px-2 py-1 bg-white text-neutral-600 text-xs rounded-full border border-neutral-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 팀 액션 모달 */}
      <TeamActionModal 
        isOpen={isTeamActionModalOpen}
        onClose={() => setIsTeamActionModalOpen(false)}
        onTeamCreated={handleTeamCreated}
      />
      </div>
    </div>
  );
};
