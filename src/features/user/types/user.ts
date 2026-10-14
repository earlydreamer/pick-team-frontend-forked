export type DesiredRoleCode =
  | 'BACKEND'
  | 'FRONTEND'
  | 'FULLSTACK'
  | 'PM'
  | 'DESIGN'
  | 'INFRA'
  | 'AI_DATA'
  | 'OTHER';

export type WeeklyAvailableHoursCode = 'LT10H' | 'H10_20' | 'H20_30' | 'GT30H';

export type AvailableTimeSlotCode = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'WEEKEND';

export type WorkstyleOptionCode =
  | 'ASYNC_FIRST'
  | 'SYNC_PREFERRED'
  | 'DETAIL_ORIENTED'
  | 'SPEED_FIRST'
  | 'STRUCTURED'
  | 'FLEXIBLE';

export interface User {
  id: string;
  email: string;
  name: string;
  nickname?: string;
  role?: string; // 'USER' | 'ADMIN' (System level)
  provider?: string; // 'LOCAL' | 'GOOGLE' | 'KAKAO'

  // PR Card v2 fields (11-profile-pr-card.md §4.1)
  desiredRole1?: DesiredRoleCode;
  desiredRole2?: DesiredRoleCode;
  weeklyAvailableHours?: WeeklyAvailableHoursCode;
  availableTimeSlots?: AvailableTimeSlotCode[];
  goalTemperature?: 1 | 2 | 3 | 4 | 5;
  preferWorkstyleOptions?: WorkstyleOptionCode[];
  dislikeWorkstyleOptions?: WorkstyleOptionCode[];
  preferWorkstyleText?: string;
  dislikeWorkstyleText?: string;
  cardVisible?: boolean;
  mbtiVisible?: boolean;
  consentGivenAt?: string | null;

  // Profile fields
  bio?: string;
  skills?: string[];
  interests?: string[];
  profileImageUrl?: string | null;

  // Social links
  githubUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;

  // Legacy / backend compatible fields
  age?: number;
  mbti?: string;
  disposition?: string;
  introduction?: string;
  portfolio?: string;
  preferWorkstyle?: string;
  dislikeWorkstyle?: string;
  likes?: string;
  dislikes?: string;
  hashtags?: string[];

  profileImage?: string;
  portfolioLink?: string;
  preferredStyle?: string;
  avoidedStyle?: string;
  profilePictureUrl?: string;

  createdAt?: string;
  updatedAt?: string;

  currentWorkspaceId?: string;
  currentTeamProjectId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export interface UserProfileUpdateRequest {
  name?: string;
  age?: number;
  mbti?: string;
  disposition?: string;
  introduction?: string;
  portfolio?: string;
  profileImageUrl?: string;
  preferWorkstyle?: string;
  dislikeWorkstyle?: string;
  hashtags?: string[];
  desiredRole1?: DesiredRoleCode;
  desiredRole2?: DesiredRoleCode;
  weeklyAvailableHours?: WeeklyAvailableHoursCode;
  availableTimeSlots?: AvailableTimeSlotCode[];
  goalTemperature?: 1 | 2 | 3 | 4 | 5;
  preferWorkstyleOptions?: WorkstyleOptionCode[];
  dislikeWorkstyleOptions?: WorkstyleOptionCode[];
  cardVisible?: boolean;
  mbtiVisible?: boolean;
  consentGivenAt?: string | null;
}
