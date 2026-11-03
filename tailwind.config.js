/**
 * Tailwind 색 이름을 src/design-system/tokens.css 변수에 연결합니다.
 * 색상 값은 tokens.css에서만 바꾸고 여기서는 이름과 역할만 정합니다.
 *
 * - primary / secondary: 브랜드 역할 토큰
 * - neutral, gray, slate: 보랏빛 중립 단계(--ds-neutral-*)
 * - peri, blue, indigo, purple, violet: Very Peri 단계(--ds-peri-*)
 *   기존 화면에 흩어진 파란색·보라색 유틸리티를 브랜드 계열로 통일하기 위한 별칭입니다.
 * - red, green, amber, yellow 등 상태색은 Tailwind 기본값을 유지합니다.
 */

/** `/20` 같은 투명도 수식어를 지원하기 위해 color-mix로 변환합니다. */
const token = (name) => ({ opacityValue }) =>
  opacityValue === undefined || opacityValue === '1'
    ? `var(--ds-${name})`
    : `color-mix(in srgb, var(--ds-${name}) calc(${opacityValue} * 100%), transparent)`;

const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const scale = (prefix) =>
  Object.fromEntries([
    ...steps.map((step) => [step, token(`${prefix}-${step}`)]),
    // Tailwind 기본 팔레트의 950 단계를 쓰는 코드가 있어도 깨지지 않게 900으로 맞춥니다.
    [950, token(`${prefix}-900`)],
  ]);

const neutral = scale('neutral');
const peri = scale('peri');

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: {
          DEFAULT: token('surface'),
          low: token('surface-low'),
          container: token('surface-container'),
        },
        ink: token('ink'),
        muted: token('muted'),
        outline: {
          DEFAULT: token('outline'),
          soft: token('outline-soft'),
        },
        primary: {
          DEFAULT: token('primary-fill'),
          dark: token('primary-fill-hover'),
          light: token('primary-container'),
          container: token('primary-container'),
          strong: token('primary'),
        },
        'on-primary': {
          DEFAULT: token('on-primary'),
          container: token('on-primary-container'),
        },
        secondary: {
          DEFAULT: token('primary-container'),
          dark: token('surface-container'),
          light: token('surface-low'),
        },
        focus: token('focus'),
        danger: token('error'),
        success: token('success'),
        warning: token('warning'),
        neutral,
        gray: neutral,
        slate: neutral,
        peri,
        blue: peri,
        indigo: peri,
        purple: peri,
        violet: peri,
      },
      textColor: {
        // 작은 글자에는 대비가 충분한 --ds-primary를 사용합니다(DESIGN.md 색상 규칙).
        primary: {
          DEFAULT: token('primary'),
          dark: token('on-primary-container'),
          light: token('peri-400'),
        },
      },
      fontFamily: {
        sans: [
          '"Pretendard Variable"',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          '"Apple SD Gothic Neo"',
          '"Noto Sans KR"',
          '"Malgun Gothic"',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '12px',
        modal: '20px',
      },
      boxShadow: {
        float: '0 12px 40px rgb(26 26 40 / 0.16)',
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
};
