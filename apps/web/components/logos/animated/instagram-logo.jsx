import React from 'react';

/**
 * InstagramLogoAnimated
 *
 * Senior Animator Pattern: Translate Up + Shimmer (Radiant Connection)
 * - Animation 1 (Entrance): TranslateY +20px→0 + Scale 0.3→1 + Opacity 0→1 (600ms)
 * - Animation 2 (Shimmer): Brightness 1→1.2→1 (1s, starts at 600ms—post entrance)
 * - Easing: cubic-bezier(0.34, 1.56, 0.64, 1) for entrance (spring)
 * - Easing: ease-in-out for shimmer (smooth glow)
 * - Semantic: Entrance from below suggests "rising" + shimmer suggests "radiant, connected"
 *
 * Respects: prefers-reduced-motion (no animation if user prefers)
 * Performance: transform + opacity + filter brightness only, GPU accelerated
 */
export function InstagramLogoAnimated({ size = 64, playAnimation = true }) {
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
        @keyframes instagramEntrance {
          0% {
            opacity: 0;
            transform: scale(0.3) translateY(20px);
            filter: brightness(0.8);
          }
          50% {
            opacity: 0.7;
            filter: brightness(0.9);
          }
          85% {
            transform: scale(1.1) translateY(-2px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
            filter: brightness(1);
          }
        }

        @keyframes instagramShimmer {
          0%, 100% {
            filter: brightness(1);
          }
          50% {
            filter: brightness(1.2);
          }
        }

        @keyframes instagramFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }

        .instagram-logo-animated {
          ${shouldAnimate ? 'animation: instagramEntrance 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards, instagramShimmer 1s ease-in-out 600ms forwards;' : 'opacity: 1; transform: scale(1) translateY(0); filter: brightness(1);'}
          will-change: transform, opacity, filter;
          transform-origin: center;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .instagram-logo-animated:hover {
          ${shouldAnimate ? 'animation: instagramFloat 3s ease-in-out infinite;' : 'none'}
        }
      `}</style>

      <svg
        className="instagram-logo-animated"
        width={size}
        height={size}
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Instagram Logo"
        style={{
          willChange: 'transform, opacity, filter',
          backfaceVisibility: 'hidden',
        }}
      >
        <defs>
          <linearGradient id="instaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fd1d1d" />
            <stop offset="50%" stopColor="#f15245" />
            <stop offset="100%" stopColor="#d92e7f" />
          </linearGradient>
        </defs>

        {/* Instagram square with gradient */}
        <rect x="8" y="8" width="32" height="32" rx="8" ry="8" fill="url(#instaGradient)" />

        {/* Inner circle (camera lens) */}
        <circle cx="24" cy="24" r="10" fill="none" stroke="white" strokeWidth="2.5" />

        {/* Center dot (camera focus) */}
        <circle cx="24" cy="24" r="2.5" fill="white" />

        {/* Shine corner (top-right, for photographic feel) */}
        <circle cx="34" cy="14" r="1.5" fill="white" opacity="0.7" />
      </svg>
    </>
  );
}

InstagramLogoAnimated.displayName = 'InstagramLogoAnimated';
