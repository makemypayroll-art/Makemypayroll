// MODULE 10 SUBMODULE 2: Attendance Policy Configuration
import React, { useState } from 'react';
import {
  Sliders,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Users,
  Clock,
  ShieldCheck,
  Percent,
  Check,
  X,
  AlertCircle,
  Info,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { AttendancePolicy } from '../../../database/schema';
import { AttendancePolicyService } from '../../../services/payroll/attendancePolicyService';
import { EmployeeService } from '../../../services/employeeService';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Table, Column } from '../../../components/common/Table';
import { Modal } from '../../../components/common/Modal';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';

export const AttendancePolicyTab: React.FC = () => {
  const { currentUser, isSuperAdmin, isHR, activeTenant } = useAuth();
  const tenantId = activeTenant?.tenantId || 'NP-000001';

  // Data
  const policies = AttendancePolicyService.getAll(tenantId);
  const employees = EmployeeService.getAll();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<AttendancePolicy | null>(null);

  // Form State
  const [formData, setFormData] = useState<Omit<AttendancePolicy, 'id' | 'createdAt' | 'updatedAt'>>({
    organizationId: tenantId,
    name: '',
    description: '',
    isDefault: false,
    status: 'Active',
    fullDayHours: 8.0,
    halfDayHours: 4.5,
    fullDayCreditToleranceMinutes: 15,
    minimumOtHoursDaily: 1.0,
    otPunchGapSeconds: 60,
    maxLeaveCarryoverDays: 10,
    enableOvertime: true,
    overtimePayScale: 1.5,
    countOutsideShiftHours: false,
    salesProductivityAttendance: false,
    otDetectionEnabled: true,
    otDetectionMode: 'after_shift',
    otWindowMinutes: 30,
    dailyLateAllowanceMinutes: 15,
    lateComingGraceMinutes: 15,
    maxMonthlyLatenessAllowed: 3,
    latePenaltyType: 'HalfDay',
    latePenaltyValue: 0.5,
    fullDayCreditLogic: 'inside_shift_only',
  });

  const handleOpenAddModal = () => {
    setEditingPolicy(null);
    setFormData({
      organizationId: tenantId,
      name: '',
      description: '',
      isDefault: false,
      status: 'Active',
      fullDayHours: 8.0,
      halfDayHours: 4.5,
      fullDayCreditToleranceMinutes: 15,
      minimumOtHoursDaily: 1.0,
      otPunchGapSeconds: 60,
      maxLeaveCarryoverDays: 10,
      enableOvertime: true,
      overtimePayScale: 1.5,
      countOutsideShiftHours: false,
      salesProductivityAttendance: false,
      otDetectionEnabled: true,
      otDetectionMode: 'after_shift',
      otWindowMinutes: 30,
      dailyLateAllowanceMinutes: 15,
      lateComingGraceMinutes: 15,
      maxMonthlyLatenessAllowed: 3,
      latePenaltyType: 'HalfDay',
      latePenaltyValue: 0.5,
      fullDayCreditLogic: 'inside_shift_only',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (policy: AttendancePolicy) => {
    setEditingPolicy(policy);
    setFormData({
      organizationId: policy.organizationId,
      name: policy.name,
      description: policy.description || '',
      isDefault: !!policy.isDefault,
      status: policy.status,
      fullDayHours: policy.fullDayHours,
      halfDayHours: policy.halfDayHours,
      fullDayCreditToleranceMinutes: policy.fullDayCreditToleranceMinutes,
      minimumOtHoursDaily: policy.minimumOtHoursDaily,
      otPunchGapSeconds: policy.otPunchGapSeconds,
      maxLeaveCarryoverDays: policy.maxLeaveCarryoverDays,
      enableOvertime: policy.enableOvertime,
      overtimePayScale: policy.overtimePayScale,
      countOutsideShiftHours: policy.countOutsideShiftHours,
      salesProductivityAttendance: policy.salesProductivityAttendance,
      otDetectionEnabled: policy.otDetectionEnabled,
      otDetectionMode: policy.otDetectionMode,
      otWindowMinutes: policy.otWindowMinutes,
      dailyLateAllowanceMinutes: policy.dailyLateAllowanceMinutes,
      lateComingGraceMinutes: policy.lateComingGraceMinutes,
      maxMonthlyLatenessAllowed: policy.maxMonthlyLatenessAllowed,
      latePenaltyType: policy.latePenaltyType,
      latePenaltyValue: policy.latePenaltyValue,
      fullDayCreditLogic: policy.fullDayCreditLogic,
    });
    setIsModalOpen(true);
  };

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Policy Name is required.');
      return;
    }

    if (formData.fullDayHours <= 0 || formData.halfDayHours <= 0) {
      alert('Working hours must be positive numbers.');
      return;
    }

    if (formData.halfDayHours >= formData.fullDayHours) {
      alert('Half Day Hours must be less than Full Day Hours.');
      return;
    }

    if (editingPolicy) {
      AttendancePolicyService.update(editingPolicy.id, formData, currentUser.fullName);
      alert('Attendance Policy updated successfully!');
    } else {
      AttendancePolicyService.create(formData, currentUser.fullName);
      alert('New Attendance Policy created successfully!');
    }

    setIsModalOpen(false);
  };

  const handleToggleStatus = (policy: AttendancePolicy) => {
    AttendancePolicyService.toggleStatus(policy.id, currentUser.fullName);
  };

  const handleDeletePolicy = (policy: AttendancePolicy) => {
    if (!confirm(`Are you sure you want to delete "${policy.name}"?`)) return;
    const res = AttendancePolicyService.delete(policy.id, currentUser.fullName);
    if (!res.success) {
      alert(res.message);
    } else {
      alert(res.message);
    }
  };

  const policyColumns: Column<AttendancePolicy>[] = [
    {
      key: 'name',
      header: 'Policy Name & Classification',
      render: (p) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-900">{p.name}</span>
            {p.isDefault && (
              <Badge variant="info" className="text-[10px] bg-brand-900 text-white font-bold">
                Company Default
              </Badge>
            )}
          </div>
          {p.description && <div className="text-xs text-slate-500 mt-0.5">{p.description}</div>}
        </div>
      ),
    },
    {
      key: 'hours',
      header: 'Full / Half Day Hours',
      render: (p) => (
        <div className="font-mono text-xs">
          <span className="font-extrabold text-slate-900">{p.fullDayHours}h</span>
          <span className="text-slate-400"> Full / </span>
          <span className="font-bold text-slate-700">{p.halfDayHours}h</span>
          <span className="text-slate-400"> Half</span>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">
            ±{p.fullDayCreditToleranceMinutes}m tolerance
          </div>
        </div>
      ),
    },
    {
      key: 'overtime',
      header: 'Overtime Policy',
      render: (p) => (
        <div>
          {p.enableOvertime ? (
            <span className="inline-flex items-center gap-1 font-bold text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              {p.overtimePayScale}x Pay Scale
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-semibold">Disabled</span>
          )}
          <div className="text-[10px] text-slate-400 mt-0.5">
            {p.enableOvertime ? `Min ${p.minimumOtHoursDaily}h/day • ${p.otDetectionMode.replace('_', ' ')}` : 'No OT accrual'}
          </div>
        </div>
      ),
    },
    {
      key: 'latePolicy',
      header: 'Late Coming Policy',
      render: (p) => (
        <div className="text-xs space-y-0.5">
          <div className="font-bold text-slate-800">
            {p.lateComingGraceMinutes}m Grace • Max {p.maxMonthlyLatenessAllowed}/month
          </div>
          <div className="text-[11px] text-amber-700">
            Penalty: {p.latePenaltyType} ({p.latePenaltyType === 'HalfDay' ? '0.5 Day LOP' : p.latePenaltyType === 'Deduction' ? `₹${p.latePenaltyValue}` : 'Warning only'})
          </div>
        </div>
      ),
    },
    {
      key: 'employees',
      header: 'Assigned Employees',
      render: (p) => {
        const count = employees.filter(e => e.attendancePolicyId === p.id).length;
        return (
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-extrabold text-xs text-slate-800 font-mono">{count}</span>
            <span className="text-xs text-slate-500">assigned</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <Badge variant={p.status === 'Active' ? 'success' : 'default'}>
          {p.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1.5">
          {(isSuperAdmin || isHR) && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="p-1.5"
                onClick={() => handleOpenEditModal(p)}
                title="Edit Attendance Policy"
              >
                <Edit2 className="w-4 h-4 text-slate-600 hover:text-brand-800" />
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="p-1.5"
                onClick={() => handleToggleStatus(p)}
                title={p.status === 'Active' ? 'Deactivate Policy' : 'Activate Policy'}
              >
                {p.status === 'Active' ? (
                  <XCircle className="w-4 h-4 text-amber-600 hover:text-amber-800" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-600 hover:text-emerald-800" />
                )}
              </Button>

              {!p.isDefault && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="p-1.5"
                  onClick={() => handleDeletePolicy(p)}
                  title="Delete Policy"
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
            <Sliders className="w-5 h-5 text-brand-600" />
            Attendance Policy Configuration
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure working hour thresholds, overtime detection multipliers, and late-coming penalty rules for payroll integration.
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
            Add Attendance Policy
          </Button>
        )}
      </div>

      {/* Policy Table */}
      <Table
        columns={policyColumns}
        data={policies}
        keyExtractor={p => p.id}
        pageSize={10}
        emptyMessage="No attendance policies configured."
      />

      {/* Add / Edit Policy Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPolicy ? `Edit Attendance Policy: ${editingPolicy.name}` : 'Create New Attendance Policy'}
        subtitle="Configure working hours, overtime, punctuality grace, and penalties"
        size="xl"
      >
        <form onSubmit={handleSavePolicy} className="space-y-6 max-h-[75vh] overflow-y-auto px-1 pr-2">
          {/* Section 1: Basic Information */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-brand-900 uppercase tracking-wider border-b pb-1">
              1. Policy Identity & General Settings
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Attendance Policy Name *"
                placeholder="e.g. Factory Staff Policy, Standard Corporate Policy"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Policy Status"
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </Select>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isDefaultPolicy"
                    checked={formData.isDefault}
                    onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                  />
                  <label htmlFor="isDefaultPolicy" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Company Default
                  </label>
                </div>
              </div>
            </div>

            <Input
              label="Policy Description"
              placeholder="e.g. Applied to plant and factory staff with 9-hour working days and strict punctuality rules"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Section 2: Basic Attendance Settings */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-brand-900 uppercase tracking-wider border-b pb-1">
              2. Working Hours & Day Thresholds
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Input
                label="Full Day Hours *"
                type="number"
                step="0.5"
                value={formData.fullDayHours}
                onChange={e => setFormData({ ...formData, fullDayHours: Number(e.target.value) })}
                required
              />
              <Input
                label="Half Day Hours *"
                type="number"
                step="0.5"
                value={formData.halfDayHours}
                onChange={e => setFormData({ ...formData, halfDayHours: Number(e.target.value) })}
                required
              />
              <Input
                label="Full Day Credit Tolerance (Minutes)"
                type="number"
                value={formData.fullDayCreditToleranceMinutes}
                onChange={e => setFormData({ ...formData, fullDayCreditToleranceMinutes: Number(e.target.value) })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Full-Day Credit Logic"
                value={formData.fullDayCreditLogic}
                onChange={e => setFormData({ ...formData, fullDayCreditLogic: e.target.value as any })}
              >
                <option value="inside_shift_only">Inside Shift Hours Only (Strict)</option>
                <option value="can_stay_late">Can Stay Late to Complete Daily Hours</option>
              </Select>

              <Input
                label="Maximum Leave Carryover (Days)"
                type="number"
                value={formData.maxLeaveCarryoverDays}
                onChange={e => setFormData({ ...formData, maxLeaveCarryoverDays: Number(e.target.value) })}
                required
              />
            </div>
          </div>

          {/* Section 3: Overtime Controls & Detection */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-brand-900 uppercase tracking-wider border-b pb-1">
              3. Overtime (OT) Controls & Auto-Detection
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="enableOvertime"
                  checked={formData.enableOvertime}
                  onChange={e => setFormData({ ...formData, enableOvertime: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                />
                <label htmlFor="enableOvertime" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Enable Overtime Calculation
                </label>
              </div>

              <Select
                label="Overtime Pay Scale"
                value={formData.overtimePayScale}
                onChange={e => setFormData({ ...formData, overtimePayScale: Number(e.target.value) })}
                disabled={!formData.enableOvertime}
              >
                <option value={1.0}>1.0x (Standard Hourly Rate)</option>
                <option value={1.25}>1.25x (125% Hourly Pay)</option>
                <option value={1.5}>1.5x (Time-and-a-Half)</option>
                <option value={2.0}>2.0x (Double Hourly Pay)</option>
                <option value={2.5}>2.5x (Triple Pay)</option>
              </Select>

              <Input
                label="Minimum OT Hours Daily"
                type="number"
                step="0.5"
                value={formData.minimumOtHoursDaily}
                onChange={e => setFormData({ ...formData, minimumOtHoursDaily: Number(e.target.value) })}
                disabled={!formData.enableOvertime}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="OT Detection Mode"
                value={formData.otDetectionMode}
                onChange={e => setFormData({ ...formData, otDetectionMode: e.target.value as any })}
                disabled={!formData.enableOvertime}
              >
                <option value="after_shift">After Shift Only</option>
                <option value="before_shift">Before Shift Only</option>
                <option value="both">Both (Before & After Shift)</option>
              </Select>

              <Input
                label="OT Detection Window (Minutes)"
                type="number"
                value={formData.otWindowMinutes}
                onChange={e => setFormData({ ...formData, otWindowMinutes: Number(e.target.value) })}
                disabled={!formData.enableOvertime}
              />

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="countOutsideShiftHours"
                  checked={formData.countOutsideShiftHours}
                  onChange={e => setFormData({ ...formData, countOutsideShiftHours: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                />
                <label htmlFor="countOutsideShiftHours" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Count Outside-Shift Hours
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: Late Coming & Punctuality Policy */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-brand-900 uppercase tracking-wider border-b pb-1">
              4. Late Coming Policy & Penalty Rules
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Daily Grace Allowance (Minutes)"
                type="number"
                value={formData.dailyLateAllowanceMinutes}
                onChange={e => setFormData({ ...formData, dailyLateAllowanceMinutes: Number(e.target.value) })}
                required
              />
              <Input
                label="Late Coming Grace Minutes"
                type="number"
                value={formData.lateComingGraceMinutes}
                onChange={e => setFormData({ ...formData, lateComingGraceMinutes: Number(e.target.value) })}
                required
              />
              <Input
                label="Max Monthly Lateness Allowed"
                type="number"
                value={formData.maxMonthlyLatenessAllowed}
                onChange={e => setFormData({ ...formData, maxMonthlyLatenessAllowed: Number(e.target.value) })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Late Penalty Type"
                value={formData.latePenaltyType}
                onChange={e => setFormData({ ...formData, latePenaltyType: e.target.value as any })}
              >
                <option value="HalfDay">Half-Day Salary Deduction (0.5 LOP)</option>
                <option value="Deduction">Fixed Amount Deduction (₹)</option>
                <option value="Warning">Warning Only (No Salary Deduction)</option>
                <option value="None">No Penalty</option>
              </Select>

              {formData.latePenaltyType === 'Deduction' && (
                <Input
                  label="Deduction Amount per Excess Late (₹)"
                  type="number"
                  value={formData.latePenaltyValue}
                  onChange={e => setFormData({ ...formData, latePenaltyValue: Number(e.target.value) })}
                  required
                />
              )}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingPolicy ? 'Update Policy' : 'Create Policy'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
