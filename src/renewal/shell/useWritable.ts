import { useWorkspace } from '@/renewal/data/queries';

/**
 * 이 워크스페이스에 쓸 수 있는지(R24). 보관(01-D4)되면 읽기 전용이라 쓰기 버튼을 숨긴다.
 * 데이터 계층(archiveGuard)이 최종으로 막고, 화면은 누를 수 없는 버튼을 보이지 않게 하는 역할만 한다.
 * 워크스페이스 정보를 아직 모르면 쓸 수 있다고 본다(대부분의 경우이고, 막히면 서버가 알려 준다).
 */
export const useWritable = (workspaceId: string) => !useWorkspace(workspaceId).data?.archived;
