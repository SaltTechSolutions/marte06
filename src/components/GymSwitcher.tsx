import React from 'react';
import { useTenant } from '../context/TenantContext';

export const GymSwitcher: React.FC = () => {
  const { activeTenant, userMemberships, switchTenant } = useTenant();

  if (!userMemberships || userMemberships.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/50 text-xs font-semibold text-emerald-400">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>{activeTenant?.name || 'Tarabya Marte'}</span>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <select
        value={activeTenant?.id || ''}
        onChange={(e) => switchTenant(e.target.value)}
        className="appearance-none bg-slate-800/80 border border-slate-700 text-xs font-semibold text-emerald-400 rounded-full px-3 py-1.5 pr-7 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
      >
        {userMemberships.map((m) => (
          <option key={m.tenantId} value={m.tenantId} className="bg-slate-900 text-white">
            {m.tenantName} ({m.tenantCode})
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-emerald-400">
        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
        </svg>
      </div>
    </div>
  );
};
