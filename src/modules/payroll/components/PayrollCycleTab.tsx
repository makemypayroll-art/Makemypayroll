// MODULE 10 SUBMODULE 1: Payroll Cycle Configuration
import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Users,
  Clock,
  Info,
  ShieldCheck,
  Check,
  X,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { PayrollCycle } from '../../../database/schema';
import { PayrollCycleService } from '../../../services/payroll/payrollCycleService';
import { EmployeeService } from '../../../services/employeeService';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Table, Column } from '../../../components/common/Table';
import { Modal } from '../../../components/common/Modal';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';
import { formatDate } from '../../../utils/dateUtils';

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
  const [formData, setFormData] = useState({
    name: '',
    startDay: 1,
    endDay: 31,
    isDefault: false,
    status: 'Active' as 'Active' | 'Inactive',
    description: '',
  });

  const handleOpenAddModal = () => {
    setEditingCycle(null);
    setFormData({
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
      name: cycle.name,
      startDay: cycle.startDay,
      endDay: cycle.endDay,
      isDefault: !!cycle.isDefault,
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

    const start = Number(formData.startDay);
    const end = Number(formData.endDay);

    if (isNaN(start) || start < 1 || start > 31) {
      alert('Cycle Start Day must be between 1 and 31.');
      return;
    }
    if (isNaN(end) || end < 1 || end > 31) {
      alert('Cycle End Day must be between 1 and 31.');
      return;
    }

    if (editingCycle) {
      PayrollCycleService.update(
        editingCycle.id,
        {
          name: formData.name.trim(),
          startDay: start,
          endDay: end,
          isDefault: formData.isDefault,
          status: formData.status,
          description: formData.description.trim(),
        },
        currentUser.fullName
      );
      alert('Payroll Cycle updated successfully!');
    } else {
      PayrollCycleService.create(
        {
          organizationId: tenantId,
          name: formData.name.trim(),
          startDay: start,
          endDay: end,
          isDefault: formData.isDefault,
          status: formData.status,
          description: formData.description.trim(),
        },
        currentUser.fullName
      );
      alert('New Payroll Cycle created successfully!');
    }

    setIsModalOpen(false);
  };

  const handleToggleStatus = (cycle: PayrollCycle) => {
    PayrollCycleService.toggleStatus(cycle.id, currentUser.fullName);
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

  // Live calculation preview for the form
  const previewDates = PayrollCycleService.calculatePeriodDates(
    {
      id: 'preview',
      organizationId: tenantId,
      name: formData.name || 'Preview',
      startDay: Number(formData.startDay) || 1,
      endDay: Number(formData.endDay) || 31,
      status: 'Active',
      createdAt: '',
      updatedAt: '',
    },
    simYear,
    simMonth
  );

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
            <span className="font-extrabold text-sm text-slate-900">{c.name}</span>
            {c.isDefault && (
              <Badge variant="info" className="text-[10px] bg-brand-900 text-white font-bold">
                Company Default
              </Badge>
            )}
          </div>
          {c.description && <div className="text-xs text-slate-500 mt-0.5">{c.description}</div>}
        </div>
      ),
    },
    {
      key: 'period',
      header: 'Cut-off Days',
      render: (c) => (
        <div>
          <span className="font-mono font-bold text-xs bg-slate-100 text-slate-900 px-2.5 py-1 rounded-lg border border-slate-200">
            {c.startDay === 1 ? '1st to End of Month' : `${c.startDay}th to ${c.endDay}th`}
          </span>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {c.startDay === 1 ? 'Calendar Month' : 'Mid-Month Cutoff'}
          </div>
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
            <div className="font-bold text-brand-900">{p.periodLabel}</div>
            <div className="text-[10px] text-slate-500 font-mono">
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
            <span className="font-extrabold text-xs text-slate-800 font-mono">{count}</span>
            <span className="text-xs text-slate-500">workforce</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <Badge variant={c.status === 'Active' ? 'success' : 'default'}>
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
              <Button
                size="sm"
                variant="ghost"
                className="p-1.5"
                onClick={() => handleOpenEditModal(c)}
                title="Edit Payroll Cycle"
              >
                <Edit2 className="w-4 h-4 text-slate-600 hover:text-brand-800" />
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="p-1.5"
                onClick={() => handleToggleStatus(c)}
                title={c.status === 'Active' ? 'Deactivate Cycle' : 'Activate Cycle'}
              >
                {c.status === 'Active' ? (
                  <XCircle className="w-4 h-4 text-amber-600 hover:text-amber-800" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-600 hover:text-emerald-800" />
                )}
              </Button>

              {!c.isDefault && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="p-1.5"
                  onClick={() => handleDeleteCycle(c)}
                  title="Delete Cycle"
                >
                  <Trash2 className="w-4 h-4 text-rose-600 hover:text-rose-800" />
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-600" />
            Payroll Cycle Configuration
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure attendance and payroll cut-off dates for salary processing. Supports multiple active cycles per company.
          </p>
        </div>

        {(isSuperAdmin || isHR) && (
          <Button
            size="sm"
            variant="primary"
            onClick={handleOpenAddModal}
            leftIcon={<Plus className="w-4 h-4" />}
            className="bg-brand-600 hover:bg-brand-500 font-bold shadow-sm"
          >
            Add Payroll Cycle
          </Button>
        )}
      </div>

      {/* Cycle List Table */}
      <Table
        columns={cycleColumns}
        data={cycles}
        keyExtractor={c => c.id}
        pageSize={10}
        emptyMessage="No payroll cycles configured."
      />

      {/* Interactive Period Calculation Simulator */}
      <Card
        title="Live Payroll Period Date Calculation Simulator"
        subtitle="Verify how any configured cycle resolves attendance start & end dates across month and leap-year boundaries"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-5 space-y-3">
            <Select
              label="Test Payroll Cycle"
              value={simCycleId}
              onChange={e => setSimCycleId(e.target.value)}
            >
              {cycles.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.startDay}th to {c.endDay}th)
                </option>
              ))}
            </Select>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Target Year"
                value={simYear}
                onChange={e => setSimYear(Number(e.target.value))}
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026 (Current)</option>
                <option value={2027}>2027</option>
                <option value={2028}>2028 (Leap Year)</option>
              </Select>

              <Select
                label="Target Month"
                value={simMonth}
                onChange={e => setSimMonth(Number(e.target.value))}
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
              </Select>
            </div>
          </div>

          <div className="md:col-span-7 bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-3 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Calculated Payroll Attendance Span
              </span>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                {simResult?.totalDays} Calendar Days
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-lg font-black text-brand-300">
                {simResult?.periodLabel}
              </div>
              <div className="text-xs font-mono text-slate-300 flex items-center gap-2">
                <span>Start: <strong className="text-white">{simResult?.startDate}</strong></span>
                <ArrowRight className="w-3 h-3 text-slate-500" />
                <span>End: <strong className="text-white">{simResult?.endDate}</strong></span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-2 leading-relaxed">
              When processing payroll for employees on this cycle, attendance records strictly between{' '}
              <span className="text-white font-mono">{simResult?.startDate}</span> and{' '}
              <span className="text-white font-mono">{simResult?.endDate}</span> will be fetched and processed into LOP, Present, and Overtime values.
            </div>
          </div>
        </div>
      </Card>

      {/* Add / Edit Payroll Cycle Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCycle ? `Edit Payroll Cycle: ${editingCycle.name}` : 'Create New Payroll Cycle'}
        subtitle="Specify cutoff days and period configuration"
        size="lg"
      >
        <form onSubmit={handleSaveCycle} className="space-y-4">
          <Input
            label="Payroll Cycle Name *"
            placeholder="e.g. Monthly Standard (1st to 30th/31st), Mid-Month (20th to 19th)"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Cycle Start Day (1 – 31) *"
              type="number"
              min={1}
              max={31}
              value={formData.startDay}
              onChange={e => setFormData({ ...formData, startDay: Number(e.target.value) })}
              required
            />
            <Input
              label="Cycle End Day (1 – 31) *"
              type="number"
              min={1}
              max={31}
              value={formData.endDay}
              onChange={e => setFormData({ ...formData, endDay: Number(e.target.value) })}
              required
            />
          </div>

          {/* Live Preview Box */}
          <div className="p-3.5 bg-brand-50 rounded-xl border border-brand-200 text-xs text-brand-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              Live Resolution Preview:
            </div>
            <div className="font-mono font-bold text-brand-950">
              {previewDates.periodLabel} ({previewDates.totalDays} Days)
            </div>
            <div className="text-[10px] text-brand-700 font-mono">
              Date Filter: {previewDates.startDate} → {previewDates.endDate}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Cycle Status"
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value as any })}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Select>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="isDefaultCycle"
                checked={formData.isDefault}
                onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
              />
              <label htmlFor="isDefaultCycle" className="text-xs font-bold text-slate-700 cursor-pointer">
                Set as Company Default Cycle
              </label>
            </div>
          </div>

          <Input
            label="Description / Notes"
            placeholder="e.g. Standard attendance cutoff cycle for corporate employees"
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
          />

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingCycle ? 'Update Cycle' : 'Create Cycle'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
