import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useRenewal } from '../context/RenewalContext';
import { useToast } from '@/components/ui/Toast';
import { AuthTwilightArtwork } from '../components/PeriwinkleArtwork';

export const InviteLandingPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { allWorkspaces } = useRenewal();
  const { showToast } = useToast();

  const matchedWs =
    allWorkspaces.find((w) => w.inviteCode?.toLowerCase() === code?.toLowerCase()) ||
    allWorkspaces[0];

  useEffect(() => {
    if (code) {
      sessionStorage.setItem('pendingInviteCode', code);
    }
  }, [code]);

  return (
    <div className="min-h-screen bg-[#15172B] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl rounded-3xl overflow-hidden bg-white shadow-2xl grid md:grid-cols-12 min-h-[500px]">
        <div className="hidden md:block md:col-span-5">
          <AuthTwilightArtwork />
        </div>

        <div className="md:col-span-7 p-8 sm:p-12 flex flex-col justify-center">
          <div className="max-w-sm w-full mx-auto space-y-6">
            <Link to="/landing" className="inline-flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-peri-500 text-white font-bold text-xs flex items-center justify-center">
                PT
              </div>
              <span className="text-base font-bold text-ink-primary">PickTeam</span>
            </Link>

            <div className="space-y-1.5">
              <span className="px-2.5 py-1 rounded-md bg-peri-50 text-peri-700 text-xs font-semibold">
                워크스페이스 초대장
              </span>
              <h1 className="text-xl font-bold text-ink-primary pt-1">
                {matchedWs.name}에 초대받았습니다
              </h1>
              <p className="text-xs text-ink-tertiary">
                개설자: {matchedWs.owner?.name || '박강사'} · 초대 코드 {code || matchedWs.inviteCode}
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <Button
                variant="primary"
                fullWidth
                size="lg"
                onClick={() => {
                  sessionStorage.removeItem('pendingInviteCode');
                  showToast({
                    title: `${matchedWs.name}에 합류했습니다.`,
                    variant: 'success',
                  });
                  navigate(`/ws/${matchedWs.id}/onboarding`);
                }}
              >
                합류하고 PR 카드 만들기
              </Button>
              <Link to="/login" className="block">
                <Button variant="outline" fullWidth size="md">
                  다른 계정으로 로그인
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
