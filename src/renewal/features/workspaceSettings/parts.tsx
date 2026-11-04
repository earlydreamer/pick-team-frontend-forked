import React from 'react';
import { toast } from '@/renewal/ui';
import { errorMessage } from '@/renewal/features/teamSpace/TaskModals';

/** 실행하고 결과를 토스트로 알린다. 성공하면 true. */
export const attempt = async (work: () => Promise<unknown>, done?: string) => {
  try {
    await work();
    if (done) toast.success(done);
    return true;
  } catch (error) {
    toast.error(errorMessage(error));
    return false;
  }
};

/** 설정 묶음 카드. 위험한 행동은 빨간 테두리와 제목으로 구분한다. */
export const SettingsSection: React.FC<{ id: string; title: string; description?: string; tone?: 'default' | 'danger'; children: React.ReactNode }> = ({
  id,
  title,
  description,
  tone = 'default',
  children,
}) => (
  <section aria-labelledby={id} className={`rounded-card border bg-surface p-5 ${tone === 'danger' ? 'border-red-200' : 'border-outline-soft'}`}>
    <h2 id={id} className={`text-base font-bold ${tone === 'danger' ? 'text-danger' : ''}`}>
      {title}
    </h2>
    {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
