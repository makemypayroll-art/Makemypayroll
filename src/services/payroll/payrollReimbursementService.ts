// ====================================================================
// NovaPulse / MakeMyPayroll — Expense Reimbursements Service
// Workflow: Submitted -> Manager Approval -> HR Approval -> Paid via Payroll
// ====================================================================

import { StorageEngine, STORAGE_KEYS } from '../../database/storageEngine';
import { EmployeeReimbursement, ReimbursementType, ReimbursementStatus } from '../../database/schema';
import { AuditService } from '../auditService';

export class PayrollReimbursementService {
  public static getAll(tenantId?: string): EmployeeReimbursement[] {
    const list = StorageEngine.getList<EmployeeReimbursement>(STORAGE_KEYS.EMPLOYEE_REIMBURSEMENTS);
    return tenantId ? list.filter(r => r.tenantId === tenantId) : list;
  }

  public static getByEmployee(employeeId: string, tenantId?: string): EmployeeReimbursement[] {
    return this.getAll(tenantId).filter(r => r.employeeId === employeeId);
  }

  public static getById(id: string): EmployeeReimbursement | undefined {
    return this.getAll().find(r => r.id === id);
  }

  /**
   * Submit a reimbursement claim
   */
  public static submitClaim(params: {
    tenantId: string;
    employeeId: string;
    employeeName: string;
    expenseType: ReimbursementType;
    expenseDate: string;
    amount: number;
    description: string;
    receiptUrl?: string;
    receiptFileName?: string;
    payoutMethod?: 'Payroll' | 'Direct Transfer';
  }): EmployeeReimbursement {
    const newClaim: EmployeeReimbursement = {
      id: `reimb-${Date.now()}`,
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      expenseType: params.expenseType,
      expenseDate: params.expenseDate,
      amount: params.amount,
      description: params.description,
      receiptUrl: params.receiptUrl,
      receiptFileName: params.receiptFileName,
      status: 'Submitted',
      payoutMethod: params.payoutMethod || 'Payroll',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    StorageEngine.insert<EmployeeReimbursement>(STORAGE_KEYS.EMPLOYEE_REIMBURSEMENTS, newClaim);

    AuditService.log({
      userId: 'user-001',
      userName: params.employeeName,
      userRole: 'Employee',
      module: 'Reimbursements',
      action: 'CREATE',
      description: `Submitted ${params.expenseType} reimbursement claim for ₹${params.amount}`,
      recordId: newClaim.id,
    });

    return newClaim;
  }

  /**
   * Manager Approval
   */
  public static managerApprove(
    claimId: string,
    approvedBy: string = 'Manager'
  ): EmployeeReimbursement | undefined {
    const claim = this.getById(claimId);
    if (!claim) return undefined;

    const now = new Date().toISOString();
    return StorageEngine.update<EmployeeReimbursement>(STORAGE_KEYS.EMPLOYEE_REIMBURSEMENTS, claimId, {
      status: 'Manager Approved',
      managerApprovedBy: approvedBy,
      managerApprovedAt: now,
      updatedAt: now,
    });
  }

  /**
   * HR / Finance Final Approval
   */
  public static hrApprove(
    claimId: string,
    approvedAmount?: number,
    approvedBy: string = 'HR Admin'
  ): EmployeeReimbursement | undefined {
    const claim = this.getById(claimId);
    if (!claim) return undefined;

    const now = new Date().toISOString();
    const finalAmount = approvedAmount !== undefined ? approvedAmount : claim.amount;

    const updated = StorageEngine.update<EmployeeReimbursement>(STORAGE_KEYS.EMPLOYEE_REIMBURSEMENTS, claimId, {
      status: 'Approved',
      approvedAmount: finalAmount,
      hrApprovedBy: approvedBy,
      hrApprovedAt: now,
      updatedAt: now,
    });

    AuditService.log({
      userId: 'user-001',
      userName: approvedBy,
      userRole: 'HR Admin',
      module: 'Reimbursements',
      action: 'APPROVE',
      description: `Final approved reimbursement claim ${claimId} (₹${finalAmount}) for ${claim.employeeName}`,
      recordId: claimId,
    });

    return updated;
  }

  /**
   * Gathers approved reimbursements payable in payroll
   */
  public static processPayrollPayout(
    employeeId: string,
    payrollPeriodId: string,
    tenantId?: string
  ): { totalReimbursements: number; claims: EmployeeReimbursement[] } {
    const approvedClaims = this.getByEmployee(employeeId, tenantId).filter(
      r => r.status === 'Approved' && (r.payoutMethod === 'Payroll' || (r.payoutMethod as any) === 'Payroll Payout') && !r.paidPayrollPeriodId
    );

    let totalReimbursements = 0;
    const claims: EmployeeReimbursement[] = [];
    const now = new Date().toISOString();

    approvedClaims.forEach(claim => {
      const amt = claim.approvedAmount || claim.amount;
      totalReimbursements += amt;

      const updated = StorageEngine.update<EmployeeReimbursement>(STORAGE_KEYS.EMPLOYEE_REIMBURSEMENTS, claim.id, {
        status: 'Paid',
        paidPayrollPeriodId: payrollPeriodId,
        paidDate: now.split('T')[0],
        updatedAt: now,
      });
      if (updated) claims.push(updated);
    });

    return { totalReimbursements, claims };
  }
}
