'use client';

/**
 * Zancan-inspired animated background
 * Algorithmic trees and rocks with subtle swaying animation
 */

export default function BackgroundTrees() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Gradient for depth */}
          <linearGradient id="treeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#2D5016', stopOpacity: 0.6 }} />
            <stop offset="100%" style={{ stopColor: '#1A2E0B', stopOpacity: 0.8 }} />
          </linearGradient>

          {/* Rock gradient */}
          <linearGradient id="rockGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#3E362E', stopOpacity: 0.7 }} />
            <stop offset="100%" style={{ stopColor: '#2A2420', stopOpacity: 0.9 }} />
          </linearGradient>

          {/* Organic noise texture */}
          <filter id="organicTexture">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" />
            <feColorMatrix type="saturate" values="0.3" />
          </filter>
        </defs>

        {/* Background rocks - bottom layer */}
        <g className="rocks" opacity="0.5">
          {/* Left rock cluster */}
          <ellipse cx="10%" cy="85%" rx="80" ry="40" fill="url(#rockGradient)" transform="rotate(-5 10 85)" />
          <ellipse cx="12%" cy="88%" rx="60" ry="35" fill="url(#rockGradient)" transform="rotate(8 12 88)" />

          {/* Right rock cluster */}
          <ellipse cx="88%" cy="82%" rx="70" ry="45" fill="url(#rockGradient)" transform="rotate(12 88 82)" />
          <ellipse cx="90%" cy="86%" rx="55" ry="30" fill="url(#rockGradient)" transform="rotate(-6 90 86)" />

          {/* Center rocks */}
          <ellipse cx="50%" cy="90%" rx="65" ry="38" fill="url(#rockGradient)" transform="rotate(3 50 90)" />
        </g>

        {/* Far background trees */}
        <g className="tree-back-left animate-sway-slow" style={{ transformOrigin: '15% 100%' }}>
          {/* Trunk */}
          <rect x="14%" y="50%" width="2%" height="40%" fill="#1A2E0B" opacity="0.4" />
          {/* Canopy - algorithmic branches */}
          <ellipse cx="15%" cy="48%" rx="8%" ry="15%" fill="url(#treeGradient)" opacity="0.4" />
          <ellipse cx="13%" cy="52%" rx="6%" ry="12%" fill="url(#treeGradient)" opacity="0.35" />
          <ellipse cx="17%" cy="50%" rx="7%" ry="13%" fill="url(#treeGradient)" opacity="0.38" />
        </g>

        <g className="tree-back-right animate-sway-slow-reverse" style={{ transformOrigin: '85% 100%' }}>
          <rect x="84%" y="45%" width="2%" height="45%" fill="#1A2E0B" opacity="0.4" />
          <ellipse cx="85%" cy="43%" rx="9%" ry="18%" fill="url(#treeGradient)" opacity="0.4" />
          <ellipse cx="83%" cy="47%" rx="7%" ry="14%" fill="url(#treeGradient)" opacity="0.35" />
          <ellipse cx="87%" cy="45%" rx="8%" ry="15%" fill="url(#treeGradient)" opacity="0.38" />
        </g>

        {/* Mid-ground trees */}
        <g className="tree-mid-left animate-sway" style={{ transformOrigin: '25% 100%' }}>
          <rect x="24%" y="40%" width="2.5%" height="50%" fill="#2D5016" opacity="0.5" />
          <ellipse cx="25%" cy="35%" rx="10%" ry="20%" fill="url(#treeGradient)" opacity="0.5" />
          <ellipse cx="22%" cy="40%" rx="8%" ry="16%" fill="url(#treeGradient)" opacity="0.45" />
          <ellipse cx="28%" cy="38%" rx="9%" ry="18%" fill="url(#treeGradient)" opacity="0.48" />
          <ellipse cx="25%" cy="43%" rx="7%" ry="14%" fill="url(#treeGradient)" opacity="0.43" />
        </g>

        <g className="tree-mid-center animate-sway-reverse" style={{ transformOrigin: '55% 100%' }}>
          <rect x="54%" y="35%" width="2.5%" height="55%" fill="#2D5016" opacity="0.5" />
          <ellipse cx="55%" cy="30%" rx="11%" ry="22%" fill="url(#treeGradient)" opacity="0.5" />
          <ellipse cx="52%" cy="35%" rx="9%" ry="18%" fill="url(#treeGradient)" opacity="0.45" />
          <ellipse cx="58%" cy="33%" rx="10%" ry="20%" fill="url(#treeGradient)" opacity="0.48" />
        </g>

        <g className="tree-mid-right animate-sway" style={{ transformOrigin: '75% 100%' }}>
          <rect x="74%" y="38%" width="2.5%" height="52%" fill="#2D5016" opacity="0.5" />
          <ellipse cx="75%" cy="33%" rx="10.5%" ry="21%" fill="url(#treeGradient)" opacity="0.5" />
          <ellipse cx="72%" cy="38%" rx="8.5%" ry="17%" fill="url(#treeGradient)" opacity="0.45" />
          <ellipse cx="78%" cy="36%" rx="9.5%" ry="19%" fill="url(#treeGradient)" opacity="0.48" />
        </g>

        {/* Foreground trees - tallest */}
        <g className="tree-front-left animate-sway-slow" style={{ transformOrigin: '8% 100%' }}>
          <rect x="7%" y="25%" width="3%" height="65%" fill="#3E6B1E" opacity="0.6" />
          <ellipse cx="8%" cy="18%" rx="13%" ry="28%" fill="url(#treeGradient)" opacity="0.6" />
          <ellipse cx="5%" cy="25%" rx="10%" ry="22%" fill="url(#treeGradient)" opacity="0.55" />
          <ellipse cx="11%" cy="22%" rx="11%" ry="24%" fill="url(#treeGradient)" opacity="0.58" />
          <ellipse cx="8%" cy="28%" rx="9%" ry="20%" fill="url(#treeGradient)" opacity="0.53" />
        </g>

        <g className="tree-front-right animate-sway-slow-reverse" style={{ transformOrigin: '92% 100%' }}>
          <rect x="91%" y="20%" width="3%" height="70%" fill="#3E6B1E" opacity="0.6" />
          <ellipse cx="92%" cy="15%" rx="14%" ry="30%" fill="url(#treeGradient)" opacity="0.6" />
          <ellipse cx="89%" cy="22%" rx="11%" ry="24%" fill="url(#treeGradient)" opacity="0.55" />
          <ellipse cx="95%" cy="19%" rx="12%" ry="26%" fill="url(#treeGradient)" opacity="0.58" />
          <ellipse cx="92%" cy="26%" rx="10%" ry="22%" fill="url(#treeGradient)" opacity="0.53" />
        </g>

        {/* Scattered foliage details */}
        <g className="foliage" opacity="0.3">
          <circle cx="20%" cy="70%" r="15" fill="#5A8C2A" className="animate-pulse-slow" />
          <circle cx="35%" cy="75%" r="12" fill="#4A7625" className="animate-pulse-slow" style={{ animationDelay: '1s' }} />
          <circle cx="65%" cy="72%" r="14" fill="#5A8C2A" className="animate-pulse-slow" style={{ animationDelay: '2s' }} />
          <circle cx="80%" cy="68%" r="13" fill="#4A7625" className="animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        </g>
      </svg>

      <style jsx>{`
        @keyframes sway {
          0%, 100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(0.8deg);
          }
          75% {
            transform: rotate(-0.8deg);
          }
        }

        @keyframes sway-slow {
          0%, 100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(0.5deg);
          }
          75% {
            transform: rotate(-0.5deg);
          }
        }

        @keyframes sway-reverse {
          0%, 100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(-0.8deg);
          }
          75% {
            transform: rotate(0.8deg);
          }
        }

        @keyframes sway-slow-reverse {
          0%, 100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(-0.5deg);
          }
          75% {
            transform: rotate(0.5deg);
          }
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.05);
          }
        }

        .animate-sway {
          animation: sway 8s ease-in-out infinite;
        }

        .animate-sway-slow {
          animation: sway-slow 12s ease-in-out infinite;
        }

        .animate-sway-reverse {
          animation: sway-reverse 8s ease-in-out infinite;
        }

        .animate-sway-slow-reverse {
          animation: sway-slow-reverse 12s ease-in-out infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
