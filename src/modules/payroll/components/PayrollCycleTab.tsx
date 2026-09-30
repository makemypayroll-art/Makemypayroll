// ====================================================================
// Payroll Configuration Submodule: Payroll Cycle (Cut-off & Calculation)
// ====================================================================

import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  HelpCircle,
  Users,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { PayrollCycle, Employee } from '../../../database/schema';
import { PayrollCycleService } from '../../../services/payroll/payrollCycleService';
import { EmployeeService } from '../../../services/employeeService';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Table, Column } from '../../../components/common/Table';
import { Modal } from '../../../components/common/Modal';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';

export const PayrollCycleTab: React.FC = () => {
  const { currentUser, isSuperAdmin, isHR, activeTenant } = useAuth();
  const tenantId = activeTenant?.tenantId || 'NP-000001';

  // Data
  const cycles = PayrollCycleService.getAll(tenantId);
  const employees = EmployeeService.getAll();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<PayrollCycle | null>(null);

  // Simulator State
  const [simYear, setSimYear] = useState(2026);
  const [simMonth, setSimMonth] = useState(9);
  const [simCycleId, setSimCycleId] = useState<string>(cycles[0]?.id || 'cycle-001');

  // Form State
  const [formData, setFormData] = useState<Omit<PayrollCycle, 'id' | 'createdAt' | 'updatedAt'>>({
    organizationId: tenantId,
    name: '',
    startDay: 1,
    endDay: 31,
    isDefault: false,
    status: 'Active',
    description: '',
  });

  const handleOpenAddModal = () => {
    setEditingCycle(null);
    setFormData({
      organizationId: tenantId,
      name: '',
      startDay: 1,
      endDay: 31,
      isDefault: false,
      status: 'Active',
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cycle: PayrollCycle) => {
    setEditingCycle(cycle);
    setFormData({
      organizationId: cycle.organizationId || tenantId,
      name: cycle.name,
      startDay: cycle.startDay,
      endDay: cycle.endDay,
      isDefault: cycle.isDefault || false,
      status: cycle.status,
      description: cycle.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveCycle = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Payroll Cycle Name is required.');
      return;
    }

    if (formData.startDay < 1 || formData.startDay > 31 || formData.endDay < 1 || formData.endDay > 31) {
      alert('Start Day and End Day must be between 1 and 31.');
      return;
    }

    try {
      if (editingCycle) {
        PayrollCycleService.update(
          editingCycle.id,
          formData,
          currentUser.fullName
        );
      } else {
        PayrollCycleService.create(
          formData,
          currentUser.fullName
        );
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save Payroll Cycle.');
    }
  };

  const handleToggleStatus = (cycle: PayrollCycle) => {
    const nextStatus = cycle.status === 'Active' ? 'Inactive' : 'Active';
    PayrollCycleService.update(cycle.id, { status: nextStatus }, currentUser.fullName);
  };

  const handleSetDefault = (cycle: PayrollCycle) => {
    if (cycle.status !== 'Active') {
      alert('Only Active cycles can be set as Default.');
      return;
    }
    PayrollCycleService.update(cycle.id, { isDefault: true }, currentUser.fullName);
  };

  const handleDeleteCycle = (cycle: PayrollCycle) => {
    if (!confirm(`Are you sure you want to delete "${cycle.name}"?`)) return;
    const res = PayrollCycleService.delete(cycle.id, currentUser.fullName);
    if (!res.success) {
      alert(res.message);
    } else {
      alert(res.message);
    }
  };

  // Selected simulation for the test calculator widget
  const selectedSimCycle = cycles.find(c => c.id === simCycleId) || cycles[0];
  const simResult = selectedSimCycle
    ? PayrollCycleService.calculatePeriodDates(selectedSimCycle, simYear, simMonth)
    : null;

  const cycleColumns: Column<PayrollCycle>[] = [
    {
      key: 'name',
      header: 'Payroll Cycle Name',
      render: (c) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-100">{c.name}</span>
            {c.isDefault && (
              <Badge variant="info" className="text-[10px] bg-brand-900 text-white font-bold">
                Company Default
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'period',
      header: 'Cut-off Days',
      render: (c) => (
        <div>
          <span className="font-mono font-bold text-xs bg-slate-950 text-slate-200 px-2.5 py-1 rounded-lg border border-slate-800">
            {c.startDay === 1 ? '1st to End of Month' : `${c.startDay}th to ${c.endDay}th`}
          </span>
        </div>
      ),
    },
    {
      key: 'preview',
      header: 'Current Period (Sep 2026)',
      render: (c) => {
        const p = PayrollCycleService.calculatePeriodDates(c, 2026, 9);
        return (
          <div className="text-xs">
            <div className="font-bold text-brand-400">{p.periodLabel}</div>
            <div className="text-[10px] text-slate-400 font-mono">
              {p.startDate} → {p.endDate} ({p.totalDays} days)
            </div>
          </div>
        );
      },
    },
    {
      key: 'employees',
      header: 'Assigned Employees',
      render: (c) => {
        const count = employees.filter(e => e.payrollCycleId === c.id).length;
        return (
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-extrabold text-xs text-slate-200 font-mono">{count}</span>
            <span className="text-xs text-slate-400">workforce</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <Badge variant={c.status === 'Active' ? 'success' : 'default'} className="text-[10px]">
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
          {(isSuperAdmin || isHR) && (
            <>
              {!c.isDefault && c.status === 'Active' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSetDefault(c)}
                  className="h-8 px-2.5 text-xs font-bold border-slate-700 hover:bg-slate-800 text-slate-300"
                >
                  Set Default
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleToggleStatus(c)}
                className={`h-8 px-2.5 text-xs font-bold ${
                  c.status === 'Active'
                    ? 'border-amber-900/40 text-amber-400 hover:bg-amber-950/40'
                    : 'border-emerald-900/40 text-emerald-400 hover:bg-emerald-950/40'
                }`}
              >
                {c.status === 'Active' ? 'Deactivate' : 'Activate'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenEditModal(c)}
                className="h-8 px-2.5 text-xs font-bold border-slate-700 hover:bg-slate-800 text-slate-200"
              >
                <Edit2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Edit
              </Button>
              {!c.isDefault && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteCycle(c)}
                  className="h-8 px-2.5 text-xs font-bold border-rose-900/50 hover:bg-rose-950/50 text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-400" />
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-950 border border-brand-800 flex items-center justify-center text-brand-400 shadow-inner">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">Payroll Cycle</h2>
            <div className="text-xs text-slate-400 font-mono">
              {cycles.length} active cycle definitions
            </div>
          </div>
        </div>

        {(isSuperAdmin || isHR) && (
          <Button
            size="sm"
            variant="primary"
            onClick={handleOpenAddModal}
            className="text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-950"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>Add Payroll Cycle</span>
          </Button>
        )}
      </div>

      {/* Cycle List Table */}
      <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
        <Table
          columns={cycleColumns}
          data={cycles}
          keyExtractor={c => c.id}
          pageSize={10}
          emptyMessage="No payroll cycles configured."
        />
      </Card>

      {/* Interactive Period Calculation Simulator */}
      <Card className="bg-slate-900 border-slate-800 p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="text-xs font-black uppercase text-brand-400 tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>Period Date Calculation Simulator</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-5 space-y-3">
            <div>
              <label className="block text-slate-400 text-xs font-semibold mb-1">Test Payroll Cycle</label>
              <select
                value={simCycleId}
                onChange={e => setSimCycleId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:border-brand-500 focus:outline-none"
              >
                {cycles.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.startDay}th to {c.endDay}th)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1">Target Year</label>
                <select
                  value={simYear}
                  onChange={e => setSimYear(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:border-brand-500 focus:outline-none"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                  <option value={2028}>2028 (Leap Year)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1">Target Month</label>
                <select
                  value={simMonth}
                  onChange={e => setSimMonth(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:border-brand-500 focus:outline-none"
                >
                  {[
                    { m: 1, n: 'Jan (Year Boundary)' },
                    { m: 2, n: 'Feb (28/29 Days)' },
                    { m: 3, n: 'Mar (31 Days)' },
                    { m: 4, n: 'Apr (30 Days)' },
                    { m: 5, n: 'May (31 Days)' },
                    { m: 6, n: 'Jun (30 Days)' },
                    { m: 7, n: 'Jul (31 Days)' },
                    { m: 8, n: 'Aug (31 Days)' },
                    { m: 9, n: 'Sep (30 Days)' },
                    { m: 10, n: 'Oct (31 Days)' },
                    { m: 11, n: 'Nov (30 Days)' },
                    { m: 12, n: 'Dec (Year End)' },
                  ].map(item => (
                    <option key={item.m} value={item.m}>
                      {item.n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="md:col-span-7 bg-slate-950 text-white p-5 rounded-2xl border border-slate-800 space-y-3 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Calculated Date Bounds
              </span>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                {simResult?.totalDays} Calendar Days
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-base font-black text-brand-300">
                {simResult?.periodLabel}
              </div>
              <div className="text-xs font-mono text-slate-300 flex items-center gap-2">
                <span>Start: <strong className="text-white">{simResult?.startDate}</strong></span>
                <ArrowRight className="w-3 h-3 text-slate-500" />
                <span>End: <strong className="text-white">{simResult?.endDate}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Add / Edit Payroll Cycle Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingCycle ? `Edit Payroll Cycle: ${editingCycle.name}` : 'Create New Payroll Cycle'}
        >
          <form onSubmit={handleSaveCycle} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">
                Payroll Cycle Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Monthly Standard (1st to 30th/31st), Mid-Month (20th to 19th)"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-brand-500 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Cycle Start Day (1 – 31) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={formData.startDay}
                  onChange={e => setFormData({ ...formData, startDay: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:border-brand-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Cycle End Day (1 – 31) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={formData.endDay}
                  onChange={e => setFormData({ ...formData, endDay: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:border-brand-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-950 border border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-600"
                />
                <span>Set as Company Default Cycle</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.status === 'Active'}
                  onChange={e => setFormData({ ...formData, status: e.target.checked ? 'Active' : 'Inactive' })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-600"
                />
                <span>Active</span>
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
                {editingCycle ? 'Save Changes' : 'Create Cycle'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
