import React from 'react';

/**
 * Clean, consistent portrait SVG avatars matching the reference board's friendly illustrated portraits.
 */
const AVATAR_PALETTES: Record<
  string,
  { bg: string; hair: string; shirt: string; skin: string;female?: boolean }
> = {
  박재현: { bg: '#E6E7F8', hair: '#232542', shirt: '#5B5CA6', skin: '#FBE6DA' },
  김민지: { bg: '#FCEEE9', hair: '#1E2038', shirt: '#6667AB', skin: '#FFF0E6', female: true },
  이승우: { bg: '#E8F0FE', hair: '#282A48', shirt: '#3B4278', skin: '#F9E4D4' },
  최수연: { bg: '#F3E8FF', hair: '#2D264C', shirt: '#7C69B4', skin: '#FFF0E6', female: true },
  정다은: { bg: '#E6F6F2', hair: '#1F243D', shirt: '#4B5E9E', skin: '#FDECE2', female: true },
  윤지호: { bg: '#FEF3C7', hair: '#2D2A42', shirt: '#525396', skin: '#F9E4D4' },
  한서준: { bg: '#E8EAF6', hair: '#1C1D33', shirt: '#454782', skin: '#F8E2D2' },
};

export const MemberAvatar: React.FC<{
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}> = ({ name, size = 'md', className = '' }) => {
  const cleanName = name.split(' ')[0];
  const palette = AVATAR_PALETTES[cleanName] || {
    bg: '#E8E9F7',
    hair: '#242644',
    shirt: '#6667AB',
    skin: '#FBE8DC',
    female: cleanName.endsWith('지') || cleanName.endsWith('연') || cleanName.endsWith('은'),
  };

  const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-14 h-14',
  };

  return (
    <div
      className={`${sizeMap[size]} rounded-full overflow-hidden shrink-0 border border-neutral-200/80 shadow-2xs select-none ${className}`}
      style={{ backgroundColor: palette.bg }}
      aria-label={name}
    >
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <rect width="64" height="64" fill={palette.bg} />
        {/* Back hair for long hair */}
        {palette.female && (
          <path
            d="M17 28C17 16 47 16 47 28L50 54H14L17 28Z"
            fill={palette.hair}
          />
        )}
        {/* Shoulders / Shirt */}
        <path
          d="M12 64C12 50 21 45 32 45C43 45 52 50 52 64H12Z"
          fill={palette.shirt}
        />
        {/* White collar accent */}
        <path d="M26 45L32 52L38 45H26Z" fill="#FFFFFF" opacity="0.9" />
        {/* Neck */}
        <rect x="28" y="37" width="8" height="10" rx="4" fill={palette.skin} />
        {/* Face */}
        <ellipse cx="32" cy="28" rx="11.5" ry="12.5" fill={palette.skin} />
        {/* Eyes & gentle smile */}
        <circle cx="28" cy="28.5" r="1.3" fill="#232542" />
        <circle cx="36" cy="28.5" r="1.3" fill="#232542" />
        <path
          d="M29.2 33.5Q32 35.5 34.8 33.5"
          stroke="#C27D70"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
        {/* Front hair */}
        {palette.female ? (
          <path
            d="M19 27C19 15 45 15 45 27C43 21 37 19 32 21C26 19 21 21 19 27Z"
            fill={palette.hair}
          />
        ) : (
          <path
            d="M19.5 26C19.5 14.5 44.5 14.5 44.5 26C41 20 35 19.5 31 21.5C26 19.5 22 21 19.5 26Z"
            fill={palette.hair}
          />
        )}
      </svg>
    </div>
  );
};

/**
 * Workspace Hero Cloud Banner Background (Reference Center-Top & Mobile-Top)
 */
