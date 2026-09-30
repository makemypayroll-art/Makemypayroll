// ====================================================================
// Payroll Configuration Submodule: Salary Components (Earning Rules)
// ====================================================================

import React, { useState } from 'react';
import {
  Coins,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Percent,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { SalaryComponent, SalaryComponentType, SalaryCalculationMethod } from '../../../database/schema';
import { SalaryComponentService } from '../../../services/payroll/salaryComponentService';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Table, Column } from '../../../components/common/Table';
import { Modal } from '../../../components/common/Modal';
import { formatCurrencyINR } from '../../../utils/dateUtils';

export const SalaryComponentsTab: React.FC = () => {
  const { currentUser, isSuperAdmin, isHR, activeTenant } = useAuth();
  const tenantId = activeTenant?.tenantId || 'NP-000001';

  const [version, setVersion] = useState(0);
  const components = SalaryComponentService.getAll(tenantId);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<SalaryComponent | null>(null);

  // Form State
  const [formData, setFormData] = useState<Omit<SalaryComponent, 'id' | 'createdAt' | 'updatedAt'>>({
    organizationId: tenantId,
    name: '',
    componentType: 'Allowance',
    calculationMethod: 'FIXED',
    value: 2000,
    isRecurring: true,
    isTaxable: true,
    isPfApplicable: false,
    isEsiApplicable: false,
    payslipDisplayName: '',
    status: 'Active',
    description: '',
  });

  const handleOpenAdd = () => {
    setEditingComponent(null);
    setFormData({
      organizationId: tenantId,
      name: '',
      componentType: 'Allowance',
      calculationMethod: 'FIXED',
      value: 2000,
      isRecurring: true,
      isTaxable: true,
      isPfApplicable: false,
      isEsiApplicable: false,
      payslipDisplayName: '',
      status: 'Active',
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (comp: SalaryComponent) => {
    setEditingComponent(comp);
    setFormData({
      organizationId: comp.organizationId || tenantId,
      name: comp.name,
      componentType: comp.componentType,
      calculationMethod: comp.calculationMethod,
      value: comp.value,
      isRecurring: comp.isRecurring,
      isTaxable: comp.isTaxable,
      isPfApplicable: comp.isPfApplicable,
      isEsiApplicable: comp.isEsiApplicable,
      payslipDisplayName: comp.payslipDisplayName || comp.name,
      status: comp.status,
      description: comp.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Component Name is required.');
      return;
    }

    try {
      if (editingComponent) {
        SalaryComponentService.update(
          editingComponent.id,
          {
            ...formData,
            payslipDisplayName: formData.payslipDisplayName.trim() || formData.name.trim(),
          },
          currentUser?.fullName
        );
      } else {
        SalaryComponentService.create(
          {
            ...formData,
            organizationId: tenantId,
            payslipDisplayName: formData.payslipDisplayName.trim() || formData.name.trim(),
          },
          currentUser?.fullName
        );
      }

      setIsModalOpen(false);
      setVersion(v => v + 1);
    } catch (err: any) {
      alert(err.message || 'Failed to save salary component.');
    }
  };

  const handleDelete = (comp: SalaryComponent) => {
    if (!window.confirm(`Are you sure you want to delete salary component "${comp.name}"?`)) {
      return;
    }

    const res = SalaryComponentService.delete(comp.id, tenantId, currentUser?.fullName);
    if (res.success) {
      setVersion(v => v + 1);
    } else {
      alert(res.message);
    }
  };

  const columns: Column<SalaryComponent>[] = [
    {
      key: 'name',
      header: 'Component Name & Type',
      render: (c) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-900 tracking-tight">{c.name}</span>
            <Badge variant="purple" size="sm" className="bg-purple-50 text-purple-800 border border-purple-200/80 font-semibold text-[10px]">
              {c.componentType}
            </Badge>
          </div>
          <div className="text-[11px] text-slate-500 font-normal">
            Display: <span className="font-mono text-slate-600 font-medium">{c.payslipDisplayName || c.name}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'calc',
      header: 'Calculation & Value',
      render: (c) => (
        <div className="font-mono text-xs">
          {c.calculationMethod === 'FIXED' && (
            <span className="text-emerald-700 font-bold">{formatCurrencyINR(c.value)} Fixed</span>
          )}
          {c.calculationMethod === 'PERCENT_BASIC' && (
            <span className="text-brand-700 font-bold">{c.value}% of Basic Salary</span>
          )}
          {c.calculationMethod === 'PERCENT_GROSS' && (
            <span className="text-purple-700 font-bold">{c.value}% of Gross Salary</span>
          )}
        </div>
      ),
    },
    {
      key: 'compliance',
      header: 'Statutory & Tax Rules',
      render: (c) => (
        <div className="flex flex-wrap gap-1">
          <Badge
            variant={c.isTaxable ? 'warning' : 'default'}
            size="sm"
            className={c.isTaxable ? 'bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-semibold' : 'bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-semibold'}
          >
            {c.isTaxable ? 'Taxable' : 'Tax Exempt'}
          </Badge>
          {c.isPfApplicable && (
            <Badge variant="purple" size="sm" className="bg-purple-50 text-purple-800 border-purple-200 text-[10px] font-semibold">
              PF Base
            </Badge>
          )}
          {c.isEsiApplicable && (
            <Badge variant="info" size="sm" className="bg-sky-50 text-sky-800 border-sky-200 text-[10px] font-semibold">
              ESI Base
            </Badge>
          )}
          <Badge
            variant={c.isRecurring ? 'success' : 'outline'}
            size="sm"
            className={c.isRecurring ? 'bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-semibold' : 'text-slate-600 border-slate-200 text-[10px] font-semibold'}
          >
            {c.isRecurring ? 'Recurring' : 'One-Time'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <Badge
          variant={c.status === 'Active' ? 'success' : 'danger'}
          size="sm"
          className={c.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px]' : 'bg-rose-50 text-rose-700 border-rose-200 font-bold text-[10px]'}
        >
          {c.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenEdit(c)}
            className="h-7 px-2.5 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-700 hover:text-slate-900"
          >
            <Edit2 className="w-3.5 h-3.5 mr-1 text-slate-500" />
            <span>Edit</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(c)}
            className="h-7 px-2.5 text-xs font-semibold border-rose-200 hover:bg-rose-50 text-rose-700 hover:border-rose-300"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-500" />
            <span>Delete</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-400 shadow-inner">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">Salary Components</h2>
            <div className="text-xs text-slate-400 font-mono">
              {components.length} active earnings & allowance rules
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
          <span>Add Salary Component</span>
        </Button>
      </div>

      {/* Component Master Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <Table
          data={components}
          columns={columns}
          keyExtractor={c => c.id}
          emptyMessage="No salary components configured."
          className="border-none shadow-none rounded-none"
        />
      </div>

      {/* Add / Edit Component Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingComponent ? 'Edit Salary Component' : 'Create Salary Component'}
        >
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Component Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Performance Incentive, Travel Allowance"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-brand-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Component Type</label>
                <select
                  value={formData.componentType}
                  onChange={e => setFormData({ ...formData, componentType: e.target.value as SalaryComponentType })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-brand-500 focus:outline-none"
                >
                  <option value="Earning">Earning (Standard Regular)</option>
                  <option value="Allowance">Allowance (Conveyance / Shift)</option>
                  <option value="Incentive">Incentive (Performance Linked)</option>
                  <option value="Bonus">Bonus (Annual / Festive)</option>
                  <option value="Other Earning">Other Earning</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Calculation Method</label>
                <select
                  value={formData.calculationMethod}
                  onChange={e => setFormData({ ...formData, calculationMethod: e.target.value as SalaryCalculationMethod })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-brand-500 focus:outline-none"
                >
                  <option value="FIXED">Fixed Amount (₹ Flat Monthly)</option>
                  <option value="PERCENT_BASIC">Percentage of Basic Salary (%)</option>
                  <option value="PERCENT_GROSS">Percentage of Gross Salary (%)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Default Value ({formData.calculationMethod === 'FIXED' ? '₹ Amount' : '% Percent'}) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step={formData.calculationMethod === 'FIXED' ? '100' : '0.5'}
                  value={formData.value}
                  onChange={e => setFormData({ ...formData, value: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono font-bold focus:border-brand-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Payslip Display Name</label>
                <input
                  type="text"
                  value={formData.payslipDisplayName}
                  onChange={e => setFormData({ ...formData, payslipDisplayName: e.target.value })}
                  placeholder="Defaults to component name"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-brand-500 focus:outline-none"
                >
                  <option value="Active">Active (Eligible for Payroll Runs)</option>
                  <option value="Inactive">Inactive (Suspended)</option>
                </select>
              </div>
            </div>

            {/* Checkboxes for Compliance */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={e => setFormData({ ...formData, isRecurring: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-600"
                />
                <span>Recurring Every Month</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.isTaxable}
                  onChange={e => setFormData({ ...formData, isTaxable: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-600"
                />
                <span>Taxable under Income Tax</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.isPfApplicable}
                  onChange={e => setFormData({ ...formData, isPfApplicable: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-600"
                />
                <span>Include in PF Wage Base</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.isEsiApplicable}
                  onChange={e => setFormData({ ...formData, isEsiApplicable: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-600"
                />
                <span>Include in ESI Gross Wage</span>
              </label>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Description / Purpose</label>
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
                {editingComponent ? 'Save Changes' : 'Create Component'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
