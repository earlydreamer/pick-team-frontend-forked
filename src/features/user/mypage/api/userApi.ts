import { userApi as userServiceApi } from '@/lib/userApi';
import { User } from '@/features/user/types/user';

export const userApi = {
    getCurrentUser: async (): Promise<User> => {
        const response = await userServiceApi.getMyProfile();
        return response.data;
    },

    /** 서버는 수정 결과를 돌려주지 않으므로(data: null) 호출 후 프로필을 다시 불러와야 합니다. */
    updateUserProfile: async (profileData: Partial<User>): Promise<void> => {
        await userServiceApi.updateMyProfile(profileData);
    },

    uploadProfileImage: async (file: File): Promise<string> => {
        const response = await userServiceApi.uploadProfileImage(file);
        return response.data;
    },

    changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
        await userServiceApi.changePassword({ currentPassword, newPassword });
    },

    searchHashtags: async (keyword: string): Promise<string[]> => {
        const response = await userServiceApi.searchHashtags(keyword);
        return (response.data ?? []).map((tag) => tag.name);
    }
};
