// MODULE 10: Payroll Configuration Host Component
import React, { useState } from 'react';
import {
  Calendar,
  Sliders,
  Settings,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { PayrollCycleTab } from './PayrollCycleTab';
import { AttendancePolicyTab } from './AttendancePolicyTab';

export const PayrollConfigurationTab: React.FC = () => {
  // Submodule navigation state: 'cycle' | 'policy'
  const [activeSubTab, setActiveSubTab] = useState<'cycle' | 'policy'>('cycle');

  return (
    <div className="space-y-6">
      {/* Submodule Segmented Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-100 p-2 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('cycle')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'cycle'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4 text-brand-600" />
            <span>Payroll Cycle</span>
          </button>

          <button
            onClick={() => setActiveSubTab('policy')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'policy'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4 text-brand-600" />
            <span>Attendance Policy</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 hidden sm:flex items-center gap-2 pr-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Dynamic Payroll Calculation Engine Active</span>
        </div>
      </div>

      {/* Submodule Content */}
      <div className="animate-in fade-in duration-200">
        {activeSubTab === 'cycle' && <PayrollCycleTab />}
        {activeSubTab === 'policy' && <AttendancePolicyTab />}
      </div>
    </div>
  );
};
