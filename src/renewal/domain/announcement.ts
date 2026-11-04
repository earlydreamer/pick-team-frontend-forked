/** 공지. 기존 AnnouncementResponse(제목, 작성자, 팀, 작성 시각)를 따른다. */
export interface Announcement {
  id: string;
  title: string;
  authorName: string;
  /** 팀 공지면 팀 이름, 워크스페이스 전체 공지면 없음 */
  teamName?: string;
  createdAt: string;
}

/** 상대 시각 표기: 방금 전, N분 전, N시간 전, 어제, N일 전, 그 이전은 날짜 */
export const relativeTime = (iso: string, now = new Date()) => {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}시간 전`;
  const days = Math.floor(diff / 86_400);
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
};
