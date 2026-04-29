import React from 'react';

/**
 * YouTubeLogoAnimated
 *
 * Senior Animator Pattern: Spring Entrance
 * - Animation: Scale 0.7→1 + Rotate -10°→0° + Opacity 0→1
 * - Easing: cubic-bezier(0.34, 1.56, 0.64, 1) (spring bounce)
 * - Duration: 600ms (slow enough to admire, fast enough to feel energetic)
 * - Semantic: Logo enters with energy—shows connection confidence
 *
 * Respects: prefers-reduced-motion (no animation if user prefers)
 * Performance: transform + opacity only, GPU accelerated
 */
export function YouTubeLogoAnimated({ size = 64, playAnimation = true }) {
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
        @keyframes youtubeEntrance {
          0% {
            opacity: 0;
            transform: scale(0.7) rotate(-10deg);
          }
          60% {
            opacity: 1;
            transform: scale(1.15) rotate(5deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }

        @keyframes youtubeFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }

        .youtube-logo-animated {
          ${shouldAnimate ? 'animation: youtubeEntrance 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;' : 'opacity: 1; transform: scale(1) rotate(0deg);'}
          will-change: transform, opacity;
          transform-origin: center;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .youtube-logo-animated:hover {
          ${shouldAnimate ? 'animation: youtubeFloat 3s ease-in-out infinite;' : 'none'}
        }
      `}</style>

      <svg
        className="youtube-logo-animated"
        width={size}
        height={size}
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="YouTube Logo"
        style={{
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden',
        }}
      >
        {/* YouTube background rectangle */}
        <rect x="6" y="12" width="36" height="24" rx="4" ry="4" fill="#FF0000" />

        {/* Play button triangle */}
        <path d="M 20 18 L 20 30 L 30 24 Z" fill="white" />
      </svg>
    </>
  );
}

YouTubeLogoAnimated.displayName = 'YouTubeLogoAnimated';
