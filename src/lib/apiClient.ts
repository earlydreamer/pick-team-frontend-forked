// API 서비스 - 백엔드와의 통신을 담당하는 스크립트
// 순환 참조 방지를 위해 authApi를 분리

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8081/api';

// JWT 토큰 관리
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// JWT 토큰 디코딩 유틸리티
function decodeJWT(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('JWT 토큰 디코딩 실패:', error);
    return null;
  }
}

export const tokenManager = {
  getAccessToken: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    return token;
  },
  setAccessToken: (token: string) => {
    if (!token || token === "undefined" || token === "null") {
      return;
    }
    localStorage.setItem(TOKEN_KEY, token);
  },
  getRefreshToken: () => {
    const token = localStorage.getItem(REFRESH_TOKEN_KEY);
    return token;
  },
  setRefreshToken: (token: string) => {
    if (!token || token === "undefined" || token === "null") {
      return;
    }
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  },
  clearTokens: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
  
  // JWT 토큰에서 사용자 ID 추출
  getUserId: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    
    const decoded = decodeJWT(token);
    return decoded?.sub || null; // 'sub' 필드가 사용자 ID
  },

  // 디버깅용 헬퍼 함수들
  debug: {
    getAllTokens: () => ({
      accessToken: localStorage.getItem(TOKEN_KEY),
      refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
    }),
    isTokenExpired: (token: string): boolean => {
      try {
        const tokenParts = token.split(".");
        if (tokenParts.length !== 3) return true;

        const payload = JSON.parse(atob(tokenParts[1]));
        const now = Math.floor(Date.now() / 1000);
        return payload.exp < now;
      } catch {
        return true;
      }
    },
    getTokenInfo: (token: string) => {
      try {
        const tokenParts = token.split(".");
        if (tokenParts.length !== 3) return null;

        const payload = JSON.parse(atob(tokenParts[1]));
        return {
          userId: payload.sub,
          email: payload.email,
          exp: new Date(payload.exp * 1000),
          iat: new Date(payload.iat * 1000),
          isExpired: payload.exp < Math.floor(Date.now() / 1000),
        };
      } catch {
        return null;
      }
    },
  },
};

// API 에러 처리 함수
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// HTTP 요청 래퍼 함수
export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = tokenManager.getAccessToken();
  const userId = tokenManager.getUserId();
  
  const config: RequestInit = {
    headers: {
      // FormData가 아닌 경우에만 Content-Type 설정
      ...(!(options.body instanceof FormData) && { 'Content-Type': 'application/json' }),
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(userId && { 'Account-Id': userId }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    // 401 오류 시 토큰 갱신 시도 (로그인 API 제외)
    if (response.status === 401 && !endpoint.includes('/login') && !endpoint.includes('/refresh')) {
      const refreshTokenValue = tokenManager.getRefreshToken();
      if (refreshTokenValue) {
        try {
          const { authApi } = await import('@/features/user/auth/api/authApi');
          await authApi.refreshToken(); // 분리된 authApi 사용
          // 새 토큰으로 다시 요청
          const newToken = tokenManager.getAccessToken();
          const newUserId = tokenManager.getUserId();
          const retryConfig: RequestInit = {
            ...config,
            headers: {
              // FormData가 아닌 경우에만 Content-Type 설정
              ...(!(options.body instanceof FormData) && { 'Content-Type': 'application/json' }),
              ...(newToken && { 'Authorization': `Bearer ${newToken}` }),
              ...(newUserId && { 'Account-Id': newUserId }),
              ...options.headers,
            }
          };
          
          const retryResponse = await fetch(url, retryConfig);
          
          if (!retryResponse.ok) {
            const errorData = await retryResponse.text();
            throw new ApiError(retryResponse.status, errorData || `HTTP ${retryResponse.status}`);
          }

          const contentType = retryResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return await retryResponse.json();
          }
          
          return await retryResponse.text() as T;
        } catch (refreshError) {
          // 토큰 갱신 실패 시 로그인 페이지로 리다이렉트
          tokenManager.clearTokens();
          if (typeof window !== 'undefined') {
            if (window.location.pathname !== '/login') window.location.assign('/login');
          }
          throw new ApiError(401, '인증이 만료되었습니다. 다시 로그인해주세요.');
        }
      } else {
        // 리프레시 토큰이 없으면 로그인 페이지로
        tokenManager.clearTokens();
        if (typeof window !== 'undefined') {
          if (window.location.pathname !== '/login') window.location.assign('/login');
        }
        throw new ApiError(401, '인증이 필요합니다. 로그인해주세요.');
      }
    }
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new ApiError(response.status, errorData || `HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text() as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('API request failed:', error); 
    throw new ApiError(0, '네트워크 연결에 실패했습니다. 서버가 실행 중인지 확인해주세요.');
  }
} 