export const CohortCloudBannerBg: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 960 220"
    preserveAspectRatio="xMidYMid slice"
    className={`w-full h-full ${className}`}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="periSkyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3B3D7A" />
        <stop offset="48%" stopColor="#6667AB" />
        <stop offset="82%" stopColor="#9496D4" />
        <stop offset="100%" stopColor="#D8CBE8" />
      </linearGradient>
      <linearGradient id="cloudGlow1" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFE8E5" stopOpacity="0.92" />
        <stop offset="45%" stopColor="#C8C4EC" stopOpacity="0.88" />
        <stop offset="100%" stopColor="#5D5E9E" stopOpacity="0.95" />
      </linearGradient>
      <linearGradient id="cloudGlow2" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#7C7DC2" stopOpacity="0.85" />
      </linearGradient>
    </defs>

    <rect width="960" height="220" fill="url(#periSkyGrad)" />

    {/* Twinkling subtle stars */}
    <circle cx="180" cy="36" r="1.2" fill="#FFFFFF" opacity="0.7" />
    <circle cx="420" cy="28" r="1.5" fill="#FFFFFF" opacity="0.8" />
    <circle cx="540" cy="54" r="1" fill="#FFFFFF" opacity="0.5" />
    <circle cx="710" cy="32" r="1.4" fill="#FFFFFF" opacity="0.75" />
    <circle cx="840" cy="48" r="1.1" fill="#FFFFFF" opacity="0.6" />
    <path d="M620 24L622 30L628 32L622 34L620 40L618 34L612 32L618 30Z" fill="#FFFFFF" opacity="0.75" />

    {/* Soft distant cloud layer */}
    <path
      d="M360 220C380 185 430 175 465 190C490 155 555 150 585 182C620 140 695 135 735 170C775 135 845 140 880 175C910 160 945 170 960 190V220H360Z"
      fill="url(#cloudGlow2)"
      opacity="0.55"
    />

    {/* Foreground illuminated cumulus clouds */}
    <path
      d="M450 220C465 188 510 176 542 192C565 152 630 144 668 178C702 132 782 128 824 168C860 148 920 152 960 182V220H450Z"
      fill="url(#cloudGlow1)"
    />
    <path
      d="M0 220C40 195 95 190 140 205C180 180 250 185 290 208C335 190 405 195 450 220H0Z"
      fill="#494B8C"
      opacity="0.55"
    />
  </svg>
);

/**
 * Landing Page Right Hero Illustration (Reference Top-Left: "Build Together, Go Further.")
 */
export const LandingHeroArtwork: React.FC = () => (
  <div className="relative w-full h-full min-h-[360px] sm:min-h-[420px] rounded-3xl overflow-hidden bg-gradient-to-br from-[#EFEFF9] via-[#D8D9F2] to-[#8C8ECA] border border-peri-200/70 shadow-craft-md flex items-end justify-center">
    <svg
      viewBox="0 0 560 440"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="heroSky" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F5F5FC" />
          <stop offset="38%" stopColor="#D9DAF3" />
          <stop offset="75%" stopColor="#7E80C4" />
          <stop offset="100%" stopColor="#464786" />
        </linearGradient>
        <linearGradient id="heroCloudLight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="65%" stopColor="#DCDDF5" />
          <stop offset="100%" stopColor="#9496D1" />
        </linearGradient>
      </defs>

      <rect width="560" height="440" fill="url(#heroSky)" />

      {/* Sparkling stars in upper right periwinkle sky */}
      <path d="M460 52L463 61L472 64L463 67L460 76L457 67L448 64L457 61Z" fill="#FFFFFF" opacity="0.9" />
      <path d="M360 88L362 93L367 95L362 97L360 102L358 97L353 95L358 93Z" fill="#FFFFFF" opacity="0.75" />
      <circle cx="505" cy="110" r="2" fill="#FFFFFF" opacity="0.8" />
      <circle cx="415" cy="45" r="1.5" fill="#FFFFFF" opacity="0.7" />

      {/* Billowing periwinkle clouds */}
      <path
        d="M60 440C80 365 150 340 210 365C245 295 340 280 395 325C435 265 520 265 560 315V440H60Z"
        fill="#6667AB"
        opacity="0.45"
      />
      <path
        d="M0 440C30 380 110 360 175 385C225 320 325 315 380 360C430 305 510 310 560 355V440H0Z"
        fill="url(#heroCloudLight)"
      />

      {/* Character silhouette sitting on cloud ridge looking toward horizon */}
      <g transform="translate(250, 145)">
        {/* Soft backlight aura */}
        <circle cx="95" cy="95" r="78" fill="#FFFFFF" opacity="0.32" />
        {/* Legs & sneakers resting on cloud */}
        <path d="M45 195L15 235L35 245L78 205Z" fill="#3B3D78" />
        <path d="M68 198L48 248L72 254L98 205Z" fill="#2A2C5A" />
        <rect x="6" y="230" width="30" height="14" rx="7" fill="#FFFFFF" stroke="#454782" strokeWidth="2" />
        <rect x="40" y="244" width="32" height="14" rx="7" fill="#FFFFFF" stroke="#454782" strokeWidth="2" />
        {/* Relaxed hoodie/jacket torso */}
        <path
          d="M58 105C42 125 38 165 46 202H128C136 168 130 125 106 105C90 95 72 95 58 105Z"
          fill="#FFFFFF"
          stroke="#4E508F"
          strokeWidth="2.2"
        />
        <path
          d="M68 112C58 135 56 168 62 202H112C116 170 112 135 98 112Z"
          fill="#6667AB"
          opacity="0.25"
        />
        {/* Head & windswept hair */}
        <circle cx="86" cy="68" r="24" fill="#FFF2EA" stroke="#4E508F" strokeWidth="2" />
        <path
          d="M58 64C58 36 114 34 116 66C116 52 104 45 88 48C74 45 62 52 58 64Z"
          fill="#4A4C8C"
        />
        <path
          d="M62 52C52 65 52 84 62 94C64 78 66 64 76 56Z"
          fill="#6667AB"
        />
      </g>
    </svg>

    <div className="absolute top-6 right-6 text-right pointer-events-none">
      <p className="text-xs sm:text-sm font-medium text-white/95 tracking-wide drop-shadow-xs">
        Build
        <br />
        Together,
        <br />
        Go Further.
      </p>
    </div>
  </div>
);

