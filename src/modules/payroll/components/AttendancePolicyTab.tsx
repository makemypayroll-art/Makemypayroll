// ====================================================================
// Payroll Configuration Submodule: Attendance Policy (Rules & Penalties)
// ====================================================================

import React, { useState } from 'react';
import {
  Sliders,
  Plus,
  Edit2,
  Trash2,
  Clock,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { AttendancePolicy, Employee } from '../../../database/schema';
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
      organizationId: policy.organizationId || tenantId,
      name: policy.name,
      description: policy.description || '',
      isDefault: policy.isDefault || false,
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
      alert('Attendance Policy Name is required.');
      return;
    }

    try {
      if (editingPolicy) {
        AttendancePolicyService.update(
          editingPolicy.id,
          formData,
          currentUser.fullName
        );
      } else {
        AttendancePolicyService.create(
          formData,
          currentUser.fullName
        );
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save Attendance Policy.');
    }
  };

  const handleToggleStatus = (policy: AttendancePolicy) => {
    const nextStatus = policy.status === 'Active' ? 'Inactive' : 'Active';
    AttendancePolicyService.update(policy.id, { status: nextStatus }, currentUser.fullName);
  };

  const handleDeletePolicy = (policy: AttendancePolicy) => {
    if (!confirm(`Are you sure you want to delete policy "${policy.name}"?`)) return;
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
      header: 'Policy Name',
      render: (p) => (
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-sm text-slate-900 tracking-tight">{p.name}</span>
          {p.isDefault && (
            <Badge variant="purple" size="sm" className="bg-purple-50 text-purple-800 border-purple-200 text-[10px] font-semibold">
              Company Default
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'hours',
      header: 'Full / Half Day',
      render: (p) => (
        <div className="font-mono text-xs text-slate-700">
          <span className="font-bold text-slate-900">{p.fullDayHours}h</span> Full • <span className="font-bold text-slate-900">{p.halfDayHours}h</span> Half
        </div>
      ),
    },
    {
      key: 'late',
      header: 'Grace & Penalty Rule',
      render: (p) => (
        <div className="text-xs space-y-0.5">
          <div className="font-bold text-amber-800 font-mono">
            {p.lateComingGraceMinutes}m Grace (Max {p.maxMonthlyLatenessAllowed}/mo)
          </div>
          <div className="text-[11px] text-slate-500">
            {p.latePenaltyType === 'None' ? 'No penalty' : p.latePenaltyType === 'HalfDay' ? '0.5 Day LOP' : p.latePenaltyType === 'Deduction' ? `₹${p.latePenaltyValue} deduction` : 'Warning'}
          </div>
        </div>
      ),
    },
    {
      key: 'ot',
      header: 'Overtime Rule',
      render: (p) => (
        <div className="text-xs">
          {p.enableOvertime ? (
            <Badge variant="info" size="sm" className="bg-sky-50 text-sky-800 border-sky-200 text-[10px] font-semibold">
              {p.overtimePayScale}x Multiplier
            </Badge>
          ) : (
            <span className="text-slate-400 font-mono text-[11px]">Disabled</span>
          )}
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
            <span className="text-xs text-slate-500">workforce</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <Badge
          variant={p.status === 'Active' ? 'success' : 'default'}
          size="sm"
          className={p.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px]' : 'bg-slate-100 text-slate-600 border-slate-200 font-bold text-[10px]'}
        >
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
                variant="outline"
                onClick={() => handleToggleStatus(p)}
                className={`h-7 px-2.5 text-xs font-semibold ${
                  p.status === 'Active'
                    ? 'border-amber-200 text-amber-800 hover:bg-amber-50'
                    : 'border-emerald-200 text-emerald-800 hover:bg-emerald-50'
                }`}
              >
                {p.status === 'Active' ? 'Deactivate' : 'Activate'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenEditModal(p)}
                className="h-7 px-2.5 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-700 hover:text-slate-900"
              >
                <Edit2 className="w-3.5 h-3.5 mr-1 text-slate-500" />
                Edit
              </Button>
              {!p.isDefault && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeletePolicy(p)}
                  className="h-7 px-2.5 text-xs font-semibold border-rose-200 hover:bg-rose-50 text-rose-700 hover:border-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-500" />
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
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">Attendance Policy</h2>
            <div className="text-xs text-slate-400 font-mono">
              {policies.length} active policy rules
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
            <span>Add Attendance Policy</span>
          </Button>
        )}
      </div>

      {/* Policy Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <Table
          columns={policyColumns}
          data={policies}
          keyExtractor={p => p.id}
          pageSize={10}
          emptyMessage="No attendance policies configured."
          className="border-none shadow-none rounded-none"
        />
      </div>

      {/* 4-Section Add / Edit Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingPolicy ? `Edit Policy: ${editingPolicy.name}` : 'Create Attendance Policy'}
          size="lg"
        >
          <form onSubmit={handleSavePolicy} className="space-y-5 text-xs max-h-[75vh] overflow-y-auto pr-1">
            {/* Section 1: Basic Information */}
            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-1.5">
                <span>1. Basic Information</span>
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Policy Name *"
                  placeholder="e.g. Standard Corporate Policy"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />

                <Select
                  label="Status"
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Full Day Hours *"
                  type="number"
                  step="0.5"
                  min={4}
                  max={12}
                  value={formData.fullDayHours}
                  onChange={e => setFormData({ ...formData, fullDayHours: Number(e.target.value) })}
                  required
                />

                <Input
                  label="Half Day Hours *"
                  type="number"
                  step="0.5"
                  min={2}
                  max={8}
                  value={formData.halfDayHours}
                  onChange={e => setFormData({ ...formData, halfDayHours: Number(e.target.value) })}
                  required
                />

                <Input
                  label="Credit Tolerance (Mins)"
                  type="number"
                  min={0}
                  max={60}
                  value={formData.fullDayCreditToleranceMinutes}
                  onChange={e => setFormData({ ...formData, fullDayCreditToleranceMinutes: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Section 2: Late Coming Configuration */}
            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-1.5">
                <span>2. Late Coming & Penalty Configuration</span>
              </h4>

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Grace Period (Mins)"
                  type="number"
                  min={0}
                  max={60}
                  value={formData.lateComingGraceMinutes}
                  onChange={e => setFormData({ ...formData, lateComingGraceMinutes: Number(e.target.value), dailyLateAllowanceMinutes: Number(e.target.value) })}
                />

                <Input
                  label="Max Allowed / Month"
                  type="number"
                  min={0}
                  max={10}
                  value={formData.maxMonthlyLatenessAllowed}
                  onChange={e => setFormData({ ...formData, maxMonthlyLatenessAllowed: Number(e.target.value) })}
                />

                <Select
                  label="Penalty Action"
                  value={formData.latePenaltyType}
                  onChange={e => setFormData({ ...formData, latePenaltyType: e.target.value as any })}
                >
                  <option value="None">None (Warning Only)</option>
                  <option value="HalfDay">0.5 Day LOP Penalty</option>
                  <option value="Deduction">Fixed Rupee Deduction</option>
                  <option value="Warning">Official Warning</option>
                </Select>
              </div>

              {formData.latePenaltyType === 'Deduction' && (
                <Input
                  label="Fixed Rupee Deduction Amount (₹)"
                  type="number"
                  min={10}
                  value={formData.latePenaltyValue}
                  onChange={e => setFormData({ ...formData, latePenaltyValue: Number(e.target.value) })}
                />
              )}
            </div>

            {/* Section 3: Overtime Controls & Detection */}
            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-1.5">
                <span>3. Overtime (OT) Controls & Auto-Detection</span>
              </h4>

              <div className="flex items-center gap-2 p-2 rounded bg-slate-900 border border-slate-800">
                <input
                  type="checkbox"
                  id="enableOvertime"
                  checked={formData.enableOvertime}
                  onChange={e => setFormData({ ...formData, enableOvertime: e.target.checked })}
                  className="w-4 h-4 rounded text-brand-600"
                />
                <label htmlFor="enableOvertime" className="text-xs font-bold text-slate-200 cursor-pointer">
                  Enable Overtime Calculation
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Select
                  label="Overtime Pay Scale"
                  value={formData.overtimePayScale}
                  onChange={e => setFormData({ ...formData, overtimePayScale: Number(e.target.value) })}
                  disabled={!formData.enableOvertime}
                >
                  <option value={1.0}>1.0x (Standard Single Hourly Rate)</option>
                  <option value={1.5}>1.5x (Time and a Half)</option>
                  <option value={2.0}>2.0x (Double Hourly Rate)</option>
                </Select>

                <Input
                  label="Min Daily OT Hours"
                  type="number"
                  step="0.5"
                  min={0.5}
                  value={formData.minimumOtHoursDaily}
                  onChange={e => setFormData({ ...formData, minimumOtHoursDaily: Number(e.target.value) })}
                  disabled={!formData.enableOvertime}
                />

                <Select
                  label="OT Detection Mode"
                  value={formData.otDetectionMode}
                  onChange={e => setFormData({ ...formData, otDetectionMode: e.target.value as any })}
                  disabled={!formData.enableOvertime}
                >
                  <option value="after_shift">After Shift End Only</option>
                  <option value="before_shift">Before Shift Start Only</option>
                  <option value="both">Both (Pre & Post Shift)</option>
                </Select>
              </div>
            </div>

            {/* Section 4: Full-Day Calculation Logic */}
            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-1.5">
                <span>4. Shift Full-Day Credit Rules</span>
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Credit Logic"
                  value={formData.fullDayCreditLogic}
                  onChange={e => setFormData({ ...formData, fullDayCreditLogic: e.target.value as any })}
                >
                  <option value="inside_shift_only">Inside Shift Hours Only (Strict)</option>
                  <option value="can_stay_late">Can Stay Late to Complete Full Hours</option>
                </Select>

                <Input
                  label="Max Annual Leave Carryover"
                  type="number"
                  min={0}
                  max={30}
                  value={formData.maxLeaveCarryoverDays}
                  onChange={e => setFormData({ ...formData, maxLeaveCarryoverDays: Number(e.target.value) })}
                />
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.countOutsideShiftHours}
                    onChange={e => setFormData({ ...formData, countOutsideShiftHours: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-600"
                  />
                  <span>Count hours outside assigned shift</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-600"
                  />
                  <span>Set as Company Default Policy</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" className="bg-brand-600 text-white font-bold">
                {editingPolicy ? 'Save Changes' : 'Create Policy'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
