import React from 'react';
import { buttonClassName } from '@/components/ui';

const GoogleMark = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const KakaoMark = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path fill="#000" d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.8 5.3 4.6 6.7l-1 3.6c-.1.3.3.6.6.4l4.2-2.8c.5.1 1.1.1 1.6.1 5.5 0 10-3.6 10-8s-4.5-8-10-8z" />
  </svg>
);

/** 간편 로그인. 버튼 이름에 제공자와 결과(로그인/가입)를 함께 씁니다. */
export const SocialLoginButtons: React.FC<{ onSelect: (provider: 'google' | 'kakao') => void; verb: '로그인' | '시작하기' }> = ({ onSelect, verb }) => (
  <div className="grid gap-2.5">
    <button type="button" className={buttonClassName('outline', 'lg', 'w-full text-[0.9375rem]')} onClick={() => onSelect('google')}>
      <GoogleMark />
      Google로 {verb}
    </button>
    <button
      type="button"
      className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#E6CF00] bg-[#FEE500] px-6 py-3 text-[0.9375rem] font-semibold text-black/85 transition-colors hover:bg-[#F5DC00]"
      onClick={() => onSelect('kakao')}
    >
      <KakaoMark />
      카카오로 {verb}
    </button>
  </div>
);

export const OrDivider: React.FC = () => (
  <div className="my-6 flex items-center gap-3 text-xs text-muted" role="separator" aria-label="또는">
    <span className="h-px flex-1 bg-outline-soft" aria-hidden="true" />
    <span aria-hidden="true">또는</span>
    <span className="h-px flex-1 bg-outline-soft" aria-hidden="true" />
  </div>
);
