// ====================================================================
// NovaPulse / MakeMyPayroll — Overtime & Leave Encashment Services
// Integrates Attendance and Leave balances with payroll calculations
// ====================================================================

import { StorageEngine, STORAGE_KEYS } from '../../database/storageEngine';
import { EmployeeOvertimeRecord, LeaveEncashmentRecord } from '../../database/schema';
import { PayrollStatutoryService } from './payrollStatutoryService';
import { LeaveService } from '../leaveService';
import { AuditService } from '../auditService';

export class PayrollOvertimeService {
  public static getAll(tenantId?: string): EmployeeOvertimeRecord[] {
    const list = StorageEngine.getList<EmployeeOvertimeRecord>(STORAGE_KEYS.EMPLOYEE_OVERTIME);
    return tenantId ? list.filter(o => o.tenantId === tenantId) : list;
  }

  public static getByEmployee(employeeId: string, tenantId?: string): EmployeeOvertimeRecord[] {
    return this.getAll(tenantId).filter(o => o.employeeId === employeeId);
  }

  /**
   * Records and approves OT for an employee
   */
  public static recordOvertime(params: {
    tenantId: string;
    employeeId: string;
    employeeName: string;
    date: string;
    otHours: number;
    basicSalary: number;
    grossSalary: number;
    shiftId?: string;
    attendanceRecordId?: string;
    multiplier?: number;
    approvedBy?: string;
  }): EmployeeOvertimeRecord {
    // Prevent duplicate OT payment for the same employee and date
    const existing = this.getByEmployee(params.employeeId, params.tenantId).find(
      o => o.date === params.date && (o.status === 'Approved' || o.status === 'Processed')
    );
    if (existing) {
      return existing;
    }

    const calc = PayrollStatutoryService.calculateOvertime({
      otHours: params.otHours,
      basicSalary: params.basicSalary,
      grossSalary: params.grossSalary,
      multiplier: params.multiplier,
      tenantId: params.tenantId,
    });

    const newRecord: EmployeeOvertimeRecord = {
      id: `ot-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      date: params.date,
      otHours: params.otHours,
      hourlyRate: calc.hourlyRate,
      multiplier: calc.multiplier,
      otAmount: calc.otAmount,
      attendanceRecordId: params.attendanceRecordId,
      shiftId: params.shiftId,
      status: params.approvedBy ? 'Approved' : 'Pending',
      approvedBy: params.approvedBy,
      approvedAt: params.approvedBy ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(),
    };

    StorageEngine.insert<EmployeeOvertimeRecord>(STORAGE_KEYS.EMPLOYEE_OVERTIME, newRecord);
    return newRecord;
  }

  /**
   * Gathers approved OT for payroll month
   */
  public static processMonthlyOvertime(
    employeeId: string,
    monthStr: string, // "YYYY-MM"
    payrollPeriodId: string,
    tenantId?: string
  ): { totalOtHours: number; totalOtPay: number; records: EmployeeOvertimeRecord[] } {
    const approved = this.getByEmployee(employeeId, tenantId).filter(
      o => o.date.startsWith(monthStr) && o.status === 'Approved' && !o.payrollPeriodId
    );

    let totalOtHours = 0;
    let totalOtPay = 0;
    const records: EmployeeOvertimeRecord[] = [];

    approved.forEach(rec => {
      totalOtHours += rec.otHours;
      totalOtPay += rec.otAmount;

      const updated = StorageEngine.update<EmployeeOvertimeRecord>(STORAGE_KEYS.EMPLOYEE_OVERTIME, rec.id, {
        status: 'Processed',
        payrollPeriodId,
      });
      if (updated) records.push(updated);
    });

    return { totalOtHours, totalOtPay, records };
  }
}

export class PayrollEncashmentService {
  public static getAll(tenantId?: string): LeaveEncashmentRecord[] {
    const list = StorageEngine.getList<LeaveEncashmentRecord>(STORAGE_KEYS.LEAVE_ENCASHMENTS);
    return tenantId ? list.filter(e => e.tenantId === tenantId) : list;
  }

  public static getByEmployee(employeeId: string, tenantId?: string): LeaveEncashmentRecord[] {
    return this.getAll(tenantId).filter(e => e.employeeId === employeeId);
  }

  /**
   * Requests leave encashment
   */
  public static requestEncashment(params: {
    tenantId: string;
    employeeId: string;
    employeeName: string;
    leaveTypeId: string;
    leaveTypeName: string;
    encashedDays: number;
    basicSalary: number;
    grossSalary: number;
    basis?: 'BASIC' | 'BASIC_DA' | 'GROSS';
  }): { success: boolean; message: string; record?: LeaveEncashmentRecord } {
    const balances = LeaveService.getEmployeeBalances(params.employeeId);
    const targetBalance = balances.find(b => b.leaveTypeId === params.leaveTypeId);
    const available = targetBalance ? (targetBalance.balance ?? (targetBalance as any).remainingDays ?? 0) : 0;

    const cfg = PayrollStatutoryService.getConfig(params.tenantId);
    if (available < cfg.minLeaveBalanceForEncashment) {
      return {
        success: false,
        message: `Insufficient leave balance. Minimum ${cfg.minLeaveBalanceForEncashment} days balance required for encashment (Current balance: ${available} days).`,
      };
    }

    if (params.encashedDays > Math.min(available, cfg.maxEncashableDaysPerYear)) {
      return {
        success: false,
        message: `Cannot encash ${params.encashedDays} days. Maximum allowed is ${Math.min(available, cfg.maxEncashableDaysPerYear)} days.`,
      };
    }

    const calc = PayrollStatutoryService.calculateLeaveEncashment({
      basicSalary: params.basicSalary,
      grossSalary: params.grossSalary,
      encashedDays: params.encashedDays,
      basis: params.basis || cfg.leaveEncashmentBasis,
      tenantId: params.tenantId,
    });

    const newRec: LeaveEncashmentRecord = {
      id: `encash-${Date.now()}`,
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      leaveTypeId: params.leaveTypeId,
      leaveTypeName: params.leaveTypeName,
      eligibleBalanceDays: available,
      encashedDays: params.encashedDays,
      calculationBasis: params.basis || cfg.leaveEncashmentBasis,
      perDayRate: calc.perDayRate,
      encashmentAmount: calc.amount,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };

    StorageEngine.insert<LeaveEncashmentRecord>(STORAGE_KEYS.LEAVE_ENCASHMENTS, newRec);

    AuditService.log({
      userId: 'user-001',
      userName: params.employeeName,
      userRole: 'Employee',
      module: 'Leave Encashment',
      action: 'CREATE',
      description: `Requested encashment of ${params.encashedDays} days (${params.leaveTypeName}) for ₹${calc.amount}`,
      recordId: newRec.id,
    });

    return { success: true, message: 'Encashment request submitted successfully', record: newRec };
  }

  /**
   * Approve leave encashment
   */
  public static approveEncashment(id: string, approvedBy: string = 'HR Admin'): LeaveEncashmentRecord | undefined {
    const rec = this.getAll().find(r => r.id === id);
    if (!rec) return undefined;

    return StorageEngine.update<LeaveEncashmentRecord>(STORAGE_KEYS.LEAVE_ENCASHMENTS, id, {
      status: 'Approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
    });
  }

  /**
   * Payout approved encashment during payroll run
   */
  public static processMonthlyEncashment(
    employeeId: string,
    payrollPeriodId: string,
    tenantId?: string
  ): { totalEncashmentAmount: number; records: LeaveEncashmentRecord[] } {
    const approved = this.getByEmployee(employeeId, tenantId).filter(
      e => e.status === 'Approved' && !e.payrollPeriodId
    );

    let totalEncashmentAmount = 0;
    const records: LeaveEncashmentRecord[] = [];

    approved.forEach(rec => {
      totalEncashmentAmount += rec.encashmentAmount;
      const updated = StorageEngine.update<LeaveEncashmentRecord>(STORAGE_KEYS.LEAVE_ENCASHMENTS, rec.id, {
        status: 'Processed',
        payrollPeriodId,
      });
      if (updated) records.push(updated);
    });

    return { totalEncashmentAmount, records };
  }
}
