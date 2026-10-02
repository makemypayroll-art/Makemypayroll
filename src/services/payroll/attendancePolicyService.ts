import { StorageEngine, STORAGE_KEYS } from '../../database/storageEngine';
import { AttendancePolicy, Attendance, Shift, LeaveApplication } from '../../database/schema';
import { AuditService } from '../auditService';
import { EmployeeService } from '../employeeService';
import { LeavePayrollConfigService } from './leavePayrollConfigService';

export interface AttendancePolicyEvaluationResult {
  presentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  lopDays: number;
  weeklyOffDays: number;
  holidayDays: number;
  lateArrivalCount: number;
  latePenaltyLopDays: number;
  totalLopDays: number;
  effectivePresentDays: number;
  overtimeHours: number;
  totalWorkingDays: number;
}

export class AttendancePolicyService {
  /**
   * Retrieves all attendance policies for a tenant
   */
  public static getAll(tenantId?: string): AttendancePolicy[] {
    const targetTenant = tenantId || StorageEngine.getActiveTenantId();
    const list = StorageEngine.getList<AttendancePolicy>(STORAGE_KEYS.ATTENDANCE_POLICIES);
    const tenantPolicies = list.filter(p => !p.organizationId || p.organizationId === targetTenant || p.organizationId === 'NP-000001');
    if (tenantPolicies.length === 0) {
      return list;
    }
    return tenantPolicies;
  }

  /**
   * Retrieves a single attendance policy by ID
   */
  public static getById(id: string): AttendancePolicy | undefined {
    const list = StorageEngine.getList<AttendancePolicy>(STORAGE_KEYS.ATTENDANCE_POLICIES);
    return list.find(p => p.id === id);
  }