/**
 * Auth Left Panel Twilight Artwork (Reference Bottom-Left: "Good People, Build Great Things.")
 */
export const AuthTwilightArtwork: React.FC = () => (
  <div className="relative w-full h-full min-h-[480px] overflow-hidden bg-[#191B34] flex flex-col justify-between p-8 text-white select-none">
    <svg
      viewBox="0 0 420 620"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="authTwilight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1E2040" />
          <stop offset="45%" stopColor="#494B8C" />
          <stop offset="78%" stopColor="#8A7CB8" />
          <stop offset="100%" stopColor="#232442" />
        </linearGradient>
      </defs>
      <rect width="420" height="620" fill="url(#authTwilight)" />

      {/* Stars */}
      <circle cx="70" cy="80" r="1.2" fill="#FFFFFF" opacity="0.8" />
      <circle cx="190" cy="55" r="1.5" fill="#FFFFFF" opacity="0.6" />
      <circle cx="310" cy="95" r="1.3" fill="#FFFFFF" opacity="0.85" />
      <circle cx="350" cy="180" r="1.1" fill="#FFFFFF" opacity="0.6" />
      <circle cx="130" cy="210" r="1.4" fill="#FFFFFF" opacity="0.7" />
      <path d="M265 130L267 136L273 138L267 140L265 146L263 140L257 138L263 136Z" fill="#FFFFFF" opacity="0.8" />

      {/* Soft twilight clouds */}
      <path
        d="M0 390C60 360 130 365 190 385C250 350 340 355 420 385V470H0V390Z"
        fill="#A594C8"
        opacity="0.35"
      />

      {/* Distant city skyline silhouette */}
      <g fill="#232546" opacity="0.85">
        <rect x="20" y="420" width="28" height="70" />
        <rect x="52" y="400" width="36" height="90" />
        <rect x="94" y="430" width="24" height="60" />
        <rect x="125" y="410" width="32" height="80" />
        <rect x="230" y="415" width="30" height="75" />
        <rect x="266" y="395" width="40" height="95" />
        <rect x="312" y="425" width="28" height="65" />
        <rect x="348" y="408" width="38" height="82" />
      </g>

      {/* Foreground hill & seated figure looking at skyline */}
      <path d="M0 500Q160 465 420 510V620H0Z" fill="#141529" />
      <g transform="translate(88, 395)">
        <circle cx="42" cy="26" r="14" fill="#1F213D" />
        <path d="M20 44C20 44 64 44 68 95H14C16 65 20 44 20 44Z" fill="#2A2D54" />
      </g>
    </svg>

    <div className="relative z-10 pt-4">
      <p className="text-lg font-medium leading-relaxed text-white/90 tracking-tight">
        Good
        <br />
        People,
        <br />
        Build
        <br />
        Great
        <br />
        Things.
      </p>
    </div>

    <div className="relative z-10 text-xs text-peri-200/80">
      Pick Team · Cohort Team Building & Collaboration
    </div>
  </div>
);
