import React from 'react';
import { Layers, Check, Shield, Zap, Sparkles, Building2, Users } from 'lucide-react';
import { PlanService, SaaSPlanDefinition } from '../../services/planService';
import { PageHeader } from '../../components/common/PageHeader';
import { Badge } from '../../components/common/Badge';

export const PlanManagement: React.FC = () => {
  const plans = PlanService.getPlans();

  const ALL_MODULES = [
    { key: 'dashboard', name: 'Executive & Client Dashboard' },
    { key: 'employees', name: 'Employee Master & Directory' },
    { key: 'attendance', name: 'Attendance & Biometric Sync' },
    { key: 'shifts', name: 'Multi-Shift Rostering' },
    { key: 'leaves', name: 'Leave Workflow & Accrual' },
    { key: 'payroll', name: 'Monthly Payroll & Tax Engine' },
    { key: 'tickets', name: 'IT & HR Helpdesk' },
    { key: 'onboarding', name: 'Candidate Onboarding Portal' },
    { key: 'inventory', name: 'Asset Inventory & Allocations' },
    { key: 'geolocation', name: 'Geo-Fencing & Maps' },
    { key: 'settings', name: 'Workspace Admin & Policies' },
  ];

  return (
    <div className="space-y-6 text-slate-100">
      <PageHeader
        title="Subscription Plans & Feature Controls"
        actions={
          <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-950/80 px-3 py-1.5 rounded-xl border border-purple-800">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>Platform-Enforced Entitlements</span>
          </div>
        }
      />

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan, idx) => (
          <div
            key={plan.id}
            className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
              plan.name === 'Growth'
                ? 'bg-gradient-to-b from-purple-950/40 via-slate-900 to-slate-900 border-purple-600/80 shadow-xl shadow-purple-950/30'
                : 'bg-slate-900/90 border-slate-800'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400">
                  Tier {idx + 1}
                </span>
                {plan.name === 'Growth' && (
                  <Badge variant="purple" className="bg-purple-900 text-purple-200 border-purple-700">
                    Most Popular
                  </Badge>
                )}
              </div>

              <div>
                <h3 className="text-lg font-black text-white">{plan.displayName}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{plan.description}</p>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">₹{plan.monthlyPricePerSeat}</span>
                  <span className="text-[11px] text-slate-400">/ employee / month</span>
                </div>
                <div className="text-[10px] text-emerald-400 font-medium">
                  ₹{plan.annualPricePerSeat} / employee billed annually
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs text-slate-300">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Capacity Range:</span>
                  <span className="font-mono font-bold text-white">{plan.minEmployees} - {plan.maxEmployees} seats</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Branch Limit:</span>
                  <span className="font-mono font-bold text-white">{plan.maxBranches} branches</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Support Level:</span>
                  <span className="font-bold text-purple-300">{plan.supportLevel}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 mt-4 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Included Features ({plan.enabledModules.length}):
              </span>
              <div className="space-y-1">
                {ALL_MODULES.map(m => {
                  const isIncluded = plan.enabledModules.includes(m.key);
                  return (
                    <div
                      key={m.key}
                      className={`flex items-center gap-1.5 text-[11px] ${
                        isIncluded ? 'text-slate-200' : 'text-slate-600 line-through'
                      }`}
                    >
                      {isIncluded ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 inline-block text-center text-slate-700">×</span>
                      )}
                      <span className="truncate">{m.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
