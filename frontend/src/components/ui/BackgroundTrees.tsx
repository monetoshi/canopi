'use client';

/**
 * Zancan-inspired animated background
 * Floating clouds and rocks with gentle movement
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
          {/* Cloud gradient - soft and atmospheric */}
          <radialGradient id="cloudGradient1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" style={{ stopColor: '#5A8C2A', stopOpacity: 0.4 }} />
            <stop offset="100%" style={{ stopColor: '#3E6B1E', stopOpacity: 0.2 }} />
          </radialGradient>

          <radialGradient id="cloudGradient2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" style={{ stopColor: '#4A7625', stopOpacity: 0.5 }} />
            <stop offset="100%" style={{ stopColor: '#2D5016', stopOpacity: 0.25 }} />
          </radialGradient>

          <radialGradient id="cloudGradient3" cx="50%" cy="50%" r="50%">
            <stop offset="0%" style={{ stopColor: '#6B9435', stopOpacity: 0.35 }} />
            <stop offset="100%" style={{ stopColor: '#5A8C2A', stopOpacity: 0.15 }} />
          </radialGradient>

          {/* Soft blur for clouds */}
          <filter id="cloudBlur">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
        </defs>

        {/* High altitude clouds - slowest */}
        <g className="clouds-high animate-drift-slow" filter="url(#cloudBlur)">
          <ellipse cx="15%" cy="15%" rx="120" ry="40" fill="url(#cloudGradient3)" opacity="0.3" />
          <ellipse cx="70%" cy="12%" rx="150" ry="45" fill="url(#cloudGradient3)" opacity="0.35" />
        </g>

        {/* Mid-altitude clouds - medium speed */}
        <g className="clouds-mid animate-drift-medium" filter="url(#cloudBlur)">
          {/* Cloud 1 - left */}
          <ellipse cx="5%" cy="25%" rx="100" ry="35" fill="url(#cloudGradient1)" opacity="0.4" />
          <ellipse cx="8%" cy="23%" rx="80" ry="30" fill="url(#cloudGradient2)" opacity="0.35" />
          <ellipse cx="3%" cy="27%" rx="70" ry="28" fill="url(#cloudGradient3)" opacity="0.3" />

          {/* Cloud 2 - center */}
          <ellipse cx="45%" cy="30%" rx="130" ry="40" fill="url(#cloudGradient2)" opacity="0.45" />
          <ellipse cx="48%" cy="28%" rx="100" ry="35" fill="url(#cloudGradient1)" opacity="0.4" />
          <ellipse cx="42%" cy="32%" rx="90" ry="32" fill="url(#cloudGradient3)" opacity="0.35" />

          {/* Cloud 3 - right */}
          <ellipse cx="85%" cy="22%" rx="110" ry="38" fill="url(#cloudGradient1)" opacity="0.4" />
          <ellipse cx="88%" cy="24%" rx="85" ry="32" fill="url(#cloudGradient3)" opacity="0.35" />
        </g>

        {/* Low altitude clouds - fastest */}
        <g className="clouds-low animate-drift-fast" filter="url(#cloudBlur)">
          {/* Cloud 1 */}
          <ellipse cx="20%" cy="40%" rx="140" ry="45" fill="url(#cloudGradient2)" opacity="0.5" />
          <ellipse cx="23%" cy="38%" rx="110" ry="38" fill="url(#cloudGradient1)" opacity="0.45" />
          <ellipse cx="17%" cy="42%" rx="100" ry="35" fill="url(#cloudGradient3)" opacity="0.4" />

          {/* Cloud 2 */}
          <ellipse cx="60%" cy="45%" rx="150" ry="50" fill="url(#cloudGradient1)" opacity="0.55" />
          <ellipse cx="63%" cy="43%" rx="120" ry="42" fill="url(#cloudGradient2)" opacity="0.5" />
          <ellipse cx="57%" cy="47%" rx="110" ry="38" fill="url(#cloudGradient3)" opacity="0.45" />
        </g>

        {/* Scattered mist particles */}
        <g className="mist" opacity="0.25">
          <circle cx="30%" cy="60%" r="20" fill="url(#cloudGradient3)" className="animate-pulse-slow" filter="url(#cloudBlur)" />
          <circle cx="55%" cy="65%" r="18" fill="url(#cloudGradient1)" className="animate-pulse-slow" style={{ animationDelay: '2s' }} filter="url(#cloudBlur)" />
          <circle cx="75%" cy="58%" r="22" fill="url(#cloudGradient2)" className="animate-pulse-slow" style={{ animationDelay: '4s' }} filter="url(#cloudBlur)" />
        </g>
      </svg>

      <style jsx>{`
        @keyframes drift-slow {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(100vw);
          }
        }

        @keyframes drift-medium {
          0% {
            transform: translateX(-10vw);
          }
          100% {
            transform: translateX(110vw);
          }
        }

        @keyframes drift-fast {
          0% {
            transform: translateX(-20vw);
          }
          100% {
            transform: translateX(120vw);
          }
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.25;
            transform: scale(1);
          }
          50% {
            opacity: 0.35;
            transform: scale(1.1);
          }
        }

        .animate-drift-slow {
          animation: drift-slow 180s linear infinite;
        }

        .animate-drift-medium {
          animation: drift-medium 120s linear infinite;
        }

        .animate-drift-fast {
          animation: drift-fast 80s linear infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
