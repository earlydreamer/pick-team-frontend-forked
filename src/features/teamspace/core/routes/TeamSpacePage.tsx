import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { Button, Input, Card, Modal } from "@/components/ui";
import { Team, User } from "@/types";
import { useAuth } from "@/features/user/auth/hooks/useAuth";
import { useWorkspace } from "@/features/workspace/core/hooks/useWorkspace";
import {
  CalendarDaysIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  ClipboardDocumentListIcon,
  ChatBubbleBottomCenterTextIcon,
  TableCellsIcon,
} from "@/assets/icons";
import { teamApi } from "@/features/teamspace/team/api/teamApi";

// 분리된 컴포넌트 import
import TeamAnnouncementBoard from "@/features/teamspace/announcement/components/TeamAnnouncementBoard";
import TeamBulletinBoard from "@/features/teamspace/bulletin/components/TeamBulletinBoard";
import TeamCalendar from "@/features/teamspace/schedule/components/TeamCalendar";
import TeamKanbanBoard from "@/features/teamspace/kanban/components/TeamKanbanBoard";

export const TeamSpacePage: React.FC = () => {
  const { teamId, workspaceId } = useParams<{
    teamId: string;
    workspaceId: string;
  }>();
  const { currentUser } = useAuth();
  const { setCurrentWorkspaceById } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();

  const [team, setTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState("announcements");

  // 비밀번호 관련 상태
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthenticatedForTeam, setIsAuthenticatedForTeam] = useState(false);

  // 팀 설정 관련 상태
  const [showTeamSettingsDropdown, setShowTeamSettingsDropdown] = useState(false);
  const [showLeaveTeamModal, setShowLeaveTeamModal] = useState(false);

  // 현재 사용자가 팀장인지 확인
  const isTeamLeader = team?.leader?.id === currentUser?.id;

  // 탭 변경 핸들러
  const handleTabChange = useCallback((tabName: string) => {
    setActiveTab(tabName);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabName);
    window.history.pushState({}, '', url.toString());
  }, []);

  useEffect(() => {
    if (workspaceId) {
      setCurrentWorkspaceById(workspaceId);
    }
  }, [workspaceId, setCurrentWorkspaceById]);

  useEffect(() => {
    const fetchTeamData = async () => {
      if (!teamId || !currentUser) return;
      try {
        setLoading(true);
        const teamData = await teamApi.getTeam(teamId);
        const membersData = await teamApi.getMembers(teamId);

        console.log("팀 데이터:", teamData);
        console.log("bulletinBoardId:", teamData.bulletinBoardId);

        setTeam(teamData);
        setTeamMembers(membersData);

        if (!teamData.passwordProtected) {
          setIsAuthenticatedForTeam(true);
        }
      } catch (err) {
        setError("팀 정보를 불러오는 데 실패했습니다.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamData();
  }, [teamId, currentUser]);

  // URL 쿼리 파라미터로 탭 상태 관리
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tab = queryParams.get("tab");
    if (tab) {
      setActiveTab(tab);
    }
  }, [location.search]);

  // 팀 탈퇴 기능
  const handleLeaveTeam = useCallback(async () => {
    if (!team || !teamId || !currentUser) return;
    try {
      await teamApi.leaveTeam(teamId);
      alert("팀에서 성공적으로 탈퇴했습니다.");
      navigate(`/ws/${workspaceId}`);
    } catch (err) {
      console.error("팀 탈퇴 실패:", err);
      alert("팀 탈퇴에 실패했습니다.");
    }
  }, [team, teamId, navigate, workspaceId, currentUser]);

  // 팀 삭제 기능
  const handleDeleteTeam = useCallback(async () => {
    if (!team || !teamId || !currentUser) return;

    const confirmText = `정말로 '${team.name}' 팀을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 팀의 모든 데이터(칸반보드, 게시판, 일정 등)가 함께 삭제됩니다.\n\n삭제하려면 '${team.name}'을 정확히 입력하세요.`;

    const userInput = prompt(confirmText);
    if (userInput === team.name) {
      try {
        await teamApi.deleteTeam(teamId);
        alert("팀이 성공적으로 삭제되었습니다.");
        navigate(`/ws/${workspaceId}`);
      } catch (err) {
        console.error("팀 삭제 실패:", err);
        alert("팀 삭제에 실패했습니다.");
      }
    } else if (userInput !== null) {
      alert("팀 이름이 일치하지 않습니다.");
    }
  }, [team, teamId, navigate, workspaceId, currentUser]);

  // 비밀번호 제출 핸들러
  const handlePasswordSubmit = async () => {
    if (!currentUser || !teamId) return;
    try {
      await teamApi.joinTeam(teamId, password);
      setIsAuthenticatedForTeam(true);
      setAuthError("");
    } catch (err) {
      setAuthError("잘못된 비밀번호이거나 참여에 실패했습니다.");
      console.error("Team Join Error:", err);
    }
  };

  // ID 유효성 검사
  if (!workspaceId || !teamId) {
    return (
      <div className="p-6 text-center text-red-500">
        잘못된 접근입니다.{" "}
        <Link to="/dashboard" className="text-primary hover:underline">
          대시보드로 이동
        </Link>
      </div>
    );
  }

  if (loading)
    return <div className="p-6 text-center">팀 정보를 불러오는 중...</div>;
  if (error)
    return <div className="p-6 text-center text-red-500">{error}</div>;
  if (!team)
    return (
      <div className="p-6 text-center text-red-500">
        팀을 찾을 수 없습니다.{" "}
        <Link
          to={`/ws/${workspaceId}`}
          className="text-primary hover:underline"
        >
          워크스페이스 홈으로
        </Link>
      </div>
    );
  if (!currentUser) {
    return <p className="p-6">로그인이 필요합니다.</p>;
  }

  // 비밀번호가 필요한 팀의 경우 인증 화면 렌더링
  if (team.passwordProtected && !isAuthenticatedForTeam) {
    return (
      <Modal
        isOpen={true}
        onClose={() => navigate(`/ws/${workspaceId}`)}
        title={`${team.name} - 비밀번호 입력`}
        footer={<Button onClick={handlePasswordSubmit}>입장</Button>}
      >
        <p className="mb-4 text-sm text-neutral-600">
          이 팀 스페이스는 비밀번호로 보호되어 있습니다.
        </p>
        <Input
          type="password"
          placeholder="팀 비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
          error={authError}
        />
      </Modal>
    );
  }

  let contentToRender;
  switch (activeTab) {
    case "announcements":
      contentToRender = (
        <TeamAnnouncementBoard
          teamId={teamId}
          workspaceId={workspaceId}
          currentUser={currentUser}
        />
      );
      break;
    case "bulletin":
      // 팀 정보에서 boardId 사용, 없으면 기본값 사용
      const boardId = team.boardId || parseInt(teamId || "1", 10) || 1;
      contentToRender = (
        <TeamBulletinBoard
          teamProjectId={teamId}
          boardId={boardId}
          currentUser={currentUser}
        />
      );
      break;
    case "calendar":
      contentToRender = (
        <TeamCalendar teamId={teamId} currentUser={currentUser} />
      );
      break;
    case "kanban":
      contentToRender = (
        <TeamKanbanBoard
          teamProjectId={teamId}
          currentUser={currentUser}
          teamMembers={teamMembers}
        />
      );
      break;
    default:
      contentToRender = <p>선택된 기능이 없습니다.</p>;
  }

  return (
    <div className="flex">
      <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">
        <header className="flex justify-between items-center pb-4 border-b">
          <div>
            <h1 className="text-3xl font-bold">{team.name}</h1>
            <p className="text-neutral-500 mt-1">{team.description}</p>
          </div>
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowTeamSettingsDropdown((prev) => !prev)}
              rightIcon={<CogIcon />}
            >
              팀 설정
            </Button>
            {showTeamSettingsDropdown && (
              <Card className="absolute top-full right-0 mt-2 w-48 z-20">
                <ul className="text-sm">
                  <li>
                    <Button
                      variant="ghost"
                      className="w-full justify-start py-2 px-3 text-sm h-auto"
                      leftIcon={<ArrowRightOnRectangleIcon />}
                      onClick={() => setShowLeaveTeamModal(true)}
                    >
                      팀 탈퇴하기
                    </Button>
                  </li>
                  {isTeamLeader && (
                    <li>
                      <Button
                        variant="ghost"
                        className="w-full justify-start py-2 px-3 text-sm h-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                        leftIcon={<ArrowRightOnRectangleIcon />}
                        onClick={handleDeleteTeam}
                      >
                        팀 삭제하기
                      </Button>
                    </li>
                  )}
                </ul>
              </Card>
            )}
          </div>
        </header>

        <nav className="flex space-x-1 border-b">
          <TabButton
            name="announcements"
            activeTab={activeTab}
            onClick={handleTabChange}
            icon={<ClipboardDocumentListIcon />}
          >
            공지사항
          </TabButton>
          <TabButton
            name="bulletin"
            activeTab={activeTab}
            onClick={handleTabChange}
            icon={<ChatBubbleBottomCenterTextIcon />}
          >
            게시판
          </TabButton>
          <TabButton
            name="kanban"
            activeTab={activeTab}
            onClick={handleTabChange}
            icon={<TableCellsIcon />}
          >
            칸반보드
          </TabButton>
          <TabButton
            name="calendar"
            activeTab={activeTab}
            onClick={handleTabChange}
            icon={<CalendarDaysIcon />}
          >
            캘린더
          </TabButton>
        </nav>

        <main>{contentToRender}</main>

        {showLeaveTeamModal && (
          <Modal
            isOpen={showLeaveTeamModal}
            onClose={() => setShowLeaveTeamModal(false)}
            title="팀 탈퇴 확인"
            footer={
              <>
                <Button
                  variant="ghost"
                  onClick={() => setShowLeaveTeamModal(false)}
                >
                  취소
                </Button>
                <Button variant="danger" onClick={handleLeaveTeam}>
                  탈퇴 확인
                </Button>
              </>
            }
          >
            <p>
              정말로 '{team.name}' 팀을 탈퇴하시겠습니까? 이 작업은 되돌릴 수
              없습니다.
            </p>
          </Modal>
        )}
      </div>
    </div>
  );
};

const TabButton: React.FC<{
  name: string;
  activeTab: string;
  onClick: (name: string) => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}> = ({ name, activeTab, onClick, children, icon }) => (
  <button
    onClick={() => onClick(name)}
    className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors
      ${
        activeTab === name
          ? "border-primary text-primary"
          : "border-transparent text-neutral-600 hover:text-primary"
      }
    `}
  >
    <div className="w-5 h-5">{icon}</div>
    <span>{children}</span>
  </button>
);

export default TeamSpacePage;
