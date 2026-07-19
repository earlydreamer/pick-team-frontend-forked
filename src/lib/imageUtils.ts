/**
 * 강력한 캐시 무효화를 위한 파라미터 생성 함수
 * @returns 버전과 랜덤 값을 조합한 캐시 무효화 파라미터
 */
export const generateCacheBuster = (): string => {
  return `v=${Date.now()}&r=${Math.random().toString(36).substring(2, 15)}`;
};

/**
 * 파일 및 이미지 URL 처리 유틸리티
 */

/**
 * 현재 환경에 맞는 Base URL을 반환하는 함수
 */
const getBaseUrl = (): string => {
  // 개발 환경에서는 localhost:8081 사용
  if (window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.port === '3000' ||
      window.location.port === '5173') {
    return 'http://localhost:8081';
  }
  // 프로덕션 환경에서는 배포된 도메인 사용
  const configuredBaseUrl = import.meta.env.VITE_API_URL;
  return configuredBaseUrl
    ? configuredBaseUrl.replace(/\/$/, '')
    : window.location.origin;
};

/**
 * 백엔드에서 받은 파일 URL을 완전한 URL로 변환하는 유틸리티 함수
 * @param fileUrl 백엔드에서 받은 파일 URL (상대 경로일 수 있음)
 * @returns 완전한 파일 URL
 */
export const getFileUrl = (fileUrl?: string | null): string | null => {
  if (!fileUrl) return null;
  
  // 이미 완전한 URL인 경우 그대로 반환
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }
  
  // 백엔드에서 반환하는 상대 경로 처리
  // nginx에서 /uploads/ 경로로만 파일이 서빙되므로 /uploads/ 추가 필요
  let normalizedUrl = fileUrl;
  
  // 이미 /uploads/로 시작하는 경우
  if (normalizedUrl.startsWith('/uploads/')) {
    return `${getBaseUrl()}${normalizedUrl}`;
  }
  
  // /uploads/가 없는 경우 추가
  // 예: "profile-images/filename.png" -> "/uploads/profile-images/filename.png"
  // 예: "/profile-images/filename.png" -> "/uploads/profile-images/filename.png"
  if (!normalizedUrl.startsWith('/')) {
    normalizedUrl = `/${normalizedUrl}`;
  }
  normalizedUrl = `/uploads${normalizedUrl}`;
  
  // 현재 환경에 맞는 전체 URL로 변환
  return `${getBaseUrl()}${normalizedUrl}`;
};

/**
 * 프로필 이미지 URL을 생성하는 유틸리티 함수 (캐시 무효화 포함)
 * @param profileImageUrl 백엔드에서 받은 프로필 이미지 URL (상대 경로일 수 있음)
 * @param userId 사용자 ID (기본 이미지용)
 * @param size 이미지 크기 (기본 이미지용)
 * @param bustCache 캐시 무효화 여부 (기본값: false)
 * @returns 완전한 이미지 URL
 */
export const getProfileImageSrc = (
  profileImageUrl?: string | null, 
  userId?: string, 
  size = 128,
  bustCache = false
): string => {
  if (profileImageUrl) {
    const fullUrl = getFileUrl(profileImageUrl);
    if (fullUrl) {
      // 배포 환경에서는 항상 캐시 무효화 적용
      const shouldBustCache = bustCache || window.location.hostname !== 'localhost';
      return shouldBustCache ? `${fullUrl}?${generateCacheBuster()}` : fullUrl;
    }
  }
  // 기본 이미지 (Picsum Photos를 사용한 결정적 이미지 생성)
  return `https://picsum.photos/seed/${userId || 'default'}/${size}/${size}`;
};

/**
 * 워크스페이스 아이콘 URL을 생성하는 유틸리티 함수
 * @param iconUrl 백엔드에서 받은 아이콘 URL (상대 경로일 수 있음)
 * @returns 완전한 아이콘 URL 또는 null (기본 텍스트 아이콘 사용)
 */
export const getWorkspaceIconSrc = (iconUrl?: string | null): string | null => {
  if (iconUrl) {
    return getFileUrl(iconUrl);
  }
  // 기본 아이콘은 없음 (텍스트로 표시)
  return null;
};

/**
 * 이미지 로드 에러 핸들링 함수
 * @param e 이미지 에러 이벤트
 * @param userId 사용자 ID
 * @param size 이미지 크기
 */
export const handleImageError = (
  e: React.SyntheticEvent<HTMLImageElement>, 
  userId?: string, 
  size = 128
): void => {
  const target = e.target as HTMLImageElement;
  target.src = `https://picsum.photos/seed/${userId || 'default'}/${size}/${size}`;
};
