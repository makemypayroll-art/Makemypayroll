// ====================================================================
// NovaPulse / MakeMyPayroll — Employee Loan Management Service
// Full EMI calculation, approval lifecycle, and payroll deduction sync
// ====================================================================

import { StorageEngine, STORAGE_KEYS } from '../../database/storageEngine';
import { EmployeeLoan, LoanStatus } from '../../database/schema';
import { AuditService } from '../auditService';

export class PayrollLoanService {
  public static getAll(tenantId?: string): EmployeeLoan[] {
    const list = StorageEngine.getList<EmployeeLoan>(STORAGE_KEYS.EMPLOYEE_LOANS);
    return tenantId ? list.filter(l => l.tenantId === tenantId) : list;
  }

  public static getByEmployee(employeeId: string, tenantId?: string): EmployeeLoan[] {
    return this.getAll(tenantId).filter(l => l.employeeId === employeeId);
  }

  public static getById(id: string): EmployeeLoan | undefined {
    return this.getAll().find(l => l.id === id);
  }

  /**
   * Standard Financial Monthly EMI Calculator
   * EMI = [P x R x (1+R)^N]/[(1+R)^N-1]
   */
  public static calculateMonthlyEMI(principal: number, annualInterestRatePercent: number, tenureMonths: number): number {
    if (principal <= 0 || tenureMonths <= 0) return 0;
    if (annualInterestRatePercent <= 0) {
      return Math.round(principal / tenureMonths);
    }
    const monthlyRate = annualInterestRatePercent / (12 * 100);
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1);
    return Math.round(emi);
  }

  /**
   * Creates a new employee loan request
   */
  public static createLoan(params: {
    tenantId: string;
    employeeId: string;
    employeeName: string;
    loanType: EmployeeLoan['loanType'];
    principalAmount: number;
    interestRateAnnualPercent?: number;
    tenureMonths: number;
    startMonth: string; // "YYYY-MM"
    requestedBy?: string;
  }): EmployeeLoan {
    const rate = Math.max(0, params.interestRateAnnualPercent || 0);
    const monthlyEmi = this.calculateMonthlyEMI(params.principalAmount, rate, params.tenureMonths);
    const totalPayable = monthlyEmi * params.tenureMonths;
    const totalInterest = Math.max(0, totalPayable - params.principalAmount);

    // Calculate endMonth
    const [yearStr, monthStr] = params.startMonth.split('-');
    const startDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
    startDate.setMonth(startDate.getMonth() + params.tenureMonths - 1);
    const endMonth = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}`;

    const newLoan: EmployeeLoan = {
      id: `loan-${Date.now()}`,
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      loanType: params.loanType,
      principalAmount: params.principalAmount,
      interestRateAnnualPercent: rate,
      tenureMonths: params.tenureMonths,
      monthlyEmi,
      startMonth: params.startMonth,
      endMonth,
      outstandingPrincipal: params.principalAmount,
      outstandingInterest: totalInterest,
      emisPaidCount: 0,
      status: 'Pending Approval',
      isDeductionPaused: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    StorageEngine.insert<EmployeeLoan>(STORAGE_KEYS.EMPLOYEE_LOANS, newLoan);

    AuditService.log({
      userId: params.requestedBy || 'user-001',
      userName: params.requestedBy || 'System User',
      userRole: 'HR Admin',
      module: 'Loan Management',
      action: 'CREATE',
      description: `Applied for ${params.loanType} of ₹${params.principalAmount} for employee ${params.employeeName} (${params.employeeId})`,
      recordId: newLoan.id,
    });

    return newLoan;
  }

  /**
   * Approves and disburses a loan
   */
  public static approveAndDisburse(
    loanId: string,
    approvedBy: string = 'Super Admin'
  ): EmployeeLoan | undefined {
    const loan = this.getById(loanId);
    if (!loan) return undefined;

    const now = new Date().toISOString();
    const updated = StorageEngine.update<EmployeeLoan>(STORAGE_KEYS.EMPLOYEE_LOANS, loanId, {
      status: 'Active',
      approvalDate: now.split('T')[0],
      approvedBy,
      disbursementDate: now.split('T')[0],
      updatedAt: now,
    });

    AuditService.log({
      userId: 'user-001',
      userName: approvedBy,
      userRole: 'HR Admin',
      module: 'Loan Management',
      action: 'APPROVE',
      description: `Approved & Disbursed loan ${loanId} (₹${loan.principalAmount}) for ${loan.employeeName}`,
      recordId: loanId,
    });

    return updated;
  }

  /**
   * Pause or Resume loan deduction
   */
  public static togglePauseDeduction(
    loanId: string,
    paused: boolean,
    changedBy: string = 'Super Admin',
    reason?: string
  ): EmployeeLoan | undefined {
    const loan = this.getById(loanId);
    if (!loan) return undefined;

    const updated = StorageEngine.update<EmployeeLoan>(STORAGE_KEYS.EMPLOYEE_LOANS, loanId, {
      isDeductionPaused: paused,
      status: paused ? 'Paused' : 'Active',
      updatedAt: new Date().toISOString(),
    });

    AuditService.log({
      userId: 'user-001',
      userName: changedBy,
      userRole: 'HR Admin',
      module: 'Loan Management',
      action: 'UPDATE',
      description: `${paused ? 'Paused' : 'Resumed'} loan EMI deductions for loan ${loanId}. Reason: ${reason || 'Administrative adjustment'}`,
      recordId: loanId,
    });

    return updated;
  }

  /**
   * Deducts EMI during payroll processing
   */
  public static processMonthlyDeduction(
    employeeId: string,
    periodMonth: string, // "YYYY-MM"
    tenantId?: string
  ): { totalEmiDeducted: number; affectedLoans: EmployeeLoan[] } {
    const activeLoans = this.getByEmployee(employeeId, tenantId).filter(
      l => (l.status === 'Active' || l.status === 'Disbursed') && !l.isDeductionPaused && l.outstandingPrincipal > 0
    );

    let totalEmiDeducted = 0;
    const affectedLoans: EmployeeLoan[] = [];

    activeLoans.forEach(loan => {
      const emi = Math.min(loan.monthlyEmi, loan.outstandingPrincipal + loan.outstandingInterest);
      if (emi > 0) {
        totalEmiDeducted += emi;
        const newPrincipal = Math.max(0, loan.outstandingPrincipal - emi);
        const newPaidCount = loan.emisPaidCount + 1;
        const isCompleted = newPrincipal === 0 || newPaidCount >= loan.tenureMonths;

        const updated = StorageEngine.update<EmployeeLoan>(STORAGE_KEYS.EMPLOYEE_LOANS, loan.id, {
          outstandingPrincipal: newPrincipal,
          emisPaidCount: newPaidCount,
          status: isCompleted ? 'Completed' : 'Active',
          updatedAt: new Date().toISOString(),
        });
        if (updated) affectedLoans.push(updated);
      }
    });

    return { totalEmiDeducted, affectedLoans };
  }
}
