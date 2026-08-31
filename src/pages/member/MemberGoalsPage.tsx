import React, { useState } from 'react';

interface FitnessGoal {
  id: string;
  type: 'weight' | 'muscle' | 'fat';
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  updatedAt: string;
}

export const MemberGoalsPage: React.FC = () => {
  const [goals, setGoals] = useState<FitnessGoal[]>([
    {
      id: '1',
      type: 'weight',
      title: 'Vücut Ağırlığı',
      currentValue: 78.5,
      targetValue: 74.0,
      unit: 'kg',
      updatedAt: '24 Temmuz 2026',
    },
    {
      id: '2',
      type: 'muscle',
      title: 'Kas Kütlesi',
      currentValue: 36.2,
      targetValue: 39.0,
      unit: 'kg',
      updatedAt: '20 Temmuz 2026',
    },
    {
      id: '3',
      type: 'fat',
      title: 'Yağ Oranı',
      currentValue: 18.4,
      targetValue: 14.0,
      unit: '%',
      updatedAt: '15 Temmuz 2026',
    },
  ]);

  const [newVal, setNewVal] = useState<string>('');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('1');

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newVal);
    if (isNaN(val)) return;

    setGoals((prev) =>
      prev.map((g) =>
        g.id === selectedGoalId
          ? { ...g, currentValue: val, updatedAt: 'Bugün' }
          : g
      )
    );
    setNewVal('');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 text-white">
      <div>
        <h1 className="text-2xl font-bold">Kilo & Kas Hedeflerim</h1>
        <p className="text-sm text-slate-400 mt-1">
          Fiziksel gelişiminizi, kilo ve kas hedeflerinizi anlık olarak takip edin.
        </p>
      </div>

      {/* Goal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {goals.map((g) => {
          const isWeight = g.type === 'weight';
          const isFat = g.type === 'fat';

          // Progress calculation
          const diffTotal = Math.abs(g.targetValue - g.currentValue);
          const progressPercent = Math.min(100, Math.max(10, Math.round((1 - diffTotal / g.targetValue) * 100)));

          return (
            <div
              key={g.id}
              className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl backdrop-blur-xl hover:border-slate-700 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">{g.title}</span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full">{g.updatedAt}</span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-white">{g.currentValue}</span>
                <span className="text-sm font-semibold text-slate-400">{g.unit}</span>
                <span className="ml-auto text-xs text-emerald-400 font-semibold">Hedef: {g.targetValue} {g.unit}</span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>İlerleme</span>
                  <span>%{progressPercent}</span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isWeight ? 'bg-emerald-500' : isFat ? 'bg-amber-500' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Log New Entry Form */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <h3 className="text-base font-bold text-white">Yeni Ölçüm Verisi Ekle</h3>
        <form onSubmit={handleUpdate} className="flex flex-col md:flex-row items-center gap-4">
          <select
            value={selectedGoalId}
            onChange={(e) => setSelectedGoalId(e.target.value)}
            className="w-full md:w-1/3 bg-slate-950 border border-slate-800 text-white text-sm rounded-2xl p-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title} ({g.unit})
              </option>
            ))}
          </select>

          <input
            type="number"
            step="0.1"
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            placeholder="Yeni Değer (Örn: 77.2)"
            required
            className="w-full md:w-1/3 bg-slate-950 border border-slate-800 text-white text-sm rounded-2xl p-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          <button
            type="submit"
            className="w-full md:w-1/3 bg-emerald-500 text-slate-950 font-bold text-sm py-3.5 px-6 rounded-2xl hover:bg-emerald-400 active:scale-95 transition-all shadow-md"
          >
            Ölçümü Kaydet
          </button>
        </form>
      </div>
    </div>
  );
};
