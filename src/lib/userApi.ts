// 사용자 관련 API 서비스 - 로그인, 회원가입, 프로필 관리
import { tokenManager } from './apiClient';

// API 응답 타입 정의
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  errorCode: string | null;
  data: T;
}

// OAuth 관련 타입
export interface OAuthLoginRequest {
  provider: 'google' | 'kakao';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string; // accessToken
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    age?: number;
    role?: string;
    provider?: string; // OAuth 제공자 정보 추가
    mbti?: string;
    disposition?: string;
    introduction?: string;
    portfolio?: string;
    profileImageUrl?: string;
    preferWorkstyle?: string;
    dislikeWorkstyle?: string;
    hashtags?: string[];
    createdAt?: string; // 계정 생성일 추가
    updatedAt?: string; // 계정 수정일 추가
  };
}

export interface RegisterUserRequest {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  nickname?: string;
}

export interface UpdateMyProfileRequest {
  name?: string;
  age?: number;
  mbti?: string;
  disposition?: string;
  introduction?: string;
  portfolio?: string;
  profileImageUrl?: string | null;
  preferWorkstyle?: string;
  dislikeWorkstyle?: string;
  hashtags?: string[];
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface SendPasswordResetEmailRequest {
  email: string;
}

export interface VerifyResetCodeRequest {
  email: string;
  resetCode: string;
}

export interface ResetPasswordRequest {
  email: string;
  resetCode: string;
  newPassword: string;
}

// API 에러 클래스
export class UserApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "UserApiError";
    this.status = status;
  }
}

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8081/api';

// 토큰 갱신 중복 방지를 위한 플래그
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: any) => void;
  reject: (error: any) => void;
}> = [];

// 토큰 갱신 함수
async function refreshToken(): Promise<void> {
  const refreshToken = tokenManager.getRefreshToken();
  if (!refreshToken) {
    throw new UserApiError(
      401,
      "리프레시 토큰이 없습니다. 다시 로그인해주세요."
    );
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    tokenManager.clearTokens();
    throw new UserApiError(
      401,
      "토큰 갱신에 실패했습니다. 다시 로그인해주세요."
    );
  }

  const result = await response.json();
  if (result.success && result.data) {
    tokenManager.setAccessToken(result.data.accessToken);
    tokenManager.setRefreshToken(result.data.refreshToken);
  } else {
    tokenManager.clearTokens();
    throw new UserApiError(
      401,
      "토큰 갱신에 실패했습니다. 다시 로그인해주세요."
    );
  }
}

