/**
 * Logo Animators - SVG Inline Renderers
 *
 * Senior Animator Pattern: Animated logo SVGs for YouTube, TikTok, Instagram
 * Each logo enters with 600-700ms animation respecting prefers-reduced-motion
 *
 * Used in: app.js channelToggleCards section
 */

const LOGO_STYLES = `
<style id="logo-animations-style">
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

  @keyframes logoFloat {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-4px);
    }
  }

  .logo-animated {
    will-change: transform, opacity;
    transform-origin: center;
    display: inline-block;
    vertical-align: middle;
  }

  .logo-youtube-animated {
    animation: youtubeEntrance 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  .logo-tiktok-animated {
    animation: tiktokEntrance 700ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  .logo-instagram-animated {
    animation: instagramEntrance 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
              instagramShimmer 1s ease-in-out 600ms forwards;
  }

  /* Respects prefers-reduced-motion */
  @media (prefers-reduced-motion: reduce) {
    .logo-youtube-animated,
    .logo-tiktok-animated,
    .logo-instagram-animated {
      animation: none !important;
      opacity: 1 !important;
      transform: scale(1) !important;
      filter: brightness(1) !important;
    }
  }
</style>
`;

function renderYouTubeLogo(size = 32) {
  return `
    <svg class="logo-animated logo-youtube-animated" width="${size}" height="${size}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="YouTube" style="will-change: transform, opacity; backface-visibility: hidden;">
      <rect x="6" y="12" width="36" height="24" rx="4" ry="4" fill="#FF0000" />
      <path d="M 20 18 L 20 30 L 30 24 Z" fill="white" />
    </svg>
  `;
}

function renderTikTokLogo(size = 32) {
  return `
    <svg class="logo-animated logo-tiktok-animated" width="${size}" height="${size}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="TikTok" style="will-change: transform, opacity; backface-visibility: hidden;">
      <rect x="16" y="6" width="2" height="28" fill="#000000" />
      <circle cx="17" cy="32" r="4" fill="#000000" />
      <circle cx="23" cy="28" r="4" fill="#000000" />
      <circle cx="24" cy="24" r="18" fill="none" stroke="#25F4EE" stroke-width="2.5" opacity="0.8" />
    </svg>
  `;
}

function renderInstagramLogo(size = 32) {
  return `
    <svg class="logo-animated logo-instagram-animated" width="${size}" height="${size}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Instagram" style="will-change: transform, opacity, filter; backface-visibility: hidden;">
      <defs>
        <linearGradient id="instaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fd1d1d" />
          <stop offset="50%" stop-color="#f15245" />
          <stop offset="100%" stop-color="#d92e7f" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="32" height="32" rx="8" ry="8" fill="url(#instaGrad)" />
      <circle cx="24" cy="24" r="10" fill="none" stroke="white" stroke-width="2.5" />
      <circle cx="24" cy="24" r="2.5" fill="white" />
      <circle cx="34" cy="14" r="1.5" fill="white" opacity="0.7" />
    </svg>
  `;
}

function renderAnimatedLogoByPlatform(platform, size = 32) {
  const normalizedPlatform = String(platform ?? '').toLowerCase().trim();

  if (normalizedPlatform === 'youtube') {
    return renderYouTubeLogo(size);
  }
  if (normalizedPlatform === 'tiktok') {
    return renderTikTokLogo(size);
  }
  if (normalizedPlatform === 'instagram') {
    return renderInstagramLogo(size);
  }

  // Fallback: return empty string for unknown platforms
  return '';
}

// Only inject styles once, on first use
let stylesInjected = false;

function ensureLogoStylesInjected() {
  if (stylesInjected || typeof document === 'undefined') return;

  const styleContainer = document.querySelector('#app');
  if (styleContainer && !document.querySelector('#logo-animations-style')) {
    const styleElement = document.createElement('div');
    styleElement.innerHTML = LOGO_STYLES;
    styleContainer.insertAdjacentHTML('beforeend', LOGO_STYLES);
    stylesInjected = true;
  }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderYouTubeLogo,
    renderTikTokLogo,
    renderInstagramLogo,
    renderAnimatedLogoByPlatform,
    ensureLogoStylesInjected,
    LOGO_STYLES,
  };
}
