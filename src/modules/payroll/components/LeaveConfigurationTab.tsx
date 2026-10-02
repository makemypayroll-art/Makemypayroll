// ====================================================================
// Payroll Configuration Submodule: Leave Configuration & Entitlements
// Full CRUD for Paid & Unpaid Leave Types, Accrual Quotas, & Payroll Deduction Rules
// ====================================================================

import React, { useState } from 'react';
import {
  CalendarDays,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  ShieldAlert,
  Sparkles,
  HelpCircle,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { LeaveType } from '../../../database/schema';
import { LeavePayrollConfigService } from '../../../services/payroll/leavePayrollConfigService';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Table, Column } from '../../../components/common/Table';
import { Modal } from '../../../components/common/Modal';

export const LeaveConfigurationTab: React.FC = () => {
  const { currentUser, isSuperAdmin, isHR, activeTenant } = useAuth();
  const tenantId = activeTenant?.tenantId || 'NP-000001';

  const [version, setVersion] = useState(0);
  const leaveTypes = LeavePayrollConfigService.getAll(tenantId);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);

  // Form State
  const [formData, setFormData] = useState<Omit<LeaveType, 'id' | 'createdAt' | 'updatedAt'>>({
    organizationId: tenantId,
    name: '',
    code: '',
    description: '',
    annualQuota: 12,
    annualEntitlement: 12,
    monthlyEntitlement: 1,
    accrualFrequency: 'monthly',
    carryForwardMax: 5,
    maxCarryForwardDays: 5,
    maxBalance: 24,
    isHalfDayAllowed: true,
    requiresDoc: false,
    isPaid: true,
    status: 'Active',
    color: '#10b981',
  });

  const handleOpenAdd = () => {
    setEditingType(null);
    setFormData({
      organizationId: tenantId,
      name: '',
      code: '',
      description: '',
      annualQuota: 12,
      annualEntitlement: 12,
      monthlyEntitlement: 1,
      accrualFrequency: 'monthly',
      carryForwardMax: 5,
      maxCarryForwardDays: 5,
      maxBalance: 24,
      isHalfDayAllowed: true,
      requiresDoc: false,
      isPaid: true,
      status: 'Active',
      color: '#10b981',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (lt: LeaveType) => {
    setEditingType(lt);
    setFormData({
      organizationId: lt.organizationId || tenantId,
      name: lt.name,
      code: lt.code,
      description: lt.description || '',
      annualQuota: lt.annualQuota || 0,
      annualEntitlement: lt.annualQuota || 0,
      monthlyEntitlement: lt.monthlyEntitlement ?? Number(((lt.annualQuota || 0) / 12).toFixed(2)),
      accrualFrequency: lt.accrualFrequency || 'monthly',
      carryForwardMax: lt.carryForwardMax || 0,
      maxCarryForwardDays: lt.carryForwardMax || 0,
      maxBalance: lt.maxBalance || (lt.annualQuota * 2),
      isHalfDayAllowed: !!lt.isHalfDayAllowed,
      requiresDoc: !!lt.requiresDoc,
      isPaid: lt.isPaid !== undefined ? lt.isPaid : true,
      status: lt.status || 'Active',
      color: lt.color || (lt.isPaid ? '#10b981' : '#f59e0b'),
    });
    setIsModalOpen(true);
  };

  const handleAnnualQuotaChange = (val: number) => {
    const quota = Math.max(0, val);
    setFormData(prev => ({
      ...prev,
      annualQuota: quota,
      annualEntitlement: quota,
      monthlyEntitlement: Number((quota / 12).toFixed(2)),
      maxBalance: quota * 2,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Leave Rule Name is required.');
      return;
    }
    if (!formData.code.trim()) {
      alert('Leave Code is required (e.g. CL, SL, PL, LWP).');
      return;
    }

    try {
      if (editingType) {
        LeavePayrollConfigService.update(
          editingType.id,
          formData,
          currentUser.fullName || currentUser.email
        );
      } else {
        LeavePayrollConfigService.create(
          formData,
          currentUser.fullName || currentUser.email
        );
      }
      setIsModalOpen(false);
      setVersion(v => v + 1);
    } catch (err: any) {
      alert(`Error saving leave rule: ${err.message}`);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete leave rule "${name}"?`)) return;
    const res = LeavePayrollConfigService.delete(id, currentUser.fullName || currentUser.email);
    if (!res.success) {
      alert(res.message);
    } else {
      setVersion(v => v + 1);
    }
  };

  const paidCount = leaveTypes.filter(t => t.isPaid).length;
  const unpaidCount = leaveTypes.filter(t => !t.isPaid).length;

  const columns: Column<LeaveType>[] = [
    {
      key: 'name',
      header: 'Leave Rule & Code',
      render: (lt) => (
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm text-white"
            style={{ backgroundColor: lt.color || (lt.isPaid ? '#10b981' : '#f59e0b') }}
          >
            {lt.code}
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm">{lt.name}</div>
            <div className="text-[11px] text-slate-500 line-clamp-1">{lt.description || 'No description'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'classification',
      header: 'Classification',
      render: (lt) =>
        lt.isPaid ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Paid Leave
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            Unpaid / LWP (Deducted)
          </span>
        ),
    },
    {
      key: 'entitlement',
      header: 'Entitlement',
      render: (lt) => (
        <div className="text-xs space-y-0.5">
          <div className="font-bold text-slate-900">{lt.annualQuota} Days / Year</div>
          <div className="text-slate-500 font-medium">{lt.monthlyEntitlement || (lt.annualQuota / 12).toFixed(1)} Days / Month</div>
        </div>
      ),
    },
    {
      key: 'accrual',
      header: 'Accrual & Carry Forward',
      render: (lt) => (
        <div className="text-xs space-y-0.5">
          <div className="font-semibold text-slate-800 capitalize">{lt.accrualFrequency || 'Monthly'} Accrual</div>
          <div className="text-slate-500">Max Carry: {lt.carryForwardMax || 0} Days</div>
        </div>
      ),
    },
    {
      key: 'controls',
      header: 'Controls',
      render: (lt) => (
        <div className="flex flex-wrap gap-1">
          {lt.isHalfDayAllowed && (
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
              Half-Day
            </span>
          )}
          {lt.requiresDoc && (
            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
              Doc Req
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (lt) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
            lt.status === 'Active' || !lt.status
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          {lt.status || 'Active'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (lt) => (
        <div className="flex items-center gap-1">
          {(isSuperAdmin || isHR) && (
            <>
              <button
                onClick={() => handleOpenEdit(lt)}
                className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Edit Rule"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(lt.id, lt.name)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Delete Rule"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900">Leave Configuration & Entitlements</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {leaveTypes.length} Types
              </span>
            </div>
            <p className="text-xs text-slate-500">Configure Paid vs. Unpaid leave quotas, monthly accruals, and payroll deduction rules.</p>
          </div>
        </div>

        {(isSuperAdmin || isHR) && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAdd}
            className="text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Leave Rule</span>
          </Button>
        )}
      </div>

      {/* Core Payroll Engine Logic Architecture Card */}
      <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl border border-slate-800 shadow-md">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-black tracking-wider uppercase text-emerald-300">
            Leave Bucket &rarr; Leave Availability &rarr; Payroll Deduction Architecture
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Case 1: Paid Available
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Employee has balance &ge; 1 in their Paid Leave bucket (SL, CL, PL). Zero salary deduction applied. Payment days remain intact.
            </p>
          </div>
          <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
            <div className="font-bold text-amber-400 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Case 2: Paid Exhausted
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Employee takes Paid Leave but has 0 balance available. Excess days automatically convert to Unpaid / LOP with salary deduction.
            </p>
          </div>
          <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
            <div className="font-bold text-rose-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Case 3: Explicit Unpaid (LWP)
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Leave is classified as Unpaid / Loss of Pay. Days are deducted directly from gross salary. Paid leave balance bucket remains untouched.
            </p>
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <Card className="p-0 overflow-hidden border-slate-200 shadow-sm">
        <Table columns={columns} data={leaveTypes} keyExtractor={(lt) => lt.id} />
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingType ? `Edit Leave Rule: ${editingType.name}` : 'Create New Leave Rule'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Leave Rule Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Casual Leave (CL) or Privilege Leave (PL)"
                required
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Leave Code *</label>
              <input
                type="text"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. CL, SL, PL, LWP"
                required
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm uppercase"
              />
            </div>
          </div>

          {/* Classification: Paid vs Unpaid Toggle */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <label className="text-xs font-bold text-slate-800 block">Leave Classification & Payroll Impact *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isPaid: true, color: '#10b981' })}
                className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  formData.isPaid
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-400/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className={`w-4 h-4 ${formData.isPaid ? 'text-emerald-600' : 'text-slate-400'}`} />
                <div className="text-left">
                  <div>Paid Leave</div>
                  <div className="text-[10px] font-normal text-slate-500">0 deduction if balance exists</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, isPaid: false, annualQuota: 0, monthlyEntitlement: 0, color: '#f59e0b' })}
                className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  !formData.isPaid
                    ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-400/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <AlertCircle className={`w-4 h-4 ${!formData.isPaid ? 'text-amber-600' : 'text-slate-400'}`} />
                <div className="text-left">
                  <div>Unpaid / LWP</div>
                  <div className="text-[10px] font-normal text-slate-500">Deducts pay from gross salary</div>
                </div>
              </button>
            </div>
          </div>

          {/* Quotas & Accrual */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Annual Quota (Days)</label>
              <input
                type="number"
                value={formData.annualQuota}
                onChange={e => handleAnnualQuotaChange(Number(e.target.value))}
                min={0}
                max={365}
                disabled={!formData.isPaid}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Monthly Entitlement</label>
              <input
                type="number"
                step="0.01"
                value={formData.monthlyEntitlement}
                onChange={e => setFormData({ ...formData, monthlyEntitlement: Number(e.target.value) })}
                min={0}
                max={31}
                disabled={!formData.isPaid}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Accrual Frequency</label>
              <select
                value={formData.accrualFrequency}
                onChange={e => setFormData({ ...formData, accrualFrequency: e.target.value as any })}
                disabled={!formData.isPaid}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm cursor-pointer disabled:bg-slate-100"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual / Upfront</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Max Carry Forward (Days)</label>
              <input
                type="number"
                value={formData.carryForwardMax}
                onChange={e => setFormData({ ...formData, carryForwardMax: Number(e.target.value), maxCarryForwardDays: Number(e.target.value) })}
                min={0}
                max={100}
                disabled={!formData.isPaid}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm disabled:bg-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Max Balance Limit (Days)</label>
              <input
                type="number"
                value={formData.maxBalance}
                onChange={e => setFormData({ ...formData, maxBalance: Number(e.target.value) })}
                min={0}
                max={200}
                disabled={!formData.isPaid}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm disabled:bg-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Rule Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm cursor-pointer"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Checkbox controls */}
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isHalfDayAllowed}
                onChange={e => setFormData({ ...formData, isHalfDayAllowed: e.target.checked })}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Allow Half-Day Applications
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.requiresDoc}
                onChange={e => setFormData({ ...formData, requiresDoc: e.target.checked })}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Medical / Supporting Doc Required
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Description / Policy Details</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="e.g. Standard medical leave with doctor prescription required for more than 2 consecutive days."
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              className="text-xs font-semibold text-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-sm"
            >
              {editingType ? 'Update Leave Rule' : 'Create Leave Rule'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
