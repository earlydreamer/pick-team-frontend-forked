import { createAsyncThunk } from "@reduxjs/toolkit";
import { bulletinApi } from "@/features/teamspace/bulletin/api/bulletinApi";

// 첨부파일 삭제
export const deleteAttachment = createAsyncThunk(
  "bulletin/deleteAttachment",
  async (
    {
      postId,
      attachId,
      accountId,
    }: {
      postId: number;
      attachId: string;
      accountId: string;
    },
    { rejectWithValue }
  ) => {
    try {
      console.log("[deleteAttachment Redux] API 호출 시작:", {
        postId,
        attachId,
        accountId,
      });

      const result = await bulletinApi.deleteAttachment(
        postId,
        Number(attachId),
        accountId
      );

      console.log("[deleteAttachment Redux] API 호출 성공:", {
        postId,
        attachId,
        result,
      });

      return { postId, attachId, result };
    } catch (error: any) {
      console.log("[deleteAttachment Redux] API 호출 실패:", {
        postId,
        attachId,
        error: error.message,
        status: error.status || "unknown",
        responseText: error.responseText,
      });

      // 에러 정보를 더 상세하게 전달
      return rejectWithValue({
        message: error.message || "첨부파일 삭제에 실패했습니다.",
        status: error.status,
        responseText: error.responseText,
      });
    }
  }
); 