// HTTP 요청 래퍼 함수
async function userApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = tokenManager.getAccessToken();

  const config: RequestInit = {
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);

    // 401 오류 시 토큰 갱신 시도
    if (response.status === 401 && token && !endpoint.includes("/auth")) {
      if (isRefreshing) {
        // 이미 토큰 갱신 중이면 대기열에 추가
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
      }

      isRefreshing = true;

      try {
        await refreshToken();
        
        // 대기열의 요청들 처리
        failedQueue.forEach(({ resolve }) => resolve(true));
        failedQueue = [];

        // 원래 요청 재시도
        const retryConfig = {
          ...config,
          headers: {
            ...config.headers,
            Authorization: `Bearer ${tokenManager.getAccessToken()}`,
          },
        };
        
        const retryResponse = await fetch(url, retryConfig);
        if (!retryResponse.ok) {
          const errorData = await retryResponse.text();
          throw new UserApiError(retryResponse.status, errorData || `HTTP ${retryResponse.status}`);
        }

        return retryResponse.json();
      } catch (refreshError) {
        failedQueue.forEach(({ reject }) => reject(refreshError));
        failedQueue = [];
        tokenManager.clearTokens();
        
        if (typeof window !== "undefined") {
          if (window.location.pathname !== '/login') window.location.assign('/login');
        }
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    }

    if (!response.ok) {
      const errorData = await response.text();
      throw new UserApiError(response.status, errorData || `HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    }

    return (await response.text()) as T;
  } catch (error) {
    if (error instanceof UserApiError) {
      throw error;
    }
    throw new UserApiError(0, "네트워크 연결에 실패했습니다.");
  }
}

// 클라이언트 정보 수집 함수
function getClientInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenResolution: `${screen.width}x${screen.height}`,
    timestamp: new Date().toISOString(),
  };
}

// 사용자 API 서비스
export const userApi = {
  // 회원가입
  register: async (userData: RegisterUserRequest): Promise<ApiResponse<{ userId: string }>> => {
    return userApiRequest("/users/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  },

  // 이메일 중복 체크
  checkEmailDuplicate: async (email: string): Promise<ApiResponse<{ available: boolean }>> => {
    return userApiRequest(`/users/check-duplicate?email=${encodeURIComponent(email)}`, {
      method: "GET",
    });
  },

  // 로그인
  login: async (credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> => {
    const clientInfo = getClientInfo();
    const loginData = {
      ...credentials,
      clientInfo,
    };

    const response = await userApiRequest<ApiResponse<LoginResponse>>("/auth/login", {
      method: "POST",
      body: JSON.stringify(loginData),
    });

    // 토큰 저장
    if (response.success && response.data) {
      tokenManager.setAccessToken(response.data.token);
      tokenManager.setRefreshToken(response.data.refreshToken);
    }

    return response;
  },

  // OAuth 로그인
  oauthLogin: async (data: OAuthLoginRequest): Promise<ApiResponse<LoginResponse>> => {
    const response = await userApiRequest<ApiResponse<LoginResponse>>("/auth/login/oauth", {
      method: "POST",
      body: JSON.stringify(data),
    });

    // 토큰 저장
    if (response.success && response.data) {
      tokenManager.setAccessToken(response.data.token);
      tokenManager.setRefreshToken(response.data.refreshToken);
    }

    return response;
  },

  // 로그아웃
  logout: async (): Promise<ApiResponse<{ message: string }>> => {
    const clientInfo = getClientInfo();
    
    try {
      const response = await userApiRequest<ApiResponse<{ message: string }>>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ clientInfo }),
      });
      
      tokenManager.clearTokens();
      return response;
    } catch (error) {
      // 백엔드 로그아웃 실패해도 로컬 토큰은 정리
      tokenManager.clearTokens();
      throw error;
    }
  },

  // 내 프로필 조회
  getMyProfile: async (): Promise<ApiResponse<LoginResponse["user"]>> => {
    return userApiRequest("/users/me", {
      method: "GET",
    });
  },

  // 내 프로필 업데이트
  updateMyProfile: async (profileData: UpdateMyProfileRequest): Promise<ApiResponse<LoginResponse["user"]>> => {
    return userApiRequest("/users/me", {
      method: "PUT",
      body: JSON.stringify(profileData),
    });
  },

  // 프로필 이미지 업로드. 서버는 data에 이미지 URL 문자열을 담아 돌려줍니다.
  uploadProfileImage: async (file: File): Promise<ApiResponse<string>> => {
    const formData = new FormData();
    formData.append("file", file);

    return userApiRequest("/users/me/profile-image", {
      method: "POST",
      body: formData,
    });
  },

  // 프로필 이미지 삭제
  deleteProfileImage: async (): Promise<ApiResponse<null>> => {
    return userApiRequest("/users/me/profile-image", {
      method: "DELETE",
    });
  },

  // 다른 사용자 프로필 조회
  getUserProfile: async (userId: string): Promise<ApiResponse<LoginResponse["user"]>> => {
    return userApiRequest(`/users/${encodeURIComponent(userId)}`, {
      method: "GET",
    });
  },

  // 비밀번호 변경
  changePassword: async (passwordData: ChangePasswordRequest): Promise<ApiResponse<{ message: string }>> => {
    return userApiRequest("/users/password", {
      method: "PUT",
      body: JSON.stringify(passwordData),
    });
  },

  // 비밀번호 재설정 이메일 전송
  sendPasswordResetEmail: async (data: SendPasswordResetEmailRequest): Promise<ApiResponse<void>> => {
    return userApiRequest("/auth/send-password-reset-email", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // 재설정 코드 확인
  verifyResetCode: async (data: VerifyResetCodeRequest): Promise<ApiResponse<{ valid: boolean; message?: string }>> => {
    return userApiRequest("/auth/verify-reset-code", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // 새 비밀번호 설정
  resetPassword: async (data: ResetPasswordRequest): Promise<ApiResponse<void>> => {
    return userApiRequest("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // OAuth 로그인 URL 생성 (리다이렉트)
  startOAuthLogin: (provider: 'google' | 'kakao'): void => {
    // 개발/프로덕션 관계없이 VITE_API_URL 사용 (포트번호까지 포함)
    const apiBaseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8081';
    window.location.href = `${apiBaseUrl}/api/auth/oauth/${provider}/login`;
  },

  // 임시 코드를 JWT 토큰으로 교환
  exchangeTempCode: async (tempCode: string): Promise<ApiResponse<LoginResponse>> => {
    return userApiRequest("/auth/oauth/exchange-token", {
      method: "POST",
      body: JSON.stringify({ tempCode }),
    });
  },

  // 세션 상태 확인
  getSessionStatus: async (): Promise<ApiResponse<{ authenticated: boolean; user?: LoginResponse["user"] }>> => {
    return userApiRequest("/auth/session", {
      method: "GET",
    });
  },

  // 이메일 인증 요청 (회원가입용)
  requestEmailVerification: async (email: string): Promise<ApiResponse<null>> => {
    return userApiRequest("/auth/email/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  // 이메일 인증 코드 확인 (회원가입용)
  verifyEmail: async (email: string, verificationCode: string): Promise<ApiResponse<boolean>> => {
    return userApiRequest("/auth/email/verify", {
      method: "POST",
      body: JSON.stringify({ email, verificationCode }),
    });
  },

  // 해시태그 검색 (GET /api/users/hashtags/search?keyword=)
  searchHashtags: async (keyword: string): Promise<ApiResponse<{ id: number; name: string }[]>> => {
    return userApiRequest(`/users/hashtags/search?keyword=${encodeURIComponent(keyword)}`, {
      method: "GET",
    });
  },
};

export default userApi;
