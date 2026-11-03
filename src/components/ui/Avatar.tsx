import React, { useState } from 'react';
import { getFileUrl } from '@/lib/imageUtils';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name?: string | null;
  imageUrl?: string | null;
  size?: AvatarSize;
  /** 장식용이면 빈 문자열로 두고, 이미지가 사람을 식별하는 유일한 수단이면 이름을 넣습니다. */
  alt?: string;
  className?: string;
  shape?: 'circle' | 'rounded';
}

const sizes: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[0.625rem]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-24 w-24 text-3xl',
};

/** 이름의 첫 글자. 영문 이름은 대문자로 표시합니다. */
export const initialOf = (name?: string | null) => (name?.trim().charAt(0) || '?').toUpperCase();

/**
 * 프로필 이미지가 없거나 불러오지 못하면 이름 첫 글자를 표시합니다.
 * 업로드할 때마다 서버가 새 파일 이름을 주므로 캐시 무효화 파라미터를 붙이지 않습니다.
 */
export const Avatar: React.FC<AvatarProps> = ({ name, imageUrl, size = 'md', alt = '', className = '', shape = 'circle' }) => {
  const src = getFileUrl(imageUrl);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src && failedSrc !== src;
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-[10px]';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-primary-container font-bold text-on-primary-container ${radius} ${sizes[size]} ${className}`}
      role={alt && !showImage ? 'img' : undefined}
      aria-label={alt && !showImage ? alt : undefined}
      aria-hidden={!alt || undefined}
    >
      {showImage ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setFailedSrc(src)} />
      ) : (
        <span aria-hidden="true">{initialOf(name)}</span>
      )}
    </span>
  );
};
