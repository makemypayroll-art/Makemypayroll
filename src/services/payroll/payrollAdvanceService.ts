// ====================================================================
// NovaPulse / MakeMyPayroll — Salary Advance Management Service
// Advance requests, approval workflows, and payroll installment recovery
// ====================================================================

import { StorageEngine, STORAGE_KEYS } from '../../database/storageEngine';
import { EmployeeAdvance } from '../../database/schema';
import { AuditService } from '../auditService';

export class PayrollAdvanceService {
  public static getAll(tenantId?: string): EmployeeAdvance[] {
    const list = StorageEngine.getList<EmployeeAdvance>(STORAGE_KEYS.EMPLOYEE_ADVANCES);
    return tenantId ? list.filter(a => a.tenantId === tenantId) : list;
  }

  public static getByEmployee(employeeId: string, tenantId?: string): EmployeeAdvance[] {
    return this.getAll(tenantId).filter(a => a.employeeId === employeeId);
  }

  public static getById(id: string): EmployeeAdvance | undefined {
    return this.getAll().find(a => a.id === id);
  }

  /**
   * Request a new salary advance
   */
  public static requestAdvance(params: {
    tenantId: string;
    employeeId: string;
    employeeName: string;
    advanceAmount: number;
    reason: string;
    installmentsCount?: number;
    recoveryStartMonth?: string;
  }): EmployeeAdvance {
    const installments = Math.max(1, params.installmentsCount || 1);
    const recoveryMonthly = Math.round(params.advanceAmount / installments);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

    const newAdvance: EmployeeAdvance = {
      id: `adv-${Date.now()}`,
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      advanceAmount: params.advanceAmount,
      requestDate: now.toISOString().split('T')[0],
      reason: params.reason,
      approvedAmount: params.advanceAmount,
      recoveryStartMonth: params.recoveryStartMonth || currentMonth,
      recoveryMonthlyAmount: recoveryMonthly,
      installmentsCount: installments,
      installmentsRecoveredCount: 0,
      outstandingAmount: params.advanceAmount,
      status: 'Pending',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    StorageEngine.insert<EmployeeAdvance>(STORAGE_KEYS.EMPLOYEE_ADVANCES, newAdvance);

    AuditService.log({
      userId: 'user-001',
      userName: params.employeeName,
      userRole: 'Employee',
      module: 'Salary Advances',
      action: 'CREATE',
      description: `Requested salary advance of ₹${params.advanceAmount} for ${params.employeeName} (${params.employeeId})`,
      recordId: newAdvance.id,
    });

    return newAdvance;
  }

  /**
   * Approve salary advance
   */
  public static approveAdvance(
    advanceId: string,
    approvedAmount?: number,
    approvedBy: string = 'Super Admin'
  ): EmployeeAdvance | undefined {
    const adv = this.getById(advanceId);
    if (!adv) return undefined;

    const finalAmount = approvedAmount || adv.advanceAmount;
    const monthlyRecovery = Math.round(finalAmount / adv.installmentsCount);
    const now = new Date().toISOString();

    const updated = StorageEngine.update<EmployeeAdvance>(STORAGE_KEYS.EMPLOYEE_ADVANCES, advanceId, {
      status: 'Active',
      approvedAmount: finalAmount,
      outstandingAmount: finalAmount,
      recoveryMonthlyAmount: monthlyRecovery,
      approvedBy,
      approvedAt: now,
      updatedAt: now,
    });

    AuditService.log({
      userId: 'user-001',
      userName: approvedBy,
      userRole: 'HR Admin',
      module: 'Salary Advances',
      action: 'APPROVE',
      description: `Approved salary advance ${advanceId} (₹${finalAmount}) for ${adv.employeeName}`,
      recordId: advanceId,
    });

    return updated;
  }

  /**
   * Deducts advance recovery installment during payroll run
   */
  public static processMonthlyRecovery(
    employeeId: string,
    tenantId?: string
  ): { totalAdvanceRecovered: number; affectedAdvances: EmployeeAdvance[] } {
    const activeAdvances = this.getByEmployee(employeeId, tenantId).filter(
      a => (a.status === 'Active' || a.status === 'Approved') && a.outstandingAmount > 0
    );

    let totalAdvanceRecovered = 0;
    const affectedAdvances: EmployeeAdvance[] = [];

    activeAdvances.forEach(adv => {
      // Do not allow recovery above outstanding amount
      const recovery = Math.min(adv.recoveryMonthlyAmount, adv.outstandingAmount);
      if (recovery > 0) {
        totalAdvanceRecovered += recovery;
        const newOutstanding = Math.max(0, adv.outstandingAmount - recovery);
        const newRecoveredCount = adv.installmentsRecoveredCount + 1;
        const isRecovered = newOutstanding === 0 || newRecoveredCount >= adv.installmentsCount;

        const updated = StorageEngine.update<EmployeeAdvance>(STORAGE_KEYS.EMPLOYEE_ADVANCES, adv.id, {
          outstandingAmount: newOutstanding,
          installmentsRecoveredCount: newRecoveredCount,
          status: isRecovered ? 'Recovered' : 'Active',
          updatedAt: new Date().toISOString(),
        });
        if (updated) affectedAdvances.push(updated);
      }
    });

    return { totalAdvanceRecovered, affectedAdvances };
  }
}
