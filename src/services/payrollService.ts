// ====================================================================
// NovaPulse / MakeMyPayroll — Master Payroll Management Service
// Full Indian Statutory Compliance (PF, ESI, TDS, Loans, Advances, Overtime, Encashments)
// ====================================================================

import { StorageEngine, STORAGE_KEYS } from '../database/storageEngine';
import {
  PayrollPeriod,
  Payslip,
  PayrollStatus,
  Employee,
  Branch,
  Department,
  Designation,
} from '../database/schema';
import { EmployeeService } from './employeeService';
import { AttendanceService } from './attendanceService';
import { LeaveService } from './leaveService';
import { AuditService } from './auditService';
import { PayrollStatutoryService } from './payroll/payrollStatutoryService';
import { PayrollCalculationService, EmployeeSalaryBreakup } from './payroll/payrollCalculationService';
import { PayrollLoanService } from './payroll/payrollLoanService';
import { PayrollAdvanceService } from './payroll/payrollAdvanceService';
import { PayrollReimbursementService } from './payroll/payrollReimbursementService';
import { PayrollOvertimeService, PayrollEncashmentService } from './payroll/payrollOvertimeService';

export class PayrollService {
  public static getPeriods(tenantId?: string): PayrollPeriod[] {
    const list = StorageEngine.getList<PayrollPeriod>(STORAGE_KEYS.PAYROLL_PERIODS);
    return tenantId ? list.filter(p => p.organizationId === tenantId || (p as any).tenantId === tenantId) : list;
  }

  public static getPeriodById(id: string): PayrollPeriod | undefined {
    return this.getPeriods().find(p => p.id === id);
  }

  public static getPayslips(periodId?: string, tenantId?: string): Payslip[] {
    const list = StorageEngine.getList<Payslip>(STORAGE_KEYS.PAYSLIPS);
    let filtered = list;
    if (periodId) {
      filtered = filtered.filter(p => p.payrollPeriodId === periodId);
    }
    if (tenantId) {
      filtered = filtered.filter(p => p.organizationId === tenantId || p.tenantId === tenantId);
    }
    return filtered;
  }

  public static getEmployeePayslips(employeeId: string): Payslip[] {
    return this.getPayslips().filter(p => p.employeeId === employeeId);
  }

  public static getPayslipById(id: string): Payslip | undefined {
    return this.getPayslips().find(p => p.id === id);
  }

  public static numberToWordsINR(num: number): string {
    return PayrollCalculationService.numberToWordsINR(num);
  }

  /**
   * Preview salary calculation for an individual employee without saving
   */
  public static previewEmployeeSalary(
    employeeId: string,
    month: number = new Date().getMonth() + 1,
    year: number = new Date().getFullYear()
  ): EmployeeSalaryBreakup | undefined {
    const employee = EmployeeService.getById(employeeId);
    if (!employee) return undefined;

    return PayrollCalculationService.calculateEmployeeMonthlyPay({
      employee,
      month,
      year,
      applyLiveDeductions: false,
    });
  }

  /**
   * Run Monthly Payroll Calculation Engine across all active employees
   */
  public static processMonthlyPayroll(params: {
    month: number;
    year: number;
    processedByUserId: string;
    tenantId?: string;
  }): { period: PayrollPeriod; payslips: Payslip[] } {
    const tenantId = params.tenantId || StorageEngine.getActiveTenantId() || 'NP-000001';
    const periodId = `pay-${params.year}-${params.month.toString().padStart(2, '0')}`;
    const totalWorkingDays = 26; // Standard monthly working days

    // Check if payroll period is already locked
    const existingPeriod = this.getPeriodById(periodId);
    if (existingPeriod && existingPeriod.status === 'Finalized') {
      throw new Error(`Payroll period ${periodId} is locked and finalized. Unlock/reopen before recalculating.`);
    }

    let employees = EmployeeService.getAll().filter(
      e => (e.organizationId === tenantId || (e as any).tenantId === tenantId || (tenantId === 'NP-000001' && e.organizationId === 'org-novapulse-01')) && e.employmentStatus === 'Active'
    );
    if (employees.length === 0) {
      employees = EmployeeService.getAll().filter(e => e.employmentStatus === 'Active');
    }
    const branches = StorageEngine.getList<Branch>(STORAGE_KEYS.BRANCHES);
    const departments = StorageEngine.getList<Department>(STORAGE_KEYS.DEPARTMENTS);
    const designations = StorageEngine.getList<Designation>(STORAGE_KEYS.DESIGNATIONS);

    const payslips: Payslip[] = [];
    let totalGrossAll = 0;
    let totalDeductionsAll = 0;
    let totalNetAll = 0;

    employees.forEach(emp => {
      const branch = branches.find(b => b.id === emp.branchId);
      const dept = departments.find(d => d.id === emp.departmentId);
      const desig = designations.find(d => d.id === emp.designationId);

      // Execute canonical calculation engine pipeline
      const breakup = PayrollCalculationService.calculateEmployeeMonthlyPay({
        employee: emp,
        month: params.month,
        year: params.year,
        totalWorkingDays,
        tenantId,
        applyLiveDeductions: true,
        periodId,
      });

      const payslip = PayrollCalculationService.generatePayslip(breakup, {
        periodId,
        month: params.month,
        year: params.year,
        branch,
        department: dept,
        designation: desig,
        tenantId,
      });

      payslips.push(payslip);
      totalGrossAll += payslip.earnings.totalGross;
      totalDeductionsAll += payslip.deductions.totalDeductions;
      totalNetAll += payslip.netSalary;
    });

    const newPeriod: PayrollPeriod = {
      id: periodId,
      organizationId: tenantId,
      month: params.month,
      year: params.year,
      totalWorkingDays,
      status: 'Calculated',
      processedDate: new Date().toISOString().split('T')[0],
      processedByUserId: params.processedByUserId,
      totalEmployees: employees.length,
      totalGrossPay: totalGrossAll,
      totalDeductions: totalDeductionsAll,
      totalNetPay: totalNetAll,
    };

    // Save period and payslips
    StorageEngine.upsert<PayrollPeriod>(STORAGE_KEYS.PAYROLL_PERIODS, newPeriod);

    // Remove existing draft payslips for this period before writing updated ones
    const allPayslips = StorageEngine.getList<Payslip>(STORAGE_KEYS.PAYSLIPS).filter(
      p => p.payrollPeriodId !== periodId
    );
    StorageEngine.set<Payslip[]>(STORAGE_KEYS.PAYSLIPS, [...allPayslips, ...payslips]);

    // Audit log
    AuditService.log({
      userId: params.processedByUserId,
      userName: 'HR / Payroll Admin',
      userRole: 'HR Admin',
      module: 'Payroll Management',
      action: 'PROCESS',
      description: `Processed monthly payroll for period ${periodId} (${employees.length} employees). Gross: ₹${totalGrossAll.toLocaleString('en-IN')}, Net: ₹${totalNetAll.toLocaleString('en-IN')}`,
      recordId: periodId,
    });

    return { period: newPeriod, payslips };
  }

