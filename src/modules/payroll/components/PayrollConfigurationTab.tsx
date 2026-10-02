// ====================================================================
// Payroll Configuration Host Module
// Modular container for all core payroll configuration submodules
// ====================================================================

import React, { useState } from 'react';
import {
  Calendar,
  Sliders,
  CalendarDays,
  Clock,
  Coins,
  Scale,
  CalendarCheck,
} from 'lucide-react';
import { AttendancePolicyTab } from './AttendancePolicyTab';
import { PayrollCycleTab } from './PayrollCycleTab';
import { HolidayListTab } from './HolidayListTab';
import { OtManagementTab } from './OtManagementTab';
import { SalaryComponentsTab } from './SalaryComponentsTab';
import { LeaveConfigurationTab } from './LeaveConfigurationTab';
import { DeductionsPenaltiesTab } from './DeductionsPenaltiesTab';

export type PayrollConfigSubTab =
  | 'attendance_policy'
  | 'cycle'
  | 'holidays'
  | 'ot'
  | 'salary_components'
  | 'leave_config'
  | 'deductions';

export const PayrollConfigurationTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<PayrollConfigSubTab>('attendance_policy');

  const subTabs = [
    { id: 'attendance_policy' as const, label: 'Attendance Policy', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'cycle' as const, label: 'Payroll Cycle', icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: 'holidays' as const, label: 'Holiday List', icon: <CalendarDays className="w-3.5 h-3.5" /> },
    { id: 'ot' as const, label: 'OT Management', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'salary_components' as const, label: 'Salary Components', icon: <Coins className="w-3.5 h-3.5" /> },
    { id: 'leave_config' as const, label: 'Leave Configuration', icon: <CalendarCheck className="w-3.5 h-3.5" /> },
    { id: 'deductions' as const, label: 'Deductions & Penalties', icon: <Scale className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Submodule Segmented Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl scrollbar-none">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === tab.id
                ? 'bg-brand-600 text-white shadow-md shadow-brand-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Submodule Content */}
      <div className="animate-in fade-in duration-200">
        {activeSubTab === 'attendance_policy' && <AttendancePolicyTab />}
        {activeSubTab === 'cycle' && <PayrollCycleTab />}
        {activeSubTab === 'holidays' && <HolidayListTab />}
        {activeSubTab === 'ot' && <OtManagementTab />}
        {activeSubTab === 'salary_components' && <SalaryComponentsTab />}
        {activeSubTab === 'leave_config' && <LeaveConfigurationTab />}
        {activeSubTab === 'deductions' && <DeductionsPenaltiesTab />}
      </div>
    </div>
  );
};
