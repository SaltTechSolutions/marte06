import React from 'react';

interface GymEntraLogoProps {
  className?: string;
  size?: number | string;
  showText?: boolean;
}

export const GymEntraLogo: React.FC<GymEntraLogoProps> = ({
  className = '',
  size = 48,
  showText = true,
}) => {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 800 800"
        width={size}
        height={size}
        className="flex-shrink-0"
      >
        <defs>
          <linearGradient id="bgGradComp" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0B0F19" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
          <linearGradient id="pulseGradComp" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="50%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <filter id="neonGlowComp" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <rect width="800" height="800" fill="url(#bgGradComp)" rx="160" />
        <circle cx="400" cy="400" r="240" fill="none" stroke="#1F2937" strokeWidth="6" strokeDasharray="10 10" />
        <g transform="translate(0, 50)">
          <path d="M 270 280 A 130 130 0 0 0 270 420" fill="none" stroke="#1F2937" strokeWidth="24" strokeLinecap="round"/>
          <path d="M 270 280 A 130 130 0 0 0 270 380" fill="none" stroke="url(#pulseGradComp)" strokeWidth="24" strokeLinecap="round"/>
          <path d="M 530 280 A 130 130 0 0 1 530 420" fill="none" stroke="#1F2937" strokeWidth="24" strokeLinecap="round"/>
          <path d="M 530 320 A 130 130 0 0 1 530 420" fill="none" stroke="url(#pulseGradComp)" strokeWidth="24" strokeLinecap="round"/>
          <path d="M 230 350 L 310 350 L 345 390 L 385 270 L 425 410 L 460 350 L 570 350" 
                fill="none" 
                stroke="url(#pulseGradComp)" 
                strokeWidth="28" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                filter="url(#neonGlowComp)"/>
          <circle cx="385" cy="270" r="10" fill="#FFFFFF" />
          <circle cx="425" cy="410" r="10" fill="#FFFFFF" />
          <circle cx="345" cy="390" r="8" fill="#10B981" />
          <circle cx="460" cy="350" r="8" fill="#06B6D4" />
        </g>
      </svg>
      {showText && (
        <div className="flex flex-col">
          <span className="font-extrabold text-xl tracking-tight text-white leading-none">
            <span className="text-emerald-500">Gym</span>Entra
          </span>
          <span className="text-[10px] uppercase font-medium tracking-widest text-gray-400 mt-1">
            Powering Modern Gyms
          </span>
        </div>
      )}
    </div>
  );
};
