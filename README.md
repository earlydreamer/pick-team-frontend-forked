# 📌 Pick Team: 팀 프로젝트 관리 올인원 협업 허브

![시연 화면](https://github.com/user-attachments/assets/816b5e41-489e-4227-86d9-2cd116ee99c1)

**Backend** : https://github.com/earlydreamer/pick-team-backend-forked


## 🔥 프로젝트 개요

'Pick Team'은 팀 프로젝트를 진행하는 모든 사람들을 위한 **올인원 협업 플랫폼**입니다. 부트캠프, 대학생 졸업과제, 소규모 팀 및 스타트업에서 겪는 분산된 도구 사용의 불편함을 해결하고, **팀 프로젝트의 시작과 끝을 책임지는 통합 솔루션**을 제공합니다.

> $\large{흩어진\ 팀\ 프로젝트\ 관리,\ 이제\ 한\ 곳에서\ 해결하세요!}$

</br>

<details> 
<summary><b>💡 기존 플랫폼의 한계점</b></summary> 

</br>

**Slack의 경우**
- ✅ 실시간 채팅, 화상회의, 음성 채팅 기능 우수
- ❌ 칸반보드, 일정 관리 기능 부족

**Notion의 경우** 
- ✅ 문서화, 칸반보드 기능 통합
- ❌ 실시간 채팅, 화상회의 기능 부족

**분산된 도구 사용의 문제점**
- 일정 관리: 구글 캘린더, 노션
- 업무 관리: Trello, Jira, 노션  
- 커뮤니케이션: 카카오톡, 슬랙, 디스코드
- 문서 관리: 구글 드라이브, 노션
- 화상회의: Zoom, 구글 미트

이처럼 분산된 도구들로 인해 정보가 흩어지고, 팀원 간 소통에 혼선이 발생하며, 프로젝트 현황을 한눈에 파악하기 어려운 문제가 발생합니다.

</br>

</details>

</br>

## 🚀 Pick Team의 핵심 기술력

<details> 
<summary><b>1. 협업에 필요한 모든 기능 통합 제공</b></summary> 

</br>

하나의 플랫폼에서 팀 프로젝트에 필요한 모든 기능을 제공합니다.

- **공지사항 & 게시판**: 팀 내 중요 정보 공유
- **칸반보드**: 직관적인 업무 관리와 진행 상황 추적
- **캘린더**: 팀 일정과 개인 일정 통합 관리
- **화상회의**: 내장된 WebRTC 기반 실시간 화상회의
- **실시간 메신저**: 팀원 간 즉석 소통과 파일 공유

더 이상 여러 도구를 오가며 정보를 찾을 필요가 없으며, 모든 프로젝트 관련 정보가 한 곳에 체계적으로 정리됩니다.

</br>

</details>

<details> 
<summary><b>2. 역할 기반 맞춤형 기능</b></summary> 

</br>

사용자의 역할에 따라 차별화된 기능과 권한을 제공합니다.

- **시스템 운영자**: 모든 워크스페이스 및 시스템 관리 (예: 사이트 운영자)
- **관리자**: 자신이 속한 워크스페이스 내의 모든 팀 관리 (예: 부트캠프 강사)
- **팀장**: 팀 스페이스 내 공지사항 게시, 완료 승인 등 관리 (예: 각 프로젝트의 팀장)
- **팀원**: 일반 회원으로 팀 프로젝트 참여 (예: 각 프로젝트의 팀원)

이를 통해 각 역할에 최적화된 사용자 경험을 제공하고, 프로젝트 관리의 효율성을 극대화합니다.

</br>

</details>

<details> 
<summary><b>3. 하나의 계정으로 모든 것을!</b></summary> 

</br>

단일 계정으로 여러 팀 프로젝트에 참여할 수 있습니다.

- **멀티 워크스페이스**: 하나의 계정으로 여러 워크스페이스 참여 가능
- **팀 스페이스 관리**: 각 팀별로 독립적인 협업 공간 제공
- **통합 알림**: 모든 팀의 활동을 한눈에 확인

사용자는 복잡한 계정 관리 없이 모든 팀 프로젝트를 효율적으로 관리할 수 있습니다.

</br>

</details>

</br>

## 🎯 타겟 사용자

<details>
<summary><b>주요 타겟층</b></summary>

</br>

- **부트캠프 교육생**: 팀 프로젝트가 필수인 개발 교육과정 참여자
- **대학생**: 졸업과제나 팀 프로젝트를 진행하는 학생들
- **소규모 팀 & 스타트업**: 번거로운 툴 세팅 없이 바로 협업을 시작하고 싶은 팀
- **사이드 프로젝트 팀**: 가볍게 함께 무언가를 만들고 싶은 사람들

</br>

</details>

</br>

## 📝 시스템 설계

<details>
<summary><b>시스템 아키텍처</b></summary>
</br>

![시스템 아키텍처](https://github.com/user-attachments/assets/f43f3c8d-7d92-4c6e-a2d4-3c898a448cd2)

</br>

**배포 프로세스**
1. GitHub에 코드 푸시
2. GitHub Actions에서 자동 빌드 및 테스트
3. Docker 이미지 생성 및 Docker Hub 푸시
4. AWS EC2에 자동 배포
5. 서비스 상태 확인 및 헬스체크

</details>


<details>
<summary><b>서비스 flow</b></summary>

</br>

![서비스 흐름](https://github.com/user-attachments/assets/1945e67b-7cd3-433d-af30-676a17540a07)

</br>

</details>



</details>

<details>
<summary><b>데이터베이스 설계</b></summary>

</br>

![ERD](https://github.com/user-attachments/assets/af2cfa88-4efd-4c44-92f8-cd99ff615d36)

**주요 엔티티**

* **Account**: 사용자 계정 정보
* **Workspace**: 과정별 워크스페이스
* **TeamSpace**: 팀 프로젝트 정보
* **KanbanBoard**: 칸반 보드 관리
* **Schedule**: 일정 관리
* **Message**: 메신저 기능
* **VideoCall**: 화상회의 관리

</br>
</details>

</br>

## 🧐 팀 소개 및 역할 분담

| 이름 | 역할 | 담당 업무 |
| --- | --- | --- |
| **김연준** (팀장) | Backend,Frontend & PM | 워크스페이스 관리, 팀스페이스 개발, 전체 개발 총괄 |
| **박재현** | DevOps & Backend,Frontend | DevOps 및 환경세팅, 메신저 개발, CI/CD 구축 |
| **송효원** | Backend,Frontend | 게시판, 일정 관리, 공지사항, 칸반보드 관리 |
| **황태윤** | Backend,Frontend | 회원 관리, 계정 생성/조회/삭제, 인증 시스템 |
| **구현준** | Backend,Frontend | 화상회의, 실시간 채팅 |

</br>

## 🛠 기술 스택

| 구분 | 사용 기술 |
| --- | --- |
| 로컬 운영체제 | Windows 10 / Windows 11 |
| Jdk Version | JDK 17 (OpenJDK zulu) |
| Server Environment | Amazon AWS EC2 |
| Web Server + WAS | Nginx+ Tomcat 10.1 |
| Frontend Framework | React 19.2.1 |
| Backend Framework | Spring Boot  3.5 |
| Database | MySQL 8.4.4 LTS |
| IDE | IntelliJ IDEA 2025.1 |
| 협업 Tool | Slack / Notion / Trello / ERDCloud |
| 형상관리 | Github + git bash(CLI) + Fork(GUI) |
| 브랜치 전략 | [**Github Flow 기반**](https://docs.github.com/ko/get-started/using-github/github-flow) 브랜치 관리 |
| 가상화 환경 | Docker Compose |
| CI / CD | Github Action |


</br>

## 🚀 주요 기능

### 📋 워크스페이스 관리
- 과정별 독립적인 워크스페이스 생성
- 워크스페이스 멤버 관리
- 팀 프로젝트 현황 일정관리

### 👥 팀 스페이스 관리
- 팀 생성 및 멤버 초대
- 역할 기반 권한 관리

### 📊 칸반 보드
- 드래그 앤 드롭으로 직관적인 업무 관리
- 업무 상태별 필터링 (할 일, 진행 중, 완료)

### 📅 일정 관리
- 팀 공통 일정과 개인 일정 통합 관리
- 일정 알림 및 리마인더
- 캘린더 뷰와 리스트 뷰 제공

### 💬 실시간 메신저
- 팀별 채팅룸
- 파일 공유 기능
- 실시간 알림 (SSE)

### 🎥 화상회의
- 내장된 WebRTC 기반 화상회의
- 화면 공유 기능
- Livekit SDK를 활용한 안정적인 영상 통화

### 📢 공지사항 & 게시판
- 팀별 공지사항 관리
- 중요도별 게시글 분류
- 댓글 및 반응 기능

</br>

## ⚙️ 개발 전략

<details>
<summary><b>Git 브랜치 전략</b></summary>

</br>

**GitHub Flow 기반 브랜치 관리**

| 브랜치 타입 | 명명 규칙 | 설명 |
|------------|-----------|------|
| `main` | `main` | 개발용 메인 브랜치 (개발 환경 배포) |
| `feature` | `feature/기능명` | 새로운 기능 개발 |
| `production` | `production` | 운영 환경 배포용 안정된 코드 |

**브랜치 워크플로우**
```
feature/새기능 → main (개발 환경) → production (운영 환경)
```

</br>

</details>

<details>
<summary><b>코드 품질 관리</b></summary>

</br>

**Java (Spring Boot) 컨벤션**

| 구분 | 규칙 |
|------|------|
| 클래스명 | PascalCase (예: UserController, TeamService) |
| 메서드/변수명 | camelCase (예: getUserById, teamName) |
| 상수명 | UPPER_SNAKE_CASE (예: MAX_TEAM_SIZE) |
| 패키지명 | 소문자, 점으로 구분 (예: com.pickteam.domain) |

**React (TypeScript) 컨벤션**

| 구분 | 규칙 |
|------|------|
| 컴포넌트명 | PascalCase (예: TeamList, WorkspaceCard) |
| 함수/변수명 | camelCase (예: handleSubmit, teamData) |
| 파일명 | PascalCase for components, camelCase for utils |
| 상수명 | UPPER_SNAKE_CASE (예: API_BASE_URL) |

</br>

</details>

</br>

## 📈 개발 일정 및 성과

### 🗓️ 프로젝트 타임라인
- **1주차**: 요구사항 분석 및 기술 스택 선정
- **2주차**: 시스템 설계 및 DB 설계
- **3-4주차**: 백엔드 API 개발 및 프론트엔드 UI 구현
- **5주차**: 단위 테스트 및 배포 환경 구축
- **6주차**: 최종 테스트 및 발표 준비

### 🎯 성과
- ✅ MVP (Minimum Viable Product) 개발 완료
- ✅ AWS 클라우드 배포 환경 구축
- ✅ CI/CD 파이프라인 구현
- ✅ 실시간 화상회의 및 메신저 기능 구현
- ✅ 역할 기반 권한 관리 시스템 구축
