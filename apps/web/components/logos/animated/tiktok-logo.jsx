import React from 'react';

/**
 * TikTokLogoAnimated
 *
 * Senior Animator Pattern: Rotation + Scale (Trending Energy)
 * - Animation: Rotate -180°→0° + Scale 0.5→1 + Opacity 0→1
 * - Easing: cubic-bezier(0.34, 1.56, 0.64, 1) (spring bounce)
 * - Duration: 700ms (longer than YouTube—more energetic)
 * - Semantic: Spinning motion suggests "trending", movement, TikTok's fast-paced nature
 *
 * Respects: prefers-reduced-motion (no animation if user prefers)
 * Performance: transform + opacity only, GPU accelerated
 */
export function TikTokLogoAnimated({ size = 64, playAnimation = true }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const shouldAnimate = playAnimation && !prefersReducedMotion;

  return (
    <>
      <style>{`
        @keyframes tiktokEntrance {
          0% {
            opacity: 0;
            transform: scale(0.5) rotate(-180deg);
          }
          50% {
            opacity: 0.8;
            transform: scale(0.9) rotate(-45deg);
          }
          85% {
            opacity: 1;
            transform: scale(1.1) rotate(0deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }

        @keyframes tiktokFloat {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-4px) rotate(2deg);
          }
        }

        .tiktok-logo-animated {
          ${shouldAnimate ? 'animation: tiktokEntrance 700ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;' : 'opacity: 1; transform: scale(1) rotate(0deg);'}
          will-change: transform, opacity;
          transform-origin: center;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .tiktok-logo-animated:hover {
          ${shouldAnimate ? 'animation: tiktokFloat 3s ease-in-out infinite;' : 'none'}
        }
      `}</style>

      <svg
        className="tiktok-logo-animated"
        width={size}
        height={size}
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="TikTok Logo"
        style={{
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden',
        }}
      >
        {/* TikTok: Musical note shape in black */}
        {/* Left stem */}
        <rect x="16" y="6" width="2" height="28" fill="#000000" />

        {/* Two circles (double note) */}
        <circle cx="17" cy="32" r="4" fill="#000000" />
        <circle cx="23" cy="28" r="4" fill="#000000" />

        {/* Cyan accent (TikTok signature color) */}
        <circle cx="24" cy="24" r="18" fill="none" stroke="#25F4EE" strokeWidth="2.5" opacity="0.8" />
      </svg>
    </>
  );
}

TikTokLogoAnimated.displayName = 'TikTokLogoAnimated';
