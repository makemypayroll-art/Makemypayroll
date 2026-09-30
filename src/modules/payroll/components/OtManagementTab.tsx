// ====================================================================
// Payroll Configuration Submodule: OT Management (Centralized Overtime)
// ====================================================================

import React, { useState } from 'react';
import {
  Clock,
  Save,
  CheckCircle2,
  AlertCircle,
  Percent,
  Coins,
  ShieldCheck,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { OvertimeConfig } from '../../../database/schema';
import { PayrollOvertimeConfigService } from '../../../services/payroll/payrollOvertimeConfigService';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { formatCurrencyINR } from '../../../utils/dateUtils';

export const OtManagementTab: React.FC = () => {
  const { currentUser, isSuperAdmin, isHR, activeTenant } = useAuth();
  const tenantId = activeTenant?.tenantId || 'NP-000001';

  const [config, setConfig] = useState<OvertimeConfig>(() =>
    PayrollOvertimeConfigService.getConfig(tenantId)
  );

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Simulation state
  const [simHourlyRate, setSimHourlyRate] = useState(250);
  const [simOtHours, setSimOtHours] = useState(10);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = PayrollOvertimeConfigService.updateConfig(
        tenantId,
        config,
        currentUser?.fullName
      );
      setConfig(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save Overtime settings.');
    }
  };

  // Compute live simulated payout
  const simEffectiveRate =
    config.calculationMethod === 'FIXED_PER_HOUR'
      ? config.fixedAmountPerHour
      : config.calculationMethod === 'FIXED_PER_DAY'
      ? Math.round(config.fixedAmountPerDay / 8)
      : Math.round(simHourlyRate * config.multiplier);

  const simTotalPay = config.isEnabled ? Math.round(simOtHours * simEffectiveRate) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 shadow-inner">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">Overtime (OT) Management</h2>
            <div className="text-xs text-slate-400 font-mono">
              Status: {config.isEnabled ? 'Active & Payable' : 'Disabled'} • Method: {config.calculationMethod}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {savedSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Saved Successfully</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Main Master Switch Card */}
        <Card className="bg-slate-900 border-slate-800 p-5 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-white">Enable Overtime Processing</span>
                <Badge variant={config.isEnabled ? 'success' : 'danger'} className="text-[10px]">
                  {config.isEnabled ? 'ACTIVE' : 'MUTED'}
                </Badge>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                When disabled, the payroll calculation engine evaluates ₹0 overtime pay across all employee runs.
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.isEnabled}
                onChange={e => setConfig({ ...config, isEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-12 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
            </label>
          </div>
        </Card>

        {/* Configuration Grid */}
        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-opacity ${!config.isEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* Section 1: OT Calculation Method & Multiplier */}
          <Card className="bg-slate-900 border-slate-800 p-5 space-y-4 shadow-xl lg:col-span-2">
            <h3 className="text-xs font-black uppercase text-brand-400 tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
              <Coins className="w-4 h-4" />
              <span>Calculation Method & Multiplier</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  id: 'MULTIPLIER',
                  label: 'Hourly Multiplier',
                  desc: 'Multiplies base hourly wage (e.g. 1.5x / 2.0x)',
                },
                {
                  id: 'FIXED_PER_HOUR',
                  label: 'Fixed Amount / Hour',
                  desc: 'Flat rupee rate per logged OT hour',
                },
                {
                  id: 'FIXED_PER_DAY',
                  label: 'Fixed Amount / Day',
                  desc: 'Flat daily rate pro-rated across shift hours',
                },
              ].map(method => (
                <button
                  type="button"
                  key={method.id}
                  onClick={() => setConfig({ ...config, calculationMethod: method.id as any })}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    config.calculationMethod === method.id
                      ? 'bg-brand-950/50 border-brand-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs text-white">{method.label}</div>
                  <div className="text-[11px] text-slate-400 mt-1">{method.desc}</div>
                </button>
              ))}
            </div>

            {/* Dynamic Value Input */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {config.calculationMethod === 'MULTIPLIER' && (
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">
                    Overtime Multiplier Rate <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="1.0"
                      max="5.0"
                      value={config.multiplier}
                      onChange={e => setConfig({ ...config, multiplier: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono font-bold focus:border-brand-500 focus:outline-none text-xs"
                      required
                    />
                    <div className="flex gap-1.5">
                      {[1.5, 2.0, 2.5].map(m => (
                        <Button
                          type="button"
                          key={m}
                          variant="outline"
                          size="sm"
                          onClick={() => setConfig({ ...config, multiplier: m })}
                          className={`text-xs font-mono font-bold h-9 px-2.5 border-slate-800 ${
                            config.multiplier === m ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {m}x
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {config.calculationMethod === 'FIXED_PER_HOUR' && (
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">
                    Fixed Hourly Rate (₹) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="10"
                    value={config.fixedAmountPerHour}
                    onChange={e => setConfig({ ...config, fixedAmountPerHour: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono font-bold focus:border-brand-500 focus:outline-none text-xs"
                    required
                  />
                </div>
              )}

              {config.calculationMethod === 'FIXED_PER_DAY' && (
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">
                    Fixed Full-Day OT Rate (₹) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="100"
                    value={config.fixedAmountPerDay}
                    onChange={e => setConfig({ ...config, fixedAmountPerDay: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono font-bold focus:border-brand-500 focus:outline-none text-xs"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1">
                  Minimum OT Daily Threshold (Hours)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="4"
                  value={config.minOtHoursDaily}
                  onChange={e => setConfig({ ...config, minOtHoursDaily: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Shift Detection & Rounding */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1">OT Detection Mode</label>
                <select
                  value={config.detectionMode}
                  onChange={e => setConfig({ ...config, detectionMode: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:border-brand-500 focus:outline-none"
                >
                  <option value="after_shift">Post-Shift Only (After roster end time)</option>
                  <option value="before_shift">Pre-Shift Only (Before roster start time)</option>
                  <option value="both">Both (Pre & Post-Shift Total Hours)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1">OT Rounding Interval</label>
                <select
                  value={config.otRoundingMinutes}
                  onChange={e => setConfig({ ...config, otRoundingMinutes: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:border-brand-500 focus:outline-none"
                >
                  <option value={0}>Exact Duration (No Rounding)</option>
                  <option value={15}>Nearest 15 Minutes</option>
                  <option value={30}>Nearest 30 Minutes</option>
                  <option value={60}>Nearest Full Hour (60 Min)</option>
                </select>
              </div>
            </div>

            {/* Threshold Limits */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1">Max Daily OT Limit (Hours)</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={config.maxDailyOtHours}
                  onChange={e => setConfig({ ...config, maxDailyOtHours: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1">Max Monthly OT Limit (Hours)</label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={config.maxMonthlyOtHours}
                  onChange={e => setConfig({ ...config, maxMonthlyOtHours: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </Card>

          {/* Section 2: Live Overtime Simulator Card */}
          <Card className="bg-slate-900 border-slate-800 p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                <Sparkles className="w-4 h-4" />
                <span>OT Payout Simulator</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Base Hourly Wage (₹)</label>
                  <input
                    type="number"
                    value={simHourlyRate}
                    onChange={e => setSimHourlyRate(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Recorded OT Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={simOtHours}
                    onChange={e => setSimOtHours(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Effective Hourly Rate:</span>
                    <span className="text-white font-bold">{formatCurrencyINR(simEffectiveRate)}/h</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Active Multiplier:</span>
                    <span className="text-cyan-400 font-bold">{config.multiplier}x</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-800 font-bold text-sm text-emerald-400">
                    <span>Calculated Pay:</span>
                    <span>{formatCurrencyINR(simTotalPay)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold h-10 shadow-lg shadow-brand-950 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Save OT Configuration</span>
              </Button>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
};
