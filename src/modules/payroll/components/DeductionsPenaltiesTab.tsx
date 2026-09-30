// ====================================================================
// Payroll Configuration Submodule: Deductions & Penalties
// ====================================================================

import React, { useState } from 'react';
import {
  ShieldAlert,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Scale,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { DeductionPolicy, DeductionType, DeductionCalculationMethod } from '../../../database/schema';
import { DeductionPolicyService } from '../../../services/payroll/deductionPolicyService';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Table, Column } from '../../../components/common/Table';
import { Modal } from '../../../components/common/Modal';
import { formatCurrencyINR } from '../../../utils/dateUtils';

export const DeductionsPenaltiesTab: React.FC = () => {
  const { currentUser, isSuperAdmin, isHR, activeTenant } = useAuth();
  const tenantId = activeTenant?.tenantId || 'NP-000001';

  const [version, setVersion] = useState(0);
  const deductions = DeductionPolicyService.getAll(tenantId);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<DeductionPolicy | null>(null);

  // Form State
  const [formData, setFormData] = useState<Omit<DeductionPolicy, 'id' | 'createdAt' | 'updatedAt'>>({
    organizationId: tenantId,
    name: '',
    deductionType: 'Late Coming Penalty',
    calculationMethod: 'FIXED',
    value: 100,
    isRecurring: true,
    isTaxDeductible: false,
    isAutomatic: true,
    status: 'Active',
    description: '',
  });

  const handleOpenAdd = () => {
    setEditingPolicy(null);
    setFormData({
      organizationId: tenantId,
      name: '',
      deductionType: 'Late Coming Penalty',
      calculationMethod: 'FIXED',
      value: 100,
      isRecurring: true,
      isTaxDeductible: false,
      isAutomatic: true,
      status: 'Active',
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (policy: DeductionPolicy) => {
    setEditingPolicy(policy);
    setFormData({
      organizationId: policy.organizationId || tenantId,
      name: policy.name,
      deductionType: policy.deductionType,
      calculationMethod: policy.calculationMethod,
      value: policy.value,
      isRecurring: policy.isRecurring,
      isTaxDeductible: policy.isTaxDeductible,
      isAutomatic: policy.isAutomatic,
      status: policy.status,
      description: policy.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Deduction Name is required.');
      return;
    }

    try {
      if (editingPolicy) {
        DeductionPolicyService.update(
          editingPolicy.id,
          formData,
          currentUser?.fullName
        );
      } else {
        DeductionPolicyService.create(
          {
            ...formData,
            organizationId: tenantId,
          },
          currentUser?.fullName
        );
      }

      setIsModalOpen(false);
      setVersion(v => v + 1);
    } catch (err: any) {
      alert(err.message || 'Failed to save deduction policy.');
    }
  };

  const handleDelete = (policy: DeductionPolicy) => {
    if (!window.confirm(`Are you sure you want to delete deduction policy "${policy.name}"?`)) {
      return;
    }

    const res = DeductionPolicyService.delete(policy.id, tenantId, currentUser?.fullName);
    if (res.success) {
      setVersion(v => v + 1);
    } else {
      alert(res.message);
    }
  };

  const columns: Column<DeductionPolicy>[] = [
    {
      key: 'name',
      header: 'Deduction Name & Type',
      render: (d) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-100">{d.name}</span>
            <Badge variant="danger" className="text-[10px] bg-rose-950 text-rose-300 border-rose-800">
              {d.deductionType}
            </Badge>
          </div>
          {d.description && <div className="text-xs text-slate-400 mt-0.5">{d.description}</div>}
        </div>
      ),
    },
    {
      key: 'calc',
      header: 'Calculation Method & Value',
      render: (d) => (
        <div className="font-mono text-xs">
          {d.calculationMethod === 'FIXED' && (
            <span className="text-rose-400 font-bold">-{formatCurrencyINR(d.value)} Fixed</span>
          )}
          {d.calculationMethod === 'PERCENT_BASIC' && (
            <span className="text-amber-400 font-bold">-{d.value}% of Basic Salary</span>
          )}
          {d.calculationMethod === 'PERCENT_GROSS' && (
            <span className="text-amber-400 font-bold">-{d.value}% of Gross Salary</span>
          )}
          {d.calculationMethod === 'DAYS_LOP' && (
            <span className="text-purple-400 font-bold">-{d.value}x Day Gross per occurrence</span>
          )}
        </div>
      ),
    },
    {
      key: 'trigger',
      header: 'Trigger & Execution',
      render: (d) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={d.isAutomatic ? 'success' : 'default'} className="text-[10px]">
            {d.isAutomatic ? 'Auto-Triggered by Policy' : 'Manual Assignment'}
          </Badge>
          <Badge variant={d.isRecurring ? 'purple' : 'outline'} className="text-[10px]">
            {d.isRecurring ? 'Recurring' : 'One-Time'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (d) => (
        <Badge variant={d.status === 'Active' ? 'success' : 'danger'} className="text-[10px]">
          {d.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (d) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenEdit(d)}
            className="h-8 px-2.5 text-xs font-bold border-slate-700 hover:bg-slate-800 text-slate-200"
          >
            <Edit2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
            <span>Edit</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(d)}
            className="h-8 px-2.5 text-xs font-bold border-rose-900/50 hover:bg-rose-950/50 text-rose-300"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-400" />
            <span>Delete</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400 shadow-inner">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">Deductions & Penalties</h2>
            <div className="text-xs text-slate-400 font-mono">
              {deductions.length} configured penalty and recovery rules
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenAdd}
          className="text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-950"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          <span>Add Deduction</span>
        </Button>
      </div>

      {/* Deduction Table */}
      <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
        <Table
          data={deductions}
          columns={columns}
          keyExtractor={d => d.id}
          emptyMessage="No deductions or penalties configured."
        />
      </Card>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingPolicy ? 'Edit Deduction Policy' : 'Create Deduction Policy'}
        >
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Deduction Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Late Coming Penalty, Asset Recovery"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-brand-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Deduction Type</label>
                <select
                  value={formData.deductionType}
                  onChange={e => setFormData({ ...formData, deductionType: e.target.value as DeductionType })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-brand-500 focus:outline-none"
                >
                  <option value="Late Coming Penalty">Late Coming Penalty (Attendance Linked)</option>
                  <option value="Attendance Penalty">Attendance Penalty (Absenteeism / Violation)</option>
                  <option value="Unpaid Leave Deduction">Unpaid Leave Deduction (LOP Pro-rata)</option>
                  <option value="Damage/Recovery">Damage / Asset Loss Recovery</option>
                  <option value="Loan Deduction">Loan Deduction (EMI Recovery)</option>
                  <option value="Advance Recovery">Salary Advance Recovery</option>
                  <option value="Other Deduction">Other Deduction</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Calculation Method</label>
                <select
                  value={formData.calculationMethod}
                  onChange={e => setFormData({ ...formData, calculationMethod: e.target.value as DeductionCalculationMethod })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-brand-500 focus:outline-none"
                >
                  <option value="FIXED">Fixed Amount (₹ Flat per occurrence/month)</option>
                  <option value="PERCENT_BASIC">Percentage of Basic Salary (%)</option>
                  <option value="PERCENT_GROSS">Percentage of Gross Salary (%)</option>
                  <option value="DAYS_LOP">Days Pro-rata LOP (e.g. 0.5x or 1.0x day wage)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Default Value ({formData.calculationMethod === 'FIXED' ? '₹ Amount' : formData.calculationMethod === 'DAYS_LOP' ? 'Day Ratio (e.g. 0.5)' : '% Percent'}) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step={formData.calculationMethod === 'FIXED' ? '50' : '0.1'}
                  value={formData.value}
                  onChange={e => setFormData({ ...formData, value: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono font-bold focus:border-brand-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-brand-500 focus:outline-none"
                >
                  <option value="Active">Active (Eligible for Payroll Processing)</option>
                  <option value="Inactive">Inactive (Suspended)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Execution Trigger</label>
                <select
                  value={formData.isAutomatic ? 'auto' : 'manual'}
                  onChange={e => setFormData({ ...formData, isAutomatic: e.target.value === 'auto' })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-brand-500 focus:outline-none"
                >
                  <option value="auto">Automatic (Evaluated by Policy Engine)</option>
                  <option value="manual">Manual (Assigned by Administrator)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-950 border border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={e => setFormData({ ...formData, isRecurring: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-600"
                />
                <span>Recurring Monthly Deduction</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.isTaxDeductible}
                  onChange={e => setFormData({ ...formData, isTaxDeductible: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-600"
                />
                <span>Tax Deductible Component</span>
              </label>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Description / Notes</label>
              <textarea
                value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" className="bg-brand-600 text-white font-bold">
                {editingPolicy ? 'Save Changes' : 'Create Deduction'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