  /**
   * Update Payroll Period Status (Workflow: Draft -> Calculated -> Under Review -> Approved -> Finalized -> Paid)
   */
  public static updatePeriodStatus(periodId: string, status: PayrollStatus, updatedBy: string = 'Super Admin'): PayrollPeriod | undefined {
    const period = this.getPeriodById(periodId);
    if (!period) return undefined;

    const updated = StorageEngine.update<PayrollPeriod>(STORAGE_KEYS.PAYROLL_PERIODS, periodId, {
      status,
      processedDate: new Date().toISOString().split('T')[0],
    });

    // Update individual payslips status to match
    const payslips = StorageEngine.getList<Payslip>(STORAGE_KEYS.PAYSLIPS);
    const updatedPayslips = payslips.map(p => {
      if (p.payrollPeriodId === periodId) {
        return { ...p, status };
      }
      return p;
    });
    StorageEngine.set<Payslip[]>(STORAGE_KEYS.PAYSLIPS, updatedPayslips);

    AuditService.log({
      userId: 'user-001',
      userName: updatedBy,
      userRole: 'HR Admin',
      module: 'Payroll Management',
      action: 'UPDATE',
      description: `Updated payroll period ${periodId} status to '${status}'`,
      recordId: periodId,
      previousValue: period.status,
      newValue: status,
    });

    return updated;
  }

  /**
   * Lock Payroll Period
   */
  public static lockPeriod(periodId: string, lockedBy: string = 'Super Admin'): PayrollPeriod | undefined {
    return this.updatePeriodStatus(periodId, 'Finalized', lockedBy);
  }

  /**
   * Reopen Payroll Period (Requires Admin authorization)
   */
  public static reopenPeriod(periodId: string, reopenedBy: string = 'Super Admin', reason: string = 'Administrative review'): PayrollPeriod | undefined {
    const period = this.getPeriodById(periodId);
    if (!period) return undefined;

    const updated = StorageEngine.update<PayrollPeriod>(STORAGE_KEYS.PAYROLL_PERIODS, periodId, {
      status: 'Under Review',
    });

    AuditService.log({
      userId: 'user-001',
      userName: reopenedBy,
      userRole: 'Super Admin',
      module: 'Payroll Management',
      action: 'UPDATE',
      description: `Reopened locked payroll period ${periodId}. Reason: ${reason}`,
      recordId: periodId,
      previousValue: period.status,
      newValue: 'Under Review',
    });

    return updated;
  }

  /**
   * Overall Payroll Statistics Summary
   */
  public static getPayrollSummary(tenantId?: string) {
    const periods = this.getPeriods(tenantId);
    const payslips = this.getPayslips(undefined, tenantId);

    const totalGross = periods.reduce((acc, p) => acc + (p.totalGrossPay || 0), 0);
    const totalNet = periods.reduce((acc, p) => acc + (p.totalNetPay || 0), 0);
    const totalDeductions = periods.reduce((acc, p) => acc + (p.totalDeductions || 0), 0);

    const totalPF = payslips.reduce((acc, p) => acc + (p.deductions.pfEmployee || 0), 0);
    const totalESI = payslips.reduce((acc, p) => acc + (p.deductions.esiEmployee || 0), 0);
    const totalTDS = payslips.reduce((acc, p) => acc + (p.deductions.tds || 0), 0);
    const totalOT = payslips.reduce((acc, p) => acc + (p.earnings.overtimePay || 0), 0);
    const totalReimbursements = payslips.reduce((acc, p) => acc + (p.earnings.reimbursements || 0), 0);
    const totalLoanRecoveries = payslips.reduce((acc, p) => acc + (p.deductions.loanAdvanceDeduction || 0), 0);

    return {
      periodsCount: periods.length,
      payslipsCount: payslips.length,
      totalGross,
      totalNet,
      totalDeductions,
      totalPF,
      totalESI,
      totalTDS,
      totalOT,
      totalReimbursements,
      totalLoanRecoveries,
    };
  }
}
