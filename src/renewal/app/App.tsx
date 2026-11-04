import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/renewal/ui';
import { DataError } from '@/renewal/data';
import { AppRoutes } from './routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 권한·존재 여부처럼 다시 시도해도 결과가 같은 오류는 재시도하지 않는다.
      retry: (failureCount, error) =>
        !(error instanceof DataError && ['NOT_FOUND', 'FORBIDDEN', 'UNAUTHORIZED', 'INVALID'].includes(error.code)) && failureCount < 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AppRoutes />
      <Toaster />
    </BrowserRouter>
  </QueryClientProvider>
);
