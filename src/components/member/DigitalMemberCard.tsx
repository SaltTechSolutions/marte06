import React from 'react';
import { useTenant } from '../../context/TenantContext';

interface DigitalMemberCardProps {
  memberName: string;
  memberUid: string;
  packageTitle?: string;
  remainingLessons?: number | null;
}

export const DigitalMemberCard: React.FC<DigitalMemberCardProps> = ({
  memberName,
  memberUid,
  packageTitle = 'Standart Üyelik',
  remainingLessons,
}) => {
  const { activeTenant } = useTenant();
  const qrData = `GYMENTRA:${activeTenant?.id || 'tarabya-marte'}:${memberUid}`;

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 border border-slate-800 shadow-2xl backdrop-blur-xl">
      {/* Dynamic Background Glow */}
      <div className="absolute -right-12 -top-12 w-44 h-44 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -left-12 -bottom-12 w-44 h-44 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col justify-between h-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">
              {activeTenant?.name || 'Tarabya Marte'} Pass
            </span>
            <h3 className="text-lg font-extrabold text-white">{memberName}</h3>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-800/80 text-slate-300 px-3 py-1 rounded-full border border-slate-700">
            {activeTenant?.code || 'TARABYA-01'}
          </span>
        </div>

        {/* QR Code Placeholder & Details */}
        <div className="flex items-center justify-between gap-4 py-2">
          <div className="bg-white p-3 rounded-2xl shadow-inner flex items-center justify-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`}
              alt="Üye QR Kodu"
              className="w-24 h-24 object-contain"
            />
          </div>

          <div className="flex-1 space-y-2">
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-500">Aktif Paket</p>
              <p className="text-sm font-bold text-slate-200">{packageTitle}</p>
            </div>
            {remainingLessons !== undefined && remainingLessons !== null && (
              <div>
                <p className="text-[10px] uppercase font-semibold text-slate-500">Kalan Ders Hakları</p>
                <p className="text-xl font-extrabold text-emerald-400">{remainingLessons} Ders</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px] text-slate-500">
          <span>GymEntra Verified Member</span>
          <span className="font-mono text-slate-400">ID: {memberUid.substring(0, 10)}...</span>
        </div>
      </div>
    </div>
  );
};