  /**
   * Retrieves the default policy for a tenant
   */
  public static getDefaultPolicy(tenantId?: string): AttendancePolicy {
    const policies = this.getAll(tenantId);
    const def = policies.find(p => p.isDefault && p.status === 'Active');
    if (def) return def;
    const active = policies.find(p => p.status === 'Active');
    if (active) return active;
    if (policies.length > 0) return policies[0];

    // Fallback default
    return {
      id: 'pol-001',
      organizationId: tenantId || StorageEngine.getActiveTenantId(),
      name: 'Standard Corporate Policy',
      description: 'Corporate default attendance policy with standard 8-hour workday.',
      isDefault: true,
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
      createdBy: 'System',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Create a new Attendance Policy
   */
  public static create(
    data: Omit<AttendancePolicy, 'id' | 'createdAt' | 'updatedAt'>,
    user: string = 'Super Admin'
  ): AttendancePolicy {
    const tenantId = data.organizationId || StorageEngine.getActiveTenantId();
    const newPolicy: AttendancePolicy = {
      ...data,
      id: `pol-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      organizationId: tenantId,
      fullDayHours: Number(data.fullDayHours) || 8.0,
      halfDayHours: Number(data.halfDayHours) || 4.5,
      fullDayCreditToleranceMinutes: Number(data.fullDayCreditToleranceMinutes) || 15,
      minimumOtHoursDaily: Number(data.minimumOtHoursDaily) || 1.0,
      otPunchGapSeconds: Number(data.otPunchGapSeconds) || 60,
      maxLeaveCarryoverDays: Number(data.maxLeaveCarryoverDays) || 10,
      enableOvertime: !!data.enableOvertime,
      overtimePayScale: Number(data.overtimePayScale) || 1.5,
      countOutsideShiftHours: !!data.countOutsideShiftHours,
      salesProductivityAttendance: !!data.salesProductivityAttendance,
      otDetectionEnabled: !!data.otDetectionEnabled,
      otDetectionMode: data.otDetectionMode || 'after_shift',
      otWindowMinutes: Number(data.otWindowMinutes) || 30,
      dailyLateAllowanceMinutes: Number(data.dailyLateAllowanceMinutes) || 15,
      lateComingGraceMinutes: Number(data.lateComingGraceMinutes) || 15,
      maxMonthlyLatenessAllowed: Number(data.maxMonthlyLatenessAllowed) || 3,
      latePenaltyType: data.latePenaltyType || 'HalfDay',
      latePenaltyValue: Number(data.latePenaltyValue) || 0.5,
      fullDayCreditLogic: data.fullDayCreditLogic || 'inside_shift_only',
      status: data.status || 'Active',
      createdBy: user,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (newPolicy.isDefault) {
      const all = StorageEngine.getList<AttendancePolicy>(STORAGE_KEYS.ATTENDANCE_POLICIES);
      const updatedList = all.map(p =>
        p.organizationId === tenantId ? { ...p, isDefault: false } : p
      );
      StorageEngine.setList(STORAGE_KEYS.ATTENDANCE_POLICIES, updatedList);
    }

    const created = StorageEngine.insert<AttendancePolicy>(STORAGE_KEYS.ATTENDANCE_POLICIES, newPolicy);

    AuditService.log({
      userId: 'user-001',
      userName: user,
      userRole: 'Super Admin',
      module: 'Payroll Configuration',
      action: 'CREATE',
      description: `Created new attendance policy: "${created.name}" (Full-day: ${created.fullDayHours}h, OT: ${created.enableOvertime ? 'Enabled' : 'Disabled'})`,
      recordId: created.id,
    });

    return created;
  }

  /**
   * Update an existing Attendance Policy
   */
  public static update(
    id: string,
    updates: Partial<AttendancePolicy>,
    user: string = 'Super Admin'
  ): AttendancePolicy | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    if (updates.isDefault) {
      const all = StorageEngine.getList<AttendancePolicy>(STORAGE_KEYS.ATTENDANCE_POLICIES);
      const updatedList = all.map(p =>
        p.organizationId === existing.organizationId ? { ...p, isDefault: false } : p
      );
      StorageEngine.setList(STORAGE_KEYS.ATTENDANCE_POLICIES, updatedList);
    }

    const updated = StorageEngine.update<AttendancePolicy>(STORAGE_KEYS.ATTENDANCE_POLICIES, id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    if (updated) {
      AuditService.log({
        userId: 'user-001',
        userName: user,
        userRole: 'Super Admin',
        module: 'Payroll Configuration',
        action: 'UPDATE',
        description: `Updated attendance policy "${updated.name}"`,
        recordId: updated.id,
      });
    }

    return updated;
  }

  /**
   * Toggle Active / Inactive status
   */
  public static toggleStatus(id: string, user: string = 'Super Admin'): AttendancePolicy | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;
    const newStatus = existing.status === 'Active' ? 'Inactive' : 'Active';
    return this.update(id, { status: newStatus }, user);
  }

  /**
   * Safe Delete Attendance Policy
   */
  public static delete(id: string, user: string = 'Super Admin'): { success: boolean; message: string } {
    const existing = this.getById(id);
    if (!existing) {
      return { success: false, message: 'Attendance policy not found.' };
    }

    if (existing.isDefault) {
      return { success: false, message: 'Cannot delete the default attendance policy. Please designate another default policy first.' };
    }

    // Check employee mapping
    const employees = EmployeeService.getAll();
    const mappedEmployees = employees.filter(e => e.attendancePolicyId === id);
    if (mappedEmployees.length > 0) {
      return {
        success: false,
        message: `Cannot delete "${existing.name}" because it is currently assigned to ${mappedEmployees.length} employee(s). Please reassign them or deactivate this policy instead.`,
      };
    }

    StorageEngine.remove(STORAGE_KEYS.ATTENDANCE_POLICIES, id);

    AuditService.log({
      userId: 'user-001',
      userName: user,
      userRole: 'Super Admin',
      module: 'Payroll Configuration',
      action: 'DELETE',
      description: `Deleted attendance policy "${existing.name}" (ID: ${id})`,
      recordId: id,
    });

    return { success: true, message: `Attendance policy "${existing.name}" deleted successfully.` };
  }

  /**
   * Get employee count assigned to this policy
   */
  public static getAssignedEmployeeCount(policyId: string, tenantId?: string): number {
    const employees = EmployeeService.getAll();
    return employees.filter(e => e.attendancePolicyId === policyId).length;
  }

  /**
   * EVALUATE RAW ATTENDANCE RECORDS ACCORDING TO THIS POLICY
   * Computes Present, LOP, Half-Day, Late penalties, and Overtime Hours.
   */
  public static evaluateAttendanceForPayroll(params: {
    attendance: Attendance[];
    policy: AttendancePolicy;
    shift?: Shift;
    totalWorkingDays?: number;
    employeeId?: string;
    year?: number;
  }): AttendancePolicyEvaluationResult {
    const { attendance, policy, shift, totalWorkingDays = 26, employeeId, year = 2026 } = params;

    let presentDays = 0;
    let halfDays = 0;
    let paidLeaveDays = 0;
    let lopDays = 0;
    let weeklyOffDays = 0;
    let holidayDays = 0;
    let lateArrivalCount = 0;
    let overtimeHours = 0;

    const targetEmpId = employeeId || (attendance.length > 0 ? attendance[0].employeeId : undefined);
    const leaveApps = targetEmpId
      ? StorageEngine.getList<LeaveApplication>(STORAGE_KEYS.LEAVE_APPLICATIONS).filter(
          a => a.employeeId === targetEmpId && a.status === 'approved'
        )
      : [];

    const fullDayMinutesThreshold = policy.fullDayHours * 60 - policy.fullDayCreditToleranceMinutes;
    const halfDayMinutesThreshold = policy.halfDayHours * 60;

    attendance.forEach(att => {
      // Analyze status and work duration
      const durationMinutes = att.workDurationMinutes || (att.workHours ? att.workHours * 60 : 0);

      if (att.status === 'Present' || att.status === 'Work From Home' || att.status === 'On Duty') {
        if (durationMinutes > 0 && durationMinutes < halfDayMinutesThreshold) {
          // Less than half day threshold -> counts as LOP
          lopDays += 1;
        } else if (durationMinutes > 0 && durationMinutes < fullDayMinutesThreshold) {
          // Between half day and full day threshold -> counts as Half-Day
          halfDays += 1;
          presentDays += 0.5;
          lopDays += 0.5;
        } else {
          presentDays += 1;
        }
      } else if (att.status === 'Half-Day') {
        halfDays += 1;
        presentDays += 0.5;
        lopDays += 0.5;
      } else if (att.status === 'Late Arrival') {
        lateArrivalCount += 1;
        if (durationMinutes > 0 && durationMinutes < halfDayMinutesThreshold) {
          lopDays += 1;
        } else if (durationMinutes > 0 && durationMinutes < fullDayMinutesThreshold) {
          halfDays += 1;
          presentDays += 0.5;
          lopDays += 0.5;
        } else {
          presentDays += 1;
        }
      } else if (att.status === 'Leave') {
        // Evaluate Paid vs Unpaid / LOP based on Leave Configuration & Employee Balance
        const matchingApp = leaveApps.find(a => att.date >= a.startDate && att.date <= a.endDate);
        if (matchingApp && targetEmpId) {
          const impact = LeavePayrollConfigService.evaluateLeaveImpact({
            employeeId: targetEmpId,
            leaveTypeId: matchingApp.leaveTypeId,
            totalDays: 1,
            year,
          });
          if (impact.lopDays > 0) {
            lopDays += 1;
          } else {
            paidLeaveDays += 1;
          }
        } else if (
          att.notes?.toLowerCase().includes('lwp') ||
          att.notes?.toLowerCase().includes('lop') ||
          att.notes?.toLowerCase().includes('unpaid')
        ) {
          lopDays += 1;
        } else {
          paidLeaveDays += 1;
        }
      } else if (att.status === 'Absent') {
        lopDays += 1;
      } else if (att.status === 'Weekly Off') {
        weeklyOffDays += 1;
      } else if (att.status === 'Holiday') {
        holidayDays += 1;
      }

      // Overtime calculation
      if (policy.enableOvertime) {
        if (att.overtimeMinutes && att.overtimeMinutes >= policy.minimumOtHoursDaily * 60) {
          overtimeHours += att.overtimeMinutes / 60;
        } else if ((att as any).overtimeHours && (att as any).overtimeHours >= policy.minimumOtHoursDaily) {
          overtimeHours += (att as any).overtimeHours;
        } else if (durationMinutes > policy.fullDayHours * 60) {
          const extraMinutes = durationMinutes - (policy.fullDayHours * 60);
          if (extraMinutes >= policy.minimumOtHoursDaily * 60) {
            overtimeHours += extraMinutes / 60;
          }
        }
      }
    });

    // If no attendance records present for period, default to full attendance
    if (attendance.length === 0) {
      presentDays = totalWorkingDays;
      lopDays = 0;
    }

    // Late Penalty Calculation
    let latePenaltyLopDays = 0;
    if (lateArrivalCount > policy.maxMonthlyLatenessAllowed) {
      const excessLateCount = lateArrivalCount - policy.maxMonthlyLatenessAllowed;
      if (policy.latePenaltyType === 'HalfDay') {
        latePenaltyLopDays = excessLateCount * 0.5;
      } else if (policy.latePenaltyType === 'Deduction') {
        latePenaltyLopDays = excessLateCount * (policy.latePenaltyValue > 1 ? 0.5 : policy.latePenaltyValue);
      }
    }

    const totalLopDays = Number((lopDays + latePenaltyLopDays).toFixed(1));
    const effectivePresentDays = Math.max(0, totalWorkingDays - totalLopDays);

    return {
      presentDays,
      halfDays,
      paidLeaveDays,
      lopDays,
      weeklyOffDays,
      holidayDays,
      lateArrivalCount,
      latePenaltyLopDays,
      totalLopDays,
      effectivePresentDays,
      overtimeHours: Number(overtimeHours.toFixed(1)),
      totalWorkingDays,
    };
  }
}
