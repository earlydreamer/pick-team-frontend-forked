import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  /** 제목 아래 보조 설명. 제목과 같은 뜻을 반복하지 않습니다. */
  description?: ReactNode;
  actions?: ReactNode;
  /** 제목 요소 수준. 페이지 위계에 맞춰 지정합니다. */
  headingLevel?: 'h2' | 'h3';
}

/** 일반 표면은 경계와 밝기로 구분하고 그림자는 떠 있는 요소에만 씁니다(DESIGN.md). */
export const Card: React.FC<CardProps> = ({ children, className = '', title, description, actions, headingLevel = 'h2' }) => {
  const Heading = headingLevel;
  return (
    <section className={`rounded-card border border-outline-soft bg-surface p-5 sm:p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <Heading className="text-lg font-bold leading-7 text-ink">{title}</Heading>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
};
